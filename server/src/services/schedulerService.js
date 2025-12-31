const schedule = require('node-schedule');
const taskService = require('./taskService');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
    }

    _isLogEnabled() {
        const { getDB } = require('../db');
        const db = getDB();
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        return logSetting && logSetting.value === 'true';
    }

    init() {
        if (this._isLogEnabled()) console.log('Initializing scheduler...');
        const tasks = taskService.getAllTasks();
        tasks.forEach(task => {
            if (task.enabled) {
                this.scheduleTask(task);
            }
        });

        // Start daily cleanup job at 3:00 AM
        this.startCleanupJob();

        // Start cookie check job
        this.startCookieCheckJob();

        // Start checkin job
        this.startCheckinJob();

        // Start auto-cleanup job
        this.startAutoCleanupJob();
    }

    startCookieCheckJob() {
        if (this.cookieJob) {
            this.cookieJob.cancel();
        }

        const { getDB } = require('../db');
        const db = getDB();
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'cookie_check_interval'").get();
        const interval = parseInt(setting?.value || '60');

        if (this._isLogEnabled()) console.log(`Starting cookie check job with interval: ${interval} minutes`);

        const siteService = require('./siteService');
        const loggerService = require('./loggerService');
        // Define the job using RecurrenceRule or cron string
        // Cron: */interval * * * *
        this.cookieJob = schedule.scheduleJob(`*/${interval} * * * *`, async () => {
            if (this._isLogEnabled()) console.log(`[${new Date().toLocaleString()}] Periodic cookie check triggered...`);
            const results = await siteService.checkAllCookies();
            const valid = results.filter(r => r === true).length;
            if (this._isLogEnabled() || results.some(r => r === false)) {
                loggerService.log(`周期性 Cookie 检查完成：${valid}/${results.length} 站点有效`, results.every(r => r) ? 'success' : 'error');
            }
        });
    }

    startCheckinJob() {
        if (this.checkinJob) {
            this.checkinJob.cancel();
        }

        const { getDB } = require('../db');
        const db = getDB();
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'checkin_time'").get();
        const time = setting?.value || '09:00'; // HH:mm
        const [hour, minute] = time.split(':');

        if (this._isLogEnabled()) console.log(`Starting daily check-in job at: ${time}`);

        const siteService = require('./siteService');
        const loggerService = require('./loggerService');
        this.checkinJob = schedule.scheduleJob(`${minute} ${hour} * * *`, async () => {
            if (this._isLogEnabled()) console.log(`[${new Date().toLocaleString()}] Daily site check-in triggered...`);
            const successCount = await siteService.checkinAllSites();
            loggerService.log(`每日自动签到完成，成功 ${successCount} 个站点`, 'success');
        });
    }

    async startCleanupJob() {
        if (this._isLogEnabled()) console.log('Starting daily log cleanup job (3 AM)...');
        schedule.scheduleJob('0 3 * * *', async () => {
            await this.cleanOldLogs();
        });
    }

    startAutoCleanupJob() {
        if (this._isLogEnabled()) console.log('Starting auto-cleanup job (Hourly)...');
        // Run every hour
        schedule.scheduleJob('0 * * * *', async () => {
            const cleanupService = require('./cleanupService');
            await cleanupService.runCleanup();
        });
    }

    async cleanOldLogs() {
        if (this._isLogEnabled()) console.log('Executing log cleanup...');
        const { getDB } = require('../db');
        const db = getDB();

        try {
            const settings = {};
            db.prepare('SELECT * FROM settings').all().forEach(s => settings[s.key] = s.value);

            const days = parseInt(settings.log_retention_days) || 7;
            const maxCount = parseInt(settings.log_max_count) || 100;

            // 1. Delete logs older than X days
            const dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - days);
            const dateStr = dateThreshold.toISOString().split('T')[0];

            const delDate = db.prepare('DELETE FROM task_logs WHERE run_time < ?').run(dateStr);
            console.log(`[Cleanup] Deleted ${delDate.changes} logs older than ${dateStr}`);

            // 2. Keep only latest X logs per task
            const tasks = taskService.getAllTasks();
            let totalKeepDeleted = 0;
            for (const task of tasks) {
                const logs = db.prepare('SELECT id FROM task_logs WHERE task_id = ? ORDER BY run_time DESC').all(task.id);
                if (logs.length > maxCount) {
                    const toDelete = logs.slice(maxCount).map(l => l.id);
                    const delCount = db.prepare(`DELETE FROM task_logs WHERE id IN (${toDelete.join(',')})`).run();
                    totalKeepDeleted += delCount.changes;
                }
            }
            console.log(`[Cleanup] Deleted ${totalKeepDeleted} extra logs to maintain max count per task`);

            // 3. Delete site heatmap data older than 180 days
            const heatmapThreshold = new Date();
            heatmapThreshold.setDate(heatmapThreshold.getDate() - 180);
            const heatmapDateStr = heatmapThreshold.toISOString().split('T')[0];
            const delHeatmap = db.prepare('DELETE FROM site_daily_stats WHERE date < ?').run(heatmapDateStr);
            console.log(`[Cleanup] Deleted ${delHeatmap.changes} heatmap records older than ${heatmapDateStr}`);

            const loggerService = require('./loggerService');
            loggerService.log(`系统维护完成：清理了 ${delDate.changes + totalKeepDeleted} 条日志及 ${delHeatmap.changes} 条热力数据`, 'success');

        } catch (err) {
            console.error('[Cleanup] Failed to clean logs:', err.message);
        }
    }

    scheduleTask(task) {
        // Cancel existing job if any
        if (this.jobs.has(task.id)) {
            this.jobs.get(task.id).cancel();
        }

        console.log(`Scheduling task: ${task.name} with cron: ${task.cron}`);

        try {
            const job = schedule.scheduleJob(task.cron, () => {
                this.executeTask(task);
            });

            if (job) {
                this.jobs.set(task.id, job);
            }
        } catch (err) {
            console.error(`Failed to schedule task ${task.id}:`, err.message);
        }
    }

    cancelTask(id) {
        if (this.jobs.has(id)) {
            this.jobs.get(id).cancel();
            this.jobs.delete(id);
            if (this._isLogEnabled()) console.log(`Cancelled task: ${id}`);
        }
    }

    async executeTask(task) {
        if (this._isLogEnabled()) console.log(`[${new Date().toLocaleString()}] Executing task: ${task.name} (Type: ${task.type})`);

        if (task.type === 'rss') {
            const rssService = require('./rssService');
            await rssService.executeTask(task);
        } else {
            console.log(`Task type ${task.type} not yet implemented`);
        }
    }
}

module.exports = new SchedulerService();

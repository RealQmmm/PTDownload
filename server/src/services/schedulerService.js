const schedule = require('node-schedule');
const taskService = require('./taskService');
const timeUtils = require('../utils/timeUtils');
const appConfig = require('../utils/appConfig');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
    }

    _isLogEnabled() {
        return appConfig.isLogsEnabled();
    }

    init() {
        console.log('[Scheduler] Initializing scheduler service...');
        if (this._isLogEnabled()) console.log('Initializing scheduler...');

        try {
            // Init tasks
            this.reloadTasks();

            // Start system jobs
            this.startCleanupJob();
            this.startCookieCheckJob();
            this.startCheckinJob();
            this.startAutoCleanupJob();

            console.log('[Scheduler] Scheduler initialization completed');
        } catch (err) {
            console.error('[Scheduler] Failed to initialize scheduler:', err.message);
            console.error('[Scheduler] Stack trace:', err.stack);
        }
    }

    reload() {
        if (this._isLogEnabled()) console.log('Reloading scheduler...');

        try {
            // Reload tasks
            this.reloadTasks();

            // Restart system jobs (settings might have changed)
            this.startCleanupJob();
            this.startCookieCheckJob();
            this.startCheckinJob();
            this.startAutoCleanupJob();
        } catch (err) {
            console.error('[Scheduler] Failed to reload scheduler:', err.message);
            console.error('[Scheduler] Stack trace:', err.stack);
        }
    }

    reloadTasks() {
        try {
            // Cancel all existing task jobs
            for (const [id, job] of this.jobs) {
                job.cancel();
            }
            this.jobs.clear();

            // Load tasks from DB
            const tasks = taskService.getAllTasks();
            console.log(`[Scheduler] Found ${tasks.length} total tasks in database`);

            tasks.forEach(task => {
                if (task.enabled) {
                    this.scheduleTask(task);
                }
            });

            console.log(`[Scheduler] Loaded and scheduled ${this.jobs.size} enabled tasks`);
            if (this._isLogEnabled()) console.log(`Loaded and scheduled ${this.jobs.size} tasks.`);
        } catch (err) {
            console.error('[Scheduler] Failed to reload tasks:', err.message);
            console.error('[Scheduler] Stack trace:', err.stack);
        }
    }

    startCookieCheckJob() {
        try {
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

            let cronStr;
            if (interval >= 60) {
                const hours = Math.floor(interval / 60);
                const remainingMinutes = interval % 60;

                if (remainingMinutes === 0) {
                    // For exact hour intervals, generate explicit hour list
                    // e.g., every 3 hours: 0,3,6,9,12,15,18,21
                    const hourList = [];
                    for (let h = 0; h < 24; h += hours) {
                        hourList.push(h);
                    }
                    cronStr = `0 ${hourList.join(',')} * * *`;
                } else {
                    // Mixed hours and minutes, fall back to minute-based cron
                    cronStr = `*/${interval} * * * *`;
                }
            } else {
                // Less than 60 minutes, use minute-based cron
                cronStr = `*/${interval} * * * *`;
            }

            this.cookieJob = schedule.scheduleJob(cronStr, async () => {
                if (this._isLogEnabled()) console.log('Periodic cookie check triggered...');
                const results = await siteService.checkAllCookies();
                const valid = results.filter(r => r === true).length;
                if (this._isLogEnabled() || results.some(r => r === false)) {
                    loggerService.log(`周期性 Cookie 检查完成：${valid}/${results.length} 站点有效`, results.every(r => r) ? 'success' : 'error');
                }
            });
            console.log(`[Scheduler] Cookie check job scheduled with interval: ${interval} minutes (cron: ${cronStr})`);
        } catch (err) {
            console.error('[Scheduler] Failed to start cookie check job:', err.message);
        }
    }

    startCheckinJob() {
        try {
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
                if (this._isLogEnabled()) console.log('Daily site check-in triggered...');
                const successCount = await siteService.checkinAllSites();
                loggerService.log(`每日自动签到完成，成功 ${successCount} 个站点`, 'success');
            });
            console.log(`[Scheduler] Daily check-in job scheduled at: ${time}`);
        } catch (err) {
            console.error('[Scheduler] Failed to start check-in job:', err.message);
        }
    }

    async startCleanupJob() {
        try {
            if (this._isLogEnabled()) console.log('Starting daily log cleanup job (3 AM)...');
            schedule.scheduleJob('0 3 * * *', async () => {
                await this.cleanOldLogs();
            });
        } catch (err) {
            console.error('[Scheduler] Failed to start cleanup job:', err.message);
        }
    }

    startAutoCleanupJob() {
        try {
            if (this.autoCleanupJob) {
                this.autoCleanupJob.cancel();
                this.autoCleanupJob = null;
            }

            const { getDB } = require('../db');
            const db = getDB();
            const setting = db.prepare("SELECT value FROM settings WHERE key = 'cleanup_enabled'").get();
            const enabled = setting?.value === 'true';

            if (!enabled) {
                if (this._isLogEnabled()) console.log('Auto-cleanup is disabled, skipping job registration.');
                return;
            }

            if (this._isLogEnabled()) console.log('Starting auto-cleanup job (Hourly)...');
            // Run every hour
            this.autoCleanupJob = schedule.scheduleJob('0 * * * *', async () => {
                const cleanupService = require('./cleanupService');
                await cleanupService.runCleanup();
            });
            console.log('[Scheduler] Auto-cleanup job scheduled (Hourly)');
        } catch (err) {
            console.error('[Scheduler] Failed to start auto-cleanup job:', err.message);
        }
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
            const dateStr = timeUtils.getLocalDateString(dateThreshold);

            const delDate = db.prepare('DELETE FROM task_logs WHERE run_time < ?').run(dateStr);
            const delLoginDate = db.prepare('DELETE FROM login_logs WHERE created_at < ?').run(dateStr);
            console.log(`[Cleanup] Deleted ${delDate.changes} task logs and ${delLoginDate.changes} login logs older than ${dateStr}`);

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

            // 2b. Global cap for login logs (keep latest 1000)
            const loginMaxCount = 1000;
            const allLoginLogs = db.prepare('SELECT id FROM login_logs ORDER BY created_at DESC').all();
            let loginKeepDeleted = 0;
            if (allLoginLogs.length > loginMaxCount) {
                const toDelete = allLoginLogs.slice(loginMaxCount).map(l => l.id);
                // Chunk deletion if too many
                const delCount = db.prepare(`DELETE FROM login_logs WHERE id IN (${toDelete.join(',')})`).run();
                loginKeepDeleted = delCount.changes;
            }
            console.log(`[Cleanup] Deleted ${totalKeepDeleted} extra task logs and ${loginKeepDeleted} extra login logs`);

            // 3. Delete site heatmap data older than 180 days
            const heatmapThreshold = new Date();
            heatmapThreshold.setDate(heatmapThreshold.getDate() - 180);
            const heatmapDateStr = timeUtils.getLocalDateString(heatmapThreshold);
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

        console.log(`Scheduling task: ${task.name} (ID: ${task.id}) with cron: ${task.cron}`);

        try {
            // Store task ID instead of task object to avoid stale data
            const taskId = task.id;

            const job = schedule.scheduleJob(task.cron, async () => {
                // Fetch latest task info from database each time
                const latestTask = taskService.getTaskById(taskId);

                if (!latestTask) {
                    if (this._isLogEnabled()) console.warn(`Task ${taskId} no longer exists. Cancelling job.`);
                    this.cancelTask(taskId);
                    return;
                }

                if (!latestTask.enabled) {
                    if (this._isLogEnabled()) console.log(`Task ${taskId} is disabled. Skipping execution.`);
                    return;
                }

                await this.executeTask(latestTask);
            });

            if (job) {
                this.jobs.set(task.id, job);
                if (this._isLogEnabled()) console.log(`Successfully scheduled task ${task.id}: ${task.name}`);
            } else {
                console.error(`Failed to create schedule job for task ${task.id}. Invalid cron: ${task.cron}`);
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
        if (this._isLogEnabled()) console.log(`Executing task: ${task.name} (Type: ${task.type})`);

        if (task.type === 'rss') {
            const rssService = require('./rssService');
            await rssService.executeTask(task);
        } else if (task.type === 'smart_rss') {
            const rssService = require('./rssService');
            await rssService.executeSmartTask(task);
        } else {
            console.log(`Task type ${task.type} not yet implemented`);
        }
    }

    restartHotResourcesJob() {
        // Stub for now, will be implemented when timing function is added
        if (this._isLogEnabled()) console.log('[Scheduler] Hot resources job restart requested (not implemented yet)');
    }
}

module.exports = new SchedulerService();

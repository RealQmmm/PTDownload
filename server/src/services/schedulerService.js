const schedule = require('node-schedule');
const taskService = require('./taskService');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
    }

    init() {
        console.log('Initializing scheduler...');
        const tasks = taskService.getAllTasks();
        tasks.forEach(task => {
            if (task.enabled) {
                this.scheduleTask(task);
            }
        });

        // Start daily cleanup job at 3:00 AM
        this.startCleanupJob();
    }

    startCleanupJob() {
        console.log('Starting daily log cleanup job (3 AM)...');
        schedule.scheduleJob('0 3 * * *', () => {
            this.cleanOldLogs();
        });
    }

    async cleanOldLogs() {
        console.log('Executing log cleanup...');
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
            console.log(`Cancelled task: ${id}`);
        }
    }

    async executeTask(task) {
        console.log(`[${new Date().toLocaleString()}] Executing task: ${task.name} (Type: ${task.type})`);

        if (task.type === 'rss') {
            const rssService = require('./rssService');
            await rssService.executeTask(task);
        } else {
            console.log(`Task type ${task.type} not yet implemented`);
        }
    }
}

module.exports = new SchedulerService();

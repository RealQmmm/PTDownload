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
        console.log(`[${new Date().toLocaleString()}] Executing task: ${task.name}`);
        // TODO: Implement actual scraping logic
        // 1. Get sites
        // 2. Search for torrents based on rules
        // 3. Add to download clients
        console.log(`Task ${task.name} executed (placeholder logic)`);
    }
}

module.exports = new SchedulerService();

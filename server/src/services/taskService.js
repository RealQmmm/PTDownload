const { getDB } = require('../db');

class TaskService {
    constructor() {
        this.db = null;
    }

    _getDB() {
        if (!this.db) {
            this.db = getDB();
        }
        return this.db;
    }

    getAllTasks() {
        return this._getDB().prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    }

    getTaskById(id) {
        return this._getDB().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    }

    createTask(task) {
        const { name, type = 'rss', cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled = 1, auto_disable_on_match = 0 } = task;
        const info = this._getDB().prepare(
            'INSERT INTO tasks (name, type, cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled, auto_disable_on_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(name, type, cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled, auto_disable_on_match);
        return info.lastInsertRowid;
    }

    updateTask(id, task) {
        const { name, type, cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled, auto_disable_on_match } = task;
        return this._getDB().prepare(
            'UPDATE tasks SET name = ?, type = ?, cron = ?, site_id = ?, rss_url = ?, filter_config = ?, client_id = ?, save_path = ?, category = ?, enabled = ?, auto_disable_on_match = ? WHERE id = ?'
        ).run(name, type, cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled, auto_disable_on_match, id);
    }

    deleteTask(id) {
        return this._getDB().prepare('DELETE FROM tasks WHERE id = ?').run(id);
    }

    toggleTask(id, enabled) {
        return this._getDB().prepare('UPDATE tasks SET enabled = ? WHERE id = ?').run(enabled, id);
    }
}

module.exports = new TaskService();

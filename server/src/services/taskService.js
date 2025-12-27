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
        const { name, cron, rules, enabled = 1 } = task;
        const info = this._getDB().prepare(
            'INSERT INTO tasks (name, cron, rules, enabled) VALUES (?, ?, ?, ?)'
        ).run(name, cron, rules, enabled);
        return info.lastInsertRowid;
    }

    updateTask(id, task) {
        const { name, cron, rules, enabled } = task;
        return this._getDB().prepare(
            'UPDATE tasks SET name = ?, cron = ?, rules = ?, enabled = ? WHERE id = ?'
        ).run(name, cron, rules, enabled, id);
    }

    deleteTask(id) {
        return this._getDB().prepare('DELETE FROM tasks WHERE id = ?').run(id);
    }

    toggleTask(id, enabled) {
        return this._getDB().prepare('UPDATE tasks SET enabled = ? WHERE id = ?').run(enabled, id);
    }
}

module.exports = new TaskService();

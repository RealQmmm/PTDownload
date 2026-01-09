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
        return this._getDB().prepare('SELECT * FROM tasks ORDER BY enabled DESC, created_at DESC').all();
    }

    getTaskById(id) {
        return this._getDB().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    }

    createTask(task) {
        const { name, type = 'rss', cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled = 1, auto_disable_on_match } = task;

        // Smart auto-disable logic: if not explicitly set, determine based on category
        let finalAutoDisable = auto_disable_on_match;
        if (finalAutoDisable === undefined) {
            // Auto-disable for one-time downloads (Movies, Music, Books, etc.)
            const oneTimeCategories = ['movie', 'movies', 'film', 'films', '电影', 'music', 'album', '音乐', 'book', 'books', '书籍', 'game', 'games', '游戏'];
            const categoryLower = (category || '').toLowerCase();
            finalAutoDisable = oneTimeCategories.some(cat => categoryLower.includes(cat)) ? 1 : 0;
        }

        const info = this._getDB().prepare(
            'INSERT INTO tasks (name, type, cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled, auto_disable_on_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(name, type, cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled, finalAutoDisable);
        return info.lastInsertRowid;
    }

    updateTask(id, task) {
        const { name, type, cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled, auto_disable_on_match } = task;
        return this._getDB().prepare(
            'UPDATE tasks SET name = ?, type = ?, cron = ?, site_id = ?, rss_url = ?, filter_config = ?, client_id = ?, save_path = ?, category = ?, enabled = ?, auto_disable_on_match = ? WHERE id = ?'
        ).run(name, type, cron, site_id, rss_url, filter_config, client_id, save_path, category, enabled, auto_disable_on_match, id);
    }

    deleteTask(id) {
        const db = this._getDB();

        // Delete related records first to avoid foreign key constraint
        // 1. Delete task history
        db.prepare('DELETE FROM task_history WHERE task_id = ?').run(id);

        // 2. Delete task logs
        db.prepare('DELETE FROM task_logs WHERE task_id = ?').run(id);

        // 3. Delete the task itself
        return db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    }

    toggleTask(id, enabled) {
        return this._getDB().prepare('UPDATE tasks SET enabled = ? WHERE id = ?').run(enabled, id);
    }
}

module.exports = new TaskService();

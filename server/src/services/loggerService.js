const { getDB } = require('../db');
const timeUtils = require('../utils/timeUtils');

class LoggerService {
    log(message, status = 'success', taskId = null, found = 0, matched = 0) {
        const db = getDB();
        try {
            // Using local ISO style time
            const localTime = timeUtils.getLocalISOString();
            db.prepare('INSERT INTO task_logs (task_id, run_time, status, message, items_found, items_matched) VALUES (?, ?, ?, ?, ?, ?)')
                .run(taskId, localTime, status, message, found, matched);

            // If it's a task log, also update the task's last_run time
            if (taskId) {
                db.prepare('UPDATE tasks SET last_run = ? WHERE id = ?').run(localTime, taskId);
            }
        } catch (err) {
            console.error('[Logger] Failed to write log:', err.message);
        }
    }

    getLogs(limit = 100, taskId = null) {
        const db = getDB();
        try {
            let sql = `
                SELECT task_logs.*, tasks.name as task_name 
                FROM task_logs 
                LEFT JOIN tasks ON task_logs.task_id = tasks.id 
            `;
            const params = [];

            if (taskId) {
                sql += ` WHERE task_logs.task_id = ? `;
                params.push(taskId);
            }

            sql += ` ORDER BY task_logs.run_time DESC LIMIT ? `;
            params.push(limit);

            return db.prepare(sql).all(...params);
        } catch (err) {
            console.error('[Logger] Failed to fetch logs:', err.message);
            return [];
        }
    }

    clearLogs(taskId = null) {
        const db = getDB();
        try {
            if (taskId) {
                return db.prepare('DELETE FROM task_logs WHERE task_id = ?').run(taskId);
            } else {
                return db.prepare('DELETE FROM task_logs').run();
            }
        } catch (err) {
            console.error('[Logger] Failed to clear logs:', err.message);
            return { changes: 0 };
        }
    }
}

module.exports = new LoggerService();

const express = require('express');
const router = express.Router();
const loggerService = require('../services/loggerService');

// Get all logs
router.get('/', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const taskId = req.query.taskId ? parseInt(req.query.taskId) : null;
        const logs = loggerService.getLogs(limit, taskId);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear logs
router.delete('/', (req, res) => {
    try {
        const taskId = req.query.taskId ? parseInt(req.query.taskId) : null;
        const result = loggerService.clearLogs(taskId);
        res.json({ success: true, message: `已清空 ${result.changes} 条日志记录` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const schedulerService = require('../services/schedulerService');

// Get all tasks
router.get('/', (req, res) => {
    try {
        const tasks = taskService.getAllTasks();
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create task
router.post('/', (req, res) => {
    try {
        const id = taskService.createTask(req.body);
        const newTask = { id, ...req.body };
        if (newTask.enabled) {
            schedulerService.scheduleTask(newTask);
        }
        res.status(201).json(newTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update task
router.put('/:id', (req, res) => {
    try {
        taskService.updateTask(req.params.id, req.body);
        const updatedTask = { id: parseInt(req.params.id), ...req.body };
        if (updatedTask.enabled) {
            schedulerService.scheduleTask(updatedTask);
        } else {
            schedulerService.cancelTask(updatedTask.id);
        }
        res.json({ message: 'Task updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete task
router.delete('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        taskService.deleteTask(id);
        schedulerService.cancelTask(id);
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle task
router.patch('/:id/toggle', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { enabled } = req.body;
        taskService.toggleTask(id, enabled ? 1 : 0);

        if (enabled) {
            const task = taskService.getTaskById(id);
            schedulerService.scheduleTask(task);
        } else {
            schedulerService.cancelTask(id);
        }

        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

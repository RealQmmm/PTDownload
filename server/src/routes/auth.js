const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await authService.login(username, password);
        res.json(result);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

// Get current user info
router.get('/me', (req, res) => {
    res.json({ user: req.user });
});

// Change password
router.post('/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    try {
        await authService.changePassword(req.user.id, oldPassword, newPassword);
        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { requireAdmin } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await authService.login(username, password, {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.json(result);
    } catch (err) {
        console.warn(`[Security] Failed login attempt - User: ${username}, IP: ${req.ip}, Error: ${err.message}`);
        res.status(401).json({ error: err.message });
    }
});

// Get current user info
router.get('/me', (req, res) => {
    // Get fresh user data from database to ensure role is up-to-date
    const user = authService.getUserById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
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

// Change username (for current user)
router.post('/change-username', async (req, res) => {
    const { newUsername } = req.body;
    if (!newUsername || newUsername.length < 2) {
        return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }
    try {
        const result = await authService.changeUsername(req.user.id, newUsername);
        res.json({ message: 'Username changed successfully', username: result.username });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ==================== Admin-only User Management APIs ====================

// Get all users (admin only)
router.get('/users', requireAdmin, (req, res) => {
    try {
        const users = authService.getAllUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new user (admin only)
router.post('/users', requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 2) {
        return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const userId = await authService.createUser(username, password, role || 'user');
        res.json({ message: 'User created successfully', userId });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete user (admin only)
router.delete('/users/:id', requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    try {
        await authService.deleteUser(userId, req.user.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update user role (admin only)
router.put('/users/:id/role', requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    try {
        await authService.updateUserRole(userId, role);
        res.json({ message: 'User role updated successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Toggle user status (admin only)
router.put('/users/:id/status', requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    try {
        const result = await authService.toggleUserStatus(userId, req.user.id);
        res.json({ message: 'User status updated successfully', enabled: result.enabled });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get login logs (admin only)
router.get('/login-logs', requireAdmin, (req, res) => {
    try {
        const logs = authService.getLoginLogs();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear login logs (admin only)
router.delete('/login-logs', requireAdmin, (req, res) => {
    try {
        const result = authService.clearLoginLogs();
        res.json({ success: true, message: `已清空 ${result.changes} 条登录记录` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        await authService.resetUserPassword(userId, newPassword);
        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update username for a user (admin only)
router.put('/users/:id/username', requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { username } = req.body;
    if (!username || username.length < 2) {
        return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }
    try {
        const result = await authService.changeUsername(userId, username);
        res.json({ message: 'Username updated successfully', username: result.username });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update user permissions (admin only)
router.put('/users/:id/permissions', requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { permissions } = req.body;
    try {
        await authService.updateUserPermissions(userId, permissions);
        res.json({ message: 'User permissions updated successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;

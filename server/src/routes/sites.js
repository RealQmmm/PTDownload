const express = require('express');
const router = express.Router();
const siteService = require('../services/siteService');

// Get all sites
router.get('/', (req, res) => {
    try {
        const sites = siteService.getAllSites();
        res.json(sites);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get site by ID
router.get('/:id', (req, res) => {
    try {
        const site = siteService.getSiteById(req.params.id);
        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }
        res.json(site);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create site
router.post('/', (req, res) => {
    try {
        const id = siteService.createSite(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update site
router.put('/:id', (req, res) => {
    try {
        siteService.updateSite(req.params.id, req.body);
        res.json({ message: 'Site updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete site
router.delete('/:id', (req, res) => {
    try {
        siteService.deleteSite(req.params.id);
        res.json({ message: 'Site deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle site enabled status
router.patch('/:id/toggle', (req, res) => {
    try {
        const { enabled } = req.body;
        siteService.toggleSite(req.params.id, enabled ? 1 : 0);
        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check site cookie status
router.get('/:id/check-cookie', async (req, res) => {
    try {
        const isValid = await siteService.checkCookie(req.params.id);
        res.json({ isValid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check all sites' cookie status
router.post('/check-all', async (req, res) => {
    try {
        await siteService.checkAllCookies();
        res.json({ message: 'All cookies checked' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Refresh site user stats
router.get('/:id/refresh-stats', async (req, res) => {
    try {
        const stats = await siteService.refreshUserStats(req.params.id);
        res.json({ stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Refresh all sites' user stats
router.post('/refresh-all-stats', async (req, res) => {
    try {
        await siteService.refreshAllUserStats();
        res.json({ message: 'All user stats refreshed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual checkin for a site
router.post('/:id/checkin', async (req, res) => {
    try {
        const success = await siteService.checkinSite(req.params.id);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual checkin for all sites
router.post('/checkin-all', async (req, res) => {
    try {
        const count = await siteService.checkinAllSites();
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const hotResourcesService = require('../services/hotResourcesService');
const downloaderService = require('../services/downloaderService');
const clientService = require('../services/clientService');

/**
 * Get hot resources list
 */
router.get('/', async (req, res) => {
    try {
        const filters = {
            siteId: req.query.siteId ? parseInt(req.query.siteId) : undefined,
            notified: req.query.notified !== undefined ? req.query.notified === 'true' : undefined,
            downloaded: req.query.downloaded !== undefined ? req.query.downloaded === 'true' : undefined,
            minScore: req.query.minScore ? parseInt(req.query.minScore) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };

        const resources = hotResourcesService.getHotResources(filters);
        res.json({ success: true, resources });
    } catch (err) {
        console.error('Get hot resources error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Get hot resources configuration
 */
router.get('/config', async (req, res) => {
    try {
        const config = hotResourcesService.getConfig();
        res.json({ success: true, config });
    } catch (err) {
        console.error('Get hot resources config error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Update hot resources configuration
 */
router.post('/config', async (req, res) => {
    try {
        const config = hotResourcesService.updateConfig(req.body);

        // Restart scheduler if interval changed
        if (req.body.checkInterval !== undefined || req.body.enabled !== undefined) {
            const schedulerService = require('../services/schedulerService');
            schedulerService.restartHotResourcesJob();
        }

        res.json({ success: true, config });
    } catch (err) {
        console.error('Update hot resources config error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Manually trigger hot resources detection
 */
router.post('/check', async (req, res) => {
    try {
        const result = await hotResourcesService.detectHotResources();
        res.json(result);
    } catch (err) {
        console.error('Manual hot resources check error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Download a hot resource
 */
router.post('/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const { clientId, savePath } = req.body;

        const db = require('../db').getDB();
        const resource = db.prepare('SELECT * FROM hot_resources WHERE id = ?').get(id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        // Get client
        let client;
        if (clientId) {
            client = clientService.getClientById(parseInt(clientId));
        } else {
            const config = hotResourcesService.getConfig();
            if (config.defaultClient) {
                client = clientService.getClientById(parseInt(config.defaultClient));
            }
        }

        if (!client) {
            const clients = clientService.getAllClients();
            if (clients.length === 0) {
                return res.status(400).json({ success: false, message: 'No download client available' });
            }
            client = clients.find(c => c.is_default) || clients[0];
        }

        // Download torrent
        const downloadResult = await downloaderService.addTorrent(client, {
            url: resource.download_url,
            savePath: savePath || undefined
        });

        if (downloadResult.success) {
            hotResourcesService.markAsDownloaded(id);
            res.json({ success: true, message: 'Download started successfully' });
        } else {
            res.status(500).json({ success: false, message: downloadResult.message || 'Download failed' });
        }
    } catch (err) {
        console.error('Download hot resource error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Update user action for a hot resource
 */
router.put('/:id/action', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'ignored', 'downloaded', 'pending'

        if (!['ignored', 'downloaded', 'pending'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        hotResourcesService.updateUserAction(id, action);
        res.json({ success: true, message: 'Action updated' });
    } catch (err) {
        console.error('Update hot resource action error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Delete a hot resource record
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../db').getDB();

        db.prepare('DELETE FROM hot_resources WHERE id = ?').run(id);
        res.json({ success: true, message: 'Resource deleted' });
    } catch (err) {
        console.error('Delete hot resource error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Get hot resources statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const db = require('../db').getDB();

        const total = db.prepare('SELECT COUNT(*) as count FROM hot_resources').get().count;
        const notified = db.prepare('SELECT COUNT(*) as count FROM hot_resources WHERE notified = 1').get().count;
        const downloaded = db.prepare('SELECT COUNT(*) as count FROM hot_resources WHERE downloaded = 1').get().count;
        const pending = db.prepare('SELECT COUNT(*) as count FROM hot_resources WHERE downloaded = 0 AND (user_action IS NULL OR user_action = \'pending\')').get().count;

        const topSites = db.prepare(`
            SELECT s.name, COUNT(*) as count
            FROM hot_resources hr
            LEFT JOIN sites s ON hr.site_id = s.id
            GROUP BY hr.site_id
            ORDER BY count DESC
            LIMIT 5
        `).all();

        res.json({
            success: true,
            stats: {
                total,
                notified,
                downloaded,
                pending,
                topSites
            }
        });
    } catch (err) {
        console.error('Get hot resources stats error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

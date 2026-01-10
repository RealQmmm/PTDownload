const express = require('express');
const router = express.Router();
const seriesService = require('../services/seriesService');

// Get all subscriptions
router.get('/', async (req, res) => {
    try {
        const subs = await seriesService.getAllSubscriptions();
        res.json(subs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create subscription
// Create subscription
router.post('/', async (req, res) => {
    try {
        const id = await seriesService.createSubscription(req.body, req.user.id);
        res.json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Update subscription
router.put('/:id', async (req, res) => {
    try {
        const result = await seriesService.updateSubscription(req.params.id, req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete subscription
router.delete('/:id', (req, res) => {
    try {
        seriesService.deleteSubscription(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/episodes', async (req, res) => {
    try {
        const skipFileScan = req.query.skipFileScan === 'true';
        let episodes;

        if (skipFileScan) {
            episodes = await seriesService.getEpisodes(req.params.id);
        } else {
            // Full sync from history and downloader
            episodes = await seriesService.syncEpisodesFromHistory(req.params.id);
        }

        res.json(episodes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Refresh metadata
router.put('/:id/refresh-metadata', async (req, res) => {
    try {
        const result = await seriesService.refreshMetadata(req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const seriesService = require('../services/seriesService');

// Get all subscriptions
router.get('/', (req, res) => {
    try {
        const subs = seriesService.getAllSubscriptions();
        res.json(subs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create subscription
router.post('/', (req, res) => {
    try {
        const id = seriesService.createSubscription(req.body);
        res.json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Update subscription
router.put('/:id', (req, res) => {
    try {
        const result = seriesService.updateSubscription(req.params.id, req.body);
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

router.get('/:id/episodes', (req, res) => {
    try {
        const episodes = seriesService.getEpisodes(req.params.id);
        res.json(episodes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

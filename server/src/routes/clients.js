const express = require('express');
const router = express.Router();
const clientService = require('../services/clientService');
const downloaderService = require('../services/downloaderService');

// Test connection
router.post('/test', async (req, res) => {
    try {
        const result = await downloaderService.testConnection(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get all clients
router.get('/', (req, res) => {
    try {
        const clients = clientService.getAllClients();
        res.json(clients);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create client
router.post('/', (req, res) => {
    try {
        const id = clientService.createClient(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update client
router.put('/:id', (req, res) => {
    try {
        clientService.updateClient(req.params.id, req.body);
        res.json({ message: 'Client updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete client
router.delete('/:id', (req, res) => {
    try {
        clientService.deleteClient(req.params.id);
        res.json({ message: 'Client deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get torrents from all clients
router.get('/torrents', async (req, res) => {
    try {
        const clients = clientService.getAllClients();
        const results = [];

        for (const client of clients) {
            const data = await downloaderService.getTorrents(client);
            results.push({
                clientId: client.id,
                ...data
            });
        }

        // Aggregate stats
        const aggregatedStats = {
            totalDownloaded: 0,
            totalUploaded: 0,
            dlSpeed: 0,
            upSpeed: 0,
            activeTorrents: 0,
            downloadingCount: 0,
            seedingCount: 0
        };

        const allTorrents = [];

        for (const result of results) {
            if (result.success && result.stats) {
                aggregatedStats.totalDownloaded += result.stats.totalDownloaded || 0;
                aggregatedStats.totalUploaded += result.stats.totalUploaded || 0;
                aggregatedStats.dlSpeed += result.stats.dlSpeed || 0;
                aggregatedStats.upSpeed += result.stats.upSpeed || 0;
            }
            if (result.success && result.torrents) {
                aggregatedStats.activeTorrents += result.torrents.length;
                for (const t of result.torrents) {
                    allTorrents.push({
                        ...t,
                        clientType: result.clientType,
                        clientName: result.clientName
                    });
                    if (t.state === 'downloading') aggregatedStats.downloadingCount++;
                    if (t.state === 'seeding') aggregatedStats.seedingCount++;
                }
            }
        }

        res.json({
            clients: results,
            stats: aggregatedStats,
            torrents: allTorrents
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

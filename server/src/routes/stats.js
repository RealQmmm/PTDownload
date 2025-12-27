const express = require('express');
const router = express.Router();
const clientService = require('../services/clientService');
const downloaderService = require('../services/downloaderService');

// Get download statistics from all clients
router.get('/', async (req, res) => {
    try {
        const clients = clientService.getAllClients();

        if (clients.length === 0) {
            return res.json({
                success: true,
                stats: {
                    totalDownloadSpeed: 0,
                    totalUploadSpeed: 0,
                    totalDownloaded: 0,
                    totalUploaded: 0,
                    activeTorrents: 0,
                    totalTorrents: 0
                },
                clients: []
            });
        }

        // Fetch stats from all clients
        const clientStats = await Promise.all(
            clients.map(async (client) => {
                try {
                    const result = await downloaderService.getTorrents(client);
                    if (result.success) {
                        return {
                            clientId: client.id,
                            clientName: client.name,
                            clientType: result.clientType,
                            stats: result.stats,
                            torrents: result.torrents,
                            activeTorrents: result.torrents.filter(t =>
                                t.state === 'downloading' ||
                                t.state === 'uploading' ||
                                t.state === 'stalledDL' ||
                                t.state === 'stalledUP'
                            ).length,
                            totalTorrents: result.torrents.length
                        };
                    }
                    return null;
                } catch (err) {
                    console.error(`Failed to get stats from client ${client.name}:`, err.message);
                    return null;
                }
            })
        );

        // Filter out failed clients
        const validClientStats = clientStats.filter(s => s !== null);

        // Aggregate stats
        const aggregatedStats = validClientStats.reduce(
            (acc, clientStat) => ({
                totalDownloadSpeed: acc.totalDownloadSpeed + (clientStat.stats.dlSpeed || 0),
                totalUploadSpeed: acc.totalUploadSpeed + (clientStat.stats.upSpeed || 0),
                totalDownloaded: acc.totalDownloaded + (clientStat.stats.totalDownloaded || 0),
                totalUploaded: acc.totalUploaded + (clientStat.stats.totalUploaded || 0),
                activeTorrents: acc.activeTorrents + clientStat.activeTorrents,
                totalTorrents: acc.totalTorrents + clientStat.totalTorrents
            }),
            {
                totalDownloadSpeed: 0,
                totalUploadSpeed: 0,
                totalDownloaded: 0,
                totalUploaded: 0,
                activeTorrents: 0,
                totalTorrents: 0
            }
        );

        res.json({
            success: true,
            stats: aggregatedStats,
            clients: validClientStats
        });

    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

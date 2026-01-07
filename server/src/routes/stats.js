const express = require('express');
const router = express.Router();
const clientService = require('../services/clientService');
const downloaderService = require('../services/downloaderService');

const statsService = require('../services/statsService');

// Get download statistics from all clients
router.get('/', async (req, res) => {
    try {
        // Trigger a fresh stats update to keep the dashboard current
        await statsService.updateDailyStats();

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
                                t.state === 'stalledUP' ||
                                t.state === 'pausedDL'
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
                activeTorrents: acc.activeTorrents + clientStat.activeTorrents,
                totalTorrents: acc.totalTorrents + clientStat.totalTorrents
            }),
            {
                totalDownloadSpeed: 0,
                totalUploadSpeed: 0,
                activeTorrents: 0,
                totalTorrents: 0
            }
        );

        const memStats = statsService.getStats();

        // Fetch today's actual traffic delta (now from memory)
        const displayedDownload = memStats.todayDownloaded;

        res.json({
            success: true,
            stats: {
                ...aggregatedStats,
                totalDownloaded: displayedDownload,
                totalUploaded: memStats.todayUploaded
            },
            clients: validClientStats
        });

    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get download statistics history
router.get('/history', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const history = statsService.getHistory(days);
        res.json({ success: true, history });
    } catch (err) {
        console.error('Stats history error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/today-downloads', (req, res) => {
    try {
        const db = require('../db').getDB();
        const timeUtils = require('../utils/timeUtils');
        const todayLocalStr = timeUtils.getLocalDateString();

        // Query all finished and filter in JavaScript to handle mixed time formats
        const allFinished = db.prepare(`
            SELECT th.*, IFNULL(t.name, '手动下载') as task_name 
            FROM task_history th
            LEFT JOIN tasks t ON th.task_id = t.id
            WHERE th.is_finished = 1 AND th.finish_time IS NOT NULL
            ORDER BY th.finish_time DESC
        `).all();

        const downloads = allFinished.filter(row => {
            if (!row.finish_time) return false;
            try {
                let finishDate;
                if (row.finish_time.endsWith('Z') || row.finish_time.includes('+')) {
                    finishDate = new Date(row.finish_time);
                } else {
                    finishDate = new Date(row.finish_time + '+08:00');
                }
                const finishLocalStr = timeUtils.getLocalDateString(finishDate);
                return finishLocalStr === todayLocalStr;
            } catch (e) {
                return false;
            }
        });

        res.json({ success: true, downloads });
    } catch (err) {
        console.error('Fetch today downloads error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/dashboard', async (req, res) => {
    try {
        // 1. Trigger stats update (Optional: can comment this out and rely on background job to reduce writes)
        // await statsService.updateDailyStats();

        // 2. Fetch all required data in parallel
        const clients = clientService.getAllClients();
        const db = require('../db').getDB();
        const todayStr = statsService.getLocalDateString();

        // Fetch clients stats
        const clientStats = await Promise.all(
            clients.map(async (client) => {
                const result = await downloaderService.getTorrents(client);
                if (result.success) {
                    return {
                        clientId: client.id,
                        clientName: client.name,
                        clientType: result.clientType,
                        stats: result.stats,
                        torrents: result.torrents,
                        activeTorrents: result.torrents.filter(t =>
                            ['downloading', 'uploading', 'stalledDL', 'stalledUP', 'pausedDL'].includes(t.state)
                        ).length,
                        totalTorrents: result.torrents.length
                    };
                }
                return null;
            })
        );
        const validClientStats = clientStats.filter(s => s !== null);

        // Aggregate
        const aggregatedStats = validClientStats.reduce(
            (acc, clientStat) => ({
                totalDownloadSpeed: acc.totalDownloadSpeed + (clientStat.stats.dlSpeed || 0),
                totalUploadSpeed: acc.totalUploadSpeed + (clientStat.stats.upSpeed || 0),
                activeTorrents: acc.activeTorrents + clientStat.activeTorrents,
                totalTorrents: acc.totalTorrents + clientStat.totalTorrents
            }),
            { totalDownloadSpeed: 0, totalUploadSpeed: 0, activeTorrents: 0, totalTorrents: 0 }
        );

        const memStats = statsService.getStats();
        const history = statsService.getHistory(7);

        // Detailed Today's Downloads
        // Note: finish_time in DB may be stored as:
        //   1. UTC with Z suffix: "2026-01-06T20:35:18.000Z"
        //   2. Local time without timezone: "2026-01-06T20:35:18"
        // We need to handle both cases by comparing dates in local timezone
        const timeUtils = require('../utils/timeUtils');
        const todayLocalStr = timeUtils.getLocalDateString(); // e.g., '2026-01-07'

        // Query all finished downloads and filter by local date in JavaScript
        const allFinished = db.prepare(`
            SELECT th.*, IFNULL(t.name, '手动下载') as task_name 
            FROM task_history th
            LEFT JOIN tasks t ON th.task_id = t.id
            WHERE th.is_finished = 1 AND th.finish_time IS NOT NULL
            ORDER BY th.finish_time DESC
        `).all();

        // Filter to today's downloads by comparing local date
        const downloads = allFinished.filter(row => {
            if (!row.finish_time) return false;
            try {
                // Parse finish_time
                let finishDate;
                if (row.finish_time.endsWith('Z') || row.finish_time.includes('+')) {
                    // UTC format: convert to local
                    finishDate = new Date(row.finish_time);
                } else {
                    // Assumed local time: append +08:00 to interpret as Beijing time
                    finishDate = new Date(row.finish_time + '+08:00');
                }
                // Get local date string
                const finishLocalStr = timeUtils.getLocalDateString(finishDate);
                return finishLocalStr === todayLocalStr;
            } catch (e) {
                console.error('Error parsing finish_time:', row.finish_time, e);
                return false;
            }
        });

        // Debug logging
        console.log(`[TodayDownloads] Today: ${todayLocalStr}, Found: ${downloads.length} (from ${allFinished.length} finished)`);
        if (downloads.length > 0) {
            downloads.slice(0, 3).forEach(d => console.log(`  - ${d.finish_time} | ${d.item_title?.substring(0, 40)}`));
        }

        res.json({
            success: true,
            stats: {
                ...aggregatedStats,
                totalDownloaded: memStats.todayDownloaded,
                totalUploaded: memStats.todayUploaded,
                histDownloaded: memStats.histDownloaded,
                histUploaded: memStats.histUploaded
            },
            clients: validClientStats,
            history,
            todayDownloads: downloads
        });
    } catch (err) {
        console.error('Dashboard API error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

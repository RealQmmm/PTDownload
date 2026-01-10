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
        const isAdmin = req.user.role === 'admin';
        const userId = req.user.id;

        // Query all finished and filter in JavaScript to handle mixed time formats
        let query = `
            SELECT th.*, IFNULL(t.name, '手动下载') as task_name 
            FROM task_history th
            LEFT JOIN tasks t ON th.task_id = t.id
            WHERE th.is_finished = 1 AND th.finish_time IS NOT NULL
        `;

        if (!isAdmin) {
            query += ` AND (th.user_id = ${userId} OR (th.task_id IN (SELECT id FROM tasks WHERE user_id = ${userId})))`;
        }

        query += ` ORDER BY th.finish_time DESC`;
        const allFinished = db.prepare(query).all();

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

        const isAdmin = req.user.role === 'admin';
        const userId = req.user.id;

        // 7-day history is global as requested
        let userHistory = history;

        // Aggregation logic for main stats
        let userStats = {
            todayDownloaded: memStats.todayDownloaded,
            todayUploaded: memStats.todayUploaded,
            histDownloaded: memStats.histDownloaded,
            histUploaded: memStats.histUploaded
        };

        // Get user-owned hashes for filtering active torrents
        let userHashes = [];
        if (!isAdmin) {
            const owned = db.prepare(`
                SELECT DISTINCT item_hash FROM task_history 
                WHERE user_id = ? OR task_id IN (SELECT id FROM tasks WHERE user_id = ?)
            `).all(userId, userId);
            userHashes = owned.map(h => h.item_hash).filter(h => !!h);
        }

        // Detailed Today's Downloads filtering
        const timeUtils = require('../utils/timeUtils');
        const todayLocalStr = timeUtils.getLocalDateString();

        let historyQuery = `
            SELECT th.*, IFNULL(t.name, '手动下载') as task_name 
            FROM task_history th
            LEFT JOIN tasks t ON th.task_id = t.id
            WHERE th.is_finished = 1 AND th.finish_time IS NOT NULL
        `;

        if (!isAdmin) {
            historyQuery += ` AND (th.user_id = ${userId} OR (th.task_id IN (SELECT id FROM tasks WHERE user_id = ${userId})))`;
        }

        historyQuery += ` ORDER BY th.finish_time DESC`;
        const allFinished = db.prepare(historyQuery).all();

        const downloads = allFinished.filter(row => {
            if (!row.finish_time) return false;
            try {
                let ft = row.finish_time;
                if (!ft.endsWith('Z') && !ft.includes('+')) ft += '+08:00';
                return timeUtils.getLocalDateString(new Date(ft)) === todayLocalStr;
            } catch (e) { return false; }
        });

        // For non-admins, we filter the torrent status list but KEEP stats global as requested
        let displayClientStats = validClientStats;
        let displayAggregatedStats = { ...aggregatedStats };

        if (!isAdmin) {
            // Filter the torrent list for each client
            displayClientStats = validClientStats.map(client => {
                const filteredTorrents = client.torrents.filter(t => userHashes.includes(t.hash));
                const activeCount = filteredTorrents.filter(t =>
                    ['downloading', 'uploading', 'stalledDL', 'stalledUP', 'pausedDL'].includes(t.state)
                ).length;

                return {
                    ...client,
                    torrents: filteredTorrents,
                    activeTorrents: activeCount,
                    totalTorrents: filteredTorrents.length
                };
            });

            // Update aggregated counts for UI display (Active Taks count)
            displayAggregatedStats.activeTorrents = displayClientStats.reduce((acc, c) => acc + c.activeTorrents, 0);
            displayAggregatedStats.totalTorrents = displayClientStats.reduce((acc, c) => acc + c.totalTorrents, 0);
        }

        res.json({
            success: true,
            stats: {
                ...displayAggregatedStats, // Speed is still global as it represents line capacity, or you can filter it too
                totalDownloaded: userStats.todayDownloaded,
                totalUploaded: userStats.todayUploaded,
                histDownloaded: userStats.histDownloaded,
                histUploaded: userStats.histUploaded
            },
            clients: displayClientStats,
            history: userHistory,
            todayDownloads: downloads
        });
    } catch (err) {
        console.error('Dashboard API error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

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

        // Fetch today's actual traffic delta from DB
        const db = require('../db').getDB();
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayTraffic = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(todayStr) || { downloaded_bytes: 0, uploaded_bytes: 0 };

        // Also calculate from task_history as a fallback/hybrid
        const completedToday = db.prepare(`
            SELECT SUM(item_size) as total_size 
            FROM task_history 
            WHERE is_finished = 1 AND date(finish_time, 'localtime') = date(?)
        `).get(todayStr);
        const totalCompletedSize = completedToday ? (completedToday.total_size || 0) : 0;

        // Use the maximum of delta traffic and completed items to be most accurate
        const displayedDownload = Math.max(todayTraffic.downloaded_bytes, totalCompletedSize);

        res.json({
            success: true,
            stats: {
                ...aggregatedStats,
                totalDownloaded: displayedDownload,
                totalUploaded: todayTraffic.uploaded_bytes
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
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const downloads = db.prepare(`
            SELECT th.*, IFNULL(t.name, '手动下载') as task_name 
            FROM task_history th
            LEFT JOIN tasks t ON th.task_id = t.id
            WHERE th.is_finished = 1 AND date(th.finish_time, 'localtime') = date(?)
            ORDER BY th.finish_time DESC
        `).all(today);

        res.json({ success: true, downloads });
    } catch (err) {
        console.error('Fetch today downloads error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

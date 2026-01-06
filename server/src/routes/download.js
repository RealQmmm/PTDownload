const express = require('express');
const router = express.Router();
const axios = require('axios');
const timeUtils = require('../utils/timeUtils');
const clientService = require('../services/clientService');
const siteService = require('../services/siteService');
const downloaderService = require('../services/downloaderService');
const parseTorrent = require('parse-torrent');

// Add torrent to client
router.post('/', async (req, res) => {
    try {
        let { clientId, torrentUrl, savePath, category, title } = req.body;

        // Check if series subfolder creation is enabled
        if (savePath && title) {
            try {
                const { getDB } = require('../db');
                const db = getDB();
                const setting = db.prepare("SELECT value FROM settings WHERE key = 'create_series_subfolder'").get();
                const createSeriesSubfolder = setting?.value === 'true';

                if (createSeriesSubfolder) {
                    const episodeParser = require('../utils/episodeParser');

                    // Check if title has season identifier
                    if (episodeParser.hasSeasonIdentifier(title)) {
                        const seriesName = episodeParser.extractSeriesName(title);
                        const pathUtils = require('../utils/pathUtils');
                        savePath = pathUtils.join(savePath, seriesName);
                        console.log(`[Series Subfolder] Created subfolder for: ${seriesName}`);
                    }
                }
            } catch (err) {
                console.error('[Series Subfolder] Error:', err.message);
                // Continue with original savePath if error occurs
            }
        }

        const options = { savePath, category };

        if (!torrentUrl) {
            return res.status(400).json({ success: false, message: 'Torrent URL is required' });
        }

        // Get the download client
        let client;
        if (clientId) {
            client = clientService.getClientById(clientId);
        } else {
            const clients = clientService.getAllClients();
            if (clients.length > 0) {
                client = clients[0];
            }
        }

        if (!client) {
            return res.status(404).json({ success: false, message: '未找到下载客户端' });
        }

        // Find matching site by URL to get cookies
        const sites = siteService.getAllSites();
        let siteCookies = '';
        for (const site of sites) {
            try {
                const siteHost = new URL(site.url).host;
                const torrentHost = new URL(torrentUrl).host;
                if (siteHost === torrentHost && site.cookies) {
                    siteCookies = site.cookies;
                    break;
                }
            } catch (e) {
                // Skip invalid URLs
            }
        }

        // For qBittorrent and Transmission, we need to provide the torrent URL directly
        // They will fetch it themselves, but we need to check if cookies are needed

        let result;
        let torrentHash = null;

        // If cookies are required, we need to download the torrent first and send as base64
        if (siteCookies) {
            try {
                // Download the torrent file with cookies
                const torrentResponse = await axios.get(torrentUrl, {
                    headers: {
                        'Cookie': siteCookies,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                // Convert to base64 for sending to the downloader
                const buffer = Buffer.from(torrentResponse.data);

                try {
                    const parsed = parseTorrent(buffer);
                    torrentHash = parsed.infoHash;
                } catch (e) {
                    console.warn('Failed to parse torrent hash from buffer:', e.message);
                }

                const torrentBase64 = buffer.toString('base64');
                result = await downloaderService.addTorrentFromData(client, torrentBase64, options);
            } catch (fetchErr) {
                console.error('Failed to fetch torrent:', fetchErr.message);
                // Fallback: try sending URL directly
                result = await downloaderService.addTorrent(client, torrentUrl, options);
            }
        } else {
            // Check magnet hash if applicable
            if (torrentUrl.startsWith('magnet:')) {
                try {
                    const parsed = parseTorrent(torrentUrl);
                    torrentHash = parsed.infoHash;
                } catch (e) {
                    // ignore
                }
            }
            // No cookies needed, send URL directly
            result = await downloaderService.addTorrent(client, torrentUrl, options);
        }

        if (result.success) {
            // Record manual download in task_history for statistics
            try {
                const { title, size } = req.body;
                if (title) {
                    const { getDB } = require('../db');
                    const db = getDB();

                    // Parse size string (e.g., "4.5 GB") to bytes
                    const FormatUtils = require('../utils/formatUtils');
                    const sizeBytes = FormatUtils.parseSizeToBytes(size);

                    // For manual downloads, task_id is NULL
                    db.prepare('INSERT INTO task_history (task_id, item_guid, item_title, item_size, download_time, item_hash) VALUES (?, ?, ?, ?, ?, ?)')
                        .run(null, torrentUrl, title, sizeBytes, timeUtils.getLocalISOString(), torrentHash);

                    // Send notification
                    const notificationService = require('../services/notificationService');
                    notificationService.notifyDownloadStart(title, size);
                }
            } catch (err) {
                console.error('Failed to record manual download or notify:', err.message);
                // Non-critical error, don't fail the response
            }
            res.json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

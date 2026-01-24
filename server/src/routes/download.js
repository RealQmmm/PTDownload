const express = require('express');
const router = express.Router();
const axios = require('axios');
const timeUtils = require('../utils/timeUtils');
const clientService = require('../services/clientService');
const siteService = require('../services/siteService');
const downloaderService = require('../services/downloaderService');
const parseTorrent = require('parse-torrent');
const { downloadMTeamTorrent } = require('../utils/mteamDownloader');
const torrentFetcher = require('../utils/torrentFetcher');

// Add torrent to client
router.post('/', async (req, res) => {
    try {
        let { clientId, siteId, torrentUrl, savePath, category, title, size } = req.body;

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

        // Find matching site by URL to get auth headers
        const sites = siteService.getAllSites();
        let authHeaders = null;
        let matchedSite = null;

        for (const site of sites) {
            try {
                const siteHost = new URL(site.url).host;
                const torrentHost = new URL(torrentUrl).host;
                // Special check for M-Team domains
                const isMTeam = (siteHost.includes('m-team') && torrentHost.includes('m-team'));

                if ((siteHost === torrentHost || isMTeam) && (site.cookies || site.api_key)) {
                    authHeaders = siteService.getAuthHeaders(site);
                    matchedSite = site;
                    break;
                }
            } catch (e) {
                // Skip invalid URLs
            }
        }

        // For qBittorrent and Transmission, we need to provide the torrent URL directly
        // They will fetch it themselves, but we need to check if auth is needed

        let result;
        let torrentHash = null;

        // If auth headers are available, we need to download the torrent first and send as base64
        if (authHeaders) {
            try {
                const buffer = await torrentFetcher.fetchTorrentData(matchedSite, torrentUrl);
                console.log(`[Download] Successfully fetched torrent data (${buffer.length} bytes)`);

                try {
                    const parsed = parseTorrent(buffer);
                    torrentHash = parsed.infoHash;
                } catch (e) {
                    console.warn('[Download] Failed to parse torrent hash from buffer:', e.message);
                }

                const torrentBase64 = buffer.toString('base64');
                console.log(`[Download] Sending torrent to downloader client: ${client.type} (${client.host})...`);
                result = await downloaderService.addTorrentFromData(client, torrentBase64, options);
            } catch (fetchErr) {
                console.error('[Download] Failed to process torrent with auth:', fetchErr.message);

                // Detailed error for user
                const isMTeamV2 = matchedSite && matchedSite.api_key &&
                    (matchedSite.url.includes('m-team.cc') || matchedSite.url.includes('m-team.io'));

                if (isMTeamV2) {
                    let friendlyMsg = fetchErr.message;
                    if (friendlyMsg.includes('timeout')) friendlyMsg = 'M-Team 下载超时，请检查 API 连通性';
                    return res.status(500).json({ success: false, message: `获取失败: ${friendlyMsg}` });
                }

                // Fallback: try sending URL directly (only for non-M-Team sites)
                console.log('[Download] Attempting fallback to direct URL download...');
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
            // No auth needed, send URL directly
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
                    // site_id helps dashboard match the site for manual downloads
                    const finalSiteId = siteId || matchedSite?.id || null;
                    db.prepare('INSERT INTO task_history (task_id, site_id, item_guid, item_title, item_size, item_link, download_time, item_hash, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                        .run(null, finalSiteId, torrentUrl, title, sizeBytes, torrentUrl, timeUtils.getLocalISOString(), torrentHash, req.user.id);

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

// Download torrent file only (returns .torrent file to browser)
router.post('/torrent-file', async (req, res) => {
    try {
        const { torrentUrl, title } = req.body;

        if (!torrentUrl) {
            return res.status(400).json({ success: false, message: 'Torrent URL is required' });
        }

        // Find matching site by URL to get auth headers
        const sites = siteService.getAllSites();
        let authHeaders = null;
        let matchedSite = null;

        for (const site of sites) {
            try {
                const siteHost = new URL(site.url).host;
                const torrentHost = new URL(torrentUrl).host;
                const isMTeam = (siteHost.includes('m-team') && torrentHost.includes('m-team'));

                if ((siteHost === torrentHost || isMTeam) && (site.cookies || site.api_key)) {
                    authHeaders = siteService.getAuthHeaders(site);
                    matchedSite = site;
                    break;
                }
            } catch (e) {
                // Skip invalid URLs
            }
        }

        let buffer;
        try {
            buffer = await torrentFetcher.fetchTorrentData(matchedSite, torrentUrl);
        } catch (fetchErr) {
            console.error('Failed to fetch torrent file:', fetchErr.message);
            return res.status(500).json({ success: false, message: fetchErr.message });
        }

        // Generate filename
        const safeTitle = (title || 'torrent').replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
        const filename = `${safeTitle}.torrent`;

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/x-bittorrent');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);

    } catch (err) {
        console.error('Torrent file download error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

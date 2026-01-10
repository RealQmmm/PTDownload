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
                let torrentData;

                // Special handling for M-Team V2 API
                const isMTeamV2 = matchedSite && matchedSite.api_key &&
                    (matchedSite.url.includes('m-team.cc') || matchedSite.url.includes('m-team.io'));

                if (isMTeamV2) {
                    // M-Team V2: Use API to generate download token
                    // torrentUrl format: https://xxx.m-team.cc/download.php?id=123456
                    const urlObj = new URL(torrentUrl);
                    const torrentId = urlObj.searchParams.get('id');

                    if (!torrentId) {
                        throw new Error('无法从 M-Team URL 提取种子 ID');
                    }

                    console.log(`[M-Team V2] Starting download for torrent ID: ${torrentId}`);

                    const https = require('https');

                    // Step 1: Generate download token
                    // Try form-urlencoded format (some implementations use this)
                    console.log(`[M-Team V2] Calling genDlToken API with id: ${torrentId}`);
                    const tokenResponse = await axios.post(
                        'https://api.m-team.cc/api/torrent/genDlToken',
                        `id=${torrentId}`,  // Form-urlencoded format
                        {
                            headers: {
                                ...authHeaders,
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Accept': 'application/json'
                            },
                            timeout: 15000,
                            httpsAgent: new https.Agent({
                                rejectUnauthorized: false,
                                servername: 'api.m-team.cc'
                            })
                        }
                    );

                    console.log(`[M-Team V2] genDlToken full response:`, JSON.stringify(tokenResponse.data));

                    const code = tokenResponse.data?.code;
                    if (code !== 0 && code !== '0') {
                        const errMsg = tokenResponse.data?.message || 'M-Team API 获取下载令牌失败';
                        console.error(`[M-Team V2] API Error: code=${code}, message=${errMsg}`);
                        // Throw a special error to prevent fallback (which won't work for M-Team)
                        const mteamError = new Error(`M-Team API 错误: ${errMsg} (code: ${code})`);
                        mteamError.isMTeamError = true;
                        throw mteamError;
                    }

                    const downloadUrl = tokenResponse.data?.data;
                    if (!downloadUrl) {
                        const mteamError = new Error('M-Team API 未返回下载链接');
                        mteamError.isMTeamError = true;
                        throw mteamError;
                    }

                    console.log(`[M-Team V2] Got download URL for torrent ${torrentId}: ${downloadUrl.substring(0, 80)}...`);

                    // Step 2: Download the actual torrent file from the token URL
                    console.log(`[M-Team V2] Downloading torrent file...`);
                    const torrentResponse = await axios.get(downloadUrl, {
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: false
                        })
                    });

                    torrentData = Buffer.from(torrentResponse.data);
                    console.log(`[M-Team V2] Downloaded torrent file, size: ${torrentData.length} bytes`);

                    // Validate torrent data - check if it starts with valid bencoded dict
                    if (torrentData.length < 10) {
                        const mteamError = new Error(`M-Team 返回的种子文件太小: ${torrentData.length} 字节`);
                        mteamError.isMTeamError = true;
                        throw mteamError;
                    }
                    // Bencoded torrent files start with 'd' (0x64)
                    if (torrentData[0] !== 0x64) {
                        // If it's not a torrent file, try to decode as text to see error
                        const textContent = torrentData.toString('utf-8').substring(0, 200);
                        console.error(`[M-Team V2] Invalid torrent data received: ${textContent}`);
                        const mteamError = new Error('M-Team 返回的文件不是有效的种子文件');
                        mteamError.isMTeamError = true;
                        throw mteamError;
                    }
                } else {
                    // Standard sites: Download torrent file with auth headers
                    console.log(`[Download] Fetching torrent from: ${torrentUrl.substring(0, 60)}...`);

                    const https = require('https');
                    const torrentResponse = await axios.get(torrentUrl, {
                        headers: authHeaders,
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: false
                        })
                    });
                    torrentData = Buffer.from(torrentResponse.data);

                    console.log(`[Download] Received ${torrentData.length} bytes`);

                    // Validate that we received a torrent file, not an HTML page
                    if (torrentData.length < 10) {
                        throw new Error(`站点返回的数据太小 (${torrentData.length} 字节)，可能是认证问题`);
                    }

                    // Bencoded torrent files start with 'd' (0x64)
                    if (torrentData[0] !== 0x64) {
                        const textContent = torrentData.toString('utf-8').substring(0, 300);
                        console.error(`[Download] Invalid torrent data received (first 300 chars): ${textContent}`);

                        // Check if it's an HTML page (login redirect)
                        if (textContent.toLowerCase().includes('<!doctype') ||
                            textContent.toLowerCase().includes('<html') ||
                            textContent.toLowerCase().includes('login') ||
                            textContent.toLowerCase().includes('登录') ||
                            textContent.toLowerCase().includes('passkey')) {
                            throw new Error('站点返回了登录页面，请检查 Cookie 是否有效或已过期');
                        }
                        throw new Error('站点返回的文件不是有效的种子文件');
                    }
                }

                // torrentData is already a Buffer, use it directly
                try {
                    const parsed = parseTorrent(torrentData);
                    torrentHash = parsed.infoHash;
                } catch (e) {
                    console.warn('Failed to parse torrent hash from buffer:', e.message);
                }

                const torrentBase64 = torrentData.toString('base64');
                result = await downloaderService.addTorrentFromData(client, torrentBase64, options);
            } catch (fetchErr) {
                console.error('Failed to fetch torrent with auth:', fetchErr.message);
                // For M-Team errors, don't try fallback (it won't work)
                if (fetchErr.isMTeamError) {
                    return res.status(500).json({ success: false, message: fetchErr.message });
                }
                // Fallback: try sending URL directly (only for non-M-Team sites)
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
                    db.prepare('INSERT INTO task_history (task_id, item_guid, item_title, item_size, download_time, item_hash, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
                        .run(null, torrentUrl, title, sizeBytes, timeUtils.getLocalISOString(), torrentHash, req.user.id);

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

        let torrentData;

        // Check if M-Team V2
        const isMTeamV2 = matchedSite && matchedSite.api_key &&
            (matchedSite.url.includes('m-team.cc') || matchedSite.url.includes('m-team.io'));

        if (isMTeamV2) {
            // M-Team V2: Use API to generate download token
            const urlObj = new URL(torrentUrl);
            const torrentId = urlObj.searchParams.get('id');

            if (!torrentId) {
                return res.status(400).json({ success: false, message: '无法从 M-Team URL 提取种子 ID' });
            }

            const https = require('https');

            // Step 1: Generate download token
            console.log(`[M-Team V2 Torrent File] Calling genDlToken API for torrent ${torrentId}...`);
            const tokenResponse = await axios.post(
                'https://api.m-team.cc/api/torrent/genDlToken',
                `id=${torrentId}`,  // Form-urlencoded format
                {
                    headers: {
                        ...authHeaders,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    timeout: 15000,
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: false,
                        servername: 'api.m-team.cc'
                    })
                }
            );

            const code = tokenResponse.data?.code;
            if (code !== 0 && code !== '0') {
                return res.status(500).json({ success: false, message: tokenResponse.data?.message || 'M-Team API 获取下载令牌失败' });
            }

            const downloadUrl = tokenResponse.data?.data;
            if (!downloadUrl) {
                return res.status(500).json({ success: false, message: 'M-Team API 未返回下载链接' });
            }

            console.log(`[M-Team V2 Torrent File] Got download URL, fetching torrent file...`);

            // Step 2: Download the actual torrent file
            const torrentResponse = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            });

            torrentData = Buffer.from(torrentResponse.data);
        } else if (authHeaders) {
            // Standard sites with auth
            const https = require('https');
            const torrentResponse = await axios.get(torrentUrl, {
                headers: authHeaders,
                responseType: 'arraybuffer',
                timeout: 30000,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            });
            torrentData = Buffer.from(torrentResponse.data);
        } else {
            // No auth required
            const https = require('https');
            const torrentResponse = await axios.get(torrentUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            });
            torrentData = Buffer.from(torrentResponse.data);
        }

        // Validate torrent data
        if (torrentData.length < 10) {
            return res.status(500).json({ success: false, message: `站点返回的数据太小 (${torrentData.length} 字节)，可能是认证问题` });
        }

        if (torrentData[0] !== 0x64) {
            const textContent = torrentData.toString('utf-8').substring(0, 300);
            console.error(`[Torrent File] Invalid torrent data: ${textContent}`);

            // Check if it's an HTML page (login redirect)
            if (textContent.toLowerCase().includes('<!doctype') ||
                textContent.toLowerCase().includes('<html') ||
                textContent.toLowerCase().includes('login') ||
                textContent.toLowerCase().includes('登录') ||
                textContent.toLowerCase().includes('passkey')) {
                return res.status(500).json({ success: false, message: '站点返回了登录页面，请检查 Cookie 是否有效或已过期' });
            }
            return res.status(500).json({ success: false, message: '返回的文件不是有效的种子文件' });
        }

        // Generate filename
        const safeTitle = (title || 'torrent').replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
        const filename = `${safeTitle}.torrent`;

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/x-bittorrent');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-Length', torrentData.length);
        res.send(torrentData);

    } catch (err) {
        console.error('Torrent file download error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

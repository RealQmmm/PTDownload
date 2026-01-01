const axios = require('axios');
const cheerio = require('cheerio');
const parseTorrent = require('parse-torrent');
const { getDB } = require('../db');
const downloaderService = require('./downloaderService');
const siteService = require('./siteService');
const clientService = require('./clientService');
const notificationService = require('./notificationService');
const loggerService = require('./loggerService');

class RSSService {
    async executeTask(task) {
        const db = getDB();
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        if (enableLogs) console.log(`[RSS] Executing task: ${task.name}`);

        try {
            // 1. Get site info for cookies
            const site = siteService.getSiteById(task.site_id);
            if (!site) throw new Error('Associated site not found');

            // 2. Fetch RSS feed with site cookies
            const response = await axios.get(task.rss_url, {
                headers: {
                    'Cookie': site.cookies || '',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 30000
            });

            // 3. Parse XML
            const $ = cheerio.load(response.data, { xmlMode: true });
            const items = [];

            $('item').each((i, el) => {
                const title = $(el).find('title').text();
                const link = $(el).find('enclosure').attr('url') || $(el).find('link').text();
                const guid = $(el).find('guid').text() || link;
                const sizeStr = $(el).find('size').text(); // Some PT sites have size in a custom tag

                // Try to extract size from description if not in custom tag
                let size = parseInt(sizeStr) || 0;
                if (!size) {
                    const desc = $(el).find('description').text();
                    const sizeMatch = desc.match(/Size:\s*([\d\.]+)\s*([KMGT]B?)/i);
                    if (sizeMatch) {
                        // Use unified util to parse "1.5 GB" etc
                        const FormatUtils = require('../utils/formatUtils');
                        size = FormatUtils.parseSizeToBytes(`${sizeMatch[1]} ${sizeMatch[2]}`);
                    }
                }

                items.push({ title, link, guid, size });
            });

            if (enableLogs) console.log(`[RSS] Found ${items.length} items in feed`);

            // 4. Filter and Process
            const filterConfig = JSON.parse(task.filter_config || '{}');
            let targetClient = null;

            if (task.client_id) {
                targetClient = clientService.getClientById(task.client_id);
            }

            // Fallback to default client if no specific client or specific client not found
            if (!targetClient) {
                if (enableLogs) console.log(`[RSS] No specific client found (ID: ${task.client_id}), trying default client...`);
                targetClient = clientService.getDefaultClient();
            }

            if (!targetClient) throw new Error('No available download client (neither specific nor default)');

            let matchCount = 0;
            for (const item of items) {
                if (this._itemMatches(item, filterConfig)) {
                    matchCount++;
                    // Check if already downloaded by GUID first (fast check)
                    let exists = db.prepare('SELECT id FROM task_history WHERE task_id = ? AND item_guid = ?').get(task.id, item.guid);

                    if (!exists) {
                        try {
                            // Check by Hash (slower, requires parsing)
                            let torrentHash = null;
                            let torrentData = null; // Buffer or magnet link

                            if (item.link.startsWith('magnet:')) {
                                try {
                                    const parsed = parseTorrent(item.link);
                                    torrentHash = parsed.infoHash;
                                    torrentData = item.link;
                                } catch (e) {
                                    if (enableLogs) console.warn(`[RSS] Failed to parse magnet link: ${e.message}`);
                                }
                            } else {
                                // Download torrent file to memory to extract hash
                                try {
                                    const torrentRes = await axios.get(item.link, {
                                        headers: {
                                            'Cookie': site.cookies || '',
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                        },
                                        responseType: 'arraybuffer',
                                        timeout: 15000
                                    });
                                    const buffer = Buffer.from(torrentRes.data);
                                    const parsed = parseTorrent(buffer);
                                    torrentHash = parsed.infoHash;
                                    torrentData = buffer.toString('base64'); // Store as base64 for passing to downloader
                                } catch (e) {
                                    if (enableLogs) console.warn(`[RSS] Failed to download/parse torrent for hash check: ${e.message}`);
                                    torrentData = item.link; // Fallback to URL if parsing fails (will skip hash check)
                                }
                            }

                            if (torrentHash) {
                                // Check if this hash has already been processed for this task
                                const hashExists = db.prepare('SELECT id FROM task_history WHERE task_id = ? AND item_hash = ?').get(task.id, torrentHash);
                                if (hashExists) {
                                    if (enableLogs) console.log(`[RSS] Duplicate hash detected for ${item.title} (${torrentHash}). Skipping.`);
                                    continue;
                                }
                            }

                            if (enableLogs) console.log(`[RSS] Match found: ${item.title}. Adding to downloader...`);

                            let result;
                            if (torrentData && !item.link.startsWith('magnet:')) {
                                // If we have the file data, verify cookies/auth might be tricky for the client to re-download, 
                                // so better to pass the data if the client service supports it.
                                // Our downloaderService.addTorrent usually takes a URL. 
                                // But download.js handles base64. Let's reuse that or use addTorrentFromData if available.
                                // Actually, downloaderService has addTorrentFromData.
                                result = await downloaderService.addTorrentFromData(targetClient, torrentData);
                            } else {
                                // Magnet or fallback
                                result = await downloaderService.addTorrent(targetClient, item.link, {
                                    savePath: task.save_path,
                                    category: task.category
                                });
                            }

                            if (result.success) {
                                db.prepare('INSERT INTO task_history (task_id, item_guid, item_title, item_size, item_hash) VALUES (?, ?, ?, ?, ?)')
                                    .run(task.id, item.guid, item.title, item.size, torrentHash);
                                if (enableLogs) console.log(`[RSS] Successfully added: ${item.title}`);

                                // Send notification
                                try {
                                    const FormatUtils = require('../utils/formatUtils');
                                    await notificationService.notifyNewTorrent(task.name, item.title, FormatUtils.formatBytes(item.size));
                                } catch (notifyErr) {
                                    console.error('[RSS] Notification failed:', notifyErr.message);
                                }
                            } else {
                                if (enableLogs) console.error(`[RSS] Failed to add ${item.title}: ${result.message}`);
                            }
                        } catch (err) {
                            if (enableLogs) console.error(`[RSS] Error processing item ${item.title}: ${err.message}`);
                        }
                    }
                }
            }

            loggerService.log(`成功发现 ${items.length} 个资源，匹配 ${matchCount} 个`, 'success', task.id, items.length, matchCount);

        } catch (err) {
            if (enableLogs) console.error(`[RSS] Task ${task.name} failed:`, err.message);
            loggerService.log(err.message, 'error', task.id);
        }
    }

    // _logTask is now handled by loggerService.log
    _logTask(taskId, status, message, found = 0, matched = 0) {
        loggerService.log(message, status, taskId, found, matched);
    }

    _itemMatches(item, config) {
        const { keywords, exclude, size_min, size_max } = config;
        const title = item.title.toLowerCase();

        // Check include keywords (AND logic for all keywords if provided)
        if (keywords && keywords.trim()) {
            const includeList = keywords.toLowerCase().split(',').map(k => k.trim());
            const matches = includeList.every(k => title.includes(k));
            if (!matches) return false;
        }

        // Check exclude keywords (OR logic)
        if (exclude && exclude.trim()) {
            const excludeList = exclude.toLowerCase().split(',').map(k => k.trim());
            const isExcluded = excludeList.some(k => title.includes(k));
            if (isExcluded) return false;
        }

        // Check size (size_min/max in MB)
        if (item.size > 0) {
            const sizeMB = item.size / (1024 * 1024);
            if (size_min && sizeMB < parseFloat(size_min)) return false;
            if (size_max && sizeMB > parseFloat(size_max)) return false;
        }

        return true;
    }
}

module.exports = new RSSService();

const axios = require('axios');
const cheerio = require('cheerio');
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
                    const sizeMatch = desc.match(/Size:\s*([\d\.]+)\s*(GB|MB|KB|TB)/i);
                    if (sizeMatch) {
                        const val = parseFloat(sizeMatch[1]);
                        const unit = sizeMatch[2].toUpperCase();
                        const multiplier = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
                        size = val * (multiplier[unit] || 1);
                    }
                }

                items.push({ title, link, guid, size });
            });

            if (enableLogs) console.log(`[RSS] Found ${items.length} items in feed`);

            // 4. Filter and Process
            const filterConfig = JSON.parse(task.filter_config || '{}');
            const targetClient = clientService.getClientById(task.client_id);
            if (!targetClient) throw new Error('Target client not found');

            let matchCount = 0;
            for (const item of items) {
                if (this._itemMatches(item, filterConfig)) {
                    matchCount++;
                    // Check if already downloaded
                    const exists = db.prepare('SELECT id FROM task_history WHERE task_id = ? AND item_guid = ?').get(task.id, item.guid);

                    if (!exists) {
                        if (enableLogs) console.log(`[RSS] Match found: ${item.title}. Adding to downloader...`);

                        const result = await downloaderService.addTorrent(targetClient, item.link, {
                            savePath: task.save_path,
                            category: task.category
                        });

                        if (result.success) {
                            db.prepare('INSERT INTO task_history (task_id, item_guid, item_title, item_size) VALUES (?, ?, ?, ?)')
                                .run(task.id, item.guid, item.title, item.size);
                            if (enableLogs) console.log(`[RSS] Successfully added: ${item.title}`);

                            // Send notification
                            try {
                                const formatBytes = (bytes) => {
                                    if (!bytes) return '0 B';
                                    const k = 1024;
                                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                };
                                await notificationService.notifyNewTorrent(task.name, item.title, formatBytes(item.size));
                            } catch (notifyErr) {
                                console.error('[RSS] Notification failed:', notifyErr.message);
                            }
                        } else {
                            if (enableLogs) console.error(`[RSS] Failed to add ${item.title}: ${result.message}`);
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

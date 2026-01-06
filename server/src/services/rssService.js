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
    constructor() {
        // RSS feed cache: { url: { data: responseData, timestamp: Date.now() } }
        this.rssCache = new Map();

        // Load cache TTL from settings (default: 5 minutes)
        this.loadCacheTTL();
    }

    /**
     * Load cache TTL from database settings
     */
    loadCacheTTL() {
        try {
            const { getDB } = require('../db');
            const db = getDB();
            const setting = db.prepare("SELECT value FROM settings WHERE key = 'rss_cache_ttl'").get();
            const ttlSeconds = parseInt(setting?.value || '300'); // Default: 300 seconds (5 minutes)
            this.cacheTTL = ttlSeconds * 1000; // Convert to milliseconds
            console.log(`[RSS Cache] TTL set to ${ttlSeconds} seconds (${ttlSeconds / 60} minutes)`);
        } catch (err) {
            console.error('[RSS Cache] Failed to load TTL from settings, using default 5 minutes:', err.message);
            this.cacheTTL = 5 * 60 * 1000; // Fallback: 5 minutes
        }
    }

    /**
     * Get RSS feed data with caching
     * @param {string} rssUrl - The RSS feed URL
     * @param {object} headers - Request headers (including cookies)
     * @returns {Promise<string>} - RSS XML data
     */
    async getRSSFeed(rssUrl, headers) {
        const now = Date.now();
        const cached = this.rssCache.get(rssUrl);

        // Check if cache is valid
        if (cached && (now - cached.timestamp) < this.cacheTTL) {
            const age = Math.round((now - cached.timestamp) / 1000);
            console.log(`[RSS Cache] Using cached data for ${rssUrl} (age: ${age}s)`);
            return cached.data;
        }

        // Fetch fresh data
        console.log(`[RSS Cache] Fetching fresh data for ${rssUrl}`);
        const response = await axios.get(rssUrl, {
            headers: {
                ...headers,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000
        });

        // Update cache
        this.rssCache.set(rssUrl, {
            data: response.data,
            timestamp: now
        });

        // Clean old cache entries (optional, prevents memory leak)
        this.cleanCache();

        return response.data;
    }

    /**
     * Clean expired cache entries
     */
    cleanCache() {
        const now = Date.now();
        for (const [url, entry] of this.rssCache.entries()) {
            if ((now - entry.timestamp) > this.cacheTTL) {
                this.rssCache.delete(url);
                console.log(`[RSS Cache] Cleaned expired cache for ${url}`);
            }
        }
    }

    /**
     * Clear all cache (useful for manual refresh)
     */
    clearCache() {
        const size = this.rssCache.size;
        this.rssCache.clear();
        console.log(`[RSS Cache] Cleared ${size} cache entries`);
    }
    async executeTask(task) {
        const db = getDB();
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        if (enableLogs) console.log(`[RSS] Executing task: ${task.name}`);

        try {
            // 1. Get site info for cookies
            const site = siteService.getSiteById(task.site_id);
            if (!site) throw new Error('Associated site not found');

            // 2. Fetch RSS feed with caching
            const rssData = await this.getRSSFeed(task.rss_url, {
                'Cookie': site.cookies || ''
            });

            // 3. Parse XML
            const $ = cheerio.load(rssData, { xmlMode: true });
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
                        // Smart Series Filter: Check if episodes are already downloaded
                        try {
                            const episodeParser = require('../utils/episodeParser');
                            const candidateInfo = episodeParser.parse(item.title);

                            // Only apply if we detected valid episode info
                            if (candidateInfo && candidateInfo.episodes.length > 0) {
                                const downloadedEpisodes = new Set();
                                const targetSeason = candidateInfo.season !== null ? candidateInfo.season : 1;

                                // === Source 1: Query series_episodes table (most reliable) ===
                                // Find the series subscription linked to this task (if any)
                                const subscription = db.prepare('SELECT id, season, name, alias FROM series_subscriptions WHERE task_id = ?').get(task.id);
                                if (subscription) {
                                    const seriesEpisodes = db.prepare(
                                        'SELECT episode FROM series_episodes WHERE subscription_id = ? AND season = ?'
                                    ).all(subscription.id, targetSeason);

                                    seriesEpisodes.forEach(ep => downloadedEpisodes.add(ep.episode));

                                    if (enableLogs && seriesEpisodes.length > 0) {
                                        console.log(`[RSS] Found ${seriesEpisodes.length} episodes in series_episodes table for season ${targetSeason}`);
                                    }
                                }

                                // === Source 2: Parse from this task's history ===
                                const historyItems = db.prepare('SELECT item_title FROM task_history WHERE task_id = ?').all(task.id);

                                historyItems.forEach(hItem => {
                                    const hInfo = episodeParser.parse(hItem.item_title);
                                    if (hInfo) {
                                        if (targetSeason !== null) {
                                            if (hInfo.season === targetSeason) {
                                                hInfo.episodes.forEach(ep => downloadedEpisodes.add(ep));
                                            }
                                        } else {
                                            hInfo.episodes.forEach(ep => downloadedEpisodes.add(ep));
                                        }
                                    }
                                });

                                // === Source 3: Scan ALL history for matching series name (catches manual/external downloads) ===
                                // This is important for detecting downloads added directly to the client
                                if (subscription) {
                                    const seriesName = (subscription.name || '').toLowerCase().trim();
                                    const seriesAlias = (subscription.alias || '').toLowerCase().trim();

                                    // Get all history records (including task_id = NULL)
                                    const allHistory = db.prepare('SELECT item_title FROM task_history WHERE task_id IS NULL OR task_id != ?').all(task.id);

                                    allHistory.forEach(hItem => {
                                        const titleLower = (hItem.item_title || '').toLowerCase();

                                        // Check if title matches series name or alias
                                        let isMatch = seriesName && titleLower.includes(seriesName);
                                        if (!isMatch && seriesAlias) {
                                            isMatch = titleLower.includes(seriesAlias);
                                        }

                                        // Normalize and try again
                                        if (!isMatch) {
                                            const normalizedTitle = titleLower.replace(/[\s._\-\[\](){}+]/g, '');
                                            const normalizedName = seriesName.replace(/[\s._\-\[\](){}+]/g, '');
                                            isMatch = normalizedName && normalizedTitle.includes(normalizedName);

                                            if (!isMatch && seriesAlias) {
                                                const normalizedAlias = seriesAlias.replace(/[\s._\-\[\](){}+]/g, '');
                                                isMatch = normalizedAlias && normalizedTitle.includes(normalizedAlias);
                                            }
                                        }

                                        if (isMatch) {
                                            const hInfo = episodeParser.parse(hItem.item_title);
                                            if (hInfo && hInfo.season === targetSeason) {
                                                hInfo.episodes.forEach(ep => downloadedEpisodes.add(ep));
                                            }
                                        }
                                    });

                                    if (enableLogs && downloadedEpisodes.size > 0) {
                                        console.log(`[RSS] Total tracked episodes for S${targetSeason}: ${Array.from(downloadedEpisodes).sort((a, b) => a - b).join(', ')}`);
                                    }
                                }

                                // Check if ALL candidate episodes exist in any source
                                const isRedundant = candidateInfo.episodes.every(ep => downloadedEpisodes.has(ep));

                                if (isRedundant) {
                                    if (enableLogs) console.log(`[RSS] Smart Skip: ${item.title} (Episodes ${candidateInfo.episodes.join(', ')} already downloaded, total tracked: ${downloadedEpisodes.size})`);
                                    loggerService.log(`匹配到资源但已存在: ${item.title} (原因: 剧集 ${candidateInfo.episodes.join(', ')} 已下载)`, 'success', task.id, items.length, matchCount);
                                    continue; // Skip processing this item
                                }
                            }
                        } catch (err) {
                            if (enableLogs) console.warn(`[RSS] Smart check error: ${err.message}`);
                        }

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
                                // 1. Check if this hash has already been processed for ANY task (not just this task)
                                const hashExistsInHistory = db.prepare('SELECT id, task_id FROM task_history WHERE item_hash = ?').get(torrentHash);
                                if (hashExistsInHistory) {
                                    if (enableLogs) console.log(`[RSS] Hash already in task_history for ${item.title} (${torrentHash}). Skipping.`);
                                    loggerService.log(`匹配到资源但已存在: ${item.title} (原因: Hash ${torrentHash} 已在历史记录)`, 'success', task.id, items.length, matchCount);
                                    continue;
                                }

                                // 2. Check if this hash exists in any downloader client
                                try {
                                    const allClients = clientService.getAllClients();
                                    let hashExistsInDownloader = false;

                                    for (const client of allClients) {
                                        try {
                                            const result = await downloaderService.getTorrents(client);
                                            if (result.success && result.torrents) {
                                                const existingTorrent = result.torrents.find(t =>
                                                    t.hash && t.hash.toLowerCase() === torrentHash.toLowerCase()
                                                );
                                                if (existingTorrent) {
                                                    hashExistsInDownloader = true;
                                                    if (enableLogs) console.log(`[RSS] Hash already exists in downloader (${client.name || client.type}) for ${item.title} (${torrentHash}). Skipping.`);
                                                    loggerService.log(`匹配到资源但已存在: ${item.title} (原因: Hash ${torrentHash.substring(0, 8)}... 已在下载器)`, 'success', task.id, items.length, matchCount);
                                                    break;
                                                }
                                            }
                                        } catch (clientErr) {
                                            // Skip this client if error, continue checking others
                                            if (enableLogs) console.warn(`[RSS] Failed to check client ${client.id}: ${clientErr.message}`);
                                        }
                                    }

                                    if (hashExistsInDownloader) {
                                        continue;
                                    }
                                } catch (downloaderCheckErr) {
                                    if (enableLogs) console.warn(`[RSS] Failed to check downloaders: ${downloaderCheckErr.message}`);
                                    // Continue anyway - better to potentially duplicate than miss a download
                                }
                            }

                            if (enableLogs) console.log(`[RSS] Match found: ${item.title}. Adding to downloader...`);

                            // Determine which files to download (for smart episode filtering)
                            let fileIndices = null;
                            if (torrentData && !item.link.startsWith('magnet:')) {
                                try {
                                    const parseTorrent = require('parse-torrent');
                                    const torrentBuffer = Buffer.from(torrentData, 'base64');
                                    const parsed = parseTorrent(torrentBuffer);

                                    if (parsed.files && parsed.files.length > 1) {
                                        // Multi-file torrent, apply smart file selection
                                        const episodeParser = require('../utils/episodeParser');
                                        const fileSelector = require('../utils/fileSelector');
                                        const candidateInfo = episodeParser.parse(item.title);

                                        if (candidateInfo && candidateInfo.season !== null) {
                                            // Get downloaded episodes for this season
                                            const historyItems = db.prepare('SELECT item_title FROM task_history WHERE task_id = ?').all(task.id);
                                            const downloadedEpisodes = new Set();

                                            historyItems.forEach(hItem => {
                                                const hInfo = episodeParser.parse(hItem.item_title);
                                                if (hInfo && hInfo.season === candidateInfo.season) {
                                                    hInfo.episodes.forEach(ep => downloadedEpisodes.add(ep));
                                                }
                                            });

                                            if (downloadedEpisodes.size > 0) {
                                                // Select files based on episode history
                                                fileIndices = fileSelector.selectFiles(
                                                    parsed.files,
                                                    Array.from(downloadedEpisodes),
                                                    candidateInfo.season
                                                );

                                                if (fileIndices.length === 0) {
                                                    if (enableLogs) console.log(`[RSS] All files in ${item.title} already downloaded. Skipping.`);
                                                    loggerService.log(`匹配到资源但已存在: ${item.title} (原因: 所有文件已下载)`, 'success', task.id, items.length, matchCount);
                                                    continue;
                                                }

                                                if (enableLogs) console.log(`[RSS] Smart file selection: ${fileIndices.length}/${parsed.files.length} files selected for ${item.title}`);
                                            }
                                        }
                                    }
                                } catch (parseErr) {
                                    if (enableLogs) console.warn(`[RSS] Failed to parse torrent for file selection: ${parseErr.message}`);
                                    // Continue with full download if parsing fails
                                }
                            }

                            // Determine final save path (with series subfolder if enabled)
                            let finalSavePath = task.save_path;
                            try {
                                const setting = db.prepare("SELECT value FROM settings WHERE key = 'create_series_subfolder'").get();
                                const createSeriesSubfolder = setting?.value === 'true';

                                if (createSeriesSubfolder && finalSavePath && item.title) {
                                    const episodeParser = require('../utils/episodeParser');

                                    // Check if title has season identifier
                                    if (episodeParser.hasSeasonIdentifier(item.title)) {
                                        const seriesName = episodeParser.extractSeriesName(item.title);
                                        const pathUtils = require('../utils/pathUtils');
                                        finalSavePath = pathUtils.join(finalSavePath, seriesName);
                                        if (enableLogs) console.log(`[RSS][Series Subfolder] Using subfolder: ${seriesName}`);
                                    }
                                }
                            } catch (err) {
                                if (enableLogs) console.warn(`[RSS][Series Subfolder] Error: ${err.message}`);
                                // Continue with original savePath if error occurs
                            }

                            // === FINAL CHECK: Verify episode doesn't exist before pre-recording ===
                            // This catches cases where same episode exists with different hash
                            // (e.g., different release groups for same episode)
                            try {
                                const subscription = db.prepare('SELECT id, season FROM series_subscriptions WHERE task_id = ?').get(task.id);
                                if (subscription) {
                                    const candidateInfo = episodeParser.parse(item.title);
                                    if (candidateInfo && candidateInfo.episodes.length > 0) {
                                        const targetSeason = candidateInfo.season !== null ? candidateInfo.season : (subscription.season || 1);

                                        // Check if ANY of the candidate episodes already exist in series_episodes
                                        const existingEpisodes = db.prepare(`
                                            SELECT episode FROM series_episodes 
                                            WHERE subscription_id = ? AND season = ? AND episode IN (${candidateInfo.episodes.join(',')})
                                        `).all(subscription.id, targetSeason);

                                        if (existingEpisodes.length > 0) {
                                            const existingEpNumbers = existingEpisodes.map(e => e.episode);
                                            const allExist = candidateInfo.episodes.every(ep => existingEpNumbers.includes(ep));

                                            if (allExist) {
                                                if (enableLogs) console.log(`[RSS] Final Skip: ${item.title} - All episodes already in series_episodes table`);
                                                loggerService.log(`匹配到资源但已存在: ${item.title} (原因: 剧集 S${targetSeason}E${candidateInfo.episodes.join(',E')} 已在剧集表中)`, 'success', task.id, items.length, matchCount);
                                                continue; // Skip - episodes already downloaded with different hash
                                            }
                                        }
                                    }
                                }
                            } catch (finalCheckErr) {
                                if (enableLogs) console.warn(`[RSS] Final episode check error: ${finalCheckErr.message}`);
                                // Continue anyway - better to potentially duplicate than miss a download
                            }

                            // === STEP 1: PRE-RECORD to task_history BEFORE submitting to downloader ===
                            // This prevents race condition with statsService scanning and marking as "manual download"
                            const timeUtils = require('../utils/timeUtils');
                            const preRecordResult = db.prepare('INSERT INTO task_history (task_id, item_guid, item_title, item_size, item_hash, download_time) VALUES (?, ?, ?, ?, ?, ?)')
                                .run(task.id, item.guid, item.title, item.size, torrentHash, timeUtils.getLocalISOString());
                            const preRecordId = preRecordResult.lastInsertRowid;

                            if (enableLogs) console.log(`[RSS] Pre-recorded to task_history (ID: ${preRecordId}): ${item.title}`);

                            // === STEP 2: SEND NOTIFICATION immediately after matching ===
                            // Notify user as soon as we know we're going to download
                            try {
                                const FormatUtils = require('../utils/formatUtils');
                                await notificationService.notifyNewTorrent(task.name, item.title, FormatUtils.formatBytes(item.size));
                            } catch (notifyErr) {
                                console.error('[RSS] Notification failed:', notifyErr.message);
                            }

                            // === STEP 3: Pre-record episodes to series_episodes table ===
                            try {
                                const subscription = db.prepare('SELECT id, season FROM series_subscriptions WHERE task_id = ?').get(task.id);
                                if (subscription) {
                                    const candidateInfo = episodeParser.parse(item.title);
                                    if (candidateInfo && candidateInfo.episodes.length > 0) {
                                        const season = candidateInfo.season !== null ? candidateInfo.season : (subscription.season || 1);
                                        const insertEpStmt = db.prepare(`
                                            INSERT OR IGNORE INTO series_episodes 
                                            (subscription_id, season, episode, torrent_hash, torrent_title, download_time)
                                            VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
                                        `);

                                        let insertedCount = 0;
                                        candidateInfo.episodes.forEach(ep => {
                                            const epResult = insertEpStmt.run(subscription.id, season, ep, torrentHash, item.title);
                                            if (epResult.changes > 0) insertedCount++;
                                        });

                                        if (enableLogs && insertedCount > 0) {
                                            console.log(`[RSS] Pre-recorded ${insertedCount} episodes to series_episodes: S${season}E${candidateInfo.episodes.join(',E')}`);
                                        }
                                    }
                                }
                            } catch (epErr) {
                                if (enableLogs) console.warn(`[RSS] Failed to pre-record episodes: ${epErr.message}`);
                            }

                            // === STEP 4: NOW submit to downloader ===
                            let result;
                            if (torrentData && !item.link.startsWith('magnet:')) {
                                // If we have the file data, pass it along with save path, category, and file selection
                                result = await downloaderService.addTorrentFromData(targetClient, torrentData, {
                                    savePath: finalSavePath,
                                    category: task.category,
                                    fileIndices: fileIndices
                                });
                            } else {
                                // Magnet or fallback (file selection not supported for magnets)
                                result = await downloaderService.addTorrent(targetClient, item.link, {
                                    savePath: finalSavePath,
                                    category: task.category
                                });
                            }

                            if (result.success) {
                                let successMsg = `[RSS] Successfully added: ${item.title}`;
                                if (fileIndices && fileIndices.length > 0) {
                                    successMsg += ` (${fileIndices.length} files selected)`;
                                }
                                if (enableLogs) console.log(successMsg);
                            } else {
                                // === STEP 5: ROLLBACK if downloader failed ===
                                // Delete the pre-recorded task_history entry since download actually failed
                                if (enableLogs) console.error(`[RSS] Failed to add ${item.title}: ${result.message}. Rolling back pre-record.`);
                                try {
                                    db.prepare('DELETE FROM task_history WHERE id = ?').run(preRecordId);
                                    if (enableLogs) console.log(`[RSS] Rolled back task_history entry ID: ${preRecordId}`);
                                } catch (rollbackErr) {
                                    console.error(`[RSS] Rollback failed: ${rollbackErr.message}`);
                                }
                            }
                        } catch (err) {
                            if (enableLogs) console.error(`[RSS] Error processing item ${item.title}: ${err.message}`);
                        }
                    }
                }
            }

            // Check if task should be auto-disabled after match
            if (matchCount > 0 && task.auto_disable_on_match) {
                if (enableLogs) console.log(`[RSS] Task "${task.name}" matched ${matchCount} item(s). Auto-disabling as configured.`);

                // Disable the task
                db.prepare('UPDATE tasks SET enabled = 0 WHERE id = ?').run(task.id);

                // Cancel the scheduled job
                const schedulerService = require('./schedulerService');
                schedulerService.cancelTask(task.id);

                loggerService.log(`任务已完成匹配并自动禁用（匹配 ${matchCount} 个资源）`, 'success', task.id, items.length, matchCount);
            } else {
                loggerService.log(`成功发现 ${items.length} 个资源，匹配 ${matchCount} 个`, 'success', task.id, items.length, matchCount);
            }

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
        const { keywords, smart_regex, exclude, size_min, size_max } = config;
        const title = item.title;

        // 1. Check Smart Regex (if provided)
        if (smart_regex) {
            try {
                const regex = new RegExp(smart_regex, 'i');
                if (!regex.test(title)) return false;
            } catch (e) {
                console.error(`[RSS] Invalid Smart Regex: ${smart_regex}`, e);
                // Return false on invalid regex? or ignore? Safest to return false (no match).
                return false;
            }
        }

        const titleLower = title.toLowerCase();

        // 2. Check include keywords (AND logic for all keywords if provided)
        if (keywords && keywords.trim()) {
            const includeList = keywords.toLowerCase().split(',').map(k => k.trim()).filter(k => k);
            const matches = includeList.every(k => titleLower.includes(k));
            if (!matches) return false;
        }

        // 3. Check exclude keywords (OR logic)
        if (exclude && exclude.trim()) {
            const excludeList = exclude.toLowerCase().split(',').map(k => k.trim()).filter(k => k);
            const isExcluded = excludeList.some(k => titleLower.includes(k));
            if (isExcluded) return false;
        }

        // 4. Check size (size_min/max in MB)
        if (item.size > 0) {
            const sizeMB = item.size / (1024 * 1024);
            if (size_min && sizeMB < parseFloat(size_min)) return false;
            if (size_max && sizeMB > parseFloat(size_max)) return false;
        }

        return true;
    }
}

module.exports = new RSSService();

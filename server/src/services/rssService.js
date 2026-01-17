const axios = require('axios');
const cheerio = require('cheerio');
const parseTorrent = require('parse-torrent');
const { getDB } = require('../db');
const downloaderService = require('./downloaderService');
const siteService = require('./siteService');
const clientService = require('./clientService');
const notificationService = require('./notificationService');
const loggerService = require('./loggerService');
const appConfig = require('../utils/appConfig');
const torrentFetcher = require('../utils/torrentFetcher');

// Refactored modules for better maintainability
const EpisodeTracker = require('./rss/EpisodeTracker');
const DownloadCoordinator = require('./rss/DownloadCoordinator');

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

    async _shouldSkipTask(task, db) {
        try {
            const subscription = db.prepare('SELECT id, check_interval FROM series_subscriptions WHERE task_id = ?').get(task.id);
            if (subscription && subscription.check_interval > 0) {
                // Get the latest episode download time for this subscription
                const lastEp = db.prepare('SELECT download_time FROM series_episodes WHERE subscription_id = ? ORDER BY download_time DESC LIMIT 1').get(subscription.id);

                if (lastEp) {
                    const now = new Date();
                    const lastDownload = new Date(lastEp.download_time);

                    // Use date strings to calculate calendar day difference
                    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const downloadDate = new Date(lastDownload.getFullYear(), lastDownload.getMonth(), lastDownload.getDate());

                    const diffDays = Math.floor((nowDate - downloadDate) / (1000 * 60 * 60 * 24));
                    const skipDays = subscription.check_interval - 1;

                    if (diffDays < skipDays) {
                        return {
                            skip: true,
                            interval: subscription.check_interval,
                            diffDays,
                            nextDate: new Date(downloadDate.getTime() + skipDays * 24 * 60 * 60 * 1000)
                        };
                    }
                }
            }
        } catch (err) {
            console.error(`[RSS] Failed to check skip interval for task ${task.id}:`, err.message);
        }
        return { skip: false };
    }

    async executeTask(task) {
        const db = getDB();
        const enableLogs = appConfig.isLogsEnabled();

        if (enableLogs) console.log(`[RSS] Executing task: ${task.name}`);

        const skipInfo = await this._shouldSkipTask(task, db);
        if (skipInfo.skip) {
            if (enableLogs) console.log(`[RSS] Skipping task ${task.name}: check_interval ${skipInfo.interval} days. Last download was ${skipInfo.diffDays} days ago. Wait until ${skipInfo.nextDate.toLocaleDateString()}`);
            return;
        }

        try {
            // 1. Get site info for cookies
            const site = siteService.getSiteById(task.site_id);
            if (!site) throw new Error('Associated site not found');

            // 2. Fetch RSS feed with caching
            const rssData = await this.getRSSFeed(task.rss_url, siteService.getAuthHeaders(site));

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
                            // === Use refactored EpisodeTracker module ===
                            const subscription = db.prepare('SELECT id, season, name, alias FROM series_subscriptions WHERE task_id = ?').get(task.id);
                            const { isRedundant, downloadedEpisodes, candidateInfo } = EpisodeTracker.checkEpisodeExists(
                                item,
                                task.id,
                                subscription,
                                enableLogs
                            );

                            if (isRedundant && candidateInfo) {
                                if (enableLogs) console.log(`[RSS] Smart Skip: ${item.title} (Episodes ${candidateInfo.episodes.join(', ')} already downloaded, total tracked: ${downloadedEpisodes.size})`);
                                loggerService.log(`匹配到资源但已存在: ${item.title} (原因: 剧集 ${candidateInfo.episodes.join(', ')} 已下载)`, 'success', task.id, items.length, matchCount);
                                continue; // Skip processing this item
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
                                    const buffer = await torrentFetcher.fetchTorrentData(site, item.link);
                                    const parsed = parseTorrent(buffer);
                                    torrentHash = parsed.infoHash;
                                    torrentData = buffer.toString('base64'); // Store as base64 for passing to downloader
                                } catch (e) {
                                    if (enableLogs) console.warn(`[RSS] Failed to download/parse torrent: ${e.message}`);
                                    // If it's M-Team V2, don't fallback to URL as qBittorrent can't handle it
                                    const isMTeamV2 = site && site.api_key && (site.url.includes('m-team.cc') || site.url.includes('m-team.io'));
                                    if (isMTeamV2) {
                                        if (enableLogs) console.error(`[RSS] M-Team V2 download failed completely. Skipping match.`);
                                        continue;
                                    }
                                    torrentData = item.link; // Fallback to URL for other sites if parsing fails
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
                            const preRecordResult = db.prepare('INSERT INTO task_history (task_id, item_guid, item_title, item_size, item_hash, download_time, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
                                .run(task.id, item.guid, item.title, item.size, torrentHash, timeUtils.getLocalISOString(), task.user_id);
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

                            // === STEP 3: Pre-record episodes using EpisodeTracker ===
                            try {
                                const subscription = db.prepare('SELECT id, season FROM series_subscriptions WHERE task_id = ?').get(task.id);
                                if (subscription) {
                                    const episodeParser = require('../utils/episodeParser');
                                    const candidateInfo = episodeParser.parse(item.title);
                                    EpisodeTracker.preRecordEpisodes(subscription.id, candidateInfo, torrentHash, item.title, enableLogs);
                                }
                            } catch (epErr) {
                                if (enableLogs) console.warn(`[RSS] Failed to pre-record episodes: ${epErr.message}`);
                            }


                            // === STEP 4: Submit to downloader using DownloadCoordinator ===
                            const result = await DownloadCoordinator.executeDownload({
                                item,
                                task,
                                targetClient,
                                torrentData,
                                finalSavePath,
                                fileIndices,
                                preRecordId,
                                enableLogs
                            });

                            if (!result.success && enableLogs) {
                                console.error(`[RSS] Failed to add ${item.title}: ${result.message}`);
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
    async executeSmartTask(task) {
        const db = getDB();
        const enableLogs = appConfig.isLogsEnabled();

        if (enableLogs) console.log(`[RSS-Smart] Executing smart task: ${task.name}`);

        const skipInfo = await this._shouldSkipTask(task, db);
        if (skipInfo.skip) {
            if (enableLogs) console.log(`[RSS-Smart] Skipping task ${task.name}: check_interval ${skipInfo.interval} days. Last download was ${skipInfo.diffDays} days ago. Wait until ${skipInfo.nextDate.toLocaleDateString()}`);
            return;
        }

        try {
            // 1. Get ALL enabled RSS sources from enabled sites
            let sources = db.prepare(`
                SELECT r.url, r.site_id, r.name, s.name as site_name, s.cookies 
                FROM rss_sources r
                JOIN sites s ON r.site_id = s.id
                WHERE s.enabled = 1
            `).all();

            if (sources.length === 0) {
                if (enableLogs) console.log('[RSS-Smart] No enabled RSS sources found. Skipping.');
                return;
            }

            // 1.1 Smart Scan Optimization: Filter out irrelevant sources
            // Fetch rules from settings
            const rulesRow = db.prepare("SELECT value FROM settings WHERE key = 'rss_filter_rules'").get();
            let rules = {
                exclude: ['movie', 'film', '电影', 'music', '音乐', 'game', '游戏', 'docu', '纪录', 'sport', '体育', 'book', '书籍', 'software', '软件'],
                include: ['series', 'tv', '剧集', 'soap', 'show', 'all', '综合', '聚合']
            };

            if (rulesRow && rulesRow.value) {
                try {
                    const parsed = JSON.parse(rulesRow.value);
                    if (Array.isArray(parsed.exclude)) rules.exclude = parsed.exclude;
                    if (Array.isArray(parsed.include)) rules.include = parsed.include;
                } catch (e) {
                    console.error('[RSS-Smart] Failed to parse rss_filter_rules, using defaults');
                }
            }

            const originalCount = sources.length;
            sources = sources.filter(source => {
                const name = (source.name || '').toLowerCase();
                // If name explicitly contains exclusion keywords, skip it
                // Unless it ALSO contains "include" keywords (e.g. "Movies & TV")
                const isExcluded = rules.exclude.some(k => name.includes(k.toLowerCase()));
                const isIncluded = rules.include.some(k => name.includes(k.toLowerCase()));

                if (isExcluded && !isIncluded) {
                    return false;
                }
                return true;
            });

            if (enableLogs && sources.length < originalCount) {
                console.log(`[RSS-Smart] Optimized scanning: Filtered ${originalCount - sources.length} irrelevant sources (Movies/Music/etc). Remaining: ${sources.length}.`);
            }

            // 2. Parallel Fetch
            const feedPromises = sources.map(async (source) => {
                try {
                    const site = siteService.getSiteById(source.site_id);
                    const rssData = await this.getRSSFeed(source.url, siteService.getAuthHeaders(site));
                    return { source, data: rssData, success: true };
                } catch (e) {
                    if (enableLogs) console.warn(`[RSS-Smart] Failed to fetch ${source.site_name}: ${e.message}`);
                    return { source, success: false };
                }
            });

            const results = await Promise.all(feedPromises);
            const allItems = [];

            // 3. Parse and Aggregate
            for (const result of results) {
                if (!result.success || !result.data) continue;
                try {
                    const $ = cheerio.load(result.data, { xmlMode: true });
                    $('item').each((i, el) => {
                        const title = $(el).find('title').text();
                        const link = $(el).find('enclosure').attr('url') || $(el).find('link').text();
                        const guid = $(el).find('guid').text() || link;
                        const description = $(el).find('description').text();

                        // Parse Size
                        let size = parseInt($(el).find('size').text()) || 0;
                        if (!size) {
                            const sizeMatch = description.match(/Size:\s*([\d\.]+)\s*([KMGT]B?)/i);
                            if (sizeMatch) {
                                const FormatUtils = require('../utils/formatUtils');
                                size = FormatUtils.parseSizeToBytes(`${sizeMatch[1]} ${sizeMatch[2]}`);
                            }
                        }

                        // Parse Smart Details (Seeds, Free Status)
                        const details = this._parseSmartDetails(title, description);

                        allItems.push({
                            title,
                            link,
                            guid,
                            size,
                            description,
                            siteId: result.source.site_id,
                            siteName: result.source.site_name,
                            ...details
                        });
                    });
                } catch (parseErr) {
                    console.warn(`[RSS-Smart] Parse error for ${result.source.site_name}:`, parseErr);
                }
            }

            if (enableLogs) console.log(`[RSS-Smart] Aggregated ${allItems.length} total items from ${results.filter(r => r.success).length} sites.`);

            // 4. Filter & Group
            const filterConfig = JSON.parse(task.filter_config || '{}');
            const groupedCandidates = {}; // Key: "S01E01", Value: [items]

            let matchCount = 0;
            const episodeParser = require('../utils/episodeParser');

            // Pre-load download history for this series
            const subscription = db.prepare('SELECT id, season FROM series_subscriptions WHERE task_id = ?').get(task.id);
            const downloadedEpisodes = new Set();
            if (subscription) {
                // From series_episodes table
                const dbEps = db.prepare('SELECT season, episode FROM series_episodes WHERE subscription_id = ?').all(subscription.id);
                dbEps.forEach(ep => downloadedEpisodes.add(`S${ep.season}E${ep.episode}`));
            }

            for (const item of allItems) {
                if (this._itemMatches(item, filterConfig)) {
                    matchCount++;

                    // Parse Episode Info
                    const epInfo = episodeParser.parse(item.title);
                    if (epInfo && epInfo.season !== null && epInfo.episodes.length > 0) {
                        // Check if any episode in this item is already downloaded
                        const isDownloaded = epInfo.episodes.some(epNum =>
                            downloadedEpisodes.has(`S${epInfo.season}E${epNum}`)
                        );

                        if (!isDownloaded) {
                            // Use first episode as key for grouping (simplification for single-episode files)
                            // For packs, we might treat them as "S01Exx".
                            // To be robust, we treat the item as a candidate for EACH episode it contains, 
                            // but usually it's one file.
                            // Let's use a composite key for the "Group".
                            const key = `S${epInfo.season}E${epInfo.episodes[0]}`;

                            if (!groupedCandidates[key]) groupedCandidates[key] = [];
                            groupedCandidates[key].push({ ...item, epInfo });
                        }
                    }
                }
            }

            // 5. Score and Select
            let queuedCount = 0;
            for (const [key, candidates] of Object.entries(groupedCandidates)) {
                // Score Candidates
                candidates.forEach(c => {
                    c.score = this._calculateScore(c);
                });

                // Sort by Score DESC
                candidates.sort((a, b) => b.score - a.score);
                const best = candidates[0];

                if (enableLogs) {
                    console.log(`[RSS-Smart] Best candidate for ${key}: [${best.siteName}] ${best.title} (Score: ${best.score}, Free: ${best.isFree}, Seeds: ${best.seeders})`);
                }

                // Execute Download for the Best Candidate
                try {
                    await this._downloadItem(task, best, db, enableLogs);
                    queuedCount++;

                    // Mark episode as downloaded in our local set to prevent other items for same episode
                    // (Though loop ensures one winner per key)
                    best.epInfo.episodes.forEach(ep => downloadedEpisodes.add(`S${best.epInfo.season}E${ep}`));

                } catch (err) {
                    console.error(`[RSS-Smart] Failed to download best candidate for ${key}:`, err);
                }
            }

            loggerService.log(`智能聚合完成：发现 ${matchCount} 个匹配，下载了 ${queuedCount} 个最优资源`, 'success', task.id, allItems.length, matchCount);

        } catch (err) {
            if (enableLogs) console.error(`[RSS-Smart] Task ${task.name} failed:`, err.message);
            loggerService.log(`智能任务执行失败: ${err.message}`, 'error', task.id);
        }
    }

    _calculateScore(item) {
        let score = 0;

        // Promotion Score
        if (item.isFree || item.is2xFree) score += 100;
        else if (item.is50Percent) score += 50;
        else if (item.is30Percent) score += 30;

        // Seeder Score (0.1 per seed, capped at 20 points => 200 seeds)
        const seedScore = Math.min((item.seeders || 0) * 0.1, 20);
        score += seedScore;

        return score;
    }

    _parseSmartDetails(title, description) {
        const titleLower = title.toLowerCase();
        const descLower = (description || '').toLowerCase();

        let details = {
            seeders: 0,
            isFree: false,
            is2xFree: false,
            is50Percent: false,
            is30Percent: false
        };

        // Extract Seeders
        // Common formats: "Seeders: 123", "做种: 123", "seeder:123"
        const seedMatch = descLower.match(/(seeders?|做种|seeder)[\s:]*(\d+)/);
        if (seedMatch) {
            details.seeders = parseInt(seedMatch[2]);
        }

        // Extract Promotion Status form Title/Desc
        // Markers: [Free], [2xFree], [50%], [30%]
        // NexusPHP often puts <img alt="Free"> in description or text in title

        if (titleLower.includes('[free]') || titleLower.includes('【free】') || titleLower.includes('keys="free"') || descLower.includes('class="pro_free"')) {
            details.isFree = true;
        }
        if (titleLower.includes('[2xfree]') || titleLower.includes('【2xfree】') || descLower.includes('class="pro_2xfree"')) {
            details.is2xFree = true;
        }
        if (titleLower.includes('[50%]') || titleLower.includes('【50%】') || descLower.includes('class="pro_50"')) {
            details.is50Percent = true;
        }
        if (titleLower.includes('[30%]') || titleLower.includes('【30%】') || descLower.includes('class="pro_30"')) {
            details.is30Percent = true;
        }

        return details;
    }

    // Extracted download logic to reuse in executeSmartTask
    async _downloadItem(task, item, db, enableLogs) {
        const clientService = require('./clientService');
        const notificationService = require('./notificationService');
        const downloaderService = require('./downloaderService');
        const timeUtils = require('../utils/timeUtils');

        // Determine Client
        let targetClient = task.client_id ? clientService.getClientById(task.client_id) : clientService.getDefaultClient();
        if (!targetClient) throw new Error('No available download client');

        // Pre-record History
        const preRecordResult = db.prepare('INSERT INTO task_history (task_id, item_guid, item_title, item_size, item_hash, download_time, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(task.id, item.guid, item.title, item.size, null, timeUtils.getLocalISOString(), task.user_id);
        const preRecordId = preRecordResult.lastInsertRowid;

        // Notify
        const FormatUtils = require('../utils/formatUtils');
        notificationService.notifyNewTorrent(task.name, item.title, FormatUtils.formatBytes(item.size));

        // Match found, now handle download
        let torrentHash = null;
        let result;

        try {
            // Get site info for this item
            const site = siteService.getSiteById(item.siteId);
            if (site) {
                // Fetch actual torrent file (handles M-Team V2 tokens etc)
                const buffer = await torrentFetcher.fetchTorrentData(site, item.link);
                const torrentBase64 = buffer.toString('base64');

                // Parse hash for history
                try {
                    const parsed = parseTorrent(buffer);
                    torrentHash = parsed.infoHash;
                } catch (e) {
                    if (enableLogs) console.warn(`[RSS-Smart] Failed to parse hash: ${e.message}`);
                }

                // Add to downloader from data
                result = await downloaderService.addTorrentFromData(targetClient, torrentBase64, {
                    savePath: task.save_path,
                    category: task.category
                });
            } else {
                // Fallback for sites not in DB (shouldn't happen in smart task)
                result = await downloaderService.addTorrent(targetClient, item.link, {
                    savePath: task.save_path,
                    category: task.category
                });
            }
        } catch (downloadErr) {
            if (enableLogs) console.error(`[RSS-Smart] Failed to fetch/add torrent: ${downloadErr.message}`);
            result = { success: false, message: downloadErr.message };
        }

        // Smart Logic: Update series_episodes and task_history if successful
        if (result.success) {
            // Update hash in pre-recorded history
            if (torrentHash) {
                db.prepare('UPDATE task_history SET item_hash = ? WHERE id = ?').run(torrentHash, preRecordId);
            }
            if (enableLogs) console.log(`[RSS-Smart] Successfully added: ${item.title}`);

            // Record parsed episodes to DB
            if (item.epInfo) {
                const subscription = db.prepare('SELECT id, season FROM series_subscriptions WHERE task_id = ?').get(task.id);
                if (subscription) {
                    const insertEpStmt = db.prepare(`
                        INSERT OR IGNORE INTO series_episodes 
                        (subscription_id, season, episode, torrent_hash, torrent_title, download_time)
                        VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
                    `);
                    item.epInfo.episodes.forEach(ep => {
                        insertEpStmt.run(subscription.id, item.epInfo.season, ep, torrentHash, item.title);
                    });
                }
            }
        } else {
            // Rollback
            db.prepare('DELETE FROM task_history WHERE id = ?').run(preRecordId);
            throw new Error(result.message);
        }
    }
}

module.exports = new RSSService();

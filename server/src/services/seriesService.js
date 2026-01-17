const { getDB } = require('../db');
const timeUtils = require('../utils/timeUtils');
const taskService = require('./taskService');
const pathUtils = require('../utils/pathUtils');
const episodeParser = require('../utils/episodeParser');

class SeriesService {
    constructor() {
        this.db = null;
    }

    _getDB() {
        if (!this.db) {
            this.db = getDB();
        }
        return this.db;
    }

    async getAllSubscriptions() {
        // All users can see all series subscriptions (no user filtering)
        // But download records (task_history) remain user-isolated
        const subs = this._getDB().prepare(`
            SELECT s.*, 
                   t.enabled as task_enabled, 
                   t.client_id,
                   r.name as rss_source_name,
                   site.name as site_name
            FROM series_subscriptions s
            LEFT JOIN tasks t ON s.task_id = t.id
            LEFT JOIN rss_sources r ON s.rss_source_id = r.id
            LEFT JOIN sites site ON r.site_id = site.id
            ORDER BY s.created_at DESC
        `).all();

        // Calculate episode count for each subscription by matching torrent names
        // Uses the database table for instant loading
        for (const sub of subs) {
            const episodes = await this.getEpisodes(sub.id);
            // Count total unique episodes across all seasons
            sub.episode_count = Object.values(episodes).reduce((total, seasonData) => {
                return total + (seasonData.episodes ? seasonData.episodes.length : 0);
            }, 0);
        }

        return subs;
    }

    getSubscription(id) {
        return this._getDB().prepare('SELECT * FROM series_subscriptions WHERE id = ?').get(id);
    }

    /**
     * Update an existing subscription
     * Regenerates regex and updates associated task
     */
    async updateSubscription(id, data) {
        const db = this._getDB();
        const existing = this.getSubscription(id);
        if (!existing) throw new Error('Subscription not found');

        const { name, alias, season, quality, rss_source_id } = data;

        // Auto-refresh total_episodes if name or season changed
        let totalEpisodes = existing.total_episodes || 0;
        if (name !== existing.name || season !== existing.season) {
            try {
                const metadataService = require('./metadataService');
                const tmdbId = existing.tmdb_id; // Keep existing tmdb_id for now
                if (tmdbId) {
                    const seasonNum = parseInt(season) || 1;
                    const seasonDetails = await metadataService.getSeasonDetails(tmdbId, seasonNum);
                    if (seasonDetails) {
                        totalEpisodes = seasonDetails.episode_count;
                    }
                }
            } catch (e) {
                console.error('Total episodes refresh failed on update:', e);
            }
        }

        // 1. Generate new regex
        // Use provided alias or fallback to existing alias
        const targetAlias = alias !== undefined ? alias : existing.alias;
        const smartRegex = this._generateSmartRegex(name, season, quality, targetAlias);

        // 2. Lookup new RSS Source if changed (or if we need it for switching back)
        let rssUrl = null;
        if (rss_source_id && rss_source_id !== existing.rss_source_id) {
            const rssSource = db.prepare('SELECT * FROM rss_sources WHERE id = ?').get(rss_source_id);
            if (rssSource) rssUrl = rssSource.url;
        }

        // 3. Update subscription record
        // Handle smart_switch if provided
        const smartSwitchVal = (data.smart_switch === true || data.smart_switch === 'true' || data.smart_switch === 1) ? 1 : 0;

        db.prepare(`
            UPDATE series_subscriptions 
            SET name = ?, alias = ?, season = ?, quality = ?, smart_regex = ?, rss_source_id = ?, total_episodes = ?, smart_switch = ?, check_interval = ?
            WHERE id = ?
        `).run(name, alias || null, season, quality, smartRegex, rss_source_id, totalEpisodes, smartSwitchVal, data.check_interval || 0, id);

        // 4. Update associated task configuration
        const filterConfig = {
            keywords: '',
            smart_regex: smartRegex,
            exclude_keywords: '',
            size_min: 0,
            size_max: 0
        };

        const updates = {
            filter_config: JSON.stringify(filterConfig)
        };

        let sql = 'UPDATE tasks SET filter_config = ?';
        let params = [JSON.stringify(filterConfig)];

        // If Smart Switch is ON, change task type and URL
        if (smartSwitchVal === 1) {
            sql += ", type = 'smart_rss', rss_url = 'SMART_AGGREGATION'";
        } else {
            // If switching back to normal RSS, update URL and ensure type is 'rss'
            // We must lookup the RSS source details regardless of whether it changed,
            // because the task might currently be in 'smart_rss' mode.
            if (rss_source_id) {
                const rssSource = db.prepare('SELECT * FROM rss_sources WHERE id = ?').get(rss_source_id);
                if (rssSource) {
                    sql += ", rss_url = ?, site_id = ?, type = 'rss'";
                    params.push(rssSource.url);
                    params.push(rssSource.site_id);
                }
            }
        }

        if (data.client_id) {
            sql += ", client_id = ?";
            params.push(data.client_id);
        }

        sql += ' WHERE id = ?';
        params.push(existing.task_id);

        db.prepare(sql).run(...params);

        return { id, ...data, smart_regex: smartRegex, smart_switch: smartSwitchVal };
    }

    /**
     * Create a new subscription
     * 1. Generate Regex
     * 2. Create RSS Task
     * 3. Save Subscription
     */
    async createSubscription(data, userId = null) {
        const { name, season, quality, rss_source_id, save_path, client_id, category = 'Series', check_interval = 0 } = data;

        // Auto-fetch metadata
        let metadata = null;
        let totalEpisodes = 0;
        try {
            const metadataService = require('./metadataService');
            metadata = await metadataService.searchSeries(name);
            if (metadata && metadata.tmdb_id) {
                const seasonNum = parseInt(season) || 1;
                const seasonDetails = await metadataService.getSeasonDetails(metadata.tmdb_id, seasonNum);
                if (seasonDetails) {
                    totalEpisodes = seasonDetails.episode_count;
                }
            }
        } catch (e) {
            console.error('Metadata fetch failed:', e);
        }

        // 1. Generate Smart Regex
        // improved: include original_name/alias in regex
        const generatedAlias = metadata ? metadata.original_name : null;
        const smartRegex = this._generateSmartRegex(name, season, quality, generatedAlias);

        // Handle Smart Switch
        const smartSwitchVal = (data.smart_switch === true || data.smart_switch === 'true' || data.smart_switch === 1) ? 1 : 0;
        let finalRssUrl = '';
        let finalSiteId = null;

        if (smartSwitchVal === 1) {
            finalRssUrl = 'SMART_AGGREGATION'; // Special flag
            // For site_id, we can leave it null or set to a placeholder. 
            // rssService will ignore site_id for smart_rss tasks.
        } else {
            // Normal RSS Mode
            const rssSource = this._getDB().prepare('SELECT * FROM rss_sources WHERE id = ?').get(rss_source_id);
            if (!rssSource) throw new Error('Invalid RSS Source');
            finalRssUrl = rssSource.url;
            finalSiteId = rssSource.site_id;
        }

        const filterConfig = {
            keywords: '', // Clear keywords, use regex instead
            smart_regex: smartRegex,
            exclude_keywords: '',
            size_min: 0,
            size_max: 0
        };

        // Determine Save Path
        let finalSavePath = save_path;
        if (!finalSavePath) {
            // Try to find default path for Series
            const defaultPath = this._getDB().prepare("SELECT path FROM download_paths WHERE name IN ('Series', '剧集') LIMIT 1").get();
            if (defaultPath) {
                finalSavePath = defaultPath.path;
            }
        }

        // Check if series subfolder creation is enabled
        // Only auto-append series name if the setting is enabled
        const setting = this._getDB().prepare("SELECT value FROM settings WHERE key = 'create_series_subfolder'").get();
        const createSeriesSubfolder = setting?.value === 'true';

        if (createSeriesSubfolder && finalSavePath) {
            // Format: "剧集名 S01" (Name + Season)
            const safeName = pathUtils.sanitizeFilename(name);
            const seasonNum = parseInt(season) || 1;
            const seasonStr = `S${String(seasonNum).padStart(2, '0')}`;
            const folderName = `${safeName} ${seasonStr}`;
            finalSavePath = pathUtils.join(finalSavePath, folderName);
            console.log(`[Series] Auto-created subfolder: ${folderName}`)
        }


        const taskId = taskService.createTask({
            name: `[追剧] ${name} ${season ? 'S' + season : ''} `,
            type: smartSwitchVal === 1 ? 'smart_rss' : 'rss',
            cron: '*/30 * * * *',
            site_id: finalSiteId,
            rss_url: finalRssUrl,
            filter_config: JSON.stringify(filterConfig),
            client_id,
            save_path: finalSavePath,
            category,
            enabled: 1,
            user_id: userId
        });

        // 3. Save Subscription with Metadata
        const info = this._getDB().prepare(`
            INSERT INTO series_subscriptions(name, alias, season, quality, smart_regex, rss_source_id, task_id, poster_path, tmdb_id, overview, vote_average, total_episodes, user_id, smart_switch, check_interval)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            name,
            metadata ? metadata.original_name : null, // Save alias
            season, quality, smartRegex, rss_source_id, taskId,
            metadata ? metadata.poster_path : null,
            metadata ? metadata.tmdb_id : null,
            metadata ? metadata.overview : null,
            metadata ? metadata.vote_average : 0,
            totalEpisodes,
            userId,
            smartSwitchVal,
            check_interval
        );

        return info.lastInsertRowid;
    }

    deleteSubscription(id) {
        const sub = this._getDB().prepare('SELECT * FROM series_subscriptions WHERE id = ?').get(id);
        if (sub) {
            // Delete subscription first (child table)
            this._getDB().prepare('DELETE FROM series_subscriptions WHERE id = ?').run(id);

            // Then delete the linked task (parent table)
            if (sub.task_id) {
                taskService.deleteTask(sub.task_id);
                // Also cancel the scheduled task
                const schedulerService = require('./schedulerService');
                schedulerService.cancelTask(sub.task_id);
            }
        }
    }

    _generateSmartRegex(name, season, quality, alias = null) {
        // Simple escape for name and alias
        let namePart = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (alias && alias.trim() && alias.trim().toLowerCase() !== name.trim().toLowerCase()) {
            const aliasPart = alias.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            namePart = `(${namePart}|${aliasPart})`;
        }

        let regex = namePart + '.*';

        if (season) {
            const sNum = parseInt(season);
            regex += `S0?${sNum}`;
        }

        if (quality) {
            regex += '.*';
            const parts = quality.split(',').map(q => q.trim()).filter(Boolean);
            if (parts.length > 0) {
                const resGroups = [];
                parts.forEach(p => {
                    const low = p.toLowerCase();
                    if (low.includes('4k') || low.includes('2160')) resGroups.push('(2160p|4k|uhd)');
                    else if (low.includes('1080')) resGroups.push('1080[pi]');
                    else if (low.includes('720')) resGroups.push('720[pi]');
                    else resGroups.push(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                });

                if (resGroups.length > 1) {
                    regex += `(${resGroups.join('|')})`;
                } else if (resGroups.length === 1) {
                    // Remove outer parens if not needed for single complex group
                    regex += resGroups[0];
                }
            }
        }

        return regex;
    }

    /**
     * Get downloaded episodes for a subscription
     * @param {number} id - Subscription ID
     * @param {boolean} skipFileScan - Not used anymore, kept for API compatibility
     * Returns: { "1": {episodes: [1, 2, 3], isSeasonPack: false} }
     */
    /**
     * Get downloaded episodes for a subscription from the database (fast)
     * @param {number} id - Subscription ID
     * @returns {Promise<Object>} - Format: { "1": {episodes: [1, 2, 3], isSeasonPack: false} }
     */
    async getEpisodes(id) {
        // Query episodes from database table
        const episodes = this._getDB().prepare(`
            SELECT season, episode 
            FROM series_episodes 
            WHERE subscription_id = ?
            ORDER BY season, episode
        `).all(id);

        // Group by season
        const resultMap = {};
        episodes.forEach(ep => {
            if (!resultMap[ep.season]) {
                resultMap[ep.season] = { episodes: [], isSeasonPack: false };
            }
            resultMap[ep.season].episodes.push(ep.episode);
        });

        return resultMap;
    }

    /**
     * Manually sync episodes from task history and downloader for a subscription
     * This is the heavy lifting operation
     */
    async syncEpisodesFromHistory(id) {
        console.log(`[DEBUG] Syncing episodes for subscription ID: ${id}`);
        const sub = this.getSubscription(id);
        if (!sub) throw new Error('Subscription not found');

        const db = this._getDB();
        const seriesName = sub.name.toLowerCase().trim();
        const seriesAlias = (sub.alias || '').toLowerCase().trim();

        // 1. Find all finished torrents in history that match this series name or alias
        const allHistory = db.prepare('SELECT item_title, item_hash, download_time FROM task_history WHERE is_finished = 1').all();

        console.log(`[DEBUG] Total finished history records: ${allHistory.length}`);
        console.log(`[DEBUG] Looking for series: "${seriesName}" (Alias: "${seriesAlias}")`);

        const episodesToStore = []; // {season, episode, hash, title, time}
        const seasonPacksToScan = [];

        let matchedCount = 0;
        allHistory.forEach(row => {
            const titleLower = (row.item_title || '').toLowerCase();

            // Flexible name matching
            let isMatch = titleLower.includes(seriesName);

            // Try alias match if name fails
            if (!isMatch && seriesAlias) {
                isMatch = titleLower.includes(seriesAlias);
            }

            if (!isMatch) {
                const normalizedTitle = titleLower.replace(/[\s._\-\[\](){}+]/g, '');
                const normalizedSeries = seriesName.replace(/[\s._\-\[\](){}+]/g, '');
                isMatch = normalizedTitle.includes(normalizedSeries);

                // Try normalized alias match
                if (!isMatch && seriesAlias) {
                    const normalizedAlias = seriesAlias.replace(/[\s._\-\[\](){}+]/g, '');
                    isMatch = normalizedTitle.includes(normalizedAlias);
                }
            }

            if (!isMatch) return;

            matchedCount++;
            console.log(`[DEBUG] Matched: "${row.item_title}"`);

            const parsed = episodeParser.parse(row.item_title);
            if (!parsed) {
                console.log(`[DEBUG] Failed to parse: "${row.item_title}"`);
                return;
            }

            if (parsed.episodes && parsed.episodes.length > 0) {
                const season = parsed.season !== null ? parsed.season : (sub.season || 1);
                parsed.episodes.forEach(ep => {
                    episodesToStore.push({
                        season,
                        episode: ep,
                        hash: row.item_hash,
                        title: row.item_title,
                        time: row.download_time
                    });
                });
            } else if (parsed.season !== null) {
                // Season pack detected
                seasonPacksToScan.push({
                    hash: row.item_hash,
                    season: parsed.season,
                    title: row.item_title,
                    time: row.download_time
                });
            }
        });

        // 2. Scan files for season packs
        if (seasonPacksToScan.length > 0) {
            const clientService = require('./clientService');
            const downloaderService = require('./downloaderService');
            const clients = clientService.getAllClients();

            for (const pack of seasonPacksToScan) {
                if (!pack.hash) continue;

                for (const client of clients) {
                    try {
                        const filesResult = await downloaderService.getTorrentFiles(client, pack.hash);
                        if (filesResult.success && filesResult.files && filesResult.files.length > 0) {
                            filesResult.files.forEach(file => {
                                const fileParsed = episodeParser.parse(file.name);
                                if (fileParsed && fileParsed.episodes && fileParsed.episodes.length > 0) {
                                    fileParsed.episodes.forEach(ep => {
                                        episodesToStore.push({
                                            season: pack.season,
                                            episode: ep,
                                            hash: pack.hash,
                                            title: pack.title,
                                            time: pack.time
                                        });
                                    });
                                }
                            });
                            break;
                        }
                    } catch (e) { }
                }
            }
        }

        // 3. Save unique episodes to database
        if (episodesToStore.length > 0) {
            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO series_episodes 
                (subscription_id, season, episode, torrent_hash, torrent_title, download_time)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            const transaction = db.transaction((eps) => {
                for (const ep of eps) {
                    insertStmt.run(id, ep.season, ep.episode, ep.hash, ep.title, ep.time || timeUtils.getLocalISOString());
                }
            });

            transaction(episodesToStore);
            console.log(`[DEBUG] Stored ${episodesToStore.length} episodes for subscription ${id}`);
        } else {
            console.log(`[DEBUG] No episodes found to store. Matched ${matchedCount} torrents from ${allHistory.length} total history records.`);
        }

        return await this.getEpisodes(id);
    }
    /**
     * Refresh metadata for a subscription
     */
    async refreshMetadata(id) {
        const sub = this.getSubscription(id);
        if (!sub) throw new Error('Subscription not found');

        try {
            const metadataService = require('./metadataService');
            const metadata = await metadataService.searchSeries(sub.name);

            if (metadata) {
                let totalEpisodes = sub.total_episodes || 0;
                if (metadata.tmdb_id) {
                    const seasonNum = parseInt(sub.season) || 1;
                    const seasonDetails = await metadataService.getSeasonDetails(metadata.tmdb_id, seasonNum);
                    if (seasonDetails) {
                        totalEpisodes = seasonDetails.episode_count;
                    }
                }

                this._getDB().prepare(`
                    UPDATE series_subscriptions 
                    SET poster_path = ?, tmdb_id = ?, overview = ?, total_episodes = ?, alias = ?, vote_average = ?
                    WHERE id = ?
                `).run(
                    metadata.poster_path,
                    metadata.tmdb_id,
                    metadata.overview,
                    totalEpisodes,
                    metadata.original_name, // Update alias
                    metadata.vote_average || 0,
                    id
                );
                return { ...sub, ...metadata, total_episodes: totalEpisodes, alias: metadata.original_name, vote_average: metadata.vote_average };
            }
        } catch (e) {
            console.error('Metadata refresh failed:', e);
            throw new Error('Failed to refresh metadata');
        }
        return sub;
    }
}

module.exports = new SeriesService();

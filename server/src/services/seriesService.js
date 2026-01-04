const { getDB } = require('../db');
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
        // Get subscriptions with episode count
        const subs = this._getDB().prepare(`
            SELECT s.*, 
                   t.enabled as task_enabled, 
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
        const smartRegex = this._generateSmartRegex(name, season, quality);

        // 2. Lookup new RSS Source if changed
        let rssUrl = null;
        if (rss_source_id && rss_source_id !== existing.rss_source_id) {
            const rssSource = db.prepare('SELECT * FROM rss_sources WHERE id = ?').get(rss_source_id);
            if (rssSource) rssUrl = rssSource.url;
        }

        // 3. Update subscription record
        db.prepare(`
            UPDATE series_subscriptions 
            SET name = ?, alias = ?, season = ?, quality = ?, smart_regex = ?, rss_source_id = ?, total_episodes = ?
            WHERE id = ?
        `).run(name, alias || null, season, quality, smartRegex, rss_source_id, totalEpisodes, id);

        // 4. Update associated task configuration
        // We construct the filter config JSON. 
        // Note: For RSS tasks, 'filter_config' is the JSON string.
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
        // If RSS Source changed, update rss_url in task
        if (rssUrl) {
            updates.rss_url = rssUrl;
        }

        // We use a direct DB update for simplicity as taskService.updateTask might be heavy/unknown
        // But for safety, let's update basic fields.
        let sql = 'UPDATE tasks SET filter_config = ?';
        let params = [JSON.stringify(filterConfig)];

        if (rssUrl) {
            sql += ', rss_url = ?';
            params.push(rssUrl);
        }

        sql += ' WHERE id = ?';
        params.push(existing.task_id);

        db.prepare(sql).run(...params);

        return { id, ...data, smart_regex: smartRegex };
    }

    /**
     * Create a new subscription
     * 1. Generate Regex
     * 2. Create RSS Task
     * 3. Save Subscription
     */
    async createSubscription(data) {
        const { name, season, quality, rss_source_id, save_path, client_id, category = 'Series' } = data;

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
        const smartRegex = this._generateSmartRegex(name, season, quality);

        // 2. Create Task
        const rssSource = this._getDB().prepare('SELECT * FROM rss_sources WHERE id = ?').get(rss_source_id);
        if (!rssSource) throw new Error('Invalid RSS Source');

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
            const safeName = pathUtils.sanitizeFilename(name);
            finalSavePath = pathUtils.join(finalSavePath, safeName);
            console.log(`[Series] Auto-created subfolder for: ${name}`);
        }


        const taskId = taskService.createTask({
            name: `[追剧] ${name} ${season ? 'S' + season : ''} `,
            type: 'rss',
            cron: '*/30 * * * *',
            site_id: rssSource.site_id,
            rss_url: rssSource.url,
            filter_config: JSON.stringify(filterConfig),
            client_id,
            save_path: finalSavePath,
            category,
            enabled: 1
        });

        // 3. Save Subscription with Metadata
        const info = this._getDB().prepare(`
            INSERT INTO series_subscriptions(name, alias, season, quality, smart_regex, rss_source_id, task_id, poster_path, tmdb_id, overview, total_episodes)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            name,
            metadata ? metadata.original_name : null, // Save alias
            season, quality, smartRegex, rss_source_id, taskId,
            metadata ? metadata.poster_path : null,
            metadata ? metadata.tmdb_id : null,
            metadata ? metadata.overview : null,
            totalEpisodes
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

    /**
     * Generate regex for series
     * e.g. Name="From", Season="2", Quality="4K"
     * Result: "From.*S0?2.*(2160p|4k)"
     */
    _generateSmartRegex(name, season, quality) {
        let regex = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special chars
        regex += '.*'; // Separator

        if (season) {
            // Match S02, s2, S 2, Season 2
            // Simplest robust match: S0?2 (Matches S02 or S2)
            const sNum = parseInt(season);
            regex += `S0?${sNum}`;
        }

        if (quality) {
            regex += '.*';
            const q = quality.toLowerCase();
            if (q.includes('4k') || q.includes('2160')) {
                regex += '(2160p|4k|uhd)';
            } else if (q.includes('1080')) {
                regex += '1080[pi]';
            } else if (q.includes('720')) {
                regex += '720[pi]';
            } else {
                regex += quality;
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
                    insertStmt.run(id, ep.season, ep.episode, ep.hash, ep.title, ep.time || new Date().toISOString());
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
                    SET poster_path = ?, tmdb_id = ?, overview = ?, total_episodes = ?, alias = ?
                    WHERE id = ?
                `).run(
                    metadata.poster_path,
                    metadata.tmdb_id,
                    metadata.overview,
                    totalEpisodes,
                    metadata.original_name, // Update alias
                    id
                );
                return { ...sub, ...metadata, total_episodes: totalEpisodes, alias: metadata.original_name };
            }
        } catch (e) {
            console.error('Metadata refresh failed:', e);
            throw new Error('Failed to refresh metadata');
        }
        return sub;
    }
}

module.exports = new SeriesService();

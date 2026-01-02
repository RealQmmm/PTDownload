const { getDB } = require('../db');
const taskService = require('./taskService');

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

    getAllSubscriptions() {
        // Get subscriptions and join with basic task info
        return this._getDB().prepare(`
            SELECT s.*, 
                   t.enabled as task_enabled, 
                   r.name as rss_source_name,
                   (SELECT COUNT(*) FROM task_history th WHERE th.task_id = s.task_id AND th.is_finished = 1) as episode_count
            FROM series_subscriptions s
            LEFT JOIN tasks t ON s.task_id = t.id
            LEFT JOIN rss_sources r ON s.rss_source_id = r.id
            ORDER BY s.created_at DESC
        `).all();
    }

    getSubscription(id) {
        return this._getDB().prepare('SELECT * FROM series_subscriptions WHERE id = ?').get(id);
    }

    /**
     * Update an existing subscription
     * Regenerates regex and updates associated task
     */
    updateSubscription(id, data) {
        const db = this._getDB();
        const existing = this.getSubscription(id);
        if (!existing) throw new Error('Subscription not found');

        const { name, season, quality, rss_source_id } = data;

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
            SET name = ?, season = ?, quality = ?, smart_regex = ?, rss_source_id = ?
            WHERE id = ?
                `).run(name, season, quality, smartRegex, rss_source_id, id);

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
    createSubscription(data) {
        const { name, season, quality, rss_source_id, save_path, client_id, category = 'Series' } = data;

        // 1. Generate Smart Regex
        const smartRegex = this._generateSmartRegex(name, season, quality);

        // 2. Create Task
        // Use a generic cron (e.g., every 30 mins) or inherit from global settings
        const taskData = {
            name: `[Series] ${name} ${season ? 'S' + season : ''} `,
            type: 'rss',
            cron: '*/30 * * * *', // Default: every 30 mins
            site_id: null, // Derived from RSS Source
            rss_url: null, // Will fetch from RSS Source in rssService, but we need to link it
            // Wait, RSS Task needs filtering config. 
            // In existing logic, RSS Task usually links to a Site or RSS URL.
            // Let's check rssService logic. Usually it uses `site_id` or `rss_url`.
            // But here we have `rss_source_id`.
            // We should look up the RSS Source URL.
        };

        const rssSource = this._getDB().prepare('SELECT * FROM rss_sources WHERE id = ?').get(rss_source_id);
        if (!rssSource) throw new Error('Invalid RSS Source');

        const filterConfig = {
            keywords: '', // Clear keywords, use regex instead
            smart_regex: smartRegex,
            exclude_keywords: '',
            size_min: 0,
            size_max: 0
        };

        // 2. Determine Save Path
        let finalSavePath = save_path;
        if (!finalSavePath) {
            // Try to find default path for Series
            const defaultPath = this._getDB().prepare("SELECT path FROM download_paths WHERE name IN ('Series', '剧集') LIMIT 1").get();
            if (defaultPath) {
                finalSavePath = defaultPath.path;
            }
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

        // 3. Save Subscription
        const info = this._getDB().prepare(`
            INSERT INTO series_subscriptions(name, season, quality, smart_regex, rss_source_id, task_id)
        VALUES(?, ?, ?, ?, ?, ?)
        `).run(name, season, quality, smartRegex, rss_source_id, taskId);

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
}

module.exports = new SeriesService();

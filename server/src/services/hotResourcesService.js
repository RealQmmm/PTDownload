const { getDB } = require('../db');
const appConfig = require('../utils/appConfig');

/**
 * Hot Resources Detection Service
 * Automatically detects trending torrents based on configurable rules
 */
const hotResourcesService = {
    /**
     * Get hot resources configuration
     */
    getConfig() {
        const db = getDB();
        const enabled = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_enabled'").get()?.value === 'true';
        const checkInterval = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_check_interval'").get()?.value || '10');
        const autoDownload = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_auto_download'").get()?.value === 'true';
        const defaultClient = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_default_client'").get()?.value || '';
        const notifyEnabled = db.prepare("SELECT value FROM settings WHERE key = 'notify_on_hot_resource'").get()?.value === 'true';

        const rulesRow = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_rules'").get();
        const rules = rulesRow ? JSON.parse(rulesRow.value) : {};

        return {
            enabled,
            checkInterval,
            autoDownload,
            defaultClient,
            notifyEnabled,
            rules
        };
    },

    /**
     * Update hot resources configuration
     */
    updateConfig(config) {
        const db = getDB();
        const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        if (config.enabled !== undefined) {
            updateSetting.run('hot_resources_enabled', config.enabled ? 'true' : 'false');
        }
        if (config.checkInterval !== undefined) {
            updateSetting.run('hot_resources_check_interval', String(config.checkInterval));
        }
        if (config.autoDownload !== undefined) {
            updateSetting.run('hot_resources_auto_download', config.autoDownload ? 'true' : 'false');
        }
        if (config.defaultClient !== undefined) {
            updateSetting.run('hot_resources_default_client', config.defaultClient);
        }
        if (config.notifyEnabled !== undefined) {
            updateSetting.run('notify_on_hot_resource', config.notifyEnabled ? 'true' : 'false');
        }
        if (config.rules !== undefined) {
            updateSetting.run('hot_resources_rules', JSON.stringify(config.rules));
        }

        return this.getConfig();
    },

    /**
     * Calculate hot score for a resource
     */
    calculateHotScore(resource, rules) {
        let score = 0;

        // Seeders contribution (weight: 2)
        score += (resource.seeders || 0) * 2;

        // Leechers contribution (weight: 3)
        score += (resource.leechers || 0) * 3;

        // Promotion bonus
        const promotion = (resource.promotion || '').toLowerCase();
        if (promotion.includes('2xfree') || promotion.includes('2x free')) {
            score += 30;
        } else if (promotion.includes('free')) {
            score += 20;
        } else if (promotion.includes('50%')) {
            score += 10;
        }

        // Freshness bonus (based on publish time)
        if (resource.publishTime) {
            const now = new Date();
            const publishDate = new Date(resource.publishTime);
            const minutesAgo = (now - publishDate) / (1000 * 60);

            if (minutesAgo < 30) {
                score += 15;
            } else if (minutesAgo < 60) {
                score += 10;
            } else if (minutesAgo < 120) {
                score += 5;
            }
        }

        return Math.floor(score);
    },

    /**
     * Apply filters to resources
     */
    applyFilters(resources, rules) {
        const enableLogs = appConfig.isLogsEnabled();

        return resources.filter(resource => {
            // Check publish time
            if (rules.minPublishMinutes && resource.publishTime) {
                const now = new Date();
                const publishDate = new Date(resource.publishTime);
                const minutesAgo = (now - publishDate) / (1000 * 60);

                if (minutesAgo > rules.minPublishMinutes) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: too old (${minutesAgo.toFixed(0)} minutes)`);
                    return false;
                }
            }

            // Check seeders
            if (rules.minSeeders && (resource.seeders || 0) < rules.minSeeders) {
                if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: not enough seeders (${resource.seeders})`);
                return false;
            }

            // Check leechers
            if (rules.minLeechers && (resource.leechers || 0) < rules.minLeechers) {
                if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: not enough leechers (${resource.leechers})`);
                return false;
            }

            // Check size
            if (rules.minSize && resource.size && resource.size < rules.minSize) {
                if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: too small`);
                return false;
            }
            if (rules.maxSize && resource.size && resource.size > rules.maxSize) {
                if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: too large`);
                return false;
            }

            // Check promotions
            if (rules.enabledPromotions && rules.enabledPromotions.length > 0) {
                const promotion = (resource.promotion || '').toLowerCase();
                const hasPromotion = rules.enabledPromotions.some(p => promotion.includes(p.toLowerCase()));
                if (!hasPromotion) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: no matching promotion`);
                    return false;
                }
            }

            // Check categories
            if (rules.categories && rules.categories.length > 0) {
                const category = (resource.category || '').toLowerCase();
                const hasCategory = rules.categories.some(c => category.includes(c.toLowerCase()));
                if (!hasCategory) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: category mismatch`);
                    return false;
                }
            }

            // Check keywords (include)
            if (rules.keywords && rules.keywords.length > 0) {
                const title = (resource.title || '').toLowerCase();
                const hasKeyword = rules.keywords.some(k => title.includes(k.toLowerCase()));
                if (!hasKeyword) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: no matching keyword`);
                    return false;
                }
            }

            // Check exclude keywords
            if (rules.excludeKeywords && rules.excludeKeywords.length > 0) {
                const title = (resource.title || '').toLowerCase();
                const hasExcludeKeyword = rules.excludeKeywords.some(k => title.includes(k.toLowerCase()));
                if (hasExcludeKeyword) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: contains excluded keyword`);
                    return false;
                }
            }

            // Check enabled sites
            if (rules.enabledSites && rules.enabledSites.length > 0) {
                const siteId = resource.siteId || resource.site_id;
                if (!rules.enabledSites.includes(siteId)) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: site not enabled`);
                    return false;
                }
            }

            return true;
        });
    },

    /**
     * Main detection method - detects hot resources from RSS feeds
     */
    async detectHotResources() {
        const enableLogs = appConfig.isLogsEnabled();
        const config = this.getConfig();

        if (!config.enabled) {
            if (enableLogs) console.log('[Hot Resources] Detection is disabled');
            return { success: false, message: 'Detection is disabled' };
        }

        try {
            const db = getDB();
            const rssService = require('./rssService');
            const siteService = require('./siteService');

            // Get all enabled sites
            const sites = db.prepare('SELECT * FROM sites WHERE enabled = 1').all();
            if (sites.length === 0) {
                if (enableLogs) console.log('[Hot Resources] No enabled sites found');
                return { success: false, message: 'No enabled sites' };
            }

            if (enableLogs) console.log(`[Hot Resources] Starting detection across ${sites.length} sites...`);

            let totalDetected = 0;
            let totalNew = 0;

            for (const site of sites) {
                try {
                    // Get RSS feed for this site
                    const rssUrl = site.default_rss_url || `${site.url}/torrentrss.php`;
                    const headers = siteService.getAuthHeaders(site);
                    const feedResult = await rssService.getRSSFeed(rssUrl, headers);

                    if (!feedResult || !feedResult.items || feedResult.items.length === 0) {

                        if (enableLogs) console.log(`[Hot Resources] No items from ${site.name}`);
                        continue;
                    }

                    // Convert RSS items to resource format
                    const resources = feedResult.items.map(item => ({
                        title: item.title,
                        url: item.link,
                        downloadUrl: item.enclosure?.url || item.link,
                        size: item.enclosure?.length || 0,
                        seeders: item.seeders || 0,
                        leechers: item.leechers || item.peers || 0,
                        category: item.category,
                        promotion: item.promotion || '',
                        publishTime: item.pubDate,
                        siteId: site.id,
                        hash: item.guid || item.link
                    }));

                    // Apply filters
                    const filtered = this.applyFilters(resources, config.rules);
                    if (enableLogs) console.log(`[Hot Resources] ${site.name}: ${filtered.length}/${resources.length} passed filters`);

                    // Calculate scores and filter by threshold
                    const hotResources = filtered
                        .map(resource => ({
                            ...resource,
                            hotScore: this.calculateHotScore(resource, config.rules)
                        }))
                        .filter(resource => resource.hotScore >= (config.rules.scoreThreshold || 40));

                    if (enableLogs) console.log(`[Hot Resources] ${site.name}: ${hotResources.length} hot resources found`);

                    // Save to database
                    for (const resource of hotResources) {
                        const saved = this.saveHotResource(resource);
                        if (saved.isNew) {
                            totalNew++;

                            // Trigger notification if enabled
                            if (config.notifyEnabled) {
                                this.notifyHotResource(resource, site);
                            }
                        }
                    }

                    totalDetected += hotResources.length;

                } catch (siteErr) {
                    console.error(`[Hot Resources] Error processing site ${site.name}:`, siteErr.message);
                }
            }

            if (enableLogs) console.log(`[Hot Resources] Detection complete: ${totalDetected} total, ${totalNew} new`);

            // Cleanup old records (keep last 7 days)
            this.cleanupOldRecords();

            return {
                success: true,
                totalDetected,
                totalNew,
                message: `Detected ${totalNew} new hot resources`
            };

        } catch (err) {
            console.error('[Hot Resources] Detection error:', err);
            return { success: false, message: err.message };
        }
    },

    /**
     * Save hot resource to database
     */
    saveHotResource(resource) {
        const db = getDB();

        try {
            // Check if already exists
            const existing = db.prepare('SELECT id FROM hot_resources WHERE resource_hash = ?').get(resource.hash);

            if (existing) {
                // Update existing record
                db.prepare(`
                    UPDATE hot_resources 
                    SET seeders = ?, leechers = ?, hot_score = ?, detected_time = CURRENT_TIMESTAMP
                    WHERE resource_hash = ?
                `).run(resource.seeders, resource.leechers, resource.hotScore, resource.hash);

                return { success: true, isNew: false, id: existing.id };
            } else {
                // Insert new record
                const result = db.prepare(`
                    INSERT INTO hot_resources (
                        resource_hash, site_id, title, url, download_url, size,
                        seeders, leechers, category, promotion, publish_time, hot_score
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    resource.hash,
                    resource.siteId,
                    resource.title,
                    resource.url,
                    resource.downloadUrl,
                    resource.size,
                    resource.seeders,
                    resource.leechers,
                    resource.category,
                    resource.promotion,
                    resource.publishTime,
                    resource.hotScore
                );

                return { success: true, isNew: true, id: result.lastInsertRowid };
            }
        } catch (err) {
            console.error('[Hot Resources] Save error:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Get hot resources list
     */
    getHotResources(filters = {}) {
        const db = getDB();

        let query = `
            SELECT hr.*, s.name as site_name
            FROM hot_resources hr
            LEFT JOIN sites s ON hr.site_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.siteId) {
            query += ' AND hr.site_id = ?';
            params.push(filters.siteId);
        }

        if (filters.notified !== undefined) {
            query += ' AND hr.notified = ?';
            params.push(filters.notified ? 1 : 0);
        }

        if (filters.downloaded !== undefined) {
            query += ' AND hr.downloaded = ?';
            params.push(filters.downloaded ? 1 : 0);
        }

        if (filters.minScore) {
            query += ' AND hr.hot_score >= ?';
            params.push(filters.minScore);
        }

        query += ' ORDER BY hr.detected_time DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        return db.prepare(query).all(...params);
    },

    /**
     * Mark resource as notified
     */
    markAsNotified(id) {
        const db = getDB();
        db.prepare('UPDATE hot_resources SET notified = 1 WHERE id = ?').run(id);
    },

    /**
     * Mark resource as downloaded
     */
    markAsDownloaded(id) {
        const db = getDB();
        db.prepare('UPDATE hot_resources SET downloaded = 1, user_action = ? WHERE id = ?').run('downloaded', id);
    },

    /**
     * Update user action
     */
    updateUserAction(id, action) {
        const db = getDB();
        db.prepare('UPDATE hot_resources SET user_action = ? WHERE id = ?').run(action, id);
    },

    /**
     * Cleanup old records (keep last 7 days)
     */
    cleanupOldRecords() {
        const db = getDB();
        const result = db.prepare(`
            DELETE FROM hot_resources 
            WHERE detected_time < datetime('now', '-7 days')
        `).run();

        const enableLogs = appConfig.isLogsEnabled();
        if (enableLogs && result.changes > 0) {
            console.log(`[Hot Resources] Cleaned up ${result.changes} old records`);
        }
    },

    /**
     * Notify about hot resource
     */
    async notifyHotResource(resource, site) {
        try {
            const notificationService = require('./notificationService');

            const sizeGB = (resource.size / (1024 * 1024 * 1024)).toFixed(2);
            const minutesAgo = resource.publishTime ?
                Math.floor((new Date() - new Date(resource.publishTime)) / (1000 * 60)) : 0;

            const message = `🔥 发现热门资源！

【${site.name}】${resource.title}
📊 热度：${resource.hotScore} | 🌱 种子：${resource.seeders} | ⬇️ 下载：${resource.leechers}
💎 促销：${resource.promotion || '无'} | 📦 大小：${sizeGB} GB
⏰ 发布：${minutesAgo}分钟前

快速下载：${resource.downloadUrl}`;

            await notificationService.sendNotification({
                title: '🔥 热门资源提醒',
                message,
                url: resource.url
            });

            this.markAsNotified(resource.id);
        } catch (err) {
            console.error('[Hot Resources] Notification error:', err);
        }
    }
};

module.exports = hotResourcesService;

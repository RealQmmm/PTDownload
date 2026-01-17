const { getDB } = require('../db');
const appConfig = require('../utils/appConfig');
const FormatUtils = require('../utils/formatUtils');

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
        const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_enabled'").get();
        const enabled = enabledRow && (enabledRow.value === 'true' || enabledRow.value === '1');
        const checkInterval = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_check_interval'").get()?.value || '10');
        const autoDownloadRow = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_auto_download'").get();
        const autoDownload = autoDownloadRow && (autoDownloadRow.value === 'true' || autoDownloadRow.value === '1');
        const defaultClient = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_default_client'").get()?.value || '';
        const notifyRow = db.prepare("SELECT value FROM settings WHERE key = 'notify_on_hot_resource'").get();
        const notifyEnabled = notifyRow && (notifyRow.value === 'true' || notifyRow.value === '1' || notifyRow.value !== 'false');
        const searchIntRow = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_enable_search_integration'").get();
        const enableSearchIntegration = searchIntRow && (searchIntRow.value === 'true' || searchIntRow.value === '1');

        const rulesRow = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_rules'").get();
        const rules = rulesRow ? JSON.parse(rulesRow.value) : {};

        return {
            enabled,
            checkInterval,
            autoDownload,
            defaultClient,
            notifyEnabled,
            enableSearchIntegration,
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
        if (config.enableSearchIntegration !== undefined) {
            updateSetting.run('hot_resources_enable_search_integration', config.enableSearchIntegration ? 'true' : 'false');
        }
        if (config.rules !== undefined) {
            updateSetting.run('hot_resources_rules', JSON.stringify(config.rules));
        }

        return this.getConfig();
    },

    /**
     * Calculate hot score for a resource
     * Priority: 1. Promotion (most important) 2. Seeders/Leechers (real popularity) 3. Freshness 4. Size 5. Keywords
     * Returns object with total score and breakdown for debugging
     */
    /**
     * Calculate hot score for a resource (TDI 2.0 Model)
     * Formula: Score = (S_demand + S_speed + S_extra) * P_promotion
     * 核心逻辑：优惠是第一优先级，作为强乘数。
     */
    /**
     * Calculate hot score for a resource (TDI 2.0 Model - Dynamic Ecosystem Version)
     * @param {Object} resource - The resource to score
     * @param {Object} rules - Configuration rules
     * @param {boolean} returnBreakdown - Whether to return scoring details
     * @param {number} siteBaseline - Expected average seeders for this site (Dynamic)
     */
    calculateHotScore(resource, rules, returnBreakdown = false, siteBaseline = 5) {
        let baseScore = 0;
        const breakdown = {
            base: 0,
            demand: 0,
            speed: 0,
            extra: 0,
            multiplier: 1,
            siteBaseline: siteBaseline
        };

        const seeders = parseInt(resource.seeders) || 0;
        const leechers = parseInt(resource.leechers) || 0;

        // ==========================================
        // 1. 基础分计算 (Base Score)
        // ==========================================

        // --- A. 供需得分 (S_demand) ---
        let lsRatio = 0;
        if (seeders > 0) {
            lsRatio = leechers / seeders;
        } else if (leechers > 0) {
            lsRatio = 100;
        }

        breakdown.demand = Math.min(lsRatio, 10) * 3;
        baseScore += breakdown.demand;

        // --- B. 速度/可行性得分 (S_speed) ---
        // 动态逻辑：根据站点基准线缩放
        const baseline = Math.max(2, siteBaseline); // 最低基准不少于2个
        let speedFactor = 0;

        if (seeders === 0) {
            speedFactor = 0;
        } else if (seeders >= baseline && seeders <= baseline * 6) {
            speedFactor = 1.0;  // 处于站点平均水平以上，判定为黄金下载期
        } else if (seeders < baseline) {
            // 在小站，即便是 2 个种子，只要接近基准，得分依然可观
            speedFactor = Math.pow(seeders / baseline, 1.2);
        } else {
            speedFactor = 0.5;  // 种子过多，判定为竞争激烈
        }

        breakdown.speed = 20 * speedFactor;
        baseScore += breakdown.speed;

        // --- C. 时效/体积/其他 (S_extra) ---
        let extraScore = 0;
        if (resource.size) {
            const sizeGB = resource.size / (1024 * 1024 * 1024);
            if (sizeGB >= 30 && sizeGB <= 80) extraScore += 5;
            else if (sizeGB >= 10 && sizeGB < 30) extraScore += 3;
            else if (sizeGB > 80 && sizeGB <= 200) extraScore += 2;
        }

        if (resource.publishTime) {
            const now = new Date();
            const publishDate = new Date(resource.publishTime);
            const minutesAgo = (now - publishDate) / (1000 * 60);
            if (minutesAgo < 60) extraScore += 5;
            else if (minutesAgo < 240) extraScore += 3;
            else if (minutesAgo < 1440) extraScore += 1;
        }

        if (rules.keywords && rules.keywords.length > 0) {
            const title = (resource.title || '').toLowerCase();
            if (rules.keywords.some(k => title.includes(k.toLowerCase()))) extraScore += 5;
        }

        breakdown.extra = extraScore;
        baseScore += extraScore;
        breakdown.base = baseScore;

        // ==========================================
        // 2. 优惠乘数 (Promotion Multiplier)
        // ==========================================
        const promotion = (resource.promotion || '').toLowerCase();
        let multiplier = 0.1;

        if (promotion.includes('2xfree') || promotion.includes('2x free') || promotion.includes('2upfree') || (promotion.includes('2x') && promotion.includes('free'))) {
            multiplier = 3.0;
        } else if (promotion.includes('free')) {
            multiplier = 2.5;
        } else if (promotion.includes('50%') || promotion.includes('2x') || promotion.includes('2up')) {
            multiplier = 1.2;
        }

        breakdown.multiplier = multiplier;

        // ==========================================
        // 3. 最终得分 (带动态惩罚因子)
        // ==========================================
        let totalScore = baseScore * multiplier;

        // --- 核心动态修正：生态位惩罚 (Ecosystem Penalty) ---
        if (!seeders || seeders <= 0) {
            totalScore = 0;
        } else if (leechers <= 0) {
            // 下载数为0惩罚：没有真实下载需求，热度减半甚至更多
            totalScore *= 0.3;
        } else if (seeders < baseline) {
            // 使用平滑函数：(当前种子 / 基准种子) 的 N 次方
            // 在大站(基准30)，1个种子会被惩罚到极低：(1/30)^1.2 = 0.01
            // 在小站(基准3)，1个种子惩罚较轻：(1/3)^1.2 = 0.26
            totalScore *= Math.pow(seeders / baseline, 1.2);
        }

        totalScore = parseFloat(totalScore.toFixed(1));

        // ==========================================
        // 4. 风险评级
        // ==========================================
        let riskLevel = 'NONE';
        let riskLabel = '未知';

        if (totalScore >= 90) { riskLevel = 'GREAT'; riskLabel = '绝佳机会'; }
        else if (totalScore >= 70) { riskLevel = 'SAFE'; riskLabel = '安全理财'; }
        else if (totalScore >= 40) { riskLevel = 'RISKY'; riskLabel = '高能博弈'; }
        else { riskLevel = 'TRASH'; riskLabel = '避坑'; }

        if (returnBreakdown) return { total: totalScore, breakdown, riskLevel, riskLabel };
        return totalScore;
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

            // Check seeders (only if minSeeders > 0 AND seeders data is available)
            // Skip check if seeders is null/undefined (RSS doesn't provide this data)
            if (rules.minSeeders && rules.minSeeders > 0 && resource.seeders != null) {
                if (resource.seeders < rules.minSeeders) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: not enough seeders (${resource.seeders} < ${rules.minSeeders})`);
                    return false;
                }
            }

            // Check leechers (only if minLeechers > 0 AND leechers data is available)
            if (rules.minLeechers && rules.minLeechers > 0 && resource.leechers != null) {
                if (resource.leechers < rules.minLeechers) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: not enough leechers (${resource.leechers} < ${rules.minLeechers})`);
                    return false;
                }
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

            // Check promotions (OPTIONAL filter - resources without promotions can still pass)
            // This is just a preference, not a hard requirement
            // Uncomment the code below if you want to REQUIRE promotions:
            /*
            if (rules.enabledPromotions && rules.enabledPromotions.length > 0) {
                const promotion = (resource.promotion || '').toLowerCase();
                const hasPromotion = rules.enabledPromotions.some(p => promotion.includes(p.toLowerCase()));
                if (!hasPromotion) {
                    if (enableLogs) console.log(`[Hot Resources] Filtered out ${resource.title}: no matching promotion`);
                    return false;
                }
            }
            */
            // Note: Promotion filtering is disabled. Resources will be scored based on all factors,
            // and promotion status will contribute to the score but not filter out resources.

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
     * @param {boolean} manual - If true, bypass the enabled check (for manual triggers)
     */
    async detectHotResources(manual = false) {
        const enableLogs = appConfig.isLogsEnabled();
        const config = this.getConfig();
        const loggerService = require('./loggerService');

        // Only check enabled status for automatic detection, not manual
        if (!manual && !config.enabled) {
            if (enableLogs) console.log('[Hot Resources] Detection is disabled');
            loggerService.log('热门资源检测已禁用', 'info', null, 0, 0);
            return { success: false, message: 'Detection is disabled' };
        }

        try {
            const db = getDB();
            const siteService = require('./siteService');

            // Get all enabled sites (use siteService to ensure decryption)
            const allSites = siteService.getAllSites();
            const sites = allSites.filter(site => site.enabled === 1);

            if (sites.length === 0) {
                if (enableLogs) console.log('[Hot Resources] No enabled sites found');
                loggerService.log('热门资源检测失败：没有已启用的站点', 'error', null, 0, 0);
                return { success: false, message: 'No enabled sites' };
            }

            if (enableLogs) console.log(`[Hot Resources] Starting detection across ${sites.length} sites...`);
            loggerService.log(`开始热门资源检测 (${manual ? '手动' : '自动'})，遍历 ${sites.length} 个站点`, 'info', null, 0, 0);

            // Capture start time for cleanup
            const startTime = new Date();
            // Ensure we have a small buffer or database time sync isn't an issue
            // We'll use the ISO string or simpler comparison in SQL
            // Actually, since saveHotResource updates 'detected_time' to CURRENT_TIMESTAMP, 
            // we can just delete anything with detected_time < startTime

            let totalDetected = 0;
            let totalNew = 0;
            const sitesProcessed = [];
            const newHotResourcesList = [];

            for (const site of sites) {
                try {
                    let items = [];

                    // Special handling for M-Team: Use API if available for better data
                    if (site.name === 'M-Team' && site.api_key) {
                        try {
                            const mteamApi = require('../utils/mteamApi');
                            const requestConfig = {
                                headers: {
                                    ...siteService.getAuthHeaders(site),
                                    'Content-Type': 'application/json'
                                },
                                data: { keyword: '', pageNumber: 1, pageSize: 50, mode: 'NORMAL' },
                                timeout: 15000,
                                site
                            };

                            const response = await mteamApi.request('/api/torrent/search', requestConfig);
                            if (response.data && (response.data.code === 0 || response.data.code === '0') && response.data.data) {
                                const torrents = response.data.data.data || [];
                                items = torrents.map(t => ({
                                    title: t.name,
                                    link: `https://kp.m-team.cc/details.php?id=${t.id}`,
                                    guid: String(t.id),
                                    pubDate: t.createdDate,
                                    size: t.size,
                                    category: t.category,
                                    promotion: this._extractMTeamPromotion(t.status),
                                    seeders: t.status?.seeders || 0,
                                    leechers: t.status?.leechers || 0,
                                    enclosure: {
                                        url: `https://kp.m-team.cc/download.php?id=${t.id}`,
                                        length: t.size
                                    }
                                }));
                            }
                        } catch (apiErr) {
                            if (enableLogs) console.warn(`[Hot Resources] ${site.name}: API failed:`, apiErr.message);
                        }
                    }

                    // Use web parsing for non-M-Team sites or if M-Team API failed
                    if (items.length === 0) {
                        try {
                            const siteParsers = require('../utils/siteParsers');
                            const axios = require('axios');
                            const https = require('https');

                            const searchUrl = new URL('/torrents.php', site.url);
                            searchUrl.searchParams.append('notsticky', '1');

                            const response = await axios.get(searchUrl.toString(), {
                                headers: siteService.getAuthHeaders(site),
                                timeout: 20000,
                                httpsAgent: new https.Agent({
                                    rejectUnauthorized: false,
                                    servername: new URL(site.url).hostname
                                })
                            });

                            if (response.status === 200) {
                                const parsedResults = siteParsers.parse(response.data, site.type, site.url);
                                items = parsedResults.map(r => ({
                                    title: r.name,
                                    link: r.link,
                                    guid: r.id || r.link,
                                    pubDate: r.date,
                                    size: this._parseSizeToBytes(r.size),
                                    category: r.category,
                                    promotion: r.freeType || '',
                                    seeders: r.seeders || 0,
                                    leechers: r.leechers || 0,
                                    enclosure: {
                                        url: r.torrentUrl || r.link,
                                        length: this._parseSizeToBytes(r.size)
                                    }
                                }));
                            }
                        } catch (webErr) {
                            if (enableLogs) console.error(`[Hot Resources] ${site.name}: Web parsing failed:`, webErr.message);
                        }
                    }

                    const resources = items.map(item => ({
                        title: item.title,
                        url: item.link,
                        downloadUrl: item.enclosure?.url || item.link,
                        size: item.enclosure?.length || item.size || 0,
                        seeders: item.seeders || 0,
                        leechers: item.leechers || item.peers || 0,
                        category: item.category,
                        promotion: item.promotion || '',
                        publishTime: item.pubDate,
                        siteId: site.id,
                        siteName: site.name,
                        hash: item.guid || item.link
                    }));

                    const siteSeeders = resources.map(r => r.seeders || 0);
                    const avgSeeders = siteSeeders.reduce((a, b) => a + b, 0) / (siteSeeders.length || 1);
                    const siteBaseline = Math.max(3, Math.min(10, avgSeeders));

                    const filtered = this.applyFilters(resources, config.rules);
                    const scored = filtered.map(resource => {
                        const scoreResult = this.calculateHotScore(resource, config.rules, true, siteBaseline);
                        return {
                            ...resource,
                            hotScore: scoreResult.total,
                            scoreBreakdown: scoreResult.breakdown,
                            riskLevel: scoreResult.riskLevel,
                            riskLabel: scoreResult.riskLabel
                        };
                    });

                    scored.sort((a, b) => b.hotScore - a.hotScore);
                    const hotResources = scored.filter(resource => resource.hotScore >= (config.rules.scoreThreshold || 30));

                    let siteNewCount = 0;
                    for (const resource of hotResources) {
                        const saved = this.saveHotResource(resource);
                        if (saved.isNew) {
                            totalNew++;
                            siteNewCount++;
                            newHotResourcesList.push(resource);

                        }
                    }

                    totalDetected += hotResources.length;
                    sitesProcessed.push(`${site.name}(${siteNewCount}/${hotResources.length})`);

                } catch (siteErr) {
                    console.error(`[Hot Resources] Error processing site ${site.name}:`, siteErr.message);
                    loggerService.log(`热门资源检测错误 [${site.name}]: ${siteErr.message}`, 'error', null, 0, 0);
                }
            }

            // Summary notification (Only for automatic checks)
            if (!manual && config.notifyEnabled && newHotResourcesList.length > 0) {
                this.notifyHotResourcesSummary(newHotResourcesList);
            }

            if (enableLogs) console.log(`[Hot Resources] Detection complete: ${totalDetected} total, ${totalNew} new`);

            const summary = sitesProcessed.length > 0
                ? `检测完成：发现 ${totalDetected} 个热门资源，其中 ${totalNew} 个新资源。站点详情：${sitesProcessed.join(', ')}`
                : `检测完成：未发现符合条件的热门资源`;

            loggerService.log(summary, 'success', null, totalDetected, totalNew);

            // Cleanup: Delete any records that were NOT updated in this run (detected_time < startTime)
            this.cleanupNonUpdatedRecords(startTime);

            return { success: true, totalDetected, totalNew, message: `Detected ${totalNew} new hot resources` };

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

        query += ' ORDER BY hr.hot_score DESC, hr.detected_time DESC';

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
     * Cleanup records that were not updated in the latest run
     * @param {Date} startTime - The start time of the current detection run
     */
    cleanupNonUpdatedRecords(startTime) {
        const db = getDB();
        // SQLite datetime comparison: format date to ISO string (UTC usually, or local depends on setup)
        // Since CURRENT_TIMESTAMP is UTC, we should ensure we match.
        // But getDB usually handles dates or we used CURRENT_TIMESTAMP.
        // Safest: Use the exact string format SQLite expects or use a relative time if we trust system clock match.

        // Let's use a slightly loose buffer (e.g. 1 second before start)
        const threshold = startTime.toISOString().replace('T', ' ').split('.')[0];

        const result = db.prepare(`
            DELETE FROM hot_resources 
            WHERE detected_time < ?
        `).run(threshold);

        const enableLogs = appConfig.isLogsEnabled();
        if (enableLogs && result.changes > 0) {
            console.log(`[Hot Resources] Cleaned up ${result.changes} non-updated records (retention policy: latest only)`);
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

            await notificationService.send('🔥 热门资源提醒', message);

            this.markAsNotified(resource.id);
        } catch (err) {
            console.error('[Hot Resources] Notification error:', err);
        }
    },

    /**
     * Extract promotion information from title and description
     */
    _extractPromotion(title, description) {
        const titleLower = (title || '').toLowerCase();
        const descLower = (description || '').toLowerCase();

        // Check for various promotion markers
        // Check for 2xFree (Highest priority)
        if (titleLower.includes('2xfree') || titleLower.includes('2x free') ||
            titleLower.includes('twoupfree') || descLower.includes('pro_2xfree') ||
            (titleLower.includes('2x') && titleLower.includes('free')) ||
            (titleLower.includes('2倍') && titleLower.includes('免费'))) {
            return '2xFree';
        }

        // Check for Free
        if (titleLower.includes('[free]') || titleLower.includes('【free】') ||
            titleLower.includes('keys="free"') || descLower.includes('class="pro_free"') ||
            descLower.includes('>free<') || titleLower.includes('免费')) {
            return 'Free';
        }
        if (titleLower.includes('[50%]') || titleLower.includes('【50%】') ||
            descLower.includes('class="pro_50"') || descLower.includes('50%')) {
            return '50%';
        }
        if (titleLower.includes('[30%]') || titleLower.includes('【30%】') ||
            descLower.includes('class="pro_30"') || descLower.includes('30%')) {
            return '30%';
        }
        if (titleLower.includes('[2x]') || titleLower.includes('【2x】') ||
            titleLower.includes('2x') || titleLower.includes('2倍') ||
            titleLower.includes('2up') || titleLower.includes('twoup') ||
            descLower.includes('class="pro_2x"') || descLower.includes('class="pro_2up"') ||
            descLower.includes('class="pro_twoup"')) {
            return '2x';
        }

        return '';
    },

    /**
     * Notify summary of newly discovered hot resources
     * @param {Array} newResources - List of newly discovered hot resource objects
     */
    async notifyHotResourcesSummary(newResources) {
        if (!newResources || newResources.length === 0) return;

        try {
            const notificationService = require('./notificationService');

            // Count by risk level and site
            const counts = {
                GREAT: 0,
                SAFE: 0,
                RISKY: 0
            };
            const siteCounts = {};

            newResources.forEach(r => {
                if (counts[r.riskLevel] !== undefined) {
                    counts[r.riskLevel]++;
                }
                siteCounts[r.siteName] = (siteCounts[r.siteName] || 0) + 1;
            });

            // Build message
            let message = `🔥 发现 ${newResources.length} 个新热门资源！\n\n`;

            if (counts.GREAT > 0) message += `💎 绝佳机会：${counts.GREAT} 个\n`;
            if (counts.SAFE > 0) message += `✅ 安全理财：${counts.SAFE} 个\n`;
            if (counts.RISKY > 0) message += `⚠️ 高能博弈：${counts.RISKY} 个\n`;

            message += `\n🏰 站点详情：\n`;
            Object.entries(siteCounts).forEach(([siteName, count]) => {
                message += `• ${siteName}: ${count} 个\n`;
            });
            message += `\n请登录平台查看更多详情。`;

            await notificationService.send('🔥 热门资源发现', message);

            // Mark all as notified in DB
            const db = getDB();
            const updateStmt = db.prepare('UPDATE hot_resources SET notified = 1 WHERE resource_hash = ?');
            for (const r of newResources) {
                updateStmt.run(r.hash);
            }
        } catch (err) {
            console.error('[Hot Resources] Summary notification error:', err);
        }
    },
    /**
     * Extract promotion information from M-Team API status object
     */
    _extractMTeamPromotion(status) {
        if (!status) return '';

        const discount = status.discount || '';
        const twoXFree = status.twoXFree || false;

        if (twoXFree) {
            return '2xFree';
        }
        if (discount === 'FREE') {
            return 'Free';
        }
        if (discount === '_50pctDown') {
            return '50%';
        }
        if (discount === '_30pctDown') {
            return '30%';
        }

        return '';
    },

    /**
     * Parse size string (e.g., "25.6 GB", "1.5 TB") to bytes
     */
    _parseSizeToBytes(sizeStr) {
        if (!sizeStr || sizeStr === 'N/A') return 0;

        const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B)$/i);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();

        const multipliers = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
        };

        return Math.floor(value * (multipliers[unit] || 1));
    }
};

module.exports = hotResourcesService;

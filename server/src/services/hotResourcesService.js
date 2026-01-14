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
    calculateHotScore(resource, rules, returnBreakdown = false) {
        let baseScore = 0;
        const breakdown = {
            base: 0,
            demand: 0,
            speed: 0,
            extra: 0,
            multiplier: 1
        };

        // ==========================================
        // 1. 基础分计算 (Base Score) - 满分约 60分
        // ==========================================

        const seeders = parseInt(resource.seeders) || 0;
        const leechers = parseInt(resource.leechers) || 0;

        // --- A. 供需得分 (S_demand) ---
        // 权重 30分。采用 min(L/S, 10) * 3
        let lsRatio = 0;
        if (seeders > 0) {
            lsRatio = leechers / seeders;
        } else if (leechers > 0) {
            lsRatio = 100; // 无种有下，视为极度稀缺
        }

        breakdown.demand = Math.min(lsRatio, 10) * 3;
        baseScore += breakdown.demand;

        // --- B. 速度/可行性得分 (S_speed) ---
        // 权重 20分。根据种子数区间评分
        let speedFactor = 0;
        if (seeders < 5) {
            speedFactor = 0.2; // 太少，可能断种或慢
        } else if (seeders >= 5 && seeders <= 30) {
            speedFactor = 1.0; // 黄金区间，肉多狼少
        } else if (seeders > 30 && seeders <= 100) {
            speedFactor = 0.8; // 竞争稍微有点大
        } else {
            speedFactor = 0.5; // 种子太多，抢不到上传
        }

        breakdown.speed = 20 * speedFactor;
        baseScore += breakdown.speed;

        // --- C. 时效/体积/其他 (S_extra) ---
        // 权重 10分
        let extraScore = 0;

        // 体积 (5分): 30GB-80GB 最优
        if (resource.size) {
            const sizeGB = resource.size / (1024 * 1024 * 1024);
            if (sizeGB >= 30 && sizeGB <= 80) {
                extraScore += 5;
            } else if (sizeGB >= 10 && sizeGB < 30) {
                extraScore += 3;
            } else if (sizeGB > 80 && sizeGB <= 200) {
                extraScore += 2;
            }
        }

        // 时效 (5分)
        if (resource.publishTime) {
            const now = new Date();
            const publishDate = new Date(resource.publishTime);
            const minutesAgo = (now - publishDate) / (1000 * 60);

            if (minutesAgo < 60) extraScore += 5;       // 1小时内
            else if (minutesAgo < 240) extraScore += 3; // 4小时内
            else if (minutesAgo < 1440) extraScore += 1; // 24小时内
        }

        // 关键词加分 (整合进 Extra)
        if (rules.keywords && rules.keywords.length > 0) {
            const title = (resource.title || '').toLowerCase();
            const matchedKeywords = rules.keywords.filter(k => title.includes(k.toLowerCase()));
            if (matchedKeywords.length > 0) {
                extraScore += 5; // 命中关键词额外加分
            }
        }

        breakdown.extra = extraScore;
        baseScore += extraScore;
        breakdown.base = baseScore;

        // ==========================================
        // 2. 优惠乘数 (Promotion Multiplier)
        // ==========================================

        const promotion = (resource.promotion || '').toLowerCase();
        let multiplier = 0.1; // 默认极低，过滤普通资源

        if (promotion.includes('2xfree') || promotion.includes('2x free')) {
            multiplier = 3.0; // 神作
        } else if (promotion.includes('free')) {
            multiplier = 2.5; // 核心目标
        } else if (promotion.includes('50%') || promotion.includes('2x')) {
            multiplier = 1.2; // 勉强能下
        } else if (rules.enabledPromotions === false) {
            // 如果用户关闭了促销过滤（虽然现在是乘数逻辑），
            // 某种特殊配置下可能允许普通资源
            // 但按 TDI 2.0 逻辑，这里维持 0.1 即可
        }

        breakdown.multiplier = multiplier;

        // ==========================================
        // 3. 最终得分
        // ==========================================

        let totalScore = baseScore * multiplier;
        totalScore = parseFloat(totalScore.toFixed(1));

        // ==========================================
        // 4. 风险评级 (Risk Level)
        // ==========================================
        let riskLevel = 'NONE';
        let riskLabel = '未知';

        if (totalScore >= 90) {
            riskLevel = 'GREAT';
            riskLabel = '绝佳机会'; // 🚀
        } else if (totalScore >= 70) {
            riskLevel = 'SAFE';
            riskLabel = '安全理财'; // 💰
        } else if (totalScore >= 40) {
            riskLevel = 'RISKY';
            riskLabel = '高能博弈'; // 🎲
        } else {
            riskLevel = 'TRASH';
            riskLabel = '避坑'; // 🗑️
        }

        if (returnBreakdown) {
            return { total: totalScore, breakdown, riskLevel, riskLabel };
        }
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
            const rssService = require('./rssService');
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

            let totalDetected = 0;
            let totalNew = 0;
            const sitesProcessed = [];

            for (const site of sites) {
                try {
                    let items = [];

                    // Special handling for M-Team: Use API if available for better data
                    if (site.name === 'M-Team' && site.api_key) {
                        if (enableLogs) {
                            console.log(`[Hot Resources] ${site.name}: Using API for accurate seeder data`);
                            console.log(`[Hot Resources] ${site.name}: API Key info - Length: ${site.api_key.length}, First 4: ${site.api_key.substring(0, 4)}, Last 4: ${site.api_key.substring(site.api_key.length - 4)}`);
                        }

                        try {
                            const mteamApi = require('../utils/mteamApi');

                            const requestConfig = {
                                headers: {
                                    ...siteService.getAuthHeaders(site),
                                    'Content-Type': 'application/json'
                                },
                                data: {
                                    keyword: '',
                                    pageNumber: 1,
                                    pageSize: 50,
                                    mode: 'NORMAL'
                                },
                                timeout: 15000,
                                site
                            };

                            if (enableLogs) {
                                console.log(`[Hot Resources] ${site.name}: API request config:`, {
                                    headers: { ...requestConfig.headers, 'x-api-key': requestConfig.headers['x-api-key'] ? '***' : undefined },
                                    data: requestConfig.data
                                });
                            }

                            const response = await mteamApi.request('/api/torrent/search', requestConfig);

                            if (enableLogs) console.log(`[Hot Resources] ${site.name}: API response code:`, response.data?.code);

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

                                if (enableLogs) console.log(`[Hot Resources] ${site.name}: Fetched ${items.length} items from API (with seeder data)`);
                            } else {
                                if (enableLogs) console.warn(`[Hot Resources] ${site.name}: API returned unexpected response:`, response.data);
                            }
                        } catch (apiErr) {
                            if (enableLogs) console.warn(`[Hot Resources] ${site.name}: API failed, falling back to web parse:`, apiErr.message);
                        }
                    }

                    // Use web parsing for non-M-Team sites or if M-Team API failed
                    if (items.length === 0) {
                        if (enableLogs) console.log(`[Hot Resources] ${site.name}: Using web parsing for accurate seeder/leecher data`);

                        try {
                            const searchService = require('./searchService');
                            const siteParsers = require('../utils/siteParsers');
                            const axios = require('axios');
                            const https = require('https');

                            // Fetch recent torrents from the site (first page only for hot resources)
                            const searchUrl = new URL('/torrents.php', site.url);
                            searchUrl.searchParams.append('notsticky', '1');

                            const headers = siteService.getAuthHeaders(site);
                            const response = await axios.get(searchUrl.toString(), {
                                headers,
                                timeout: 20000,
                                httpsAgent: new https.Agent({
                                    rejectUnauthorized: false,
                                    servername: new URL(site.url).hostname
                                })
                            });

                            if (response.status === 200) {
                                // Parse the HTML to extract torrent data with seeders/leechers
                                const parsedResults = siteParsers.parse(response.data, site.type, site.url);

                                // Convert parsed results to items format
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

                                if (enableLogs) console.log(`[Hot Resources] ${site.name}: Fetched ${items.length} items from web parsing (with accurate seeder/leecher data)`);
                            }
                        } catch (webErr) {
                            if (enableLogs) console.error(`[Hot Resources] ${site.name}: Web parsing failed:`, webErr.message);
                        }
                    } // End of web parsing if block

                    // Convert items to resource format (works for both API and RSS)
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

                    // Apply filters
                    const filtered = this.applyFilters(resources, config.rules);
                    if (enableLogs) console.log(`[Hot Resources] ${site.name}: ${filtered.length}/${resources.length} passed filters`);

                    // Calculate scores and filter by threshold
                    const scored = filtered.map(resource => {
                        const scoreResult = this.calculateHotScore(resource, config.rules, true);
                        return {
                            ...resource,
                            hotScore: scoreResult.total,
                            scoreBreakdown: scoreResult.breakdown,
                            riskLevel: scoreResult.riskLevel,
                            riskLabel: scoreResult.riskLabel
                        };
                    });

                    // Sort by score for logging
                    scored.sort((a, b) => b.hotScore - a.hotScore);

                    // Log top 5 scored resources for debugging
                    if (enableLogs && scored.length > 0) {
                        console.log(`[Hot Resources] ${site.name}: Top scored resources:`);
                        scored.slice(0, 5).forEach((r, idx) => {
                            const sizeGB = r.size ? (r.size / (1024 * 1024 * 1024)).toFixed(2) : '0';
                            const age = r.publishTime ? Math.floor((new Date() - new Date(r.publishTime)) / 60000) : '?';
                            console.log(`  ${idx + 1}. [${r.riskLabel}] [Total: ${r.hotScore}] ${r.title.substring(0, 50)}...`);
                            console.log(`     📊 TDI 2.0: (Base ${r.scoreBreakdown.base.toFixed(1)}) x Multi (${r.scoreBreakdown.multiplier}) | Demand(${r.scoreBreakdown.demand.toFixed(1)}) + Speed(${r.scoreBreakdown.speed.toFixed(1)}) + Extra(${r.scoreBreakdown.extra})`);
                            console.log(`     📦 Data: Promo=${r.promotion || 'None'}, Size=${sizeGB}GB, Age=${age}min, Seeds=${r.seeders}, Leechers=${r.leechers}`);
                        });
                    }

                    const hotResources = scored.filter(resource => resource.hotScore >= (config.rules.scoreThreshold || 30));

                    if (enableLogs) {
                        console.log(`[Hot Resources] ${site.name}: ${hotResources.length}/${scored.length} resources passed threshold (${config.rules.scoreThreshold || 30})`);
                    }

                    let siteNewCount = 0;
                    // Save to database
                    for (const resource of hotResources) {
                        const saved = this.saveHotResource(resource);
                        if (saved.isNew) {
                            totalNew++;
                            siteNewCount++;

                            // Trigger notification if enabled
                            if (config.notifyEnabled) {
                                this.notifyHotResource(resource, site);
                            }
                        }
                    }

                    totalDetected += hotResources.length;
                    sitesProcessed.push(`${site.name}(${siteNewCount}/${hotResources.length})`);

                } catch (siteErr) {
                    console.error(`[Hot Resources] Error processing site ${site.name}:`, siteErr.message);
                    loggerService.log(`热门资源检测错误 [${site.name}]: ${siteErr.message}`, 'error', null, 0, 0);
                }
            }

            if (enableLogs) console.log(`[Hot Resources] Detection complete: ${totalDetected} total, ${totalNew} new`);

            const summary = sitesProcessed.length > 0
                ? `检测完成：发现 ${totalDetected} 个热门资源，其中 ${totalNew} 个新资源。站点详情：${sitesProcessed.join(', ')}`
                : `检测完成：未发现符合条件的热门资源`;

            loggerService.log(summary, 'success', null, totalDetected, totalNew);

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
    },

    /**
     * Extract promotion information from title and description
     */
    _extractPromotion(title, description) {
        const titleLower = (title || '').toLowerCase();
        const descLower = (description || '').toLowerCase();

        // Check for various promotion markers
        if (titleLower.includes('[2xfree]') || titleLower.includes('【2xfree】') ||
            descLower.includes('class="pro_2xfree"') || descLower.includes('2xfree')) {
            return '2xFree';
        }
        if (titleLower.includes('[free]') || titleLower.includes('【free】') ||
            titleLower.includes('keys="free"') || descLower.includes('class="pro_free"') ||
            descLower.includes('>free<')) {
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

        return '';
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

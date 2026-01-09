const { getDB } = require('../db');
const timeUtils = require('../utils/timeUtils');
const axios = require('axios');
const loggerService = require('./loggerService');
const notificationService = require('./notificationService');
const cryptoUtils = require('../utils/cryptoUtils');
const appConfig = require('../utils/appConfig');

class SiteService {
    constructor() {
        this.db = null;
    }

    _getDB() {
        if (!this.db) {
            this.db = getDB();
        }
        return this.db;
    }



    getAllSites() {
        const db = this._getDB();
        const sites = db.prepare('SELECT * FROM sites ORDER BY enabled DESC, created_at DESC').all();

        // Decrypt cookies and check for migration
        let migrationNeeded = false;
        const decryptedSites = sites.map(site => {
            if (site.cookies && !cryptoUtils.isEncrypted(site.cookies)) {
                // Determine if migration is needed (silent update logic moved to separate method or here)
                // We'll migrate on-the-fly or have a dedicated migration call? 
                // Let's migrate immediately if plaintext found to ensure security
                try {
                    const encrypted = cryptoUtils.encrypt(site.cookies);
                    db.prepare('UPDATE sites SET cookies = ? WHERE id = ?').run(encrypted, site.id);
                    console.log(`[Security] Migrated plaintext cookie for site: ${site.name}`);
                    site.cookies = encrypted; // Update object to be consistent
                } catch (err) {
                    console.error('Migration failed for site:', site.id);
                }
            }

            // Return decrypted for application use
            return {
                ...site,
                cookies: cryptoUtils.decrypt(site.cookies),
                api_key: cryptoUtils.decrypt(site.api_key)
            };
        });

        return decryptedSites;
    }

    getSiteById(id) {
        const db = this._getDB();
        const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
        if (site) {
            if (site.cookies) site.cookies = cryptoUtils.decrypt(site.cookies);
            if (site.api_key) site.api_key = cryptoUtils.decrypt(site.api_key);
        }
        return site;
    }

    createSite(site) {
        const db = this._getDB();
        const { name, url, cookies, api_key, default_rss_url, type, enabled = 1, auto_checkin = 0 } = site;

        const encryptedCookies = cryptoUtils.encrypt(cookies);
        const encryptedApiKey = cryptoUtils.encrypt(api_key);

        const info = db.prepare(
            'INSERT INTO sites (name, url, cookies, api_key, default_rss_url, type, enabled, auto_checkin, cookie_status, last_checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)'
        ).run(name, url, encryptedCookies, encryptedApiKey, default_rss_url || null, type, enabled, auto_checkin);
        return info.lastInsertRowid;
    }

    updateSite(id, site) {
        const db = this._getDB();
        const { name, url, cookies, api_key, default_rss_url, type, enabled, auto_checkin, cookie_status } = site;

        // If cookies or api_key are changed, reset cookie_status to 0 (assume ok until checked)
        // Note: we must compare against current DB value (decrypted) or handle logic carefully.
        // Since 'site' comes from UI (plaintext), and we want to encrypt.

        const oldSite = this.getSiteById(id); // Returns decrypted
        const authChanged = cookies !== oldSite.cookies || api_key !== oldSite.api_key;
        const status = authChanged ? 0 : (cookie_status ?? oldSite.cookie_status);

        // Encrypt new values
        const encryptedCookies = cryptoUtils.encrypt(cookies);
        const encryptedApiKey = cryptoUtils.encrypt(api_key);

        return db.prepare(
            'UPDATE sites SET name = ?, url = ?, cookies = ?, api_key = ?, default_rss_url = ?, type = ?, enabled = ?, auto_checkin = ?, cookie_status = ? WHERE id = ?'
        ).run(name, url, encryptedCookies, encryptedApiKey, default_rss_url || null, type, enabled, auto_checkin, status, id);
    }

    deleteSite(id) {
        const db = this._getDB();

        // First delete related records to avoid foreign key constraint errors
        try {
            // Delete related site_daily_stats (heatmap data)
            db.prepare('DELETE FROM site_daily_stats WHERE site_id = ?').run(id);

            // Delete related rss_sources
            db.prepare('DELETE FROM rss_sources WHERE site_id = ?').run(id);

            // Delete related tasks (this will cascade to task_history and task_logs via app logic if needed)
            db.prepare('DELETE FROM tasks WHERE site_id = ?').run(id);

            // Finally delete the site itself
            return db.prepare('DELETE FROM sites WHERE id = ?').run(id);
        } catch (err) {
            console.error('Failed to delete site:', err.message);
            throw err;
        }
    }

    toggleSite(id, enabled) {
        const db = this._getDB();
        return db.prepare('UPDATE sites SET enabled = ? WHERE id = ?').run(enabled, id);
    }

    updateSiteIcon(id, iconUrl) {
        const db = this._getDB();
        return db.prepare('UPDATE sites SET site_icon = ? WHERE id = ?').run(iconUrl, id);
    }

    /**
     * 构建站点请求的认证头
     * M-Team 等站点使用 API Key 时，通过 x-api-key header 传递
     * 其他站点继续使用 Cookie
     * @param {object} site - 站点对象
     * @returns {object} - 请求头对象
     */
    getAuthHeaders(site) {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        // 如果有 API Key，优先使用 API Key（M-Team 等支持 API 的站点）
        if (site.api_key) {
            headers['x-api-key'] = site.api_key;
        }

        // 如果有 Cookie，也添加（某些站点可能同时需要）
        if (site.cookies) {
            headers['Cookie'] = site.cookies;
        }

        return headers;
    }

    _isMTeamV2(site) {
        return site && site.url && (site.url.includes('m-team.cc') || site.url.includes('m-team.io')) && site.api_key;
    }

    async _refreshMTeamV2Stats(id, site) {
        const db = this._getDB();
        const FormatUtils = require('../utils/formatUtils');
        const enableLogs = appConfig.isLogsEnabled();

        try {
            // M-Team V2 API 必须在 api.m-team.cc 域名下调用
            const apiUrl = 'https://api.m-team.cc/api/member/profile';

            if (enableLogs) console.log(`[M-Team V2] Calling API: ${apiUrl}`);

            const https = require('https');
            const response = await axios.post(apiUrl, {}, {
                headers: {
                    ...this.getAuthHeaders(site),
                    'Content-Type': 'application/json'
                },
                timeout: 15000,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                    servername: 'api.m-team.cc'
                })
            });

            if (enableLogs) {
                console.log(`[M-Team V2] Full Data for ${site.name}:`, JSON.stringify(response.data));
            }

            const code = response.data?.code;
            if (response.data && (code === 0 || code === '0') && response.data.data) {
                const data = response.data.data;
                const mCount = data.memberCount || {};

                // M-Team V2 Role Mapping
                const roleMap = {
                    '1': 'User',
                    '2': 'Power User',
                    '3': 'Elite User',
                    '4': 'Crazy User',
                    '5': 'Insane User',
                    '6': 'Veteran User',
                    '7': 'Extreme User',
                    '8': 'Ultimate User',
                    '9': 'Nexus Master'
                };

                const stats = {
                    username: data.username,
                    upload: FormatUtils.formatBytes(mCount.uploaded || 0),
                    download: FormatUtils.formatBytes(mCount.downloaded || 0),
                    ratio: String(mCount.shareRate || '0.0'),
                    bonus: String(mCount.bonus || '0'),
                    level: data.roleName || roleMap[data.role] || String(data.role || ''),
                    isCheckedIn: false
                };

                if (enableLogs) {
                    console.log(`[M-Team V2] Parsed Stats for ${site.name}:`, JSON.stringify(stats));
                    console.log(`[M-Team V2] Raw Values: Up=${mCount.uploaded}, Down=${mCount.downloaded}, Role=${data.role}`);
                }

                const now = timeUtils.getLocalISOString();
                try {
                    this._updateHeatmapData(id, site.upload, stats.upload, site.download, stats.download);

                    db.prepare('UPDATE sites SET username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ?, cookie_status = 0, last_checked_at = ? WHERE id = ?')
                        .run(stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now, now, id);

                    if (enableLogs) console.log(`[M-Team V2] Database updated for ${site.name}`);
                    loggerService.log(`站点 ${site.name} 状态刷新成功: 上传=${stats.upload}, 下载=${stats.download}, 分享率=${stats.ratio}, 魔力值=${stats.bonus}, 等级=${stats.level}`, 'info');
                    return stats;
                } catch (dbErr) {
                    console.error(`[M-Team V2] DB Update error:`, dbErr.message);
                    throw dbErr;
                }
            }
            return null;
        } catch (err) {
            const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
            console.error(`[M-Team V2] Refresh failed for ${site.name}:`, errorMsg);
            return null;
        }
    }


    _updateHeatmapData(siteId, currentUploadStr, newUploadStr, currentDownloadStr = null, newDownloadStr = null) {
        const FormatUtils = require('../utils/formatUtils');
        const db = this._getDB();
        const today = timeUtils.getLocalDateString();

        // 自动迁移：确保 downloaded_bytes 列存在
        try {
            const columns = db.prepare('PRAGMA table_info(site_daily_stats)').all();
            if (!columns.some(c => c.name === 'downloaded_bytes')) {
                console.log('[Heatmap] Auto-migrating: Adding downloaded_bytes column...');
                db.prepare('ALTER TABLE site_daily_stats ADD COLUMN downloaded_bytes INTEGER DEFAULT 0').run();
                console.log('[Heatmap] Auto-migration complete: downloaded_bytes column added');
            }
        } catch (migErr) {
            console.error('[Heatmap] Migration check failed:', migErr.message);
        }

        // 获取站点信息以判断是否是新添加的
        const site = db.prepare('SELECT created_at FROM sites WHERE id = ?').get(siteId);
        const isNewSiteToday = site && site.created_at && new Date(site.created_at).toLocaleDateString() === new Date().toLocaleDateString();

        // 处理上传增量
        const currentUpBytes = FormatUtils.parseSizeToBytes(currentUploadStr);
        const newUpBytes = FormatUtils.parseSizeToBytes(newUploadStr);
        let upDelta = 0;
        if (newUpBytes > currentUpBytes) {
            if (currentUpBytes > 0) {
                upDelta = newUpBytes - currentUpBytes;
            } else if (isNewSiteToday) {
                // 如果是今天新加的站点，第一笔数据也计入今日增量
                upDelta = newUpBytes;
            }
        }

        // 处理下载增量
        let downDelta = 0;
        if (newDownloadStr) {
            const currentDownBytes = FormatUtils.parseSizeToBytes(currentDownloadStr);
            const newDownBytes = FormatUtils.parseSizeToBytes(newDownloadStr);
            if (newDownBytes > currentDownBytes) {
                if (currentDownBytes > 0) {
                    downDelta = newDownBytes - currentDownBytes;
                } else if (isNewSiteToday) {
                    downDelta = newDownBytes;
                }
            }
        }

        if (upDelta > 0 || downDelta > 0) {
            try {
                db.prepare(`
                    INSERT INTO site_daily_stats (site_id, date, uploaded_bytes, downloaded_bytes)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(site_id, date) DO UPDATE SET
                    uploaded_bytes = uploaded_bytes + ?,
                    downloaded_bytes = downloaded_bytes + ?
                `).run(siteId, today, upDelta, downDelta, upDelta, downDelta);

                if (upDelta > 0) console.log(`[Heatmap] Site ${siteId} upload delta: ${upDelta} bytes`);
                if (downDelta > 0) console.log(`[Heatmap] Site ${siteId} download delta: ${downDelta} bytes`);
            } catch (sqlErr) {
                // 如果还是失败，降级到只更新 uploaded_bytes（兼容旧表结构）
                console.warn('[Heatmap] Full update failed, trying fallback (upload only):', sqlErr.message);
                try {
                    db.prepare(`
                        INSERT INTO site_daily_stats (site_id, date, uploaded_bytes)
                        VALUES (?, ?, ?)
                        ON CONFLICT(site_id, date) DO UPDATE SET
                        uploaded_bytes = uploaded_bytes + ?
                    `).run(siteId, today, upDelta, upDelta);
                } catch (fallbackErr) {
                    console.error('[Heatmap] Fallback also failed:', fallbackErr.message);
                }
            }
        }
    }

    async checkCookie(id) {
        const site = this.getSiteById(id);
        if (!site || !site.url || site.type === 'Mock') return true;

        if (this._isMTeamV2(site)) {
            const stats = await this._refreshMTeamV2Stats(id, site);
            return !!stats;
        }

        const db = this._getDB();
        const enableLogs = appConfig.isLogsEnabled();

        try {
            if (enableLogs) console.log(`Checking auth for site: ${site.name} (${site.url})`);
            const response = await axios.get(site.url, {
                headers: this.getAuthHeaders(site),
                timeout: 10000,
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });
            const html = response.data;

            const isLogin = html.includes('login.php') ||
                html.includes('id="login"') ||
                html.includes('name="login"') ||
                (html.includes('登录') && !html.includes('退出')) ||
                (html.includes('Login') && !html.includes('Logout'));

            const status = isLogin ? 1 : 0;
            const now = timeUtils.getLocalISOString();

            if (status === 0) {
                // Cookie is valid, parse user stats
                const siteParsers = require('../utils/siteParsers');
                const stats = siteParsers.parseUserStats(html, site.type);

                if (stats) {
                    // Update heatmap if there's an increase (both upload and download)
                    this._updateHeatmapData(id, site.upload, stats.upload, site.download, stats.download);

                    let sql = 'UPDATE sites SET cookie_status = 0, last_checked_at = ?, username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ?';
                    const params = [now, stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now];

                    if (stats.isCheckedIn) {
                        sql += ', last_checkin_at = ?';
                        params.push(now);
                        if (enableLogs) console.log(`[Checkin] ${site.name} detected as already checked in today`);
                    } else {
                        // If not checked in today, clear last_checkin_at if it's not today
                        const lastCheckinDate = site.last_checkin_at ? new Date(site.last_checkin_at).toDateString() : null;
                        const todayDate = new Date().toDateString();
                        if (lastCheckinDate && lastCheckinDate !== todayDate) {
                            sql += ', last_checkin_at = NULL';
                            if (enableLogs) console.log(`[Checkin] ${site.name} clearing outdated checkin record`);
                        }
                    }

                    sql += ' WHERE id = ?';
                    params.push(id);
                    db.prepare(sql).run(...params);
                    loggerService.log(`站点 ${site.name} 状态检查成功: 上传=${stats.upload}, 下载=${stats.download}, 分享率=${stats.ratio}, 魔力值=${stats.bonus}, 等级=${stats.level}`, 'info');
                } else {
                    db.prepare('UPDATE sites SET cookie_status = 0, last_checked_at = ? WHERE id = ?')
                        .run(now, id);
                }
                if (enableLogs) console.log(`[Status] ${site.name} cookie is valid`);
            } else {
                // Only notify if status changed from valid (0) to invalid (1) to avoid spam
                if (site.cookie_status === 0) {
                    notificationService.notifyCookieExpiration(site.name);
                }

                db.prepare('UPDATE sites SET cookie_status = 1, last_checked_at = ? WHERE id = ?')
                    .run(now, id);
                loggerService.log(`站点 ${site.name} Cookie 已失效，请及时处理`, 'error');
            }

            return status === 0;
        } catch (err) {
            if (enableLogs) console.error(`Cookie check failed for ${site.name}:`, err.message);
            // Don't mark as invalid on network errors, only on 4xx/5xx or login redirects
            return false;
        }
    }

    async refreshUserStats(id) {
        const site = this.getSiteById(id);
        if (!site || !site.url) return null;

        const db = this._getDB();
        const enableLogs = appConfig.isLogsEnabled();

        const siteParsers = require('../utils/siteParsers');

        try {
            if (enableLogs) console.log(`Refreshing user stats for site: ${site.name}`);

            if (this._isMTeamV2(site)) {
                return await this._refreshMTeamV2Stats(id, site);
            }

            let html = '';

            if (site.type === 'Mock') {
                const stats = siteParsers.parseUserStats('', 'Mock');
                const now = timeUtils.getLocalISOString();
                db.prepare('UPDATE sites SET username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ?, cookie_status = 0 WHERE id = ?')
                    .run(stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now, id);
                return stats;
            }

            const response = await axios.get(site.url, {
                headers: this.getAuthHeaders(site),
                timeout: 10000,
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });

            html = response.data;

            // Check if actually logged in
            const isLogin = html.includes('login.php') ||
                html.includes('id="login"') ||
                html.includes('name="login"') ||
                (html.includes('登录') && !html.includes('退出')) ||
                (html.includes('Login') && !html.includes('Logout'));

            if (isLogin) {
                // Only notify if status changed from valid (0) to invalid (1)
                if (site.cookie_status === 0) {
                    notificationService.notifyCookieExpiration(site.name);
                }

                db.prepare('UPDATE sites SET cookie_status = 1, last_checked_at = ? WHERE id = ?')
                    .run(timeUtils.getLocalISOString(), id);
                return null;
            }

            const stats = siteParsers.parseUserStats(html, site.type);

            if (stats) {
                const now = timeUtils.getLocalISOString();

                // Update heatmap if there's an increase (both upload and download)
                this._updateHeatmapData(id, site.upload, stats.upload, site.download, stats.download);

                let sql = 'UPDATE sites SET cookie_status = 0, username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ?, last_checked_at = ?';
                const params = [stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now, now];

                if (stats.isCheckedIn) {
                    sql += ', last_checkin_at = ?';
                    params.push(now);
                    if (enableLogs) console.log(`[Checkin] ${site.name} detected as already checked in (via refresh)`);
                } else {
                    // If not checked in today, clear last_checkin_at if it's not today
                    const lastCheckinDate = site.last_checkin_at ? new Date(site.last_checkin_at).toDateString() : null;
                    const todayDate = new Date().toDateString();
                    if (lastCheckinDate && lastCheckinDate !== todayDate) {
                        sql += ', last_checkin_at = NULL';
                        if (enableLogs) console.log(`[Checkin] ${site.name} clearing outdated checkin record (via refresh)`);
                    }
                }

                sql += ' WHERE id = ?';
                params.push(id);
                db.prepare(sql).run(...params);

                loggerService.log(`站点 ${site.name} 状态刷新成功: 上传=${stats.upload}, 下载=${stats.download}, 分享率=${stats.ratio}, 魔力值=${stats.bonus}, 等级=${stats.level}`, 'info');

                return stats;
            }
            loggerService.log(`站点 ${site.name} 状态解析失败，可能站点模板已更新`, 'error');
            return null;
        } catch (err) {
            if (enableLogs) console.error(`Failed to refresh stats for ${site.name}:`, err.message);
            loggerService.log(`站点 ${site.name} 状态刷新失败: ${err.message}`, 'error');
            return null;
        }
    }

    async getSiteHeatmap(id) {
        const db = this._getDB();
        return db.prepare("SELECT date, uploaded_bytes FROM site_daily_stats WHERE site_id = ? AND date > date('now', '-90 days') ORDER BY date ASC").all(id);
    }

    async checkAllCookies() {
        const sites = this.getAllSites();
        const results = [];
        for (const site of sites) {
            if (site.enabled && site.type !== 'Mock') {
                results.push(await this.checkCookie(site.id));
            }
        }
        return results;
    }

    async refreshAllUserStats() {
        const sites = this.getAllSites();
        const results = [];
        for (const site of sites) {
            if (site.enabled) {
                results.push(await this.refreshUserStats(site.id));
            }
        }
        return results;
    }

    async checkinSite(id) {
        const site = this.getSiteById(id);
        if (!site || !site.url || !site.enabled) return false;

        const db = this._getDB();
        const enableLogs = appConfig.isLogsEnabled();

        if (enableLogs) console.log(`[Checkin] Starting checkin for: ${site.name}`);

        if (this._isMTeamV2(site)) {
            try {
                // M-Team V2 签到 API
                const apiUrl = 'https://api.m-team.cc/api/member/checkin';
                const https = require('https');
                const response = await axios.post(apiUrl, {}, {
                    headers: {
                        ...this.getAuthHeaders(site),
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000,
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: false,
                        servername: 'api.m-team.cc'
                    })
                });

                if (enableLogs) console.log(`[M-Team V2] Checkin Response:`, JSON.stringify(response.data));

                // M-Team API: code 为 "0" (字符串) 表示成功，message 可能是 "SUCCESS" 或包含 "already" / "签到" 等
                const code = response.data?.code;
                const message = response.data?.message || '';
                const isSuccess = code === 0 || code === '0' ||
                    message === 'SUCCESS' ||
                    message.toLowerCase().includes('already') ||
                    message.includes('签到');
                if (response.data && isSuccess) {
                    db.prepare('UPDATE sites SET last_checkin_at = ? WHERE id = ?').run(timeUtils.getLocalISOString(), id);
                    loggerService.log(`站点 ${site.name} 自动签到成功 (API)`, 'success');
                    return true;
                }
                throw new Error(message || `API Error (code: ${code})`);
            } catch (err) {
                const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
                console.error(`[M-Team V2] Checkin failed:`, errorMsg);
                loggerService.log(`站点 ${site.name} API 签到失败: ${errorMsg}`, 'error');
                notificationService.notifyCheckinFailed(site.name, errorMsg);
                return false;
            }
        }

        if (site.type === 'Mock') {
            if (enableLogs) console.log(`[Checkin] Mock checkin successful for ${site.name}`);
            const db = this._getDB();
            db.prepare('UPDATE sites SET last_checkin_at = ? WHERE id = ?').run(timeUtils.getLocalISOString(), id);
            return true;
        }

        try {
            const baseUrl = site.url.endsWith('/') ? site.url.slice(0, -1) : site.url;
            const checkinUrls = [
                `${baseUrl}/attendance.php`,
                `${baseUrl}/index.php?action=add_bonus`
            ];

            const response = await axios.get(checkinUrls[0], {
                headers: this.getAuthHeaders(site),
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500 // Allow 404/403 for some attendance pages if handled
            });

            if (enableLogs) console.log(`[Checkin] ${site.name} checkin response received, status: ${response.status}`);

            const html = response.data || '';

            // Helper function to detect checkin success from HTML content
            const isCheckinSuccess = (content) => {
                if (!content) return false;
                const text = typeof content === 'string' ? content : '';
                // Success indicators
                return text.includes('签到成功') ||
                    text.includes('已经签到') ||
                    text.includes('今日已签到') ||
                    text.includes('已签到') ||
                    text.includes('签到已得') ||
                    text.includes('您今天已经签到') ||
                    text.includes('这是您的第') ||
                    text.includes('连续签到') ||
                    text.includes('Attendance successful') ||
                    text.includes('You have already attended') ||
                    text.includes('Already checked in') ||
                    text.includes('attendance_yes') ||
                    // Check for bonus reward text patterns
                    /获得了?\s*\d+\s*(积分|魔力|bonus)/i.test(text);
            };

            // Check if first URL indicates success
            let success = isCheckinSuccess(html);

            if (!success && response.status !== 200) {
                // Try the second URL if the first one failed
                if (enableLogs) console.log(`[Checkin] ${site.name} first URL not successful (status: ${response.status}), trying fallback...`);
                try {
                    const resp2 = await axios.get(checkinUrls[1], {
                        headers: this.getAuthHeaders(site),
                        timeout: 10000
                    });
                    success = isCheckinSuccess(resp2.data);
                } catch (e) {
                    if (enableLogs) console.log(`[Checkin] ${site.name} fallback URL also failed: ${e.message}`);
                }
            }

            // If we got HTTP 200, consider it success even without explicit confirmation
            // (some sites just redirect back without confirmation message)
            if (!success && response.status === 200) {
                // Do a quick sanity check - make sure it's not an error page
                const isErrorPage = html.includes('错误') && html.includes('签到') && !html.includes('成功');
                if (!isErrorPage) {
                    success = true;
                    if (enableLogs) console.log(`[Checkin] ${site.name} assuming success based on HTTP 200`);
                }
            }

            if (!success) {
                throw new Error('签到响应未包含成功标识');
            }

            const db = this._getDB();
            db.prepare('UPDATE sites SET last_checkin_at = ? WHERE id = ?').run(timeUtils.getLocalISOString(), id);

            loggerService.log(`站点 ${site.name} 自动签到成功`, 'success');
            return true;
        } catch (err) {
            if (enableLogs) console.error(`[Checkin] ${site.name} failed:`, err.message);
            loggerService.log(`站点 ${site.name} 自动签到失败: ${err.message}`, 'error');
            notificationService.notifyCheckinFailed(site.name, err.message);
            return false;
        }
    }

    async checkinAllSites() {
        const sites = this.getAllSites();
        let successCount = 0;
        for (const site of sites) {
            if (site.enabled && site.auto_checkin) {
                const ok = await this.checkinSite(site.id);
                if (ok) successCount++;
            }
        }
        return successCount;
    }
}

module.exports = new SiteService();

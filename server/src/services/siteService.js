const { getDB } = require('../db');
const axios = require('axios');
const loggerService = require('./loggerService');
const notificationService = require('./notificationService');

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
        return db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all();
    }

    getSiteById(id) {
        const db = this._getDB();
        return db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
    }

    createSite(site) {
        const db = this._getDB();
        const { name, url, cookies, type, enabled = 1, auto_checkin = 0 } = site;
        const info = db.prepare(
            'INSERT INTO sites (name, url, cookies, type, enabled, auto_checkin, cookie_status, last_checked_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL)'
        ).run(name, url, cookies, type, enabled, auto_checkin);
        return info.lastInsertRowid;
    }

    updateSite(id, site) {
        const db = this._getDB();
        const { name, url, cookies, type, enabled, auto_checkin, cookie_status } = site;

        // If cookies are changed, reset cookie_status to 0 (assume ok until checked)
        const oldSite = this.getSiteById(id);
        const status = cookies !== oldSite.cookies ? 0 : (cookie_status ?? oldSite.cookie_status);

        return db.prepare(
            'UPDATE sites SET name = ?, url = ?, cookies = ?, type = ?, enabled = ?, auto_checkin = ?, cookie_status = ? WHERE id = ?'
        ).run(name, url, cookies, type, enabled, auto_checkin, status, id);
    }

    deleteSite(id) {
        const db = this._getDB();
        return db.prepare('DELETE FROM sites WHERE id = ?').run(id);
    }

    toggleSite(id, enabled) {
        const db = this._getDB();
        return db.prepare('UPDATE sites SET enabled = ? WHERE id = ?').run(enabled, id);
    }

    _updateHeatmapData(siteId, currentUploadStr, newUploadStr) {
        const FormatUtils = require('../utils/formatUtils');
        const currentBytes = FormatUtils.parseSizeToBytes(currentUploadStr);
        const newBytes = FormatUtils.parseSizeToBytes(newUploadStr);

        if (newBytes > currentBytes && currentBytes > 0) {
            const db = this._getDB();
            const delta = newBytes - currentBytes;
            const today = new Date().toISOString().split('T')[0];

            db.prepare(`
                INSERT INTO site_daily_stats (site_id, date, uploaded_bytes)
                VALUES (?, ?, ?)
                ON CONFLICT(site_id, date) DO UPDATE SET
                uploaded_bytes = uploaded_bytes + ?
            `).run(siteId, today, delta, delta);

            console.log(`[Heatmap] Updated site ${siteId} with delta: ${delta} bytes`);
        }
    }

    async checkCookie(id) {
        const site = this.getSiteById(id);
        if (!site || !site.url || site.type === 'Mock') return true;

        const db = this._getDB();
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        try {
            if (enableLogs) console.log(`Checking cookie for site: ${site.name} (${site.url})`);
            const response = await axios.get(site.url, {
                headers: {
                    'Cookie': site.cookies || '',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
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
            const now = new Date().toISOString();

            if (status === 0) {
                // Cookie is valid, parse user stats
                const siteParsers = require('../utils/siteParsers');
                const stats = siteParsers.parseUserStats(html, site.type);

                if (stats) {
                    // Update heatmap if there's an increase
                    this._updateHeatmapData(id, site.upload, stats.upload);

                    let sql = 'UPDATE sites SET cookie_status = 0, last_checked_at = ?, username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ?';
                    const params = [now, stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now];

                    if (stats.isCheckedIn) {
                        sql += ', last_checkin_at = ?';
                        params.push(now);
                    }

                    sql += ' WHERE id = ?';
                    params.push(id);
                    db.prepare(sql).run(...params);
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
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        const siteParsers = require('../utils/siteParsers');

        try {
            if (enableLogs) console.log(`Refreshing user stats for site: ${site.name}`);
            let html = '';

            if (site.type === 'Mock') {
                const stats = siteParsers.parseUserStats('', 'Mock');
                const now = new Date().toISOString();
                db.prepare('UPDATE sites SET username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ?, cookie_status = 0 WHERE id = ?')
                    .run(stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now, id);
                return stats;
            }

            const response = await axios.get(site.url, {
                headers: {
                    'Cookie': site.cookies || '',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
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
                    .run(new Date().toISOString(), id);
                return null;
            }

            const stats = siteParsers.parseUserStats(html, site.type);

            if (stats) {
                const now = new Date().toISOString();

                // Update heatmap if there's an increase
                this._updateHeatmapData(id, site.upload, stats.upload);

                let sql = 'UPDATE sites SET cookie_status = 0, username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ?, last_checked_at = ?';
                const params = [stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now, now];

                if (stats.isCheckedIn) {
                    sql += ', last_checkin_at = ?';
                    params.push(now);
                }

                sql += ' WHERE id = ?';
                params.push(id);
                db.prepare(sql).run(...params);

                return stats;
            }
            return null;
        } catch (err) {
            if (enableLogs) console.error(`Failed to refresh stats for ${site.name}:`, err.message);
            return null;
        }
    }

    async getSiteHeatmap(id) {
        const db = this._getDB();
        return db.prepare('SELECT date, uploaded_bytes FROM site_daily_stats WHERE site_id = ? AND date > date("now", "-90 days") ORDER BY date ASC').all(id);
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
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        if (enableLogs) console.log(`[Checkin] Starting checkin for: ${site.name}`);

        if (site.type === 'Mock') {
            if (enableLogs) console.log(`[Checkin] Mock checkin successful for ${site.name}`);
            const db = this._getDB();
            db.prepare('UPDATE sites SET last_checkin_at = ? WHERE id = ?').run(new Date().toISOString(), id);
            return true;
        }

        try {
            const baseUrl = site.url.endsWith('/') ? site.url.slice(0, -1) : site.url;
            const checkinUrls = [
                `${baseUrl}/attendance.php`,
                `${baseUrl}/index.php?action=add_bonus`
            ];

            const response = await axios.get(checkinUrls[0], {
                headers: {
                    'Cookie': site.cookies || '',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500 // Allow 404/403 for some attendance pages if handled
            });

            if (enableLogs) console.log(`[Checkin] ${site.name} checkin response received, status: ${response.status}`);

            // Double check if success by parsing the response or just assuming 200 is success
            const siteParsers = require('../utils/siteParsers');
            const stats = siteParsers.parseUserStats(response.data, site.type);
            const isSuccess = response.status === 200 || (stats && stats.isCheckedIn);

            if (!isSuccess) {
                // Try the second URL if the first one failed or didn't confirm sign-in
                try {
                    const resp2 = await axios.get(checkinUrls[1], {
                        headers: {
                            'Cookie': site.cookies || '',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        timeout: 10000
                    });
                    const stats2 = siteParsers.parseUserStats(resp2.data, site.type);
                    if (resp2.status === 200 || (stats2 && stats2.isCheckedIn)) {
                        // Success on fallback
                    } else {
                        throw new Error('Checkin failed on both primary and fallback URLs');
                    }
                } catch (e) {
                    // Check if it's already checked in via HTML anyway
                    if (response.data && response.data.includes('已经签到')) {
                        // This is actually success
                    } else {
                        throw e;
                    }
                }
            }

            const db = this._getDB();
            db.prepare('UPDATE sites SET last_checkin_at = ? WHERE id = ?').run(new Date().toISOString(), id);

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

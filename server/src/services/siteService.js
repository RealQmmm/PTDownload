const { getDB } = require('../db');
const axios = require('axios');

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

    async checkCookie(id) {
        const site = this.getSiteById(id);
        if (!site || !site.url || site.type === 'Mock') return true;

        try {
            console.log(`Checking cookie for site: ${site.name} (${site.url})`);
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
            const db = this._getDB();

            if (status === 0) {
                // Cookie is valid, parse user stats
                const siteParsers = require('../utils/siteParsers');
                const stats = siteParsers.parseUserStats(html, site.type);
                const now = new Date().toISOString();
                if (stats) {
                    db.prepare('UPDATE sites SET cookie_status = 0, last_checked_at = ?, username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ? WHERE id = ?')
                        .run(now, stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now, id);
                } else {
                    db.prepare('UPDATE sites SET cookie_status = 0, last_checked_at = ? WHERE id = ?')
                        .run(now, id);
                }
            } else {
                db.prepare('UPDATE sites SET cookie_status = 1, last_checked_at = ? WHERE id = ?')
                    .run(new Date().toISOString(), id);
            }

            return status === 0;
        } catch (err) {
            console.error(`Cookie check failed for ${site.name}:`, err.message);
            // If it's a connection error, we might not want to mark it as "cookie expired"
            // But if it's a 401 or similar, then yes.
            // For now, let's only update if we get a valid response.
            return false;
        }
    }

    async refreshUserStats(id) {
        const site = this.getSiteById(id);
        if (!site || !site.url) return null;

        const siteParsers = require('../utils/siteParsers');

        try {
            console.log(`Refreshing user stats for site: ${site.name}`);
            let html = '';

            if (site.type === 'Mock') {
                const stats = siteParsers.parseUserStats('', 'Mock');
                const db = this._getDB();
                db.prepare('UPDATE sites SET username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    .run(stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, id);
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
            const stats = siteParsers.parseUserStats(html, site.type);

            const now = new Date().toISOString();
            if (stats) {
                const db = this._getDB();
                db.prepare('UPDATE sites SET username = ?, upload = ?, download = ?, ratio = ?, bonus = ?, level = ?, stats_updated_at = ? WHERE id = ?')
                    .run(stats.username, stats.upload, stats.download, stats.ratio, stats.bonus, stats.level, now, id);
                return stats;
            }
            return null;
        } catch (err) {
            console.error(`Failed to refresh stats for ${site.name}:`, err.message);
            return null;
        }
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

        console.log(`[Checkin] Starting checkin for: ${site.name}`);

        if (site.type === 'Mock') {
            console.log(`[Checkin] Mock checkin successful for ${site.name}`);
            const db = this._getDB();
            db.prepare('UPDATE sites SET last_checkin_at = ? WHERE id = ?').run(new Date().toISOString(), id);
            return true;
        }

        try {
            const baseUrl = site.url.endsWith('/') ? site.url.slice(0, -1) : site.url;
            const checkinUrls = [
                `${baseUrl}/attendance.php`,
                `${baseUrl}/index.php?action=add_bonus` // Some alternative sites
            ];

            // For NexusPHP, usually visiting attendance.php is enough
            const response = await axios.get(checkinUrls[0], {
                headers: {
                    'Cookie': site.cookies || '',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });

            console.log(`[Checkin] ${site.name} checkin response received`);

            const db = this._getDB();
            db.prepare('UPDATE sites SET last_checkin_at = ? WHERE id = ?').run(new Date().toISOString(), id);

            // Optionally refresh stats after checkin to see bonus increase
            await this.refreshUserStats(id);

            return true;
        } catch (err) {
            console.error(`[Checkin] ${site.name} failed:`, err.message);
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

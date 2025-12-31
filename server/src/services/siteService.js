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
        const { name, url, cookies, type, enabled = 1 } = site;
        const info = db.prepare(
            'INSERT INTO sites (name, url, cookies, type, enabled, cookie_status, last_checked_at) VALUES (?, ?, ?, ?, ?, 0, NULL)'
        ).run(name, url, cookies, type, enabled);
        return info.lastInsertRowid;
    }

    updateSite(id, site) {
        const db = this._getDB();
        const { name, url, cookies, type, enabled, cookie_status } = site;

        // If cookies are changed, reset cookie_status to 0 (assume ok until checked)
        const oldSite = this.getSiteById(id);
        const status = cookies !== oldSite.cookies ? 0 : (cookie_status ?? oldSite.cookie_status);

        return db.prepare(
            'UPDATE sites SET name = ?, url = ?, cookies = ?, type = ?, enabled = ?, cookie_status = ? WHERE id = ?'
        ).run(name, url, cookies, type, enabled, status, id);
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
            db.prepare('UPDATE sites SET cookie_status = ?, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(status, id);

            return status === 0;
        } catch (err) {
            console.error(`Cookie check failed for ${site.name}:`, err.message);
            // If it's a connection error, we might not want to mark it as "cookie expired"
            // But if it's a 401 or similar, then yes.
            // For now, let's only update if we get a valid response.
            return false;
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
}

module.exports = new SiteService();

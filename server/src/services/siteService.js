const { getDB } = require('../db');

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
            'INSERT INTO sites (name, url, cookies, type, enabled) VALUES (?, ?, ?, ?, ?)'
        ).run(name, url, cookies, type, enabled);
        return info.lastInsertRowid;
    }

    updateSite(id, site) {
        const db = this._getDB();
        const { name, url, cookies, type, enabled } = site;
        return db.prepare(
            'UPDATE sites SET name = ?, url = ?, cookies = ?, type = ?, enabled = ? WHERE id = ?'
        ).run(name, url, cookies, type, enabled, id);
    }

    deleteSite(id) {
        const db = this._getDB();
        return db.prepare('DELETE FROM sites WHERE id = ?').run(id);
    }

    toggleSite(id, enabled) {
        const db = this._getDB();
        return db.prepare('UPDATE sites SET enabled = ? WHERE id = ?').run(enabled, id);
    }
}

module.exports = new SiteService();

const { getDB } = require('../db');

class RSSSourceService {
    _getDB() {
        return getDB();
    }

    getAll() {
        return this._getDB().prepare(`
            SELECT rss_sources.*, sites.name as site_name 
            FROM rss_sources 
            LEFT JOIN sites ON rss_sources.site_id = sites.id 
            ORDER BY rss_sources.created_at DESC
        `).all();
    }

    getById(id) {
        return this._getDB().prepare('SELECT * FROM rss_sources WHERE id = ?').get(id);
    }

    create(source) {
        const { site_id, name, url } = source;
        const info = this._getDB().prepare(
            'INSERT INTO rss_sources (site_id, name, url) VALUES (?, ?, ?)'
        ).run(site_id, name, url);
        return info.lastInsertRowid;
    }

    update(id, source) {
        const { site_id, name, url } = source;
        return this._getDB().prepare(
            'UPDATE rss_sources SET site_id = ?, name = ?, url = ? WHERE id = ?'
        ).run(site_id, name, url, id);
    }

    delete(id) {
        return this._getDB().prepare('DELETE FROM rss_sources WHERE id = ?').run(id);
    }
}

module.exports = new RSSSourceService();

const axios = require('axios');

class MetadataService {
    constructor() {
        this.db = null;
    }

    _getDB() {
        if (!this.db) {
            this.db = require('../db').getDB();
        }
        return this.db;
    }

    _getSettings() {
        const db = this._getDB();
        const settings = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?)').all(
            'tmdb_api_key', 'tmdb_base_url', 'tmdb_image_base_url'
        );

        const config = {
            apiKey: '107492d807d58b01d0e5104d49af4081',
            baseUrl: 'https://api.themoviedb.org/3',
            imageBaseUrl: 'https://image.tmdb.org/t/p/w300'
        };

        settings.forEach(s => {
            if (s.key === 'tmdb_api_key') config.apiKey = s.value;
            if (s.key === 'tmdb_base_url') config.baseUrl = s.value;
            if (s.key === 'tmdb_image_base_url') config.imageBaseUrl = s.value;
        });

        return config;
    }

    /**
     * Search for a TV series by name
     * @param {string} query 
     * @returns {Promise<Object|null>} { id, name, poster_path, overview }
     */
    async searchSeries(query) {
        if (!query) return null;

        try {
            const config = this._getSettings();

            // Clean query: remove 'S01', '1080p', etc usually found in filenames but keep pure name if possible
            const cleanQuery = query.trim();

            const url = `${config.baseUrl}/search/tv?api_key=${config.apiKey}&query=${encodeURIComponent(cleanQuery)}&language=zh-CN`;
            const response = await axios.get(url, { timeout: 10000 });

            if (response.data && response.data.results && response.data.results.length > 0) {
                const bestMatch = response.data.results[0];
                const result = {
                    tmdb_id: bestMatch.id,
                    name: bestMatch.name,
                    original_name: bestMatch.original_name, // Include original matching name (e.g. English)
                    poster_path: bestMatch.poster_path ? `${config.imageBaseUrl}${bestMatch.poster_path}` : null,
                    overview: bestMatch.overview
                };
                require('./loggerService').log(`[TMDB] 刮削成功: ${query} => ${bestMatch.name}`, 'success');
                return result;
            }
            require('./loggerService').log(`[TMDB] 未找到匹配结果: ${query}`, 'warning');
        } catch (err) {
            console.error(`[Metadata] Search failed for ${query}:`, err.message);
            require('./loggerService').log(`[TMDB] 刮削失败: ${query} - ${err.message}`, 'error');
        }
        return null;
    }

    async getSeasonDetails(tmdbId, seasonNumber) {
        if (!tmdbId) return null;

        try {
            const config = this._getSettings();
            const url = `${config.baseUrl}/tv/${tmdbId}/season/${seasonNumber}?api_key=${config.apiKey}&language=zh-CN`;
            const response = await axios.get(url, { timeout: 10000 });

            if (response.data && response.data.episodes) {
                return {
                    episode_count: response.data.episodes.length,
                    episodes: response.data.episodes.map(e => ({
                        episode_number: e.episode_number,
                        name: e.name,
                        air_date: e.air_date
                    }))
                };
            }
        } catch (err) {
            console.error(`[Metadata] Season details failed for ID ${tmdbId} S${seasonNumber}:`, err.message);
        }
        return null;
    }
}

module.exports = new MetadataService();

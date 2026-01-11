const axios = require('axios');
const appConfig = require('./appConfig');

/**
 * M-Team API Utility
 * Handles multiple API domains and provides fallback/race logic
 */
const mteamApi = {
    // Available domains
    domains: ['api.m-team.cc', 'api.m-team.io'],

    // Cached best domain (not used for now, using racing/fallback)
    _bestDomain: 'api.m-team.cc',

    /**
     * Get the current API host from settings or default
     * @returns {string} 
     */
    getApiHost() {
        try {
            const { getDB } = require('../db');
            const db = getDB();
            const row = db.prepare("SELECT value FROM settings WHERE key = 'mteam_api_host'").get();
            if (row && row.value && row.value !== 'auto') {
                return row.value;
            }
        } catch (e) {
            // Fallback to default
        }
        return this._bestDomain;
    },

    /**
     * Perform a request to M-Team API, trying multiple domains if one fails
     * @param {string} path - API path (e.g., '/api/torrent/search')
     * @param {object} options - Axios request options
     * @param {boolean} isPost - Whether it's a POST request
     * @returns {Promise<any>}
     */
    async request(path, options = {}, isPost = true) {
        const enableLogs = appConfig.isLogsEnabled();
        const selectedHost = this.getApiHost();

        // If user explicitly chose a host, just use it
        if (selectedHost !== 'auto' && this.domains.includes(selectedHost)) {
            return this._doRequest(selectedHost, path, options, isPost);
        }

        // AUTO mode: Try both and use the first one that responds successfully
        // We use a fallback approach instead of a full race to avoid double-hitting rate limits
        // but with a relatively short timeout for the first attempt.

        const primaryHost = this.domains[0];
        const secondaryHost = this.domains[1];

        if (enableLogs) console.log(`[M-Team API] Auto mode: Trying primary host ${primaryHost}...`);

        try {
            // First attempt with a slightly shorter timeout if it's auto mode
            const firstOptions = { ...options, timeout: Math.min(options.timeout || 15000, 10000) };
            const result = await this._doRequest(primaryHost, path, firstOptions, isPost);
            this._bestDomain = primaryHost; // Update last successful
            return result;
        } catch (err) {
            if (enableLogs) console.warn(`[M-Team API] Primary host ${primaryHost} failed or timed out. Trying secondary ${secondaryHost}...`);

            try {
                const result = await this._doRequest(secondaryHost, path, options, isPost);
                this._bestDomain = secondaryHost; // Update last successful
                return result;
            } catch (err2) {
                if (enableLogs) console.error(`[M-Team API] Both hosts failed.`);
                throw err2;
            }
        }
    },

    /**
     * Actually perform the axios request
     */
    async _doRequest(host, path, options, isPost) {
        const https = require('https');
        const url = `https://${host}${path}`;

        const requestOptions = {
            ...options,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
                servername: host
            })
        };

        if (isPost) {
            return await axios.post(url, options.data || {}, requestOptions);
        } else {
            return await axios.get(url, requestOptions);
        }
    }
};

module.exports = mteamApi;

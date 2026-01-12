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

        let targetDomains = [...this.domains];

        // Extract custom hosts from site config if provided
        if (options.site && options.site.custom_config) {
            try {
                const config = typeof options.site.custom_config === 'string'
                    ? JSON.parse(options.site.custom_config)
                    : options.site.custom_config;

                if (config.mteam_api_hosts && Array.isArray(config.mteam_api_hosts) && config.mteam_api_hosts.length > 0) {
                    targetDomains = config.mteam_api_hosts;
                    if (enableLogs) console.log(`[M-Team API] Using custom hosts:`, targetDomains);
                }
            } catch (e) {
                if (enableLogs) console.error(`[M-Team API] Failed to parse custom_config:`, e.message);
            }
        }

        const selectedHost = this.getApiHost();

        // If user explicitly chose a host (global setting), and it's in our target list, use it
        if (selectedHost !== 'auto' && targetDomains.includes(selectedHost)) {
            return this._doRequest(selectedHost, path, options, isPost);
        }

        // AUTO mode or selectedHost not in custom list: Try domains in order
        const primaryHost = targetDomains[0];
        const backupHosts = targetDomains.slice(1);

        if (enableLogs) console.log(`[M-Team API] Trying host: ${primaryHost}...`);

        try {
            // First attempt
            const firstOptions = { ...options, timeout: Math.min(options.timeout || 15000, 10000) };
            const result = await this._doRequest(primaryHost, path, firstOptions, isPost);
            return result;
        } catch (err) {
            if (enableLogs) console.warn(`[M-Team API] Host ${primaryHost} failed. Trying backups...`);

            for (const backupHost of backupHosts) {
                try {
                    if (enableLogs) console.log(`[M-Team API] Trying backup host: ${backupHost}...`);
                    const result = await this._doRequest(backupHost, path, options, isPost);
                    return result;
                } catch (err2) {
                    if (enableLogs) console.error(`[M-Team API] Backup host ${backupHost} failed.`);
                }
            }

            // If all failed
            throw err;
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

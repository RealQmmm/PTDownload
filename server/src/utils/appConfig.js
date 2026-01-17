/**
 * Global application configuration cache
 * Avoids frequent database queries for common settings
 */

const appConfig = {
    // System logs enabled flag (cached from database)
    enableSystemLogs: false,

    // Hot resources search integration enabled flag (cached from database)
    isHotResourcesSearchIntegrationEnabled: false,

    /**
     * Initialize config from database
     * Should be called once during app startup
     */
    init() {
        try {
            const { getDB } = require('../db');
            const db = getDB();

            // System logs
            const logRow = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
            this.enableSystemLogs = logRow && logRow.value === 'true';

            // Hot resources integration
            const hotRow = db.prepare("SELECT value FROM settings WHERE key = 'hot_resources_enable_search_integration'").get();
            this.isHotResourcesSearchIntegrationEnabled = hotRow && (hotRow.value === 'true' || hotRow.value === '1');

            console.log(`[AppConfig] System logs: ${this.enableSystemLogs ? 'enabled' : 'disabled'}`);
            console.log(`[AppConfig] Hot resources integration: ${this.isHotResourcesSearchIntegrationEnabled ? 'enabled' : 'disabled'}`);
        } catch (e) {
            console.warn('[AppConfig] Failed to init from DB:', e.message);
            this.enableSystemLogs = false;
            this.isHotResourcesSearchIntegrationEnabled = false;
        }
    },

    /**
     * Update log setting
     * @param {boolean} enabled 
     */
    setSystemLogsEnabled(enabled) {
        this.enableSystemLogs = !!enabled;
        console.log(`[AppConfig] System logs updated: ${this.enableSystemLogs ? 'enabled' : 'disabled'}`);
    },

    /**
     * Update hot resources integration setting
     * @param {boolean} enabled 
     */
    setHotResourcesSearchIntegrationEnabled(enabled) {
        this.isHotResourcesSearchIntegrationEnabled = !!enabled;
        console.log(`[AppConfig] Hot resources integration updated: ${this.isHotResourcesSearchIntegrationEnabled ? 'enabled' : 'disabled'}`);
    },

    /**
     * Check if hot resources integration is enabled
     * @returns {boolean}
     */
    isHotResourcesEnabled() {
        return this.isHotResourcesSearchIntegrationEnabled;
    },

    /**
     * Check if system logs are enabled
     * @returns {boolean}
     */
    isLogsEnabled() {
        return this.enableSystemLogs;
    }
};

module.exports = appConfig;

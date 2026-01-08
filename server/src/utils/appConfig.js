/**
 * Global application configuration cache
 * Avoids frequent database queries for common settings
 */

const appConfig = {
    // System logs enabled flag (cached from database)
    enableSystemLogs: false,

    /**
     * Initialize config from database
     * Should be called once during app startup
     */
    init() {
        try {
            const { getDB } = require('../db');
            const db = getDB();
            const row = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
            this.enableSystemLogs = row && row.value === 'true';
            console.log(`[AppConfig] System logs: ${this.enableSystemLogs ? 'enabled' : 'disabled'}`);
        } catch (e) {
            console.warn('[AppConfig] Failed to init from DB:', e.message);
            this.enableSystemLogs = false;
        }
    },

    /**
     * Update log setting (call this when setting is changed via API)
     * @param {boolean} enabled 
     */
    setSystemLogsEnabled(enabled) {
        this.enableSystemLogs = !!enabled;
        console.log(`[AppConfig] System logs updated: ${this.enableSystemLogs ? 'enabled' : 'disabled'}`);
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

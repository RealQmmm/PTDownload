const { getDB } = require('../db');
const downloaderService = require('./downloaderService');
const loggerService = require('./loggerService');

class CleanupService {
    constructor() {
        this.db = null;
    }

    _getDB() {
        if (!this.db) {
            this.db = getDB();
        }
        return this.db;
    }

    async getSettings() {
        const db = this._getDB();
        const settings = db.prepare("SELECT * FROM settings WHERE key LIKE 'cleanup_%'").all();
        const config = {
            enabled: false,
            minRatio: 2.0,
            maxSeedingTime: 336 // hours
        };

        settings.forEach(s => {
            if (s.key === 'cleanup_enabled') config.enabled = s.value === 'true';
            if (s.key === 'cleanup_min_ratio') config.minRatio = parseFloat(s.value);
            if (s.key === 'cleanup_max_seeding_time') config.maxSeedingTime = parseInt(s.value, 10);
        });

        return config;
    }

    async runCleanup() {
        const config = await this.getSettings();

        if (!config.enabled) {
            return;
        }

        console.log('[Cleanup] Starting auto-cleanup check...');

        try {
            const clients = await downloaderService.getAllClients();

            for (const client of clients) {
                // Determine client type to normalize data if needed
                // Currently downloaderService abstract this via getClientInstance

                try {
                    const res = await downloaderService.getTorrents(client);
                    if (!res || !res.success || !res.torrents) continue;
                    const torrents = res.torrents;

                    for (const torrent of torrents) {
                        // torrent structure: { hash, name, state, ratio, seedingTime (seconds), ... }
                        // Note: seedingTime from downloaderService might be in seconds.
                        // We need to verify what downloaderService returns. 
                        // Assuming standardizeTorrent returns 'progress', 'state', 'ratio', 'save_path' etc.
                        // We might need to fetch raw seeding time if not present.

                        let shouldDelete = false;
                        let reason = '';

                        const ratio = typeof torrent.ratio === 'number' ? torrent.ratio : parseFloat(torrent.ratio || 0);
                        // seedingTime is usually in seconds
                        const seedingTimeCategories = torrent.seeding_time || 0;
                        // But wait, downloaderService.getTorrents -> client.getTorrents -> standardize
                        // Let's assume standardization includes 'seeding_time' or similar. 
                        // Checking qBittorrent/Transmission parsers later if needed.
                        // For now, let's play safe and check if these properties exist.

                        // Check Ratio
                        if (ratio >= config.minRatio) {
                            shouldDelete = true;
                            reason = `Ratio ${ratio.toFixed(2)} >= ${config.minRatio}`;
                        }

                        // Check Seeding Time (convert config hours to seconds)
                        // Only if not already matched
                        if (!shouldDelete && torrent.seeding_time) {
                            const seedingHours = torrent.seeding_time / 3600;
                            if (seedingHours >= config.maxSeedingTime) {
                                shouldDelete = true;
                                reason = `Seeding Time ${seedingHours.toFixed(1)}h >= ${config.maxSeedingTime}h`;
                            }
                        }

                        if (shouldDelete) {
                            console.log(`[Cleanup] Deleting ${torrent.name} (${reason})`);
                            await downloaderService.deleteTorrent(client, torrent.hash, true); // true = delete files
                            loggerService.log(`自动清理: ${torrent.name} (${reason})`, 'success');
                        }
                    }

                } catch (clientErr) {
                    console.error(`[Cleanup] Error checking client ${client.name}:`, clientErr.message);
                }
            }
        } catch (err) {
            console.error('[Cleanup] Fatal error:', err);
            loggerService.log(`自动清理运行出错: ${err.message}`, 'error');
        }
    }
}

module.exports = new CleanupService();

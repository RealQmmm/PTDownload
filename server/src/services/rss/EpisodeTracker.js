const { getDB } = require('../../db');
const episodeParser = require('../../utils/episodeParser');

/**
 * Episode Tracker Module
 * Handles episode existence checking and tracking
 * Extracted from rssService.js to reduce complexity
 */
class EpisodeTracker {
    /**
     * Check if episodes already exist across multiple sources
     * @param {Object} item - RSS item with title
     * @param {number} taskId - Task ID
     * @param {Object} subscription - Series subscription info
     * @param {boolean} enableLogs - Whether to log debug info
     * @returns {Object} { isRedundant: boolean, downloadedEpisodes: Set }
     */
    static checkEpisodeExists(item, taskId, subscription, enableLogs = false) {
        const db = getDB();
        const candidateInfo = episodeParser.parse(item.title);

        if (!candidateInfo || candidateInfo.episodes.length === 0) {
            return { isRedundant: false, downloadedEpisodes: new Set() };
        }

        const downloadedEpisodes = new Set();
        // BUG FIX: 如果标题中没有 season 信息，使用订阅的 season 而不是默认为 1
        const targetSeason = candidateInfo.season !== null ? candidateInfo.season : (subscription?.season || 1);

        // === Source 1: Query series_episodes table (most reliable) ===
        if (subscription) {
            const seriesEpisodes = db.prepare(
                'SELECT episode FROM series_episodes WHERE subscription_id = ? AND season = ?'
            ).all(subscription.id, targetSeason);

            seriesEpisodes.forEach(ep => downloadedEpisodes.add(ep.episode));

            if (enableLogs && seriesEpisodes.length > 0) {
                console.log(`[EpisodeTracker] Found ${seriesEpisodes.length} episodes in series_episodes for S${targetSeason}`);
            }
        }

        // === Source 2: Parse from task history ===
        const historyItems = db.prepare('SELECT item_title FROM task_history WHERE task_id = ?').all(taskId);

        historyItems.forEach(hItem => {
            const hInfo = episodeParser.parse(hItem.item_title);
            if (hInfo) {
                if (targetSeason !== null) {
                    if (hInfo.season === targetSeason) {
                        hInfo.episodes.forEach(ep => downloadedEpisodes.add(ep));
                    }
                } else {
                    hInfo.episodes.forEach(ep => downloadedEpisodes.add(ep));
                }
            }
        });

        // === Source 3: Scan ALL history for matching series name ===
        if (subscription) {
            const seriesName = (subscription.name || '').toLowerCase().trim();
            const seriesAlias = (subscription.alias || '').toLowerCase().trim();

            const allHistory = db.prepare('SELECT item_title FROM task_history WHERE task_id IS NULL OR task_id != ?').all(taskId);

            allHistory.forEach(hItem => {
                const titleLower = (hItem.item_title || '').toLowerCase();

                let isMatch = seriesName && titleLower.includes(seriesName);
                if (!isMatch && seriesAlias) {
                    isMatch = titleLower.includes(seriesAlias);
                }

                // Normalize and try again
                if (!isMatch) {
                    const normalizedTitle = titleLower.replace(/[\s._\-\[\](){}+]/g, '');
                    const normalizedName = seriesName.replace(/[\s._\-\[\](){}+]/g, '');
                    isMatch = normalizedName && normalizedTitle.includes(normalizedName);

                    if (!isMatch && seriesAlias) {
                        const normalizedAlias = seriesAlias.replace(/[\s._\-\[\](){}+]/g, '');
                        isMatch = normalizedAlias && normalizedTitle.includes(normalizedAlias);
                    }
                }

                if (isMatch) {
                    const hInfo = episodeParser.parse(hItem.item_title);
                    if (hInfo && hInfo.season === targetSeason) {
                        hInfo.episodes.forEach(ep => downloadedEpisodes.add(ep));
                    }
                }
            });

            if (enableLogs && downloadedEpisodes.size > 0) {
                console.log(`[EpisodeTracker] Total tracked episodes for S${targetSeason}: ${Array.from(downloadedEpisodes).sort((a, b) => a - b).join(', ')}`);
            }
        }

        // Check if ALL candidate episodes exist
        const isRedundant = candidateInfo.episodes.every(ep => downloadedEpisodes.has(ep));

        return { isRedundant, downloadedEpisodes, candidateInfo };
    }

    /**
     * Pre-record episodes to series_episodes table
     * @param {number} subscriptionId - Subscription ID
     * @param {Object} candidateInfo - Parsed episode info
     * @param {string} torrentHash - Torrent hash
     * @param {string} torrentTitle - Torrent title
     * @param {boolean} enableLogs - Whether to log
     * @returns {number} Number of episodes inserted
     */
    static preRecordEpisodes(subscriptionId, candidateInfo, torrentHash, torrentTitle, enableLogs = false) {
        const db = getDB();
        const subscription = db.prepare('SELECT season FROM series_subscriptions WHERE id = ?').get(subscriptionId);

        if (!subscription || !candidateInfo || candidateInfo.episodes.length === 0) {
            return 0;
        }

        const season = candidateInfo.season !== null ? candidateInfo.season : (subscription.season || 1);
        const insertEpStmt = db.prepare(`
            INSERT OR IGNORE INTO series_episodes 
            (subscription_id, season, episode, torrent_hash, torrent_title, download_time)
            VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `);

        let insertedCount = 0;
        candidateInfo.episodes.forEach(ep => {
            const epResult = insertEpStmt.run(subscriptionId, season, ep, torrentHash, torrentTitle);
            if (epResult.changes > 0) insertedCount++;
        });

        if (enableLogs && insertedCount > 0) {
            console.log(`[EpisodeTracker] Pre-recorded ${insertedCount} episodes: S${season}E${candidateInfo.episodes.join(',E')}`);
        }

        return insertedCount;
    }
}

module.exports = EpisodeTracker;

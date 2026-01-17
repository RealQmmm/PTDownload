const downloaderService = require('../downloaderService');

/**
 * Download Coordinator Module
 * Handles torrent download orchestration with rollback on failure
 */
class DownloadCoordinator {
    /**
     * Execute download with automatic rollback on failure
     * @param {Object} params - Download parameters
     * @returns {Object} { success: boolean, message: string }
     */
    static async executeDownload({
        item,
        task,
        targetClient,
        torrentData,
        finalSavePath,
        fileIndices = null,
        preRecordId = null,
        enableLogs = false
    }) {
        const { getDB } = require('../../db');
        const db = getDB();

        // === SUBMIT TO DOWNLOADER ===
        let result;
        const isData = torrentData && torrentData !== item.link;

        try {
            if (isData && !item.link.startsWith('magnet:')) {
                // If we have the file data, pass it along with save path, category, and file selection
                result = await downloaderService.addTorrentFromData(targetClient, torrentData, {
                    savePath: finalSavePath,
                    category: task.category,
                    fileIndices: fileIndices
                });
            } else {
                // Magnet or fallback to URL (file selection not supported for magnets or URL adds)
                result = await downloaderService.addTorrent(targetClient, item.link, {
                    savePath: finalSavePath,
                    category: task.category
                });
            }

            if (result.success) {
                let successMsg = `Successfully added: ${item.title}`;
                if (fileIndices && fileIndices.length > 0) {
                    successMsg += ` (${fileIndices.length} files selected)`;
                }
                if (enableLogs) console.log(`[DownloadCoordinator] ${successMsg}`);

                return { success: true, message: successMsg };
            } else {
                // === ROLLBACK on failure ===
                if (preRecordId) {
                    if (enableLogs) {
                        console.error(`[DownloadCoordinator] Failed to add ${item.title}: ${result.message}. Rolling back.`);
                    }

                    try {
                        db.prepare('DELETE FROM task_history WHERE id = ?').run(preRecordId);
                        if (enableLogs) console.log(`[DownloadCoordinator] Rolled back task_history entry ID: ${preRecordId}`);
                    } catch (rollbackErr) {
                        console.error(`[DownloadCoordinator] Rollback failed: ${rollbackErr.message}`);
                    }
                }

                return { success: false, message: result.message };
            }
        } catch (err) {
            // Rollback on exception
            if (preRecordId) {
                if (enableLogs) console.error(`[DownloadCoordinator] Exception: ${err.message}. Rolling back.`);

                try {
                    db.prepare('DELETE FROM task_history WHERE id = ?').run(preRecordId);
                } catch (rollbackErr) {
                    console.error(`[DownloadCoordinator] Rollback failed: ${rollbackErr.message}`);
                }
            }

            return { success: false, message: err.message };
        }
    }
}

module.exports = DownloadCoordinator;

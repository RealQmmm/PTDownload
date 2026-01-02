const episodeParser = require('./episodeParser');

/**
 * Utility for selecting files from torrents based on episode history
 */
class FileSelector {
    /**
     * Determine which files should be downloaded based on episode history
     * @param {Array} torrentFiles - Array of file objects from torrent metadata [{name, size}, ...]
     * @param {Array} downloadedEpisodes - Array of episode numbers already downloaded [1, 2, 3, ...]
     * @param {number|null} targetSeason - The season number to match (null for any)
     * @returns {Array<number>} - Array of file indices to download (0-based)
     */
    selectFiles(torrentFiles, downloadedEpisodes, targetSeason = null) {
        if (!torrentFiles || torrentFiles.length === 0) {
            return []; // No files to select
        }

        if (!downloadedEpisodes || downloadedEpisodes.length === 0) {
            // No history, download all files
            return torrentFiles.map((_, idx) => idx);
        }

        const downloadedSet = new Set(downloadedEpisodes);
        const selectedIndices = [];

        torrentFiles.forEach((file, idx) => {
            // Parse episode info from filename
            const fileInfo = episodeParser.parse(file.name);

            if (!fileInfo || fileInfo.episodes.length === 0) {
                // Can't determine episode info, include by default (could be subtitle, NFO, etc.)
                selectedIndices.push(idx);
                return;
            }

            // Check season match if specified
            if (targetSeason !== null && fileInfo.season !== null && fileInfo.season !== targetSeason) {
                // Different season - this is new content, download it
                selectedIndices.push(idx);
                return;
            }

            // Same season or no season info - check if this file contains any new episodes
            const hasNewEpisode = fileInfo.episodes.some(ep => !downloadedSet.has(ep));

            if (hasNewEpisode) {
                selectedIndices.push(idx);
            }
        });

        // If no files were selected (all episodes already downloaded), return empty array
        // The caller should handle this case (skip the torrent entirely)
        return selectedIndices;
    }

    /**
     * Check if a torrent contains any new episodes
     * @param {Array} torrentFiles - Array of file objects from torrent metadata
     * @param {Array} downloadedEpisodes - Array of episode numbers already downloaded
     * @param {number|null} targetSeason - The season number to match
     * @returns {boolean} - True if torrent has new episodes
     */
    hasNewEpisodes(torrentFiles, downloadedEpisodes, targetSeason = null) {
        const selectedFiles = this.selectFiles(torrentFiles, downloadedEpisodes, targetSeason);

        // Check if any of the selected files are actual video files (not just NFO/subs)
        const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts'];
        const hasVideoFile = selectedFiles.some(idx => {
            const fileName = torrentFiles[idx].name.toLowerCase();
            return videoExtensions.some(ext => fileName.endsWith(ext));
        });

        return hasVideoFile;
    }
}

module.exports = new FileSelector();

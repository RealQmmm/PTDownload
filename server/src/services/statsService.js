const { getDB } = require('../db');
const clientService = require('./clientService');
const downloaderService = require('./downloaderService');

class StatsService {
    // Helper to get local date string YYYY-MM-DD
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async updateDailyStats() {
        await this.checkCompletion();
        try {
            const db = getDB();
            const clients = clientService.getAllClients();

            if (clients.length === 0) return;

            // Fetch current totals from all clients
            const clientResults = await Promise.all(
                clients.map(async (client) => {
                    try {
                        const result = await downloaderService.getTorrents(client);
                        if (result.success) {
                            // Sum up individual torrent values as a reliable alternative to global counters
                            const torrentSumDL = (result.torrents || []).reduce((sum, t) => sum + (Number(t.downloaded) || 0), 0);
                            const torrentSumUL = (result.torrents || []).reduce((sum, t) => sum + (Number(t.uploaded) || 0), 0);

                            // Use the larger value between the global counter and the sum of torrents
                            // Some clients might return session-only totals in stats, while torrents keep their lifetime totals
                            return {
                                downloaded: Math.max(result.stats.totalDownloaded || 0, torrentSumDL),
                                uploaded: Math.max(result.stats.totalUploaded || 0, torrentSumUL)
                            };
                        }
                        return null;
                    } catch (err) {
                        return null;
                    }
                })
            );

            const validResults = clientResults.filter(r => r !== null);
            const currentTotalDownloaded = validResults.reduce((acc, r) => acc + r.downloaded, 0);
            const currentTotalUploaded = validResults.reduce((acc, r) => acc + r.uploaded, 0);

            // Get checkpoint
            const checkpoint = db.prepare('SELECT * FROM stats_checkpoint WHERE id = 1').get();

            // Use local date string
            const today = this.getLocalDateString();

            let histDl = checkpoint.historical_total_downloaded || 0;
            let histUl = checkpoint.historical_total_uploaded || 0;

            // Ensure historical stats are initialized from current totals if they are empty
            // or if the current total is significantly larger than what we have (first-run sync)
            if (histDl === 0 && currentTotalDownloaded > 0) histDl = currentTotalDownloaded;
            if (histUl === 0 && currentTotalUploaded > 0) histUl = currentTotalUploaded;

            if (checkpoint && (checkpoint.last_total_downloaded > 0 || checkpoint.last_total_uploaded > 0)) {
                let diffDownloaded = currentTotalDownloaded - checkpoint.last_total_downloaded;
                let diffUploaded = currentTotalUploaded - checkpoint.last_total_uploaded;

                // Handle reset for download/upload (e.g. client restart or clearing stats)
                if (diffDownloaded < 0) {
                    console.log(`[Stats] Download counter reset detected. New session starts at: ${currentTotalDownloaded}`);
                    diffDownloaded = currentTotalDownloaded;
                }
                if (diffUploaded < 0) {
                    console.log(`[Stats] Upload counter reset detected. New session starts at: ${currentTotalUploaded}`);
                    diffUploaded = currentTotalUploaded;
                }

                if (diffDownloaded > 0 || diffUploaded > 0) {
                    console.log(`[Stats] Recorded new traffic: DL +${diffDownloaded}, UP +${diffUploaded}`);
                    histDl += diffDownloaded;
                    histUl += diffUploaded;
                }

                // Update today's stats record (incremental for both)
                const existingToday = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today);
                if (existingToday) {
                    db.prepare('UPDATE daily_stats SET downloaded_bytes = downloaded_bytes + ?, uploaded_bytes = uploaded_bytes + ? WHERE date = ?')
                        .run(diffDownloaded, diffUploaded, today);
                } else {
                    db.prepare('INSERT INTO daily_stats (date, downloaded_bytes, uploaded_bytes) VALUES (?, ?, ?)')
                        .run(today, diffDownloaded, diffUploaded);
                }
            } else {
                console.log(`[Stats] Initializing stats checkpoint with DL:${currentTotalDownloaded}, UP:${currentTotalUploaded}`);
                // Initial run: Use current client totals as historical start point
                histDl = currentTotalDownloaded;
                histUl = currentTotalUploaded;
            }

            // Update checkpoint
            db.prepare('UPDATE stats_checkpoint SET last_total_downloaded = ?, last_total_uploaded = ?, historical_total_downloaded = ?, historical_total_uploaded = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1')
                .run(currentTotalDownloaded, currentTotalUploaded, histDl, histUl);

        } catch (err) {
            console.error('Failed to update daily stats:', err);
        }
    }

    async checkCompletion() {
        const db = getDB();
        try {
            const clients = clientService.getAllClients();
            if (clients.length === 0) return;

            // 1. Get unfinished items from history (including manual downloads where task_id is NULL)
            const unfinished = db.prepare('SELECT * FROM task_history WHERE is_finished = 0').all();
            if (unfinished.length === 0) return;

            console.log(`[Stats] Checking completion for ${unfinished.length} unfinished items...`);

            // 2. Map of all torrents from all active clients
            const allTorrents = [];
            for (const client of clients) {
                const result = await downloaderService.getTorrents(client);
                if (result.success && result.torrents) {
                    allTorrents.push(...result.torrents);
                }
            }

            if (allTorrents.length === 0) return;

            // Helper to normalize names for better matching
            const normalize = (name) => (name || '').toLowerCase()
                .replace(/[\s\._\-\[\]\(\)\{\}\+]/g, '')
                .replace(/第[一二三四五六七八九十\d]+[季集期]/g, ''); // Remove common Chinese episode/season tags which clients might strip

            // 3. Check each unfinished item
            for (const item of unfinished) {
                const itemTitleNorm = normalize(item.item_title);

                // Try to find a matching torrent
                const torrent = allTorrents.find(t => {
                    // Match by hash if available
                    if (item.item_hash && t.hash) {
                        return t.hash.toLowerCase() === item.item_hash.toLowerCase();
                    }

                    // Fallback to name/size matching to "link" the hash
                    if (!t.name) return false;
                    const tNameNorm = normalize(t.name);

                    // Match by normalized name
                    const nameMatch = tNameNorm === itemTitleNorm || tNameNorm.includes(itemTitleNorm) || itemTitleNorm.includes(tNameNorm);

                    // If name matches, also verify size (within 1% threshold) to be sure it's the same torrent
                    if (nameMatch && item.item_size > 0 && t.size > 0) {
                        const sizeDiff = Math.abs(t.size - item.item_size);
                        return sizeDiff < (item.item_size * 0.01);
                    }

                    return nameMatch;
                });

                if (torrent) {
                    // console.log(`[Stats] Found match for "${item.item_title}" -> "${torrent.name}" (State: ${torrent.state}, Progress: ${torrent.progress})`);

                    // 1. Logic to "link" the hash if we didn't have it
                    if (!item.item_hash && torrent.hash) {
                        db.prepare('UPDATE task_history SET item_hash = ? WHERE id = ?').run(torrent.hash, item.id);
                        item.item_hash = torrent.hash;
                        console.log(`[Stats] Linked hash ${torrent.hash} to item: "${item.item_title}"`);
                    }

                    // 2. Update size if it was 0 or incorrect
                    if ((!item.item_size || item.item_size === 0) && torrent.size > 0) {
                        db.prepare('UPDATE task_history SET item_size = ? WHERE id = ?').run(torrent.size, item.id);
                        item.item_size = torrent.size;
                    }

                    // 3. Check if finished
                    const isFinished = torrent.progress >= 1 ||
                        ['seeding', 'complete', 'uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'finished'].includes(torrent.state);

                    if (isFinished) {
                        const finishTime = torrent.completion_on || new Date().toISOString();
                        const downloadTime = torrent.added_on || item.download_time;

                        db.prepare('UPDATE task_history SET is_finished = 1, finish_time = ?, download_time = ? WHERE id = ?')
                            .run(finishTime, downloadTime, item.id);
                        console.log(`[Stats] Marked item as finished via hash/name: "${item.item_title}" (Time: ${finishTime})`);
                    }
                }
            }
        } catch (err) {
            console.error('[Stats] Check completion failed:', err.message);
        }
    }

    getHistory(days = 7) {
        const db = getDB();
        const now = new Date();
        const today = this.getLocalDateString(now);

        // Get last N days including today
        // We use the calculated local date as the baseline to avoid UTC issues in SQLite date()
        const history = db.prepare(`
            SELECT * FROM daily_stats 
            WHERE date >= date(?, '-' || ? || ' days')
            ORDER BY date ASC
        `).all(today, days - 1);

        // Fill in missing days with zeros if necessary
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = this.getLocalDateString(d);
            const existing = history.find(h => h.date === dateStr);
            if (existing) {
                result.push(existing);
            } else {
                result.push({
                    date: dateStr,
                    downloaded_bytes: 0,
                    uploaded_bytes: 0
                });
            }
        }
        return result;
    }

    async syncHistoryWithDownloader() {
        const db = getDB();
        try {
            const clients = clientService.getAllClients();
            if (clients.length === 0) return { success: false, message: 'No active clients' };

            const allTorrents = [];
            for (const client of clients) {
                const result = await downloaderService.getTorrents(client);
                if (result.success && result.torrents) {
                    allTorrents.push(...result.torrents);
                }
            }

            if (allTorrents.length === 0) return { success: false, message: 'No torrents in client' };

            const history = db.prepare('SELECT * FROM task_history').all();
            let updatedCount = 0;

            const normalize = (name) => (name || '').toLowerCase()
                .replace(/[\s\._\-\[\]\(\)\{\}\+]/g, '')
                .replace(/第[一二三四五六七八九十\d]+[季集期]/g, '');

            for (const item of history) {
                const itemTitleNorm = normalize(item.item_title);

                const torrent = allTorrents.find(t => {
                    if (item.item_hash && t.hash) {
                        return t.hash.toLowerCase() === item.item_hash.toLowerCase();
                    }
                    if (!t.name) return false;
                    const tNameNorm = normalize(t.name);
                    const nameMatch = tNameNorm === itemTitleNorm || tNameNorm.includes(itemTitleNorm) || itemTitleNorm.includes(tNameNorm);

                    if (nameMatch && item.item_size > 0 && t.size > 0) {
                        const sizeDiff = Math.abs(t.size - item.item_size);
                        return sizeDiff < (item.item_size * 0.01);
                    }
                    return nameMatch;
                });

                if (torrent) {
                    const isFinished = torrent.progress >= 1 ||
                        ['seeding', 'complete', 'uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'finished'].includes(torrent.state);

                    const finishTime = torrent.completion_on || item.finish_time;
                    const downloadTime = torrent.added_on || item.download_time;
                    const itemHash = torrent.hash || item.item_hash;
                    const itemSize = torrent.size || item.item_size;

                    db.prepare(`
                        UPDATE task_history 
                        SET is_finished = ?, finish_time = ?, download_time = ?, item_hash = ?, item_size = ?
                        WHERE id = ?
                    `).run(isFinished ? 1 : 0, finishTime, downloadTime, itemHash, itemSize, item.id);

                    updatedCount++;
                }
            }

            return { success: true, updatedCount };
        } catch (err) {
            console.error('[Stats] Bulk sync failed:', err.message);
            return { success: false, message: err.message };
        }
    }
}

module.exports = new StatsService();

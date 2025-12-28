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
                            return {
                                downloaded: result.stats.totalDownloaded || 0,
                                uploaded: result.stats.totalUploaded || 0
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

            if (checkpoint && (checkpoint.last_total_downloaded > 0 || checkpoint.last_total_uploaded > 0)) {
                let diffDownloaded = currentTotalDownloaded - checkpoint.last_total_downloaded;
                let diffUploaded = currentTotalUploaded - checkpoint.last_total_uploaded;

                // Handle reset for download/upload
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
            }

            // Update checkpoint
            db.prepare('UPDATE stats_checkpoint SET last_total_downloaded = ?, last_total_uploaded = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1')
                .run(currentTotalDownloaded, currentTotalUploaded);

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
                    if (!t.name) return false;
                    const tNameNorm = normalize(t.name);
                    // Exact normalized match or one contains the other (carefully)
                    return tNameNorm === itemTitleNorm || tNameNorm.includes(itemTitleNorm) || itemTitleNorm.includes(tNameNorm);
                });

                if (torrent) {
                    console.log(`[Stats] Found match for "${item.item_title}" -> "${torrent.name}" (State: ${torrent.state}, Progress: ${torrent.progress})`);
                    // Update size if it was 0 or incorrect
                    if ((!item.item_size || item.item_size === 0) && torrent.size > 0) {
                        db.prepare('UPDATE task_history SET item_size = ? WHERE id = ?').run(torrent.size, item.id);
                        item.item_size = torrent.size; // Update local object for this loop if needed
                    }

                    // Check if finished (progress is 1 or 100%)
                    const isFinished = torrent.progress >= 1 ||
                        ['seeding', 'complete', 'uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'finished'].includes(torrent.state);

                    if (isFinished) {
                        const now = new Date().toISOString();
                        db.prepare('UPDATE task_history SET is_finished = 1, finish_time = ? WHERE id = ?')
                            .run(now, item.id);
                        console.log(`[Stats] Marked item as finished: "${item.item_title}" (Size: ${torrent.size})`);
                    }
                } else {
                    // console.log(`[Stats] No active torrent match found for: "${item.item_title}"`);
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
}

module.exports = new StatsService();

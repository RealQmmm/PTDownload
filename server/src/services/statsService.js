const { getDB } = require('../db');
const clientService = require('./clientService');
const downloaderService = require('./downloaderService');

class StatsService {
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

            // Use local date string instead of ISO to respect user's timezone
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            if (checkpoint && (checkpoint.last_total_downloaded > 0 || checkpoint.last_total_uploaded > 0)) {
                let diffUploaded = currentTotalUploaded - checkpoint.last_total_uploaded;

                // Handle reset for upload
                if (diffUploaded < 0) diffUploaded = currentTotalUploaded;

                // 1. Calculate today's completed downloads size for history chart
                const completedToday = db.prepare(`
                    SELECT SUM(item_size) as total_size 
                    FROM task_history 
                    WHERE is_finished = 1 AND date(finish_time, 'localtime') = date(?)
                `).get(today);
                const totalCompletedSize = completedToday ? (completedToday.total_size || 0) : 0;

                // 2. Update today's stats record
                const existingToday = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today);
                if (existingToday) {
                    db.prepare('UPDATE daily_stats SET downloaded_bytes = ?, uploaded_bytes = uploaded_bytes + ? WHERE date = ?')
                        .run(totalCompletedSize, diffUploaded, today);
                } else {
                    db.prepare('INSERT INTO daily_stats (date, downloaded_bytes, uploaded_bytes) VALUES (?, ?, ?)')
                        .run(today, totalCompletedSize, diffUploaded);
                }
            } else {
                // First run or all zeros: just initialize the checkpoint without recording a massive delta for "today"
                console.log('Initializing stats baseline...');
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
            const normalize = (name) => (name || '').toLowerCase().replace(/[\s\._\-\[\]\(\)]/g, '');

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
                    // Update size if it was 0 or incorrect
                    if ((!item.item_size || item.item_size === 0) && torrent.size > 0) {
                        db.prepare('UPDATE task_history SET item_size = ? WHERE id = ?').run(torrent.size, item.id);
                        item.item_size = torrent.size; // Update local object for this loop if needed
                    }

                    // Check if finished (progress is 1 or 100%)
                    const isFinished = torrent.progress >= 1 ||
                        torrent.state === 'seeding' ||
                        torrent.state === 'complete' ||
                        torrent.state === 'uploading'; // Seeding is finished downloading

                    if (isFinished) {
                        const now = new Date().toISOString();
                        db.prepare('UPDATE task_history SET is_finished = 1, finish_time = ? WHERE id = ?')
                            .run(now, item.id);
                        console.log(`[Stats] Marked item as finished: "${item.item_title}" (Size: ${torrent.size})`);
                    }
                }
            }
        } catch (err) {
            console.error('[Stats] Check completion failed:', err.message);
        }
    }

    getHistory(days = 7) {
        const db = getDB();
        // Get last N days including today
        const history = db.prepare(`
            SELECT * FROM daily_stats 
            WHERE date >= date('now', '-' || ? || ' days')
            ORDER BY date ASC
        `).all(days - 1);

        // Fill in missing days with zeros if necessary
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
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

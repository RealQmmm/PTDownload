const { getDB } = require('../db');
const clientService = require('./clientService');
const downloaderService = require('./downloaderService');
const loggerService = require('./loggerService');

class StatsService {
    // Helper to get local date string YYYY-MM-DD
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async updateDailyStats() {
        const db = getDB();
        // Check log setting
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        await this.checkCompletion();
        try {
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
                    if (enableLogs) console.log(`[Stats] Download counter reset detected. New session starts at: ${currentTotalDownloaded}`);
                    diffDownloaded = currentTotalDownloaded;
                }
                if (diffUploaded < 0) {
                    if (enableLogs) console.log(`[Stats] Upload counter reset detected. New session starts at: ${currentTotalUploaded}`);
                    diffUploaded = currentTotalUploaded;
                }

                if (diffDownloaded > 0 || diffUploaded > 0) {
                    if (enableLogs) console.log(`[Stats] Recorded new traffic: DL +${diffDownloaded}, UP +${diffUploaded}`);
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
                if (enableLogs) console.log(`[Stats] Initializing stats checkpoint with DL:${currentTotalDownloaded}, UP:${currentTotalUploaded}`);
                // Initial run: Use current client totals as historical start point
                histDl = currentTotalDownloaded;
                histUl = currentTotalUploaded;
            }

            // Update checkpoint
            db.prepare('UPDATE stats_checkpoint SET last_total_downloaded = ?, last_total_uploaded = ?, historical_total_downloaded = ?, historical_total_uploaded = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1')
                .run(currentTotalDownloaded, currentTotalUploaded, histDl, histUl);

            // Periodically log heartbeat if something was recorded
            if (checkpoint && (checkpoint.last_total_downloaded > 0 || checkpoint.last_total_uploaded > 0)) {
                let diffDownloaded = currentTotalDownloaded - checkpoint.last_total_downloaded;
                let diffUploaded = currentTotalUploaded - checkpoint.last_total_uploaded;
                if (diffDownloaded > 0 || diffUploaded > 0) {
                    loggerService.log(`数据采集：新增下载 ${(diffDownloaded / 1024 / 1024).toFixed(2)}MB, 新增上传 ${(diffUploaded / 1024 / 1024).toFixed(2)}MB`, 'success');
                }
            }

        } catch (err) {
            console.error('Failed to update daily stats:', err);
        }
    }

    async checkCompletion() {
        const db = getDB();
        // Check log setting
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        try {
            const clients = clientService.getAllClients();
            if (clients.length === 0) return;

            // 1. Fetch all torrents from all clients
            const allTorrents = [];
            for (const client of clients) {
                const result = await downloaderService.getTorrents(client);
                if (result.success && result.torrents) {
                    allTorrents.push(...result.torrents);
                }
            }

            if (allTorrents.length === 0) {
                if (enableLogs) console.log('[Stats] No torrents found in clients.');
                return;
            }
            if (enableLogs) console.log(`[Stats] Found ${allTorrents.length} torrents in clients.`);

            // 2. IMPORT UNKNOWN TORRENTS
            // Fetch all known hashes to avoid duplicates
            const knownRows = db.prepare('SELECT item_hash FROM task_history WHERE item_hash IS NOT NULL').all();
            const knownHashes = new Set(knownRows.map(r => r.item_hash.toLowerCase()));
            if (enableLogs) console.log(`[Stats] Known hashes count: ${knownHashes.size}`);

            let newImportCount = 0;
            const insertStmt = db.prepare(`
                INSERT INTO task_history (
                    task_id, item_guid, item_title, item_hash, item_size, 
                    is_finished, download_time, finish_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const t of allTorrents) {
                if (!t.hash) continue;
                const tHash = t.hash.toLowerCase();

                // If we haven't seen this hash before, import it
                if (!knownHashes.has(tHash)) {
                    const isFinished = t.progress >= 1 ||
                        ['seeding', 'complete', 'uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'finished'].includes(t.state);

                    const downloadTime = t.added_on || new Date().toISOString();
                    const finishTime = isFinished ? (t.completion_on || new Date().toISOString()) : null;

                    try {
                        // Use hash as guid for external torrents (task_id is NULL)
                        insertStmt.run(
                            null,
                            tHash,
                            t.name,
                            tHash,
                            t.size,
                            isFinished ? 1 : 0,
                            downloadTime,
                            finishTime
                        );
                        knownHashes.add(tHash);
                        newImportCount++;
                    } catch (err) {
                        // Ignore UNIQUE constraint errors
                        if (!err.message.includes('UNIQUE constraint failed')) {
                            console.error('[Stats] Failed to import torrent:', t.name, err.message);
                        }
                    }
                }
            }

            if (newImportCount > 0) {
                if (enableLogs) console.log(`[Stats] Imported ${newImportCount} new torrents from clients.`);
            }

            // 3. CHECK EXISTING UNFINISHED ITEMS
            // Logic to update status of items that were already in history but marked as unfinished
            const unfinished = db.prepare('SELECT * FROM task_history WHERE is_finished = 0').all();
            if (unfinished.length === 0) return;

            // Helper to normalize names for better matching
            const normalize = (name) => (name || '').toLowerCase()
                .replace(/[\s\._\-\[\]\(\)\{\}\+]/g, '')
                .replace(/第[一二三四五六七八九十\d]+[季集期]/g, '');

            for (const item of unfinished) {
                const itemTitleNorm = normalize(item.item_title);

                const torrent = allTorrents.find(t => {
                    // Match by hash if available
                    if (item.item_hash && t.hash) {
                        return t.hash.toLowerCase() === item.item_hash.toLowerCase();
                    }

                    // Fallback to name match
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
                    // Link hash if missing
                    if (!item.item_hash && torrent.hash) {
                        db.prepare('UPDATE task_history SET item_hash = ? WHERE id = ?').run(torrent.hash, item.id);
                        item.item_hash = torrent.hash;
                    }

                    // Update size if missing
                    if ((!item.item_size || item.item_size === 0) && torrent.size > 0) {
                        db.prepare('UPDATE task_history SET item_size = ? WHERE id = ?').run(torrent.size, item.id);
                        item.item_size = torrent.size;
                    }

                    // Check finished status
                    const isFinished = torrent.progress >= 1 ||
                        ['seeding', 'complete', 'uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'finished'].includes(torrent.state);

                    if (isFinished) {
                        const finishTime = torrent.completion_on || new Date().toISOString();
                        const downloadTime = torrent.added_on || item.download_time;

                        db.prepare('UPDATE task_history SET is_finished = 1, finish_time = ?, download_time = ? WHERE id = ?')
                            .run(finishTime, downloadTime, item.id);
                        if (enableLogs) console.log(`[Stats] Marked item as finished: "${item.item_title}"`);
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

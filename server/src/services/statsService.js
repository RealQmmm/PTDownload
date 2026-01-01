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

    constructor() {
        this.memoryStats = {
            todayDownloaded: 0,
            todayUploaded: 0,
            histDownloaded: 0,
            histUploaded: 0,
            lastTotalDownloaded: 0,
            lastTotalUploaded: 0
        };
        this.initialized = false;
        this.clientsData = []; // Cache for torrent list to avoid redundant calls
    }

    async init() {
        const db = getDB();
        const today = this.getLocalDateString();

        // 1. Load checkpoint
        const checkpoint = db.prepare('SELECT * FROM stats_checkpoint WHERE id = 1').get();
        if (checkpoint) {
            this.memoryStats.lastTotalDownloaded = checkpoint.last_total_downloaded || 0;
            this.memoryStats.lastTotalUploaded = checkpoint.last_total_uploaded || 0;
            this.memoryStats.histDownloaded = checkpoint.historical_total_downloaded || 0;
            this.memoryStats.histUploaded = checkpoint.historical_total_uploaded || 0;
        }

        // 2. Load today's stats
        const todayStats = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today);
        if (todayStats) {
            this.memoryStats.todayDownloaded = todayStats.downloaded_bytes || 0;
            this.memoryStats.todayUploaded = todayStats.uploaded_bytes || 0;
        }

        this.initialized = true;
        console.log('[Stats] Service initialized with memory cache');
    }

    async collectStats() {
        if (!this.initialized) await this.init();

        const db = getDB();
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        try {
            const clients = clientService.getAllClients();
            if (clients.length === 0) return;

            // Fetch current totals and torrents from all clients
            const clientResults = await Promise.all(
                clients.map(async (client) => {
                    try {
                        const result = await downloaderService.getTorrents(client);
                        if (result.success) {
                            const torrentSumDL = (result.torrents || []).reduce((sum, t) => sum + (Number(t.downloaded) || 0), 0);
                            const torrentSumUL = (result.torrents || []).reduce((sum, t) => sum + (Number(t.uploaded) || 0), 0);

                            return {
                                success: true,
                                downloaded: Math.max(result.stats.totalDownloaded || 0, torrentSumDL),
                                uploaded: Math.max(result.stats.totalUploaded || 0, torrentSumUL),
                                torrents: result.torrents
                            };
                        }
                        return { success: false };
                    } catch (err) {
                        return { success: false };
                    }
                })
            );

            const validResults = clientResults.filter(r => r.success);
            const currentTotalDownloaded = validResults.reduce((acc, r) => acc + r.downloaded, 0);
            const currentTotalUploaded = validResults.reduce((acc, r) => acc + r.uploaded, 0);

            // Cache torrents for checkCompletion and other uses
            this.clientsData = validResults.flatMap(r => r.torrents || []);

            // Calculate Deltas
            if (this.memoryStats.lastTotalDownloaded > 0 || this.memoryStats.lastTotalUploaded > 0) {
                let diffDL = currentTotalDownloaded - this.memoryStats.lastTotalDownloaded;
                let diffUL = currentTotalUploaded - this.memoryStats.lastTotalUploaded;

                // Handle Reset or Deletion
                // If diff is negative, it means a torrent was removed or stats were reset.
                // We should NOT count this as negative traffic, nor should we jump to the total value.
                // We just accept the new lower baseline.
                if (diffDL < 0) diffDL = 0;
                if (diffUL < 0) diffUL = 0;

                if (diffDL > 0 || diffUL > 0) {
                    this.memoryStats.todayDownloaded += diffDL;
                    this.memoryStats.todayUploaded += diffUL;
                    this.memoryStats.histDownloaded += diffDL;
                    this.memoryStats.histUploaded += diffUL;

                    if (enableLogs) {
                        console.log(`[Stats] Memory Update: DL +${diffDL}, UP +${diffUL}`);
                    }
                }
            } else {
                // First run after empty DB or init
                if (this.memoryStats.histDownloaded === 0) this.memoryStats.histDownloaded = currentTotalDownloaded;
                if (this.memoryStats.histUploaded === 0) this.memoryStats.histUploaded = currentTotalUploaded;
            }

            this.memoryStats.lastTotalDownloaded = currentTotalDownloaded;
            this.memoryStats.lastTotalUploaded = currentTotalUploaded;

            // Check completion using cached torrents
            await this.checkCompletionInternal(this.clientsData);

        } catch (err) {
            console.error('[Stats] Collection failed:', err);
        }
    }

    async updateDailyStats() {
        await this.collectStats();
        await this.persistStats();
    }

    async persistStats() {
        if (!this.initialized) return;

        const db = getDB();
        const today = this.getLocalDateString();

        try {
            // 1. Update daily_stats
            const existingToday = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(today);
            if (existingToday) {
                db.prepare('UPDATE daily_stats SET downloaded_bytes = ?, uploaded_bytes = ? WHERE date = ?')
                    .run(this.memoryStats.todayDownloaded, this.memoryStats.todayUploaded, today);
            } else {
                // If it's a new day, we need to reset today's counters in memory
                // This usually happens at midnight. The 5-min persist should handle it.
                // But wait, if getLocalDateString() changes, we should reset memory today stats.
                db.prepare('INSERT INTO daily_stats (date, downloaded_bytes, uploaded_bytes) VALUES (?, ?, ?)')
                    .run(today, this.memoryStats.todayDownloaded, this.memoryStats.todayUploaded);
            }

            // 2. Update checkpoint
            db.prepare(`
                UPDATE stats_checkpoint 
                SET last_total_downloaded = ?, 
                    last_total_uploaded = ?, 
                    historical_total_downloaded = ?, 
                    historical_total_uploaded = ?, 
                    last_updated = CURRENT_TIMESTAMP 
                WHERE id = 1
            `).run(
                this.memoryStats.lastTotalDownloaded,
                this.memoryStats.lastTotalUploaded,
                this.memoryStats.histDownloaded,
                this.memoryStats.histUploaded
            );

            console.log(`[Stats] Persisted to DB: Today DL: ${(this.memoryStats.todayDownloaded / 1024 / 1024).toFixed(2)}MB`);

            // Handle day rollover in logic
            const lastPersistedDate = this.lastPersistedDate || today;
            if (lastPersistedDate !== today) {
                // New day detected! Reset today stats in memory for next cycle
                this.memoryStats.todayDownloaded = 0;
                this.memoryStats.todayUploaded = 0;
            }
            this.lastPersistedDate = today;

        } catch (err) {
            console.error('[Stats] Persistence failed:', err);
        }
    }

    getStats() {
        return { ...this.memoryStats };
    }

    // Renamed for internal use
    async checkCompletionInternal(allTorrents) {
        if (!allTorrents || allTorrents.length === 0) return;

        const db = getDB();
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        try {

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
                    // Comprehensive finished check: progress is 100% OR in done states
                    const isFinished = t.progress >= 1 ||
                        ['seeding', 'complete', 'uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'finished', 'checkingUP', 'forcedUP', 'moving'].includes(t.state);

                    const downloadTime = t.added_on || new Date().toISOString();
                    // CRITICAL: Ensure finishTime is NEVER null if finished
                    const finishTime = isFinished ? (t.completion_on || new Date().toISOString()) : null;

                    try {
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
                .replace(/第[一二三四五六七八九十\d]+[季集期]/g, ''); // Remove common Chinese episode/season tags which clients might strip

            // 3. Check each unfinished item
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
                    // Update metadata
                    if (!item.item_hash && torrent.hash) {
                        db.prepare('UPDATE task_history SET item_hash = ? WHERE id = ?').run(torrent.hash, item.id);
                        item.item_hash = torrent.hash;
                    }
                    if ((!item.item_size || item.item_size === 0) && torrent.size > 0) {
                        db.prepare('UPDATE task_history SET item_size = ? WHERE id = ?').run(torrent.size, item.id);
                        item.item_size = torrent.size;
                    }

                    // Check if finished
                    const isFinished = torrent.progress >= 1 ||
                        ['seeding', 'complete', 'uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'finished', 'checkingUP', 'forcedUP', 'moving'].includes(torrent.state);

                    if (isFinished) {
                        const finishTime = torrent.completion_on || new Date().toISOString();
                        const downloadTime = torrent.added_on || item.download_time;

                        db.prepare('UPDATE task_history SET is_finished = 1, finish_time = ?, download_time = ? WHERE id = ?')
                            .run(finishTime, downloadTime, item.id);
                        if (enableLogs) console.log(`[Stats] Marked item as finished: "${item.item_title}"`);
                    }
                } else {
                    // LOOPHOLE FIX: If torrent is MISSING from client but was in our unfinished list
                    // It was likely deleted or moved. In PT usage, this usually means it finished.
                    // We mark it as finished to avoid it being stuck in "Downloading" forever.
                    const now = new Date().toISOString();
                    db.prepare('UPDATE task_history SET is_finished = 1, finish_time = ? WHERE id = ?')
                        .run(now, item.id);
                    if (enableLogs) console.log(`[Stats] Marked missing torrent as finished (cleanup): "${item.item_title}"`);
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

            if (dateStr === today) {
                // Use in-memory stats for today
                result.push({
                    date: dateStr,
                    downloaded_bytes: this.memoryStats.todayDownloaded,
                    uploaded_bytes: this.memoryStats.todayUploaded
                });
                continue;
            }

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
                        ['seeding', 'complete', 'uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'finished', 'checkingUP', 'forcedUP', 'moving'].includes(torrent.state);

                    const finishTime = torrent.completion_on || (isFinished ? (item.finish_time || new Date().toISOString()) : null);
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

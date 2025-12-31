const axios = require('axios');

class DownloaderService {
    constructor() {
        this.cache = new Map();
        this.CACHE_TTL = 2000;
    }

    async testConnection(client) {
        const { type, host, port, username, password } = client;
        const baseUrl = `http://${host}:${port}`;

        try {
            if (type === 'qBittorrent') {
                const response = await axios.post(
                    `${baseUrl}/api/v2/auth/login`,
                    `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        timeout: 5000,
                    }
                );

                if (response.status === 200 && response.data === 'Ok.') {
                    return { success: true, message: '连接成功 (qBittorrent)' };
                }
                return { success: false, message: '认证失败: ' + response.data };
            }

            if (type === 'Transmission') {
                // Transmission session test
                try {
                    await axios.get(`${baseUrl}/transmission/rpc`, { timeout: 5000 });
                } catch (err) {
                    if (err.response && err.response.status === 409) {
                        return { success: true, message: '连接成功 (Transmission)' };
                    }
                    throw err;
                }
            }

            return { success: false, message: '暂不支持该类型客户端自动化测试' };
        } catch (err) {
            console.error('Downloader test failed:', err.message);
            return { success: false, message: `连接失败: ${err.message}` };
        }
    }

    // Get torrents list and statistics from client
    async getTorrents(client, forceRefresh = false) {
        const cacheKey = `torrents_${client.id}`;
        const now = Date.now();

        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (now - cached.timestamp < this.CACHE_TTL) {
                return cached.data;
            }
        }

        const { type, host, port, username, password } = client;
        const baseUrl = `http://${host}:${port}`;

        let result;
        try {
            if (type === 'qBittorrent') {
                // 1. Login
                const loginRes = await axios.post(
                    `${baseUrl}/api/v2/auth/login`,
                    `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                    {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        timeout: 5000
                    }
                );

                const cookie = loginRes.headers['set-cookie'];

                // 2. Get torrent list
                const torrentsRes = await axios.get(`${baseUrl}/api/v2/torrents/info`, {
                    headers: { 'Cookie': cookie },
                    timeout: 10000
                });

                // 3. Get transfer info
                const transferRes = await axios.get(`${baseUrl}/api/v2/transfer/info`, {
                    headers: { 'Cookie': cookie },
                    timeout: 5000
                });

                const torrents = torrentsRes.data.map(t => ({
                    hash: t.hash,
                    name: t.name,
                    size: t.size,
                    progress: t.progress,
                    state: t.state,
                    dlspeed: t.dlspeed,
                    upspeed: t.upspeed,
                    downloaded: t.downloaded,
                    uploaded: t.uploaded,
                    ratio: t.ratio,
                    eta: t.eta,
                    added_on: t.added_on > 0 ? new Date(t.added_on * 1000).toISOString() : null,
                    completion_on: t.completion_on > 0 ? new Date(t.completion_on * 1000).toISOString() : null,
                    seeding_time: t.seeding_time || 0
                }));

                return {
                    success: true,
                    clientType: 'qBittorrent',
                    clientName: `${host}:${port}`,
                    torrents,
                    stats: {
                        dlSpeed: transferRes.data.dl_info_speed || 0,
                        upSpeed: transferRes.data.up_info_speed || 0,
                        totalDownloaded: transferRes.data.dl_info_data || 0,
                        totalUploaded: transferRes.data.up_info_data || 0
                    }
                };
            }

            if (type === 'Transmission') {
                const rpcUrl = `${baseUrl}/transmission/rpc`;
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                const headers = { 'Authorization': `Basic ${auth}` };

                // 1. Get Session ID
                let sessionId = '';
                try {
                    await axios.get(rpcUrl, { headers, timeout: 5000 });
                } catch (err) {
                    if (err.response && err.response.status === 409) {
                        sessionId = err.response.headers['x-transmission-session-id'];
                    } else {
                        throw err;
                    }
                }

                // 2. Get torrents
                const torrentsRes = await axios.post(
                    rpcUrl,
                    {
                        method: 'torrent-get',
                        arguments: {
                            fields: ['hashString', 'name', 'totalSize', 'percentDone', 'status', 'rateDownload', 'rateUpload', 'downloadedEver', 'uploadedEver', 'uploadRatio', 'eta', 'addedDate', 'doneDate', 'secondsSeeding']
                        }
                    },
                    {
                        headers: {
                            ...headers,
                            'X-Transmission-Session-Id': sessionId
                        },
                        timeout: 10000
                    }
                );

                // 3. Get session stats
                const statsRes = await axios.post(
                    rpcUrl,
                    { method: 'session-stats' },
                    {
                        headers: {
                            ...headers,
                            'X-Transmission-Session-Id': sessionId
                        },
                        timeout: 5000
                    }
                );

                const torrents = (torrentsRes.data.arguments.torrents || []).map(t => ({
                    hash: t.hashString,
                    name: t.name,
                    size: t.totalSize,
                    progress: t.percentDone,
                    state: this._transmissionStateToString(t.status),
                    dlspeed: t.rateDownload,
                    upspeed: t.rateUpload,
                    downloaded: t.downloadedEver,
                    uploaded: t.uploadedEver,
                    ratio: t.uploadRatio,
                    eta: t.eta,
                    added_on: t.addedDate > 0 ? new Date(t.addedDate * 1000).toISOString() : null,
                    completion_on: t.doneDate > 0 ? new Date(t.doneDate * 1000).toISOString() : null,
                    seeding_time: t.secondsSeeding || 0
                }));

                const cumStats = statsRes.data.arguments['cumulative-stats'] || {};

                return {
                    success: true,
                    clientType: 'Transmission',
                    clientName: `${host}:${port}`,
                    torrents,
                    stats: {
                        dlSpeed: statsRes.data.arguments.downloadSpeed || 0,
                        upSpeed: statsRes.data.arguments.uploadSpeed || 0,
                        totalDownloaded: cumStats.downloadedBytes || 0,
                        totalUploaded: cumStats.uploadedBytes || 0
                    }
                };
            }

            if (type === 'Mock') {
                // Return mock data for testing
                result = {
                    success: true,
                    clientType: 'Mock',
                    clientName: `${host}:${port}`,
                    torrents: [
                        torrents: [
                            { hash: '8f7d9a1c2e3b4f5a6b7c8d9e0f1a2b3c4d5e6f7g', name: '[Mock] Ubuntu 24.04 LTS', size: 4500000000, progress: 1, state: 'seeding', dlspeed: 0, upspeed: 1500000, downloaded: 4500000000, uploaded: 9800000000, ratio: 2.17, eta: -1, added_on: new Date(Date.now() - 86400000).toISOString(), completion_on: new Date(Date.now() - 43200000).toISOString(), seeding_time: 43200 },
                            { hash: '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t', name: '[Mock] Avatar 2160p HDR', size: 25600000000, progress: 0.75, state: 'downloading', dlspeed: 12500000, upspeed: 500000, downloaded: 19200000000, uploaded: 2500000000, ratio: 0.13, eta: 512, added_on: new Date(Date.now() - 3600000).toISOString(), completion_on: null, seeding_time: 0 },
                            { hash: 'z1x2c3v4b5n6m7l8k9j0h1g2f3d4s5a6p7o8i9u0', name: '[Mock] Oppenheimer 1080p', size: 15200000000, progress: 0.32, state: 'downloading', dlspeed: 8700000, upspeed: 200000, downloaded: 4864000000, uploaded: 800000000, ratio: 0.16, eta: 1190, added_on: new Date(Date.now() - 7200000).toISOString(), completion_on: null, seeding_time: 0 }
                        ],
                        stats: {
                            dlSpeed: 21200000,
                            upSpeed: 2200000,
                            totalDownloaded: 156000000000,
                            totalUploaded: 312000000000
                        }
                };
            } else {
                result = { success: false, message: '不支持的客户端类型' };
            }

        } catch (err) {
            console.error(`Get torrents failed for ${type}:`, err.message);
            result = { success: false, message: `获取失败: ${err.message}`, torrents: [], stats: {} };
        }

        if (result && result.success) {
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        }
        return result;
    }

    _transmissionStateToString(status) {
        const states = {
            0: 'stopped',
            1: 'checking',
            2: 'checking',
            3: 'queued',
            4: 'downloading',
            5: 'queued',
            6: 'seeding'
        };
        return states[status] || 'unknown';
    }

    // Future add torrent method
    async addTorrent(client, torrentUrl, options = {}) {
        const { type, host, port, username, password } = client;
        const baseUrl = `http://${host}:${port}`;

        try {
            if (type === 'qBittorrent') {
                // 1. Login
                const loginRes = await axios.post(
                    `${baseUrl}/api/v2/auth/login`,
                    `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                    {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        timeout: 5000
                    }
                );

                const cookie = loginRes.headers['set-cookie'];

                // 2. Add Torrent with options
                let body = `urls=${encodeURIComponent(torrentUrl)}`;
                if (options.savePath) body += `&savepath=${encodeURIComponent(options.savePath)}`;
                if (options.category) body += `&category=${encodeURIComponent(options.category)}`;

                await axios.post(
                    `${baseUrl}/api/v2/torrents/add`,
                    body,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Cookie': cookie
                        }
                    }
                );
                return { success: true, message: '已添加至 qBittorrent' };
            }

            if (type === 'Transmission') {
                const rpcUrl = `${baseUrl}/transmission/rpc`;
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                const headers = { 'Authorization': `Basic ${auth}` };

                // 1. Get Session ID
                let sessionId = '';
                try {
                    await axios.get(rpcUrl, { headers });
                } catch (err) {
                    if (err.response && err.response.status === 409) {
                        sessionId = err.response.headers['x-transmission-session-id'];
                    } else {
                        throw err;
                    }
                }

                // 2. Add Torrent
                const args = { filename: torrentUrl };
                if (options.savePath) args['download-dir'] = options.savePath;

                await axios.post(
                    rpcUrl,
                    {
                        method: 'torrent-add',
                        arguments: args
                    },
                    {
                        headers: {
                            ...headers,
                            'X-Transmission-Session-Id': sessionId
                        }
                    }
                );
                return { success: true, message: '已添加至 Transmission' };
            }

            if (type === 'Mock') {
                console.log(`[Mock] Adding torrent to ${host}:${port}: ${torrentUrl}`);
                return { success: true, message: '已添加至 Mock 客户端' };
            }

            return { success: false, message: '不支持的客户端类型' };

        } catch (err) {
            console.error(`Add torrent failed for ${type}:`, err.message);
            return { success: false, message: `添加失败: ${err.message}` };
        }
    }

    // Add torrent from base64 encoded torrent file data
    async addTorrentFromData(client, torrentBase64) {
        const { type, host, port, username, password } = client;
        const baseUrl = `http://${host}:${port}`;

        try {
            if (type === 'qBittorrent') {
                // 1. Login
                const loginRes = await axios.post(
                    `${baseUrl}/api/v2/auth/login`,
                    `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                    {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        timeout: 5000
                    }
                );

                const cookie = loginRes.headers['set-cookie'];

                // 2. Create form data with torrent file
                const FormData = require('form-data');
                const form = new FormData();
                const torrentBuffer = Buffer.from(torrentBase64, 'base64');
                form.append('torrents', torrentBuffer, {
                    filename: 'torrent.torrent',
                    contentType: 'application/x-bittorrent'
                });

                // 3. Upload torrent
                await axios.post(
                    `${baseUrl}/api/v2/torrents/add`,
                    form,
                    {
                        headers: {
                            ...form.getHeaders(),
                            'Cookie': cookie
                        },
                        timeout: 30000
                    }
                );
                return { success: true, message: '已添加至 qBittorrent' };
            }

            if (type === 'Transmission') {
                const rpcUrl = `${baseUrl}/transmission/rpc`;
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                const headers = { 'Authorization': `Basic ${auth}` };

                // 1. Get Session ID
                let sessionId = '';
                try {
                    await axios.get(rpcUrl, { headers });
                } catch (err) {
                    if (err.response && err.response.status === 409) {
                        sessionId = err.response.headers['x-transmission-session-id'];
                    } else {
                        throw err;
                    }
                }

                // 2. Add Torrent with metainfo (base64)
                await axios.post(
                    rpcUrl,
                    {
                        method: 'torrent-add',
                        arguments: { metainfo: torrentBase64 }
                    },
                    {
                        headers: {
                            ...headers,
                            'X-Transmission-Session-Id': sessionId
                        }
                    }
                );
                return { success: true, message: '已添加至 Transmission' };
            }

            if (type === 'Mock') {
                console.log(`[Mock] Adding torrent data to ${host}:${port}`);
                return { success: true, message: '已添加至 Mock 客户端' };
            }

            return { success: false, message: '不支持的客户端类型' };

        } catch (err) {
            console.error(`Add torrent from data failed for ${type}:`, err.message);
            return { success: false, message: `添加失败: ${err.message}` };
        }
    }

    // Delete torrent
    async deleteTorrent(client, hash, deleteFiles = true) {
        const { type, host, port, username, password } = client;
        const baseUrl = `http://${host}:${port}`;

        try {
            if (type === 'qBittorrent') {
                const loginRes = await axios.post(
                    `${baseUrl}/api/v2/auth/login`,
                    `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                const cookie = loginRes.headers['set-cookie'];

                await axios.post(
                    `${baseUrl}/api/v2/torrents/delete`,
                    `hashes=${hash}&deleteFiles=${deleteFiles}`,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Cookie': cookie
                        }
                    }
                );
                return { success: true };
            }

            if (type === 'Transmission') {
                const rpcUrl = `${baseUrl}/transmission/rpc`;
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                const headers = { 'Authorization': `Basic ${auth}` };
                let sessionId = '';
                try {
                    await axios.get(rpcUrl, { headers });
                } catch (err) {
                    if (err.response && err.response.status === 409) sessionId = err.response.headers['x-transmission-session-id'];
                    else throw err;
                }

                await axios.post(
                    rpcUrl,
                    {
                        method: 'torrent-remove',
                        arguments: {
                            ids: [hash],
                            'delete-local-data': deleteFiles
                        }
                    },
                    { headers: { ...headers, 'X-Transmission-Session-Id': sessionId } }
                );
                return { success: true };
            }

            if (type === 'Mock') {
                console.log(`[Mock] Deleting torrent ${hash} (files=${deleteFiles})`);
                return { success: true };
            }

            return { success: false, message: '不支持的客户端类型' };
        } catch (err) {
            console.error(`Delete torrent failed:`, err.message);
            return { success: false, message: err.message };
        }
    }
}

module.exports = new DownloaderService();

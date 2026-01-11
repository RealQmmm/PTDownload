const axios = require('axios');
const { downloadMTeamTorrent } = require('./mteamDownloader');
const siteService = require('../services/siteService');
const mteamApi = require('./mteamApi');

/**
 * Fetch torrent file data from a URL, handling special sites like M-Team V2
 * @param {object} site - Site object from database
 * @param {string} torrentUrl - The URL to the torrent or API endpoint
 * @returns {Promise<Buffer>} - Torrent file data
 */
async function fetchTorrentData(site, torrentUrl) {
    const authHeaders = siteService.getAuthHeaders(site);
    const isMTeamV2 = site && site.api_key &&
        (site.url.includes('m-team.cc') || site.url.includes('m-team.io'));

    if (isMTeamV2) {
        // M-Team V2: Use API to generate download token
        try {
            const urlObj = new URL(torrentUrl);
            const torrentId = urlObj.searchParams.get('id');

            if (!torrentId) {
                // If the link is already an API link but missing ID, or something else...
                // Actually, if it's M-Team V2, we MUST have a torrent ID.
                throw new Error('无法从 M-Team URL 提取种子 ID: ' + torrentUrl);
            }

            console.log(`[TorrentFetcher] Calling M-Team genDlToken API for ID: ${torrentId}`);

            const tokenResponse = await mteamApi.request('/api/torrent/genDlToken', {
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                data: `id=${torrentId}`,
                timeout: 20000
            });

            const code = tokenResponse.data?.code;
            if (code !== 0 && code !== '0') {
                const errMsg = tokenResponse.data?.message || 'M-Team API 获取下载令牌失败';
                throw new Error(`M-Team API 错误: ${errMsg} (code: ${code})`);
            }

            const downloadUrl = tokenResponse.data?.data;
            if (!downloadUrl) {
                throw new Error('M-Team API 未返回下载链接');
            }

            console.log(`[TorrentFetcher] Downloading actual torrent from M-Team CDN...`);
            return await downloadMTeamTorrent(downloadUrl);
        } catch (err) {
            console.error(`[TorrentFetcher] M-Team V2 fetch failed:`, err.message);
            throw err;
        }
    } else {
        // Standard sites
        console.log(`[TorrentFetcher] Downloading torrent from: ${torrentUrl.substring(0, 80)}...`);
        const https = require('https');
        const response = await axios.get(torrentUrl, {
            headers: authHeaders,
            responseType: 'arraybuffer',
            timeout: 30000,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });

        const buffer = Buffer.from(response.data);

        // Basic validation
        if (buffer.length < 10) {
            throw new Error(`站点返回的数据太小 (${buffer.length} 字节)，可能是认证问题`);
        }

        // Bencoded torrent files start with 'd' (0x64)
        if (buffer[0] !== 0x64) {
            const textContent = buffer.toString('utf-8').substring(0, 100);
            if (textContent.toLowerCase().includes('<html') || textContent.toLowerCase().includes('login')) {
                throw new Error('站点返回了登录页面，请检查 Cookie 是否有效');
            }
            throw new Error('返回的数据不是有效的种子文件');
        }

        return buffer;
    }
}

module.exports = { fetchTorrentData };

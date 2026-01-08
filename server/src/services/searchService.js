const axios = require('axios');
const siteService = require('./siteService');
const siteParsers = require('../utils/siteParsers');
const cheerio = require('cheerio');

const FormatUtils = require('../utils/formatUtils');
const timeUtils = require('../utils/timeUtils');
const appConfig = require('../utils/appConfig');

const { getDB } = require('../db');

class SearchService {
    async search(query, days = null, page = null, siteName = null) {
        const sites = siteService.getAllSites();
        let enabledSites = sites.filter(s => {
            const isEnabled = s.enabled === 1 || s.enabled === true || s.enabled === '1';
            return isEnabled && s.url;
        });

        if (siteName) {
            enabledSites = enabledSites.filter(s => s.name === siteName);
        }

        if (enabledSites.length === 0) {
            console.warn(`Search requested but no enabled sites found. Total sites: ${sites.length}`);
            return [];
        }

        const db = getDB();
        let searchMode = 'browse';
        try {
            const modeRow = db.prepare("SELECT value FROM settings WHERE key = 'search_mode'").get();
            if (modeRow) searchMode = modeRow.value;
        } catch (e) { }

        // Determine page limit
        let maxPages = 1;
        if (page) {
            maxPages = parseInt(page);
        } else {
            try {
                const db = getDB();
                const row = db.prepare("SELECT value FROM settings WHERE key = 'search_page_limit'").get();
                if (row && row.value) {
                    maxPages = parseInt(row.value);
                }
            } catch (err) {
                console.warn('Failed to read search_page_limit setting, defaulting to 1', err);
            }
        }

        // Cap maxPages to avoid abuse/errors
        maxPages = Math.max(1, Math.min(maxPages, 50));

        const siteNames = enabledSites.map(s => s.name).join(', ');
        const isRecentSearch = !query || query.trim() === '';

        console.log(`Starting ${isRecentSearch ? 'recent' : 'keyword'} search ${!isRecentSearch ? `for "${query}"` : ''} via [${searchMode.toUpperCase()}] across [${siteNames}]...`);

        if (searchMode === 'rss') {
            if (isRecentSearch) {
                return this.searchViaRSS(enabledSites);
            } else {
                console.log(`[Search] RSS mode enabled but keyword provided ("${query}"). Falling back to Web Parse mode for better results.`);
            }
        }

        console.log(`Starting ${isRecentSearch ? 'recent' : 'keyword'} search ${!isRecentSearch ? `for "${query}"` : ''} with page limit ${maxPages} across [${siteNames}]...`);

        const searchPromises = enabledSites.map(async (site) => {
            const pageResultsPromises = Array.from({ length: maxPages }, async (_, i) => {
                const currentPage = i;
                try {
                    if (siteService._isMTeamV2(site)) {
                        return await this._searchMTeamV2(site, query, currentPage + 1);
                    }

                    if (site.type === 'Mock') {
                        if (currentPage > 0) return []; // Mock only has one page
                        await new Promise(r => setTimeout(r, 500));
                        let results = siteParsers.parse('', 'Mock', site.url);
                        if (!isRecentSearch) {
                            results = results.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
                        }
                        return results;
                    }

                    // Construct search URL
                    const searchUrl = new URL('/torrents.php', site.url);
                    if (!isRecentSearch) {
                        searchUrl.searchParams.append('search', query);
                    }

                    // Add page parameter (most NexusPHP sites use 0-indexed 'page')
                    if (currentPage > 0) {
                        searchUrl.searchParams.append('page', currentPage);
                    }

                    searchUrl.searchParams.append('notsticky', '1');

                    const headers = siteService.getAuthHeaders(site);

                    const https = require('https');
                    const response = await axios.get(searchUrl.toString(), {
                        headers,
                        timeout: 10000,
                        validateStatus: null, // Capture all statuses
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: false,
                            servername: new URL(site.url).hostname // Explicitly set SNI
                        })
                    });

                    if (response.status !== 200) {
                        return [];
                    }

                    let results = siteParsers.parse(response.data, site.type, site.url);

                    // Filter by days if specified
                    if (days !== null) {
                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - parseInt(days));
                        results = results.filter(item => {
                            const itemDate = new Date(item.date);
                            return !isNaN(itemDate.getTime()) && itemDate >= cutoff;
                        });
                    }
                    return results;
                } catch (err) {
                    console.error(`Search failed for ${site.name} page ${currentPage + 1}:`, err.message);
                    return [];
                }
            });

            const allPagesResults = await Promise.all(pageResultsPromises);
            const flatResults = allPagesResults.flat();

            return flatResults.map(r => ({ ...r, siteName: site.name }));
        });

        const resultsArrays = await Promise.all(searchPromises);
        const allResults = resultsArrays.flat();

        if (isRecentSearch) {
            // Sort by date desc for recent search
            return allResults.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            // Sort by seeders desc for keyword search
            return allResults.sort((a, b) => b.seeders - a.seeders);
        }
    }

    async _searchMTeamV2(site, query, pageNum) {
        try {
            const apiUrl = 'https://api.m-team.cc/api/torrent/search';
            const enableLogs = appConfig.isLogsEnabled();

            const payload = {
                keyword: query || '',
                pageNumber: pageNum,
                pageSize: 100,
                mode: 'NORMAL' // M-Team API mode: NORMAL or ADULT
            };

            if (enableLogs) console.log(`[M-Team V2 Search] Requesting API: ${apiUrl} for query "${query}" page ${pageNum}`);

            const https = require('https');
            const response = await axios.post(apiUrl, payload, {
                headers: {
                    ...siteService.getAuthHeaders(site),
                    'Content-Type': 'application/json'
                },
                timeout: 15000,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                    servername: 'api.m-team.cc'
                })
            });

            if (enableLogs) console.log(`[M-Team V2 Search] Status: ${response.status}, Data present: ${!!response.data}`);

            const code = response.data?.code;
            if (response.data && (code === 0 || code === '0') && response.data.data) {
                const list = response.data.data.data || [];
                if (enableLogs) console.log(`[M-Team V2 Search] Found ${list.length} items`);
                return list.map(item => {
                    const status = item.status || {};
                    const promotion = item.promotion || {};

                    let freeType = '';
                    if (promotion.free) freeType = 'Free';
                    if (promotion.twoUp) freeType = promotion.free ? '2xFree' : '2x';
                    if (promotion.halfDown) freeType = '50%';

                    return {
                        id: String(item.id),
                        name: item.name,
                        subtitle: item.nameEn || '',
                        link: `${site.url}/details.php?id=${item.id}`,
                        torrentUrl: `${site.url}/download.php?id=${item.id}`,
                        size: FormatUtils.formatBytes(parseInt(item.size) || 0),
                        seeders: parseInt(status.seeders) || 0,
                        leechers: parseInt(status.leechers) || 0,
                        date: item.times || item.createdDate || '',
                        isFree: !!(promotion.free || promotion.twoUp || promotion.halfDown),
                        freeType: freeType,
                        category: this._getMTeamCategory(item.category),
                        categoryId: item.category
                    };
                });
            }
            return [];
        } catch (err) {
            console.error(`[M-Team V2 Search] Failed:`, err.response ? JSON.stringify(err.response.data) : err.message);
            return [];
        }
    }

    _getMTeamCategory(id) {
        const catId = parseInt(id);
        // M-Team V2 Category Mapping
        const mapping = {
            401: '电影',
            419: '电影', // Movie-HK/TW
            420: '电影', // Movie-Foreign
            421: '电影', // Movie-En
            439: '电影', // Movie-Misc
            444: '电影', // Movie-Original

            402: '剧集', // Series
            403: '剧集', // TV-Series
            405: '剧集', // TV-HK/TW
            435: '剧集', // TV-Foreign

            413: '动画', // Anime
            414: '动画', // Animation

            406: '音乐', // MV
            408: '音乐', // Audio/Music

            412: '纪录片',
            410: '软件',
            411: '游戏',
            407: '体育',
            409: '其他'
        };
        return mapping[catId] || '其他';
    }

    async searchViaRSS(sites) {
        const promises = sites.map(async (site) => {
            try {
                if (siteService._isMTeamV2(site)) {
                    return await this._searchMTeamV2(site, '', 1);
                }

                if (site.type === 'Mock') {
                    // Mock site fallback to standard parser
                    return siteParsers.parse('', 'Mock', site.url);
                }

                // Construct RSS URL
                let rssUrlObj;
                if (site.default_rss_url) {
                    try {
                        // Use user-provided default RSS URL
                        rssUrlObj = new URL(site.default_rss_url);
                    } catch (e) {
                        console.warn(`Invalid default_rss_url for site ${site.name}: ${site.default_rss_url}, falling back to auto-generated.`);
                    }
                }

                if (!rssUrlObj) {
                    rssUrlObj = new URL('/torrentrss.php', site.url);
                    rssUrlObj.searchParams.append('rows', '50');
                    rssUrlObj.searchParams.append('isize', '1'); // Request size in desc
                    rssUrlObj.searchParams.append('startindex', '0');
                }

                // Note: We don't append 'search' param here because this mode is now strictly for 
                // "Recent Items" (no query). Keyword searches fallback to web parsing.

                const headers = siteService.getAuthHeaders(site);

                const https = require('https');
                const response = await axios.get(rssUrlObj.toString(), {
                    headers,
                    timeout: 15000,
                    validateStatus: null,
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: false,
                        servername: new URL(site.url).hostname
                    })
                });

                if (response.status !== 200) return [];

                const $ = cheerio.load(response.data, { xmlMode: true });
                const results = [];

                $('item').each((i, el) => {
                    const title = $(el).find('title').text();
                    const link = $(el).find('enclosure').attr('url') || $(el).find('link').text();
                    const guid = $(el).find('guid').text() || link;
                    const pubDate = $(el).find('pubDate').text();

                    if (!title || !link) return;

                    // Parse size
                    let size = 0;
                    let sizeStr = $(el).find('size').text();
                    if (!sizeStr) {
                        const desc = $(el).find('description').text();
                        const sizeMatch = desc.match(/Size:\s*([\d\.]+)\s*([KMGT]B?)/i) || desc.match(/([\d\.]+)\s*([KMGT]B?)/i);
                        if (sizeMatch && sizeMatch[1]) {
                            size = FormatUtils.parseSizeToBytes(`${sizeMatch[1]} ${sizeMatch[2]}`);
                            sizeStr = FormatUtils.formatBytes(size);
                        }
                    } else {
                        size = parseInt(sizeStr);
                        sizeStr = FormatUtils.formatBytes(size);
                    }

                    // Try to parse seeders/leechers from description
                    // Format varies: "Size: 1.2GB | Seeder: 123 | Leecher: 4" or similar
                    const desc = $(el).find('description').text();
                    let seeders = 0;
                    let leechers = 0;

                    const seedMatch = desc.match(/(seeders?|seeder|seed|做种|S):\s*(\d+)/i);
                    if (seedMatch) seeders = parseInt(seedMatch[2]);

                    const leechMatch = desc.match(/(leechers?|leecher|leech|下载|L):\s*(\d+)/i);
                    if (leechMatch) leechers = parseInt(leechMatch[2]);

                    results.push({
                        id: guid,
                        name: title,
                        subtitle: '', // RSS usually doesn't have subtitle separate
                        link: link, // Detail page often same as download in RSS or guid
                        torrentUrl: link, // In RSS, link is usually the download link
                        size: sizeStr,
                        sizeBytes: size,
                        seeders,
                        leechers,
                        date: pubDate ? timeUtils.getLocalDateTimeString(new Date(pubDate)) : timeUtils.getLocalDateTimeString(),
                        siteName: site.name,
                        isFree: title.toLowerCase().includes('free') || desc.toLowerCase().includes('free'), // Heuristic
                        freeType: ''
                    });
                });

                return results;

            } catch (err) {
                console.error(`RSS Search failed for ${site.name}:`, err.message);
                return [];
            }
        });

        const results = await Promise.all(promises);
        return results.flat().sort((a, b) => b.seeders - a.seeders);
    }
}

module.exports = new SearchService();

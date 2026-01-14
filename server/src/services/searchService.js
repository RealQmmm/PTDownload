const axios = require('axios');
const siteService = require('./siteService');
const siteParsers = require('../utils/siteParsers');
const cheerio = require('cheerio');

const FormatUtils = require('../utils/formatUtils');
const timeUtils = require('../utils/timeUtils');
const appConfig = require('../utils/appConfig');
const mteamApi = require('../utils/mteamApi');

const { getDB } = require('../db');

/**
 * Retry helper for HTTP requests
 * @param {Function} requestFn - Async function that performs the request
 * @param {number} maxRetries - Maximum number of retries (default: 1)
 * @param {number} retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise} - Result of the request
 */
async function retryRequest(requestFn, maxRetries = 1, retryDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await requestFn();
        } catch (error) {
            lastError = error;

            // Only retry on timeout or network errors
            const isRetryable = error.code === 'ECONNABORTED' ||
                error.code === 'ETIMEDOUT' ||
                error.message?.includes('timeout') ||
                error.message?.includes('ECONNRESET');

            if (attempt < maxRetries && isRetryable) {
                console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }

            throw lastError;
        }
    }
}

class SearchService {
    /**
     * Get search retry count from settings
     * @returns {number} - Number of retries (0 = no retry)
     */
    getSearchRetryCount() {
        try {
            const db = getDB();
            const row = db.prepare("SELECT value FROM settings WHERE key = 'search_retry_count'").get();
            if (row && row.value !== null && row.value !== undefined) {
                const count = parseInt(row.value);
                return isNaN(count) ? 0 : Math.max(0, count);
            }
        } catch (err) {
            console.warn('Failed to read search_retry_count setting:', err.message);
        }
        return 0;
    }

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
                const row = db.prepare("SELECT value FROM settings WHERE key = 'search_page_limit'").get();
                if (row && row.value) maxPages = parseInt(row.value);
            } catch (err) { }
        }
        maxPages = Math.max(1, Math.min(maxPages, 50));

        const isRecentSearch = !query || query.trim() === '';

        const searchPromises = enabledSites.map(async (site) => {
            try {
                // 1. M-Team V2: Always use API
                if (siteService._isMTeamV2(site)) {
                    console.log(`[Search] ${site.name}: Performing ${isRecentSearch ? 'recent' : 'keyword'} search via API...`);
                    const results = await this._searchMTeamV2(site, query, 1);
                    return results.map(r => ({ ...r, siteName: site.name, siteUrl: site.url, siteIcon: site.site_icon }));
                }

                let results = [];
                let triedRSS = false;

                // 2. RSS Mode: Try RSS only if URL is provided
                if (searchMode === 'rss' && site.default_rss_url) {
                    console.log(`[Search] ${site.name}: Performing ${isRecentSearch ? 'recent' : 'keyword'} search via RSS...`);
                    results = await this.searchViaRSS([site], query);
                    triedRSS = true;
                }

                // 3. Fallback or Direct Web Parse
                // Use Web Parse if:
                // - browse mode
                // - rss mode but no RSS URL provided
                // - rss mode with keyword search but zero results found
                const needWebSearch = (!triedRSS) || (!isRecentSearch && results.length === 0);

                if (needWebSearch) {
                    if (triedRSS) {
                        console.log(`[Search] ${site.name}: RSS matched nothing for "${query}". Falling back to Web Parse...`);
                    } else if (searchMode === 'rss') {
                        console.log(`[Search] ${site.name}: No RSS URL configured. Skipping RSS and using Web Parse...`);
                    }
                    results = await this._searchWebPage(site, query, maxPages, days, isRecentSearch);
                }

                return results;
            } catch (err) {
                console.error(`Search failed for ${site.name}:`, err.message);
                return [];
            }
        });

        const resultsArrays = await Promise.allSettled(searchPromises);
        let allResults = [];

        resultsArrays.forEach((res) => {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                allResults.push(...res.value);
            }
        });

        if (isRecentSearch) {
            return allResults.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            return allResults.sort((a, b) => b.seeders - a.seeders);
        }
    }

    async _searchWebPage(site, query, maxPages, days, isRecentSearch) {
        const pageResultsPromises = Array.from({ length: maxPages }, async (_, i) => {
            const currentPage = i;
            try {
                if (site.type === 'Mock') {
                    if (currentPage > 0) return [];
                    await new Promise(r => setTimeout(r, 100));
                    let results = siteParsers.parse('', 'Mock', site.url);
                    if (!isRecentSearch) {
                        results = results.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
                    }
                    return results;
                }

                const searchUrl = new URL('/torrents.php', site.url);
                if (!isRecentSearch) searchUrl.searchParams.append('search', query);
                if (currentPage > 0) searchUrl.searchParams.append('page', currentPage);
                searchUrl.searchParams.append('notsticky', '1');

                const headers = siteService.getAuthHeaders(site);
                const https = require('https');

                const response = await retryRequest(async () => {
                    return await axios.get(searchUrl.toString(), {
                        headers,
                        timeout: 20000,
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: false,
                            servername: new URL(site.url).hostname
                        })
                    });
                }, this.getSearchRetryCount());

                if (response.status !== 200) return [];

                let results = siteParsers.parse(response.data, site.type, site.url);

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
                console.error(`Web search failed for ${site.name} page ${currentPage + 1}:`, err.message);
                return [];
            }
        });

        const allPagesResults = await Promise.all(pageResultsPromises);
        return allPagesResults.flat().map(r => ({ ...r, siteName: site.name, siteUrl: site.url, siteIcon: site.site_icon }));
    }

    async _searchMTeamV2(site, query, pageNum) {
        try {
            const enableLogs = appConfig.isLogsEnabled();
            const payload = {
                keyword: query || '',
                pageNumber: pageNum,
                pageSize: 100,
                mode: 'NORMAL'
            };

            const response = await retryRequest(async () => {
                return await mteamApi.request('/api/torrent/search', {
                    headers: {
                        ...siteService.getAuthHeaders(site),
                        'Content-Type': 'application/json'
                    },
                    data: payload,
                    timeout: 20000,
                    site: site // Pass site config for custom hosts
                });
            }, this.getSearchRetryCount());

            const code = response.data?.code;
            if (response.data && (code === 0 || code === '0') && response.data.data) {
                const list = response.data.data.data || [];
                return list.map(item => {
                    const status = item.status || {};
                    const promotion = item.promotion || {};

                    let freeType = '';
                    const discount = String(promotion.discount || status.discount || '').toUpperCase();

                    if (promotion.twoUpFree || discount.includes('TWO_UP_FREE') || (discount.includes('2X') && discount.includes('FREE'))) {
                        freeType = '2xFree';
                    } else if (promotion.twoUpHalfDown || discount.includes('TWO_UP_HALF_DOWN') || (discount.includes('2X') && (discount.includes('50') || discount.includes('HALF')))) {
                        freeType = '2x50%';
                    } else if (promotion.free || discount.includes('FREE') || promotion.allFree || discount === 'FREE' || discount === 'ALL_FREE') {
                        freeType = (promotion.twoUp || discount.includes('TWO_UP') || discount.includes('2X')) ? '2xFree' : 'Free';
                    } else if (promotion.halfDown || discount.includes('HALF_DOWN') || discount.includes('50') || discount.includes('PERCENT_50')) {
                        freeType = '50%';
                    } else if (promotion.thirtyDown || discount.includes('THIRTY_DOWN') || discount.includes('30') || discount.includes('PERCENT_70')) {
                        freeType = '30%';
                    } else if (promotion.twoUp || discount.includes('TWO_UP') || discount.includes('2X')) {
                        freeType = '2x';
                    }

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
                        isFree: freeType !== '',
                        freeType: freeType,
                        category: this._getMTeamCategory(item.category),
                        categoryId: item.category
                    };
                });
            }
            return [];
        } catch (err) {
            console.error(`[M-Team V2 Search] Failed:`, err.message);
            return [];
        }
    }

    _getMTeamCategory(id) {
        const catId = parseInt(id);
        const mapping = {
            401: '电影', 419: '电影', 420: '电影', 421: '电影', 439: '电影', 444: '电影',
            402: '剧集', 403: '剧集', 405: '剧集', 435: '剧集',
            413: '动画', 414: '动画',
            406: '音乐', 408: '音乐',
            412: '纪录片', 410: '软件', 411: '游戏', 407: '体育', 409: '其他'
        };
        return mapping[catId] || '其他';
    }

    async searchViaRSS(sites, query = null) {
        const isKeywordSearch = query && query.trim() !== '';
        const promises = sites.map(async (site) => {
            try {
                if (siteService._isMTeamV2(site)) {
                    return await this._searchMTeamV2(site, query, 1);
                }

                if (!site.default_rss_url) return [];

                let rssUrlObj;
                try {
                    rssUrlObj = new URL(site.default_rss_url);
                    if (isKeywordSearch && !rssUrlObj.searchParams.has('search')) {
                        rssUrlObj.searchParams.append('search', query);
                    }
                } catch (e) {
                    return [];
                }

                const headers = siteService.getAuthHeaders(site);
                const https = require('https');

                const response = await retryRequest(async () => {
                    return await axios.get(rssUrlObj.toString(), {
                        headers,
                        timeout: 20000,
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: false,
                            servername: new URL(site.url).hostname
                        })
                    });
                }, this.getSearchRetryCount());

                if (response.status !== 200) return [];

                const $ = cheerio.load(response.data, { xmlMode: true });
                const results = [];

                $('item').each((i, el) => {
                    const title = $(el).find('title').text();
                    const link = $(el).find('enclosure').attr('url') || $(el).find('link').text();
                    const guid = $(el).find('guid').text() || link;
                    const pubDate = $(el).find('pubDate').text();

                    if (!title || !link) return;

                    let sizeStr = $(el).find('size').text();
                    const enclosureLength = $(el).find('enclosure').attr('length');

                    if (enclosureLength) {
                        sizeStr = FormatUtils.formatBytes(parseInt(enclosureLength));
                    } else if (!sizeStr) {
                        const desc = $(el).find('description').text();
                        // 优化正则：
                        // 1. 必须有数字 \d
                        // 2. 必须有单位 B (KB, MB, GB, TB)
                        // 3. 可以在 Size: 后面匹配
                        const sizeMatch = desc.match(/Size:\s*(\d+(?:\.\d+)?)\s*([KMGT]B?)/i) ||
                            desc.match(/(\d+(?:\.\d+)?)\s*([KMGT]B)/i); // 如果没有Size前缀，必须带B
                        sizeStr = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}` : '0 B';
                    } else {
                        sizeStr = FormatUtils.formatBytes(parseInt(sizeStr));
                    }

                    const desc = $(el).find('description').text();
                    let seeders = 0, leechers = 0;
                    const seedMatch = desc.match(/(seeders?|S):\s*(\d+)/i);
                    if (seedMatch) seeders = parseInt(seedMatch[2]);
                    const leechMatch = desc.match(/(leechers?|L):\s*(\d+)/i);
                    if (leechMatch) leechers = parseInt(leechMatch[2]);

                    results.push({
                        id: guid,
                        name: title,
                        subtitle: '',
                        link: link,
                        torrentUrl: link,
                        size: sizeStr,
                        seeders, leechers,
                        date: pubDate ? timeUtils.getLocalDateTimeString(new Date(pubDate)) : timeUtils.getLocalDateTimeString(),
                        siteName: site.name,
                        siteUrl: site.url,
                        siteIcon: site.site_icon,
                        category: siteParsers.normalizeCategory($(el).find('category').text()),
                        isFree: title.toLowerCase().includes('free') || desc.toLowerCase().includes('free'),
                        freeType: ''
                    });
                });

                if (isKeywordSearch) {
                    const keywords = query.toLowerCase().split(' ').filter(k => k.length > 0);
                    return results.filter(item => {
                        const title = item.name.toLowerCase();
                        return keywords.every(kw => title.includes(kw));
                    });
                }
                return results;
            } catch (err) {
                return [];
            }
        });

        const resultsArrays = await Promise.all(promises);
        return resultsArrays.flat();
    }
}

module.exports = new SearchService();

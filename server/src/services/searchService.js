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
                    return results.map(r => ({ ...r, siteId: site.id, siteName: site.name, siteUrl: site.url, siteIcon: site.site_icon }));
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
        return allPagesResults.flat().map(r => ({ ...r, siteId: site.id, siteName: site.name, siteUrl: site.url, siteIcon: site.site_icon }));
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

                // Debug: Log first item to see all available fields
                if (enableLogs && list.length > 0) {
                    console.log('[M-Team API] Sample item fields:', Object.keys(list[0]));
                    console.log('[M-Team API] imageList:', list[0].imageList);
                    console.log('[M-Team API] Sample item:', JSON.stringify(list[0], null, 2));
                }

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

                    // Extract promotion time left from M-Team API
                    // Try multiple possible field names (camelCase and snake_case)
                    let promotionTimeLeft = '';
                    const endTimeFields = [
                        status.discountEndTime,
                        status.discount_end_time,
                        promotion.discountEndTime,
                        promotion.discount_end_time,
                        status.promotionTimeRemaining,
                        status.promotion_time_remaining
                    ];

                    for (const endTime of endTimeFields) {
                        if (endTime) {
                            promotionTimeLeft = this._calculateMTeamTimeLeft(endTime);
                            if (promotionTimeLeft) {
                                if (enableLogs) console.log(`[M-Team] Found promotion time: ${promotionTimeLeft}`);
                                break;
                            }
                        }
                    }


                    // Extract poster URL from M-Team API
                    // imageList is an array, take the first image
                    let posterUrl = '';
                    if (item.imageList && Array.isArray(item.imageList) && item.imageList.length > 0) {
                        posterUrl = item.imageList[0];
                    } else if (item.imageList && typeof item.imageList === 'string') {
                        posterUrl = item.imageList;
                    }

                    if (enableLogs && posterUrl) {
                        console.log(`[M-Team] Found poster for ${item.name}: ${posterUrl}`);
                    }

                    // Extract ratings from M-Team API
                    const ratings = {
                        imdb: item.imdbRating || item.imdb || null,
                        douban: item.doubanRating || item.douban || null
                    };

                    // Extract labels (4K, HDR, etc.) from M-Team API
                    let labels = [];
                    if (item.labelsNew && Array.isArray(item.labelsNew)) {
                        labels = item.labelsNew;
                    } else if (item.labels && Array.isArray(item.labels)) {
                        labels = item.labels;
                    }

                    return {
                        id: String(item.id),
                        name: item.name,
                        subtitle: item.nameEn || item.smallDescr || '',
                        link: `${site.url}/details.php?id=${item.id}`,
                        torrentUrl: `${site.url}/download.php?id=${item.id}`,
                        size: FormatUtils.formatBytes(parseInt(item.size) || 0),
                        seeders: parseInt(status.seeders) || 0,
                        leechers: parseInt(status.leechers) || 0,
                        date: siteParsers.parseDate(item.times || item.createdDate || ''),
                        isFree: freeType !== '',
                        freeType: freeType,
                        promotionTimeLeft: promotionTimeLeft,
                        posterUrl: posterUrl,
                        imdbRating: ratings.imdb,
                        doubanRating: ratings.douban,
                        labels: labels,
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

    /**
     * Calculate time left from M-Team discount_end_time timestamp
     * @param {number|string} endTime - Unix timestamp (seconds) or ISO date string
     * @returns {string} - Formatted time like "2d 21h" or "4h 55min"
     */
    _calculateMTeamTimeLeft(endTime) {
        try {
            let endDate;

            // Handle timestamp (seconds)
            if (typeof endTime === 'number' || /^\d+$/.test(endTime)) {
                const timestamp = parseInt(endTime);
                // M-Team API might return seconds or milliseconds
                endDate = timestamp > 10000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
            } else {
                // Handle ISO date string
                endDate = new Date(endTime);
            }

            if (isNaN(endDate.getTime())) {
                return '';
            }

            const now = new Date();
            const diffMs = endDate - now;

            if (diffMs <= 0) {
                return ''; // Already expired
            }

            // Convert to total minutes
            const totalMinutes = Math.floor(diffMs / (1000 * 60));
            const days = Math.floor(totalMinutes / (60 * 24));
            const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
            const minutes = totalMinutes % 60;

            // Format like M-Team: "2d 21h" or "4h 55min"
            if (days > 0) {
                // Has days: show days and hours
                return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
            } else if (hours > 0) {
                // No days, has hours: show hours and minutes
                return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
            } else if (minutes > 0) {
                // Only minutes
                return `${minutes}min`;
            }

            return '';
        } catch (err) {
            console.error('[M-Team] Failed to calculate time left:', err);
            return '';
        }
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
                    const rawLink = $(el).find('link').text();
                    const torrentUrl = $(el).find('enclosure').attr('url') || rawLink;

                    // The 'link' tag in RSS usually points to the details page, 
                    // while 'enclosure' points to the torrent file.
                    // If 'link' looks like a download URL, try to convert it to details page for NexusPHP sites
                    let detailsLink = rawLink;
                    if (detailsLink.includes('download.php') && detailsLink.includes('id=')) {
                        detailsLink = detailsLink.replace('download.php', 'details.php');
                    }

                    const guid = $(el).find('guid').text() || torrentUrl;
                    const pubDate = $(el).find('pubDate').text();

                    if (!title || !torrentUrl) return;

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

                    // Extract Poster URL from description
                    const posterMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
                    const posterUrl = posterMatch ? posterMatch[1] : '';

                    // Extract Ratings from description
                    const imdbMatch = desc.match(/◎IMDb评分[^\d]*(\d+(?:\.\d+)?)/i);
                    const doubanMatch = desc.match(/◎豆瓣评分[^\d]*(\d+(?:\.\d+)?)/i);
                    const tmdbMatch = desc.match(/◎TMDB评分[^\d]*(\d+(?:\.\d+)?)/i) || desc.match(/TMDB:?\s*(\d+(?:\.\d+)?)/i);
                    const imdbRating = imdbMatch ? imdbMatch[1] : '';
                    const doubanRating = doubanMatch ? doubanMatch[1] : '';
                    const tmdbRating = tmdbMatch ? tmdbMatch[1] : '';

                    // Extract common labels from title for non-MTeam sites
                    const labels = [];
                    const t = title.toUpperCase();
                    if (t.includes('4K') || t.includes('2160P')) labels.push('4K');
                    if (t.includes('1080P')) labels.push('1080p');
                    if (t.includes('720P')) labels.push('720p');
                    if (t.includes('HDR')) labels.push('HDR');
                    if (t.includes('DOVI') || t.includes('DOLBY VISION')) labels.push('DoVi');
                    if (t.includes('BLU-RAY') || t.includes('BLURAY')) labels.push('Blu-ray');
                    if (t.includes('REMUX')) labels.push('Remux');
                    if (t.includes('WEB-DL') || t.includes('WEBDL')) labels.push('WEB-DL');

                    results.push({
                        id: guid,
                        name: title,
                        subtitle: '',
                        link: detailsLink,
                        torrentUrl: torrentUrl,
                        size: sizeStr,
                        seeders, leechers,
                        date: pubDate ? timeUtils.getLocalDateTimeString(new Date(pubDate)) : timeUtils.getLocalDateTimeString(),
                        siteId: site.id,
                        siteName: site.name,
                        siteUrl: site.url,
                        siteIcon: site.site_icon,
                        category: siteParsers.normalizeCategory($(el).find('category').text()),
                        isFree: title.toLowerCase().includes('free') || desc.toLowerCase().includes('free'),
                        freeType: '',
                        posterUrl,
                        imdbRating,
                        doubanRating,
                        tmdbRating,
                        labels
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

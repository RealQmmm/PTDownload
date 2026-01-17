const cheerio = require('cheerio');
const { getDB } = require('../db');
const timeUtils = require('../utils/timeUtils');

// Get category map from database
const getCategoryMap = () => {
    try {
        const db = getDB();
        const row = db.prepare("SELECT value FROM settings WHERE key = 'category_map'").get();
        if (row && row.value) {
            return JSON.parse(row.value);
        }
    } catch (e) {
        console.error('[CategoryMap] Failed to load from database:', e.message);
    }

    // Return empty object if no config found
    // This will cause unmatched categories to use default path fallback
    return {};
};

// Normalize category names to standard format
const normalizeCategory = (category) => {
    if (!category) return '';

    const cat = category.toLowerCase().trim();
    const categoryMap = getCategoryMap();

    // Find matching category
    for (const [standardName, aliases] of Object.entries(categoryMap)) {
        if (aliases.some(alias => cat.includes(alias) || alias.includes(cat))) {
            return standardName;
        }
    }

    // If no match, return original (capitalized)
    return category.charAt(0).toUpperCase() + category.slice(1);
};

const parseDate = (dateStr) => {
    if (!dateStr || dateStr === 'Unknown') return timeUtils.getLocalDateTimeString();

    dateStr = dateStr.trim();

    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateStr)) {
        let normalized = dateStr.trim().replace(/\//g, '-').replace(/T/g, ' ');
        // If it's only a date (YYYY-MM-DD), pad with 00:00:00
        if (normalized.length <= 10) {
            normalized += ' 00:00:00';
        }
        // If it's YYYY-MM-DD HH:mm, pad with :00
        else if (normalized.length <= 16 && normalized.includes(':')) {
            const parts = normalized.split(':');
            if (parts.length === 2) normalized += ':00';
        }
        return normalized;
    }

    const date = new Date(); // Start from current time
    let matched = false;

    // Handle HH:mm:ss or HH:mm survival duration (e.g., 05:30:10 or 05:30)
    const hmsMatch = dateStr.match(/^(\d{1,3}):(\d{2})(:(\d{2}))?$/);
    if (hmsMatch) {
        matched = true;
        date.setHours(date.getHours() - parseInt(hmsMatch[1]));
        date.setMinutes(date.getMinutes() - parseInt(hmsMatch[2]));
        if (hmsMatch[4]) {
            date.setSeconds(date.getSeconds() - parseInt(hmsMatch[4]));
        }
    } else {
        // Parse parts like "1年2月", "3月5天", "5天2小时", "5小时30分", "10分钟"
        const unitMap = [
            { regex: /(\d+)\s*(年|y|years?)/i, unit: 'year' },
            { regex: /(\d+)\s*(月|month|mo)/i, unit: 'month' },
            { regex: /(\d+)\s*(周|w|weeks?)/i, unit: 'week' },
            { regex: /(\d+)\s*(天|d|days?)/i, unit: 'day' },
            { regex: /(\d+)\s*(小时|时|h|hours?)/i, unit: 'hour' },
            { regex: /(\d+)\s*(分钟|分|m|mins?|minutes?)/i, unit: 'minute' },
            { regex: /(\d+)\s*(秒|s|secs?|seconds?)/i, unit: 'second' }
        ];

        // Find all matches in the string
        unitMap.forEach(({ regex, unit }) => {
            const matches = dateStr.match(new RegExp(regex.source, 'gi'));
            if (matches) {
                matches.forEach(m => {
                    const value = parseInt(m.match(/\d+/)[0]);
                    matched = true;
                    if (unit === 'year') date.setFullYear(date.getFullYear() - value);
                    else if (unit === 'month') date.setMonth(date.getMonth() - value);
                    else if (unit === 'week') date.setDate(date.getDate() - value * 7);
                    else if (unit === 'day') date.setDate(date.getDate() - value);
                    else if (unit === 'hour') date.setHours(date.getHours() - value);
                    else if (unit === 'minute') date.setMinutes(date.getMinutes() - value);
                    else if (unit === 'second') date.setSeconds(date.getSeconds() - value);
                });
            }
        });
    }

    if (matched) {
        return timeUtils.getLocalDateTimeString(date);
    }

    return timeUtils.getLocalDateTimeString();
};

const parsers = {
    // Default parser for NexusPHP based sites (common for Chinese PT sites)
    NexusPHP: (html, baseUrl) => {
        const $ = cheerio.load(html);
        const results = [];

        // More flexible selector for NexusPHP sites
        let rows = $('.torrents > tbody > tr');
        if (rows.length === 0) rows = $('.torrents tr');
        if (rows.length === 0) rows = $('#torrenttable tr');
        if (rows.length === 0) rows = $('table[border="1"][cellspacing="0"] tr');

        rows.each((i, el) => {
            const cells = $(el).find('td');
            if (cells.length < 5) return;
            if ($(el).find('th').length > 0) return;

            const firstCellText = cells.first().text();
            const secondCellText = cells.eq(1).text();
            if (firstCellText.includes('类型') || secondCellText.includes('标题') || firstCellText.includes('Type') || secondCellText.includes('Title')) {
                return;
            }

            try {
                // Heuristic: The torrent name and link is usually in a link containing 'details.php'
                let detailLink = $(el).find('a[href*="details.php"]').first();
                if (!detailLink.length) {
                    detailLink = $(el).find('a[href*="details.php?id="], a[href^="details.php"]').first();
                }

                if (!detailLink.length) return;

                const name = detailLink.attr('title') || detailLink.text().trim();
                if (!name) return;

                const idMatch = detailLink.attr('href').match(/id=(\d+)/);
                const id = idMatch ? idMatch[1] : null;
                const link = new URL(detailLink.attr('href'), baseUrl).href;

                // Title unit (name + subtitle) is often in the same cell as the detail link
                const titleCell = detailLink.closest('td');
                let subtitle = '';

                // Try multiple extraction methods for subtitle
                const titleCellHtml = titleCell.html() || '';
                const brMatch = titleCellHtml.match(/<br\s*\/?>\s*([^<]+)/i);
                if (brMatch && brMatch[1]) {
                    subtitle = brMatch[1].trim();
                }

                if (!subtitle) {
                    const subtitleSpan = titleCell.find('span.small, span.subtitle, span[style*="smaller"], .torrent-small-info').first();
                    if (subtitleSpan.length) {
                        subtitle = subtitleSpan.text().trim();
                    }
                }

                if (!subtitle && titleCellHtml.includes('<br')) {
                    const parts = titleCellHtml.split(/<br\s*\/?>/i);
                    if (parts.length > 1) {
                        const $sub = cheerio.load('<div>' + parts[1] + '</div>');
                        $sub('img').remove();
                        subtitle = $sub('div').text().trim().replace(/\s+/g, ' ');
                    }
                }

                let size = 'N/A';
                for (let j = 0; j < cells.length; j++) {
                    const text = $(cells[j]).text().trim();
                    if (/^[0-9.]+\s*[MGT]B$/.test(text)) {
                        size = text;
                        break;
                    }
                }

                const downloadLink = $(el).find('a[href*="download.php"]').first();
                const torrentUrl = downloadLink.length ? new URL(downloadLink.attr('href'), baseUrl).href : null;

                let seeders = 0;
                let leechers = 0;

                const seedLink = $(el).find('a[href*="viewpeerlist"][href*="seeder"], a[href*="toseeders"], a[href*="seedl"]').first();
                const leechLink = $(el).find('a[href*="viewpeerlist"]:not([href*="seeder"]), a[href*="toleechers"], a[href*="downl"]').first();

                if (seedLink.length) seeders = parseInt(seedLink.text().trim().replace(/,/g, '')) || 0;
                if (leechLink.length) leechers = parseInt(leechLink.text().trim().replace(/,/g, '')) || 0;

                // Improved text-based fallback (looking for colors common in NexusPHP)
                if (seeders === 0 && leechers === 0) {
                    // Many sites use <font color="green"> or <span class="green"> for seeders
                    const greenText = $(el).find('font[color="green"], span.green, span[style*="green"]').first();
                    if (greenText.length) {
                        const num = parseInt(greenText.text().trim().replace(/,/g, ''));
                        if (!isNaN(num)) seeders = num;
                    }

                    // Red/Orange for leechers
                    const redText = $(el).find('font[color="red"], span.red, span[style*="red"], font[color="#ff0000"]').first();
                    if (redText.length) {
                        const num = parseInt(redText.text().trim().replace(/,/g, ''));
                        if (!isNaN(num)) leechers = num;
                    }
                }

                // Fallback columns: Try to find columns relative to Size
                if (seeders === 0 && leechers === 0) {
                    let sizeIndex = -1;
                    for (let j = 0; j < cells.length; j++) {
                        if (/^[0-9.]+\s*([KMGT]B)$/i.test($(cells[j]).text().trim())) {
                            sizeIndex = j;
                            break;
                        }
                    }

                    if (sizeIndex !== -1 && sizeIndex + 2 < cells.length) {
                        // Usually Seeders is 1 or 2 columns after Size
                        // Size | Seeders | Leechers | Completed | Owner

                        const potentialSeeder = $(cells[sizeIndex + 1]).text().trim().replace(/,/g, '');
                        const potentialLeecher = $(cells[sizeIndex + 2]).text().trim().replace(/,/g, '');

                        if (/^\d+$/.test(potentialSeeder)) seeders = parseInt(potentialSeeder);
                        if (/^\d+$/.test(potentialLeecher)) leechers = parseInt(potentialLeecher);
                    }
                }

                let dateRaw = 'Unknown';
                const isTarget = name.includes('The Upshaws 2026');

                // 强制调试：输出目标种子的各列原始 HTML，查找干扰源
                if (isTarget) {
                    console.log(`[DateDebug] Dumping raw HTML for '${name}':`);
                    cells.each((idx, cellEl) => {
                        const h = $(cellEl).html() || '';
                        console.log(`[DateDebug] Cell ${idx}: ${h.substring(0, 100)}${h.length > 100 ? '...' : ''}`);
                    });
                }

                // 优先从包含日期特征的单元格中寻找完整时间
                for (let j = 0; j < cells.length; j++) {
                    const cell = $(cells[j]);
                    // 跳过前三列（分类、图标、标题），特别跳过 Cell 2 (标题列)，因为它内部常包含置顶到期时间
                    if (j <= 2) continue;

                    const title = (cell.find('*[title]').attr('title') || cell.attr('title') || '').trim();
                    const text = cell.text().trim();
                    // 处理 <br> 导致的日期时间粘连问题：将换行符替换为空格
                    const htmlAsText = (cell.html() || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').trim();
                    const htmlRaw = cell.html() || '';

                    // 排除干扰词库
                    const excludeKeywords = ['置顶', '直到', '过期', 'Sticky', 'Expires', '限时', '永久', '有效'];
                    const sources = [title, text, htmlAsText, htmlRaw];

                    for (let sIdx = 0; sIdx < sources.length; sIdx++) {
                        const src = sources[sIdx];
                        if (!src) continue;

                        // 不区分大小写的排除校验
                        if (excludeKeywords.some(k => src.toLowerCase().includes(k.toLowerCase()))) continue;

                        // 1. 优先匹配：完整年月日时分秒 (支持 - / 和 T，且允许日期时间之间无空格)
                        const fullMatch = src.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}([T\s]*)?\d{1,2}:\d{1,2}(?::\d{1,2})?/);
                        if (fullMatch) {
                            // 标题属性如果不纯（包含干扰字符），跳过
                            if (sIdx === 0 && (src.length > 30 || /[^\d\s\-\/\:T]/.test(src))) continue;

                            dateRaw = fullMatch[0];
                            // 如果匹配结果中间没有空格且非T，补一个空格 (适配粘连情况)
                            if (dateRaw.length >= 10 && !dateRaw.includes(' ') && !dateRaw.includes('T')) {
                                dateRaw = dateRaw.substring(0, 10) + ' ' + dateRaw.substring(10);
                            }
                            if (isTarget) console.log(`[DateDebug] Match(Full): ${dateRaw} from cell ${j} src ${sIdx}`);
                            break;
                        }
                    }
                    if (dateRaw !== 'Unknown') break;
                }

                // 如果没找到完整的，再找短日期 (YYYY-MM-DD)
                if (dateRaw === 'Unknown') {
                    for (let j = 0; j < cells.length; j++) {
                        if (j <= 2) continue;
                        const cell = $(cells[j]);
                        const sources = [(cell.find('*[title]').attr('title') || cell.attr('title') || ''), cell.text().trim()];

                        for (const src of sources) {
                            if (!src || excludeKeywords.some(k => src.toLowerCase().includes(k.toLowerCase()))) continue;
                            const shortMatch = src.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
                            if (shortMatch) {
                                dateRaw = shortMatch[0];
                                if (isTarget) console.log(`[DateDebug] Match(Short): ${dateRaw} from cell ${j}`);
                                break;
                            }
                        }
                        if (dateRaw !== 'Unknown') break;
                    }
                }

                // 如果依然没找到，尝试处理相对时间
                if (dateRaw === 'Unknown') {
                    for (let j = 0; j < cells.length; j++) {
                        if (j <= 2) continue;
                        const text = $(cells[j]).text().trim();
                        if (text.includes('前') || text.includes('昨天') || /^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
                            if (['置顶', '直到', '过期', 'Sticky', 'Expires', '限时', '永久'].some(k => text.includes(k))) continue;
                            dateRaw = text;
                            if (isTarget) console.log(`[DateDebug] Match(Rel): ${dateRaw} from cell ${j}`);
                            break;
                        }
                    }
                }

                if (isTarget) console.log(`[DateDebug] Final match for '${name}': ${dateRaw}`);
                const date = parseDate(dateRaw);


                let isFree = false;
                let freeType = '';
                let isHot = false;
                let isNew = false;
                let promotionTimeLeft = '';

                // Helper function to extract promotion time left
                const extractPromotionTime = (text) => {
                    if (!text) return '';

                    // 匹配各种时间格式
                    const patterns = [
                        // 中文格式：剩余2天3小时、还剩5小时30分
                        /(?:剩余|还剩)[：:\s]*([^<\n]+?)(?:\s|$|<)/i,
                        // 英文格式：Remaining: 2d 3h、Expires in 1h 30m
                        /(?:Remaining|Expires\s+in)[：:\s]*([^<\n]+?)(?:\s|$|<)/i,
                        // 直接匹配时间格式：2天3小时、2d 3h
                        /(\d+\s*(?:天|日|d|day|days))?[\s,]*(\d+\s*(?:小时|时|h|hour|hours))?[\s,]*(\d+\s*(?:分钟|分|m|min|mins|minute|minutes))?/i,
                        // 匹配倒计时格式：2:30:45 (天:时:分)
                        /(\d+):(\d+):(\d+)/
                    ];

                    for (const pattern of patterns) {
                        const match = text.match(pattern);
                        if (match) {
                            let timeStr = match[1] || match[0];

                            // 清理和标准化
                            timeStr = timeStr.trim()
                                .replace(/\s+/g, '')
                                .replace(/,/g, '')
                                .replace(/\n/g, '')
                                .substring(0, 50); // 限制长度

                            // 过滤掉明显不是时间的内容
                            if (timeStr.length > 0 && timeStr.length < 50) {
                                // 如果包含时间单位，认为是有效的
                                if (/\d/.test(timeStr) && (/天|日|时|分|秒|d|h|m|s|day|hour|min|sec/i.test(timeStr) || /^\d+:\d+/.test(timeStr))) {
                                    return timeStr;
                                }
                            }
                        }
                    }

                    return '';
                };

                // Typical NexusPHP promotion images/classes
                const promotionImg = titleCell.find('img.pro_free, img.pro_free2down, img.pro_free2up, img.pro_2xfree, img.pro_50pctdown, img.pro_2x50pctdown, img.pro_30pctdown, img.pro_2x, img.pro_2up, img.pro_twoup, img.pro_twoupfree');
                if (promotionImg.length) {
                    isFree = true;
                    const alt = (promotionImg.attr('alt') || '').toLowerCase();
                    const src = (promotionImg.attr('src') || '').toLowerCase();
                    const cls = (promotionImg.attr('class') || '').toLowerCase();

                    if (src.includes('free') || alt.includes('free') || src.includes('免费') || cls.includes('free')) {
                        const is2x = src.includes('2x') || alt.includes('2x') || src.includes('2up') || src.includes('twoup') ||
                            alt.includes('2倍') || alt.includes('twoup') || cls.includes('2up') || cls.includes('free2up');
                        freeType = is2x ? '2xFree' : 'Free';
                    }
                    else if (src.includes('50pct') || alt.includes('50%') || src.includes('half')) {
                        const is2x = src.includes('2x') || alt.includes('2x') || src.includes('2up') || src.includes('twoup') || alt.includes('2倍');
                        freeType = is2x ? '2x50%' : '50%';
                    }
                    else if (src.includes('30pct') || alt.includes('30%')) {
                        freeType = '30%';
                    }
                    else if (src.includes('2x') || alt.includes('2x') || src.includes('2up') || src.includes('twoup') || alt.includes('2倍') || alt.includes('twoup')) {
                        freeType = '2x';
                    }
                    else {
                        freeType = '促销';
                    }

                    // Extract promotion time left
                    // Method 1: From image title attribute
                    const imgTitle = promotionImg.attr('title') || '';
                    promotionTimeLeft = extractPromotionTime(imgTitle);

                    // Method 2: From next sibling text
                    if (!promotionTimeLeft) {
                        const nextText = promotionImg.next().text() || '';
                        promotionTimeLeft = extractPromotionTime(nextText);
                    }

                    // Method 3: From parent element text (but exclude the torrent name)
                    if (!promotionTimeLeft) {
                        // Clone the parent and remove the main link to avoid extracting torrent name
                        const parentClone = promotionImg.parent().clone();
                        parentClone.find('a[href*="details.php"]').remove();
                        const parentText = parentClone.text() || '';
                        promotionTimeLeft = extractPromotionTime(parentText);
                    }

                    // Method 4: Look for time-related elements near the promotion image
                    if (!promotionTimeLeft) {
                        const timeElements = titleCell.find('span[title], font[title], div[title]');
                        timeElements.each((i, el) => {
                            if (promotionTimeLeft) return;
                            const title = $(el).attr('title') || '';
                            const text = $(el).text() || '';
                            promotionTimeLeft = extractPromotionTime(title) || extractPromotionTime(text);
                        });
                    }
                } else {
                    // Check for font or span with classes
                    const fonts = titleCell.find('font.free, font.twoupfree, font.halfdown, font.twoup, span.free, span.twoupfree, span.twoup');
                    if (fonts.length) {
                        isFree = true;
                        const cls = fonts.attr('class') || '';
                        const text = fonts.text().trim().toLowerCase();

                        if (cls.includes('free') || text.includes('免费')) {
                            if (cls.includes('twoup') || text.includes('2x') || text.includes('2倍')) freeType = '2xFree';
                            else freeType = 'Free';
                        }
                        else if (cls.includes('twoup') || cls.includes('2up') || text.includes('2x') || text.includes('2倍')) {
                            freeType = '2x';
                        }
                        else if (cls.includes('half') || text.includes('50%')) {
                            freeType = '50%';
                        }
                        else {
                            freeType = '促销';
                        }

                        // Try to extract time from font/span title or nearby text
                        const fontTitle = fonts.attr('title') || '';
                        promotionTimeLeft = extractPromotionTime(fontTitle);

                        if (!promotionTimeLeft) {
                            const nextText = fonts.next().text() || '';
                            promotionTimeLeft = extractPromotionTime(nextText);
                        }
                    }
                }

                if (titleCell.find('img.pro_hot').length) isHot = true;
                if (titleCell.find('img.pro_new').length) isNew = true;

                // Extract category/type information
                let category = '';
                let categoryId = null;

                // Method 1: Check first cell for category icon/link
                const firstCell = $(el).find('td').first();
                const catLink = firstCell.find('a[href*="cat="], a[href*="?cat"]').first();
                if (catLink.length) {
                    const catHref = catLink.attr('href');
                    const catMatch = catHref.match(/cat=(\d+)/);
                    if (catMatch) {
                        categoryId = parseInt(catMatch[1]);
                    }

                    // Try to get category name from title or alt
                    category = catLink.attr('title') || catLink.find('img').attr('alt') || catLink.find('img').attr('title') || '';

                    // If no text, try to infer from image src
                    if (!category) {
                        const imgSrc = catLink.find('img').attr('src') || '';
                        // Common patterns: /pic/cat_movie.png, /images/categories/401.png, etc.
                        const srcMatch = imgSrc.match(/cat[_-]?(\w+)|categories?[\/\\](\d+|[a-z]+)/i);
                        if (srcMatch) {
                            category = srcMatch[1] || srcMatch[2] || '';
                        }
                    }
                }

                // Method 2: Check for category in second cell (some sites)
                if (!category) {
                    const secondCell = $(el).find('td').eq(1);
                    const catImg = secondCell.find('img[alt], img[title]').first();
                    if (catImg.length) {
                        category = catImg.attr('alt') || catImg.attr('title') || '';
                    }
                }

                // Method 3: Look for category text in any cell
                if (!category) {
                    for (let j = 0; j < Math.min(3, cells.length); j++) {
                        const cellText = $(cells[j]).text().trim();
                        // Common category names
                        if (/^(电影|剧集|动漫|音乐|综艺|纪录片|软件|游戏|体育|其他|Movie|TV|Anime|Music|Variety|Documentary|Software|Game|Sport|Other)$/i.test(cellText)) {
                            category = cellText;
                            break;
                        }
                    }
                }

                // Normalize category to standard names
                category = normalizeCategory(category);

                // --- Enhanced metadata extraction for Web Preview ---

                // 1. Poster Extraction
                let posterUrl = '';
                // Method A: Look for images with common NexusPHP preview classes
                const previewImg = $(el).find('img.nexus-lazy-load, img.preview, td.embedded img').first();
                if (previewImg.length) {
                    posterUrl = previewImg.attr('data-src') || previewImg.attr('src') || '';
                }
                // Method B: Look for any image whose src contains keywords
                if (!posterUrl) {
                    const allImgs = $(el).find('img');
                    allImgs.each((idx, imgEl) => {
                        const src = $(imgEl).attr('src') || $(imgEl).attr('data-src') || '';
                        if (/poster|thumb|preview|ptgen|small/i.test(src) && !/promotion|pro_|free|hot|new/i.test(src)) {
                            posterUrl = src;
                            return false; // break
                        }
                    });
                }
                // Ensure absolute URL
                if (posterUrl && !posterUrl.startsWith('http')) {
                    posterUrl = new URL(posterUrl, baseUrl).href;
                }

                // 2. Ratings Extraction (from entire row - icons may be in separate cells)
                let imdbRating = '';
                let doubanRating = '';

                // Method A: Icon based - search entire row (not just title cell)
                const getRatingByIcon = (iconSelector) => {
                    // Search in the entire row, not just titleCell
                    const icon = $(el).find(iconSelector).first();
                    if (icon.length) {
                        let val = icon.next('span').text().trim();
                        if (!val) val = icon.parent().text().trim();
                        if (val && val !== 'N/A' && /\d/.test(val)) {
                            const m = val.match(/\d+(?:\.\d+)?/);
                            return m ? m[0] : '';
                        }
                    }
                    return '';
                };

                imdbRating = getRatingByIcon('img[alt*="imdb"i], img[title*="imdb"i]');
                doubanRating = getRatingByIcon('img[alt*="douban"i], img[title*="douban"i]');
                let tmdbRating = getRatingByIcon('img[alt*="tmdb"i], img[title*="tmdb"i]');

                // Method B: Regex Fallback (search in title cell)
                if (!imdbRating || !doubanRating || !tmdbRating) {
                    const titleCellText = titleCell.text() || '';
                    const imdbMatch = titleCellHtml.match(/◎IMDb评分[^\d]*(\d+(?:\.\d+)?)/i) || titleCellText.match(/IMDb:?\s*(\d+(?:\.\d+)?)/i);
                    const doubanMatch = titleCellHtml.match(/◎豆瓣评分[^\d]*(\d+(?:\.\d+)?)/i) || titleCellText.match(/豆瓣:?\s*(\d+(?:\.\d+)?)/i);
                    const tmdbMatch = titleCellHtml.match(/TMDB:?\s*(\d+(?:\.\d+)?)/i) || titleCellText.match(/TMDB:?\s*(\d+(?:\.\d+)?)/i);

                    if (!imdbRating && imdbMatch) imdbRating = imdbMatch[1];
                    if (!doubanRating && doubanMatch) doubanRating = doubanMatch[1];
                    if (!tmdbRating && tmdbMatch) tmdbRating = tmdbMatch[1];
                }

                // 3. Labels Extraction
                const labels = [];

                // A. From title (common quality/format labels)
                const t = name.toUpperCase();
                if (t.includes('4K') || t.includes('2160P')) labels.push('4K');
                if (t.includes('1080P')) labels.push('1080p');
                if (t.includes('720P')) labels.push('720p');
                if (t.includes('HDR')) labels.push('HDR');
                if (t.includes('DOVI') || t.includes('DOLBY VISION')) labels.push('DoVi');
                if (t.includes('BLU-RAY') || t.includes('BLURAY')) labels.push('Blu-ray');
                if (t.includes('REMUX')) labels.push('Remux');
                if (t.includes('WEB-DL') || t.includes('WEBDL')) labels.push('WEB-DL');

                // B. From row HTML (custom site labels like "分集")
                $(el).find('span[title][style*="background-color"]').each((idx, spanEl) => {
                    const labelText = $(spanEl).attr('title') || $(spanEl).text().trim();
                    if (labelText && labelText.length <= 10 && !labels.includes(labelText)) {
                        labels.push(labelText);
                    }
                });

                results.push({
                    id, name, subtitle, link, torrentUrl, size,
                    seeders: parseInt(seeders) || 0,
                    leechers: parseInt(leechers) || 0,
                    date,
                    isFree, freeType, isHot, isNew,
                    promotionTimeLeft,
                    category: category,
                    categoryId: categoryId,
                    posterUrl,
                    imdbRating,
                    doubanRating,
                    tmdbRating,
                    labels
                });
            } catch (err) {
                // Silently skip rows that fail
            }
        });
        return results;
    },

    Mock: () => {
        return [
            {
                id: '1001',
                name: '[Mock] Avatar: The Way of Water (2022) 2160p HDR',
                subtitle: '阿凡达：水之道 (2022) 4K HDR 中文字幕',
                link: 'http://example.com/details.php?id=1001',
                torrentUrl: 'http://example.com/download.php?id=1001',
                size: '25.6 GB',
                seeders: 154,
                leechers: 12,
                date: '2025-01-01 12:00'
            }
        ];
    }
};

const parseUserStats = (html, type) => {
    if (type === 'Mock') {
        return { username: 'MockUser', upload: '12.5 TB', download: '2.3 TB', ratio: '5.43', bonus: '15,204', level: '精英用户', isCheckedIn: false };
    }
    if (type === 'NexusPHP') {
        const $ = cheerio.load(html);
        const stats = { username: '', upload: '', download: '', ratio: '', bonus: '', level: '', isCheckedIn: false };
        const userLink = $('a[href*="userdetails.php"]').first();
        if (userLink.length) stats.username = userLink.text().trim();
        const text = $('body').text();
        const ratioMatch = text.match(/(分享率|Ratio)[:\s]+([\d.]+)/i);
        if (ratioMatch) stats.ratio = ratioMatch[2];
        const uploadMatch = text.match(/(上传量|Uploaded)[:\s]+([\d.]+\s*[MGT]B)/i);
        if (uploadMatch) stats.upload = uploadMatch[2];
        const downloadMatch = text.match(/(下载量|Downloaded)[:\s]+([\d.]+\s*[MGT]B)/i);
        if (downloadMatch) stats.download = downloadMatch[2];
        // Bonus extraction - try multiple patterns
        let bonusMatch = text.match(/(魔力值|Bonus|积分|Karma)[:\s]+([\d,.]+)/i);
        if (!bonusMatch) {
            // Try to find bonus after mybonus.php link (format: "]: 178,186.1 ")
            const mybonusLink = $('a[href*="mybonus.php"]');
            if (mybonusLink.length) {
                const parent = mybonusLink.parent();
                const parentText = parent.text();
                const afterLink = parentText.split(mybonusLink.text())[1];
                if (afterLink) {
                    const numMatch = afterLink.match(/[:\]]\s*([\d,.]+)/);
                    if (numMatch) bonusMatch = ['', '', numMatch[1]];
                }
            }
        }
        if (bonusMatch) stats.bonus = bonusMatch[2];
        const levelMatch = text.match(/(等级|Class|Level)[:\s]+([^\s]+)/i);
        if (levelMatch) stats.level = levelMatch[2];

        // Check-in status detection - Enhanced with more keywords and debug logging
        // Check for disabled checkin button (more specific pattern to avoid false positives)
        const disabledCheckinPattern = /<[^>]*disabled[^>]*(签到|checkin|attendance)[^>]*>|<[^>]*(签到|checkin|attendance)[^>]*disabled[^>]*>/i;
        const hasDisabledCheckin = disabledCheckinPattern.test(html);

        const alreadyCheckedIn = text.includes('已经签到') ||
            text.includes('今日已签到') ||
            text.includes('签到成功') ||
            text.includes('已签到') ||
            text.includes('今天已签') ||
            text.includes('您今天已经签到') ||
            text.includes('您已签到') ||
            text.includes('连续签到') ||
            text.includes('签到已得') ||
            text.includes('这是您的第') ||  // "这是您的第X次签到"
            text.includes('次签到') ||
            text.includes('Attendance successful') ||
            text.includes('You have already attended') ||
            text.includes('You have already earned') ||
            text.includes('Already checked in') ||
            text.includes('already signed in') ||
            text.includes('checked in today') ||
            html.includes('已签到') ||
            html.includes('signed_in') ||
            html.includes('checked_in') ||
            html.includes('attendance_yes') ||
            hasDisabledCheckin;

        // Debug logging (only if system logs enabled)
        const { getDB } = require('../db');
        const db = getDB();
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        if (enableLogs) {
            // Log relevant text snippets for debugging
            const checkinRelatedText = text.match(/.{0,50}(签到|checkin|attendance).{0,50}/gi);
            if (checkinRelatedText && checkinRelatedText.length > 0) {
                console.log(`[Checkin Debug] Found checkin - related text: `, checkinRelatedText.slice(0, 3));
            }
            console.log(`[Checkin Debug]isCheckedIn: ${alreadyCheckedIn} `);
        }

        // Only mark as checked in if we have clear evidence
        stats.isCheckedIn = alreadyCheckedIn;

        return stats;
    }
    return null;
};

module.exports = {
    parse: (html, type, baseUrl) => {
        const parser = parsers[type];
        return parser ? parser(html, baseUrl) : [];
    },
    parseUserStats,
    normalizeCategory,
    parseDate
};

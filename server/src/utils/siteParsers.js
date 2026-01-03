const cheerio = require('cheerio');

const parseDate = (dateStr) => {
    if (!dateStr || dateStr === 'Unknown') return new Date().toISOString();

    dateStr = dateStr.trim();

    // If it looks like a standard absolute date (YYYY-MM-DD...), return it
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateStr)) {
        return dateStr.replace(/\//g, '-');
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
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    return dateStr;
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

                if (seedLink.length) seeders = parseInt(seedLink.text().trim()) || 0;
                if (leechLink.length) leechers = parseInt(leechLink.text().trim()) || 0;

                // Fallback columns
                if (seeders === 0 && leechers === 0 && cells.length >= 7) {
                    for (let j = cells.length - 5; j < cells.length - 1; j++) {
                        if (j < 0) continue;
                        const cellText = $(cells[j]).text().trim();
                        const num = parseInt(cellText);
                        if (!isNaN(num) && num >= 0 && num < 10000 && cellText === String(num)) {
                            if (seeders === 0) seeders = num;
                            else if (leechers === 0) { leechers = num; break; }
                        }
                    }
                }

                let dateRaw = 'Unknown';
                for (let j = 0; j < cells.length; j++) {
                    const cell = $(cells[j]);
                    const title = cell.find('span[title], time[title], a[title]').attr('title') || cell.attr('title');
                    if (title && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(title)) {
                        dateRaw = title;
                        break;
                    }
                }

                const date = parseDate(dateRaw);

                let isFree = false;
                let freeType = '';
                let isHot = false;
                let isNew = false;

                // Typical NexusPHP promotion images/classes
                const promotionImg = titleCell.find('img.pro_free, img.pro_free2down, img.pro_2xfree, img.pro_50pctdown, img.pro_2x50pctdown, img.pro_30pctdown, img.pro_2x');
                if (promotionImg.length) {
                    isFree = true;
                    const alt = promotionImg.attr('alt') || '';
                    const src = promotionImg.attr('src') || '';
                    if (src.includes('free') || alt.includes('Free')) freeType = src.includes('2x') || alt.includes('2x') ? '2xFree' : 'Free';
                    else if (src.includes('50pct') || alt.includes('50%')) freeType = src.includes('2x') || alt.includes('2x') ? '2x50%' : '50%';
                    else if (src.includes('30pct')) freeType = '30%';
                    else freeType = '促销';
                } else {
                    // Check for font or span with classes
                    const fonts = titleCell.find('font.free, font.twoupfree, font.halfdown, span.free, span.twoupfree');
                    if (fonts.length) {
                        isFree = true;
                        const cls = fonts.attr('class');
                        if (cls === 'free') freeType = 'Free';
                        else if (cls === 'twoupfree') freeType = '2xFree';
                        else if (cls === 'halfdown') freeType = '50%';
                        else freeType = '促销';
                    }
                }

                if (titleCell.find('img.pro_hot').length) isHot = true;
                if (titleCell.find('img.pro_new').length) isNew = true;

                results.push({
                    id, name, subtitle, link, torrentUrl, size,
                    seeders: parseInt(seeders) || 0,
                    leechers: parseInt(leechers) || 0,
                    date,
                    isFree, freeType, isHot, isNew
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
        const bonusMatch = text.match(/(魔力值|Bonus|积分|Karma)[:\s]+([\d,.]+)/i);
        if (bonusMatch) stats.bonus = bonusMatch[2];
        const levelMatch = text.match(/(等级|Class|Level)[:\s]+([^\s]+)/i);
        if (levelMatch) stats.level = levelMatch[2];

        // Check-in status detection - Enhanced with more keywords and debug logging
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
            // Check for disabled checkin button (more specific pattern to avoid false positives)
            // The disabled attribute should be on or near the checkin element, not just anywhere on the page
            const disabledCheckinPattern = /<[^>]*disabled[^>]*(签到|checkin|attendance)[^>]*>|<[^>]*(签到|checkin|attendance)[^>]*disabled[^>]*>/i;
        const hasDisabledCheckin = disabledCheckinPattern.test(html);

        // Debug logging (only if system logs enabled)
        const { getDB } = require('../db');
        const db = getDB();
        const logSetting = db.prepare("SELECT value FROM settings WHERE key = 'enable_system_logs'").get();
        const enableLogs = logSetting && logSetting.value === 'true';

        if (enableLogs) {
            // Log relevant text snippets for debugging
            const checkinRelatedText = text.match(/.{0,50}(签到|checkin|attendance).{0,50}/gi);
            if (checkinRelatedText && checkinRelatedText.length > 0) {
                console.log(`[Checkin Debug] Found checkin-related text:`, checkinRelatedText.slice(0, 3));
            }
            console.log(`[Checkin Debug] isCheckedIn: ${alreadyCheckedIn}`);
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
    parseUserStats
};

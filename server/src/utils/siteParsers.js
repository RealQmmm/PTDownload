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

const parseSize = (sizeStr) => {
    // Basic helper to convert 1.2 GB to string or bytes if needed
    // For now returning raw string is fine
    return sizeStr ? sizeStr.trim() : 'N/A';
};

const parsers = {
    // Default parser for NexusPHP based sites (common for Chinese PT sites)
    NexusPHP: (html, baseUrl) => {
        const $ = cheerio.load(html);
        const results = [];

        // Common selector for torrent rows in NexusPHP
        $('.torrents > tbody > tr').each((i, el) => {
            // Skip header row
            if ($(el).find('td').length < 5) return;

            try {
                const titleCell = $(el).find('.embedded').first();
                const titleLink = titleCell.find('a[href*="details.php"]').first();

                if (!titleLink.length) return;

                const name = titleLink.attr('title') || titleLink.text().trim();

                // Get subtitle - NexusPHP sites have various patterns for subtitles
                // Pattern 1: <a>Title</a><br>Subtitle or <a>Title</a><br /><span>Subtitle</span>
                // Pattern 2: Subtitle in a separate span with class like 'small' or 'subtitle'
                // Pattern 3: A second link or text node after the title
                let subtitle = '';

                // Try multiple extraction methods
                const titleCellHtml = titleCell.html() || '';

                // Method 1: Look for <br> followed by content
                const brMatch = titleCellHtml.match(/<br\s*\/?>\s*([^<]+)/i);
                if (brMatch && brMatch[1]) {
                    subtitle = brMatch[1].trim();
                }

                // Method 2: Look for span with subtitle-like classes
                if (!subtitle) {
                    const subtitleSpan = titleCell.find('span.small, span.subtitle, span[style*="smaller"], .torrent-small-info').first();
                    if (subtitleSpan.length) {
                        subtitle = subtitleSpan.text().trim();
                    }
                }

                // Method 3: Look for content after <br> that might be wrapped in tags
                if (!subtitle && titleCellHtml.includes('<br')) {
                    const parts = titleCellHtml.split(/<br\s*\/?>/i);
                    if (parts.length > 1) {
                        // Parse the second part and extract text
                        const $sub = cheerio.load('<div>' + parts[1] + '</div>');
                        // Remove any icons/images and get remaining text
                        $sub('img').remove();
                        subtitle = $sub('div').text().trim();
                        // Clean up - remove excessive whitespace
                        subtitle = subtitle.replace(/\s+/g, ' ').trim();
                    }
                }

                // Method 4: Check for a second anchor that might be subtitle
                if (!subtitle) {
                    const allLinks = titleCell.find('a[href*="details.php"]');
                    if (allLinks.length > 1) {
                        subtitle = $(allLinks[1]).text().trim();
                    }
                }

                const idMatch = titleLink.attr('href').match(/id=(\d+)/);
                const id = idMatch ? idMatch[1] : null;
                const link = new URL(titleLink.attr('href'), baseUrl).href;

                // Determine size, seeds, leechers based on common column positions
                // This is brittle and might need per-site adjustment, but generic NexusPHP usually follows a pattern
                const cells = $(el).find('td');
                // Usually: Type, Name, Flag, Date, Size, Seeders, Leechers, Completed, Owner

                // Heuristics:
                // Find cell with 'MB', 'GB', 'TB' for size
                let size = 'N/A';
                for (let j = 0; j < cells.length; j++) {
                    const text = $(cells[j]).text().trim();
                    if (/^[0-9.]+\s*[MGT]B$/.test(text)) {
                        size = text;
                        break;
                    }
                }

                // Check for download link
                const downloadLink = $(el).find('a[href*="download.php"]').first();
                const torrentUrl = downloadLink.length ? new URL(downloadLink.attr('href'), baseUrl).href : null;

                // Extract seeders and leechers with multiple methods
                let seeders = 0;
                let leechers = 0;

                // Method 1: Look for links with peer list URLs (most reliable)
                const seedLink = $(el).find('a[href*="viewpeerlist"][href*="seeder"], a[href*="toseeders"], a[href*="seedl"]').first();
                const leechLink = $(el).find('a[href*="viewpeerlist"]:not([href*="seeder"]), a[href*="toleechers"], a[href*="downl"]').first();

                if (seedLink.length) {
                    seeders = parseInt(seedLink.text().trim()) || 0;
                }
                if (leechLink.length) {
                    leechers = parseInt(leechLink.text().trim()) || 0;
                }

                // Method 2: Look for cells with specific classes (common in many PT sites)
                if (seeders === 0 && leechers === 0) {
                    const seedCell = $(el).find('td.rowfollow:has(a[href*="peer"]), td.rowfollow span[class*="seed"]').first();
                    const leechCell = $(el).find('td.rowfollow span[class*="leech"]').first();

                    if (seedCell.length) {
                        const seedText = seedCell.find('a, span').first().text().trim() || seedCell.text().trim();
                        seeders = parseInt(seedText) || 0;
                    }
                    if (leechCell.length) {
                        leechers = parseInt(leechCell.text().trim()) || 0;
                    }
                }

                // Method 3: Column-based extraction (NexusPHP typical layout)
                // Usually columns are: Cat, Name, Comments, Date, Size, Seeders, Leechers, Completed, Uploader
                if (seeders === 0 && leechers === 0 && cells.length >= 7) {
                    // Try to find columns by looking for small numbers (seeders/leechers are usually small)
                    for (let j = cells.length - 5; j < cells.length - 1; j++) {
                        if (j < 0) continue;
                        const cellText = $(cells[j]).text().trim();
                        const num = parseInt(cellText);
                        // Check if it's a reasonable number for seeders/leechers (0-9999)
                        if (!isNaN(num) && num >= 0 && num < 10000 && cellText === String(num)) {
                            if (seeders === 0) {
                                seeders = num;
                            } else if (leechers === 0) {
                                leechers = num;
                                break;
                            }
                        }
                    }
                }

                // Method 4: Look for font color patterns (green=seeders, red=leechers)
                if (seeders === 0) {
                    const greenText = $(el).find('font[color="green"], span[style*="color:green"], span[style*="color:#0"], .seeders, td font[class*="free"]').first();
                    if (greenText.length) {
                        seeders = parseInt(greenText.text().trim()) || 0;
                    }
                }
                if (leechers === 0) {
                    const redText = $(el).find('font[color="red"], span[style*="color:red"], .leechers').first();
                    if (redText.length) {
                        leechers = parseInt(redText.text().trim()) || 0;
                    }
                }

                // Find date/time intelligently instead of just nth-child(4)
                let dateRaw = 'Unknown';
                const dateCells = $(el).find('td');

                // First pass: look for ANY title that looks like a full date
                for (let j = 0; j < dateCells.length; j++) {
                    const cell = $(dateCells[j]);
                    const title = cell.find('span[title], time[title], a[title]').attr('title') || cell.attr('title');
                    if (title && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(title)) {
                        dateRaw = title;
                        break;
                    }
                }

                if (dateRaw === 'Unknown') {
                    // Second pass: look for relative time or survival time
                    for (let j = 1; j < dateCells.length; j++) { // Skip cat column
                        const cell = $(dateCells[j]);
                        const text = cell.text().trim();

                        // If it matches HH:mm:ss survival pattern exactly
                        if (/^\d{1,3}:\d{2}:\d{2}$/.test(text)) {
                            // Verify it's not a seeder count cell (usually seeder cells have specific classes or links)
                            if (cell.find('a[href*="viewpeerlist"]').length === 0) {
                                dateRaw = text;
                                break;
                            }
                        }

                        // Absolute date in text
                        if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
                            dateRaw = text;
                            break;
                        }

                        // Relative time keywords
                        if (/(分|小时|时|天|周|月|年|ago|min|hour|day|week|month|year)/i.test(text) && /\d+/.test(text)) {
                            // Avoid taking the name column if it happens to have keywords
                            if (j > 1 && text.length < 50) {
                                dateRaw = text;
                            }
                        }
                    }
                }

                // Final fallback
                if (dateRaw === 'Unknown' && dateCells.length >= 4) {
                    dateRaw = $(dateCells[3]).text().trim();
                }

                const date = parseDate(dateRaw);

                // Extract promotion/free status
                let isFree = false;
                let freeType = ''; // free, 2xfree, 50%, etc.
                let freeUntil = ''; // remaining time
                let isHot = false;
                let isNew = false;

                // Check for free/promotion images or classes
                const rowHtml = $(el).html() || '';

                // Common free patterns in NexusPHP
                if (rowHtml.includes('free') || rowHtml.includes('Free')) {
                    isFree = true;
                    if (rowHtml.includes('2xfree') || rowHtml.includes('2x免费') || rowHtml.includes('twoupfree')) {
                        freeType = '2X免费';
                    } else if (rowHtml.includes('halfdown') || rowHtml.includes('50%')) {
                        freeType = '50%';
                    } else {
                        freeType = '免费';
                    }
                }

                // Check for free promotion icons
                const freeImg = $(el).find('img[class*="free"], img[src*="free"], .free, font.free, span.free');
                if (freeImg.length) {
                    isFree = true;
                    const freeAlt = freeImg.attr('alt') || freeImg.attr('title') || freeImg.text() || '';
                    if (freeAlt.includes('2x') || freeAlt.includes('2X')) {
                        freeType = '2X免费';
                    } else if (freeAlt.includes('50') || freeAlt.includes('half')) {
                        freeType = '50%';
                    } else if (!freeType) {
                        freeType = '免费';
                    }
                }

                // Check for time-limited free (often shown as countdown or time span)
                const freeTimeSpan = $(el).find('span[title*="限时"], span[title*="剩余"], .promotion-time, font[title]');
                if (freeTimeSpan.length) {
                    freeUntil = freeTimeSpan.attr('title') || freeTimeSpan.text().trim();
                    // Clean up the time string
                    const timeMatch = freeUntil.match(/(\d+[天时分秒dhms\s:]+)/i);
                    if (timeMatch) {
                        freeUntil = timeMatch[1].trim();
                    }
                }

                // Check for hot/popular status
                const hotImg = $(el).find('img[src*="hot"], img[class*="hot"], .hot, font.hot');
                if (hotImg.length || rowHtml.includes('hot.gif') || rowHtml.includes('icon_hot')) {
                    isHot = true;
                }

                // Check based on seeders count (if very high, consider hot)
                if (seeders >= 50) {
                    isHot = true;
                }

                // Check for new status
                const newImg = $(el).find('img[src*="new"], img[class*="new"], .new');
                if (newImg.length || rowHtml.includes('new.gif') || rowHtml.includes('icon_new')) {
                    isNew = true;
                }

                results.push({
                    id,
                    name,
                    subtitle,
                    link,
                    torrentUrl,
                    size,
                    seeders: parseInt(seeders) || 0,
                    leechers: parseInt(leechers) || 0,
                    date,
                    isFree,
                    freeType,
                    freeUntil,
                    isHot,
                    isNew
                });

            } catch (err) {
                console.error('Error parsing row:', err);
            }
        });

        return results;
    },

    // Mock parser for testing without real sites
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
                date: '2025-01-01 12:00',
                isFree: true,
                freeType: '2X免费',
                freeUntil: '2天 3小时',
                isHot: true,
                isNew: false
            },
            {
                id: '1002',
                name: '[Mock] Oppenheimer (2023) 1080p BluRay',
                subtitle: '奥本海默 (2023) 1080p 蓝光原盘 简繁中字',
                link: 'http://example.com/details.php?id=1002',
                torrentUrl: 'http://example.com/download.php?id=1002',
                size: '15.2 GB',
                seeders: 89,
                leechers: 5,
                date: '2025-01-02 14:30',
                isFree: true,
                freeType: '免费',
                freeUntil: '',
                isHot: true,
                isNew: true
            },
            {
                id: '1003',
                name: '[Mock] Dune: Part Two (2024) 2160p WEB-DL',
                subtitle: '沙丘2 (2024) 4K 高清网盘',
                link: 'http://example.com/details.php?id=1003',
                torrentUrl: 'http://example.com/download.php?id=1003',
                size: '18.9 GB',
                seeders: 23,
                leechers: 8,
                date: '2025-01-03 09:15',
                isFree: false,
                freeType: '',
                freeUntil: '',
                isHot: false,
                isNew: true
            }
        ];
    }
};

module.exports = {
    parse: (html, type, baseUrl) => {
        const parser = parsers[type];
        if (parser) {
            return parser(html, baseUrl);
        }
        return [];
    }
};

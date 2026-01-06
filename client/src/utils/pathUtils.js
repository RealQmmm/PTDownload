// 根据种子名称和类型字段智能推荐存储路径
// 根据种子名称和类型字段智能推荐存储路径
export const suggestPathByTorrentName = (torrentItem, downloadPaths, options = {}) => {
    if (!torrentItem || !downloadPaths || downloadPaths.length === 0) {
        console.log('[PathSuggest] No torrentItem or downloadPaths');
        return null;
    }

    const {
        match_by_category = true,
        match_by_keyword = true,
        fallback_to_default_path = true,
        use_downloader_default = true,
        category_map = null,
        create_series_subfolder = false  // 新增：是否创建剧集子文件夹
    } = options;

    console.log('[PathSuggest] Item:', torrentItem.name, 'Category:', torrentItem.category);
    console.log('[PathSuggest] Options:', JSON.stringify({
        match_by_category,
        match_by_keyword,
        fallback_to_default_path,
        use_downloader_default,
        has_category_map: !!category_map,
        create_series_subfolder
    }));
    console.log('[PathSuggest] Available paths:', downloadPaths.map(p => p.name).join(', '));

    // 1. 优先使用 PT 站点提供的类型字段
    if (match_by_category && torrentItem.category) {
        const category = torrentItem.category.toLowerCase();

        // 分类别名映射 (不同站点可能使用不同名称)
        const categoryAliases = {
            '动画': ['anime', 'animation', '动画', '番剧', 'アニメ'],
            '剧集': ['tv', 'tv series', 'series', 'episode', '剧集', '电视剧', '美剧', '日剧', '韩剧'],
            '电影': ['movie', 'movies', 'film', 'films', '电影'],
            '音乐': ['music', 'audio', '音乐', 'album'],
            '纪录片': ['documentary', 'docu', '纪录片'],
            '综艺': ['variety', 'show', '综艺'],
            '软件': ['software', 'app', 'application', 'game', '软件', '游戏'],
            '电子书': ['ebook', 'book', 'books', '电子书', '书籍']
        };

        // 直接匹配路径名称
        let exactMatch = downloadPaths.find(p =>
            p.name.toLowerCase() === category ||
            p.name.toLowerCase().includes(category) ||
            category.includes(p.name.toLowerCase())
        );

        // 如果直接匹配失败，尝试通过别名映射匹配
        if (!exactMatch) {
            for (const [pathCategory, aliases] of Object.entries(categoryAliases)) {
                // 检查分类是否在别名列表中
                if (aliases.some(alias => alias === category || category.includes(alias))) {
                    // 找到匹配的别名，尝试匹配对应的路径
                    exactMatch = downloadPaths.find(p =>
                        p.name.toLowerCase() === pathCategory.toLowerCase() ||
                        p.name.toLowerCase().includes(pathCategory.toLowerCase()) ||
                        pathCategory.toLowerCase().includes(p.name.toLowerCase())
                    );
                    if (exactMatch) {
                        console.log('[PathSuggest] ✓ Category alias match:', category, '->', pathCategory, '->', exactMatch.name);
                        break;
                    }
                }
            }
        }

        if (exactMatch) {
            console.log('[PathSuggest] ✓ Exact category match:', exactMatch.name);
            return finalizePathWithSeriesSubfolder(exactMatch, torrentItem, create_series_subfolder);
        }
        console.log('[PathSuggest] ✗ No exact category match for:', category);
    }

    // 2. 回退到基于种子名称的关键词匹配
    if (match_by_keyword) {
        const name = (torrentItem.name || '').toLowerCase();
        const knownCategory = (torrentItem.category || '').toLowerCase(); // PT站点提供的分类

        // 定义关键词映射规则 (优先使用自定义映射)
        const defaultKeywords = {
            '电影': ['movie', 'film', 'bluray', 'bdrip', 'webrip', 'web-dl', 'hdtv', 'remux', '电影'],
            '剧集': ['s0', 's1', 's2', 's3', 's4', 's5', 'season', 'episode', 'ep', '剧集', '美剧', '日剧', '韩剧', '国产剧'],
            '动画': ['anime', 'animation', '动画', '番剧', 'ova', 'ona'],
            '音乐': ['music', 'flac', 'mp3', 'aac', 'wav', 'ape', 'album', 'discography', '音乐', '专辑'],
            '纪录片': ['documentary', 'docu', 'nature', 'bbc', 'discovery', '纪录片'],
            '综艺': ['variety', 'show', 'reality', '综艺', '真人秀'],
            '软件': ['software', 'app', 'game', 'crack', 'keygen', '软件', '游戏'],
            '电子书': ['ebook', 'epub', 'mobi', 'pdf', 'azw3', '电子书', '书籍']
        };

        const pathKeywords = (category_map && Object.keys(category_map).length > 0)
            ? category_map
            : defaultKeywords;

        // 计算每个路径的匹配分数
        const scores = downloadPaths.map(path => {
            let score = 0;
            const pathName = path.name.toLowerCase();

            // ★ 重要：如果PT站点提供了分类，优先使用该分类
            // 给匹配的分类路径加30分基础分，确保它能优先于其他匹配
            if (knownCategory && (
                pathName === knownCategory ||
                pathName.includes(knownCategory) ||
                knownCategory.includes(pathName)
            )) {
                score += 30;
                console.log(`[PathSuggest] ★ Known category boost: ${path.name} +30 (matches "${knownCategory}")`);
            }

            // 检查路径名称是否在关键词映射中
            for (const [category, keywords] of Object.entries(pathKeywords)) {
                if (category.toLowerCase() === pathName || pathName.includes(category.toLowerCase())) {
                    // 检查种子名称是否包含该类别的关键词
                    for (const keyword of keywords) {
                        if (name.includes(keyword)) {
                            score += 10; // 基础匹配分数
                            break; // 找到匹配就跳出
                        }
                    }

                    // 剧集特征检测（独立于关键词匹配）
                    if (category === '剧集') {
                        // 强特征：季数标识（S01, S02, Season 1 等）
                        if (/s\d{1,2}(?![0-9])|season\s*\d{1,2}/i.test(name)) {
                            score += 15; // 季数标识是强特征，给予更高分数
                        }
                        // 弱特征：集数标识（E01, EP01, Episode 等）
                        if (/e\d{1,3}|ep\d{1,3}|episode/i.test(name)) {
                            score += 8;
                        }
                    }

                    // 电影特征检测（独立于关键词匹配）
                    if (category === '电影') {
                        // 年份标识（1900-2099）
                        if (/\b(19|20)\d{2}\b/.test(name)) {
                            score += 5;
                        }
                        // 电影特有格式标识
                        if (/bluray|bdrip|remux|hdtv/i.test(name)) {
                            score += 3;
                        }
                    }

                    // 动画特征检测
                    if (category === '动画') {
                        // 日式番剧命名 ([字幕组] 动漫名 01 720p)
                        if (/\[.*\].*\d{2,3}[vp]?$/i.test(name) || /ova|ona/i.test(name)) {
                            score += 8;
                        }
                        // 美剧格式动画命名 (ShowName S01E01 / ShowName Season 1)
                        // 如果分类是动画但有季数标识，也应该匹配
                        if (/s\d{1,2}(?![0-9])|season\s*\d{1,2}/i.test(name)) {
                            score += 12; // 动画+季数标识
                        }
                    }
                }
            }

            // 直接名称匹配加分（路径名称出现在种子名称中）
            if (name.includes(pathName)) {
                score += 15;
            }

            return { path, score };
        });

        // 打印所有路径的评分（用于调试）
        console.log('[PathSuggest] All scores:', scores.map(s => `${s.path.name}: ${s.score}`).join(', '));

        // 找到最高分的路径
        // 如果评分相同，优先选择剧集路径（因为季数标识是强特征）
        const bestMatch = scores.reduce((best, current) => {
            if (current.score > best.score) {
                return current;
            } else if (current.score === best.score && current.score > 0) {
                // 评分相同时，优先选择剧集路径
                const currentIsEpisode = current.path.name.includes('剧集') || current.path.name.toLowerCase().includes('series');
                const bestIsEpisode = best.path.name.includes('剧集') || best.path.name.toLowerCase().includes('series');
                if (currentIsEpisode && !bestIsEpisode) {
                    return current;
                }
            }
            return best;
        });

        console.log('[PathSuggest] Best match score:', bestMatch.score, 'Path:', bestMatch.path?.name);

        // 如果最高分大于0，返回该路径
        if (bestMatch.score > 0) {
            console.log('[PathSuggest] ✓ Keyword match:', bestMatch.path.name);
            return finalizePathWithSeriesSubfolder(bestMatch.path, torrentItem, create_series_subfolder);
        }
    }

    // 3. 尝试查找默认路径
    if (fallback_to_default_path) {
        console.log('[PathSuggest] Looking for default path...');
        // 优先查找 is_default 为 true 的路径
        let defaultPath = downloadPaths.find(p => p.is_default);

        // 如果没有设置 is_default，再通过名称查找
        if (!defaultPath) {
            defaultPath = downloadPaths.find(p =>
                ['其他', '默认', 'default', 'other'].includes(p.name.toLowerCase())
            );
        }

        if (defaultPath) {
            console.log('[PathSuggest] ✓ Using default path:', defaultPath.name);
            return finalizePathWithSeriesSubfolder(defaultPath, torrentItem, create_series_subfolder);
        }
    }

    // 4. 使用下载器默认路径
    if (use_downloader_default) {
        console.log('[PathSuggest] Using downloader default path as fallback');
        return { name: '下载器默认', path: '', is_default: false };
    }

    console.log('[PathSuggest] No path suggested (all strategies exhausted)');
    return null;
};

/**
 * 检查标题是否包含季数标识 (S01, S01E18, Season 1, 等)
 */
const hasSeasonIdentifier = (title) => {
    if (!title) return false;
    const cleanTitle = title.toUpperCase();
    // 匹配 S01, S01E18, Season 1, Season.1 等格式
    // 允许季数后面紧跟 E（集数标识）
    const seasonRegex = /(?:^|[\s.\[\(])(?:S|Season)[\s.]?(\d+)(?=[EseasonSEASON\s.\-\]\)]|$)/i;
    return seasonRegex.test(cleanTitle);
};

/**
 * 从种子标题中提取剧集名称 (用于创建子文件夹)
 * 规则：从开头截取到季号标识符（包含季号），后面全部舍去
 * 例如: "The OutCast 2016 S01 Complete 2160p" -> "The OutCast 2016 S01"
 */
const extractSeriesName = (title) => {
    if (!title) return 'Unknown Series';

    // 匹配从开头到季号标识符的部分 (S01, S1, Season 1 等)
    const seasonRegex = /^(.+?)\s*(S\d{1,2}|Season\s*\d{1,2})/i;
    const match = title.match(seasonRegex);

    let cleaned;
    if (match) {
        // 组合剧集名称 + 季号标识符
        const seriesNamePart = match[1].trim();
        const seasonPart = match[2].trim().toUpperCase();

        // 规范化季号格式 (Season 1 -> S01, S1 -> S01)
        let normalizedSeason = seasonPart;
        if (seasonPart.toLowerCase().startsWith('season')) {
            const seasonNum = seasonPart.match(/\d+/)[0];
            normalizedSeason = `S${seasonNum.padStart(2, '0')}`;
        } else if (seasonPart.startsWith('S') && seasonPart.length < 4) {
            // S1 -> S01
            const seasonNum = seasonPart.match(/\d+/)[0];
            normalizedSeason = `S${seasonNum.padStart(2, '0')}`;
        }

        cleaned = `${seriesNamePart} ${normalizedSeason}`;
    } else {
        // 回退：如果没有检测到季号，使用原有清理逻辑
        cleaned = title
            .replace(/S\d{1,2}E\d{1,2}(?:-E?\d{1,2})?/gi, '')
            .replace(/Season\s*\d{1,2}/gi, '')
            .replace(/\d{1,2}x\d{2,3}/gi, '')
            .replace(/\d{3,4}p/gi, '')
            .replace(/(?:720|1080|2160|4K|8K)p?/gi, '')
            .replace(/(?:WEB-?DL|BluRay|BDRip|HDTV|WEBRip|DVDRip|REMUX)/gi, '')
            .replace(/(?:H\.?264|H\.?265|HEVC|x264|x265|AVC)/gi, '')
            .replace(/(?:DDP|DD|AAC|AC3|TrueHD|DTS|FLAC|Atmos)[\d.]*(?:[\s.][\d.]+)?/gi, '')
            .replace(/\b(19|20)\d{2}\b/g, '')
            .replace(/[\[\(][^\]\)]*[\]\)]/g, '');
    }

    // 清理结果
    cleaned = cleaned
        // 替换分隔符为空格
        .replace(/[._\-]+/g, ' ')
        // 移除多余空格
        .replace(/\s+/g, ' ')
        // 移除开头的方括号标签 [字幕组] 等
        .replace(/^[\[\(][^\]\)]*[\]\)]\s*/g, '')
        .trim();

    // 移除非法文件名字符
    cleaned = cleaned.replace(/[<>:"/\\|?*]/g, '');

    // 如果清理后的名称太短，使用原始标题的前几个部分
    if (cleaned.length < 3) {
        const parts = title.split(/[.\-_\s]+/);
        cleaned = parts.slice(0, Math.min(3, parts.length)).join(' ');
    }

    // 限制长度
    if (cleaned.length > 100) {
        cleaned = cleaned.substring(0, 100).trim();
    }

    return cleaned || 'Unknown Series';
};

/**
 * 根据设置为路径添加剧集子文件夹
 */
const finalizePathWithSeriesSubfolder = (pathObj, torrentItem, createSeriesSubfolder) => {
    if (!pathObj || !pathObj.path || !createSeriesSubfolder) {
        return pathObj;
    }

    // 只对剧集类资源创建子文件夹
    const name = torrentItem?.name || '';
    if (!hasSeasonIdentifier(name)) {
        return pathObj;
    }

    // 提取剧集名称并追加到路径
    const seriesName = extractSeriesName(name);
    const separator = pathObj.path.includes('\\') ? '\\' : '/';
    const newPath = pathObj.path.endsWith(separator)
        ? pathObj.path + seriesName
        : pathObj.path + separator + seriesName;

    console.log('[PathSuggest] Adding series subfolder:', seriesName);

    return {
        ...pathObj,
        path: newPath,
        originalPath: pathObj.path,  // 保留原始路径供参考
        seriesSubfolder: seriesName
    };
};

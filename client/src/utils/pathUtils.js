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
        category_map = null
    } = options;

    console.log('[PathSuggest] Item:', torrentItem.name, 'Category:', torrentItem.category);
    console.log('[PathSuggest] Options:', JSON.stringify({
        match_by_category,
        match_by_keyword,
        fallback_to_default_path,
        use_downloader_default,
        has_category_map: !!category_map
    }));
    console.log('[PathSuggest] Available paths:', downloadPaths.map(p => p.name).join(', '));

    // 1. 优先使用 PT 站点提供的类型字段
    if (match_by_category && torrentItem.category) {
        const category = torrentItem.category;
        // 直接匹配路径名称
        const exactMatch = downloadPaths.find(p =>
            p.name.toLowerCase() === category.toLowerCase() ||
            p.name.includes(category) ||
            category.includes(p.name)
        );
        if (exactMatch) {
            console.log('[PathSuggest] ✓ Exact category match:', exactMatch.name);
            return exactMatch;
        }
        console.log('[PathSuggest] ✗ No exact category match for:', category);
    }

    // 2. 回退到基于种子名称的关键词匹配
    if (match_by_keyword) {
        const name = (torrentItem.name || '').toLowerCase();

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

            // 检查路径名称是否在关键词映射中
            for (const [category, keywords] of Object.entries(pathKeywords)) {
                if (category.toLowerCase() === pathName || pathName.includes(category.toLowerCase())) {
                    // 检查种子名称是否包含该类别的关键词
                    for (const keyword of keywords) {
                        if (name.includes(keyword)) {
                            score += 10; // 基础匹配分数

                            // 如果是剧集，额外检查季数标识
                            if (category === '剧集' && /s\d{1,2}|season\s*\d{1,2}/i.test(name)) {
                                score += 5;
                            }

                            // 如果是电影，检查年份标识
                            if (category === '电影' && /\d{4}/.test(name)) {
                                score += 3;
                            }

                            break; // 找到匹配就跳出
                        }
                    }
                }
            }

            // 直接名称匹配加分
            if (name.includes(pathName)) {
                score += 15;
            }

            return { path, score };
        });

        // 找到最高分的路径
        const bestMatch = scores.reduce((best, current) =>
            current.score > best.score ? current : best
        );

        console.log('[PathSuggest] Best match score:', bestMatch.score, 'Path:', bestMatch.path?.name);

        // 如果最高分大于0，返回该路径
        if (bestMatch.score > 0) {
            console.log('[PathSuggest] ✓ Keyword match:', bestMatch.path.name);
            return bestMatch.path;
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
            return defaultPath;
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

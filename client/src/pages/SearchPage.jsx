import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { FormatUtils } from '../utils/formatUtils';
import { suggestPathByTorrentName } from '../utils/pathUtils';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SiteSelector from '../components/ui/SiteSelector';
import PromotionTimeCapsule from '../components/ui/PromotionTimeCapsule';

// Helper function to get category color
const getCategoryColor = (category, darkMode) => {
    const colorMap = {
        '电影': darkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700',
        '剧集': darkMode ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-100 text-pink-700',
        '动画': darkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700',
        '音乐': darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
        '综艺': darkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700',
        '纪录片': darkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700',
        '软件': darkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700',
        '游戏': darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700',
        '体育': darkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700',
        '学习': darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
        '其他': darkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700'
    };
    return colorMap[category] || (darkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700');
};

// Helper function to get category icon
const getCategoryIcon = (category) => {
    const iconMap = {
        '电影': '🎬',
        '剧集': '📺',
        '动画': '🎨',
        '音乐': '🎵',
        '综艺': '🎭',
        '纪录片': '📚',
        '软件': '💻',
        '游戏': '🎮',
        '体育': '⚽',
        '学习': '📖',
        '其他': '📦'
    };
    return iconMap[category] || '📦';
};

// Helper function to get hot score color
const getHotScoreColor = (score) => {
    if (score >= 80) return 'text-red-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
};

// Helper function to get risk label style
const getRiskLabelStyle = (level, darkMode) => {
    switch (level) {
        case 'GREAT': return darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700';
        case 'SAFE': return darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700';
        case 'RISKY': return darkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700';
        case 'TRASH': return darkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600';
        default: return '';
    }
};

// Helper function to get label color based on label type
const getLabelColor = (label, darkMode) => {
    const upperLabel = label.toUpperCase();

    // Quality/Format labels (technical specs)
    const qualityColors = {
        '4K': darkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700',
        '2160P': darkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700',
        '1080P': darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
        '720P': darkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700',
        'HDR': darkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700',
        'DOVI': darkMode ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-100 text-pink-700',
        'BLU-RAY': darkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700',
        'BLURAY': darkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700',
        'REMUX': darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
        'WEB-DL': darkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700',
        'WEBDL': darkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
    };

    // Check if it's a quality label
    if (qualityColors[upperLabel]) {
        return qualityColors[upperLabel];
    }

    // Custom site labels (Chinese characters, like "分集")
    // Use a hash-based color assignment for consistency
    const customLabelColors = [
        darkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700',
        darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700',
        darkMode ? 'bg-lime-500/20 text-lime-400' : 'bg-lime-100 text-lime-700',
        darkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700',
        darkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-700',
        darkMode ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-700',
        darkMode ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-fuchsia-100 text-fuchsia-700'
    ];

    // Simple hash function for consistent color assignment
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % customLabelColors.length;
    return customLabelColors[colorIndex];
};

const SearchPage = ({ searchState, setSearchState }) => {
    const { darkMode, authenticatedFetch, hotResourcesEnabled } = useTheme();
    const [query, setQuery] = useState(searchState?.query || '');
    const [results, setResults] = useState(searchState?.results || []);

    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(searchState?.searched || false);
    const [searchMode, setSearchMode] = useState(searchState?.searchMode || 'keyword'); // 'keyword' or 'recent'
    const [downloading, setDownloading] = useState(null);
    const [clients, setClients] = useState([]);
    const [sites, setSites] = useState([]);
    const [selectedSite, setSelectedSite] = useState('');
    const [autoDownloadEnabled, setAutoDownloadEnabled] = useState(false);
    const [enableCategoryManagement, setEnableCategoryManagement] = useState(false);
    // Auto download options
    const [matchByCategory, setMatchByCategory] = useState(true);
    const [matchByKeyword, setMatchByKeyword] = useState(true);
    const [fallbackToDefaultPath, setFallbackToDefaultPath] = useState(true);
    const [useDownloaderDefault, setUseDownloaderDefault] = useState(true);
    const [categoryMap, setCategoryMap] = useState(null);
    const [createSeriesSubfolder, setCreateSeriesSubfolder] = useState(false);

    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const [showClientModal, setShowClientModal] = useState(false);
    const [pendingDownload, setPendingDownload] = useState(null);
    const [downloadPaths, setDownloadPaths] = useState([]);
    const [selectedPath, setSelectedPath] = useState('');
    const [isCustomPath, setIsCustomPath] = useState(false);
    const [customPath, setCustomPath] = useState('');
    const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
    const [enableMultiPath, setEnableMultiPath] = useState(false);

    // Hot Resources State
    const [viewMode, setViewMode] = useState('search'); // 'search' | 'hot-resources'
    const [hotResourcesMasterEnabled, setHotResourcesMasterEnabled] = useState(false);
    const [hotResources, setHotResources] = useState([]);
    const [hotResourcesStats, setHotResourcesStats] = useState({ total: 0, pending: 0, notified: 0 });
    const [minHotScore, setMinHotScore] = useState(30);
    const [showUnreadOnly, setShowUnreadOnly] = useState(true);

    // Mobile swipe state
    const [touchStartX, setTouchStartX] = useState(null);
    const [swipedLinkId, setSwipedLinkId] = useState(null);

    // Poster preview state
    const [posterPreview, setPosterPreview] = useState(null);

    // Category filter state
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Label filter state
    const [selectedLabel, setSelectedLabel] = useState(null);

    const handleTouchStart = (e) => {
        setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e, linkId) => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX;

        // Threshold of 50px for swipe detection
        if (deltaX < -50) {
            setSwipedLinkId(linkId);
        } else if (deltaX > 50) {
            setSwipedLinkId(null);
        }
        setTouchStartX(null);
    };
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';

    // Fetch clients on mount - using aggregated endpoint for performance
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Single aggregated request instead of 4 separate ones
                const initRes = await authenticatedFetch('/api/search/init');
                const { clients: clientsData, sites: sitesData, paths: pathsData, settings: settingsData } = await initRes.json();

                setClients(clientsData || []);
                setSites(sitesData || []);
                setDownloadPaths(pathsData || []);
                if (pathsData && pathsData.length > 0) {
                    setSelectedPath(pathsData[0].path);
                }

                // Apply settings
                const categoryMgmt = settingsData.enable_category_management !== 'false';
                const autoEnabled = settingsData.auto_download_enabled === 'true';
                setEnableCategoryManagement(categoryMgmt);
                setAutoDownloadEnabled(categoryMgmt && autoEnabled);
                setMatchByCategory(settingsData.match_by_category !== 'false');
                setMatchByKeyword(settingsData.match_by_keyword !== 'false');
                setFallbackToDefaultPath(settingsData.fallback_to_default_path !== 'false');
                setUseDownloaderDefault(settingsData.use_downloader_default !== 'false');

                // Load default download path and multi-path switch
                setDefaultDownloadPath(settingsData.default_download_path || '');
                setEnableMultiPath(settingsData.enable_multi_path === 'true' || settingsData.enable_multi_path === true);
                setCreateSeriesSubfolder(settingsData.create_series_subfolder === 'true' || settingsData.create_series_subfolder === true);

                // Load master enabled status for hot resources
                const masterEnabled = settingsData.hot_resources_enabled === 'true';
                setHotResourcesMasterEnabled(masterEnabled);
                if (!masterEnabled && viewMode === 'hot-resources') {
                    setViewMode('search');
                }

                if (settingsData.hot_resources_rules) {
                    try {
                        const rules = JSON.parse(settingsData.hot_resources_rules);
                        if (rules.scoreThreshold) {
                            setMinHotScore(parseInt(rules.scoreThreshold) || 30);
                        }
                    } catch (e) {
                        console.error('Failed to parse hot resources rules:', e);
                    }
                }

                if (settingsData.category_map) {
                    try {
                        setCategoryMap(JSON.parse(settingsData.category_map));
                    } catch (e) {
                        console.error('Failed to parse category map:', e);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch initialization data:', err);
            }
        };
        fetchData();

        // Fetch hot resources stats
        if (hotResourcesMasterEnabled) {
            fetchHotResourcesStats();
        }
    }, [authenticatedFetch, hotResourcesMasterEnabled, viewMode]);

    const fetchHotResourcesStats = async () => {
        try {
            const res = await authenticatedFetch('/api/hot-resources/stats');
            const data = await res.json();
            if (data.success) {
                setHotResourcesStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch hot resources stats:', err);
        }
    };

    const fetchHotResources = async () => {
        setLoading(true);
        try {
            let url = `/api/hot-resources?limit=50&minScore=${minHotScore}`;
            // If showing unread only, filter by notified=true (meaning new/notified ones) 
            // BUT actually 'pending' action usually means user hasn't handled it. 
            // The API supports 'notified' filter. Let's assume 'pending' items are what we want to highlight.
            // Let's just fetch all for now and filter client side or use default sort.
            // Actually, let's fetch based on user preference if we had one.
            // For now, let's just fetch recent ones.

            const res = await authenticatedFetch(url);
            const data = await res.json();
            if (data.success) {
                // Map to compatible format for the table
                const mapped = data.resources.map(r => ({
                    ...r,
                    name: r.title,
                    link: r.url, // Original link
                    date: r.detected_time || r.publish_time,
                    siteId: r.site_id,
                    siteName: r.site_name,
                    isHot: true,
                    hotScore: r.hot_score,
                    riskLabel: (() => {
                        if (r.risk_level === 'GREAT' || r.hot_score >= 90) return '绝佳机会';
                        if (r.risk_level === 'SAFE' || r.hot_score >= 70) return '安全理财';
                        if (r.risk_level === 'RISKY' || r.hot_score >= 40) return '高能博弈';
                        return '风险极大';
                    })(),
                    riskLevel: (() => {
                        if (r.risk_level) return r.risk_level;
                        if (r.hot_score >= 90) return 'GREAT';
                        if (r.hot_score >= 70) return 'SAFE';
                        if (r.hot_score >= 40) return 'RISKY';
                        return 'TRASH';
                    })(),
                    torrentUrl: r.download_url,
                    size: FormatUtils.formatBytes(r.size),
                    seeders: parseInt(r.seeders) || 0,
                    leechers: parseInt(r.leechers) || 0,
                    isFree: r.promotion && (r.promotion.includes('Free') || r.promotion.includes('2x')),
                    freeType: r.promotion
                }));
                // Sort by hotScore descending
                mapped.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
                setHotResources(mapped);
            }
        } catch (err) {
            console.error('Failed to fetch hot resources:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSwitchMode = (mode) => {
        setViewMode(mode);
        if (mode === 'hot-resources') {
            fetchHotResources();
            // Clear search query to avoid confusion
            // setQuery(''); 
        }
    };

    const markAsRead = async () => {
        try {
            // We don't have a bulk mark-read API yet, but let's assume visiting the page is enough 
            // or we add a button. 
            // For now, let's just refresh stats.
            fetchHotResourcesStats();
        } catch (e) { }
    };

    // Save state to parent when it changes
    useEffect(() => {
        if (setSearchState) {
            setSearchState({ query, results, searched, searchMode });
        }
    }, [query, results, searched, searchMode]);

    const getDomain = (url) => {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return '';
        }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();

        setLoading(true);
        setResults([]);
        setSearched(true);

        const trimmedQuery = query.trim();
        const mode = trimmedQuery ? 'keyword' : 'recent';
        setSearchMode(mode);

        try {
            const url = trimmedQuery
                ? `/api/search?q=${encodeURIComponent(trimmedQuery)}&site=${encodeURIComponent(selectedSite)}`
                : `/api/search?days=1&site=${encodeURIComponent(selectedSite)}`;
            const res = await authenticatedFetch(url);
            const data = await res.json();

            if (data) {
                const searchResults = Array.isArray(data) ? data : (data.results || []);

                // Check download status for each result
                try {
                    const checkRes = await authenticatedFetch('/api/search/check-downloaded', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            items: searchResults.map(item => ({
                                link: item.link,
                                name: item.name
                            }))
                        })
                    });
                    const downloadStatus = await checkRes.json();

                    // Merge download status into results
                    const resultsWithStatus = searchResults.map((item, index) => ({
                        ...item,
                        isDownloaded: downloadStatus[index] || false
                    }));

                    setResults(resultsWithStatus);
                } catch (statusErr) {
                    console.warn('Failed to check download status:', statusErr);
                    // Fallback: show results without download status
                    setResults(searchResults);
                }
            } else {
                setResults([]);
            }
        } catch (err) {
            console.error('Search failed:', err);
            alert(trimmedQuery ? '搜索失败，请重试' : '获取近期资源失败');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadClick = (item) => {
        try {
            if (!clients || clients.length === 0) {
                alert('请先在"下载器管理"中添加下载客户端');
                return;
            }

            // ========== 多路径管理开启：智能下载或高级选择 ==========
            if (enableMultiPath) {
                // 准备智能推荐选项
                const suggestOptions = {
                    match_by_category: matchByCategory,
                    match_by_keyword: matchByKeyword,
                    fallback_to_default_path: fallbackToDefaultPath,
                    use_downloader_default: useDownloaderDefault,
                    category_map: categoryMap,
                    create_series_subfolder: createSeriesSubfolder
                };

                // 使用智能路径推荐（分类管理开启时才匹配）
                let suggestedPath = null;
                if (enableCategoryManagement) {
                    try {
                        suggestedPath = suggestPathByTorrentName(item, downloadPaths, suggestOptions);
                    } catch (e) {
                        console.warn('Smart path suggestion failed:', e);
                    }
                }

                if (suggestedPath) {
                    setSelectedPath(suggestedPath.path);
                    setIsCustomPath(false);
                }

                // 智能下载模式：自动匹配后弹出确认框
                if (autoDownloadEnabled) {
                    const defaultClient = clients.find(c => c.is_default) || clients[0];
                    const clientName = defaultClient.name || defaultClient.type;

                    if (!suggestedPath) {
                        // 如果没有匹配到路径，询问是否手动选择
                        if (confirm('智能下载路径匹配失败（所有策略均未命中）。是否手动选择路径？')) {
                            setPendingDownload(item);
                            setShowClientModal(true);
                        }
                        return;
                    }

                    // 弹出确认框显示匹配的路径
                    const pathName = downloadPaths.find(p => p.path === suggestedPath.path)?.name || '自动匹配';
                    const pathInfo = suggestedPath.path
                        ? `\n保存路径: ${pathName} (${suggestedPath.path})`
                        : '\n保存路径: 下载器默认路径';

                    if (window.confirm(`智能下载确认\n\n下载器: [${clientName}]${pathInfo}\n\n资源: "${item.name}"\n大小: ${item.size}\n\n确认下载吗？`)) {
                        executeDownload(item, defaultClient.id, suggestedPath.path);
                    }
                    return;
                }

                // 分类管理开启但智能下载关闭：显示模态框（已预选路径）
                // 分类管理关闭：显示模态框（用户手动选择）
                setPendingDownload(item);

                // 使用 setTimeout 确保 selectedPath 状态更新后再显示模态框
                // React 状态更新是异步的，不这样做的话模态框可能显示旧的选中状态
                setTimeout(() => {
                    setShowClientModal(true);
                }, 0);
                return;
            }

            // ========== 多路径管理关闭：简单模式 ==========
            // 简单模式：只有一个下载器时，显示简化确认框
            if (clients.length === 1) {
                const client = clients[0];
                const clientName = client.name || client.type;
                const pathInfo = defaultDownloadPath
                    ? `\n保存路径: ${defaultDownloadPath}`
                    : '\n保存路径: 下载器默认路径';

                if (window.confirm(`确认下载到 [${clientName}] 吗？${pathInfo}\n\n资源: "${item.name}"\n大小: ${item.size}`)) {
                    executeDownload(item, client.id, defaultDownloadPath || null);
                }
                return;
            }

            // 多个下载器：显示选择下载器的模态框（但不显示路径选择）
            setPendingDownload(item);
            setShowClientModal(true);

        } catch (err) {
            console.error('Download handling error:', err);
            alert('准备下载时出错: ' + err.message);
        }
    };



    const handleConfirmDownload = async (clientId) => {
        if (pendingDownload) {
            let finalPath;

            if (enableMultiPath) {
                // 多路径模式：使用用户选择的路径
                finalPath = isCustomPath ? customPath : selectedPath;
            } else {
                // 简单模式：使用默认下载路径
                finalPath = defaultDownloadPath || null;
            }

            await executeDownload(pendingDownload, clientId, finalPath);
        }
        setShowClientModal(false);
        setPendingDownload(null);
        setIsCustomPath(false);
        setCustomPath('');
    };

    const executeDownload = async (item, clientId, savePath = null) => {
        setDownloading(item.link);
        try {
            let url = '/api/download';
            let body = {
                torrentUrl: item.torrentUrl,
                clientId: clientId,
                title: item.name,
                size: item.size,
                siteId: item.siteId,
                savePath: savePath
            };

            // Enhanced logic for hot resources
            if (item.isHot && item.id) {
                url = `/api/hot-resources/${item.id}/download`;
                body = {
                    clientId: clientId,
                    savePath: savePath
                };
            }

            const res = await authenticatedFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (res.ok && data.success) {
                alert(data.message || '添加下载成功');
                // Refresh hot resources if needed
                if (viewMode === 'hot-resources') {
                    fetchHotResources();
                    fetchHotResourcesStats();
                }
            } else {
                alert(data.message || data.error || '添加下载失败');
            }
        } catch (err) {
            alert('请求失败: ' + err.message);
        } finally {
            setDownloading(null);
        }
    };

    // Download torrent file to browser
    const downloadTorrentFile = async (item) => {
        try {
            const res = await authenticatedFetch('/api/download/torrent-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    torrentUrl: item.torrentUrl,
                    title: item.name
                })
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.message || '下载种子文件失败');
                return;
            }

            // Get the response as blob and trigger download
            const blob = await res.blob();
            const filename = item.name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100) + '.torrent';
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert('下载种子文件失败: ' + err.message);
        }
    };

    // Sorting and Filtering Logic
    const sortedResults = useMemo(() => {
        let items = [...(viewMode === 'search' ? results : hotResources)];

        // Apply category filter
        if (selectedCategory) {
            items = items.filter(item => item.category === selectedCategory);
        }

        // Apply label filter
        if (selectedLabel) {
            items = items.filter(item => item.labels && item.labels.includes(selectedLabel));
        }

        if (!sortConfig.key) return items;

        return items.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'size') {
                valA = FormatUtils.parseSizeToBytes(valA);
                valB = FormatUtils.parseSizeToBytes(valB);
            } else if (sortConfig.key === 'seeders' || sortConfig.key === 'leechers') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            } else if (sortConfig.key === 'hotScore') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            } else if (sortConfig.key === 'date') {
                // Enhanced date parsing to handle various formats
                const parseDate = (dateStr) => {
                    if (!dateStr) return 0;

                    // Try direct parsing first
                    let date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        return date.getTime();
                    }

                    // Handle relative time formats (e.g., "5分钟前", "2小时前")
                    const now = Date.now();

                    // Match patterns like "X分钟前", "X小时前", "X天前"
                    const relativeMatch = dateStr.match(/(\d+)\s*(分钟|小时|天|周|月|年)/);
                    if (relativeMatch) {
                        const value = parseInt(relativeMatch[1]);
                        const unit = relativeMatch[2];

                        const multipliers = {
                            '分钟': 60 * 1000,
                            '小时': 60 * 60 * 1000,
                            '天': 24 * 60 * 60 * 1000,
                            '周': 7 * 24 * 60 * 60 * 1000,
                            '月': 30 * 24 * 60 * 60 * 1000,
                            '年': 365 * 24 * 60 * 60 * 1000
                        };

                        return now - (value * (multipliers[unit] || 0));
                    }

                    // Try parsing as ISO string with timezone
                    const isoMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
                    if (isoMatch) {
                        date = new Date(`${isoMatch[1]}T${isoMatch[2]}`);
                        if (!isNaN(date.getTime())) {
                            return date.getTime();
                        }
                    }

                    return 0; // Invalid date
                };

                valA = parseDate(valA);
                valB = parseDate(valB);
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [results, hotResources, viewMode, sortConfig, selectedCategory, selectedLabel]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <span className="ml-1 opacity-30">↕</span>;
        return <span className="ml-1 text-blue-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    // Extract available categories from current results
    const availableCategories = useMemo(() => {
        const items = viewMode === 'search' ? results : hotResources;
        const categories = new Set();
        items.forEach(item => {
            if (item.category) {
                categories.add(item.category);
            }
        });
        return Array.from(categories).sort();
    }, [results, hotResources, viewMode]);

    // Extract available labels from current results
    const availableLabels = useMemo(() => {
        const items = viewMode === 'search' ? results : hotResources;
        const labels = new Set();
        items.forEach(item => {
            if (item.labels && Array.isArray(item.labels)) {
                item.labels.forEach(label => labels.add(label));
            }
        });
        return Array.from(labels).sort();
    }, [results, hotResources, viewMode]);

    const handleManualDetect = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/settings/hot-resources/detect', {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                // Refresh list after detection
                fetchHotResources();
                fetchHotResourcesStats();
                alert(`检测完成：发现 ${data.totalNew} 个新资源`);
            } else {
                alert('检测失败: ' + data.message);
            }
        } catch (err) {
            console.error('Detection failed:', err);
            alert('检测请求失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-2 sm:p-4 md:p-8 flex flex-col">
            <div className="flex justify-between items-center mb-4 md:mb-6">
                <h1 className={`hidden sm:block text-2xl md:text-3xl font-bold ${textPrimary} flex items-center`}>
                    {viewMode === 'search' ? '资源搜索' : '🔥 热门资源'}
                </h1>

                {hotResourcesMasterEnabled && (
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button
                            onClick={() => handleSwitchMode('search')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'search'
                                ? 'bg-white dark:bg-gray-700 shadow-sm ' + textPrimary
                                : textSecondary + ' hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            搜索
                        </button>
                        <button
                            onClick={() => handleSwitchMode('hot-resources')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${viewMode === 'hot-resources'
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-red-500'
                                : textSecondary + ' hover:text-red-500'
                                }`}
                        >
                            热门
                            {(hotResourcesStats.pending > 0 || hotResourcesStats.notified > 0) && (
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {viewMode === 'search' && (
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="flex-1 min-w-0">
                        <Input
                            placeholder="输入关键词..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="text-base sm:text-sm"
                        />
                    </div>
                    <div className="w-28 shrink-0 min-w-[110px]">
                        <SiteSelector
                            sites={sites}
                            value={selectedSite}
                            onChange={setSelectedSite}
                            className="text-base sm:text-sm"
                        />
                    </div>
                    <Button type="submit" loading={loading} className="px-3 sm:px-4 shrink-0 text-xs sm:text-sm whitespace-nowrap">
                        搜索
                    </Button>
                </form>
            )}


            {viewMode === 'hot-resources' && (
                <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                        <span>🔥 发现 {hotResourcesStats.total} 个热门资源</span>
                        {/* <span className="text-xs opacity-75">({hotResourcesStats.notified} 个新发现)</span> */}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleManualDetect}
                            loading={loading}
                            className="bg-red-600 hover:bg-red-700 text-white border-transparent"
                        >
                            ⚡ 立即检测
                        </Button>
                    </div>
                </div>
            )}

            {/* Category Filter Tags */}
            {availableCategories.length > 0 && (viewMode === 'search' ? results.length > 0 : hotResources.length > 0) && (
                <div className="flex items-center gap-2 flex-wrap py-2">
                    <span className={`${textSecondary} text-xs font-medium`}>分类筛选:</span>
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedCategory === null
                            ? 'bg-blue-500 text-white shadow-md'
                            : darkMode
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        全部 ({viewMode === 'search' ? results.length : hotResources.length})
                    </button>
                    {availableCategories.map(category => {
                        const count = (viewMode === 'search' ? results : hotResources).filter(
                            item => item.category === category
                        ).length;
                        return (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedCategory === category
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : getCategoryColor(category, darkMode)
                                    } hover:shadow-md`}
                            >
                                {getCategoryIcon(category)} {category} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Label Filter Tags - PC Only */}
            {availableLabels.length > 0 && (viewMode === 'search' ? results.length > 0 : hotResources.length > 0) && (
                <div className="hidden lg:flex items-center gap-2 flex-wrap py-2">
                    <span className={`${textSecondary} text-xs font-medium`}>标签筛选:</span>
                    <button
                        onClick={() => setSelectedLabel(null)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedLabel === null
                            ? 'bg-blue-500 text-white shadow-md'
                            : darkMode
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        全部
                    </button>
                    {availableLabels.map(label => {
                        const count = (viewMode === 'search' ? results : hotResources).filter(
                            item => item.labels && item.labels.includes(label)
                        ).length;
                        return (
                            <button
                                key={label}
                                onClick={() => setSelectedLabel(label)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedLabel === label
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : getLabelColor(label, darkMode)
                                    } hover:shadow-md`}
                            >
                                {label} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 flex flex-col lg:overflow-hidden">
                {loading ? (
                    <div className={`flex-1 flex justify-center items-center ${textSecondary}`}>
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="text-4xl mb-2">📡</div>
                            <p>正在搜索各大站点...</p>
                        </div>
                    </div>
                ) : (viewMode === 'search' ? results.length > 0 : hotResources.length > 0) ? (
                    <div className="flex-1 flex flex-col lg:overflow-hidden">
                        {/* Desktop: Card wrapper with internal scroll */}
                        <Card noPadding className="hidden lg:flex flex-1 overflow-hidden flex-col border bg-white dark:bg-gray-800 shadow-md rounded-2xl">
                            {/* Desktop Table View */}
                            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className={`${bgSecondary} ${textSecondary} sticky top-0 z-10`}>
                                        <tr>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('name')}>
                                                <div className="flex items-center">资源标题 <SortIcon columnKey="name" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-xs text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('seeders')}>
                                                <div className="flex items-center justify-end">做种/下载 <SortIcon columnKey="seeders" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-xs text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('date')}>
                                                <div className="flex items-center justify-center">发布时间 <SortIcon columnKey="date" /></div>
                                            </th>

                                            <th className={`p-4 font-bold border-b ${borderColor} text-xs text-right pr-6`}>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${darkMode ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
                                        {sortedResults.map((item, index) => (
                                            <tr key={index} className={`${darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'} transition-colors group`}>
                                                <td className="p-4 py-5 max-w-xs md:max-w-sm lg:max-w-md align-middle">
                                                    <div className="flex gap-3">
                                                        {/* Poster - Fixed width/height container to prevent layout shift */}
                                                        <div
                                                            className="w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded shadow-md flex-shrink-0 flex items-center justify-center relative overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                                                            onClick={() => item.posterUrl && setPosterPreview({ url: item.posterUrl, name: item.name })}
                                                        >
                                                            <span className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">Poster</span>
                                                            {item.posterUrl && (
                                                                <img
                                                                    src={item.posterUrl}
                                                                    alt={item.name}
                                                                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                                                                    onLoad={(e) => e.target.style.opacity = '1'}
                                                                    onError={(e) => e.target.style.display = 'none'}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col space-y-1 flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`${darkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'} border px-2 py-1 rounded text-xs font-bold uppercase tracking-tight w-fit flex items-center gap-1.5 whitespace-nowrap`}>
                                                                    {item.siteUrl && (
                                                                        <div className="flex items-center gap-1 relative">
                                                                            <span className="text-[10px]">🌐</span>
                                                                            <img
                                                                                src={item.siteIcon || (item.siteUrl ? `${item.siteUrl.replace(/\/$/, '')}/favicon.ico` : '')}
                                                                                alt=""
                                                                                className="w-3.5 h-3.5 object-contain absolute inset-0 m-auto opacity-0 transition-opacity duration-300"
                                                                                onLoad={(e) => {
                                                                                    e.target.style.opacity = '1';
                                                                                    if (e.target.previousSibling) e.target.previousSibling.style.display = 'none';
                                                                                }}
                                                                                onError={(e) => e.target.style.display = 'none'}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    {item.siteName}
                                                                </span>
                                                                {item.category && (
                                                                    <span className={`${getCategoryColor(item.category, darkMode)} px-2 py-0.5 rounded text-[10px] font-bold w-fit`}>
                                                                        {getCategoryIcon(item.category)} {item.category}
                                                                    </span>
                                                                )}
                                                                {/* Labels from M-Team API (4K, HDR, etc.) */}
                                                                {item.labels && item.labels.map((label, idx) => (
                                                                    <span key={idx} className={`${getLabelColor(label, darkMode)} px-1.5 py-0.5 rounded text-[9px] font-medium uppercase`}>
                                                                        {label}
                                                                    </span>
                                                                ))}
                                                                {item.isFree && <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-500 font-bold">🎁{item.freeType || '免费'}</span>}
                                                                {item.promotionTimeLeft && <PromotionTimeCapsule timeLeft={item.promotionTimeLeft} size="sm" />}

                                                                {/* Ratings from M-Team API moved to the end of Row 1 */}
                                                                {item.doubanRating && (
                                                                    <span className="bg-green-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                                                                        豆 {item.doubanRating}
                                                                    </span>
                                                                )}
                                                                {item.imdbRating && (
                                                                    <span className="bg-yellow-400 text-gray-900 px-2 py-0.5 rounded text-[10px] font-bold">
                                                                        IMDB {item.imdbRating}
                                                                    </span>
                                                                )}
                                                                {item.tmdbRating && (
                                                                    <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                                                                        TMDB {item.tmdbRating}
                                                                    </span>
                                                                )}
                                                                {item.isNew && <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/10 text-green-500 font-bold">✨新</span>}
                                                            </div>
                                                            <a href={item.link} target="_blank" rel="noopener noreferrer" className={`${textPrimary} group-hover:text-blue-500 font-bold text-sm leading-snug line-clamp-2 transition-colors`} title={item.name}>
                                                                {item.name}
                                                            </a>
                                                            {item.subtitle && <span className={`${textSecondary} text-[11px] line-clamp-1 opacity-70`} title={item.subtitle}>{item.subtitle}</span>}

                                                            {/* Footer row: Size, Identified Category, Hot Score, Risk Labels */}
                                                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                                <span className={`${darkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-600'} px-2 py-0.5 rounded text-[10px] font-bold font-mono border border-transparent`}>
                                                                    💾 {item.size}
                                                                </span>
                                                                {/* Multi-path identification Category - Only show if category management is enabled */}
                                                                {enableCategoryManagement && (() => {
                                                                    const suggestOptions = {
                                                                        match_by_category: matchByCategory,
                                                                        match_by_keyword: matchByKeyword,
                                                                        category_map: categoryMap,
                                                                        create_series_subfolder: createSeriesSubfolder
                                                                    };
                                                                    const suggested = suggestPathByTorrentName(item, downloadPaths, suggestOptions);
                                                                    if (suggested && suggested.name && suggested.name !== '下载器默认') {
                                                                        return (
                                                                            <span className={`${darkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-700'} px-2 py-0.5 rounded text-[10px] font-bold border border-teal-500/20`}>
                                                                                🎯 {suggested.name}识别
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}

                                                                {(viewMode === 'hot-resources' || hotResourcesEnabled) && item.hotScore !== undefined && (
                                                                    <>
                                                                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap ${getHotScoreColor(item.hotScore)} bg-gray-100 dark:bg-gray-700`}>
                                                                            🔥{item.hotScore}分
                                                                        </span>
                                                                        {item.riskLabel && (
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${getRiskLabelStyle(item.riskLevel, darkMode)}`}>
                                                                                {item.riskLabel}
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="p-4 text-right align-middle">
                                                    <div className="flex flex-col items-end font-mono">
                                                        <span className="text-green-500 text-[11px] font-bold">↑ {item.seeders}</span>
                                                        <span className="text-red-400 text-[10px]">↓ {item.leechers}</span>
                                                    </div>
                                                </td>
                                                <td className={`p-4 ${textSecondary} text-[10px] font-mono text-center align-middle whitespace-nowrap`}>
                                                    {item.date}
                                                </td>

                                                <td className="p-4 text-right pr-6 align-middle">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Button
                                                            size="xs"
                                                            variant="secondary"
                                                            onClick={() => downloadTorrentFile(item)}
                                                            disabled={!item.torrentUrl}
                                                            title="下载种子文件"
                                                        >
                                                            📥
                                                        </Button>
                                                        <Button
                                                            size="xs"
                                                            variant="primary"
                                                            onClick={() => handleDownloadClick(item)}
                                                            loading={downloading === item.link}
                                                            disabled={!item.torrentUrl}
                                                        >
                                                            下载
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* Mobile Card View - Outside Card, no internal scroll */}
                        <div className="lg:hidden space-y-2">
                            {sortedResults.map((item, index) => (
                                <div key={index} className="relative overflow-hidden rounded-lg group">
                                    {/* Action Buttons Revealed on Swipe - Fixed at right behind the card */}
                                    <div className={`absolute right-0 top-0 bottom-0 flex items-stretch z-0 transition-opacity duration-200 ${swipedLinkId === item.link ? 'opacity-100' : 'opacity-0 invisible pointer-events-none'}`}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadTorrentFile(item);
                                            }}
                                            disabled={!item.torrentUrl}
                                            className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-4 flex items-center justify-center transition-colors active:bg-gray-300 dark:active:bg-gray-600"
                                            title="下载种子文件"
                                        >
                                            <span className="text-xl">📥</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadClick(item);
                                            }}
                                            disabled={!item.torrentUrl}
                                            className="bg-blue-500 text-white px-6 font-bold flex items-center justify-center transition-colors active:bg-blue-600"
                                        >
                                            {downloading === item.link ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            ) : (
                                                "下载"
                                            )}
                                        </button>
                                    </div>

                                    {/* Swipeable Content Card */}
                                    <div
                                        className={`relative z-10 ${darkMode ? 'bg-gray-800' : 'bg-white'} p-3 flex gap-3 transition-transform duration-300 transform ${swipedLinkId === item.link ? '-translate-x-[140px]' : 'translate-x-0'}`}
                                        onTouchStart={handleTouchStart}
                                        onTouchEnd={(e) => handleTouchEnd(e, item.link)}
                                        onClick={() => swipedLinkId === item.link && setSwipedLinkId(null)}
                                    >
                                        {/* Poster - Fixed width/height container */}
                                        <div
                                            className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded shadow-sm flex-shrink-0 flex items-center justify-center relative overflow-hidden cursor-pointer active:ring-2 active:ring-blue-500 transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (item.posterUrl) setPosterPreview({ url: item.posterUrl, name: item.name });
                                            }}
                                        >
                                            <span className="text-gray-400 dark:text-gray-500 text-[8px] font-bold uppercase tracking-wider">Poster</span>
                                            {item.posterUrl && (
                                                <img
                                                    src={item.posterUrl}
                                                    alt={item.name}
                                                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                                                    onLoad={(e) => e.target.style.opacity = '1'}
                                                    onError={(e) => e.target.style.display = 'none'}
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1 gap-2">
                                                <div className="flex gap-1 flex-wrap flex-1 min-w-0">
                                                    <span className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap flex items-center gap-1`}>
                                                        {item.siteUrl && (
                                                            <div className="flex items-center gap-1 relative">
                                                                <span className="text-[10px]">🌐</span>
                                                                <img
                                                                    src={item.siteIcon || (item.siteUrl ? `${item.siteUrl.replace(/\/$/, '')}/favicon.ico` : '')}
                                                                    alt=""
                                                                    className="w-3 h-3 object-contain absolute inset-0 m-auto opacity-0 transition-opacity duration-300"
                                                                    onLoad={(e) => {
                                                                        e.target.style.opacity = '1';
                                                                        if (e.target.previousSibling) e.target.previousSibling.style.display = 'none';
                                                                    }}
                                                                    onError={(e) => e.target.style.display = 'none'}
                                                                />
                                                            </div>
                                                        )}
                                                        {item.siteName}
                                                    </span>
                                                    {item.category && (
                                                        <span className={`${getCategoryColor(item.category, darkMode)} px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap`}>
                                                            {getCategoryIcon(item.category)} {item.category}
                                                        </span>
                                                    )}
                                                    {item.labels && item.labels.map((label, idx) => (
                                                        <span key={idx} className={`${getLabelColor(label, darkMode)} px-1 py-0.5 rounded text-[8px] font-medium uppercase`}>
                                                            {label}
                                                        </span>
                                                    ))}
                                                    {item.isFree && <span className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[9px] font-medium whitespace-nowrap">🎁{item.freeType || '免费'}</span>}

                                                    {item.doubanRating && (
                                                        <span className="bg-green-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                            豆 {item.doubanRating}
                                                        </span>
                                                    )}
                                                    {item.imdbRating && (
                                                        <span className="bg-yellow-400 text-gray-900 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                            IMDB {item.imdbRating}
                                                        </span>
                                                    )}
                                                    {item.tmdbRating && (
                                                        <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                            TMDB {item.tmdbRating}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <a href={item.link} target="_blank" rel="noopener noreferrer" className={`${textPrimary} font-bold text-xs line-clamp-2 mb-1 leading-tight block`}>
                                                {item.name}
                                            </a>
                                            {item.subtitle && <span className={`${textSecondary} text-[10px] line-clamp-1 opacity-70 mb-1`} title={item.subtitle}>{item.subtitle}</span>}

                                            <div className="flex items-center gap-1 flex-wrap mb-1.5">
                                                {item.promotionTimeLeft && <PromotionTimeCapsule timeLeft={item.promotionTimeLeft} size="xs" />}
                                                {/* Category identification - Only show if category management is enabled */}
                                                {enableCategoryManagement && (() => {
                                                    const suggestOptions = {
                                                        match_by_category: matchByCategory,
                                                        match_by_keyword: matchByKeyword,
                                                        category_map: categoryMap,
                                                        create_series_subfolder: createSeriesSubfolder
                                                    };
                                                    const suggested = suggestPathByTorrentName(item, downloadPaths, suggestOptions);
                                                    if (suggested && suggested.name && suggested.name !== '下载器默认') {
                                                        return (
                                                            <span className={`${darkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-700'} px-1 py-0.5 rounded text-[8px] font-bold border border-teal-500/20`}>
                                                                🎯 {suggested.name}识别
                                                            </span>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                {(viewMode === 'hot-resources' || hotResourcesEnabled) && item.hotScore !== undefined && (
                                                    <>
                                                        <span className={`font-bold px-1 py-0.5 rounded text-[8px] whitespace-nowrap ${getHotScoreColor(item.hotScore)} bg-gray-100 dark:bg-gray-700`}>
                                                            🔥{item.hotScore}分
                                                        </span>
                                                        {item.riskLabel && (
                                                            <span className={`px-1 py-0.5 rounded text-[8px] font-bold whitespace-nowrap ${getRiskLabelStyle(item.riskLevel, darkMode)}`}>
                                                                {item.riskLabel}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-[10px]">
                                                <div className="flex gap-2 items-center flex-wrap">
                                                    <span className={textSecondary}>{item.size}</span>
                                                    <span className="text-green-500 font-bold">↑{item.seeders}</span>
                                                    <span className="text-red-400">↓{item.leechers}</span>
                                                    {item.date && <span className={`${textSecondary} opacity-70`}>📅{item.date}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={`mt-2 py-2 ${textSecondary} text-[10px] text-center lg:text-right`}>
                            共找到 {viewMode === 'search' ? results.length : hotResources.length} 个结果
                        </div>
                    </div>
                ) : searched ? (
                    <div className={`flex-1 flex flex-col justify-center items-center ${textSecondary} border-2 border-dashed ${borderColor} rounded-xl`}>
                        <div className="text-4xl mb-4">🏜️</div>
                        <p className="text-lg">未找到相关资源</p>
                        <p className="text-sm mt-2">试试更换关键词或调整搜索范围</p>
                    </div>
                ) : (
                    <div className={`flex-1 flex flex-col justify-center items-center ${textSecondary}`}>
                        <div className="text-6xl mb-6 opacity-20">🔍</div>
                        <p>输入关键词开始跨站搜索</p>
                    </div>
                )}
            </div>

            {/* Download Modal - Using Reusable Modal */}
            <Modal
                isOpen={showClientModal}
                onClose={() => {
                    setShowClientModal(false);
                    setPendingDownload(null);
                    setIsCustomPath(false);
                    setCustomPath('');
                }}
                title="下载确认"
                description={pendingDownload?.name}
                footer={null} // We'll implement custom body/footer content inside
            >
                <div className="space-y-6">
                    {/* Path Selection - Only show if multi-path is enabled */}
                    {enableMultiPath && downloadPaths.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className={`block text-[10px] font-bold uppercase ${textSecondary} tracking-wider`}>保存位置</label>
                                {autoDownloadEnabled && pendingDownload && suggestPathByTorrentName(pendingDownload, downloadPaths, {
                                    match_by_category: matchByCategory,
                                    match_by_keyword: matchByKeyword,
                                    fallback_to_default_path: fallbackToDefaultPath,
                                    use_downloader_default: useDownloaderDefault,
                                    category_map: categoryMap,
                                    create_series_subfolder: createSeriesSubfolder
                                }) && (
                                        <span className="text-[10px] text-blue-500 font-medium flex items-center">
                                            <span className="mr-1">✨</span>
                                            智能推荐
                                            {pendingDownload.category && (
                                                <span className="ml-1 text-[9px] opacity-70">({pendingDownload.category})</span>
                                            )}
                                        </span>
                                    )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {downloadPaths.map((p) => {
                                    // 判断是否选中：精确匹配或者路径以该基础路径开头（考虑系列子文件夹的情况）
                                    const isSelected = !isCustomPath && (
                                        selectedPath === p.path ||
                                        (selectedPath && selectedPath.startsWith(p.path + '/')) ||
                                        (selectedPath && selectedPath.startsWith(p.path + '\\'))
                                    );
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedPath(p.path);
                                                setIsCustomPath(false);
                                            }}
                                            className={`p-3 rounded-xl border text-xs font-medium transition-all text-left ${isSelected
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                                                : `${bgSecondary} ${borderColor} ${textPrimary} hover:border-blue-500/50`
                                                }`}
                                        >
                                            <div className="font-bold mb-0.5">{p.name}</div>
                                            <div className={`text-[10px] opacity-70 truncate`}>{p.path}</div>
                                        </button>
                                    );
                                })}
                                {/* Default and Custom Options */}
                                <button
                                    onClick={() => {
                                        setSelectedPath('');
                                        setIsCustomPath(false);
                                    }}
                                    className={`p-3 rounded-xl border text-xs font-medium transition-all text-left ${!isCustomPath && selectedPath === ''
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : `${bgSecondary} ${borderColor} ${textPrimary} hover:border-blue-500/50`
                                        }`}
                                >
                                    <div className="font-bold mb-0.5">默认路径</div>
                                    <div className={`text-[10px] opacity-70 truncate`}>使用下载器默认设置</div>
                                </button>

                                <button
                                    onClick={() => setIsCustomPath(true)}
                                    className={`p-3 rounded-xl border text-xs font-medium transition-all text-left ${isCustomPath
                                        ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20'
                                        : `${bgSecondary} ${borderColor} ${textPrimary} hover:border-purple-500/50`
                                        }`}
                                >
                                    <div className="font-bold mb-0.5">手动输入</div>
                                    <div className={`text-[10px] opacity-70 truncate`}>自定义保存路径</div>
                                </button>
                            </div>

                            {isCustomPath && (
                                <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <Input
                                        value={customPath}
                                        onChange={(e) => setCustomPath(e.target.value)}
                                        placeholder="请输入完整的物理路径..."
                                        className="text-base sm:text-sm"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className={`block text-[10px] font-bold uppercase ${textSecondary} mb-2 tracking-wider`}>选择下载器</label>
                        <div className="space-y-2">
                            {clients.map((client) => (
                                <button
                                    key={client.id}
                                    onClick={() => handleConfirmDownload(client.id)}
                                    disabled={downloading === pendingDownload?.link}
                                    className={`w-full flex items-center p-4 ${darkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} rounded-xl transition-all text-left border border-transparent hover:border-blue-500/30 group ${downloading === pendingDownload?.link ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-xl mr-4 group-hover:scale-110 transition-transform">
                                        {downloading === pendingDownload?.link ? (
                                            <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : '💾'}
                                    </div>
                                    <div className="flex-1">
                                        <div className={`${textPrimary} font-bold text-sm`}>{client.name || client.type}</div>
                                        <div className={`${textSecondary} text-[10px] font-mono`}>{client.host}:{client.port}</div>
                                    </div>
                                    <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs">
                                        {downloading === pendingDownload?.link ? '添加中...' : '确认下载 →'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                            variant="primary"
                            onClick={() => {
                                setShowClientModal(false);
                                setPendingDownload(null);
                                setIsCustomPath(false);
                                setCustomPath('');
                            }}
                        >
                            取消
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Poster Preview Modal */}
            {posterPreview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setPosterPreview(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        {/* Close button */}
                        <button
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
                            onClick={() => setPosterPreview(null)}
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        {/* Poster image */}
                        <img
                            src={posterPreview.url}
                            alt={posterPreview.name}
                            className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {/* Title */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
                            <p className="text-white text-sm font-medium line-clamp-2">{posterPreview.name}</p>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default SearchPage;

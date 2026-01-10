import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../App';
import { FormatUtils } from '../utils/formatUtils';
import { suggestPathByTorrentName } from '../utils/pathUtils';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

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

const SearchPage = ({ searchState, setSearchState }) => {
    const { darkMode, authenticatedFetch } = useTheme();
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

    // Theme-aware classes
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';

    // Fetch clients on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const clientsRes = await authenticatedFetch('/api/clients');
                const clientsData = await clientsRes.json();
                setClients(clientsData || []);

                const sitesRes = await authenticatedFetch('/api/sites');
                const sitesData = await sitesRes.json();
                setSites(sitesData || []);

                const pathsRes = await authenticatedFetch('/api/download-paths');
                const pathsData = await pathsRes.json();
                setDownloadPaths(pathsData || []);
                if (pathsData && pathsData.length > 0) {
                    setSelectedPath(pathsData[0].path);
                }

                // Load auto download setting
                const settingsRes = await authenticatedFetch('/api/settings');
                const settingsData = await settingsRes.json();

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
    }, []);

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
                setResults(Array.isArray(data) ? data : (data.results || []));
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



    const handleConfirmDownload = (clientId) => {
        if (pendingDownload) {
            let finalPath;

            if (enableMultiPath) {
                // 多路径模式：使用用户选择的路径
                finalPath = isCustomPath ? customPath : selectedPath;
            } else {
                // 简单模式：使用默认下载路径
                finalPath = defaultDownloadPath || null;
            }

            executeDownload(pendingDownload, clientId, finalPath);
        }
        setShowClientModal(false);
        setPendingDownload(null);
        setIsCustomPath(false);
        setCustomPath('');
    };

    const executeDownload = async (item, clientId, savePath = null) => {
        setDownloading(item.link);
        try {
            const res = await authenticatedFetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    torrentUrl: item.torrentUrl,
                    clientId: clientId,
                    title: item.name,
                    size: item.size,
                    savePath: savePath
                })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                alert(data.message || '添加下载成功');
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

    // Sorting Logic
    const sortedResults = useMemo(() => {
        if (!sortConfig.key) return results;
        return [...results].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'size') {
                valA = FormatUtils.parseSizeToBytes(valA);
                valB = FormatUtils.parseSizeToBytes(valB);
            } else if (sortConfig.key === 'seeders' || sortConfig.key === 'leechers') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            } else if (sortConfig.key === 'date') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [results, sortConfig]);

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

    return (
        <div className="p-2 sm:p-4 md:p-8 h-full flex flex-col">
            <div className="mb-2 sm:mb-4 md:mb-8">
                <h1 className={`hidden sm:block text-2xl md:text-3xl font-bold mb-4 md:mb-6 ${textPrimary}`}>资源搜索</h1>

                <form onSubmit={handleSearch} className="flex gap-1 sm:gap-2">
                    <div className="flex-1 min-w-0">
                        <Input
                            placeholder="输入关键词..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="text-base sm:text-sm"
                        />
                    </div>
                    <div className="w-24 sm:w-32 shrink-0">
                        <Select
                            value={selectedSite}
                            onChange={(e) => setSelectedSite(e.target.value)}
                            className="text-base sm:text-sm"
                        >
                            <option value="">全部站点</option>
                            {sites.filter(s => s.enabled === 1 || s.enabled === true || s.enabled === '1').map(site => (
                                <option key={site.id} value={site.name}>{site.name}</option>
                            ))}
                        </Select>
                    </div>
                    <Button type="submit" disabled={loading} className="px-3 sm:px-4 shrink-0 text-xs sm:text-sm whitespace-nowrap">
                        搜索
                    </Button>
                </form>
            </div>

            <div className="flex-1 flex flex-col lg:overflow-hidden">
                {loading ? (
                    <div className={`flex-1 flex justify-center items-center ${textSecondary}`}>
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="text-4xl mb-2">📡</div>
                            <p>正在搜索各大站点...</p>
                        </div>
                    </div>
                ) : results.length > 0 ? (
                    <div className="flex-1 flex flex-col lg:overflow-hidden">
                        {/* Desktop: Card wrapper with internal scroll */}
                        <Card noPadding className="hidden lg:flex flex-1 overflow-hidden flex-col border bg-white dark:bg-gray-800 shadow-md rounded-2xl">
                            {/* Desktop Table View */}
                            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className={`${bgSecondary} ${textSecondary} sticky top-0 z-10`}>
                                        <tr>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('siteName')}>
                                                <div className="flex items-center">站点 <SortIcon columnKey="siteName" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('name')}>
                                                <div className="flex items-center">资源标题 <SortIcon columnKey="name" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-xs text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('size')}>
                                                <div className="flex items-center justify-end">大小 <SortIcon columnKey="size" /></div>
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
                                                <td className="p-4 align-middle">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className={`${darkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'} border px-2 py-1 rounded text-xs font-bold uppercase tracking-tight w-fit flex items-center gap-1.5`}>
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
                                                    </div>
                                                </td>
                                                <td className="p-4 py-5 max-w-xs md:max-w-sm lg:max-w-md align-middle">
                                                    <div className="flex flex-col space-y-1.5">
                                                        <a href={item.link} target="_blank" rel="noopener noreferrer" className={`${textPrimary} group-hover:text-blue-500 font-bold text-xs leading-snug line-clamp-2 transition-colors`} title={item.name}>
                                                            {item.name}
                                                        </a>
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            {item.subtitle && <span className={`${textSecondary} text-xs line-clamp-1 opacity-80`} title={item.subtitle}>{item.subtitle}</span>}
                                                            <div className="flex gap-1.5 flex-shrink-0">
                                                                {item.isHot && <span className="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/10 text-orange-500 font-bold">🔥热门</span>}
                                                                {item.isNew && <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/10 text-green-500 font-bold">✨新</span>}
                                                                {item.isFree && <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-500 font-bold">🎁{item.freeType || '免费'}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right align-middle">
                                                    <span className={`text-[11px] font-mono font-bold ${textPrimary}`}>{item.size}</span>
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
                                                            disabled={downloading === item.link || !item.torrentUrl}
                                                        >
                                                            {downloading === item.link ? '添加中...' : '下载'}
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
                                <div key={index} className={`${darkMode ? 'bg-gray-800/50' : 'bg-white'} rounded-lg p-3`}>
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
                                            {item.isFree && <span className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[9px] font-medium whitespace-nowrap">🎁{item.freeType || '免费'}</span>}
                                        </div>
                                    </div>
                                    <a href={item.link} target="_blank" rel="noopener noreferrer" className={`${textPrimary} font-bold text-xs line-clamp-2 mb-1 leading-tight block`}>
                                        {item.name}
                                    </a>
                                    <div className="flex items-center justify-between text-[10px] mb-2">
                                        <div className="flex gap-2">
                                            <span className={textSecondary}>{item.size}</span>
                                            <span className="text-green-500 font-bold">↑{item.seeders}</span>
                                            <span className="text-red-400">↓{item.leechers}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="xs"
                                                variant="secondary"
                                                className="py-1 px-2 text-[10px]"
                                                onClick={() => downloadTorrentFile(item)}
                                                disabled={!item.torrentUrl}
                                                title="下载种子"
                                            >
                                                📥
                                            </Button>
                                            <Button
                                                size="xs"
                                                className="py-1 px-2 text-[10px]"
                                                onClick={() => handleDownloadClick(item)}
                                                disabled={downloading === item.link || !item.torrentUrl}
                                            >
                                                {downloading === item.link ? '...' : '下载'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={`mt-2 py-2 ${textSecondary} text-[10px] text-center lg:text-right`}>
                            共找到 {results.length} 个结果
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
                                    className={`w-full flex items-center p-4 ${darkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} rounded-xl transition-all text-left border border-transparent hover:border-blue-500/30 group`}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-xl mr-4 group-hover:scale-110 transition-transform">
                                        💾
                                    </div>
                                    <div className="flex-1">
                                        <div className={`${textPrimary} font-bold text-sm`}>{client.name || client.type}</div>
                                        <div className={`${textSecondary} text-[10px] font-mono`}>{client.host}:{client.port}</div>
                                    </div>
                                    <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs">确认下载 →</div>
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
        </div>
    );
};

export default SearchPage;

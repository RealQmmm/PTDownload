import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';
import { FormatUtils } from '../utils/formatUtils';



const SearchPage = ({ searchState, setSearchState }) => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [query, setQuery] = useState(searchState?.query || '');
    const [results, setResults] = useState(searchState?.results || []);

    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(searchState?.searched || false);
    const [searchMode, setSearchMode] = useState(searchState?.searchMode || 'keyword'); // 'keyword' or 'recent'
    const [downloading, setDownloading] = useState(null);
    const [clients, setClients] = useState([]);

    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Client selection modal state
    const [showClientModal, setShowClientModal] = useState(false);
    const [pendingDownload, setPendingDownload] = useState(null);

    // Fetch clients on mount
    useEffect(() => {
        authenticatedFetch('/api/clients')
            .then(res => res.json())
            .then(data => setClients(data))
            .catch(err => console.error('Failed to fetch clients:', err));
    }, []);

    // Save state to parent when it changes
    useEffect(() => {
        if (setSearchState) {
            setSearchState({ query, results, searched, searchMode });
        }
    }, [query, results, searched, searchMode]);

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
                ? `/api/search?q=${encodeURIComponent(trimmedQuery)}`
                : `/api/search?days=1`;
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
        if (!clients || clients.length === 0) {
            alert('请先在"下载器管理"中添加下载客户端');
            return;
        }

        // If only one client, confirm and download directly
        if (clients.length === 1) {
            const clientName = clients[0].name || clients[0].type;
            if (window.confirm(`确认下载 "${item.name}" 到 [${clientName}] 吗？`)) {
                executeDownload(item, clients[0].id);
            }
        } else {
            setPendingDownload(item);
            setShowClientModal(true);
        }
    };

    const handleClientSelect = (clientId) => {
        if (pendingDownload) {
            executeDownload(pendingDownload, clientId);
        }
        setShowClientModal(false);
        setPendingDownload(null);
    };

    const executeDownload = async (item, clientId) => {
        setDownloading(item.link);
        try {
            const res = await authenticatedFetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    torrentUrl: item.torrentUrl,
                    clientId: clientId,
                    title: item.name,
                    size: item.size
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

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const inputBg = darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';

    // Sorting Logic
    const sortedResults = React.useMemo(() => {
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
        <div className="p-4 md:p-8 h-full flex flex-col">
            <div className="mb-6 md:mb-8">
                <h1 className={`text-2xl md:text-3xl font-bold mb-4 md:mb-6 ${textPrimary}`}>资源搜索</h1>

                <div className="space-y-4">
                    <form onSubmit={handleSearch} className="flex flex-row gap-2">
                        <div className="relative flex-1">
                            <span className={`absolute left-3 top-3 ${textSecondary}`}>🔍</span>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="输入关键词..."
                                className={`w-full border rounded-xl py-2.5 pl-10 pr-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm ${inputBg}`}
                            />
                        </div>
                        <div className="flex items-center">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 md:px-8 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20 whitespace-nowrap h-full text-sm md:text-base"
                            >
                                搜索
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                {loading ? (
                    <div className={`flex-1 flex justify-center items-center ${textSecondary}`}>
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="text-4xl mb-2">📡</div>
                            <p>正在搜索各大站点...</p>
                        </div>
                    </div>
                ) : results.length > 0 ? (
                    <div className="flex-1 overflow-hidden flex flex-col">

                        <div className={`flex-1 overflow-hidden flex flex-col ${bgMain} rounded-xl border ${borderColor}`}>
                            {/* Desktop Table View */}
                            <div className="hidden lg:block overflow-x-auto overflow-y-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead className={`${bgSecondary} ${textSecondary} sticky top-0 z-10`}>
                                        <tr>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-[11px] uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('siteName')}>
                                                <div className="flex items-center">站点 <SortIcon columnKey="siteName" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('name')}>
                                                <div className="flex items-center">资源标题 <SortIcon columnKey="name" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('size')}>
                                                <div className="flex items-center justify-end">大小 <SortIcon columnKey="size" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('seeders')}>
                                                <div className="flex items-center justify-end">做种/下载 <SortIcon columnKey="seeders" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`} onClick={() => requestSort('date')}>
                                                <div className="flex items-center justify-center">发布时间 <SortIcon columnKey="date" /></div>
                                            </th>
                                            <th className={`p-4 font-bold border-b ${borderColor} text-right pr-6`}>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${darkMode ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
                                        {sortedResults.map((item, index) => (
                                            <tr key={index} className={`${darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'} transition-colors group`}>
                                                <td className="p-4">
                                                    <span className={`${darkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'} border px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight`}>
                                                        {item.siteName}
                                                    </span>
                                                </td>
                                                <td className="p-4 py-5 max-w-md xl:max-w-xl">
                                                    <div className="flex flex-col space-y-1.5">
                                                        <a href={item.link} target="_blank" rel="noopener noreferrer" className={`${textPrimary} group-hover:text-blue-500 font-bold text-sm leading-snug line-clamp-2 transition-colors`} title={item.name}>
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
                                                    <span className={`text-xs font-mono font-bold ${textPrimary}`}>{item.size}</span>
                                                </td>
                                                <td className="p-4 text-right align-middle">
                                                    <div className="flex flex-col items-end font-mono">
                                                        <span className="text-green-500 text-xs font-bold">↑ {item.seeders}</span>
                                                        <span className="text-red-400 text-[10px]">↓ {item.leechers}</span>
                                                    </div>
                                                </td>
                                                <td className={`p-4 ${textSecondary} text-[11px] font-mono text-center align-middle whitespace-nowrap`}>
                                                    {item.date}
                                                </td>
                                                <td className="p-4 text-right pr-6 align-middle">
                                                    <button
                                                        onClick={() => handleDownloadClick(item)}
                                                        disabled={downloading === item.link || !item.torrentUrl}
                                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${!item.torrentUrl ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : downloading === item.link ? 'bg-amber-600/50 text-amber-100 cursor-wait' : 'bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-600/20'}`}
                                                    >
                                                        {downloading === item.link ? '添加中...' : '下载'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="lg:hidden p-4 overflow-y-auto space-y-4">
                                {results.map((item, index) => (
                                    <div key={index} className={`${bgSecondary} rounded-xl border ${borderColor} p-4 shadow-sm`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-1 rounded text-xs font-bold`}>
                                                {item.siteName}
                                            </span>
                                            <div className="flex gap-1">
                                                {item.isHot && <span className="p-1 px-1.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-medium">🔥热门</span>}
                                                {item.isFree && <span className="p-1 px-1.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-medium">🎁{item.freeType || '免费'}</span>}
                                            </div>
                                        </div>
                                        <a href={item.link} target="_blank" rel="noopener noreferrer" className={`${textPrimary} font-bold text-sm line-clamp-2 mb-2 leading-tight`}>
                                            {item.name}
                                        </a>
                                        {item.subtitle && <p className={`${textSecondary} text-xs line-clamp-1 mb-3`}>{item.subtitle}</p>}
                                        <div className="grid grid-cols-2 gap-y-3 mb-4 text-xs font-mono">
                                            <div className="text-gray-500">大小: <span className={textPrimary}>{item.size}</span></div>
                                            <div className="text-gray-500">时间: <span className={textPrimary}>{item.date}</span></div>
                                            <div className="text-green-500 font-bold">↑ {item.seeders}</div>
                                            <div className="text-red-400">↓ {item.leechers}</div>
                                        </div>
                                        <button
                                            onClick={() => handleDownloadClick(item)}
                                            disabled={downloading === item.link || !item.torrentUrl}
                                            className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${!item.torrentUrl ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : downloading === item.link ? 'bg-yellow-600/50 text-yellow-200 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                        >
                                            {downloading === item.link ? '⏳ 添加中...' : '📥 下 载'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`mt-4 p-3 ${bgSecondary} rounded-lg border ${borderColor} ${textSecondary} text-xs text-center lg:text-right`}>
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

            {/* Client Modal */}
            {showClientModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className={`${bgMain} rounded-2xl w-full max-w-md border ${borderColor} shadow-2xl overflow-hidden`}>
                        <div className={`p-6 border-b ${borderColor}`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>选择下载客户端</h2>
                        </div>
                        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                            {clients.map((client) => (
                                <button
                                    key={client.id}
                                    onClick={() => handleClientSelect(client.id)}
                                    className={`w-full flex items-center p-4 ${darkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} rounded-xl transition-all text-left`}
                                >
                                    <div className="text-2xl mr-4">💾</div>
                                    <div className="flex-1">
                                        <div className={`${textPrimary} font-medium`}>{client.type}</div>
                                        <div className={`${textSecondary} text-sm`}>{client.host}:{client.port}</div>
                                    </div>
                                    <div className="text-blue-500">→</div>
                                </button>
                            ))}
                        </div>
                        <div className="p-4 flex justify-end">
                            <button onClick={() => setShowClientModal(false)} className={`px-4 py-2 ${textSecondary} hover:${textPrimary} font-medium`}>取消</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchPage;

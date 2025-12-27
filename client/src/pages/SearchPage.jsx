import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const SearchPage = ({ searchState, setSearchState }) => {
    const { darkMode } = useTheme();
    const [query, setQuery] = useState(searchState?.query || '');
    const [results, setResults] = useState(searchState?.results || []);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(searchState?.searched || false);
    const [downloading, setDownloading] = useState(null);
    const [clients, setClients] = useState([]);

    // Client selection modal state
    const [showClientModal, setShowClientModal] = useState(false);
    const [pendingDownload, setPendingDownload] = useState(null);

    // Fetch clients on mount
    useEffect(() => {
        fetch('/api/clients')
            .then(res => res.json())
            .then(data => setClients(data))
            .catch(err => console.error('Failed to fetch clients:', err));
    }, []);

    // Save state to parent when it changes
    useEffect(() => {
        if (setSearchState) {
            setSearchState({ query, results, searched });
        }
    }, [query, results, searched]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setResults([]);
        setSearched(true);

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setResults(data);
        } catch (err) {
            console.error('Search failed:', err);
            alert('搜索失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadClick = (item) => {
        if (!clients || clients.length === 0) {
            alert('请先在"下载器管理"中添加下载客户端');
            return;
        }

        // If only one client, download directly
        if (clients.length === 1) {
            executeDownload(item, clients[0].id);
        } else {
            // Multiple clients - show selection modal
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
            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    torrentUrl: item.torrentUrl,
                    clientId: clientId
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

    return (
        <div className="p-8 h-full flex flex-col">
            <div className="mb-8">
                <h1 className={`text-3xl font-bold mb-6 ${textPrimary}`}>资源搜索</h1>
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        <span className={`absolute left-4 top-3 ${textSecondary}`}>🔍</span>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="输入关键词，例如: Avatar..."
                            className={`w-full border rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-lg ${inputBg}`}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/30"
                    >
                        {loading ? '搜索中...' : '搜索'}
                    </button>
                </form>
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
                    <div className={`${bgMain} rounded-xl border ${borderColor} overflow-hidden flex flex-col flex-1`}>
                        <div className="overflow-x-auto overflow-y-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className={`${bgSecondary} ${textSecondary} sticky top-0`}>
                                    <tr>
                                        <th className={`p-4 font-medium border-b ${borderColor}`}>站点</th>
                                        <th className={`p-4 font-medium border-b ${borderColor} w-1/2`}>标题</th>
                                        <th className={`p-4 font-medium border-b ${borderColor}`}>大小</th>
                                        <th className={`p-4 font-medium border-b ${borderColor} text-center`}>做种</th>
                                        <th className={`p-4 font-medium border-b ${borderColor} text-center`}>下载</th>
                                        <th className={`p-4 font-medium border-b ${borderColor}`}>发布时间</th>
                                        <th className={`p-4 font-medium border-b ${borderColor}`}>操作</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    {results.map((item, index) => (
                                        <tr key={index} className={`${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} transition-colors`}>
                                            <td className="p-4">
                                                <span className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-1 rounded text-xs font-bold`}>
                                                    {item.siteName}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <a
                                                            href={item.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`${textPrimary} hover:text-blue-400 font-medium line-clamp-1`}
                                                        >
                                                            {item.name}
                                                        </a>
                                                        {/* Status badges */}
                                                        <div className="flex gap-1 flex-shrink-0">
                                                            {item.isHot && (
                                                                <span className="px-1.5 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400 font-medium">
                                                                    🔥热门
                                                                </span>
                                                            )}
                                                            {item.isNew && (
                                                                <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400 font-medium">
                                                                    ✨新
                                                                </span>
                                                            )}
                                                            {item.isFree && (
                                                                <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 font-medium">
                                                                    🎁{item.freeType || '免费'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {item.subtitle && (
                                                            <span className={`${textSecondary} text-xs line-clamp-1`}>
                                                                {item.subtitle}
                                                            </span>
                                                        )}
                                                        {item.freeUntil && (
                                                            <span className="text-xs text-yellow-500 flex-shrink-0">
                                                                ⏱️剩余 {item.freeUntil}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`p-4 ${textSecondary} whitespace-nowrap`}>{item.size}</td>
                                            <td className="p-4 text-green-400 font-bold text-center">{item.seeders}</td>
                                            <td className="p-4 text-red-400 text-center">{item.leechers}</td>
                                            <td className={`p-4 ${textSecondary} text-sm whitespace-nowrap`}>{item.date}</td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleDownloadClick(item)}
                                                    disabled={downloading === item.link || !item.torrentUrl}
                                                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${!item.torrentUrl
                                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                        : downloading === item.link
                                                            ? 'bg-yellow-600/50 text-yellow-200 cursor-wait'
                                                            : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/40'
                                                        }`}
                                                >
                                                    {downloading === item.link ? '添加中...' : '下载'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className={`p-4 ${bgSecondary} border-t ${borderColor} ${textSecondary} text-sm text-right`}>
                            共找到 {results.length} 个结果
                        </div>
                    </div>
                ) : searched ? (
                    <div className={`flex-1 flex flex-col justify-center items-center ${textSecondary} border-2 border-dashed ${borderColor} rounded-xl`}>
                        <div className="text-4xl mb-4">🏜️</div>
                        <p className="text-lg">未找到相关资源</p>
                        <p className="text-sm mt-2">试试更换关键词或检查站点配置</p>
                    </div>
                ) : (
                    <div className={`flex-1 flex flex-col justify-center items-center ${textSecondary}`}>
                        <div className="text-6xl mb-6 opacity-20">🔍</div>
                        <p>输入关键词开始搜索</p>
                    </div>
                )}
            </div>

            {/* Client Selection Modal */}
            {showClientModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-xl w-full max-w-md border ${borderColor} shadow-2xl`}>
                        <div className={`p-6 border-b ${borderColor}`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>选择下载器</h2>
                            <p className={`${textSecondary} text-sm mt-1`}>
                                将 "{pendingDownload?.name?.substring(0, 40)}..." 发送到：
                            </p>
                        </div>
                        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                            {clients.map((client) => (
                                <button
                                    key={client.id}
                                    onClick={() => handleClientSelect(client.id)}
                                    className={`w-full flex items-center p-4 ${darkMode ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg transition-colors text-left`}
                                >
                                    <div className="text-2xl mr-4">📥</div>
                                    <div className="flex-1">
                                        <div className={`${textPrimary} font-medium`}>{client.type}</div>
                                        <div className={`${textSecondary} text-sm`}>{client.host}:{client.port}</div>
                                    </div>
                                    <div className="text-blue-400">→</div>
                                </button>
                            ))}
                        </div>
                        <div className={`p-4 border-t ${borderColor}`}>
                            <button
                                onClick={() => {
                                    setShowClientModal(false);
                                    setPendingDownload(null);
                                }}
                                className={`w-full py-2 ${textSecondary} hover:${textPrimary} transition-colors`}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchPage;

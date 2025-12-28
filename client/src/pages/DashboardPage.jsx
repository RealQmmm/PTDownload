import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

// Format bytes to human readable format
const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format speed (bytes/s)
const formatSpeed = (bytesPerSecond) => {
    return formatBytes(bytesPerSecond) + '/s';
};

// Sub-component for flow chart
const HistoryChart = ({ data, textSecondary }) => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    const maxVal = Math.max(...data.map(d => Math.max(d.downloaded_bytes || 0, d.uploaded_bytes || 0, 1024 * 1024)));
    const chartHeight = 120;

    return (
        <div className="w-full">
            <div className="flex justify-between items-end h-[120px] px-2">
                {data.map((item, idx) => {
                    const dlHeight = ((item.downloaded_bytes || 0) / maxVal) * chartHeight;
                    const upHeight = ((item.uploaded_bytes || 0) / maxVal) * chartHeight;
                    const dateStr = item.date ? new Date(item.date) : new Date();
                    const label = `${dateStr.getMonth() + 1}/${dateStr.getDate()}`;

                    return (
                        <div key={idx} className="flex flex-col items-center flex-1 group relative">
                            <div className="flex space-x-1 items-end h-[120px]">
                                <div
                                    className="w-2 md:w-3 bg-green-500 rounded-t-sm transition-all duration-500 ease-out"
                                    style={{ height: `${Math.max(dlHeight, 2)}px` }}
                                >
                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] p-2 rounded pointer-events-none z-10 whitespace-nowrap shadow-xl">
                                        下载: {formatBytes(item.downloaded_bytes)}<br />
                                        上传: {formatBytes(item.uploaded_bytes)}
                                    </div>
                                </div>
                                <div
                                    className="w-2 md:w-3 bg-blue-500 rounded-t-sm transition-all duration-500 ease-out"
                                    style={{ height: `${Math.max(upHeight, 2)}px` }}
                                ></div>
                            </div>
                            <span className={`${textSecondary} text-[10px] mt-2`}>{label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const DashboardPage = ({ setActiveTab }) => {
    const { darkMode } = useTheme();
    const [downloadStats, setDownloadStats] = useState({
        totalDownloadSpeed: 0,
        totalUploadSpeed: 0,
        totalDownloaded: 0,
        totalUploaded: 0,
        activeTorrents: 0,
        totalTorrents: 0
    });
    const [allTorrents, setAllTorrents] = useState([]);
    const [taskFilter, setTaskFilter] = useState('active'); // 'active' or 'all'
    const [historyData, setHistoryData] = useState([]);
    const [todayDownloads, setTodayDownloads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-100';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-500';

    const fetchTorrentData = async () => {
        try {
            const [statsRes, histRes, todayRes] = await Promise.all([
                fetch('/api/stats'),
                fetch('/api/stats/history?days=7'),
                fetch('/api/stats/today-downloads')
            ]);

            if (!statsRes.ok || !histRes.ok || !todayRes.ok) return;

            const [sStats, hStats, tdStats] = await Promise.all([
                statsRes.json().catch(() => ({})),
                histRes.json().catch(() => ({ success: false })),
                todayRes.json().catch(() => ({ success: false }))
            ]);

            if (sStats && sStats.success) {
                const allTorrents = [];
                if (Array.isArray(sStats.clients)) {
                    sStats.clients.forEach(client => {
                        if (client && Array.isArray(client.torrents)) {
                            client.torrents.forEach(torrent => {
                                allTorrents.push({
                                    ...torrent,
                                    clientName: client.clientName || 'Unknown',
                                    clientType: client.clientType || 'Unknown'
                                });
                            });
                        }
                    });
                }

                const calculatedDlSpeed = allTorrents.reduce((acc, t) => acc + (Number(t.dlspeed) || 0), 0);
                const calculatedUpSpeed = allTorrents.reduce((acc, t) => acc + (Number(t.upspeed) || 0), 0);

                setDownloadStats({
                    ...(sStats.stats || {}),
                    totalDownloadSpeed: calculatedDlSpeed,
                    totalUploadSpeed: calculatedUpSpeed
                });

                setAllTorrents(allTorrents);
            }

            if (hStats && hStats.success) {
                setHistoryData(Array.isArray(hStats.history) ? hStats.history : []);
            }

            if (tdStats && tdStats.success) {
                setTodayDownloads(Array.isArray(tdStats.downloads) ? tdStats.downloads : []);
            }

        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTorrentData();
        const interval = setInterval(fetchTorrentData, 3000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-20">
                <div className={`text-center ${textSecondary}`}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p>正在同步云端数据...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="mb-6">
                <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>仪表盘</h1>
                <p className={`${textSecondary} mt-1 text-sm`}>无人值守下载站运行概况</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className={`${bgMain} border ${borderColor} rounded-2xl p-6 shadow-sm`}>
                    <p className={`${textSecondary} text-xs font-bold uppercase mb-4`}>流量统计 (今日)</p>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className={textSecondary}>今日下载</span>
                            <span className={`text-xl font-bold ${textPrimary}`}>{formatBytes(downloadStats.totalDownloaded)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className={textSecondary}>今日上传</span>
                            <span className={`text-xl font-bold text-blue-500`}>{formatBytes(downloadStats.totalUploaded)}</span>
                        </div>
                    </div>
                </div>

                <div className={`${bgMain} border ${borderColor} rounded-2xl p-6 shadow-sm`}>
                    <p className={`${textSecondary} text-xs font-bold uppercase mb-4`}>即时速率</p>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className={textSecondary}>下载速度</span>
                            <span className={`text-xl font-bold text-green-500`}>{formatSpeed(downloadStats.totalDownloadSpeed)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className={textSecondary}>上传速度</span>
                            <span className={`text-xl font-bold text-blue-500`}>{formatSpeed(downloadStats.totalUploadSpeed)}</span>
                        </div>
                    </div>
                </div>

                <div className={`lg:col-span-2 ${bgMain} border ${borderColor} rounded-2xl p-6 shadow-sm min-h-[160px]`}>
                    <div className="flex justify-between items-center mb-4">
                        <p className={`${textSecondary} text-xs font-bold uppercase`}>最近7天流量</p>
                        <div className="flex space-x-3 text-[10px]">
                            <span className="flex items-center text-green-500"><i className="w-2 h-2 bg-green-500 rounded-full mr-1 inline-block"></i>下载</span>
                            <span className="flex items-center text-blue-500"><i className="w-2 h-2 bg-blue-500 rounded-full mr-1 inline-block"></i>上传</span>
                        </div>
                    </div>
                    <HistoryChart data={historyData} textSecondary={textSecondary} />
                </div>
            </div>

            {/* Bottom Section: Active Tasks & Today's History */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Active Tasks list (Left 75%) */}
                <div className={`xl:col-span-3 ${bgMain} border ${borderColor} rounded-2xl p-4 md:p-6 shadow-sm overflow-hidden flex flex-col`}>
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center">
                            <h2 className={`text-xl font-bold ${textPrimary} flex items-center`}>
                                <span className="mr-2 text-blue-500">⚡</span> 活动任务
                            </h2>
                            <div className={`ml-4 flex items-center ${darkMode ? 'bg-gray-700/50' : 'bg-gray-200/50'} p-1 rounded-lg`}>
                                <button
                                    onClick={() => setTaskFilter('active')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${taskFilter === 'active' ? 'bg-blue-500 text-white shadow-sm font-bold' : `${textSecondary} hover:${textPrimary} hover:bg-gray-200/60 dark:hover:bg-gray-600/40`}`}
                                >
                                    进行中
                                </button>
                                <button
                                    onClick={() => setTaskFilter('all')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${taskFilter === 'all' ? 'bg-blue-500 text-white shadow-sm font-bold' : `${textSecondary} hover:${textPrimary} hover:bg-gray-200/60 dark:hover:bg-gray-600/40`}`}
                                >
                                    全部
                                </button>
                            </div>
                        </div>
                    </div>

                    {(() => {
                        let displayedTasks = taskFilter === 'active'
                            ? allTorrents.filter(t =>
                                (Number(t.dlspeed) || 0) > 0 ||
                                (Number(t.upspeed) || 0) > 0
                            )
                            : allTorrents;

                        // Apply sorting
                        if (sortConfig.key) {
                            displayedTasks = [...displayedTasks].sort((a, b) => {
                                let valA = a[sortConfig.key];
                                let valB = b[sortConfig.key];

                                // Handle numeric sorting
                                const numericKeys = ['progress', 'dlspeed', 'upspeed', 'ratio', 'size'];
                                if (numericKeys.includes(sortConfig.key)) {
                                    valA = Number(valA) || 0;
                                    valB = Number(valB) || 0;
                                } else {
                                    valA = (valA || '').toString().toLowerCase();
                                    valB = (valB || '').toString().toLowerCase();
                                }

                                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                                return 0;
                            });
                        }

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

                        return displayedTasks.length > 0 ? (
                            <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6">
                                <table className="w-full text-left border-collapse" style={{ minWidth: '600px' }}>
                                    <thead>
                                        <tr className={`border-b ${borderColor} text-[10px] uppercase tracking-widest ${textSecondary}`}>
                                            <th
                                                className="pb-3 pr-2 font-bold whitespace-nowrap cursor-pointer hover:text-blue-500 transition-colors"
                                                onClick={() => requestSort('name')}
                                            >
                                                <div className="flex items-center">资源名称 <SortIcon columnKey="name" /></div>
                                            </th>
                                            <th
                                                className="pb-3 px-2 font-bold whitespace-nowrap cursor-pointer hover:text-blue-500 transition-colors"
                                                onClick={() => requestSort('progress')}
                                            >
                                                <div className="flex items-center">进度 <SortIcon columnKey="progress" /></div>
                                            </th>
                                            <th
                                                className="pb-3 px-2 font-bold whitespace-nowrap text-right cursor-pointer hover:text-blue-500 transition-colors"
                                                onClick={() => requestSort('dlspeed')}
                                            >
                                                <div className="flex items-center justify-end">状态/速度 <SortIcon columnKey="dlspeed" /></div>
                                            </th>
                                            <th
                                                className="pb-3 px-2 font-bold whitespace-nowrap text-right cursor-pointer hover:text-blue-500 transition-colors"
                                                onClick={() => requestSort('ratio')}
                                            >
                                                <div className="flex items-center justify-end">分享率 <SortIcon columnKey="ratio" /></div>
                                            </th>
                                            <th
                                                className="pb-3 pl-2 text-right font-bold whitespace-nowrap cursor-pointer hover:text-blue-500 transition-colors"
                                                onClick={() => requestSort('clientType')}
                                            >
                                                <div className="flex items-center justify-end">客户端 <SortIcon columnKey="clientType" /></div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {displayedTasks.map((task, idx) => (
                                            <tr key={task.hash || idx} className="group hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                                                <td className="py-3 pr-2 max-w-[220px]">
                                                    <div className="flex flex-col">
                                                        <p className={`text-sm font-medium ${textPrimary} line-clamp-2 leading-snug group-hover:text-blue-500 transition-colors overflow-hidden`} title={task.name || 'Unknown'}>
                                                            {task.name || 'Unknown'}
                                                        </p>
                                                        <div className="flex items-center mt-1 text-[10px] text-gray-400">
                                                            <span className="font-mono opacity-60">
                                                                大小: {formatBytes(task.size || 0)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <div className="flex flex-col space-y-1">
                                                        <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                                                            <span className={textPrimary}>{(Number(task.progress) * 100 || 0).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${Number(task.progress) >= 1 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${(Number(task.progress) * 100) || 0}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-[10px] font-bold uppercase mb-0.5 ${task.state === 'downloading' ? 'text-blue-500' : 'text-gray-400'}`}>
                                                            {task.state}
                                                        </span>
                                                        <div className="flex flex-col items-end scale-90 origin-right">
                                                            {(Number(task.dlspeed) || 0) > 0 && <span className="font-mono text-[10px] text-green-500 font-bold whitespace-nowrap">↓ {formatSpeed(task.dlspeed)}</span>}
                                                            {(Number(task.upspeed) || 0) > 0 && <span className="font-mono text-[10px] text-blue-500 opacity-80 whitespace-nowrap">↑ {formatSpeed(task.upspeed)}</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2 text-right">
                                                    <span className={`font-mono text-xs font-bold ${Number(task.ratio) >= 1 ? 'text-amber-500' : textPrimary}`}>
                                                        {(Number(task.ratio) || 0).toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="py-3 pl-2 text-right">
                                                    <span className={`inline-block px-1.5 py-0.5 border border-gray-600/30 rounded text-gray-400 text-[9px] uppercase font-mono whitespace-nowrap`}>
                                                        {task.clientType || 'N/A'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={`text-center py-20 ${textSecondary} border-2 border-dashed ${borderColor} rounded-xl`}>
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl mb-2 opacity-20">🍃</span>
                                    <p className="text-sm">{taskFilter === 'active' ? '暂无进行中的任务' : '暂无任何任务'}</p>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Today's History (Right 25%) */}
                <div className={`xl:col-span-1 ${bgMain} border ${borderColor} rounded-2xl p-6 shadow-sm flex flex-col`}>
                    <h2 className={`text-lg font-bold ${textPrimary} mb-4 flex items-center`}>
                        <span className="mr-2">📁</span> 今日已下载
                        {todayDownloads.length > 0 && (
                            <span className={`ml-2 text-[10px] font-normal ${textSecondary} ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} px-1.5 py-0.5 rounded`}>
                                {todayDownloads.length}
                            </span>
                        )}
                    </h2>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 max-h-[500px]">
                        {todayDownloads.length > 0 ? (
                            todayDownloads.map((item, idx) => (
                                <div key={idx} className="relative pl-4 border-l-2 border-blue-500/30 py-1">
                                    <p className={`text-xs font-medium ${textPrimary} line-clamp-2 leading-relaxed mb-1`} title={item.item_title || 'Unknown'}>
                                        {item.item_title || 'Unknown'}
                                    </p>
                                    <div className="flex justify-between items-center text-[10px] text-gray-500">
                                        <span className="bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                            {item.task_name}
                                        </span>
                                        <span className="font-mono">
                                            {item.finish_time ?
                                                new Date(item.finish_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                                '--:--'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 opacity-30">
                                <span className="text-3xl mb-2">☕</span>
                                <p className="text-xs">今天还没有完成的下载记录</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;

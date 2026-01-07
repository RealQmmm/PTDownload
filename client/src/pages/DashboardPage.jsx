import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';
import Card from '../components/ui/Card';

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

// Format ETA (seconds)
const formatETA = (seconds) => {
    if (seconds === undefined || seconds === null || seconds < 0 || seconds >= 8640000) return '∞';
    if (seconds === 0) return '0s';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
};

// Sub-component for flow chart
const HistoryChart = ({ data, textSecondary, darkMode }) => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    // Fixed max value to be 1.1x of actual max to avoid touching the top
    const rawMax = Math.max(...data.map(d => Math.max(d.downloaded_bytes || 0, d.uploaded_bytes || 0, 1024 * 1024 * 1024)));
    const maxVal = rawMax * 1.1;
    const chartHeight = 100;

    // Y-axis ticks
    const ticks = [rawMax, rawMax * 0.5, 0];

    return (
        <div className="w-full h-full flex items-start">
            {/* Y-Axis labels */}
            <div className="flex flex-col justify-between h-[100px] pr-2 text-[9px] font-mono opacity-40 text-right min-w-[50px] pointer-events-none">
                {ticks.map((tick, i) => (
                    <span key={i} className={textSecondary}>{formatBytes(tick)}</span>
                ))}
            </div>

            {/* Main Chart Area */}
            <div className="relative flex-1 h-[120px]"> {/* Extra space for labels at bottom */}
                {/* Horizontal Grid Lines */}
                <div className="absolute top-0 left-0 right-0 h-[100px] flex flex-col justify-between pointer-events-none">
                    <div className={`border-t ${darkMode ? 'border-gray-700/30' : 'border-gray-200/50'} w-full h-0`}></div>
                    <div className={`border-t ${darkMode ? 'border-gray-700/30' : 'border-gray-200/50'} w-full h-0`}></div>
                    <div className={`border-b ${darkMode ? 'border-gray-700/30' : 'border-gray-200/50'} w-full h-0 opacity-50`}></div>
                </div>

                {/* Bars */}
                <div className="flex justify-between items-end h-[100px] px-2 relative z-0">
                    {data.map((item, idx) => {
                        const dlHeight = ((item.downloaded_bytes || 0) / maxVal) * chartHeight;
                        const upHeight = ((item.uploaded_bytes || 0) / maxVal) * chartHeight;
                        const dateStr = item.date ? new Date(item.date) : new Date();
                        const label = `${dateStr.getMonth() + 1}/${dateStr.getDate()}`;

                        return (
                            <div key={idx} className="flex flex-col items-center flex-1 group">
                                <div className="flex space-x-1 items-end h-[100px] relative">
                                    <div
                                        className="w-1.5 md:w-2 bg-green-500 rounded-t-sm transition-all duration-500 ease-out z-10"
                                        style={{ height: `${Math.max(dlHeight, 1.5)}px` }}
                                    >
                                        <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] p-2 rounded pointer-events-none z-20 whitespace-nowrap shadow-xl border border-gray-700">
                                            下载: {formatBytes(item.downloaded_bytes)}<br />
                                            上传: {formatBytes(item.uploaded_bytes)}
                                        </div>
                                    </div>
                                    <div
                                        className="w-1.5 md:w-2 bg-blue-500 rounded-t-sm transition-all duration-500 ease-out z-10"
                                        style={{ height: `${Math.max(upHeight, 1.5)}px` }}
                                    ></div>
                                </div>
                                <span className={`${textSecondary} text-[10px] mt-2 opacity-80 whitespace-nowrap`}>{label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Simple SVG Sparkline Component
const SpeedSparkline = ({ data, color, height = 40, maxDataPoints = 60 }) => {
    if (!data || data.length < 2) return null;

    // Normalize data to fit height
    const maxVal = Math.max(...data, 1024); // Minimum 1KB scale
    const minVal = 0;
    const range = maxVal - minVal;

    // Create points for SVG polyline
    const width = 100; // Use percentage width
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const normalizedVal = val - minVal;
        const y = height - (normalizedVal / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox={`0 0 100 ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Gradient definition */}
            <defs>
                <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Area fill */}
            <path
                d={`M0,${height} L${points} L100,${height} Z`}
                fill={`url(#grad-${color})`}
                stroke="none"
            />
            {/* Line */}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
};

const DashboardPage = ({ setActiveTab }) => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [downloadStats, setDownloadStats] = useState({
        totalDownloadSpeed: 0,
        totalUploadSpeed: 0,
        totalDownloaded: 0,
        totalUploaded: 0,
        histDownloaded: 0,
        histUploaded: 0,
        activeTorrents: 0,
        totalTorrents: 0
    });
    const [allTorrents, setAllTorrents] = useState([]);
    const [taskFilter, setTaskFilter] = useState('active'); // 'active' or 'all'
    const [historyData, setHistoryData] = useState([]);
    const [speedHistory, setSpeedHistory] = useState(() => {
        try {
            const cached = localStorage.getItem('speedHistory');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.downloads && parsed.uploads) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Failed to parse speedHistory cache:', e);
        }
        return { downloads: [], uploads: [] };
    });
    const [todayDownloads, setTodayDownloads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    // Configurable polling intervals (in seconds)
    const [pollingSettings, setPollingSettings] = useState({
        activeInterval: 10,  // Default: 10 seconds when active
        idleInterval: 30     // Default: 30 seconds when idle/no torrents
    });

    // Theme-aware classes
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-100';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-500';

    // Fetch polling settings on mount
    useEffect(() => {
        const fetchPollingSettings = async () => {
            try {
                const res = await authenticatedFetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();
                    setPollingSettings({
                        activeInterval: parseInt(data.dashboard_active_interval) || 10,
                        idleInterval: parseInt(data.dashboard_idle_interval) || 30
                    });
                }
            } catch (err) {
                console.error('Failed to fetch polling settings:', err);
            }
        };
        fetchPollingSettings();
    }, []);

    const fetchTorrentData = async () => {
        try {
            const res = await authenticatedFetch('/api/stats/dashboard');
            if (!res.ok) return;

            const data = await res.json();
            if (data && data.success) {
                const allTorrents = [];
                if (Array.isArray(data.clients)) {
                    data.clients.forEach(client => {
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
                    ...(data.stats || {}),
                    totalDownloadSpeed: calculatedDlSpeed,
                    totalUploadSpeed: calculatedUpSpeed
                });

                // Update speed history and save to localStorage
                setSpeedHistory(prev => {
                    const newDownloads = [...prev.downloads, calculatedDlSpeed].slice(-60); // Keep last 60 points
                    const newUploads = [...prev.uploads, calculatedUpSpeed].slice(-60);
                    const newHistory = { downloads: newDownloads, uploads: newUploads };
                    try {
                        localStorage.setItem('speedHistory', JSON.stringify(newHistory));
                    } catch (e) {
                        console.error('Failed to save speedHistory to localStorage:', e);
                    }
                    return newHistory;
                });

                setAllTorrents(allTorrents);
                setHistoryData(Array.isArray(data.history) ? data.history : []);
                setTodayDownloads(Array.isArray(data.todayDownloads) ? data.todayDownloads : []);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTorrentData();

        // Smart polling: adjust interval based on active torrents
        let interval;

        const startPolling = () => {
            const activeTorrents = allTorrents.filter(t =>
                (Number(t.dlspeed) || 0) > 0 || (Number(t.upspeed) || 0) > 0
            );

            // Dynamic interval based on activity (using configurable values)
            let currentInterval;
            if (activeTorrents.length > 0) {
                // Active: use configured active interval (in seconds, convert to ms)
                currentInterval = pollingSettings.activeInterval * 1000;
            } else {
                // Idle or no torrents: use configured idle interval
                currentInterval = pollingSettings.idleInterval * 1000;
            }

            if (interval) clearInterval(interval);
            interval = setInterval(fetchTorrentData, currentInterval);
        };

        // Start initial polling
        startPolling();

        // Restart polling when torrent list changes
        const restartTimer = setTimeout(startPolling, 1000);

        // Pause polling when page is hidden
        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (interval) clearInterval(interval);
            } else {
                // Resume polling when page becomes visible
                fetchTorrentData();
                startPolling();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (interval) clearInterval(interval);
            clearTimeout(restartTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [allTorrents.length, pollingSettings]); // Re-run when torrent count or polling settings change

    // Only show loading on initial fetch when we have no data
    if (loading && allTorrents.length === 0 && historyData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full p-20">
                <div className={`text-center ${textSecondary}`}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-sm font-medium">正在获取最新数据...</p>
                    <p className="text-xs opacity-50 mt-2">首次加载可能需要几秒钟</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="mb-2">
                <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>仪表盘</h1>
                <p className={`text-sm ${textSecondary} mt-1`}>各项数据实时监控与总览</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Traffic Stats Card */}
                <Card className="flex flex-col justify-between">
                    <div>
                        <p className={`${textSecondary} text-sm font-bold uppercase mb-4`}>流量统计 (今日)</p>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className={`${textSecondary} text-sm`}>下载</span>
                                <span className={`text-lg font-bold ${textPrimary}`}>{formatBytes(downloadStats.totalDownloaded || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`${textSecondary} text-sm`}>上传</span>
                                <span className={`text-lg font-bold text-blue-500`}>{formatBytes(downloadStats.totalUploaded || 0)}</span>
                            </div>
                        </div>
                    </div>
                    <div className={`mt-6 pt-4 border-t ${borderColor} flex justify-between items-center`}>
                        <div className="flex flex-col">
                            <span className={`${textSecondary} text-xs opacity-70`}>累计下载</span>
                            <span className={`text-base font-bold ${textPrimary}`}>{formatBytes(downloadStats.histDownloaded || 0)}</span>
                        </div>
                        <div className="h-8 w-px bg-gray-500/10 dark:bg-gray-500/20"></div>
                        <div className="flex flex-col items-end">
                            <span className={`${textSecondary} text-xs opacity-70`}>累计上传</span>
                            <span className={`text-base font-bold text-blue-500`}>{formatBytes(downloadStats.histUploaded || 0)}</span>
                        </div>
                    </div>
                </Card>

                {/* Speed Card */}
                <Card className="flex flex-col justify-between">
                    <div>
                        <p className={`${textSecondary} text-sm font-bold uppercase mb-4`}>即时速率</p>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className={`${textSecondary} text-sm`}>下载速度</span>
                                <span className={`text-lg font-bold text-green-500`}>{formatSpeed(downloadStats.totalDownloadSpeed || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`${textSecondary} text-sm`}>上传速度</span>
                                <span className={`text-lg font-bold text-blue-500`}>{formatSpeed(downloadStats.totalUploadSpeed || 0)}</span>
                            </div>
                        </div>
                    </div>

                    <div className={`mt-6 pt-4 border-t ${borderColor} h-16 relative`}>
                        <div className="absolute inset-x-0 bottom-0 h-14 flex items-end space-x-2">
                            <div className="flex-1 h-full relative">
                                <SpeedSparkline data={speedHistory.downloads} color="#22C55E" height={50} />
                            </div>
                            <div className="flex-1 h-full relative">
                                <SpeedSparkline data={speedHistory.uploads} color="#3B82F6" height={50} />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Chart Card */}
                <Card className="lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <p className={`${textSecondary} text-sm font-bold uppercase`}>最近7天流量</p>
                        <div className="flex space-x-3 text-[10px]">
                            <span className="flex items-center text-green-500"><i className="w-2 h-2 bg-green-500 rounded-full mr-1.5 inline-block"></i>下载</span>
                            <span className="flex items-center text-blue-500"><i className="w-2 h-2 bg-blue-500 rounded-full mr-1.5 inline-block"></i>上传</span>
                        </div>
                    </div>
                    <div className="h-[140px]">
                        <HistoryChart data={historyData} textSecondary={textSecondary} darkMode={darkMode} />
                    </div>
                </Card>
            </div>

            {/* Bottom Section: Active Tasks & Today's History */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Active Tasks list (Left 75%) */}
                <Card className="xl:col-span-3 flex flex-col h-full xl:min-h-[500px]">
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
                                                        <div className="flex items-center mt-1 text-[10px] text-gray-400 font-mono opacity-80">
                                                            <span>大小: {formatBytes(task.size || 0)}</span>
                                                            {task.state === 'downloading' && (
                                                                <span className="ml-3 text-blue-500 font-medium">
                                                                    剩余: {formatETA(task.eta)}
                                                                </span>
                                                            )}
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
                                                        {task.clientName || task.clientType || 'N/A'}
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
                </Card>

                {/* Today's History (Right 25%) */}
                <Card className="xl:col-span-1 flex flex-col h-full xl:min-h-[500px]">
                    <h2 className={`text-lg font-bold ${textPrimary} mb-4 flex items-center`}>
                        <span className="mr-2">📁</span> 今日已下载
                        {todayDownloads.length > 0 && (
                            <span className={`ml-2 text-[10px] font-normal ${textSecondary} ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'} px-1.5 py-0.5 rounded`}>
                                {todayDownloads.length}
                            </span>
                        )}
                    </h2>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 xl:max-h-[500px]">
                        {todayDownloads.length > 0 ? (
                            todayDownloads.map((item, idx) => (
                                <div key={idx} className="relative pl-4 border-l-2 border-blue-500/30 py-1.5">
                                    <p className={`text-xs font-medium ${textPrimary} line-clamp-2 leading-snug mb-1.5`} title={item.item_title || 'Unknown'}>
                                        {item.item_title || 'Unknown'}
                                    </p>
                                    <div className="flex justify-between items-center text-[10px] text-gray-500">
                                        <span className="bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded uppercase tracking-tighter truncate max-w-[70%]">
                                            {item.task_name}
                                        </span>
                                        <span className="font-mono flex-shrink-0">
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
                </Card>
            </div>
        </div>
    );
};

export default DashboardPage;

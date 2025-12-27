import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const DashboardPage = ({ setActiveTab }) => {
    const { darkMode } = useTheme();
    const [stats, setStats] = useState({
        sites: 0,
        clients: 0,
        activeTasks: 0
    });
    const [downloadStats, setDownloadStats] = useState({
        totalDownloadSpeed: 0,
        totalUploadSpeed: 0,
        totalDownloaded: 0,
        totalUploaded: 0,
        activeTorrents: 0,
        totalTorrents: 0
    });
    const [activeTasks, setActiveTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgButton = darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200';

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [sitesRes, clientsRes, tasksRes, downloadStatsRes] = await Promise.all([
                    fetch('/api/sites'),
                    fetch('/api/clients'),
                    fetch('/api/tasks'),
                    fetch('/api/stats')
                ]);

                const sites = await sitesRes.json();
                const clients = await clientsRes.json();
                const tasks = await tasksRes.json();
                const downloadStatsData = await downloadStatsRes.json();

                setStats({
                    sites: sites.length || 0,
                    clients: clients.length || 0,
                    activeTasks: tasks.filter(t => t.enabled).length || 0
                });

                if (downloadStatsData.success) {
                    setDownloadStats(downloadStatsData.stats);

                    // Extract active torrents from all clients
                    const allTorrents = [];
                    if (downloadStatsData.clients) {
                        downloadStatsData.clients.forEach(client => {
                            if (client.torrents) {
                                client.torrents.forEach(torrent => {
                                    allTorrents.push({
                                        ...torrent,
                                        clientName: client.clientName,
                                        clientType: client.clientType
                                    });
                                });
                            }
                        });
                    }

                    // Filter active torrents (downloading or uploading)
                    const active = allTorrents.filter(t =>
                        t.state === 'downloading' ||
                        t.state === 'uploading' ||
                        t.dlspeed > 0 ||
                        t.upspeed > 0
                    );
                    setActiveTasks(active);
                }
            } catch (err) {
                console.error('Failed to fetch dashboard stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();

        // Refresh stats every 3 seconds
        const interval = setInterval(fetchStats, 3000);

        return () => clearInterval(interval);
    }, []);

    // Helper functions for formatting
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSecond) => {
        return formatBytes(bytesPerSecond) + '/s';
    };

    const formatProgress = (progress) => {
        return (progress * 100).toFixed(1) + '%';
    };

    const StatCard = ({ title, value, icon, color, onClick }) => (
        <div
            onClick={onClick}
            className={`${bgMain} rounded-xl p-6 border ${borderColor} cursor-pointer hover:border-blue-500/50 transition-all hover:transform hover:scale-105 shadow-sm`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className={`${textSecondary} text-sm font-medium mb-1`}>{title}</p>
                    <h3 className={`text-3xl font-bold ${textPrimary}`}>{value}</h3>
                </div>
                <div className={`p-3 rounded-lg ${color} text-white text-xl`}>
                    {icon}
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8">
            <div className="mb-6 md:mb-8">
                <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>仪表盘</h1>
                <p className={`${textSecondary} mt-1 text-sm md:base`}>欢迎回来，这里是系统的运行概览</p>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-40 ${textSecondary}`}>加载数据中...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                        {/* System Stats - Vertical stack on desktop */}
                        <div className="lg:col-span-1 space-y-4">
                            <div
                                onClick={() => setActiveTab('sites')}
                                className={`${bgMain} rounded-xl p-4 border ${borderColor} cursor-pointer hover:border-blue-500/50 transition-all shadow-sm flex items-center justify-between group`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-blue-500 text-white text-lg">🌐</div>
                                    <div>
                                        <p className={`${textSecondary} text-xs font-medium`}>已配置站点</p>
                                        <h3 className={`text-xl font-bold ${textPrimary}`}>{stats.sites}</h3>
                                    </div>
                                </div>
                                <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                            </div>

                            <div
                                onClick={() => setActiveTab('clients')}
                                className={`${bgMain} rounded-xl p-4 border ${borderColor} cursor-pointer hover:border-blue-500/50 transition-all shadow-sm flex items-center justify-between group`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-green-500 text-white text-lg">📥</div>
                                    <div>
                                        <p className={`${textSecondary} text-xs font-medium`}>下载客户端</p>
                                        <h3 className={`text-xl font-bold ${textPrimary}`}>{stats.clients}</h3>
                                    </div>
                                </div>
                                <span className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                            </div>

                            <div
                                onClick={() => setActiveTab('tasks')}
                                className={`${bgMain} rounded-xl p-4 border ${borderColor} cursor-pointer hover:border-blue-500/50 transition-all shadow-sm flex items-center justify-between group`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-purple-500 text-white text-lg">⏰</div>
                                    <div>
                                        <p className={`${textSecondary} text-xs font-medium`}>运行中任务</p>
                                        <h3 className={`text-xl font-bold ${textPrimary}`}>{stats.activeTasks}</h3>
                                    </div>
                                </div>
                                <span className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                            </div>
                        </div>

                        {/* Download Statistics - Main area on desktop */}
                        <div className={`lg:col-span-3 ${bgMain} rounded-xl border ${borderColor} p-6 shadow-sm flex flex-col justify-between`}>
                            <div>
                                <h2 className={`text-xl font-bold ${textPrimary} mb-6 flex items-center`}>
                                    <span className="mr-2">📊</span> 下载统计
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                        <p className={`${textSecondary} text-xs mb-1 uppercase tracking-wider`}>下载速度</p>
                                        <p className={`text-xl md:text-2xl font-bold text-green-500`}>
                                            {formatSpeed(downloadStats.totalDownloadSpeed)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={`${textSecondary} text-xs mb-1 uppercase tracking-wider`}>上传速度</p>
                                        <p className={`text-xl md:text-2xl font-bold text-blue-500`}>
                                            {formatSpeed(downloadStats.totalUploadSpeed)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={`${textSecondary} text-xs mb-1 uppercase tracking-wider`}>总下载量</p>
                                        <p className={`text-xl md:text-2xl font-bold ${textPrimary}`}>
                                            {formatBytes(downloadStats.totalDownloaded)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={`${textSecondary} text-xs mb-1 uppercase tracking-wider`}>总上传量</p>
                                        <p className={`text-xl md:text-2xl font-bold ${textPrimary}`}>
                                            {formatBytes(downloadStats.totalUploaded)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className={`mt-6 pt-6 border-t ${borderColor} grid grid-cols-2 gap-6`}>
                                <div className="flex items-center space-x-4">
                                    <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-green-900/20' : 'bg-green-50'} flex items-center justify-center text-green-500`}>
                                        ↑
                                    </div>
                                    <div>
                                        <p className={`${textSecondary} text-xs`}>活跃种子</p>
                                        <p className={`text-lg font-bold text-green-500`}>{downloadStats.activeTorrents}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-center ${textSecondary}`}>
                                        📑
                                    </div>
                                    <div>
                                        <p className={`${textSecondary} text-xs`}>总种子数</p>
                                        <p className={`text-lg font-bold ${textPrimary}`}>{downloadStats.totalTorrents}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Tasks */}
                    <div className={`${bgMain} rounded-xl border ${borderColor} p-6 shadow-sm mb-8`}>
                        <h2 className={`text-xl font-bold ${textPrimary} mb-4`}>🚀 当前活动任务</h2>
                        {activeTasks.length === 0 ? (
                            <p className={`${textSecondary} text-center py-8`}>暂无活跃的下载任务</p>
                        ) : (
                            <div className="space-y-4">
                                {activeTasks.slice(0, 10).map((task, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 mr-4">
                                                <h3 className={`font-medium ${textPrimary} mb-1 truncate`}>
                                                    {task.name}
                                                </h3>
                                                <p className={`text-xs ${textSecondary}`}>
                                                    {task.clientName} • {task.state}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-medium ${textPrimary}`}>
                                                    {formatProgress(task.progress)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-200'} mb-2`}>
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                                                style={{ width: `${(task.progress * 100).toFixed(1)}%` }}
                                            />
                                        </div>

                                        <div className="flex justify-between items-center text-xs">
                                            <div className={textSecondary}>
                                                <span className="text-green-500">↓ {formatSpeed(task.dlspeed)}</span>
                                                <span className="mx-2">•</span>
                                                <span className="text-blue-500">↑ {formatSpeed(task.upspeed)}</span>
                                            </div>
                                            <div className={textSecondary}>
                                                {formatBytes(task.size)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {activeTasks.length > 10 && (
                                    <p className={`text-center ${textSecondary} text-sm`}>
                                        还有 {activeTasks.length - 10} 个任务未显示
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className={`${bgMain} rounded-xl border ${borderColor} p-6 shadow-sm`}>
                        <h2 className={`text-xl font-bold ${textPrimary} mb-4`}>快捷操作</h2>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setActiveTab('sites')}
                                className={`flex items-center space-x-2 px-4 py-3 ${bgButton} rounded-lg ${textPrimary} transition-colors`}
                            >
                                <span>➕ 添加新站点</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className={`flex items-center space-x-2 px-4 py-3 ${bgButton} rounded-lg ${textPrimary} transition-colors`}
                            >
                                <span>⚡ 创建自动任务</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default DashboardPage;

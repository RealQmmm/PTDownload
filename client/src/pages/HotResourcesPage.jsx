import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const HotResourcesPage = () => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [resources, setResources] = useState([]);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [sites, setSites] = useState([]);
    const [stats, setStats] = useState(null);

    // Filter and sort states
    const [filterSite, setFilterSite] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all'); // all, pending, downloaded, ignored
    const [sortBy, setSortBy] = useState('score'); // score, time, size

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const bgSecondary = darkMode ? 'bg-gray-800' : 'bg-gray-50';

    useEffect(() => {
        fetchData();
        fetchSites();
        fetchStats();
        const interval = setInterval(() => {
            fetchData();
            fetchStats();
        }, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [resourcesRes, configRes] = await Promise.all([
                authenticatedFetch('/api/hot-resources?limit=50'),
                authenticatedFetch('/api/hot-resources/config')
            ]);

            const resourcesData = await resourcesRes.json();
            const configData = await configRes.json();

            if (resourcesData.success) {
                setResources(resourcesData.resources || []);
            }
            if (configData.success) {
                setConfig(configData.config);
            }
        } catch (err) {
            console.error('Failed to fetch hot resources:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleManualCheck = async () => {
        setChecking(true);
        try {
            const res = await authenticatedFetch('/api/hot-resources/check', {
                method: 'POST'
            });
            const data = await res.json();

            if (data.success) {
                alert(`检测完成！发现 ${data.totalNew} 个新的热门资源`);
                fetchData();
            } else {
                alert(`检测失败：${data.message}`);
            }
        } catch (err) {
            alert('检测失败');
        } finally {
            setChecking(false);
        }
    };

    const handleDownload = async (resource) => {
        try {
            const res = await authenticatedFetch(`/api/hot-resources/${resource.id}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            const data = await res.json();
            if (data.success) {
                alert('下载已开始！');
                fetchData();
            } else {
                alert(`下载失败：${data.message}`);
            }
        } catch (err) {
            alert('下载失败');
        }
    };

    const handleIgnore = async (resource) => {
        try {
            await authenticatedFetch(`/api/hot-resources/${resource.id}/action`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ignored' })
            });
            fetchData();
        } catch (err) {
            console.error('Failed to ignore resource:', err);
        }
    };

    const fetchSites = async () => {
        try {
            const res = await authenticatedFetch('/api/sites');
            const data = await res.json();
            if (data.success) {
                setSites(data.sites || []);
            }
        } catch (err) {
            console.error('Failed to fetch sites:', err);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await authenticatedFetch('/api/hot-resources/stats');
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };


    // Filter and sort resources
    const getFilteredAndSortedResources = () => {
        let filtered = [...resources];

        // Apply site filter
        if (filterSite !== 'all') {
            filtered = filtered.filter(r => r.site_id === parseInt(filterSite));
        }

        // Apply status filter
        if (filterStatus === 'pending') {
            filtered = filtered.filter(r => !r.downloaded && r.user_action !== 'ignored');
        } else if (filterStatus === 'downloaded') {
            filtered = filtered.filter(r => r.downloaded);
        } else if (filterStatus === 'ignored') {
            filtered = filtered.filter(r => r.user_action === 'ignored');
        }

        // Apply sorting
        filtered.sort((a, b) => {
            if (sortBy === 'score') {
                return b.hot_score - a.hot_score;
            } else if (sortBy === 'time') {
                return new Date(b.detected_time) - new Date(a.detected_time);
            } else if (sortBy === 'size') {
                return (b.size || 0) - (a.size || 0);
            }
            return 0;
        });

        return filtered;
    };

    const displayedResources = getFilteredAndSortedResources();


    const formatSize = (bytes) => {
        if (!bytes) return '--';
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(2)} GB`;
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '--';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / (1000 * 60));

        if (diff < 60) return `${diff}分钟前`;
        if (diff < 1440) return `${Math.floor(diff / 60)}小时前`;
        return `${Math.floor(diff / 1440)}天前`;
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-red-500';
        if (score >= 60) return 'text-orange-500';
        if (score >= 40) return 'text-yellow-500';
        return 'text-green-500';
    };

    if (loading) {
        return (
            <div className="p-4 md:p-8">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>🔥 热门资源</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>
                        自动检测热门种子 · {config?.enabled ? '✅ 已启用' : '❌ 已禁用'}
                    </p>
                </div>
                <div className="flex space-x-2">
                    <Button
                        onClick={handleManualCheck}
                        disabled={checking}
                        variant="secondary"
                    >
                        {checking ? '检测中...' : '🔍 立即检测'}
                    </Button>
                </div>
            </div>

            {/* Statistics Overview */}
            {stats && resources.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4">
                        <div className="text-center">
                            <p className={`text-xs ${textSecondary} mb-1`}>总计</p>
                            <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total}</p>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="text-center">
                            <p className={`text-xs ${textSecondary} mb-1`}>待处理</p>
                            <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="text-center">
                            <p className={`text-xs ${textSecondary} mb-1`}>已下载</p>
                            <p className="text-2xl font-bold text-green-500">{stats.downloaded}</p>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="text-center">
                            <p className={`text-xs ${textSecondary} mb-1`}>已通知</p>
                            <p className="text-2xl font-bold text-blue-500">{stats.notified}</p>
                        </div>
                    </Card>
                </div>
            )}

            {/* Top Sites */}
            {stats && stats.topSites && stats.topSites.length > 0 && (
                <Card className="p-4">
                    <h3 className={`text-sm font-bold ${textPrimary} mb-3`}>📊 站点分布</h3>
                    <div className="space-y-2">
                        {stats.topSites.map((site, index) => (
                            <div key={index}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className={textPrimary}>{site.name || '未知站点'}</span>
                                    <span className={textSecondary}>{site.count} 个</span>
                                </div>
                                <div className={`w-full h-2 rounded-full ${bgSecondary} overflow-hidden`}>
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                        style={{ width: `${(site.count / stats.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Filters and Sort */}
            {resources.length > 0 && (
                <Card className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Site Filter */}
                        <div>
                            <label className={`block text-xs font-bold ${textSecondary} mb-2`}>站点筛选</label>
                            <select
                                value={filterSite}
                                onChange={(e) => setFilterSite(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                                    } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            >
                                <option value="all">全部站点 ({resources.length})</option>
                                {sites.filter(s => s.enabled).map(site => {
                                    const count = resources.filter(r => r.site_id === site.id).length;
                                    return count > 0 ? (
                                        <option key={site.id} value={site.id}>
                                            {site.name} ({count})
                                        </option>
                                    ) : null;
                                })}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className={`block text-xs font-bold ${textSecondary} mb-2`}>状态筛选</label>
                            <div className="flex space-x-2">
                                {[
                                    { value: 'all', label: '全部', icon: '📋' },
                                    { value: 'pending', label: '待处理', icon: '⏳' },
                                    { value: 'downloaded', label: '已下载', icon: '✅' },
                                    { value: 'ignored', label: '已忽略', icon: '🚫' }
                                ].map(status => (
                                    <button
                                        key={status.value}
                                        onClick={() => setFilterStatus(status.value)}
                                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-colors ${filterStatus === status.value
                                            ? 'bg-blue-500 text-white'
                                            : `${bgSecondary} ${textSecondary} hover:opacity-80`
                                            }`}
                                    >
                                        {status.icon}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sort By */}
                        <div>
                            <label className={`block text-xs font-bold ${textSecondary} mb-2`}>排序方式</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                                    } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            >
                                <option value="score">🔥 热度分数</option>
                                <option value="time">⏰ 检测时间</option>
                                <option value="size">📦 文件大小</option>
                            </select>
                        </div>
                    </div>

                    {/* Results Count */}
                    <div className={`mt-3 text-xs ${textSecondary} text-center`}>
                        显示 {displayedResources.length} / {resources.length} 个资源
                    </div>
                </Card>
            )}

            {displayedResources.length === 0 && resources.length > 0 ? (
                <Card className="py-12 text-center border-dashed">
                    <p className={textSecondary}>没有符合筛选条件的资源</p>
                    <p className={`${textSecondary} text-sm mt-2`}>
                        尝试调整筛选条件
                    </p>
                </Card>
            ) : resources.length === 0 ? (

                <Card className="py-12 text-center border-dashed">
                    <p className={textSecondary}>暂无热门资源</p>
                    <p className={`${textSecondary} text-sm mt-2`}>
                        {config?.enabled ? '等待自动检测或点击"立即检测"按钮' : '请先在设置中启用热门资源检测'}
                    </p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {displayedResources.map((resource) => (
                        <Card key={resource.id} className="p-3 hover:shadow-md transition-shadow">
                            {/* Header - Title and Score */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className={`font-bold ${textPrimary} text-sm line-clamp-2 flex-1`} title={resource.title}>
                                    {resource.title}
                                </h3>
                                <div className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${getScoreColor(resource.hot_score)} ${bgSecondary}`}>
                                    🔥 {resource.hot_score}
                                </div>
                            </div>

                            {/* Meta Info - Site and Time */}
                            <p className={`text-xs ${textSecondary} mb-2`}>
                                {resource.site_name} · {formatTime(resource.publish_time)}
                            </p>

                            {/* Stats and Actions - Combined */}
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-3 flex-1">
                                    <span className={textSecondary}>
                                        🌱 <span className={textPrimary}>{resource.seeders}</span>
                                    </span>
                                    <span className={textSecondary}>
                                        📥 <span className={textPrimary}>{resource.leechers}</span>
                                    </span>
                                    <span className={textSecondary}>
                                        📦 <span className={textPrimary}>{formatSize(resource.size)}</span>
                                    </span>
                                    {resource.promotion && resource.promotion !== '无' && (
                                        <span className="text-green-500 font-bold">
                                            🎁 {resource.promotion}
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-1.5 shrink-0">
                                    {resource.downloaded ? (
                                        <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded text-xs font-bold whitespace-nowrap">
                                            ✓ 已下载
                                        </div>
                                    ) : resource.user_action === 'ignored' ? (
                                        <div className="px-3 py-1 bg-gray-500/10 text-gray-500 rounded text-xs font-bold whitespace-nowrap">
                                            已忽略
                                        </div>
                                    ) : (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                className="text-xs py-1 px-3"
                                                onClick={() => handleDownload(resource)}
                                            >
                                                ⬇️
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-xs py-1 px-2"
                                                onClick={() => handleIgnore(resource)}
                                            >
                                                ✕
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HotResourcesPage;

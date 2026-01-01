import React, { useState, useEffect, useMemo, memo } from 'react';
import { useTheme } from '../App';

const SiteHeatmap = memo(({ siteId, darkMode, borderColor, textSecondary, authenticatedFetch }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchHeatmap = async () => {
            try {
                const res = await authenticatedFetch(`/api/sites/${siteId}/heatmap`);
                const heatmapData = await res.json();
                setData(heatmapData);
            } catch (err) {
                console.error('Failed to fetch heatmap:', err);
            }
        };
        fetchHeatmap();
    }, [siteId, authenticatedFetch]);

    const days = useMemo(() => {
        const result = [];
        const today = new Date();
        const heatmapData = Array.isArray(data) ? data : [];

        for (let i = 89; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayData = heatmapData.find(d => d.date === dateStr);
            result.push({
                date: dateStr,
                value: dayData ? dayData.uploaded_bytes : 0
            });
        }
        return result;
    }, [data]);

    const getColor = (value) => {
        if (value === 0) return darkMode ? 'bg-gray-700/30' : 'bg-gray-100';
        if (value < 1024 * 1024 * 1024) return 'bg-blue-500/30'; // < 1GB
        if (value < 10 * 1024 * 1024 * 1024) return 'bg-blue-500/60'; // < 10GB
        if (value < 50 * 1024 * 1024 * 1024) return 'bg-blue-500'; // < 50GB
        return 'bg-blue-400'; // > 50GB
    }

    const formatSize = (bytes) => {
        if (bytes === 0) return '无上传';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        if (bytes < 1024 * 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1) + ' TB';
    };

    return (
        <div className="mt-4 pt-4 border-t border-dashed border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] ${textSecondary} font-bold uppercase tracking-wider`}>上传贡献图 (最近90天)</span>
            </div>
            <div className="flex flex-wrap gap-[3px]">
                {days.map((day, idx) => (
                    <div
                        key={idx}
                        className={`w-[10px] h-[16px] rounded-[1px] ${getColor(day.value)} transition-colors cursor-help`}
                        title={`${day.date}: ${formatSize(day.value)}`}
                    />
                ))}
            </div>
        </div>
    );
});

const SitesPage = () => {
    const { darkMode, fetchStatus, authenticatedFetch } = useTheme();
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSite, setEditingSite] = useState(null);
    const [refreshingId, setRefreshingId] = useState(null);
    const [checkingId, setCheckingId] = useState(null);

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const inputBg = darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';
    const hoverBg = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        url: '',
        cookies: '',
        default_rss_url: '',
        type: 'NexusPHP',
        enabled: 1,
        auto_checkin: 0
    });

    const fetchSites = async () => {
        try {
            const res = await authenticatedFetch('/api/sites');
            const data = await res.json();
            setSites(data);
            // Also update global status
            fetchStatus();
        } catch (err) {
            console.error('Failed to fetch sites:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const method = editingSite ? 'PUT' : 'POST';
        const url = editingSite ? `/api/sites/${editingSite.id}` : '/api/sites';

        try {
            await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            setShowModal(false);
            setEditingSite(null);

            setFormData({ name: '', url: '', cookies: '', default_rss_url: '', type: 'NexusPHP', enabled: 1, auto_checkin: 0 });
            fetchSites();
        } catch (err) {
            alert('保存失败: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('确定要删除这个站点吗？')) return;
        try {
            await authenticatedFetch(`/api/sites/${id}`, { method: 'DELETE' });
            fetchSites();
        } catch (err) {
            alert('删除失败');
        }
    };

    const handleAdd = () => {
        setEditingSite(null);
        setFormData({ name: '', url: '', cookies: '', default_rss_url: '', type: 'NexusPHP', enabled: 1, auto_checkin: 0 });
        setShowModal(true);
    };

    const openEdit = (site) => {
        if (site) {
            setEditingSite(site);
            setFormData({
                name: site.name,
                url: site.url,
                cookies: site.cookies || '',
                default_rss_url: site.default_rss_url || '',
                type: site.type || 'NexusPHP',
                enabled: site.enabled,
                auto_checkin: site.auto_checkin || 0
            });
            setShowModal(true);
        } else {
            setEditingSite(null);
            setFormData({ name: '', url: '', cookies: '', default_rss_url: '', type: 'NexusPHP', enabled: 1, auto_checkin: 0 });
            setShowModal(true);
        }
    };

    const toggleStatus = async (site) => {
        try {
            await authenticatedFetch(`/api/sites/${site.id}/toggle`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !site.enabled })
            });
            fetchSites();
        } catch (err) {
            alert('更新失败');
        }
    };

    const syncAllSiteData = async () => {
        setLoading(true);
        try {
            await authenticatedFetch('/api/sites/check-all', { method: 'POST' });
            fetchSites();
        } catch (err) {
            console.error('Failed to sync site data:', err);
        } finally {
            setLoading(false);
        }
    };

    const syncSingleSiteData = async (id) => {
        setRefreshingId(id);
        try {
            const res = await authenticatedFetch(`/api/sites/${id}/refresh-stats`);
            const data = await res.json();
            if (data.stats) {
                await fetchSites();
            } else {
                alert('同步失败，请检查 Cookie 是否有效');
                await fetchSites();
            }
        } catch (err) {
            alert('同步失败');
        } finally {
            setRefreshingId(null);
        }
    };

    const manualCheckin = async (id, notifySuccess = false) => {
        setCheckingId(id);
        try {
            const res = await authenticatedFetch(`/api/sites/${id}/checkin`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                await fetchSites();
                if (notifySuccess) alert('签到成功！');
            } else {
                alert('签到失败，请检查 Cookie 是否有效');
            }
        } catch (err) {
            alert('请求出错');
        } finally {
            setCheckingId(null);
        }
    };

    const isToday = (dateStr) => {
        if (!dateStr) return false;
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return false; // Invalid date
            return date.toDateString() === new Date().toDateString();
        } catch (e) {
            return false;
        }
    };

    const checkinAll = async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch('/api/sites/checkin-all', { method: 'POST' });
            const data = await res.json();
            alert(`已尝试为所有站点签到，成功: ${data.count}`);
            fetchSites();
        } catch (err) {
            alert('一键签到失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>站点管理</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>配置您已加入的 PT 站点</p>
                </div>
                <div className="flex space-x-2 w-full sm:w-auto">
                    <button
                        onClick={handleAdd}
                        className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20"
                    >
                        + 添加新站点
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-64 ${textSecondary}`}>加载中...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sites.map((site) => (
                        <div key={site.id} className={`${bgMain} rounded-xl p-6 border ${borderColor} hover:border-blue-500/50 transition-all group shadow-sm relative overflow-hidden`}>
                            {/* Cookie Status Indicator */}
                            {site.enabled && site.type !== 'Mock' && (
                                <div className="absolute top-0 right-0 flex">
                                    <div className={`px-2 py-0.5 text-[8px] font-bold uppercase border-l border-b ${borderColor} ${site.cookie_status === 1 ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                                        }`}>
                                        {site.cookie_status === 1 ? 'Cookie 已失效' : 'Cookie 正常'}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center">
                                    <div className={`w-12 h-12 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-lg flex items-center justify-center text-2xl mr-4 group-hover:scale-110 transition-transform`}>
                                        🌐
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center space-x-2">
                                            <h3 className={`font-bold text-lg ${textPrimary} truncate`} title={site.name}>{site.name}</h3>
                                            {site.enabled && (
                                                <button
                                                    onClick={() => !checkingId && manualCheckin(site.id, true)}
                                                    disabled={checkingId === site.id}
                                                    className={`text-sm transition-all ${checkingId === site.id ? 'animate-bounce' : 'hover:scale-125'} ${site.auto_checkin === 1 ? 'grayscale-0' : 'grayscale opacity-40 hover:opacity-100'} ${checkingId === site.id ? 'opacity-100 cursor-not-allowed' : ''}`}
                                                    title={site.auto_checkin === 1 ? "已开启每日自动签到 - 点击手动签到" : "自动签到已关闭 - 点击手动签到"}
                                                >
                                                    ⏰
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center mt-0.5 space-x-2">
                                            <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">{site.type}</span>
                                            {site.username && (
                                                <div className="flex items-center">
                                                    <span className="w-1 h-1 rounded-full bg-gray-500/50 mx-1"></span>
                                                    <span className={`text-[10px] ${textSecondary} font-medium`}>{site.username}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-1 shrink-0">
                                    {site.enabled && (
                                        <>
                                            <button
                                                onClick={() => !refreshingId && syncSingleSiteData(site.id)}
                                                disabled={refreshingId === site.id}
                                                className={`${textSecondary} hover:text-blue-400 transition-colors p-1.5 rounded-lg ${hoverBg} ${refreshingId === site.id ? 'cursor-not-allowed' : ''}`}
                                                title="手动刷新站点数据与状态"
                                            >
                                                <span className={`text-sm inline-block ${refreshingId === site.id ? 'animate-spin' : ''}`}>🔄</span>
                                            </button>
                                        </>
                                    )}
                                    <button onClick={() => openEdit(site)} className={`${textSecondary} hover:${textPrimary} transition-colors p-1.5 rounded-lg ${hoverBg}`} title="编辑站点">
                                        <span className="text-sm">✏️</span>
                                    </button>
                                    <button onClick={() => handleDelete(site.id)} className={`${textSecondary} hover:text-red-400 transition-colors p-1.5 rounded-lg ${hoverBg}`} title="删除站点">
                                        <span className="text-sm">🗑️</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-4 min-w-0">
                                <p className={`${textSecondary} text-xs truncate flex-1`}>{site.url}</p>
                                {isToday(site.last_checkin_at) && (
                                    <span className="text-[10px] text-green-500 font-bold flex items-center ml-2 shrink-0">
                                        <span className="mr-1">✅</span> 今日已签到
                                    </span>
                                )}
                            </div>

                            {/* User Stats Overview */}
                            {site.enabled && (
                                <div className={`grid grid-cols-3 gap-2 mb-4 p-3 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50'} border ${borderColor}`}>
                                    <div className="space-y-0.5">
                                        <p className={`text-[10px] ${textSecondary} uppercase`}>上传量</p>
                                        <p className={`text-xs font-bold ${textPrimary}`}>{site.upload || '--'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className={`text-[10px] ${textSecondary} uppercase`}>下载量</p>
                                        <p className={`text-xs font-bold ${textPrimary}`}>{site.download || '--'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className={`text-[10px] ${textSecondary} uppercase`}>分享率</p>
                                        <p className={`text-xs font-bold ${parseFloat(site.ratio) < 1 ? 'text-red-400' : 'text-green-400'}`}>
                                            {site.ratio || '--'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {site.enabled && (
                                <SiteHeatmap
                                    siteId={site.id}
                                    darkMode={darkMode}
                                    borderColor={borderColor}
                                    textSecondary={textSecondary}
                                    authenticatedFetch={authenticatedFetch}
                                />
                            )}

                            <div className={`flex justify-between items-center pt-4 border-t ${borderColor}`}>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${site.enabled
                                    ? (darkMode ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-600 border-green-100')
                                    : (darkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100')
                                    }`}>
                                    {site.enabled ? '已启用' : '已禁用'}
                                </span>
                                <button
                                    onClick={() => toggleStatus(site)}
                                    className={`text-xs font-medium ${site.enabled ? `${textSecondary} hover:${textPrimary}` : 'text-blue-400 hover:text-blue-300'}`}
                                >
                                    {site.enabled ? '禁用' : '启用'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {sites.length === 0 && (
                        <div className={`col-span-full py-12 text-center ${textSecondary} ${bgMain} rounded-xl border border-dashed ${borderColor}`}>
                            暂无站点，点击上方按钮添加。
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-2xl w-full max-w-lg border ${borderColor} shadow-2xl`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>{editingSite ? '编辑站点' : '添加站点'}</h2>
                            <button onClick={() => setShowModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>站点名称</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="例如: M-Team"
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>站点地址 (URL)</label>
                                <input
                                    type="url"
                                    required
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                    placeholder="https://kp.m-team.cc"
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>默认 RSS 地址 (用于 RSS 搜索)</label>
                                <input
                                    type="url"
                                    value={formData.default_rss_url}
                                    onChange={(e) => setFormData({ ...formData, default_rss_url: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                    placeholder="https://example.com/torrentrss.php?..."
                                />
                                <p className="text-xs text-gray-500 mt-1">留空则自动尝试构造 /torrentrss.php</p>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>站点类型</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                >
                                    <option value="NexusPHP">NexusPHP</option>
                                    <option value="Gazelle">Gazelle</option>
                                    <option value="Unit3D">Unit3D</option>
                                    <option value="Mock">Mock (Testing)</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Cookies (可选)</label>
                                <textarea
                                    value={formData.cookies}
                                    onChange={(e) => setFormData({ ...formData, cookies: e.target.value })}
                                    placeholder="粘贴浏览器的 Cookie 以便进行自动任务"
                                    rows="3"
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                ></textarea>
                            </div>
                            <div className="flex items-center space-x-2 py-2">
                                <input
                                    type="checkbox"
                                    id="auto_checkin"
                                    checked={formData.auto_checkin === 1}
                                    onChange={(e) => setFormData({ ...formData, auto_checkin: e.target.checked ? 1 : 0 })}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="auto_checkin" className={`text-sm font-medium ${textPrimary}`}>启用每日自动签到</label>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className={`px-6 py-2 rounded-lg ${textSecondary} ${hoverBg} transition-colors`}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                                >
                                    保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SitesPage;

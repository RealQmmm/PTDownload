import React, { useState, useEffect, useMemo, memo } from 'react';
import { useTheme } from '../App';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

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
        <div className="mt-2 pt-2 border-t border-dashed border-gray-500/20">
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

// 站点图标组件：解决重叠与加载问题
const SiteIcon = ({ site, darkMode, getDomain, authenticatedFetch }) => {
    // 如果已经有缓存过的图标，初始化为已加载状态，避免闪烁
    const [loaded, setLoaded] = React.useState(!!site.site_icon);
    const [error, setError] = React.useState(false);
    const [refreshKey, setRefreshKey] = React.useState(0);
    const [localIcon, setLocalIcon] = React.useState(site.site_icon);

    // 当父组件数据更新时同步本地状态
    React.useEffect(() => {
        setLocalIcon(site.site_icon);
        if (site.site_icon) setLoaded(true);
    }, [site.site_icon]);

    const handleDoubleClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            // 1. 先从数据库清除旧图标
            await authenticatedFetch(`/api/sites/${site.id}/icon`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ iconUrl: '' })
            });

            // 2. 重置状态触发重新加载
            setLocalIcon(null);
            setLoaded(false);
            setError(false);
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error('Failed to refresh icon:', err);
        }
    };

    // 直接从站点的根目录获取 favicon.ico
    const getDirectIcon = (url) => {
        try {
            const u = new URL(url);
            return `${u.origin}/favicon.ico`;
        } catch (e) {
            return null;
        }
    };

    const directSrc = getDirectIcon(site.url);
    const iconSrc = localIcon || (directSrc ? `${directSrc}${directSrc.includes('?') ? '&' : '?'}cache=${refreshKey}` : null);

    return (
        <div
            onDoubleClick={handleDoubleClick}
            title="双击刷新图标"
            className={`w-12 h-12 flex-shrink-0 ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-lg flex items-center justify-center text-2xl mr-3 group-hover:scale-110 transition-transform overflow-hidden relative cursor-pointer active:scale-95`}
        >
            {(!loaded || error || !iconSrc) && <span className="absolute inset-0 flex items-center justify-center">🌐</span>}
            {iconSrc && !error && (
                <img
                    key={`${site.id}-${refreshKey}`}
                    src={iconSrc}
                    alt=""
                    className={`w-8 h-8 object-contain absolute inset-0 m-auto z-10 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={(e) => {
                        setLoaded(true);
                        if (!localIcon) {
                            const iconUrl = e.target.src;
                            authenticatedFetch(`/api/sites/${site.id}/icon`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ iconUrl })
                            }).catch(() => { });
                        }
                    }}
                    onError={() => {
                        setError(true);
                    }}
                />
            )}
        </div>
    );
};

const SitesPage = () => {
    const { darkMode, fetchStatus, authenticatedFetch } = useTheme();
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSite, setEditingSite] = useState(null);
    const [refreshingId, setRefreshingId] = useState(null);
    const [checkingId, setCheckingId] = useState(null);

    // Theme-aware classes
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        cookies: '',
        api_key: '',
        default_rss_url: '',
        type: 'NexusPHP',
        enabled: 1,
        auto_checkin: 0,
        supports_checkin: 1
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

    const getDomain = (url) => {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return '';
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
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

            setFormData({ name: '', url: '', cookies: '', api_key: '', default_rss_url: '', type: 'NexusPHP', enabled: 1, auto_checkin: 0, supports_checkin: 1 });
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
        setFormData({ name: '', url: '', cookies: '', api_key: '', default_rss_url: '', type: 'NexusPHP', enabled: 1, auto_checkin: 0, supports_checkin: 1 });
        setShowModal(true);
    };

    const openEdit = (site) => {
        if (site) {
            setEditingSite(site);
            setFormData({
                name: site.name,
                url: site.url,
                cookies: site.cookies || '',
                api_key: site.api_key || '',
                default_rss_url: site.default_rss_url || '',
                type: site.type || 'NexusPHP',
                enabled: site.enabled,
                auto_checkin: site.auto_checkin || 0,
                supports_checkin: site.supports_checkin !== undefined ? site.supports_checkin : 1
            });
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



    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>站点管理</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>配置您已加入的 PT 站点</p>
                </div>
                <div className="flex space-x-2 w-full sm:w-auto">

                    <Button onClick={handleAdd} variant="primary" className="flex-1 sm:flex-none">
                        + 添加新站点
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-64 ${textSecondary}`}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-2"></div>
                    加载中...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sites.map((site) => (
                        <Card key={site.id} className="relative group overflow-hidden flex flex-col h-full">
                            {/* Cookie Status Indicator */}
                            {site.enabled && site.type !== 'Mock' && (
                                <div className="absolute top-0 right-0 flex">
                                    <div className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded-bl-lg ${site.cookie_status === 1 ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                                        }`}>
                                        {site.cookie_status === 1 ? 'Cookie 失效' : '正常'}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center min-w-0">
                                    <SiteIcon
                                        site={site}
                                        darkMode={darkMode}
                                        getDomain={getDomain}
                                        authenticatedFetch={authenticatedFetch}
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <h3 className={`font-bold text-lg ${textPrimary} truncate max-w-[120px]`} title={site.name}>{site.name}</h3>
                                            {site.enabled && site.supports_checkin === 1 && (
                                                <button
                                                    onClick={() => !checkingId && manualCheckin(site.id, true)}
                                                    disabled={checkingId === site.id}
                                                    className={`text-sm transition-all ${checkingId === site.id ? 'animate-bounce' : 'hover:scale-125'} ${site.auto_checkin === 1 ? 'text-green-500' : 'text-gray-400 hover:text-green-500'} ${checkingId === site.id ? 'opacity-100 cursor-not-allowed' : ''}`}
                                                    title={site.auto_checkin === 1 ? "已开启每日自动签到 - 点击手动签到" : "自动签到已关闭 - 点击手动签到"}
                                                >
                                                    ⏰
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center mt-0.5">
                                            {site.username && (
                                                <div className="flex items-center">
                                                    <span className="w-1 h-1 rounded-full bg-gray-500/50 mx-1"></span>
                                                    <span className={`text-[10px] ${textSecondary} font-medium`}>
                                                        {site.username}{site.level ? ` (${site.level})` : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-1 shrink-0">
                                    {site.enabled && (
                                        <button
                                            onClick={() => !refreshingId && syncSingleSiteData(site.id)}
                                            disabled={refreshingId === site.id}
                                            className={`${textSecondary} hover:text-blue-500 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${refreshingId === site.id ? 'cursor-not-allowed' : ''}`}
                                            title="手动刷新站点数据与状态"
                                        >
                                            <svg className={`w-4 h-4 ${refreshingId === site.id ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                                <path d="M3 3v5h5" />
                                                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                                <path d="M16 16h5v5" />
                                            </svg>
                                        </button>
                                    )}
                                    <button onClick={() => openEdit(site)} className={`${textSecondary} hover:text-blue-500 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700`} title="编辑站点">
                                        <span className="text-sm">✏️</span>
                                    </button>
                                    <button onClick={() => handleDelete(site.id)} className={`${textSecondary} hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700`} title="删除站点">
                                        <span className="text-sm">🗑️</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-2 min-w-0">
                                <a
                                    href={site.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${textSecondary} text-xs truncate flex-1 hover:text-blue-500 transition-colors cursor-pointer`}
                                    title={`访问 ${site.name}`}
                                >
                                    {site.url}
                                </a>
                                {isToday(site.last_checkin_at) && site.supports_checkin === 1 && (
                                    <span className="text-[10px] text-green-500 font-bold flex items-center ml-2 shrink-0">
                                        <span className="mr-1">✅</span> 今日已签到
                                    </span>
                                )}
                            </div>

                            {/* User Stats Overview */}
                            {site.enabled ? (
                                <div className={`grid grid-cols-4 gap-2 mb-2 p-3 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50'} border ${borderColor}`}>
                                    <div className="space-y-0.5">
                                        <p className={`text-[10px] ${textSecondary} uppercase`}>上传</p>
                                        <p className={`text-xs font-bold ${textPrimary} truncate`}>{site.upload || '--'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className={`text-[10px] ${textSecondary} uppercase`}>下载</p>
                                        <p className={`text-xs font-bold ${textPrimary} truncate`}>{site.download || '--'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className={`text-[10px] ${textSecondary} uppercase`}>分享率</p>
                                        <p className={`text-xs font-bold ${parseFloat(site.ratio) < 1 ? 'text-red-400' : 'text-green-400'}`}>
                                            {site.ratio || '--'}
                                        </p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className={`text-[10px] ${textSecondary} uppercase`}>魔力值</p>
                                        <p className={`text-xs font-bold ${textPrimary} truncate`}>{site.bonus || '--'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-gray-900/30' : 'bg-gray-50'} border border-dashed ${borderColor} text-center`}>
                                    <p className={`text-xs ${textSecondary}`}>站点已禁用，无法获取数据</p>
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

                            <div className={`flex justify-between items-center pt-4 border-t ${borderColor} mt-auto`}>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${site.enabled
                                    ? (darkMode ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-600 border-green-100')
                                    : (darkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100')
                                    }`}>
                                    {site.enabled ? '已启用' : '已禁用'}
                                </span>
                                <Button
                                    size="xs"
                                    variant={site.enabled ? 'ghost' : 'secondary'}
                                    onClick={() => toggleStatus(site)}
                                >
                                    {site.enabled ? '禁用' : '启用'}
                                </Button>
                            </div>
                        </Card>
                    ))}
                    {sites.length === 0 && (
                        <Card className="col-span-full py-12 text-center border-dashed">
                            <p className={textSecondary}>暂无站点，点击上方按钮添加。</p>
                        </Card>
                    )}
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingSite ? '编辑站点' : '添加站点'}
                description={editingSite ? '修改站点配置信息' : '配置新的 PT 站点'}
                size="lg"
                footer={
                    <div className="flex justify-end space-x-3">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
                        <Button onClick={handleSubmit}>保存</Button>
                    </div>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="站点名称"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="例如: M-Team"
                    />
                    <Input
                        label="站点地址 (URL)"
                        type="url"
                        required
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://kp.m-team.cc"
                    />
                    <div>
                        <Input
                            label="默认 RSS 地址 (用于 RSS 搜索)"
                            type="url"
                            value={formData.default_rss_url}
                            onChange={(e) => setFormData({ ...formData, default_rss_url: e.target.value })}
                            placeholder="https://example.com/torrentrss.php?..."
                        />
                        <p className="text-xs text-gray-500 mt-1">留空则自动尝试构造 /torrentrss.php</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Input
                                label="API Key (推荐)"
                                value={formData.api_key}
                                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                placeholder="例如 M-Team 的 API Access Token"
                                description="M-Team 等站点推荐使用 API Key 替代 Cookie，更安全且不易失效"
                            />
                            {formData.name.toLowerCase().includes('m-team') && (
                                <p className="text-[10px] text-amber-500 mt-1 font-medium">
                                    ⚠️ 注意：M-Team 开启 API KEY 后，请务必清空下方的 Cookies，避免多重验证导致封号。
                                </p>
                            )}
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase ${textSecondary} mb-1`}>Cookies (可选)</label>
                            <textarea
                                value={formData.cookies}
                                onChange={(e) => setFormData({ ...formData, cookies: e.target.value })}
                                placeholder="粘贴浏览器的 Cookie 以便进行自动任务"
                                rows="3"
                                className={`w-full ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                            ></textarea>
                            <p className="text-[10px] text-gray-500 mt-1">如果没有 API Key，请填入传统的 Cookie</p>
                        </div>
                    </div>
                    <div className="flex flex-col space-y-4 py-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="supports_checkin"
                                checked={formData.supports_checkin === 1}
                                onChange={(e) => {
                                    const supported = e.target.checked ? 1 : 0;
                                    setFormData({
                                        ...formData,
                                        supports_checkin: supported,
                                        auto_checkin: supported === 0 ? 0 : formData.auto_checkin
                                    });
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="supports_checkin" className={`text-sm font-medium ${textPrimary}`}>具备签到功能</label>
                        </div>

                        <div className={`flex items-center space-x-2 transition-opacity ${formData.supports_checkin === 1 ? 'opacity-100' : 'opacity-40 cursor-not-allowed'}`}>
                            <input
                                type="checkbox"
                                id="auto_checkin"
                                disabled={formData.supports_checkin === 0}
                                checked={formData.auto_checkin === 1}
                                onChange={(e) => setFormData({ ...formData, auto_checkin: e.target.checked ? 1 : 0 })}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="auto_checkin" className={`text-sm font-medium ${textPrimary}`}>启用每日自动签到</label>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SitesPage;

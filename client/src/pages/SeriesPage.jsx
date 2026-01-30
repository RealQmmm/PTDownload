import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

const SeriesOverview = ({ overview }) => {
    const [expanded, setExpanded] = useState(false);

    // Ensure overview is treated safely (force rebuild)
    const hasOverview = overview && typeof overview === 'string' && overview.trim().length > 0;
    const text = hasOverview ? overview : '暂无简介，点击刷新尝试从 TMDB 获取';
    const showButton = hasOverview && overview.length > 60;

    return (
        <div
            className="cursor-pointer group"
            onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
            }}
        >
            <div
                className={`${expanded ? '' : 'line-clamp-4'} mb-2 min-h-[4.5rem] italic leading-relaxed transition-all duration-300`}
                title={expanded ? "点击收起" : "点击展开查看全部"}
            >
                {text}
            </div>
            {showButton && (
                <div className="flex justify-center sm:justify-end mt-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold opacity-70 group-hover:opacity-100 transition-opacity`}>
                        {expanded ? '▲ 收起' : '▼ 展开更多'}
                    </span>
                </div>
            )}
        </div>
    );
};

const SeriesPage = () => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rssSources, setRssSources] = useState([]);

    // Episode Modal State
    const [showEpisodesModal, setShowEpisodesModal] = useState(false);
    const [episodesData, setEpisodesData] = useState({});
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);
    const [currentSeriesName, setCurrentSeriesName] = useState('');
    const [currentSeriesId, setCurrentSeriesId] = useState(null);
    const [currentSubscription, setCurrentSubscription] = useState(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        alias: '',
        season: '',
        quality: '',
        rss_source_id: '',
        client_id: '',
        saved_path: '/downloads/series',
        smart_switch: false
    });
    const [clients, setClients] = useState([]);
    const [editId, setEditId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Theme basic colors (redundant if components used fully, but useful for custom parts)
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

    const handleShowDetails = async (sub) => {
        setCurrentSubscription(sub);
        setCurrentSeriesName(sub.name);
        setCurrentSeriesId(sub.id);
        setShowEpisodesModal(true);
        setLoadingEpisodes(true);
        try {
            // Skip file scanning on initial load for fast opening
            const res = await authenticatedFetch(`/api/series/${sub.id}/episodes?skipFileScan=true`);
            const data = await res.json();
            console.log('[UI] Initial episodes data (no file scan):', data);
            if (res.ok && data && !data.error) {
                setEpisodesData(data);
            } else {
                setEpisodesData({});
            }
        } catch (err) {
            console.error('Fetch episodes failed:', err);
            setEpisodesData({});
        } finally {
            setLoadingEpisodes(false);
        }
    };

    const handleRefreshEpisodes = async () => {
        if (!currentSeriesId) return;
        console.log(`[UI] Manually refreshing episodes for series ID: ${currentSeriesId} with file scan`);
        setLoadingEpisodes(true);
        try {
            // Do NOT skip file scan on manual refresh
            const res = await authenticatedFetch(`/api/series/${currentSeriesId}/episodes`);
            const data = await res.json();
            console.log('[UI] Refreshed episodes data (with file scan):', data);
            if (res.ok && data && !data.error) {
                setEpisodesData(data);

                // Also refresh the subscription data to get latest total_episodes
                const subRes = await authenticatedFetch(`/api/series`);
                const allSubs = await subRes.json();
                if (subRes.ok && Array.isArray(allSubs)) {
                    setSubscriptions(allSubs);
                    const updatedSub = allSubs.find(s => s.id === currentSeriesId);
                    if (updatedSub) {
                        setCurrentSubscription(updatedSub);
                    }
                }
            } else {
                setEpisodesData({});
            }
        } catch (err) {
            console.error('[UI] Fetch episodes failed:', err);
            setEpisodesData({});
        } finally {
            setLoadingEpisodes(false);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            const res = await authenticatedFetch('/api/series');
            const data = await res.json();
            setSubscriptions(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRssSources = async () => {
        try {
            const res = await authenticatedFetch('/api/rss-sources');
            const data = await res.json();
            setRssSources(data || []);
            if (data.length > 0 && !formData.rss_source_id) {
                setFormData(prev => ({ ...prev, rss_source_id: data[0].id }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchClients = async () => {
        try {
            const res = await authenticatedFetch('/api/clients');
            const data = await res.json();
            setClients(data || []);
            if (data.length > 0 && !formData.client_id) {
                // Find default client if exists
                const def = data.find(c => c.is_default) || data[0];
                setFormData(prev => ({ ...prev, client_id: def.id }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSubscriptions();
        fetchRssSources();
        fetchClients();
    }, []);

    const handleDelete = async (id) => {
        if (!confirm('确定要删除此追剧订阅吗？相关的 RSS 任务也将被删除。')) return;
        try {
            const res = await authenticatedFetch(`/api/series/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchSubscriptions();
            } else {
                alert('删除失败');
            }
        } catch (err) {
            alert('删除出错: ' + err.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const url = editId ? `/api/series/${editId}` : '/api/series';
            const method = editId ? 'PUT' : 'POST';

            const res = await authenticatedFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                setShowModal(false);
                const defClient = clients.find(c => c.is_default) || clients[0];
                setFormData({ name: '', alias: '', season: '', quality: '', rss_source_id: rssSources[0]?.id || '', client_id: defClient?.id || '', saved_path: '/downloads/series', smart_switch: false });
                setEditId(null);
                fetchSubscriptions();
            } else {
                alert(data.error || '操作失败');
            }
        } catch (err) {
            alert('提交出错: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (sub) => {
        setFormData({
            name: sub.name,
            alias: sub.alias || '',
            season: sub.season || '',
            quality: sub.quality || '',
            rss_source_id: sub.rss_source_id || '',
            client_id: sub.client_id || '',
            saved_path: '/downloads/series', // Keep default or fetch if needed
            smart_switch: sub.smart_switch === 1
        });
        setEditId(sub.id);
        setShowModal(true);
    };

    const openCreateModal = () => {
        const defClient = clients.find(c => c.is_default) || clients[0];
        setFormData({ name: '', alias: '', season: '', quality: '', rss_source_id: rssSources[0]?.id || '', client_id: defClient?.id || '', saved_path: '/downloads/series', smart_switch: false });
        setEditId(null);
        setShowModal(true);
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>我的追剧</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>智能管理您的电视剧订阅</p>
                </div>
                <Button
                    onClick={openCreateModal}
                    className="flex items-center"
                >
                    <span className="mr-1 text-xl leading-none">+</span> 新增追剧
                </Button>
            </div>

            {loading ? (
                <div className={`p-8 text-center ${textSecondary}`}>加载中...</div>
            ) : subscriptions.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center">
                    <span className="text-4xl mb-4">📺</span>
                    <h3 className={`text-lg font-bold ${textPrimary} mb-2`}>还没有订阅任何剧集</h3>
                    <p className={`${textSecondary} mb-6`}>点击右上角按钮开始您的智能追剧之旅</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                    {subscriptions.map(sub => (
                        <Card key={sub.id} noPadding className="flex overflow-hidden h-full group">
                            {/* Optional Poster Section */}
                            {sub.poster_path && (
                                <div className="w-24 sm:w-32 flex-shrink-0 bg-gray-200 dark:bg-gray-800 relative overflow-hidden rounded-l-2xl">
                                    <img
                                        src={sub.poster_path}
                                        alt={sub.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 rounded-l-2xl"
                                        onError={(e) => { e.target.style.display = 'none' }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                                </div>
                            )}

                            <div className="flex-1 p-5 min-w-0 flex flex-col">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0 flex-1 mr-2">
                                        {/* Mobile: Stack title and badges vertically */}
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 overflow-hidden">
                                            <h3 className={`text-lg font-bold ${textPrimary} truncate`} title={sub.name}>{sub.name}</h3>
                                            <div className="flex gap-1 flex-shrink-0 items-center flex-wrap">
                                                {sub.vote_average > 0 && (
                                                    <span className="bg-[#F5C518] text-black px-2 py-0.5 rounded text-[11px] font-bold flex items-center">
                                                        TMDB {sub.vote_average.toFixed(1)}
                                                    </span>
                                                )}
                                                {sub.season && <span className="bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded text-[10px] font-bold">S{sub.season}</span>}
                                                {sub.quality && (sub.quality.split(',').map(q => (
                                                    <span key={q} className="bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded text-[10px] font-bold">{q === '4K' ? '2160p(4K)' : q}</span>
                                                )))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${sub.task_enabled ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                        {sub.task_enabled ? '▶' : '⏸'}
                                    </div>
                                </div>

                                <div className={`text-xs ${textSecondary} bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg mb-4`}>
                                    <SeriesOverview overview={sub.overview} />
                                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700/50 flex justify-between items-center">
                                        <span className="text-blue-500 font-bold">已下载: {sub.episode_count || 0} 集</span>
                                        <button
                                            onClick={() => handleShowDetails(sub)}
                                            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 transition-colors whitespace-nowrap text-gray-500 dark:text-gray-400"
                                        >
                                            详情
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-auto flex justify-between items-center text-[10px]">
                                    <div className="flex flex-col gap-0.5">
                                        <span className={textSecondary}>追剧来源: {sub.smart_switch === 1 ? '跨站智能聚合' : (sub.site_name || '未知')}</span>
                                    </div>
                                    <div className="space-x-2 whitespace-nowrap">
                                        <button
                                            onClick={async () => {
                                                if (confirm(`确定要更新 "${sub.name}" 的图片和简介吗？`)) {
                                                    try {
                                                        const res = await authenticatedFetch(`/api/series/${sub.id}/refresh-metadata`, { method: 'PUT' });
                                                        if (res.ok) {
                                                            alert('更新成功');
                                                            fetchSubscriptions();
                                                        } else {
                                                            alert('更新失败');
                                                        }
                                                    } catch (e) {
                                                        alert('更新出错: ' + e.message);
                                                    }
                                                }
                                            }}
                                            className="text-purple-400 hover:text-purple-500 font-medium"
                                            title="重新刮削图片和简介"
                                        >
                                            刷新
                                        </button>
                                        <button
                                            onClick={() => handleEdit(sub)}
                                            className="text-blue-400 hover:text-blue-500 font-medium"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={() => handleDelete(sub.id)}
                                            className="text-red-400 hover:text-red-500 font-medium"
                                        >
                                            删除
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? '编辑订阅' : '新增追剧订阅'}
                description={editId ? '修改追剧配置' : '配置您的自动追剧任务'}
                size="md"
                footer={
                    <div className="flex justify-end space-x-3">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? '提交中...' : (editId ? '保存修改' : '确认订阅')}
                        </Button>
                    </div>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="剧集名称 (支持中文)"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="例如: 西部世界"
                            className="text-base sm:text-sm"
                        />
                        <div>
                            <Input
                                label="别名 / 英文名 (可选，用于匹配种子)"
                                value={formData.alias || ''}
                                onChange={e => setFormData({ ...formData, alias: e.target.value })}
                                placeholder="例如: Westworld"
                                className="text-base sm:text-sm"
                            />
                            <p className={`text-[10px] ${textSecondary} mt-1`}>如果种子名称是英文，请填写英文原名。</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label="季数 (数字)"
                            type="number"
                            value={formData.season}
                            onChange={e => setFormData({ ...formData, season: e.target.value })}
                            placeholder="例如: 1"
                            className="text-base sm:text-sm"
                            containerClassName="md:col-span-1"
                        />
                        <div className="md:col-span-2">
                            <label className={`block text-xs font-bold ${textSecondary} uppercase tracking-wider mb-2`}>画质匹配偏好 (多选)</label>
                            <div className="p-1 sm:p-1.5 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-900/40 relative overflow-hidden">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    {[
                                        { label: '2160p(4K)', value: '4K' },
                                        { label: '1080p', value: '1080p' },
                                        { label: '720p', value: '720p' }
                                    ].map(opt => {
                                        const isSelected = (formData.quality || '').split(',').includes(opt.value);
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    const current = (formData.quality || '').split(',').filter(Boolean);
                                                    const next = isSelected
                                                        ? current.filter(c => c !== opt.value)
                                                        : [...current, opt.value];
                                                    setFormData({ ...formData, quality: next.join(',') });
                                                }}
                                                className={`flex-1 min-w-[80px] sm:min-w-0 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${isSelected
                                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.02]'
                                                    : `bg-white dark:bg-gray-800 ${textSecondary} border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700`
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="mt-2 px-1.5 pb-1 flex items-center justify-between">
                                    <p className="text-[10px] text-gray-400 font-medium">不选则智能匹配最优画质</p>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, quality: '' })}
                                        className="text-[10px] text-blue-500 hover:text-blue-600 font-bold px-2 py-1 rounded-lg hover:bg-blue-500/5 transition-colors"
                                    >
                                        清空重置
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                            // Calculate unique sites count
                            const uniqueSites = new Set(rssSources.map(s => s.site_id)).size;
                            if (uniqueSites > 1) {
                                return (
                                    <div className="md:col-span-2">
                                        <label className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={formData.smart_switch}
                                                onChange={e => setFormData({ ...formData, smart_switch: e.target.checked })}
                                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <div className="flex-1">
                                                <span className={`block text-sm font-bold ${textPrimary}`}>跨站智能聚合 (Smart Aggregation)</span>
                                                <span className={`block text-xs ${textSecondary}`}>
                                                    启用后，将聚合所有站点的 RSS，优先下载<span className="text-green-500 font-bold">免费</span>资源，并根据做种数智能评分。
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {!formData.smart_switch ? (
                            <Select
                                label="RSS 订阅源"
                                required
                                value={formData.rss_source_id}
                                onChange={e => setFormData({ ...formData, rss_source_id: e.target.value })}
                                className="text-base sm:text-sm"
                            >
                                <option value="">请选择 RSS 源</option>
                                {rssSources.map(src => (
                                    <option key={src.id} value={src.id}>
                                        {src.site_name ? `${src.site_name} - ${src.name}` : src.name}
                                    </option>
                                ))}
                            </Select>
                        ) : (
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3 rounded-lg flex items-center justify-center text-sm text-blue-600 dark:text-blue-400">
                                <span className="mr-2">🚀</span> 系统将自动扫描所有站点
                            </div>
                        )}

                        <Select
                            label="下载器"
                            required
                            value={formData.client_id}
                            onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                            className="text-base sm:text-sm"
                        >
                            <option value="">请选择下载器</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name || c.type}
                                </option>
                            ))}
                        </Select>
                    </div>
                </form>
            </Modal>

            {/* Episodes Detail Modal */}
            <Modal
                isOpen={showEpisodesModal}
                onClose={() => setShowEpisodesModal(false)}
                title="剧集详情"
                description="已下载的集数概览"
                size="lg"
                footer={<Button variant="ghost" onClick={() => setShowEpisodesModal(false)}>关闭</Button>}
            >
                <div>
                    <div className="flex justify-end mb-4">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleRefreshEpisodes}
                            disabled={loadingEpisodes}
                        >
                            {loadingEpisodes ? '刷新中...' : '↻ 刷新扫描'}
                        </Button>
                    </div>

                    <div className="overflow-y-auto max-h-[60vh]">
                        {loadingEpisodes ? (
                            <div className={`text-center py-10 ${textSecondary}`}>加载数据中...</div>
                        ) : (
                            (() => {
                                // Ensure the subscribed season is always shown even if no episodes are downloaded
                                const displayData = { ...episodesData };
                                if (currentSubscription?.season && !displayData[currentSubscription.season]) {
                                    displayData[currentSubscription.season] = { episodes: [], isSeasonPack: false };
                                }

                                const seasons = Object.keys(displayData).sort((a, b) => parseInt(a) - parseInt(b));

                                if (seasons.length === 0) {
                                    return (
                                        <div className={`text-center py-10 ${textSecondary}`}>
                                            暂无已下载的剧集记录
                                        </div>
                                    );
                                }

                                return seasons.map(season => {
                                    const seasonData = displayData[season];
                                    const episodes = seasonData.episodes || [];

                                    return (
                                        <div key={season} className="mb-6 last:mb-0">
                                            <h3 className={`text-sm font-bold ${textPrimary} mb-3 flex items-center flex-wrap`}>
                                                <span className="w-1 h-4 bg-blue-500 rounded-full mr-2"></span>
                                                第 {season} 季
                                                <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-full">
                                                    已下 {episodes.length} 集 {(currentSubscription?.total_episodes && parseInt(season) === parseInt(currentSubscription.season)) ? ` / 共 ${currentSubscription.total_episodes} 集` : ''}
                                                </span>
                                            </h3>
                                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                                {(() => {
                                                    // Generate full grid from 1 to max episode or TMDB count
                                                    const isCurrentSeason = parseInt(season) === parseInt(currentSubscription?.season);
                                                    const totalFromTMDB = isCurrentSeason ? (currentSubscription?.total_episodes || 0) : 0;
                                                    const maxEp = Math.max(...episodes, totalFromTMDB, 0);
                                                    const allEpisodes = Array.from({ length: maxEp }, (_, i) => i + 1);

                                                    return allEpisodes.map(ep => {
                                                        const isDownloaded = episodes.includes(ep);
                                                        return (
                                                            <div
                                                                key={ep}
                                                                className={`aspect-square flex items-center justify-center rounded-lg font-mono text-sm font-bold ${isDownloaded
                                                                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                                    : 'bg-gray-500/5 text-gray-500/40 border border-gray-500/10'
                                                                    }`}
                                                                title={isDownloaded ? `已下载` : `未下载`}
                                                            >
                                                                {ep < 10 ? `0${ep}` : ep}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    );
                                });
                            })()
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SeriesPage;

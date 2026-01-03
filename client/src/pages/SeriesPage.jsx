import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';
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
        saved_path: '/downloads/series'
    });
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

    useEffect(() => {
        fetchSubscriptions();
        fetchRssSources();
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
                setFormData({ name: '', alias: '', season: '', quality: '', rss_source_id: rssSources[0]?.id || '', saved_path: '/downloads/series' });
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
            saved_path: '/downloads/series' // Keep default or fetch if needed
        });
        setEditId(sub.id);
        setShowModal(true);
    };

    const openCreateModal = () => {
        setFormData({ name: '', alias: '', season: '', quality: '', rss_source_id: rssSources[0]?.id || '', saved_path: '/downloads/series' });
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
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        onError={(e) => { e.target.style.display = 'none' }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
                                </div>
                            )}

                            <div className="flex-1 p-5 min-w-0 flex flex-col">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0 flex-1 mr-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <h3 className={`text-lg font-bold ${textPrimary} truncate`} title={sub.name}>{sub.name}</h3>
                                            <div className="flex gap-1 flex-shrink-0">
                                                {sub.season && <span className="bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded text-[10px] font-bold">S{sub.season}</span>}
                                                {sub.quality && <span className="bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded text-[10px] font-bold">{sub.quality}</span>}
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

                                <div className="mt-auto flex justify-between items-center text-xs">
                                    <span className={textSecondary}>来源: {sub.site_name || '未知'}</span>
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
                    <Input
                        label="剧集名称 (支持中文)"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="例如: 西部世界"
                    />
                    <div>
                        <Input
                            label="别名 / 英文名 (用于匹配种子)"
                            value={formData.alias || ''}
                            onChange={e => setFormData({ ...formData, alias: e.target.value })}
                            placeholder="例如: Westworld"
                        />
                        <p className={`text-[10px] ${textSecondary} mt-1`}>如果种子名称是英文，请填写英文原名。</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="季数 (数字)"
                            type="number"
                            value={formData.season}
                            onChange={e => setFormData({ ...formData, season: e.target.value })}
                            placeholder="例如: 1"
                        />
                        <Select
                            label="画质偏好"
                            value={formData.quality}
                            onChange={e => setFormData({ ...formData, quality: e.target.value })}
                        >
                            <option value="">不限 / Any</option>
                            <option value="4K">4K / 2160p</option>
                            <option value="1080p">1080p</option>
                            <option value="720p">720p</option>
                        </Select>
                    </div>
                    <Select
                        label="RSS 订阅源"
                        required
                        value={formData.rss_source_id}
                        onChange={e => setFormData({ ...formData, rss_source_id: e.target.value })}
                    >
                        <option value="">请选择 RSS 源</option>
                        {rssSources.map(src => (
                            <option key={src.id} value={src.id}>
                                {src.site_name ? `${src.site_name} - ${src.name}` : src.name}
                            </option>
                        ))}
                    </Select>
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

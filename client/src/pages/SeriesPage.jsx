import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

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

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        season: '',
        quality: '',
        rss_source_id: '',
        saved_path: '/downloads/series'
    });
    const [editId, setEditId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Theme Classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const inputBg = darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900';

    const handleShowDetails = async (sub) => {
        setCurrentSeriesName(sub.name);
        setShowEpisodesModal(true);
        setLoadingEpisodes(true);
        try {
            const res = await authenticatedFetch(`/api/series/${sub.id}/episodes`);
            const data = await res.json();
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

    // ... (rendering logic) ...

    {
        loadingEpisodes ? (
            <div className={`text-center py-10 ${textSecondary}`}>加载数据中...</div>
        ) : (!episodesData || Object.keys(episodesData).length === 0) ? (
            <div className={`text-center py-10 ${textSecondary}`}>
                暂无已下载的剧集记录
            </div>
        ) : (
            Object.keys(episodesData).sort((a, b) => parseInt(a) - parseInt(b)).map(season => {
                // Defensive check: ensure the value is an array
                if (!Array.isArray(episodesData[season])) return null;

                return (
                    <div key={season} className="mb-6 last:mb-0">
                        <h3 className={`text-sm font-bold ${textPrimary} mb-3 flex items-center`}>
                            <span className="w-1 h-4 bg-blue-500 rounded-full mr-2"></span>
                            第 {season} 季
                            <span className={`ml-2 text-xs font-normal ${textSecondary} bg-gray-500/10 px-2 py-0.5 rounded-full`}>
                                共 {episodesData[season].length} 集
                            </span>
                        </h3>
                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                            {episodesData[season].map(ep => (
                                <div key={ep} className={`aspect-square flex items-center justify-center rounded-lg font-mono text-sm font-bold bg-green-500/10 text-green-500 border border-green-500/20`}>
                                    {ep < 10 ? `0${ep}` : ep}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })
        )
    }

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
                setFormData({ name: '', season: '', quality: '', rss_source_id: rssSources[0]?.id || '', saved_path: '/downloads/series' });
                setEditId(null);
                fetchSubscriptions();
            } else {
                alert(data.error || '操作失败');
            }
        } catch (err) {
            alert('提交错: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (sub) => {
        setFormData({
            name: sub.name,
            season: sub.season || '',
            quality: sub.quality || '',
            rss_source_id: sub.rss_source_id || '',
            saved_path: '/downloads/series' // Keep default or fetch if needed
        });
        setEditId(sub.id);
        setShowModal(true);
    };

    const openCreateModal = () => {
        setFormData({ name: '', season: '', quality: '', rss_source_id: rssSources[0]?.id || '', saved_path: '/downloads/series' });
        setEditId(null);
        setShowModal(true);
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>我的追剧</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>智能管理您的电视剧订阅</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center"
                >
                    <span className="mr-1 text-xl">+</span> 新增订阅
                </button>
            </div>

            {loading ? (
                <div className={`p-8 text-center ${textSecondary}`}>加载中...</div>
            ) : subscriptions.length === 0 ? (
                <div className={`flex flex-col items-center justify-center p-12 ${bgMain} rounded-2xl border ${borderColor} text-center`}>
                    <span className="text-4xl mb-4">📺</span>
                    <h3 className={`text-lg font-bold ${textPrimary} mb-2`}>还没有订阅任何剧集</h3>
                    <p className={`${textSecondary} mb-6`}>点击右上角按钮开始您的智能追剧之旅</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {subscriptions.map(sub => (
                        <div key={sub.id} className={`${bgMain} rounded-2xl border ${borderColor} p-5 shadow-sm hover:shadow-md transition-all`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className={`text-lg font-bold ${textPrimary} line-clamp-1`}>{sub.name}</h3>
                                    <div className="flex gap-2 mt-1">
                                        {sub.season && <span className="bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded text-xs font-bold">S{sub.season}</span>}
                                        {sub.quality && <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-xs font-bold">{sub.quality}</span>}
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${sub.task_enabled ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                    {sub.task_enabled ? '▶' : '⏸'}
                                </div>
                            </div>

                            <div className={`text-xs ${textSecondary} ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50'} p-3 rounded-lg font-mono mb-4 break-all`}>
                                Regex: {sub.smart_regex}
                                <div className={`mt-2 pt-2 border-t ${borderColor} flex justify-between items-center`}>
                                    <span className="text-blue-500 font-bold">已下载: {sub.episode_count || 0} 集</span>
                                    <button
                                        onClick={() => handleShowDetails(sub)}
                                        className={`text-xs px-2 py-1 rounded border ${borderColor} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                                    >
                                        详情
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                                <span className={textSecondary}>源: {sub.rss_source_name || 'Unknown'}</span>
                                <div className="space-x-3">
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
                    ))}
                </div>
            )}

            {/* Add Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className={`${bgMain} rounded-2xl w-full max-w-lg border ${borderColor} shadow-2xl`}>
                        <div className={`p-6 border-b ${borderColor}`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>{editId ? '编辑订阅' : '新增追剧订阅'}</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className={`block text-xs font-bold uppercase ${textSecondary} mb-1`}>剧集名称 (支持中文)</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="例如: 西部世界"
                                    className={`w-full p-3 rounded-xl border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-bold uppercase ${textSecondary} mb-1`}>季数 (数字)</label>
                                    <input
                                        type="number"
                                        value={formData.season}
                                        onChange={e => setFormData({ ...formData, season: e.target.value })}
                                        placeholder="例如: 1"
                                        className={`w-full p-3 rounded-xl border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase ${textSecondary} mb-1`}>画质偏好</label>
                                    <select
                                        value={formData.quality}
                                        onChange={e => setFormData({ ...formData, quality: e.target.value })}
                                        className={`w-full p-3 rounded-xl border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                                    >
                                        <option value="">不限 / Any</option>
                                        <option value="4K">4K / 2160p</option>
                                        <option value="1080p">1080p</option>
                                        <option value="720p">720p</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-bold uppercase ${textSecondary} mb-1`}>RSS 订阅源</label>
                                <select
                                    required
                                    value={formData.rss_source_id}
                                    onChange={e => setFormData({ ...formData, rss_source_id: e.target.value })}
                                    className={`w-full p-3 rounded-xl border ${inputBg} focus:ring-2 focus:ring-blue-500 outline-none`}
                                >
                                    <option value="">请选择 RSS 源</option>
                                    {rssSources.map(src => (
                                        <option key={src.id} value={src.id}>{src.name} - {src.url}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className={`px-5 py-2.5 rounded-xl font-medium ${textSecondary} ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {submitting ? '提交中...' : (editId ? '保存修改' : '确认订阅')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Episodes Detail Modal */}
            {showEpisodesModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className={`${bgMain} rounded-2xl w-full max-w-2xl border ${borderColor} shadow-2xl max-h-[80vh] flex flex-col`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center`}>
                            <div>
                                <h2 className={`text-xl font-bold ${textPrimary}`}>剧集详情</h2>
                                <p className={`text-sm ${textSecondary} mt-1`}>已下载的集数概览</p>
                            </div>
                            <button onClick={() => setShowEpisodesModal(false)} className={`p-2 rounded-full hover:bg-gray-700/50 ${textSecondary}`}>✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {loadingEpisodes ? (
                                <div className={`text-center py-10 ${textSecondary}`}>加载数据中...</div>
                            ) : Object.keys(episodesData).length === 0 ? (
                                <div className={`text-center py-10 ${textSecondary}`}>
                                    暂无已下载的剧集记录
                                </div>
                            ) : (
                                Object.keys(episodesData).sort((a, b) => parseInt(a) - parseInt(b)).map(season => (
                                    <div key={season} className="mb-6 last:mb-0">
                                        <h3 className={`text-sm font-bold ${textPrimary} mb-3 flex items-center`}>
                                            <span className="w-1 h-4 bg-blue-500 rounded-full mr-2"></span>
                                            第 {season} 季
                                            <span className={`ml-2 text-xs font-normal ${textSecondary} bg-gray-500/10 px-2 py-0.5 rounded-full`}>
                                                共 {episodesData[season].length} 集
                                            </span>
                                        </h3>
                                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                            {episodesData[season].map(ep => (
                                                <div key={ep} className={`aspect-square flex items-center justify-center rounded-lg font-mono text-sm font-bold bg-green-500/10 text-green-500 border border-green-500/20`}>
                                                    {ep < 10 ? `0${ep}` : ep}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SeriesPage;

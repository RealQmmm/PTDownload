import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const SitesPage = () => {
    const { darkMode, fetchStatus } = useTheme();
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSite, setEditingSite] = useState(null);

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
        cookies: '',
        type: 'NexusPHP',
        enabled: 1,
        auto_checkin: 0
    });

    const fetchSites = async () => {
        try {
            const res = await fetch('/api/sites');
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
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            setShowModal(false);
            setEditingSite(null);
            setFormData({ name: '', url: '', cookies: '', type: 'NexusPHP', enabled: 1, auto_checkin: 0 });
            fetchSites();
        } catch (err) {
            alert('保存失败: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('确定要删除这个站点吗？')) return;
        try {
            await fetch(`/api/sites/${id}`, { method: 'DELETE' });
            fetchSites();
        } catch (err) {
            alert('删除失败');
        }
    };

    const handleAdd = () => {
        setEditingSite(null);
        setFormData({ name: '', url: '', cookies: '', type: 'NexusPHP', enabled: 1, auto_checkin: 0 });
        setShowModal(true);
    };

    const openEdit = (site) => {
        setEditingSite(site);
        setFormData({
            name: site.name,
            url: site.url,
            cookies: site.cookies || '',
            type: site.type,
            enabled: site.enabled,
            auto_checkin: site.auto_checkin
        });
        setShowModal(true);
    };

    const toggleStatus = async (site) => {
        try {
            await fetch(`/api/sites/${site.id}/toggle`, {
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
            await fetch('/api/sites/check-all', { method: 'POST' });
            fetchSites();
        } catch (err) {
            console.error('Failed to sync site data:', err);
        } finally {
            setLoading(false);
        }
    };

    const syncSingleSiteData = async (id) => {
        try {
            const res = await fetch(`/api/sites/${id}/check-cookie`);
            const data = await res.json();
            if (data.isValid) {
                await fetchSites();
                alert('站点数据已同步！');
            } else {
                alert('Cookie 已失效，请更新！');
                await fetchSites();
            }
        } catch (err) {
            alert('同步失败');
        }
    };

    const manualCheckin = async (id, notifySuccess = false) => {
        try {
            const res = await fetch(`/api/sites/${id}/checkin`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                await fetchSites();
                if (notifySuccess) alert('签到成功！');
            } else {
                alert('签到失败，请检查 Cookie 是否有效');
            }
        } catch (err) {
            alert('请求出错');
        }
    };

    const isToday = (dateStr) => {
        if (!dateStr) return false;
        try {
            // Handle both ISO and SQLite default format (YYYY-MM-DD HH:MM:SS)
            const normalizedStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
            const date = new Date(normalizedStr);
            return date.toDateString() === new Date().toDateString();
        } catch (e) {
            return false;
        }
    };

    const checkinAll = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sites/checkin-all', { method: 'POST' });
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
                        onClick={syncAllSiteData}
                        disabled={loading}
                        className={`flex-1 sm:flex-none px-4 py-3 border ${borderColor} ${textSecondary} hover:${textPrimary} rounded-lg font-medium transition-all flex items-center justify-center`}
                        title="同步所有已启用站点的用户数据与 Cookie 状态"
                    >
                        🔄 同步站点数据
                    </button>
                    <button
                        onClick={checkinAll}
                        disabled={loading}
                        className={`flex-1 sm:flex-none px-4 py-3 border ${borderColor} ${textSecondary} hover:${textPrimary} rounded-lg font-medium transition-all flex items-center justify-center`}
                        title="立即触发所有已开启自动签到站点的签到任务"
                    >
                        ✨ 一键签到
                    </button>
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
                                                    onClick={() => manualCheckin(site.id, true)}
                                                    className={`text-sm transition-all hover:scale-125 ${site.auto_checkin === 1 ? 'grayscale-0' : 'grayscale opacity-40 hover:opacity-100'}`}
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
                                                onClick={() => syncSingleSiteData(site.id)}
                                                className={`${textSecondary} hover:text-blue-400 transition-colors p-1.5 rounded-lg ${hoverBg}`}
                                                title="手动刷新站点数据与状态"
                                            >
                                                <span className="text-sm">🔄</span>
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

                            <p className={`${textSecondary} text-xs truncate mb-4`}>{site.url}</p>

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

                            <div className="flex flex-col space-y-1 mb-4">
                                {isToday(site.last_checkin_at) && (
                                    <p className="text-[10px] text-green-500 font-bold flex items-center">
                                        <span className="mr-1">✅</span> 今日已签到
                                    </p>
                                )}
                            </div>

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
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>站点 URL</label>
                                <input
                                    required
                                    type="url"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    placeholder="https://kp.m-team.cc"
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                />
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

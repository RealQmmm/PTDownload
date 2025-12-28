import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const SitesPage = () => {
    const { darkMode } = useTheme();
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
        enabled: 1
    });

    const fetchSites = async () => {
        try {
            const res = await fetch('/api/sites');
            const data = await res.json();
            setSites(data);
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
            setFormData({ name: '', url: '', cookies: '', type: 'NexusPHP', enabled: 1 });
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
        setFormData({ name: '', url: '', cookies: '', type: 'NexusPHP', enabled: 1 });
        setShowModal(true);
    };

    const openEdit = (site) => {
        setEditingSite(site);
        setFormData({
            name: site.name,
            url: site.url,
            cookies: site.cookies || '',
            type: site.type,
            enabled: site.enabled
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

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>站点管理</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>配置您已加入的 PT 站点</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20"
                >
                    + 添加新站点
                </button>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-64 ${textSecondary}`}>加载中...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sites.map((site) => (
                        <div key={site.id} className={`${bgMain} rounded-xl p-6 border ${borderColor} hover:border-blue-500/50 transition-all group shadow-sm`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center">
                                    <div className={`w-12 h-12 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-lg flex items-center justify-center text-2xl mr-4 group-hover:scale-110 transition-transform`}>
                                        🌐
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-lg ${textPrimary}`}>{site.name}</h3>
                                        <span className="text-xs text-blue-400 uppercase tracking-wider font-semibold">{site.type}</span>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => openEdit(site)} className={`${textSecondary} hover:${textPrimary} transition-colors`}>✏️</button>
                                    <button onClick={() => handleDelete(site.id)} className={`${textSecondary} hover:text-red-400 transition-colors`}>🗑️</button>
                                </div>
                            </div>
                            <p className={`${textSecondary} text-sm truncate mb-4`}>{site.url}</p>
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

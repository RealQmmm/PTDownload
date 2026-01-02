import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const TasksPage = () => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [tasks, setTasks] = useState([]);
    const [sites, setSites] = useState([]);
    const [clients, setClients] = useState([]);
    const [rssSources, setRSSSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showRSSModal, setShowRSSModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [editingRSSSource, setEditingRSSSource] = useState(null);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [selectedTaskLogs, setSelectedTaskLogs] = useState([]);
    const [logLoading, setLogLoading] = useState(false);
    const [downloadPaths, setDownloadPaths] = useState([]);
    const [showPathsModal, setShowPathsModal] = useState(false);
    const [editingPath, setEditingPath] = useState(null);
    const [pathFormData, setPathFormData] = useState({ name: '', path: '', description: '' });

    // Helpers for Human-readable CRON
    const cronToHuman = (cron) => {
        if (!cron) return '未设置';
        if (cron.startsWith('*/') && cron.endsWith(' * * * *')) {
            return `每 ${cron.split(' ')[0].replace('*/', '')} 分钟`;
        }
        if (cron.startsWith('0 */') && cron.endsWith(' * * *')) {
            return `每 ${cron.split(' ')[1].replace('*/', '')} 小时`;
        }
        if (cron.startsWith('0 0 */') && cron.endsWith(' * *')) {
            return `每 ${cron.split(' ')[2].replace('*/', '')} 天`;
        }
        return cron; // Fallback to raw cron if complex
    };

    const parseCron = (cron) => {
        if (!cron) return { value: 15, unit: 'm' };
        if (cron.startsWith('*/') && cron.endsWith(' * * * *')) return { value: cron.split(' ')[0].replace('*/', ''), unit: 'm' };
        if (cron.startsWith('0 */') && cron.endsWith(' * * *')) return { value: cron.split(' ')[1].replace('*/', ''), unit: 'h' };
        if (cron.startsWith('0 0 */') && cron.endsWith(' * *')) return { value: cron.split(' ')[2].replace('*/', ''), unit: 'd' };
        return { value: 15, unit: 'm', isComplex: true };
    };

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const inputBg = darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';

    const [formData, setFormData] = useState({
        name: '',
        type: 'rss',
        cron: '*/15 * * * *',
        site_id: '',
        rss_url: '',
        filter_config: { keywords: '', exclude: '', size_min: '', size_max: '' },
        client_id: '',
        save_path: '',
        category: '',
        enabled: 1
    });

    const [rssFormData, setRSSFormData] = useState({
        site_id: '',
        name: '',
        url: ''
    });

    const fetchData = async () => {
        try {
            const [tasksRes, sitesRes, clientsRes, rssSourcesRes] = await Promise.all([
                authenticatedFetch('/api/tasks'),
                authenticatedFetch('/api/sites'),
                authenticatedFetch('/api/clients'),
                authenticatedFetch('/api/rss-sources')
            ]);

            const [tasksData, sitesData, clientsData, rssSourcesData] = await Promise.all([
                tasksRes.json(),
                sitesRes.json(),
                clientsRes.json(),
                rssSourcesRes.json()
            ]);

            setTasks(tasksData);
            setSites(sitesData);
            setClients(clientsData);
            setRSSSources(rssSourcesData);
        } catch (err) {
            console.error('Fetch data failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDownloadPaths = async () => {
        try {
            const res = await authenticatedFetch('/api/download-paths');
            const data = await res.json();
            setDownloadPaths(data);
        } catch (err) {
            console.error('Fetch download paths failed:', err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchDownloadPaths();
    }, []);

    const handleAdd = () => {
        setEditingTask(null);
        setFormData({
            name: '',
            type: 'rss',
            cron: '*/15 * * * *',
            site_id: sites[0]?.id || '',
            rss_url: '',
            filter_config: { keywords: '', exclude: '', size_min: '', size_max: '' },
            client_id: clients[0]?.id || '',
            save_path: '',
            category: '',
            enabled: 1
        });
        setShowModal(true);
    };

    const handleEdit = (task) => {
        setEditingTask(task);

        // Determine if path is one of the presets
        const isPresetPath = downloadPaths.some(p => p.path === task.save_path);
        const savePathValue = isPresetPath ? task.save_path : 'custom';
        const customPathValue = isPresetPath ? '' : task.save_path;

        setFormData({
            ...task,
            save_path: savePathValue,
            custom_path: customPathValue,
            filter_config: typeof task.filter_config === 'string'
                ? JSON.parse(task.filter_config)
                : (task.filter_config || { keywords: '', exclude: '', size_min: '', size_max: '' })
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 处理自定义路径
        const finalSavePath = formData.save_path === 'custom'
            ? formData.custom_path
            : formData.save_path;

        const payload = {
            ...formData,
            save_path: finalSavePath,
            filter_config: JSON.stringify(formData.filter_config)
        };

        try {
            const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
            const method = editingTask ? 'PUT' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowModal(false);
                fetchData();
            } else {
                alert('保存失败');
            }
        } catch (err) {
            alert('服务器连接失败');
        }
    };

    const toggleTask = async (task) => {
        try {
            await authenticatedFetch(`/api/tasks/${task.id}/toggle`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !task.enabled })
            });
            fetchData();
        } catch (err) {
            alert('操作失败');
        }
    };

    const deleteTask = async (id) => {
        const task = tasks.find(t => t.id === id);

        if (task && (task.name.startsWith('[追剧]') || task.name.startsWith('[Series]'))) {
            alert("⚠️ 禁止删除\n\n该任务由【追剧订阅】自动生成，不能直接删除。\n请前往「追剧管理」页面删除对应的订阅，系统将自动清理该任务。");
            return;
        }

        if (!confirm('确定删除该自动化任务吗？')) return;
        try {
            console.log('Deleting task:', id);
            const res = await authenticatedFetch(`/api/tasks/${id}`, { method: 'DELETE' });
            console.log('Delete response:', res.status);
            if (res.ok) {
                fetchData();
            } else {
                const error = await res.text();
                console.error('Delete failed:', error);
                alert('删除失败: ' + error);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('删除失败: ' + err.message);
        }
    };

    const executeTask = async (task) => {
        try {
            const res = await authenticatedFetch(`/api/tasks/${task.id}/execute`, { method: 'POST' });
            if (res.ok) {
                alert('任务已开始执行，请稍后刷新查看结果');
                setTimeout(fetchData, 2000);
            } else {
                alert('执行失败');
            }
        } catch (err) {
            alert('服务器连接失败');
        }
    };

    const viewLogs = async (task) => {
        setEditingTask(task);
        setShowLogsModal(true);
        setLogLoading(true);
        try {
            const res = await authenticatedFetch(`/api/tasks/${task.id}/logs`);
            const data = await res.json();
            setSelectedTaskLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Fetch logs failed:', err);
        } finally {
            setLogLoading(false);
        }
    };

    const handleRSSSubmit = async (e) => {
        e.preventDefault();
        const method = editingRSSSource ? 'PUT' : 'POST';
        const url = editingRSSSource ? `/api/rss-sources/${editingRSSSource.id}` : '/api/rss-sources';

        try {
            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rssFormData)
            });
            if (res.ok) {
                setRSSFormData({ site_id: sites[0]?.id || '', name: '', url: '' });
                setEditingRSSSource(null);
                fetchData();
            }
        } catch (err) {
            alert('保存失败');
        }
    };

    const openRSSEdit = (source) => {
        setEditingRSSSource(source);
        setRSSFormData({
            site_id: source.site_id,
            name: source.name,
            url: source.url
        });
    };

    const cancelRSSEdit = () => {
        setEditingRSSSource(null);
        setRSSFormData({ site_id: sites[0]?.id || '', name: '', url: '' });
    };

    const deleteRSSSource = async (id) => {
        if (!confirm('确定删除该订阅源吗？')) return;
        await authenticatedFetch(`/api/rss-sources/${id}`, { method: 'DELETE' });
        fetchData();
    };

    const handleSelectSource = (source) => {
        setFormData({
            ...formData,
            name: source.name,
            site_id: source.site_id,
            rss_url: source.url
        });
        setEditingRSSSource(null);
        setRSSFormData({ site_id: sites[0]?.id || '', name: '', url: '' });
        setShowRSSModal(false);
        setShowModal(true);
    };

    const handlePathSubmit = async (e) => {
        e.preventDefault();
        const method = editingPath ? 'PUT' : 'POST';
        const url = editingPath ? `/api/download-paths/${editingPath.id}` : '/api/download-paths';

        try {
            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pathFormData)
            });
            if (res.ok) {
                setPathFormData({ name: '', path: '', description: '' });
                setEditingPath(null);
                fetchDownloadPaths();
            }
        } catch (err) {
            alert('保存失败');
        }
    };

    const openPathEdit = (path) => {
        setEditingPath(path);
        setPathFormData({
            name: path.name,
            path: path.path,
            description: path.description || ''
        });
    };

    const cancelPathEdit = () => {
        setEditingPath(null);
        setPathFormData({ name: '', path: '', description: '' });
    };

    const deletePath = async (id) => {
        if (!confirm('确定删除该路径吗？')) return;
        try {
            await authenticatedFetch(`/api/download-paths/${id}`, { method: 'DELETE' });
            fetchDownloadPaths();
        } catch (err) {
            alert('删除失败');
        }
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>自动任务</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>无人值守的 RSS 订阅与自动下种规则管理</p>
                </div>
                <div className="flex space-x-3 w-full sm:w-auto">
                    <button
                        onClick={() => setShowRSSModal(true)}
                        className={`px-6 py-3 border ${borderColor} ${textSecondary} hover:${textPrimary} ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg font-medium transition-all`}
                    >
                        订阅源维护
                    </button>
                    <button
                        onClick={handleAdd}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20"
                    >
                        + 创建任务
                    </button>
                </div>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-64 ${textSecondary}`}>加载任务中...</div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {tasks.map((task) => {
                        const site = sites.find(s => s.id === task.site_id);
                        const client = clients.find(c => c.id === task.client_id);
                        const matchingSource = rssSources.find(s => s.url === task.rss_url);

                        return (
                            <div key={task.id} className={`${bgMain} border ${borderColor} rounded-xl p-4 md:p-6 transition-all hover:shadow-md group shadow-sm`}>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center space-x-3">
                                            <span className={`w-2 h-2 rounded-full ${task.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                                            <h3 className={`text-xl font-bold ${textPrimary}`}>{task.name}</h3>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${darkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-200'} border`}>RSS 订阅</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-y-2 text-sm text-gray-500 space-x-4">
                                            <div className="flex items-center">
                                                <span className="mr-1">🌐</span> {site?.name || '未知站点'}
                                            </div>
                                            <div className="flex items-center">
                                                <span className="mr-1">📥</span> {client?.type || '默认客户端'}
                                            </div>
                                            <div className={`flex items-center font-mono text-[10px] ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} px-2 py-0.5 rounded`}>
                                                <span className="mr-1">⏰</span> {cronToHuman(task.cron)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center mt-4 md:mt-0 space-x-3 w-full md:w-auto justify-end">
                                        <button
                                            onClick={() => viewLogs(task)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium border ${borderColor} text-blue-500 ${darkMode ? 'hover:bg-blue-900/20' : 'hover:bg-blue-50'} transition-colors`}
                                        >
                                            任务日志
                                        </button>
                                        <button
                                            onClick={() => executeTask(task)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors`}
                                        >
                                            立即执行
                                        </button>
                                        <button
                                            onClick={() => toggleTask(task)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${task.enabled
                                                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                                                : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                                }`}
                                        >
                                            {task.enabled ? '暂停' : '启动'}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(task)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium border ${borderColor} ${textSecondary} ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                {task.last_run && (
                                    <div className={`mt-4 pt-4 border-t ${borderColor} text-[10px] ${textSecondary} flex justify-between items-center`}>
                                        <span>上次运行: {new Date(task.last_run).toLocaleString()}</span>
                                        <div className="flex items-center max-w-[50%]">
                                            {matchingSource ? (
                                                <div className={`flex items-center ${darkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'} px-2 py-0.5 rounded border`}>
                                                    <span className="mr-1 text-[10px]">📑</span>
                                                    <span className="text-blue-500 font-bold truncate text-[10px]">{matchingSource.name}</span>
                                                </div>
                                            ) : (
                                                <span className="truncate opacity-50 font-mono">{task.rss_url}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {tasks.length === 0 && (
                        <div className={`text-center py-20 ${bgMain} border border-dashed ${borderColor} rounded-2xl`}>
                            <div className="text-4xl mb-4 text-gray-400">⚡</div>
                            <p className={textSecondary}>目前还没有任何自动任务，快去创建一个吧！</p>
                        </div>
                    )}
                </div>
            )}

            {/* Task Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-2xl w-full max-w-2xl border ${borderColor} shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'}`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>
                                {editingTask ? '编辑自动任务' : '创建新 RSS 任务'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>任务名称</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                        placeholder="例如：M-Team 热门种追剧"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>关联站点</label>
                                    <select
                                        value={formData.site_id}
                                        onChange={(e) => setFormData({ ...formData, site_id: parseInt(e.target.value) })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                    >
                                        <option value="">选择站点</option>
                                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>执行周期</label>
                                    <div className="flex space-x-2">
                                        <input
                                            required
                                            type="number"
                                            min="1"
                                            value={parseCron(formData.cron).value}
                                            onChange={(e) => {
                                                const current = parseCron(formData.cron);
                                                const val = e.target.value;
                                                let newCron = '';
                                                if (current.unit === 'm') newCron = `*/${val} * * * *`;
                                                else if (current.unit === 'h') newCron = `0 */${val} * * *`;
                                                else if (current.unit === 'd') newCron = `0 0 */${val} * *`;
                                                setFormData({ ...formData, cron: newCron });
                                            }}
                                            className={`w-20 ${inputBg} border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-center`}
                                        />
                                        <select
                                            value={parseCron(formData.cron).unit}
                                            onChange={(e) => {
                                                const current = parseCron(formData.cron);
                                                const unit = e.target.value;
                                                let newCron = '';
                                                if (unit === 'm') newCron = `*/${current.value} * * * *`;
                                                else if (unit === 'h') newCron = `0 */${current.value} * * *`;
                                                else if (unit === 'd') newCron = `0 0 */${current.value} * *`;
                                                setFormData({ ...formData, cron: newCron });
                                            }}
                                            className={`flex-1 ${inputBg} border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500`}
                                        >
                                            <option value="m">分钟</option>
                                            <option value="h">小时</option>
                                            <option value="d">天</option>
                                        </select>
                                    </div>
                                    {parseCron(formData.cron).isComplex && (
                                        <p className="text-[10px] text-amber-500 mt-1">检测到复杂 Cron 表达式，已重置为简单模式</p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className={`block text-xs font-bold ${textSecondary} uppercase tracking-wider`}>RSS 订阅链接</label>
                                        <div className="flex space-x-2">
                                            {rssSources.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowModal(false); setShowRSSModal(true); }}
                                                    className="text-blue-500 text-[10px] hover:underline"
                                                >
                                                    从订阅源库选择
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {(() => {
                                        const matched = rssSources.find(s => s.url === formData.rss_url);
                                        return matched ? (
                                            <div className={`mb-2 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 flex items-center justify-between`}>
                                                <div className="flex items-center overflow-hidden">
                                                    <span className="mr-2 text-lg">📑</span>
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs font-bold text-blue-500 truncate">{matched.name}</p>
                                                        <p className="text-[10px] text-gray-500 truncate font-mono">{formData.rss_url}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, rss_url: '' })}
                                                    className="ml-2 text-gray-400 hover:text-red-500 text-xs"
                                                >
                                                    清除
                                                </button>
                                            </div>
                                        ) : (
                                            <input
                                                required
                                                type="url"
                                                value={formData.rss_url}
                                                onChange={(e) => setFormData({ ...formData, rss_url: e.target.value })}
                                                className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 mb-2`}
                                                placeholder="https://example.com/rss.php?..."
                                            />
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className={`p-4 rounded-xl border ${borderColor} ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                                <h3 className={`text-sm font-bold ${textPrimary} mb-4 flex items-center`}>
                                    <span className="mr-2">🔍</span> 过滤规则
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <div className="flex items-center mb-1">
                                            <label className={`block text-[10px] font-bold ${textSecondary} uppercase mr-2`}>智能正则匹配 (Smart Regex)</label>
                                            <div className="relative group">
                                                <button type="button" className="text-blue-500 hover:text-blue-600 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </button>
                                                {/* Tooltip */}
                                                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                                    <p className="font-bold mb-1">支持标准 JavaScript 正则表达式</p>
                                                    <ul className="list-disc pl-3 space-y-1 text-[10px] text-gray-300">
                                                        <li><code>.*</code> : 匹配任意字符</li>
                                                        <li><code>S0?1</code> : 匹配 S1 或 S01</li>
                                                        <li><code>(4k|1080p)</code> : 匹配其中之一</li>
                                                        <li><code>House.*S01</code> : 匹配 House 开头且含 S01</li>
                                                    </ul>
                                                    <div className="absolute left-2 -bottom-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.filter_config.smart_regex || ''}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, smart_regex: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 font-mono`}
                                            placeholder="例如: Game\.of\.Thrones.*S0?1.*(2160p|4k)"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">设置此项后将优先使用正则匹配，关键词作为二次过滤。</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={`block text-[10px] font-bold ${textSecondary} mb-1 uppercase`}>包含关键词 (逗号分隔)</label>
                                        <input
                                            type="text"
                                            value={formData.filter_config.keywords}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, keywords: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="例如: 2160p, H265, HEVC"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={`block text-[10px] font-bold ${textSecondary} mb-1 uppercase`}>排除关键词 (逗号分隔)</label>
                                        <input
                                            type="text"
                                            value={formData.filter_config.exclude}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, exclude: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="例如: 720p, Dubbed"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold ${textSecondary} mb-1 uppercase`}>最小体积 (MB)</label>
                                        <input
                                            type="number"
                                            value={formData.filter_config.size_min}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, size_min: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold ${textSecondary} mb-1 uppercase`}>最大体积 (MB)</label>
                                        <input
                                            type="number"
                                            value={formData.filter_config.size_max}
                                            onChange={(e) => setFormData({ ...formData, filter_config: { ...formData.filter_config, size_max: e.target.value } })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="无限制"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>分类 (Category)</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                    >
                                        <option value="">请选择分类</option>
                                        <optgroup label="一次性下载（匹配后自动禁用）">
                                            <option value="Movies">🎬 电影</option>
                                            <option value="Music">🎵 音乐</option>
                                            <option value="Books">📚 书籍</option>
                                            <option value="Games">🎮 游戏</option>
                                        </optgroup>
                                        <optgroup label="持续订阅（持续运行）">
                                            <option value="Series">📺 剧集</option>
                                            <option value="Anime">🎌 动画</option>
                                            <option value="Documentary">🎥 纪录片</option>
                                            <option value="Variety">🎭 综艺</option>
                                            <option value="Other">📦 其他</option>
                                        </optgroup>
                                    </select>
                                    {formData.category && (() => {
                                        const oneTimeCategories = ['movie', 'movies', 'film', 'films', '电影', 'music', 'album', '音乐', 'book', 'books', '书籍', 'game', 'games', '游戏'];
                                        const isOneTime = oneTimeCategories.some(cat => formData.category.toLowerCase().includes(cat));
                                        return (
                                            <p className={`text-[10px] mt-1 ${isOneTime ? 'text-blue-500' : 'text-gray-500'}`}>
                                                {isOneTime ? (
                                                    <>ℹ️ 此分类将自动设为一次性任务，匹配后自动禁用</>
                                                ) : (
                                                    <>ℹ️ 此分类将持续运行，适合追剧等场景</>
                                                )}
                                            </p>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>下载客户端</label>
                                    <select
                                        value={formData.client_id}
                                        onChange={(e) => setFormData({ ...formData, client_id: parseInt(e.target.value) })}
                                        className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                    >
                                        <option value="">默认下载器</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.type} ({c.host})</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase tracking-wider`}>保存路径</label>
                                    <div className="flex space-x-2">
                                        <select
                                            value={formData.save_path}
                                            onChange={(e) => setFormData({ ...formData, save_path: e.target.value })}
                                            className={`flex-1 ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                        >
                                            <option value="">请选择路径</option>
                                            {downloadPaths.map(p => (
                                                <option key={p.id} value={p.path}>
                                                    {p.name} ({p.path})
                                                </option>
                                            ))}
                                            <option value="custom">✏️ 自定义路径...</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setShowPathsModal(true)}
                                            className={`px-4 py-2 border ${borderColor} ${textSecondary} hover:${textPrimary} rounded-lg transition-colors`}
                                            title="管理路径"
                                        >
                                            ⚙️
                                        </button>
                                    </div>
                                    {formData.save_path === 'custom' && (
                                        <input
                                            type="text"
                                            value={formData.custom_path || ''}
                                            onChange={(e) => setFormData({ ...formData, custom_path: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-4 py-2 mt-2 focus:outline-none focus:border-blue-500`}
                                            placeholder="/downloads/custom"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className={`flex justify-end space-x-3 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                <button type="button" onClick={() => setShowModal(false)} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} transition-colors`}>取消</button>
                                <button type="submit" className="px-10 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20">
                                    {editingTask ? '保存更改' : '创建任务'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RSS Source Management Modal */}
            {showRSSModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-2xl w-full max-w-3xl border ${borderColor} shadow-2xl overflow-hidden max-h-[85vh] flex flex-col`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'}`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>RSS 订阅源维护</h2>
                            <button onClick={() => { setShowRSSModal(false); cancelRSSEdit(); }} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <form onSubmit={handleRSSSubmit} className={`p-4 rounded-xl border-2 ${editingRSSSource ? 'border-blue-500/50 bg-blue-500/5' : `border-dashed ${borderColor}`} mb-6 space-y-4`}>
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`text-xs font-bold ${editingRSSSource ? 'text-blue-500' : textSecondary} uppercase`}>
                                        {editingRSSSource ? '编辑现有订阅源' : '添加新订阅源'}
                                    </h4>
                                    {editingRSSSource && (
                                        <button
                                            type="button"
                                            onClick={cancelRSSEdit}
                                            className="text-[10px] text-blue-500 hover:underline font-bold"
                                        >
                                            取消编辑
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase`}>关联站点</label>
                                        <select
                                            required
                                            value={rssFormData.site_id}
                                            onChange={(e) => setRSSFormData({ ...rssFormData, site_id: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                        >
                                            <option value="">选择站点</option>
                                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase`}>用途描述</label>
                                        <input
                                            required
                                            type="text"
                                            value={rssFormData.name}
                                            onChange={(e) => setRSSFormData({ ...rssFormData, name: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="输入如：剧集、热门种"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1 uppercase`}>RSS URL</label>
                                        <div className="flex space-x-2">
                                            <input
                                                required
                                                type="url"
                                                value={rssFormData.url}
                                                onChange={(e) => setRSSFormData({ ...rssFormData, url: e.target.value })}
                                                className={`flex-1 ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                                placeholder="https://..."
                                            />
                                            <button type="submit" className={`px-6 py-1.5 ${editingRSSSource ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-sm font-bold transition-colors shadow-sm`}>
                                                {editingRSSSource ? '更新' : '添加'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <div className="space-y-3">
                                <h3 className={`text-sm font-bold ${textPrimary} mb-2`}>已维护的订阅源 ({rssSources.length})</h3>
                                {rssSources.length === 0 ? (
                                    <p className={`text-center py-8 text-sm ${textSecondary}`}>暂无订阅源，请先添加</p>
                                ) : (
                                    rssSources.map(source => (
                                        <div key={source.id} className={`flex items-center justify-between p-3 border ${borderColor} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                                            <div className="flex-1 min-w-0 mr-4">
                                                <div className="flex items-center space-x-2">
                                                    <span className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-gray-800 text-gray-500 border-gray-600' : 'bg-gray-100 text-gray-500 border-gray-200'} text-[10px] font-bold uppercase border`}>
                                                        {source.site_name}
                                                    </span>
                                                    <span className={`font-bold text-sm ${textPrimary}`}>{source.name}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1 truncate">{source.url}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleSelectSource(source)}
                                                    className="px-3 py-1 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded text-xs font-medium transition-colors"
                                                >
                                                    选用
                                                </button>
                                                <button
                                                    onClick={() => openRSSEdit(source)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                                                    title="编辑"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => deleteRSSSource(source.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="删除"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className={`p-4 border-t ${borderColor} ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'} flex justify-end`}>
                            <button onClick={() => { setShowRSSModal(false); cancelRSSEdit(); }} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} font-bold`}>关闭</button>
                        </div>
                    </div>
                </div >
            )}

            {/* Task Logs Modal */}
            {
                showLogsModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className={`${bgMain} rounded-2xl w-full max-w-4xl border ${borderColor} shadow-2xl overflow-hidden max-h-[85vh] flex flex-col`}>
                            <div className={`p-6 border-b ${borderColor} flex justify-between items-center ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'}`}>
                                <h2 className={`text-xl font-bold ${textPrimary}`}>任务执行日志: {editingTask?.name}</h2>
                                <button onClick={() => setShowLogsModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                            </div>

                            <div className="p-0 overflow-y-auto flex-1">
                                {logLoading ? (
                                    <div className="flex justify-center items-center h-64">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead className={`sticky top-0 ${bgSecondary} z-10 border-b ${borderColor}`}>
                                            <tr className="text-[10px] uppercase tracking-widest text-gray-500">
                                                <th className="py-3 px-6 font-bold">时间</th>
                                                <th className="py-3 px-4 font-bold">状态</th>
                                                <th className="py-3 px-4 font-bold text-center">抓取/匹配</th>
                                                <th className="py-3 px-4 font-bold">消息</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${darkMode ? 'divide-gray-700/50' : 'divide-gray-100'}`}>
                                            {selectedTaskLogs.map((log) => (
                                                <tr key={log.id} className={`${darkMode ? 'hover:bg-gray-700/20' : 'hover:bg-gray-50/50'} transition-colors`}>
                                                    <td className="py-3 px-6 text-xs font-mono text-gray-400">
                                                        {new Date(log.run_time).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.status === 'success'
                                                            ? 'bg-green-500/10 text-green-500'
                                                            : 'bg-red-500/10 text-red-500'
                                                            }`}>
                                                            {log.status === 'success' ? '成功' : '失败'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-mono text-xs text-gray-500">
                                                        {log.items_found} / {log.items_matched}
                                                    </td>
                                                    <td className={`py-3 px-4 text-sm ${log.status === 'error' ? 'text-red-400' : textSecondary} italic`}>
                                                        {log.message}
                                                    </td>
                                                </tr>
                                            ))}
                                            {selectedTaskLogs.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="py-20 text-center text-gray-500 italic">
                                                        暂无执行日志记录
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className={`p-4 border-t ${borderColor} ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'} flex justify-end`}>
                                <button onClick={() => setShowLogsModal(false)} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} font-bold`}>关闭</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Download Paths Management Modal */}
            {showPathsModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-2xl w-full max-w-3xl border ${borderColor} shadow-2xl overflow-hidden max-h-[85vh] flex flex-col`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'}`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>下载路径管理</h2>
                            <button onClick={() => setShowPathsModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <form onSubmit={handlePathSubmit} className={`p-4 rounded-xl border-2 ${editingPath ? 'border-blue-500/50 bg-blue-500/5' : `border-dashed ${borderColor}`} mb-6 space-y-4`}>
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`text-xs font-bold ${editingPath ? 'text-blue-500' : textSecondary} uppercase`}>
                                        {editingPath ? '编辑路径' : '添加新路径'}
                                    </h4>
                                    {editingPath && (
                                        <button
                                            type="button"
                                            onClick={cancelPathEdit}
                                            className="text-[10px] text-blue-500 hover:underline font-bold"
                                        >
                                            取消编辑
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1`}>名称</label>
                                        <input
                                            required
                                            type="text"
                                            value={pathFormData.name}
                                            onChange={(e) => setPathFormData({ ...pathFormData, name: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="电影"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1`}>路径</label>
                                        <input
                                            required
                                            type="text"
                                            value={pathFormData.path}
                                            onChange={(e) => setPathFormData({ ...pathFormData, path: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="/downloads/movies"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold ${textSecondary} mb-1`}>描述</label>
                                        <input
                                            type="text"
                                            value={pathFormData.description}
                                            onChange={(e) => setPathFormData({ ...pathFormData, description: e.target.value })}
                                            className={`w-full ${inputBg} border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500`}
                                            placeholder="电影下载目录"
                                        />
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button type="submit" className={`px-6 py-1.5 ${editingPath ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-sm font-bold transition-colors shadow-sm`}>
                                        {editingPath ? '更新' : '添加'}
                                    </button>
                                </div>
                            </form>

                            <div className="space-y-3">
                                <h3 className={`text-sm font-bold ${textPrimary} mb-2`}>已配置的路径 ({downloadPaths.length})</h3>
                                {downloadPaths.length === 0 ? (
                                    <p className={`text-center py-8 text-sm ${textSecondary}`}>暂无路径，请先添加</p>
                                ) : (
                                    downloadPaths.map(path => (
                                        <div key={path.id} className={`flex items-center justify-between p-3 border ${borderColor} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                                            <div className="flex-1 min-w-0 mr-4">
                                                <div className="flex items-center space-x-2">
                                                    <span className={`font-bold text-sm ${textPrimary}`}>{path.name}</span>
                                                    <span className="text-xs text-gray-400 font-mono">{path.path}</span>
                                                </div>
                                                {path.description && (
                                                    <p className="text-[10px] text-gray-400 mt-1">{path.description}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => openPathEdit(path)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                                                    title="编辑"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => deletePath(path.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="删除"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className={`p-4 border-t ${borderColor} ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'} flex justify-end`}>
                            <button onClick={() => setShowPathsModal(false)} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} font-bold`}>关闭</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default TasksPage;

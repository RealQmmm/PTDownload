import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';

const TasksPage = () => {
    const { darkMode } = useTheme();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Theme-aware classes
    const bgMain = darkMode ? 'bg-gray-800' : 'bg-white';
    const bgSecondary = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const inputBg = darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';

    const [formData, setFormData] = useState({
        name: '',
        cron: '0 */1 * * *', // Every hour
        rules: '',
        enabled: 1
    });

    const fetchTasks = async () => {
        try {
            const res = await fetch('/api/tasks');
            const data = await res.json();
            setTasks(data);
        } catch (err) {
            console.error('Fetch tasks failed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleAdd = () => {
        setFormData({ name: '', cron: '0 */1 * * *', rules: '', enabled: 1 });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            setShowModal(false);
            fetchTasks();
        } catch (err) {
            alert('保存失败');
        }
    };

    const toggleTask = async (task) => {
        try {
            await fetch(`/api/tasks/${task.id}/toggle`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !task.enabled })
            });
            fetchTasks();
        } catch (err) {
            alert('更新失败');
        }
    };

    const deleteTask = async (id) => {
        if (!confirm('确定删除吗？')) return;
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        fetchTasks();
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>自动任务</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>设置 RSS 订阅和自动下载规则</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20"
                >
                    + 创建新任务
                </button>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-64 ${textSecondary}`}>加载中...</div>
            ) : (
                <div className="space-y-4">
                    {tasks.map((task) => (
                        <div key={task.id} className={`${bgMain} border ${borderColor} rounded-xl p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center group shadow-sm`}>
                            <div className="flex-1 w-full md:w-auto">
                                <div className="flex items-center flex-wrap gap-2">
                                    <h3 className={`text-lg md:text-xl font-bold ${textPrimary}`}>{task.name}</h3>
                                    <span className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} text-[10px] md:text-xs px-2 py-1 rounded font-mono`}>
                                        {task.cron}
                                    </span>
                                </div>
                                <p className={`${textSecondary} text-xs md:text-sm mt-2 font-mono truncate`}>
                                    规则: {task.rules || '全自动'}
                                </p>
                            </div>
                            <div className="flex items-center justify-between md:justify-end w-full md:w-auto space-x-4 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 ${borderColor}">
                                <div className="flex flex-col items-start md:items-end">
                                    <span className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${task.enabled ? 'text-green-500' : 'text-red-500'}`}>
                                        {task.enabled ? '● 运行中' : '○ 已暂停'}
                                    </span>
                                    <button
                                        onClick={() => toggleTask(task)}
                                        className={`text-sm font-medium transition-colors ${task.enabled ? 'text-blue-400 hover:text-blue-300' : 'text-green-500 hover:text-green-400'}`}
                                    >
                                        {task.enabled ? '停止任务' : '启动任务'}
                                    </button>
                                </div>
                                <button
                                    onClick={() => deleteTask(task.id)}
                                    className={`${textSecondary} hover:text-red-400 p-2 transition-colors`}
                                    title="删除任务"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <div className={`text-center py-20 ${bgMain} border border-dashed ${borderColor} rounded-2xl`}>
                            <p className={textSecondary}>目前还没有任何自动任务，快去创建一个吧！</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className={`${bgMain} rounded-2xl w-full max-w-lg border ${borderColor} shadow-2xl`}>
                        <div className={`p-6 border-b ${borderColor} flex justify-between items-center`}>
                            <h2 className={`text-xl font-bold ${textPrimary}`}>新建自动任务</h2>
                            <button onClick={() => setShowModal(false)} className={`${textSecondary} hover:${textPrimary}`}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>任务名称</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                                    placeholder="例如：M-Team 自动刷流"
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Cron 表达式</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.cron}
                                    onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 font-mono`}
                                    placeholder="0 */1 * * *"
                                />
                                <p className={`text-[10px] ${textSecondary} mt-1`}>标准 Cron 格式，例如: 0 */1 * * * 表示每小时</p>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>过滤规则 (JSON)</label>
                                <textarea
                                    value={formData.rules}
                                    onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                    className={`w-full ${inputBg} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 font-mono`}
                                    placeholder='{ "size_min": "100MB", "free": true }'
                                    rows="4"
                                ></textarea>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className={`px-6 py-2 rounded-lg ${textSecondary} hover:${textPrimary} transition-colors`}>取消</button>
                                <button type="submit" className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors">
                                    创建任务
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksPage;

import React, { useState, useEffect } from 'react';

const TasksPage = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
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
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">自动任务</h1>
                    <p className="text-gray-400 mt-1">设置定时刷流、自动下载规则</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                    + 新建任务
                </button>
            </div>

            {loading ? (
                <div className="text-gray-400 text-center py-20 text-xl">加载中...</div>
            ) : (
                <div className="space-y-4">
                    {tasks.map((task) => (
                        <div key={task.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center group">
                            <div className="flex-1">
                                <div className="flex items-center">
                                    <h3 className="text-xl font-bold text-white mr-3">{task.name}</h3>
                                    <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
                                        Cron: {task.cron}
                                    </span>
                                </div>
                                <p className="text-gray-400 text-sm mt-2">规则: {task.rules || '全自动'}</p>
                            </div>
                            <div className="flex items-center space-x-4 mt-4 md:mt-0">
                                <div className="flex flex-col items-end mr-4">
                                    <span className={`text-xs font-bold mb-1 ${task.enabled ? 'text-green-400' : 'text-red-400'}`}>
                                        {task.enabled ? '运行中' : '已暂停'}
                                    </span>
                                    <button
                                        onClick={() => toggleTask(task)}
                                        className="text-sm text-blue-400 hover:underline"
                                    >
                                        {task.enabled ? '停止' : '启动'}
                                    </button>
                                </div>
                                <button
                                    onClick={() => deleteTask(task.id)}
                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <div className="text-center py-20 bg-gray-800/30 border border-dashed border-gray-700 rounded-2xl">
                            <p className="text-gray-500">目前还没有任何自动任务，快去创建一个吧！</p>
                        </div>
                    )}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">新建自动任务</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">任务名称</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
                                    placeholder="例如：M-Team 自动刷流"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Cron 表达式</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.cron}
                                    onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none"
                                    placeholder="0 */1 * * *"
                                />
                                <p className="text-xs text-gray-500 mt-1">默认每小时执行一次</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">过滤规则 (JSON)</label>
                                <textarea
                                    value={formData.rules}
                                    onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none"
                                    placeholder='{ "size_min": "100MB", "free": true }'
                                    rows="4"
                                ></textarea>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-gray-400">取消</button>
                                <button type="submit" className="bg-purple-600 px-8 py-2 rounded-lg text-white font-bold">创建任务</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksPage;

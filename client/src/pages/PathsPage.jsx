import React, { useState, useEffect } from 'react';
import { useTheme } from '../App';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';

const PathsPage = () => {
    const { darkMode, authenticatedFetch } = useTheme();
    const [paths, setPaths] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPath, setEditingPath] = useState(null);

    // Theme-aware classes
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        path: '',
        description: '',
        is_default: false
    });

    const fetchPaths = async () => {
        try {
            const res = await authenticatedFetch('/api/download-paths');
            const data = await res.json();
            setPaths(data);
        } catch (err) {
            console.error('Failed to fetch paths:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPaths();
    }, []);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const method = editingPath ? 'PUT' : 'POST';
        const url = editingPath ? `/api/download-paths/${editingPath.id}` : '/api/download-paths';

        try {
            await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            setShowModal(false);
            setEditingPath(null);
            setFormData({ name: '', path: '', description: '', is_default: false });
            fetchPaths();
        } catch (err) {
            alert('保存失败: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('确定要删除这个存储路径吗？')) return;
        try {
            await authenticatedFetch(`/api/download-paths/${id}`, { method: 'DELETE' });
            fetchPaths();
        } catch (err) {
            alert('删除失败');
        }
    };

    const handleAdd = () => {
        setEditingPath(null);
        setFormData({ name: '', path: '', description: '', is_default: false });
        setShowModal(true);
    };

    const openEdit = (path) => {
        if (path) {
            setEditingPath(path);
            setFormData({
                name: path.name,
                path: path.path,
                description: path.description || '',
                is_default: !!path.is_default
            });
            setShowModal(true);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div>
                    <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>多路径管理</h1>
                    <p className={`${textSecondary} mt-1 text-sm`}>管理下载任务的保存位置</p>
                </div>
                <Button onClick={handleAdd} variant="primary">
                    + 添加路径
                </Button>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-64 ${textSecondary}`}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-2"></div>
                    加载中...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paths.map((path) => (
                        <Card key={path.id} className={`relative group overflow-hidden flex flex-col h-full ${path.is_default ? (darkMode ? 'border-amber-500/50' : 'border-amber-300') : ''}`}>
                            {path.is_default ? (
                                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg shadow-sm z-10">
                                    默认
                                </div>
                            ) : null}

                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center min-w-0 flex-1">
                                    <div className={`w-12 h-12 flex-shrink-0 ${path.is_default ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-500' : (darkMode ? 'bg-purple-900/20 text-gray-400' : 'bg-purple-50 text-gray-500')} rounded-lg flex items-center justify-center text-2xl mr-3 group-hover:scale-110 transition-transform`}>
                                        {path.is_default ? '⭐' : '📁'}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={`font-bold text-lg ${textPrimary} truncate`} title={path.name}>{path.name}</h3>
                                        <span className={`text-[10px] ${textSecondary} uppercase tracking-widest font-bold`}>ID: {path.id}</span>
                                    </div>
                                </div>
                                <div className="flex space-x-1 shrink-0 mt-1">
                                    <button onClick={() => openEdit(path)} className={`${textSecondary} hover:text-blue-500 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700`} title="编辑路径">
                                        <span className="text-sm">✏️</span>
                                    </button>
                                    <button onClick={() => handleDelete(path.id)} className={`${textSecondary} hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700`} title="删除路径">
                                        <span className="text-sm">🗑️</span>
                                    </button>
                                </div>
                            </div>

                            <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-gray-50'} border ${borderColor} flex-1`}>
                                <p className={`text-[10px] ${textSecondary} uppercase mb-1`}>物理路径</p>
                                <p className={`text-xs font-mono ${textPrimary} break-all`}>{path.path}</p>
                            </div>

                            {path.description && (
                                <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-gray-900/30' : 'bg-gray-50'} border border-dashed ${borderColor}`}>
                                    <p className={`text-[10px] ${textSecondary} uppercase mb-1`}>说明</p>
                                    <p className={`text-xs ${textPrimary}`}>{path.description}</p>
                                </div>
                            )}
                        </Card>
                    ))}
                    {paths.length === 0 && (
                        <Card className="col-span-full py-12 text-center border-dashed">
                            <p className={textSecondary}>暂无存储路径，点击上方按钮添加。</p>
                        </Card>
                    )}
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingPath ? '编辑存储路径' : '添加存储路径'}
                description={editingPath ? '修改路径配置信息' : '配置新的存储路径'}
                size="md"
                footer={
                    <div className="flex justify-end space-x-3">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
                        <Button onClick={handleSubmit}>保存</Button>
                    </div>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="路径名称"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="例如: 电影"
                    />
                    <Input
                        label="物理路径"
                        required
                        value={formData.path}
                        onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                        placeholder="/downloads/movies"
                    />
                    <div>
                        <label className={`block text-xs font-bold uppercase ${textSecondary} mb-1`}>说明 (可选)</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="路径用途说明"
                            rows="3"
                            className={`w-full ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500`}
                        ></textarea>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <input
                            type="checkbox"
                            id="is_default"
                            checked={formData.is_default}
                            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                            className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500 border-gray-300"
                        />
                        <label htmlFor="is_default" className={`text-sm font-medium ${textPrimary}`}>
                            设为默认路径
                        </label>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PathsPage;

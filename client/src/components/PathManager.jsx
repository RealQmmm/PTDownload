import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Card from './ui/Card';
import Button from './ui/Button';
import Modal from './ui/Modal';
import Input from './ui/Input';

const PathManager = () => {
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
        <div className="space-y-4">
            <div className="flex justify-end items-center">
                <Button onClick={handleAdd} size="sm" variant="primary">
                    + 添加路径
                </Button>
            </div>

            {loading ? (
                <div className={`flex justify-center items-center h-32 ${textSecondary}`}>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                    加载中...
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
                    {paths.map((path) => (
                        <Card key={path.id} className={`p-3 relative group overflow-hidden flex flex-col h-full bg-opacity-50 ${path.is_default ? (darkMode ? 'border-amber-500/50' : 'border-amber-300') : ''}`}>
                            {path.is_default ? (
                                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg shadow-sm z-10">
                                    默认
                                </div>
                            ) : null}

                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center min-w-0 flex-1">
                                    <div className={`w-8 h-8 flex-shrink-0 ${path.is_default ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-500' : (darkMode ? 'bg-purple-900/20 text-gray-400' : 'bg-purple-50 text-gray-500')} rounded-lg flex items-center justify-center text-lg mr-2`}>
                                        {path.is_default ? '⭐' : '📁'}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={`font-bold text-sm ${textPrimary} truncate`} title={path.name}>{path.name}</h3>
                                        <p className={`text-[10px] ${textSecondary} font-mono truncate`}>{path.path}</p>
                                    </div>
                                </div>
                                <div className="flex space-x-1 shrink-0">
                                    <button onClick={() => openEdit(path)} className={`${textSecondary} hover:text-blue-500 p-1`} title="编辑">
                                        ✏️
                                    </button>
                                    <button onClick={() => handleDelete(path.id)} className={`${textSecondary} hover:text-red-500 p-1`} title="删除">
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            {path.description && (
                                <p className={`text-[10px] ${textSecondary} mt-1 line-clamp-1`}>{path.description}</p>
                            )}
                        </Card>
                    ))}
                    {paths.length === 0 && (
                        <div className={`col-span-full py-8 text-center border-2 border-dashed ${borderColor} rounded-lg`}>
                            <p className={`text-sm ${textSecondary}`}>暂无存储路径</p>
                        </div>
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

export default PathManager;

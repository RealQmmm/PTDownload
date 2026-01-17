import React, { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useSettings } from './hooks/useSettings';

/**
 * Backup Settings Component
 * Handles: Export/Import configuration and database
 */
const BackupSettings = ({ darkMode, authenticatedFetch }) => {
    const { saving, setSaving, message, showMessage } = useSettings(authenticatedFetch);

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';

    const handleExport = async () => {
        try {
            const res = await authenticatedFetch('/api/backup/export');
            const data = await res.json();

            if (res.ok) {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ptdownload-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);

                showMessage('success', '配置备份导出成功');
            } else {
                showMessage('error', data.error || '导出失败');
            }
        } catch (err) {
            showMessage('error', '导出出错');
        }
    };

    const handleExportDatabase = async () => {
        setSaving(true);
        try {
            const res = await authenticatedFetch('/api/backup/export-db');

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ptdownload-${new Date().toISOString().split('T')[0]}.db`;
                a.click();
                URL.revokeObjectURL(url);

                showMessage('success', '数据库文件导出成功');
            } else {
                const data = await res.json();
                showMessage('error', data.error || '导出失败');
            }
        } catch (err) {
            showMessage('error', '导出出错');
        } finally {
            setSaving(false);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm('导入备份将覆盖当前所有数据（站点、任务、统计等）！确定要继续吗？')) {
            e.target.value = '';
            return;
        }

        setSaving(true);
        try {
            const text = await file.text();
            let data;

            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                showMessage('error', '文件解析失败，请确保是有效的 JSON 备份文件');
                e.target.value = '';
                setSaving(false);
                return;
            }

            const res = await authenticatedFetch('/api/backup/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok) {
                showMessage('success', '备份导入成功，页面即将刷新...');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                showMessage('error', result.error || '导入失败');
            }
        } catch (err) {
            showMessage('error', '导入出错');
        } finally {
            e.target.value = '';
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            <Card darkMode={darkMode}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Export JSON */}
                    <div className="space-y-4">
                        <h3 className={`text-lg font-semibold ${textPrimary}`}>
                            导出配置数据 (JSON)
                        </h3>
                        <p className={`text-sm ${textSecondary}`}>
                            导出包含所有配置、站点、任务、客户端及历史统计数据的 JSON 文件，适合跨版本迁移。
                        </p>
                        <Button onClick={handleExport} darkMode={darkMode} className="w-full">
                            📦 导出配置备份 (JSON)
                        </Button>
                    </div>

                    {/* Export Database */}
                    <div className="space-y-4">
                        <h3 className={`text-lg font-semibold ${textPrimary}`}>
                            导出数据库文件 (SQLite)
                        </h3>
                        <p className={`text-sm ${textSecondary}`}>
                            导出完整的 SQLite 数据库文件，包含所有原始数据，适合迁移到外部存储或备份。
                        </p>
                        <Button
                            onClick={handleExportDatabase}
                            disabled={saving}
                            darkMode={darkMode}
                            className="w-full"
                        >
                            {saving ? '导出中...' : '💾 导出数据库文件 (DB)'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Import */}
            <Card darkMode={darkMode}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>导入数据</h3>

                <p className={`text-sm ${textSecondary} mb-4`}>
                    ⚠️ 警告：导入操作将清除并替换掉当前系统中所有的现有数据。请谨慎操作。
                </p>

                <div className="relative">
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        disabled={saving}
                        className="hidden"
                        id="import-backup"
                    />
                    <label
                        htmlFor="import-backup"
                        className={`flex items-center justify-center w-full py-3 border-2 border-dashed ${borderColor} rounded-lg cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            } transition-all font-semibold ${textPrimary}`}
                    >
                        {saving ? '正在导入...' : '📂 选择备份文件并导入'}
                    </label>
                </div>
            </Card>

            {/* Tips */}
            <Card darkMode={darkMode}>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-2xl">⚠️</span>
                    <div className={`text-sm ${textSecondary}`}>
                        <p className="font-bold mb-2 text-amber-500">提示事项：</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>JSON 备份：适合跨版本迁移，包含配置和数据</li>
                            <li>数据库文件：完整的原始数据，可用于外部存储或直接替换</li>
                            <li>导入成功后应用会自动刷新页面</li>
                            <li>如果导入的是在不同环境下生成的备份，请确保站点 Cookies 与客户端地址仍然有效</li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default BackupSettings;

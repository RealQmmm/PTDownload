import { useState, useEffect } from 'react';

/**
 * Shared hook for settings management
 * Provides common state and methods for all settings sub-pages
 */
export const useSettings = (authenticatedFetch) => {
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const showMessage = (type, text, duration = 3000) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), duration);
    };

    const saveSettings = async (settings) => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await authenticatedFetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (res.ok) {
                showMessage('success', '设置保存成功');
                return { success: true, data };
            } else {
                showMessage('error', data.error || '保存失败');
                return { success: false, error: data.error };
            }
        } catch (err) {
            showMessage('error', '保存出错');
            return { success: false, error: err.message };
        } finally {
            setSaving(false);
        }
    };

    return {
        saving,
        setSaving,
        message,
        setMessage,
        showMessage,
        saveSettings
    };
};

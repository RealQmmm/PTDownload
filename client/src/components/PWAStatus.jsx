import React, { useState, useEffect } from 'react';

const PWAStatus = () => {
    const [status, setStatus] = useState({
        swRegistered: false,
        swActive: false,
        isInstalled: false,
        isOnline: navigator.onLine,
        cacheSize: 0
    });

    useEffect(() => {
        checkPWAStatus();

        // 监听在线/离线状态
        const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
        const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const checkPWAStatus = async () => {
        // 检查 Service Worker
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            const swRegistered = !!registration;
            const swActive = registration?.active?.state === 'activated';

            // 检查是否已安装
            const isInstalled = window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone
                || document.referrer.includes('android-app://');

            // 计算缓存大小
            let cacheSize = 0;
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    const cache = await caches.open(name);
                    const keys = await cache.keys();
                    cacheSize += keys.length;
                }
            }

            setStatus({
                swRegistered,
                swActive,
                isInstalled,
                isOnline: navigator.onLine,
                cacheSize
            });
        }
    };

    const clearCache = async () => {
        if (confirm('确定要清除所有缓存吗？这将需要重新加载页面。')) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            window.location.reload();
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                PWA 状态
            </h3>

            <div className="space-y-3">
                <StatusItem
                    label="Service Worker"
                    value={status.swRegistered ? '已注册' : '未注册'}
                    status={status.swRegistered}
                />
                <StatusItem
                    label="Service Worker 状态"
                    value={status.swActive ? '已激活' : '未激活'}
                    status={status.swActive}
                />
                <StatusItem
                    label="应用安装"
                    value={status.isInstalled ? '已安装' : '未安装'}
                    status={status.isInstalled}
                />
                <StatusItem
                    label="网络状态"
                    value={status.isOnline ? '在线' : '离线'}
                    status={status.isOnline}
                />
                <StatusItem
                    label="缓存项数"
                    value={status.cacheSize}
                    status={status.cacheSize > 0}
                />
            </div>

            <div className="mt-6 flex gap-3">
                <button
                    onClick={checkPWAStatus}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                    刷新状态
                </button>
                <button
                    onClick={clearCache}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                >
                    清除缓存
                </button>
            </div>
        </div>
    );
};

const StatusItem = ({ label, value, status }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{value}</span>
            <div className={`w-2 h-2 rounded-full ${status ? 'bg-green-500' : 'bg-gray-400'}`} />
        </div>
    </div>
);

export default PWAStatus;

import React, { useState, useEffect } from 'react';

const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // 检测是否已安装
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone
            || document.referrer.includes('android-app://');
        setIsStandalone(standalone);

        // 检测 iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(iOS);

        // 监听安装提示事件
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);

            // 检查是否已经关闭过提示
            const dismissed = localStorage.getItem('pwa-install-dismissed');
            if (!dismissed) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // iOS 用户显示提示（如果未安装且未关闭）
        if (iOS && !standalone) {
            const dismissed = localStorage.getItem('pwa-install-dismissed');
            if (!dismissed) {
                setShowPrompt(true);
            }
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('[PWA] User accepted the install prompt');
        } else {
            console.log('[PWA] User dismissed the install prompt');
        }

        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', 'true');
    };

    // 如果已安装或不显示提示，返回 null
    if (isStandalone || !showPrompt) {
        return null;
    }

    // iOS 安装提示
    if (isIOS) {
        return (
            <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 z-50 border border-gray-200 dark:border-gray-700 animate-slide-up">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <img src="/icons/icon-96.png" alt="App Icon" className="w-12 h-12 rounded-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                            安装 PTDownload
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            点击分享按钮 <span className="inline-block">📤</span>，然后选择"添加到主屏幕"
                        </p>
                        <button
                            onClick={handleDismiss}
                            className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                        >
                            知道了
                        </button>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }

    // Android/Desktop 安装提示
    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-2xl p-4 z-50 animate-slide-up">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <img src="/icons/icon-96.png" alt="App Icon" className="w-12 h-12 rounded-xl" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white mb-1">
                        安装 PTDownload 应用
                    </h3>
                    <p className="text-xs text-blue-100 mb-3">
                        像原生应用一样使用，支持离线访问
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleInstallClick}
                            className="px-3 py-1.5 bg-white text-blue-600 rounded-md text-xs font-medium hover:bg-blue-50 transition-colors"
                        >
                            立即安装
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1.5 bg-blue-700 text-white rounded-md text-xs font-medium hover:bg-blue-800 transition-colors"
                        >
                            稍后
                        </button>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 text-white/80 hover:text-white"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;

import { useEffect } from 'react';

/**
 * Custom hook to update iOS status bar and theme color based on current theme
 * This ensures the status bar adapts to light/dark mode like Android
 */
export const useAdaptiveStatusBar = (darkMode) => {
    useEffect(() => {
        // Update theme-color meta tag for Android and modern browsers
        const updateThemeColor = () => {
            let themeColorMeta = document.querySelector('meta[name="theme-color"]:not([media])');

            if (!themeColorMeta) {
                themeColorMeta = document.createElement('meta');
                themeColorMeta.setAttribute('name', 'theme-color');
                document.head.appendChild(themeColorMeta);
            }

            // Set color based on dark mode
            const color = darkMode ? '#0f172a' : '#ffffff';
            themeColorMeta.setAttribute('content', color);
        };

        // Update iOS status bar style
        const updateIOSStatusBar = () => {
            let statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');

            if (!statusBarMeta) {
                statusBarMeta = document.createElement('meta');
                statusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
                document.head.appendChild(statusBarMeta);
            }

            // iOS status bar styles:
            // - 'default': White background with black text (light mode)
            // - 'black': Black background with white text (dark mode)
            // - 'black-translucent': Translucent black (deprecated, not recommended)
            const style = darkMode ? 'black' : 'default';
            statusBarMeta.setAttribute('content', style);
        };

        updateThemeColor();
        updateIOSStatusBar();

        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            updateThemeColor();
            updateIOSStatusBar();
        }, 100);

        return () => clearTimeout(timer);
    }, [darkMode]);
};

export default useAdaptiveStatusBar;

import { useEffect, useRef } from 'react';

/**
 * Custom hook for swipe gestures to control sidebar
 * @param {Function} onSwipeRight - Callback when swiping right (open sidebar)
 * @param {Function} onSwipeLeft - Callback when swiping left (close sidebar)
 * @param {boolean} enabled - Whether gestures are enabled
 */
export const useSwipeGesture = (onSwipeRight, onSwipeLeft, enabled = true) => {
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchEndX = useRef(0);
    const touchEndY = useRef(0);
    const isSwiping = useRef(false);

    useEffect(() => {
        if (!enabled) return;

        const minSwipeDistance = 50; // 最小滑动距离
        const maxVerticalDistance = 100; // 最大垂直偏移
        const edgeThreshold = 30; // 边缘触发区域（像素）

        const handleTouchStart = (e) => {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;

            // 只在屏幕左边缘开始滑动时才触发打开侧边栏
            if (touchStartX.current <= edgeThreshold) {
                isSwiping.current = true;
            } else {
                // 在其他位置开始滑动也允许，用于关闭侧边栏
                isSwiping.current = true;
            }
        };

        const handleTouchMove = (e) => {
            if (!isSwiping.current) return;

            touchEndX.current = e.touches[0].clientX;
            touchEndY.current = e.touches[0].clientY;
        };

        const handleTouchEnd = () => {
            if (!isSwiping.current) return;

            const deltaX = touchEndX.current - touchStartX.current;
            const deltaY = Math.abs(touchEndY.current - touchStartY.current);

            // 确保是水平滑动（垂直偏移不能太大）
            if (deltaY > maxVerticalDistance) {
                isSwiping.current = false;
                return;
            }

            // 从左边缘向右滑动 - 打开侧边栏
            if (touchStartX.current <= edgeThreshold && deltaX > minSwipeDistance) {
                onSwipeRight?.();
            }
            // 向左滑动 - 关闭侧边栏
            else if (deltaX < -minSwipeDistance) {
                onSwipeLeft?.();
            }

            isSwiping.current = false;
        };

        // 添加事件监听器
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        // 清理
        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [enabled, onSwipeRight, onSwipeLeft]);
};

export default useSwipeGesture;

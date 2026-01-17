import React, { useMemo } from 'react';

const PromotionTimeCapsule = ({ timeLeft, size = 'md', className = '' }) => {
    if (!timeLeft) return null;

    // 解析时间并格式化为M-Team风格
    const timeInfo = useMemo(() => {
        const text = timeLeft.toLowerCase();

        // 提取天数
        const daysMatch = text.match(/(\d+)\s*(?:天|日|d|day)/i);
        const days = daysMatch ? parseInt(daysMatch[1]) : 0;

        // 提取小时
        const hoursMatch = text.match(/(\d+)\s*(?:小时|时|h|hour)/i);
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;

        // 提取分钟
        const minutesMatch = text.match(/(\d+)\s*(?:分钟|分|m|min)/i);
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;

        // 计算总小时数
        const totalHours = days * 24 + hours + (minutes / 60);

        // 判断紧迫程度
        let level = 'safe';
        if (totalHours > 168) level = 'safe';      // > 7天
        else if (totalHours > 72) level = 'normal';     // 3-7天
        else if (totalHours > 24) level = 'warning';    // 1-3天
        else level = 'urgent';                          // < 1天

        // 格式化为M-Team风格：FREE 2d 21h 或 FREE 4h 55min
        let displayText = 'FREE';

        if (days > 0) {
            // 有天数：显示天和小时
            displayText += ` ${days}d`;
            if (hours > 0) {
                displayText += ` ${hours}h`;
            }
        } else if (hours > 0) {
            // 没有天数，有小时：显示小时和分钟
            displayText += ` ${hours}h`;
            if (minutes > 0) {
                displayText += ` ${minutes}min`;
            }
        } else if (minutes > 0) {
            // 只有分钟
            displayText += ` ${minutes}min`;
        }

        return { level, displayText, totalHours, days, hours, minutes };
    }, [timeLeft]);

    const sizeClasses = {
        xs: 'text-[9px] px-1.5 py-0.5',
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-1'
    };

    // M-Team风格：实心背景 + 白色文字
    const urgencyStyles = {
        safe: 'bg-green-600 text-white',           // 绿色（安全）
        normal: 'bg-blue-600 text-white',          // 蓝色（正常）
        warning: 'bg-orange-600 text-white',       // 橙色（警告）
        urgent: 'bg-red-600 text-white animate-pulse-slow'  // 红色（紧急）
    };

    return (
        <span
            className={`
        inline-flex items-center
        rounded font-bold whitespace-nowrap
        transition-all duration-200
        ${sizeClasses[size]}
        ${urgencyStyles[timeInfo.level]}
        ${className}
      `}
            title={`促销剩余时间：${timeInfo.days > 0 ? `${timeInfo.days}天` : ''}${timeInfo.hours > 0 ? `${timeInfo.hours}小时` : ''}${timeInfo.minutes > 0 ? `${timeInfo.minutes}分钟` : ''}`}
        >
            {timeInfo.displayText}
        </span>
    );
};

export default PromotionTimeCapsule;

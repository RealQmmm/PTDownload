import React from 'react';
import { useTheme } from '../App';

const HelpPage = () => {
    const { darkMode } = useTheme();

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
    const bgCard = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
    const accentColor = 'blue';

    const sections = [
        {
            title: '站点数据同步 (Site Sync)',
            icon: '🔄',
            content: [
                '系统默认每 60 分钟自动执行一次全量站点同步。',
                '同步过程中会执行两项操作：1. 验证 Cookie 有效性；2. 更新上传量、下载量、分享率等个人统计数据。',
                '如果您在系统设置中修改了 "Cookie 检查间隔"，同步频率也将随之改变。',
                '手动点击站点卡片上的 🔄 按钮可以立即强制执行该站点的同步任务。'
            ]
        },
        {
            title: '上传贡献图 (Upload Heatmap)',
            icon: '📊',
            content: [
                '贡献图记录了过去 90 天内该站点的上传增量分布。',
                '数据采集依赖于上述的 "站点数据同步" 任务。系统通过对比前后两次快照的上传量差值来记录当日增量。',
                '由于是差值计算，您从今天开始的第一次同步将作为基准线，从第二次有效同步起将开始点亮贡献图。',
                '颜色深度映射：灰色 (无上传) → 浅蓝 (<1GB) → 中蓝 (1GB-50GB) → 深蓝 (>50GB)。'
            ]
        },
        {
            title: '自动签到 (Auto Check-in)',
            icon: '⏰',
            content: [
                '自动签到任务每日执行一次。',
                '执行时间可以在系统设置的 "每日签到时间" 中配置。',
                '只有在站点编辑中勾选了 "自动签到" 选项的站点才会参与该任务。',
                '点击站点名称旁的 ⏰ 图标可以随时进行手动补签。'
            ]
        },
        {
            title: 'RSS & 自动化任务',
            icon: '📡',
            content: [
                'RSS 任务的运行频率由您设置的 Cron 表达式决定。',
                '常见的 Cron 表达式示例：',
                '• */15 * * * * : 每 15 分钟运行一次。',
                '• 0 * * * * : 每小时整点运行一次。',
                '• */2 * * * * : 每 2 分钟运行一次 (建议对 RSS 保持适当间隔，避免被封禁)。'
            ]
        },
        {
            title: '仪表盘流量统计 (Traffic Stats)',
            icon: '📉',
            content: [
                '增量计算：系统通过每分钟轮询下载客户端的总流量，计算当前时刻与上一分钟的差值，并实时累加到当日统计中。',
                '图表逻辑：7 天流量图展示的是过去 7 个自然日的每日累积增量，若某日无数据则自动补零。',
                '计数重置处理：若下载客户端重启导致流量计数器清零，系统会自动识别并从新起点开始重新累加，确保统计不会出现大幅负数。',
                '资源完成判定：系统优先通过种子 Hash 值进行精确匹配，并从下载客户端中同步精确的 <b>完成时间</b> 与 <b>创建时间</b>。仅显示进度达到 100% 或处于做种/完成状态的任务。'
            ]
        },
        {
            title: '数据清理 (Data Cleanup)',
            icon: '🧹',
            content: [
                '系统每日凌晨 3:00 会自动执行一次维护任务。',
                '日志清理：依据设置中的 "日志保留天数" 和 "单任务最大日志数" 自动清理。',
                '热力图清理：系统会自动保留最近 180 天的站点上传贡献数据，超过半年的历史数据将被自动移除。'
            ]
        }
    ];

    return (
        <div className="space-y-6">
            <header>
                <h1 className={`text-2xl font-bold ${textPrimary}`}>使用帮助与规则说明</h1>
                <p className={`mt-1 ${textSecondary}`}>了解 PTDownload 的自动化运行逻辑与数据同步规则</p>
            </header>

            <div className={`grid grid-cols-1 gap-6`}>
                {sections.map((section, idx) => (
                    <div
                        key={idx}
                        className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
                    >
                        <div className="px-6 py-4 border-b border-gray-700/30 bg-opacity-50 bg-gray-700/10 flex items-center space-x-3">
                            <span className="text-xl">{section.icon}</span>
                            <h2 className={`text-lg font-bold ${textPrimary}`}>{section.title}</h2>
                        </div>
                        <div className="p-6">
                            <ul className="space-y-3">
                                {section.content.map((item, i) => (
                                    <li key={i} className={`flex items-start text-sm ${textSecondary}`}>
                                        <span className="text-blue-500 mr-2 mt-1">•</span>
                                        <span className="leading-relaxed">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>

            <footer className={`text-center py-8 ${textSecondary} text-xs border-t ${borderColor} mt-8`}>
                <p>PTDownload v1.0.0 - 让 PT 管理更简单</p>
            </footer>
        </div>
    );
};

export default HelpPage;

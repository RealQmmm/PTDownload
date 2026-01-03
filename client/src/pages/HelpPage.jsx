import React from 'react';
import { useTheme } from '../App';
import Card from '../components/ui/Card';

const HelpPage = () => {
    const { darkMode } = useTheme();

    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

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
                '覆盖范围：基于站点个人中心数据的统计机制，确保了无论是平台自动订阅、手动下载还是外部导入的种子，只要产生上传量都会被准确记录。',
                '颜色深度映射：灰色 (无上传) → 浅蓝 (<1GB) → 中蓝 (1GB-50GB) → 深蓝 (>50GB)。'
            ]
        },
        {
            title: '全场景流量监控 (Traffic Monitoring)',
            icon: '📉',
            content: [
                '全局流量覆盖：系统实时采集下载客户端（qBittorrent/Transmission）的全局传输数据，结合本地增量计算逻辑，精确统计今日流量。',
                '种子全覆盖：无论种子来源是 RSS 订阅、平台搜索下载，还是用户直接在下载器中添加，系统均能自动识别并纳入监控范围。',
                '外部种子导入：系统会自动发现“外部添加”的种子，并将其导入历史记录，确保“今日下载”列表中包含所有途径完成的任务。',
                '完成判定：统一轮询所有任务状态，准确记录完成时间。即使任务在外部完成，也会被标记为“手动下载”并显示在今日列表中。',
                '计数重置保护：采用差值算法，即使下载客户端重启或计数器归零，系统也能自动识别并从新起点累加，确保统计数据的连续性和准确性。'
            ]
        },
        {
            title: '数据备份与恢复 (Backup & Restore)',
            icon: '💾',
            content: [
                '备份范围：系统提供全量数据导出功能，涵盖站点配置、任务规则、历史记录、流量统计、热力图数据及用户设置等共 11 张核心数据表。',
                '智能导入：导入逻辑具备版本兼容性保护，能自动过滤不匹配的字段，防止因版本差异导致的错误。',
                '数据一致性：导入过程会自动处理表间依赖（如任务关联站点），确保存储的一致性。',
                '状态衔接：数据导入完成后，系统会自动重载统计服务，确保流量计数无缝衔接，不会出现断层。'
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
        <div className="p-4 md:p-8">
            <header className="mb-6">
                <h1 className={`text-2xl font-bold ${textPrimary}`}>使用帮助与规则说明</h1>
                <p className={`mt-1 ${textSecondary} text-sm`}>了解 PTDownload 的自动化运行逻辑与数据同步规则</p>
            </header>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6`}>
                {sections.map((section, idx) => (
                    <Card
                        key={idx}
                        className="p-0 overflow-hidden"
                    >
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center space-x-3">
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
                    </Card>
                ))}
            </div>

            <footer className={`text-center py-8 ${textSecondary} text-xs border-t border-gray-200 dark:border-gray-700 mt-8`}>
                <p>PTDownload v1.0.0 - 让 PT 管理更简单</p>
            </footer>
        </div>
    );
};

export default HelpPage;

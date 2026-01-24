#!/usr/bin/env node

/**
 * 修复现有追剧任务的 cron 表达式
 * 根据 check_interval 重新设置 cron 频率
 */

const { getDB } = require('./src/db');

async function fixSeriesCron() {
    const db = getDB();

    console.log('[Fix] 开始检查追剧任务的 cron 设置...\n');

    // 获取所有追剧订阅及其关联的任务
    const subscriptions = db.prepare(`
        SELECT 
            s.id as sub_id,
            s.name,
            s.check_interval,
            t.id as task_id,
            t.cron as current_cron,
            t.enabled
        FROM series_subscriptions s
        LEFT JOIN tasks t ON s.task_id = t.id
        WHERE t.id IS NOT NULL
    `).all();

    console.log(`找到 ${subscriptions.length} 个追剧订阅\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const sub of subscriptions) {
        const checkInterval = sub.check_interval || 0;

        // 根据 check_interval 确定正确的 cron
        let correctCron = '*/30 * * * *'; // Default: every 30 minutes
        if (checkInterval >= 7) {
            correctCron = '0 */2 * * *'; // Every 2 hours
        } else if (checkInterval >= 3) {
            correctCron = '0 * * * *'; // Every hour
        }

        console.log(`📺 ${sub.name}`);
        console.log(`   - 追剧周期: ${checkInterval} 天`);
        console.log(`   - 当前 cron: ${sub.current_cron}`);
        console.log(`   - 正确 cron: ${correctCron}`);

        if (sub.current_cron !== correctCron) {
            // 需要修复
            db.prepare('UPDATE tasks SET cron = ? WHERE id = ?').run(correctCron, sub.task_id);
            console.log(`   ✅ 已修复！\n`);
            fixedCount++;
        } else {
            console.log(`   ✓ 无需修复\n`);
            skippedCount++;
        }
    }

    console.log('='.repeat(60));
    console.log(`修复完成！`);
    console.log(`- 修复了 ${fixedCount} 个任务`);
    console.log(`- 跳过了 ${skippedCount} 个任务（已正确）`);
    console.log('='.repeat(60));

    if (fixedCount > 0) {
        console.log('\n⚠️  重要提示：');
        console.log('请重启服务器以应用新的 cron 设置：');
        console.log('  npm run dev  (开发环境)');
        console.log('  或重启 Docker 容器 (生产环境)');
    }
}

// 运行修复
try {
    const { initDB } = require('./src/db');
    initDB();
    fixSeriesCron();
} catch (err) {
    console.error('修复失败:', err.message);
    console.error(err.stack);
    process.exit(1);
}

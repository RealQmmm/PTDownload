/**
 * 调试脚本：检查剧集存在性判断逻辑
 * 
 * 使用方法：
 * 1. 修改下面的测试数据（taskId, subscriptionId, itemTitle）
 * 2. 运行: node debug-episode-check.js
 */

const { initDB, getDB } = require('./src/db');
const EpisodeTracker = require('./src/services/rss/EpisodeTracker');
const episodeParser = require('./src/utils/episodeParser');

// ========== 配置测试数据 ==========
const TEST_TASK_ID = 1;  // 替换为你的追剧任务 ID
const TEST_ITEM_TITLE = "某剧 S01E01 1080p";  // 替换为 RSS 中的资源标题

// ===================================

async function debugEpisodeCheck() {
    initDB();
    const db = getDB();

    console.log('='.repeat(80));
    console.log('剧集存在性检查调试');
    console.log('='.repeat(80));
    console.log();

    // 1. 获取追剧订阅信息
    const subscription = db.prepare('SELECT id, name, alias, season FROM series_subscriptions WHERE task_id = ?').get(TEST_TASK_ID);

    if (!subscription) {
        console.error(`❌ 未找到 task_id = ${TEST_TASK_ID} 的追剧订阅`);
        return;
    }

    console.log('📺 追剧订阅信息:');
    console.log(`   - ID: ${subscription.id}`);
    console.log(`   - 名称: ${subscription.name}`);
    console.log(`   - 别名: ${subscription.alias || '无'}`);
    console.log(`   - 季度: ${subscription.season}`);
    console.log();

    // 2. 解析测试资源标题
    const candidateInfo = episodeParser.parse(TEST_ITEM_TITLE);
    console.log('🎬 测试资源信息:');
    console.log(`   - 标题: ${TEST_ITEM_TITLE}`);
    console.log(`   - 解析结果:`, candidateInfo);
    console.log();

    if (!candidateInfo || candidateInfo.episodes.length === 0) {
        console.error('❌ 无法解析剧集信息');
        return;
    }

    // 3. 查询 series_episodes 表
    const targetSeason = candidateInfo.season !== null ? candidateInfo.season : (subscription.season || 1);
    const seriesEpisodes = db.prepare(
        'SELECT episode, torrent_title, download_time FROM series_episodes WHERE subscription_id = ? AND season = ?'
    ).all(subscription.id, targetSeason);

    console.log(`📊 series_episodes 表中的记录 (S${targetSeason}):`);
    if (seriesEpisodes.length === 0) {
        console.log('   (无记录)');
    } else {
        seriesEpisodes.forEach(ep => {
            console.log(`   - E${ep.episode}: ${ep.torrent_title} (${ep.download_time})`);
        });
    }
    console.log();

    // 4. 查询 task_history 表
    const historyItems = db.prepare(
        'SELECT item_title, item_guid, item_hash, download_time FROM task_history WHERE task_id = ?'
    ).all(TEST_TASK_ID);

    console.log(`📋 task_history 表中的记录:`);
    if (historyItems.length === 0) {
        console.log('   (无记录)');
    } else {
        historyItems.forEach(item => {
            const parsed = episodeParser.parse(item.item_title);
            const epInfo = parsed ? `S${parsed.season}E${parsed.episodes.join(',E')}` : '无法解析';
            console.log(`   - ${item.item_title}`);
            console.log(`     GUID: ${item.item_guid}, Hash: ${item.item_hash}`);
            console.log(`     剧集: ${epInfo}, 时间: ${item.download_time}`);
        });
    }
    console.log();

    // 5. 执行 EpisodeTracker 检查
    console.log('🔍 执行 EpisodeTracker.checkEpisodeExists():');
    const item = { title: TEST_ITEM_TITLE };
    const result = EpisodeTracker.checkEpisodeExists(item, TEST_TASK_ID, subscription, true);

    console.log();
    console.log('📈 检查结果:');
    console.log(`   - 候选剧集: S${result.candidateInfo.season}E${result.candidateInfo.episodes.join(',E')}`);
    console.log(`   - 已下载剧集: [${Array.from(result.downloadedEpisodes).sort((a, b) => a - b).join(', ')}]`);
    console.log(`   - 是否冗余 (应跳过): ${result.isRedundant ? '✅ 是' : '❌ 否'}`);
    console.log();

    // 6. 详细分析
    console.log('🔬 详细分析:');
    result.candidateInfo.episodes.forEach(ep => {
        const exists = result.downloadedEpisodes.has(ep);
        console.log(`   - E${ep}: ${exists ? '✅ 已存在' : '❌ 不存在'}`);
    });
    console.log();

    // 7. 结论
    console.log('='.repeat(80));
    if (result.isRedundant) {
        console.log('✅ 结论: 该资源应该被跳过（所有剧集都已下载）');
    } else {
        console.log('⚠️  结论: 该资源会被下载（有新剧集）');
        const newEpisodes = result.candidateInfo.episodes.filter(ep => !result.downloadedEpisodes.has(ep));
        console.log(`   新剧集: E${newEpisodes.join(', E')}`);
    }
    console.log('='.repeat(80));
}

debugEpisodeCheck().catch(err => {
    console.error('调试失败:', err);
    console.error(err.stack);
});

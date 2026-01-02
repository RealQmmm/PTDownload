/**
 * Test script for RSS Cache functionality
 * This simulates multiple RSS tasks hitting the same feed
 */

console.log('=== RSS 缓存功能测试 ===\n');

const RSSService = require('./src/services/rssService');

// Mock axios for testing
const axios = require('axios');
const originalGet = axios.get;
let requestCount = 0;

axios.get = async (url, config) => {
    requestCount++;
    console.log(`[Mock] HTTP Request #${requestCount} to ${url}`);

    // Simulate RSS response
    return {
        data: `<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Test RSS Feed</title>
        <item>
            <title>Test Item ${Date.now()}</title>
            <link>http://example.com/test</link>
            <guid>test-guid-${Date.now()}</guid>
        </item>
    </channel>
</rss>`
    };
};

async function runTest() {
    console.log('📝 测试场景: 5个任务在短时间内访问同一个 RSS 源\n');

    const rssUrl = 'https://example.com/rss.xml';
    const headers = { 'Cookie': 'test=cookie' };

    console.log('--- 第一轮: 初始请求 ---\n');

    // Task 1: First request (should fetch)
    console.log('任务 1 执行...');
    await RSSService.getRSSFeed(rssUrl, headers);
    console.log('');

    // Task 2: Immediate second request (should use cache)
    console.log('任务 2 执行 (立即)...');
    await RSSService.getRSSFeed(rssUrl, headers);
    console.log('');

    // Task 3: Third request after 1 second (should use cache)
    console.log('任务 3 执行 (1秒后)...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await RSSService.getRSSFeed(rssUrl, headers);
    console.log('');

    // Task 4: Fourth request after 2 seconds (should use cache)
    console.log('任务 4 执行 (2秒后)...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await RSSService.getRSSFeed(rssUrl, headers);
    console.log('');

    // Task 5: Fifth request after 3 seconds (should use cache)
    console.log('任务 5 执行 (3秒后)...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await RSSService.getRSSFeed(rssUrl, headers);
    console.log('');

    console.log('--- 测试结果 ---\n');
    console.log(`总请求次数: ${requestCount}`);
    console.log(`期望: 1 次 (其余 4 次使用缓存)`);

    if (requestCount === 1) {
        console.log('✅ 测试通过！缓存正常工作。');
        console.log('📊 性能提升: 减少了 80% 的 HTTP 请求');
    } else {
        console.log(`❌ 测试失败！实际请求了 ${requestCount} 次。`);
    }

    console.log('\n--- 缓存信息 ---');
    console.log(`缓存条目数: ${RSSService.rssCache.size}`);
    console.log(`缓存 TTL: ${RSSService.cacheTTL / 1000} 秒`);

    // Test cache expiration
    console.log('\n--- 第二轮: 测试缓存过期 ---\n');
    console.log('修改 TTL 为 2 秒...');
    RSSService.cacheTTL = 2000;

    console.log('等待 3 秒让缓存过期...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const beforeExpire = requestCount;
    console.log('任务 6 执行 (缓存已过期)...');
    await RSSService.getRSSFeed(rssUrl, headers);

    if (requestCount > beforeExpire) {
        console.log('✅ 缓存过期测试通过！过期后重新请求。');
    } else {
        console.log('❌ 缓存过期测试失败！');
    }

    console.log('\n--- 最终统计 ---');
    console.log(`总 HTTP 请求: ${requestCount} 次`);
    console.log(`总任务执行: 6 次`);
    console.log(`缓存命中率: ${((6 - requestCount) / 6 * 100).toFixed(1)}%`);

    // Restore axios
    axios.get = originalGet;
}

runTest().catch(err => {
    console.error('测试失败:', err);
    process.exit(1);
});

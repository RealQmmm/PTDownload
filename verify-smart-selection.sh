#!/bin/bash

echo "=== 智能文件选择功能验证 ==="
echo ""
echo "1️⃣ 检查新增文件是否存在..."
echo ""

# Check if fileSelector.js exists
if docker exec pt-app test -f /app/src/utils/fileSelector.js; then
    echo "✅ fileSelector.js 已创建"
    docker exec pt-app wc -l /app/src/utils/fileSelector.js
else
    echo "❌ fileSelector.js 不存在"
fi

echo ""
echo "2️⃣ 检查 downloaderService.js 是否包含 fileIndices 支持..."
echo ""

if docker exec pt-app grep -q "fileIndices" /app/src/services/downloaderService.js; then
    echo "✅ downloaderService.js 已更新"
    docker exec pt-app grep -n "fileIndices" /app/src/services/downloaderService.js | head -5
else
    echo "❌ downloaderService.js 未更新"
fi

echo ""
echo "3️⃣ 检查 rssService.js 是否集成文件选择..."
echo ""

if docker exec pt-app grep -q "fileSelector" /app/src/services/rssService.js; then
    echo "✅ rssService.js 已集成"
    docker exec pt-app grep -n "fileSelector" /app/src/services/rssService.js | head -3
else
    echo "❌ rssService.js 未集成"
fi

echo ""
echo "4️⃣ 检查容器运行状态..."
echo ""

if docker ps | grep -q pt-app; then
    echo "✅ 容器正在运行"
    docker ps --filter name=pt-app --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "❌ 容器未运行"
fi

echo ""
echo "5️⃣ 检查应用日志..."
echo ""

echo "最近的日志:"
docker logs pt-app --tail 20 2>&1 | grep -E "(Server|Error|RSS|File)" || echo "暂无相关日志"

echo ""
echo "✅ 验证完成！"
echo ""
echo "📝 功能说明:"
echo "  - 当 RSS 任务匹配到季包时，系统会自动解析文件列表"
echo "  - 对比已下载剧集，只选择包含新剧集的文件"
echo "  - 通过下载器 API 设置文件优先级"
echo ""
echo "🧪 测试建议:"
echo "  1. 创建一个追剧订阅"
echo "  2. 手动标记某些剧集为已下载（在数据库中）"
echo "  3. 触发 RSS 任务，观察日志中的文件选择信息"
echo "  4. 查看日志关键词: 'Smart file selection', 'files selected'"

#!/bin/bash

# 追剧周期功能移除验证脚本
# 此脚本用于验证所有与追剧周期相关的代码是否已被移除

echo "🔍 开始验证追剧周期功能移除情况..."
echo ""

# 检查后端代码
echo "📦 检查后端代码..."
echo ""

# 检查 seriesService.js
echo "1. 检查 seriesService.js 中是否还有 check_interval 相关代码..."
if grep -n "check_interval" server/src/services/seriesService.js 2>/dev/null; then
    echo "   ❌ 发现残留的 check_interval 代码"
else
    echo "   ✅ seriesService.js 已清理干净"
fi
echo ""

# 检查 rssService.js
echo "2. 检查 rssService.js 中是否还有 _shouldSkipTask 方法..."
if grep -n "_shouldSkipTask" server/src/services/rssService.js 2>/dev/null; then
    echo "   ❌ 发现残留的 _shouldSkipTask 代码"
else
    echo "   ✅ rssService.js 已清理干净"
fi
echo ""

# 检查前端代码
echo "📱 检查前端代码..."
echo ""

echo "3. 检查 SeriesPage.jsx 中是否还有 check_interval 相关代码..."
if grep -n "check_interval" client/src/pages/SeriesPage.jsx 2>/dev/null; then
    echo "   ❌ 发现残留的 check_interval 代码"
else
    echo "   ✅ SeriesPage.jsx 已清理干净"
fi
echo ""

# 检查数据库迁移脚本是否存在
echo "🗄️  检查数据库迁移脚本..."
echo ""

if [ -f "server/remove-check-interval.sql" ]; then
    echo "   ✅ 数据库迁移脚本已创建"
else
    echo "   ❌ 数据库迁移脚本不存在"
fi
echo ""

# 检查文档
echo "📝 检查文档..."
echo ""

if [ -f ".agent/追剧周期功能移除总结.md" ]; then
    echo "   ✅ 移除总结文档已创建"
else
    echo "   ❌ 移除总结文档不存在"
fi
echo ""

echo "✨ 验证完成！"
echo ""
echo "📋 下一步操作："
echo "   1. 重启开发服务器以应用代码更改"
echo "   2. 测试创建和编辑追剧订阅功能"
echo "   3. 可选：执行数据库迁移脚本清理 check_interval 字段"
echo ""

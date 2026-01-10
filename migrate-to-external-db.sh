#!/bin/bash

# PTDownload 数据库迁移脚本
# 用途：将内置数据库迁移到外部存储
# 作者：PTDownload Team
# 版本：1.0

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印标题
print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

# 检查参数
if [ $# -eq 0 ]; then
    print_error "缺少参数！"
    echo ""
    echo "用法: $0 <外部数据库目录路径>"
    echo ""
    echo "示例:"
    echo "  $0 /home/user/ptdb"
    echo "  $0 /mnt/nas/ptdownload/db"
    echo ""
    exit 1
fi

EXTERNAL_DB_DIR="$1"
INTERNAL_DB_PATH="./data/ptdownload.db"
BACKUP_SUFFIX=$(date +%Y%m%d_%H%M%S)

print_header "PTDownload 数据库迁移工具"

# 步骤 1: 检查当前环境
print_info "步骤 1/8: 检查当前环境..."

if [ ! -f "docker-compose.yml" ]; then
    print_error "未找到 docker-compose.yml 文件！"
    print_error "请在 PTDownload 项目根目录运行此脚本。"
    exit 1
fi

if [ ! -f "$INTERNAL_DB_PATH" ]; then
    print_error "未找到内置数据库文件: $INTERNAL_DB_PATH"
    print_error "请确保已经运行过 PTDownload 并生成了数据库。"
    exit 1
fi

DB_SIZE=$(du -h "$INTERNAL_DB_PATH" | cut -f1)
print_success "找到内置数据库: $INTERNAL_DB_PATH (大小: $DB_SIZE)"

# 步骤 2: 停止容器
print_info "步骤 2/8: 停止 Docker 容器..."
if docker-compose ps | grep -q "pt-app"; then
    docker-compose down
    print_success "容器已停止"
else
    print_warning "容器未运行，跳过停止步骤"
fi

# 步骤 3: 创建外部目录
print_info "步骤 3/8: 创建外部数据库目录..."
if [ ! -d "$EXTERNAL_DB_DIR" ]; then
    mkdir -p "$EXTERNAL_DB_DIR"
    print_success "已创建目录: $EXTERNAL_DB_DIR"
else
    print_warning "目录已存在: $EXTERNAL_DB_DIR"
fi

# 步骤 4: 备份原数据库
print_info "步骤 4/8: 备份原数据库..."
BACKUP_PATH="./data/ptdownload.db.backup.$BACKUP_SUFFIX"
cp "$INTERNAL_DB_PATH" "$BACKUP_PATH"
print_success "已备份到: $BACKUP_PATH"

# 步骤 5: 复制数据库到外部目录
print_info "步骤 5/8: 复制数据库到外部目录..."
cp "$INTERNAL_DB_PATH" "$EXTERNAL_DB_DIR/ptdownload.db"

# 验证复制
if [ -f "$EXTERNAL_DB_DIR/ptdownload.db" ]; then
    EXTERNAL_DB_SIZE=$(du -h "$EXTERNAL_DB_DIR/ptdownload.db" | cut -f1)
    print_success "数据库已复制到: $EXTERNAL_DB_DIR/ptdownload.db (大小: $EXTERNAL_DB_SIZE)"
else
    print_error "复制失败！"
    exit 1
fi

# 步骤 6: 备份 docker-compose.yml
print_info "步骤 6/8: 备份 docker-compose.yml..."
cp docker-compose.yml "docker-compose.yml.backup.$BACKUP_SUFFIX"
print_success "已备份到: docker-compose.yml.backup.$BACKUP_SUFFIX"

# 步骤 7: 更新 docker-compose.yml
print_info "步骤 7/8: 更新 docker-compose.yml..."

# 检查是否已经配置了外部数据库
if grep -q "USE_EXTERNAL_DB=true" docker-compose.yml; then
    print_warning "docker-compose.yml 已配置外部数据库，跳过更新"
else
    # 使用 sed 更新配置
    # 1. 取消外部数据库挂载的注释
    sed -i.tmp "s|# - /path/to/your/external/db:/external_db|- $EXTERNAL_DB_DIR:/external_db|g" docker-compose.yml
    
    # 2. 设置 USE_EXTERNAL_DB=true
    sed -i.tmp "s|USE_EXTERNAL_DB=false|USE_EXTERNAL_DB=true|g" docker-compose.yml
    
    # 删除临时文件
    rm -f docker-compose.yml.tmp
    
    print_success "docker-compose.yml 已更新"
fi

# 步骤 8: 启动容器
print_info "步骤 8/8: 启动容器..."
docker-compose up -d

# 等待容器启动
print_info "等待容器启动..."
sleep 5

# 验证迁移
print_header "验证迁移结果"

print_info "检查容器状态..."
if docker-compose ps | grep -q "pt-app"; then
    print_success "容器正在运行"
else
    print_error "容器未运行！请检查日志: docker logs pt-app"
    exit 1
fi

print_info "检查数据库路径..."
if docker logs pt-app 2>&1 | grep -q "Using EXTERNAL database"; then
    DB_PATH=$(docker logs pt-app 2>&1 | grep "Using EXTERNAL database" | tail -1)
    print_success "$DB_PATH"
else
    print_warning "未找到外部数据库日志，请手动检查: docker logs pt-app | grep Database"
fi

# 完成
print_header "迁移完成！"

echo "✅ 数据库已成功迁移到外部存储"
echo ""
echo "📁 外部数据库位置: $EXTERNAL_DB_DIR/ptdownload.db"
echo "💾 备份文件位置: $BACKUP_PATH"
echo "📝 配置备份位置: docker-compose.yml.backup.$BACKUP_SUFFIX"
echo ""
echo "🔍 验证步骤:"
echo "  1. 访问 http://localhost:3000"
echo "  2. 检查站点配置是否完整"
echo "  3. 检查 RSS 任务是否存在"
echo "  4. 检查历史记录是否保留"
echo ""
echo "📚 如需回滚，请运行:"
echo "  docker-compose down"
echo "  cp docker-compose.yml.backup.$BACKUP_SUFFIX docker-compose.yml"
echo "  docker-compose up -d"
echo ""
print_success "迁移完成！"

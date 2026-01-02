# 剧集文件统一管理方案

## 问题描述
剧集下载后，每一集都是单独的一个文件夹，导致文件散乱。需要将同一剧集的所有文件统一放到该剧集名字的总文件夹下进行管理。

**当前情况** ❌:
```
/downloads/
  ├─ Game.of.Thrones.S08E01.1080p/
  │   └─ Game.of.Thrones.S08E01.1080p.mkv
  ├─ Game.of.Thrones.S08E02.1080p/
  │   └─ Game.of.Thrones.S08E02.1080p.mkv
  └─ Game.of.Thrones.S08E03.1080p/
      └─ Game.of.Thrones.S08E03.1080p.mkv
```

**期望结果** ✅:
```
/downloads/Game.of.Thrones.S08/
  ├─ Game.of.Thrones.S08E01.1080p.mkv
  ├─ Game.of.Thrones.S08E02.1080p.mkv
  └─ Game.of.Thrones.S08E03.1080p.mkv
```

---

## 解决方案

### 方案1: 使用下载器的分类功能（推荐）⭐

#### qBittorrent 设置

**原理**: qBittorrent 的分类（Category）功能会自动创建子文件夹。

##### 步骤1: 在PTDownload中设置分类

创建RSS任务时：
```
任务名称: [追剧] 权力的游戏 S08
分类 (Category): Series  或  Game.of.Thrones.S08
保存路径: /downloads
```

##### 步骤2: qBittorrent 自动处理

qBittorrent 会自动创建：
```
/downloads/Series/
  ├─ Game.of.Thrones.S08E01.1080p.mkv
  ├─ Game.of.Thrones.S08E02.1080p.mkv
  └─ Game.of.Thrones.S08E03.1080p.mkv
```

或者使用剧集名作为分类：
```
/downloads/Game.of.Thrones.S08/
  ├─ Game.of.Thrones.S08E01.1080p.mkv
  ├─ Game.of.Thrones.S08E02.1080p.mkv
  └─ Game.of.Thrones.S08E03.1080p.mkv
```

**优点**:
- ✅ 自动化，无需手动操作
- ✅ 所有剧集统一管理
- ✅ 支持多个剧集同时管理

**缺点**:
- ⚠️ 需要为每个剧集设置不同的分类

---

### 方案2: 使用保存路径（简单但不灵活）

#### 直接设置保存路径

创建RSS任务时：
```
任务名称: [追剧] 权力的游戏 S08
分类 (Category): Series
保存路径: /downloads/Game.of.Thrones.S08
```

**结果**:
```
/downloads/Game.of.Thrones.S08/
  ├─ Game.of.Thrones.S08E01.1080p/
  │   └─ Game.of.Thrones.S08E01.1080p.mkv
  ├─ Game.of.Thrones.S08E02.1080p/
  │   └─ Game.of.Thrones.S08E02.1080p.mkv
  └─ Game.of.Thrones.S08E03.1080p/
      └─ Game.of.Thrones.S08E03.1080p.mkv
```

**问题**:
- ❌ 每一集仍然是单独的文件夹
- ❌ 需要手动整理

**优点**:
- ✅ 至少所有剧集在同一个父文件夹下

---

### 方案3: 结合分类和保存路径（最佳方案）⭐⭐⭐

#### 设置方法

创建RSS任务时：
```
任务名称: [追剧] 权力的游戏 S08
分类 (Category): Game.of.Thrones.S08
保存路径: /downloads/series
```

#### qBittorrent 配置

1. 打开 qBittorrent Web UI
2. 工具 → 选项 → 下载
3. 设置：
   - ✅ "为分类创建子文件夹"
   - ✅ "保持未完成的种子在单独的文件夹"（可选）

**结果**:
```
/downloads/series/Game.of.Thrones.S08/
  ├─ Game.of.Thrones.S08E01.1080p.mkv
  ├─ Game.of.Thrones.S08E02.1080p.mkv
  └─ Game.of.Thrones.S08E03.1080p.mkv
```

**优点**:
- ✅ 完美的文件组织结构
- ✅ 自动化管理
- ✅ 支持多个剧集
- ✅ 易于维护

---

## 实施步骤

### 步骤1: 配置qBittorrent

#### 通过Web UI配置

1. 打开 qBittorrent Web UI (http://localhost:8080)
2. 点击右上角的 ⚙️ 设置图标
3. 选择"下载"标签
4. 找到"保存管理"部分
5. 勾选以下选项：
   - ✅ **为分类创建子文件夹**
   - ✅ **保持未完成的种子在单独的文件夹** (可选)
6. 点击"保存"

#### 通过配置文件（高级）

编辑 `qBittorrent.conf`:
```ini
[Preferences]
Downloads\SavePath=/downloads
Downloads\TempPath=/downloads/incomplete
Downloads\CreateTorrentSubfolder=true
Downloads\UseIncompleteExtension=true
```

---

### 步骤2: 在PTDownload中创建任务

#### 方法A: 使用预定义路径（推荐）

1. 打开"自动任务"页面
2. 点击保存路径旁的 ⚙️ 按钮
3. 添加新路径：
   ```
   名称: 剧集
   路径: /downloads/series
   描述: 电视剧集下载目录
   ```
4. 创建RSS任务时：
   ```
   任务名称: [追剧] 权力的游戏 S08
   分类: Game.of.Thrones.S08
   保存路径: 剧集 (/downloads/series)
   ```

#### 方法B: 使用追剧功能

1. 打开"追剧"页面
2. 创建新订阅：
   ```
   剧集名称: Game of Thrones
   季数: 08
   质量: 1080p
   保存路径: /downloads/series
   分类: Game.of.Thrones.S08
   ```

---

### 步骤3: 验证设置

1. 等待RSS任务执行
2. 检查下载器中的种子
3. 确认文件保存位置：
   ```
   /downloads/series/Game.of.Thrones.S08/
     └─ Game.of.Thrones.S08E01.1080p.mkv
   ```

---

## 不同下载器的配置

### qBittorrent ✅

**分类支持**: ✅ 完全支持  
**自动创建子文件夹**: ✅ 支持

**配置**:
```
设置 → 下载 → 为分类创建子文件夹 ✅
```

**效果**:
```
保存路径: /downloads/series
分类: Game.of.Thrones.S08
→ 实际路径: /downloads/series/Game.of.Thrones.S08/
```

---

### Transmission ⚠️

**分类支持**: ❌ 不支持分类  
**自动创建子文件夹**: ❌ 不支持

**解决方案**:
只能通过设置不同的保存路径：
```
保存路径: /downloads/series/Game.of.Thrones.S08
```

**缺点**:
- ❌ 每一集仍然是单独的文件夹
- ❌ 需要手动整理

---

## 文件组织最佳实践

### 推荐的目录结构

```
/downloads/
  ├─ movies/              # 电影
  │   ├─ Avatar.3.2024/
  │   └─ Dune.2.2024/
  │
  ├─ series/              # 剧集
  │   ├─ Game.of.Thrones.S08/
  │   │   ├─ S08E01.mkv
  │   │   ├─ S08E02.mkv
  │   │   └─ S08E03.mkv
  │   │
  │   └─ Breaking.Bad.S05/
  │       ├─ S05E01.mkv
  │       └─ S05E02.mkv
  │
  ├─ anime/               # 动画
  │   └─ One.Piece/
  │
  └─ music/               # 音乐
      └─ Taylor.Swift/
```

---

### 分类命名规范

#### 剧集分类
```
格式: 剧名.季数
示例: 
  - Game.of.Thrones.S08
  - Breaking.Bad.S05
  - The.Mandalorian.S03
```

#### 电影分类
```
格式: Movies 或 电影
示例:
  - Movies
  - 电影
```

#### 动画分类
```
格式: 动画名 或 Anime
示例:
  - One.Piece
  - Anime
```

---

## PTDownload 配置示例

### 示例1: 权力的游戏 S08

```javascript
// RSS任务配置
{
  "name": "[追剧] 权力的游戏 S08",
  "type": "rss",
  "cron": "*/30 * * * *",
  "site_id": 1,
  "rss_url": "https://example.com/rss",
  "filter_config": {
    "keywords": "Game.of.Thrones.S08,1080p",
    "exclude": "720p,480p"
  },
  "client_id": 1,
  "save_path": "/downloads/series",
  "category": "Game.of.Thrones.S08",  // ⭐ 关键设置
  "enabled": 1,
  "auto_disable_on_match": 0
}
```

**结果**:
```
/downloads/series/Game.of.Thrones.S08/
  ├─ Game.of.Thrones.S08E01.1080p.mkv
  ├─ Game.of.Thrones.S08E02.1080p.mkv
  └─ ...
```

---

### 示例2: 多个剧集同时管理

```javascript
// 权力的游戏 S08
{
  "category": "Game.of.Thrones.S08",
  "save_path": "/downloads/series"
}

// 绝命毒师 S05
{
  "category": "Breaking.Bad.S05",
  "save_path": "/downloads/series"
}

// 曼达洛人 S03
{
  "category": "The.Mandalorian.S03",
  "save_path": "/downloads/series"
}
```

**结果**:
```
/downloads/series/
  ├─ Game.of.Thrones.S08/
  │   ├─ S08E01.mkv
  │   └─ S08E02.mkv
  ├─ Breaking.Bad.S05/
  │   ├─ S05E01.mkv
  │   └─ S05E02.mkv
  └─ The.Mandalorian.S03/
      ├─ S03E01.mkv
      └─ S03E02.mkv
```

---

## 常见问题

### Q1: 已经下载的文件如何整理？

**A**: 手动移动或使用脚本

#### 手动移动
```bash
# 创建目标文件夹
mkdir -p /downloads/series/Game.of.Thrones.S08

# 移动所有剧集文件
mv /downloads/Game.of.Thrones.S08E*/*.mkv /downloads/series/Game.of.Thrones.S08/

# 删除空文件夹
rm -rf /downloads/Game.of.Thrones.S08E*
```

#### 使用脚本（批量整理）
```bash
#!/bin/bash
# organize_series.sh

SERIES_NAME="Game.of.Thrones.S08"
SOURCE_DIR="/downloads"
TARGET_DIR="/downloads/series/$SERIES_NAME"

# 创建目标目录
mkdir -p "$TARGET_DIR"

# 查找并移动所有匹配的视频文件
find "$SOURCE_DIR" -maxdepth 2 -name "${SERIES_NAME}E*.mkv" -exec mv {} "$TARGET_DIR/" \;

# 删除空文件夹
find "$SOURCE_DIR" -maxdepth 1 -type d -empty -delete

echo "整理完成！"
```

---

### Q2: 分类名称可以包含中文吗？

**A**: 可以，但建议使用英文

**支持**:
- ✅ qBittorrent: 支持中文分类
- ⚠️ Transmission: 不支持分类

**建议**:
```
推荐: Game.of.Thrones.S08
可以: 权力的游戏.S08
不推荐: 权力的游戏 第八季
```

---

### Q3: 如何批量修改现有任务的分类？

**A**: 通过API或前端逐个修改

#### 方法1: 前端修改
1. 打开"自动任务"页面
2. 点击任务的"编辑"按钮
3. 修改"分类"字段
4. 保存

#### 方法2: 数据库批量修改
```sql
-- 更新所有权力的游戏任务的分类
UPDATE tasks 
SET category = 'Game.of.Thrones.S08' 
WHERE name LIKE '%权力的游戏%' AND name LIKE '%S08%';
```

---

### Q4: 分类和保存路径的优先级？

**A**: 两者结合使用

**qBittorrent 的路径计算**:
```
最终路径 = 保存路径 + 分类名称

示例:
  保存路径: /downloads/series
  分类: Game.of.Thrones.S08
  → 最终路径: /downloads/series/Game.of.Thrones.S08/
```

---

## 总结

### 最佳方案 ⭐⭐⭐

1. **qBittorrent 设置**:
   - ✅ 启用"为分类创建子文件夹"

2. **PTDownload 任务配置**:
   - ✅ 保存路径: `/downloads/series`
   - ✅ 分类: `剧名.季数` (如 `Game.of.Thrones.S08`)

3. **结果**:
   ```
   /downloads/series/Game.of.Thrones.S08/
     ├─ S08E01.mkv
     ├─ S08E02.mkv
     └─ S08E03.mkv
   ```

### 关键要点

| 设置项 | 值 | 说明 |
|--------|-----|------|
| **保存路径** | `/downloads/series` | 剧集总目录 |
| **分类** | `剧名.季数` | 自动创建子文件夹 |
| **qBittorrent** | 启用分类子文件夹 | 关键设置 ⭐ |

**现在你的剧集文件会自动整理到统一的文件夹下！** 📁✨

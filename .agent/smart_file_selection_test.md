# 智能文件选择功能 - 测试指南

## ✅ 部署验证

所有核心组件已成功部署到容器：

- ✅ `fileSelector.js` (77 行) - 文件选择工具
- ✅ `downloaderService.js` - 支持 fileIndices 参数
- ✅ `rssService.js` - 集成文件选择逻辑
- ✅ 容器运行正常 (端口 3000)

## 🧪 功能测试步骤

### 测试场景 1: 基础文件选择

**目标**: 验证系统能正确识别并跳过已下载的剧集

**步骤**:

1. **创建追剧订阅**
   - 进入"我的追剧"页面
   - 添加一个剧集订阅（例如：某剧 S01）
   - 设置 RSS 链接和匹配规则

2. **模拟已下载剧集**
   ```sql
   -- 在数据库中插入已下载记录
   INSERT INTO task_history (task_id, item_guid, item_title, item_size, download_time)
   VALUES (
       1,  -- 你的任务 ID
       'unique-guid-001',
       'Series.Name.S01E01.1080p.mkv',
       1073741824,
       datetime('now')
   );
   ```

3. **准备测试种子**
   - 确保 RSS 源中有包含 S01E01-E03 的种子
   - 种子应该是多文件格式（不是单文件打包）

4. **触发 RSS 任务**
   - 手动执行 RSS 任务
   - 或等待定时任务触发

5. **观察日志**
   ```bash
   docker logs -f pt-app | grep -E "(RSS|Smart|file)"
   ```

**期望结果**:
```
[RSS] Match found: Series.Name.S01E01-E03.1080p. Adding to downloader...
[RSS] Smart file selection: 2/3 files selected for Series.Name.S01E01-E03.1080p
[qBittorrent] Set file priorities for abc123: downloading 2/3 files
[RSS] Successfully added: Series.Name.S01E01-E03.1080p (2 files selected)
```

### 测试场景 2: 全部已下载

**目标**: 验证当所有剧集都已下载时，系统会跳过整个种子

**步骤**:

1. 在数据库中标记 E01-E03 都已下载
2. RSS 任务匹配到 S01E01-E03 的种子
3. 观察日志

**期望结果**:
```
[RSS] Match found: Series.Name.S01E01-E03.1080p. Adding to downloader...
[RSS] All files in Series.Name.S01E01-E03.1080p already downloaded. Skipping.
匹配到资源但已存在: Series.Name.S01E01-E03.1080p (原因: 所有文件已下载)
```

### 测试场景 3: 季包智能选择

**目标**: 验证季包场景下的文件选择

**步骤**:

1. 已下载 E01-E05
2. RSS 匹配到完整季包 S01E01-E10
3. 观察是否只下载 E06-E10

**期望结果**:
```
[RSS] Smart file selection: 5/10 files selected for Series.S01.Complete.1080p
```

## 📊 验证检查清单

- [ ] 文件选择逻辑正确（只选择新剧集）
- [ ] 下载器正确接收文件索引
- [ ] 日志输出清晰易懂
- [ ] 已下载剧集不会重复下载
- [ ] NFO/字幕等辅助文件正常下载
- [ ] 不同季度的剧集不会互相影响
- [ ] Magnet 链接回退到原有逻辑
- [ ] 解析失败时回退到完整下载

## 🔍 调试技巧

### 查看实时日志
```bash
# 查看所有日志
docker logs -f pt-app

# 只看 RSS 相关
docker logs -f pt-app 2>&1 | grep RSS

# 只看文件选择相关
docker logs -f pt-app 2>&1 | grep -E "(Smart|file|priority)"
```

### 检查数据库状态
```bash
# 进入容器
docker exec -it pt-app sh

# 查看任务历史
sqlite3 /app/data/pt-manager.db "SELECT * FROM task_history WHERE task_id = 1;"

# 查看剧集记录
sqlite3 /app/data/pt-manager.db "SELECT * FROM series_episodes WHERE subscription_id = 1;"
```

### 手动触发 RSS 任务
在"自动任务"页面，找到对应的 RSS 任务，点击"立即执行"按钮。

## 🐛 常见问题

### Q: 日志中没有 "Smart file selection" 信息
**A**: 可能原因：
- 种子是单文件（不是多文件季包）
- 种子标题无法解析剧集信息
- 没有历史下载记录
- 使用的是 Magnet 链接

### Q: 所有文件都被下载了
**A**: 检查：
- 文件名是否包含可识别的剧集信息
- 季度是否匹配
- 下载器 API 是否返回错误

### Q: 下载器报错
**A**: 确认：
- qBittorrent/Transmission 版本是否支持文件优先级 API
- 网络连接是否正常
- Cookie 是否有效

## 📈 性能影响

- **额外时间**: 每个种子约 500-1000ms（解析 + API 调用）
- **内存占用**: 种子文件临时加载（通常 < 1MB）
- **API 调用**: qBittorrent 额外 2 次，Transmission 0 次

## 🎯 成功标准

1. ✅ 已下载的剧集不会重复下载
2. ✅ 新剧集能正常下载
3. ✅ 日志清晰显示文件选择过程
4. ✅ 下载器中只有选中的文件在下载
5. ✅ 任务历史正确记录

---

**测试完成后，请在此记录结果：**

- 测试日期: ___________
- 测试人: ___________
- 测试结果: [ ] 通过 [ ] 失败
- 备注: ___________

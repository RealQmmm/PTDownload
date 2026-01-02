/**
 * Test script for Smart File Selection feature
 * This tests the fileSelector utility and episode parser
 */

const episodeParser = require('../src/utils/episodeParser');
const fileSelector = require('../src/utils/fileSelector');

console.log('=== 智能文件选择功能测试 ===\n');

// Test 1: Episode Parser
console.log('📝 测试 1: 剧集解析器');
console.log('---');

const testTitles = [
    'Series.Name.S01E01.1080p.mkv',
    'Series.Name.S01E01-E03.1080p.mkv',
    '[Group] Series S01E05 [1080p].mkv',
    'Series.1x01.Title.mkv',
    'Series.Name.S01.Complete.1080p',
    'Random.File.Without.Episodes.mkv'
];

testTitles.forEach(title => {
    const result = episodeParser.parse(title);
    console.log(`输入: ${title}`);
    console.log(`结果: ${JSON.stringify(result)}\n`);
});

// Test 2: File Selector - Basic scenario
console.log('\n📁 测试 2: 文件选择器 - 基础场景');
console.log('---');
console.log('场景: 已下载 E01, 新种子包含 E01-E03\n');

const torrentFiles = [
    { name: 'Series.S01E01.1080p.mkv', size: 1000000000 },
    { name: 'Series.S01E02.1080p.mkv', size: 1000000000 },
    { name: 'Series.S01E03.1080p.mkv', size: 1000000000 },
    { name: 'Series.S01.nfo', size: 5000 }
];

const downloadedEpisodes = [1];
const targetSeason = 1;

const selectedIndices = fileSelector.selectFiles(torrentFiles, downloadedEpisodes, targetSeason);
console.log('种子文件:');
torrentFiles.forEach((file, idx) => {
    const selected = selectedIndices.includes(idx) ? '✅' : '❌';
    console.log(`  ${selected} [${idx}] ${file.name}`);
});
console.log(`\n选择结果: ${selectedIndices.length}/${torrentFiles.length} 个文件`);
console.log(`文件索引: [${selectedIndices.join(', ')}]`);

// Test 3: File Selector - All downloaded
console.log('\n\n📁 测试 3: 文件选择器 - 全部已下载');
console.log('---');
console.log('场景: 已下载 E01-E03, 新种子包含 E01-E03\n');

const downloadedEpisodes2 = [1, 2, 3];
const selectedIndices2 = fileSelector.selectFiles(torrentFiles, downloadedEpisodes2, targetSeason);

console.log('种子文件:');
torrentFiles.forEach((file, idx) => {
    const selected = selectedIndices2.includes(idx) ? '✅' : '❌';
    console.log(`  ${selected} [${idx}] ${file.name}`);
});
console.log(`\n选择结果: ${selectedIndices2.length}/${torrentFiles.length} 个文件`);
console.log(`文件索引: [${selectedIndices2.join(', ')}]`);

const hasNew = fileSelector.hasNewEpisodes(torrentFiles, downloadedEpisodes2, targetSeason);
console.log(`包含新剧集: ${hasNew ? '是' : '否'}`);

// Test 4: File Selector - Season Pack
console.log('\n\n📁 测试 4: 文件选择器 - 季包场景');
console.log('---');
console.log('场景: 已下载 E01-E05, 新季包包含 E01-E10\n');

const seasonPackFiles = [
    { name: 'Series.S01E01.mkv', size: 1000000000 },
    { name: 'Series.S01E02.mkv', size: 1000000000 },
    { name: 'Series.S01E03.mkv', size: 1000000000 },
    { name: 'Series.S01E04.mkv', size: 1000000000 },
    { name: 'Series.S01E05.mkv', size: 1000000000 },
    { name: 'Series.S01E06.mkv', size: 1000000000 },
    { name: 'Series.S01E07.mkv', size: 1000000000 },
    { name: 'Series.S01E08.mkv', size: 1000000000 },
    { name: 'Series.S01E09.mkv', size: 1000000000 },
    { name: 'Series.S01E10.mkv', size: 1000000000 },
    { name: 'Subs/English.srt', size: 50000 },
    { name: 'Series.S01.nfo', size: 5000 }
];

const downloadedEpisodes3 = [1, 2, 3, 4, 5];
const selectedIndices3 = fileSelector.selectFiles(seasonPackFiles, downloadedEpisodes3, targetSeason);

console.log('种子文件:');
seasonPackFiles.forEach((file, idx) => {
    const selected = selectedIndices3.includes(idx) ? '✅' : '❌';
    const info = episodeParser.parse(file.name);
    const epInfo = info && info.episodes.length > 0 ? ` (E${info.episodes.join(',')})` : '';
    console.log(`  ${selected} [${idx}] ${file.name}${epInfo}`);
});
console.log(`\n选择结果: ${selectedIndices3.length}/${seasonPackFiles.length} 个文件`);
console.log(`文件索引: [${selectedIndices3.join(', ')}]`);

// Test 5: Different season
console.log('\n\n📁 测试 5: 文件选择器 - 不同季度');
console.log('---');
console.log('场景: 已下载 S01E01, 新种子是 S02E01\n');

const s2Files = [
    { name: 'Series.S02E01.mkv', size: 1000000000 },
    { name: 'Series.S02E02.mkv', size: 1000000000 }
];

const downloadedS1 = [1];
const selectedS2 = fileSelector.selectFiles(s2Files, downloadedS1, 2);

console.log('种子文件:');
s2Files.forEach((file, idx) => {
    const selected = selectedS2.includes(idx) ? '✅' : '❌';
    console.log(`  ${selected} [${idx}] ${file.name}`);
});
console.log(`\n选择结果: ${selectedS2.length}/${s2Files.length} 个文件`);
console.log('说明: 不同季度，应该全部下载');

console.log('\n\n✅ 测试完成！');
console.log('\n💡 提示:');
console.log('  - ✅ 表示该文件会被下载');
console.log('  - ❌ 表示该文件会被跳过');
console.log('  - NFO/字幕等无法识别剧集的文件默认下载');

/**
 * Unit test for Smart File Selection
 * Run this inside the container to verify the logic
 */

console.log('=== 智能文件选择功能测试 ===\n');

// Test Episode Parser
console.log('📝 测试 1: 剧集解析器');
console.log('---');

const episodeParser = require('./src/utils/episodeParser');

const testCases = [
    { input: 'Series.Name.S01E01.1080p.mkv', expected: { season: 1, episodes: [1] } },
    { input: 'Series.Name.S01E01-E03.1080p.mkv', expected: { season: 1, episodes: [1, 2, 3] } },
    { input: '[Group] Series S01E05 [1080p].mkv', expected: { season: 1, episodes: [5] } },
    { input: 'Series.S01E10-E12.mkv', expected: { season: 1, episodes: [10, 11, 12] } },
    { input: 'Series.1x01.Title.mkv', expected: { season: 1, episodes: [1] } },
    { input: 'Random.File.mkv', expected: null }
];

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
    const result = episodeParser.parse(test.input);
    const match = JSON.stringify(result) === JSON.stringify(test.expected);

    if (match) {
        console.log(`✅ 测试 ${idx + 1}: ${test.input}`);
        console.log(`   结果: ${JSON.stringify(result)}`);
        passed++;
    } else {
        console.log(`❌ 测试 ${idx + 1}: ${test.input}`);
        console.log(`   期望: ${JSON.stringify(test.expected)}`);
        console.log(`   实际: ${JSON.stringify(result)}`);
        failed++;
    }
});

console.log(`\n解析器测试: ${passed} 通过, ${failed} 失败\n`);

// Test File Selector
console.log('📁 测试 2: 文件选择器');
console.log('---');

const fileSelector = require('./src/utils/fileSelector');

// Scenario 1: Basic selection
console.log('\n场景 1: 已下载 E01, 种子包含 E01-E03');
const files1 = [
    { name: 'Series.S01E01.mkv', size: 1000000000 },
    { name: 'Series.S01E02.mkv', size: 1000000000 },
    { name: 'Series.S01E03.mkv', size: 1000000000 },
    { name: 'Series.S01.nfo', size: 5000 }
];

const downloaded1 = [1];
const selected1 = fileSelector.selectFiles(files1, downloaded1, 1);

console.log('文件列表:');
files1.forEach((file, idx) => {
    const mark = selected1.includes(idx) ? '✅' : '❌';
    console.log(`  ${mark} [${idx}] ${file.name}`);
});
console.log(`选择: ${selected1.length}/${files1.length} 个文件`);

const expected1 = [1, 2, 3]; // E02, E03, NFO
const test1Pass = JSON.stringify(selected1.sort()) === JSON.stringify(expected1.sort());
console.log(test1Pass ? '✅ 场景 1 通过' : `❌ 场景 1 失败 (期望: [${expected1}], 实际: [${selected1}])`);

// Scenario 2: All downloaded
console.log('\n场景 2: 已下载 E01-E03, 种子包含 E01-E03');
const downloaded2 = [1, 2, 3];
const selected2 = fileSelector.selectFiles(files1, downloaded2, 1);

console.log('文件列表:');
files1.forEach((file, idx) => {
    const mark = selected2.includes(idx) ? '✅' : '❌';
    console.log(`  ${mark} [${idx}] ${file.name}`);
});
console.log(`选择: ${selected2.length}/${files1.length} 个文件`);

const hasNew2 = fileSelector.hasNewEpisodes(files1, downloaded2, 1);
console.log(`包含新剧集: ${hasNew2 ? '是' : '否'}`);
console.log(hasNew2 === false ? '✅ 场景 2 通过' : '❌ 场景 2 失败');

// Scenario 3: Season pack
console.log('\n场景 3: 已下载 E01-E05, 季包包含 E01-E10');
const seasonPack = [
    { name: 'Series.S01E01.mkv', size: 1000000000 },
    { name: 'Series.S01E02.mkv', size: 1000000000 },
    { name: 'Series.S01E03.mkv', size: 1000000000 },
    { name: 'Series.S01E04.mkv', size: 1000000000 },
    { name: 'Series.S01E05.mkv', size: 1000000000 },
    { name: 'Series.S01E06.mkv', size: 1000000000 },
    { name: 'Series.S01E07.mkv', size: 1000000000 },
    { name: 'Series.S01E08.mkv', size: 1000000000 },
    { name: 'Series.S01E09.mkv', size: 1000000000 },
    { name: 'Series.S01E10.mkv', size: 1000000000 }
];

const downloaded3 = [1, 2, 3, 4, 5];
const selected3 = fileSelector.selectFiles(seasonPack, downloaded3, 1);

console.log(`选择: ${selected3.length}/${seasonPack.length} 个文件`);
console.log(`选中的文件: [${selected3.join(', ')}]`);

const expected3 = [5, 6, 7, 8, 9]; // E06-E10
const test3Pass = JSON.stringify(selected3.sort()) === JSON.stringify(expected3.sort());
console.log(test3Pass ? '✅ 场景 3 通过' : `❌ 场景 3 失败 (期望: [${expected3}], 实际: [${selected3}])`);

// Scenario 4: Different season - no downloads for S02 yet
console.log('\n场景 4: S02 无下载记录, 种子是 S02E01-E02');
const s2Files = [
    { name: 'Series.S02E01.mkv', size: 1000000000 },
    { name: 'Series.S02E02.mkv', size: 1000000000 }
];

const downloadedS2 = []; // No downloads for S02 yet
const selectedS2 = fileSelector.selectFiles(s2Files, downloadedS2, 2);

console.log(`选择: ${selectedS2.length}/${s2Files.length} 个文件`);
const test4Pass = selectedS2.length === 2; // Should select all (no history)
console.log(test4Pass ? '✅ 场景 4 通过 (无下载历史，全部下载)' : '❌ 场景 4 失败');

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 测试总结');
console.log('='.repeat(50));

const allTests = [test1Pass, !hasNew2, test3Pass, test4Pass];
const totalPassed = allTests.filter(t => t).length;
const totalTests = allTests.length;

console.log(`\n解析器: ${passed}/${testCases.length} 通过`);
console.log(`文件选择器: ${totalPassed}/${totalTests} 场景通过`);

if (totalPassed === totalTests && passed === testCases.length) {
    console.log('\n✅ 所有测试通过！功能正常工作。');
    process.exit(0);
} else {
    console.log('\n❌ 部分测试失败，请检查代码。');
    process.exit(1);
}

// Test script for series subfolder feature
const episodeParser = require('./server/src/utils/episodeParser');

console.log('=== Testing Series Subfolder Feature ===\n');

const testCases = [
    {
        title: 'The.Last.of.Us.S01E05.2023.2160p.WEB-DL.DDP5.1.Atmos.H.265',
        expected: { hasSeason: true, seriesName: 'The Last of Us' }
    },
    {
        title: 'Planet.Earth.II.S01E01.2016.2160p.BluRay.mkv',
        expected: { hasSeason: true, seriesName: 'Planet Earth II' }
    },
    {
        title: 'Running.Man.E680.2024.1080p.WEB-DL.H264.AAC',
        expected: { hasSeason: false, seriesName: 'Running Man' }
    },
    {
        title: 'Avatar.The.Way.of.Water.2022.2160p.BluRay.REMUX.mkv',
        expected: { hasSeason: false, seriesName: 'Avatar The Way of Water' }
    },
    {
        title: 'Slow.Road.to.Hainan.2025.S01.Complete.2160p.WEB-DL.H264.AAC-UBWEB',
        expected: { hasSeason: true, seriesName: 'Slow Road to Hainan' }
    },
    {
        title: 'The.Mandalorian.Season.3.2023.2160p.WEB-DL',
        expected: { hasSeason: true, seriesName: 'The Mandalorian' }
    }
];

testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.title}`);

    const hasSeason = episodeParser.hasSeasonIdentifier(test.title);
    const seriesName = episodeParser.extractSeriesName(test.title);

    console.log(`  Has Season: ${hasSeason} (expected: ${test.expected.hasSeason})`);
    console.log(`  Series Name: "${seriesName}" (expected: "${test.expected.seriesName}")`);

    const seasonMatch = hasSeason === test.expected.hasSeason ? '✅' : '❌';
    const nameMatch = seriesName.toLowerCase().includes(test.expected.seriesName.toLowerCase()) ? '✅' : '⚠️';

    console.log(`  Result: ${seasonMatch} ${nameMatch}\n`);
});

console.log('=== Test Complete ===');

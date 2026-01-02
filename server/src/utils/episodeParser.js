
/**
 * Utility for parsing episode information from titles
 */
const episodeParser = {
    /**
     * Parse season and episode numbers from a title string
     * @param {string} title 
     * @returns {{season: number|null, episodes: number[]} | null}
     */
    parse: (title) => {
        if (!title) return null;

        // Normalize title for simpler regex
        const cleanTitle = title.toUpperCase();

        let season = null;
        let episodes = [];

        // Match S01E01, S01E01-E02, S01E01-02
        // Regex Explanation:
        // S(\d+) : Season number
        // \s* : optional space
        // E(\d+) : First episode
        // (?: ... )? : Optional second part (range or sequence)
        // [-]\s*[E]?(\d+) : Range indicator (-E02 or -02)
        const sxxExxRegex = /S(\d+)\s*E(\d+)(?:[-]\s*E?(\d+))?/i;
        const match = cleanTitle.match(sxxExxRegex);

        if (match) {
            season = parseInt(match[1]);
            const startEp = parseInt(match[2]);
            const endEp = match[3] ? parseInt(match[3]) : null;

            if (endEp) {
                // It's a range, e.g., E01-03
                // Limitation: If endEp < startEp (e.g. S01E10-1 is unlikely but possible if poorly named), ignore range
                if (endEp >= startEp && (endEp - startEp) < 100) { // Safety limit
                    for (let i = startEp; i <= endEp; i++) {
                        episodes.push(i);
                    }
                } else {
                    episodes.push(startEp);
                    episodes.push(endEp); // Just add both if weird order
                }
            } else {
                episodes.push(startEp);
            }
        } else {
            // Try matching just EP01 or E01 if Sxx isn't present or separated
            // Note: This is riskier (could match "Code 01"). 
            // We usually only trust "EP" or "E" if preceded by space or bracket
            const epRegex = /(?:^|\s|[\[\(])E(?:P)?(\d+)(?:[-]\s*E?(\d+))?(?:$|\s|[\]\)])/i;
            const epMatch = cleanTitle.match(epRegex);

            if (epMatch) {
                // Try to find Season elsewhere: "S01", "Season 1"
                const seasonRegex = /(?:^|\s|[\[\(])(?:S|Season)\s?(\d+)(?:$|\s|[\]\)])/i;
                const sMatch = cleanTitle.match(seasonRegex);
                if (sMatch) season = parseInt(sMatch[1]);

                const startEp = parseInt(epMatch[1]);
                const endEp = epMatch[2] ? parseInt(epMatch[2]) : null;

                if (endEp) {
                    if (endEp >= startEp) {
                        for (let i = startEp; i <= endEp; i++) {
                            episodes.push(i);
                        }
                    } else {
                        episodes.push(startEp);
                        episodes.push(endEp);
                    }
                } else {
                    episodes.push(startEp);
                }
            } else {
                // Try "1x01" format
                const xRegex = /(\d{1,2})x(\d{2,3})/;
                const xMatch = cleanTitle.match(xRegex);
                if (xMatch) {
                    season = parseInt(xMatch[1]);
                    episodes.push(parseInt(xMatch[2]));
                } else {
                    // Season pack detection: S01, Season 1, etc. (without episode numbers)
                    // Match season followed by non-digit delimiter (., -, space, etc.)
                    const seasonOnlyRegex = /(?:^|[\s\.\[\(])(?:S|Season)[\s\.]?(\d+)(?=[\s\.\-\]\)]|$)/i;
                    const sOnlyMatch = cleanTitle.match(seasonOnlyRegex);
                    if (sOnlyMatch) {
                        season = parseInt(sOnlyMatch[1]);
                        // episodes remains empty for season packs
                    }
                }
            }
        }

        // Allow returning season-only results for season packs
        // Return null only if we found neither season nor episodes
        if (season === null && episodes.length === 0) return null;

        return {
            season,
            episodes: [...new Set(episodes)].sort((a, b) => a - b)
        };
    }
};

module.exports = episodeParser;

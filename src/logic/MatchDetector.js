export default class MatchDetector {
    /**
     * 掃描網格資料，回傳所有 3 消以上的連線群組 (純邏輯運算，不操作 UI/Sprite)
     */
    static findMatches(grid, rows = 8, cols = 8) {
        const hMatches = [];
        const vMatches = [];

        // 1. 橫向掃描
        for (let r = 0; r < rows; r++) {
            let matchLen = 1;
            for (let c = 0; c < cols; c++) {
                const cur = grid[r][c];
                const next = c < cols - 1 ? grid[r][c + 1] : null;
                const checkNext = next && cur && cur.colorType === next.colorType && cur.colorType !== 'rainbow';

                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        const line = [];
                        for (let i = 0; i < matchLen; i++) line.push(grid[r][c - i]);
                        hMatches.push({ line, color: cur.colorType, length: matchLen, direction: 'horizontal' });
                    }
                    matchLen = 1;
                }
            }
        }

        // 2. 縱向掃描
        for (let c = 0; c < cols; c++) {
            let matchLen = 1;
            for (let r = 0; r < rows; r++) {
                const cur = grid[r][c];
                const next = r < rows - 1 ? grid[r + 1][c] : null;
                const checkNext = next && cur && cur.colorType === next.colorType && cur.colorType !== 'rainbow';

                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        const line = [];
                        for (let i = 0; i < matchLen; i++) line.push(grid[r - i][c]);
                        vMatches.push({ line, color: cur.colorType, length: matchLen, direction: 'vertical' });
                    }
                    matchLen = 1;
                }
            }
        }

        return { hMatches, vMatches };
    }
}

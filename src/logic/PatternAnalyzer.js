export default class PatternAnalyzer {
    /**
     * 分析連線幾何，產生特殊方塊生成指令 (依優先級：Rainbow (3) > Bomb (2) > Rocket (1))
     */
    static analyzeSpawns(matchesResult, grid, activeSwappedTile = null, rows = 8, cols = 8) {
        const { hMatches, vMatches } = matchesResult;
        const matchedTilesSet = new Set();
        const spawnGridMap = new Map();

        const PRIORITY = { rainbow: 3, bomb: 2, rocket: 1 };

        const registerSpawn = (tile, type, color) => {
            const key = `${tile.row}_${tile.col}`;
            const pNew = PRIORITY[type.includes('rocket') ? 'rocket' : type];

            if (spawnGridMap.has(key)) {
                const existing = spawnGridMap.get(key);
                const pOld = PRIORITY[existing.type.includes('rocket') ? 'rocket' : existing.type];
                if (pNew > pOld) {
                    spawnGridMap.set(key, { row: tile.row, col: tile.col, type, color });
                }
            } else {
                spawnGridMap.set(key, { row: tile.row, col: tile.col, type, color });
            }
        };

        const pickSpawnTile = (line) => {
            if (activeSwappedTile && line.includes(activeSwappedTile)) {
                return activeSwappedTile;
            }
            return line[Math.floor(line.length / 2)];
        };

        // 1. 5+ 直線連消 ➔ Rainbow (優先級 3)
        hMatches.forEach(h => {
            h.line.forEach(t => matchedTilesSet.add(t));
            if (h.length >= 5) registerSpawn(pickSpawnTile(h.line), 'rainbow', 'rainbow');
        });
        vMatches.forEach(v => {
            v.line.forEach(t => matchedTilesSet.add(t));
            if (v.length >= 5) registerSpawn(pickSpawnTile(v.line), 'rainbow', 'rainbow');
        });

        // 2. 交叉 T/L 幾何判定 ➔ Bomb (優先級 2)
        hMatches.forEach(h => {
            vMatches.forEach(v => {
                if (h.color === v.color) {
                    const intersection = h.line.find(ht => v.line.includes(ht));
                    if (intersection) {
                        const r = intersection.row;
                        const c = intersection.col;

                        const sameColor = (tile) => tile && tile.colorType === h.color && tile.colorType !== 'rainbow';
                        const hasLeft = c > 0 && sameColor(grid[r][c - 1]);
                        const hasRight = c < cols - 1 && sameColor(grid[r][c + 1]);
                        const hasUp = r > 0 && sameColor(grid[r - 1][c]);
                        const hasDown = r < rows - 1 && sameColor(grid[r + 1][c]);

                        const isTShape = (hasLeft && hasRight && hasDown) || (hasLeft && hasRight && hasUp) || (hasUp && hasDown && hasLeft) || (hasUp && hasDown && hasRight);
                        const isLShape = (hasRight && hasDown) || (hasRight && hasUp) || (hasLeft && hasDown) || (hasLeft && hasUp);

                        if (isTShape || isLShape) {
                            registerSpawn(intersection, 'bomb', h.color);
                        }
                    }
                }
            });
        });

        // 3. 4 連線消 ➔ Rocket (優先級 1)
        hMatches.forEach(h => {
            if (h.length === 4) registerSpawn(pickSpawnTile(h.line), 'col_rocket', h.color);
        });
        vMatches.forEach(v => {
            if (v.length === 4) registerSpawn(pickSpawnTile(v.line), 'row_rocket', v.color);
        });

        return {
            matchedTiles: Array.from(matchedTilesSet),
            spawnSpecials: Array.from(spawnGridMap.values())
        };
    }
}

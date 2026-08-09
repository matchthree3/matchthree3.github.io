export default class SpecialManager {
    /**
     * 處理 6 大雙特殊道具交換組合
     */
    static resolveCombo(tileA, tileB, grid, rows = 8, cols = 8) {
        const typeA = tileA.specialType;
        const typeB = tileB.specialType;

        // 1. Rainbow + Rainbow (全盤清空)
        if (typeA === 'rainbow' && typeB === 'rainbow') {
            const allTiles = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (grid[r][c]) allTiles.push(grid[r][c]);
                }
            }
            return { affectedTiles: allTiles, shake: { duration: 500, intensity: 0.05 } };
        }

        // 2. Rainbow + Special / Normal
        if (typeA === 'rainbow' || typeB === 'rainbow') {
            const rainbowTile = typeA === 'rainbow' ? tileA : tileB;
            const otherTile = typeA === 'rainbow' ? tileB : tileA;
            const targetColor = otherTile.colorType;

            if (otherTile.specialType === 'none') {
                // Rainbow + 普通色
                const toClear = [rainbowTile];
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const t = grid[r][c];
                        if (t && t.colorType === targetColor) toClear.push(t);
                    }
                }
                return { affectedTiles: toClear, shake: { duration: 300, intensity: 0.03 } };
            } else {
                // Rainbow + Rocket / Bomb：轉化全場同色方塊並連鎖引爆
                const targetSpecialType = otherTile.specialType;
                const convertedSpecials = [];

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const t = grid[r][c];
                        if (t && t.colorType === targetColor) {
                            t.setSpecial(targetSpecialType);
                            convertedSpecials.push(t);
                        }
                    }
                }

                const expanded = new Set([rainbowTile, otherTile, ...convertedSpecials]);
                const processed = new Set();
                convertedSpecials.forEach(sp => this.expandSpecialEffect(sp, expanded, processed, grid, rows, cols));

                return { affectedTiles: Array.from(expanded), shake: { duration: 400, intensity: 0.04 } };
            }
        }

        // 3. Rocket + Rocket (十字爆破)
        const isRocketA = typeA === 'row_rocket' || typeA === 'col_rocket';
        const isRocketB = typeB === 'row_rocket' || typeB === 'col_rocket';

        if (isRocketA && isRocketB) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;

            for (let c = 0; c < cols; c++) if (grid[centerRow][c]) expanded.add(grid[centerRow][c]);
            for (let r = 0; r < rows; r++) if (grid[r][centerCol]) expanded.add(grid[r][centerCol]);

            return { affectedTiles: Array.from(expanded), shake: { duration: 300, intensity: 0.03 }, beams: [{ x: tileB.x, y: tileB.y, isRow: true }, { x: tileB.x, y: tileB.y, isRow: false }] };
        }

        // 4. Rocket + Bomb (3行 + 3列交叉)
        const isBombA = typeA === 'bomb';
        const isBombB = typeB === 'bomb';

        if ((isRocketA && isBombB) || (isBombA && isRocketB)) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;

            for (let r = Math.max(0, centerRow - 1); r <= Math.min(rows - 1, centerRow + 1); r++) {
                for (let c = 0; c < cols; c++) if (grid[r][c]) expanded.add(grid[r][c]);
            }
            for (let c = Math.max(0, centerCol - 1); c <= Math.min(cols - 1, centerCol + 1); c++) {
                for (let r = 0; r < rows; r++) if (grid[r][c]) expanded.add(grid[r][c]);
            }

            return { affectedTiles: Array.from(expanded), shake: { duration: 400, intensity: 0.04 }, shockwave: { x: tileB.x, y: tileB.y } };
        }

        // 5. Bomb + Bomb (5x5 超大爆破)
        if (isBombA && isBombB) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;

            for (let r = Math.max(0, centerRow - 2); r <= Math.min(rows - 1, centerRow + 2); r++) {
                for (let c = Math.max(0, centerCol - 2); c <= Math.min(cols - 1, centerCol + 2); c++) {
                    if (grid[r][c]) expanded.add(grid[r][c]);
                }
            }

            return { affectedTiles: Array.from(expanded), shake: { duration: 500, intensity: 0.05 }, shockwave: { x: tileB.x, y: tileB.y } };
        }

        return { affectedTiles: [], shake: null };
    }

    /**
     * 遞迴展開單一特殊方塊被引暴時波及的區域 (防止死鎖連鎖)
     */
    static expandSpecialEffect(tile, expandedSet, processedSpecials, grid, rows = 8, cols = 8) {
        if (!tile || processedSpecials.has(tile)) return;
        processedSpecials.add(tile);

        if (tile.specialType === 'row_rocket') {
            for (let c = 0; c < cols; c++) {
                const target = grid[tile.row][c];
                if (target) {
                    expandedSet.add(target);
                    if (target.specialType !== 'none' && target !== tile) {
                        this.expandSpecialEffect(target, expandedSet, processedSpecials, grid, rows, cols);
                    }
                }
            }
        } else if (tile.specialType === 'col_rocket') {
            for (let r = 0; r < rows; r++) {
                const target = grid[r][tile.col];
                if (target) {
                    expandedSet.add(target);
                    if (target.specialType !== 'none' && target !== tile) {
                        this.expandSpecialEffect(target, expandedSet, processedSpecials, grid, rows, cols);
                    }
                }
            }
        } else if (tile.specialType === 'bomb') {
            for (let r = Math.max(0, tile.row - 1); r <= Math.min(rows - 1, tile.row + 1); r++) {
                for (let c = Math.max(0, tile.col - 1); c <= Math.min(cols - 1, tile.col + 1); c++) {
                    const target = grid[r][c];
                    if (target) {
                        expandedSet.add(target);
                        if (target.specialType !== 'none' && target !== tile) {
                            this.expandSpecialEffect(target, expandedSet, processedSpecials, grid, rows, cols);
                        }
                    }
                }
            }
        }
    }
}

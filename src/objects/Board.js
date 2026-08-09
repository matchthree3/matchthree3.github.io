import Phaser from 'phaser';
import Tile from './Tile.js';

export default class Board extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);
        scene.add.existing(this);

        this.rows = 8;
        this.cols = 8;
        this.tileSize = 64;
        this.spacing = 4;
        this.grid = [];
        this.selectedTile = null;
        this.isBusy = false;
        this.comboCount = 1;

        this.colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        this.offsetX = -((this.cols * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);
        this.offsetY = -((this.rows * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);

        // 物件池
        this.flashPool = [];
        this.scoreTextPool = [];
        this.rowBeamPool = [];
        this.colBeamPool = [];
        this.wavePool = [];

        this.rainbowGraphics = this.scene.add.graphics();
        this.add(this.rainbowGraphics);

        this._shakeDuration = 0;
        this._shakeIntensity = 0;

        this.createGrid();
    }

    worldPos(row, col) {
        return {
            x: this.offsetX + col * (this.tileSize + this.spacing),
            y: this.offsetY + row * (this.tileSize + this.spacing)
        };
    }

    createGrid() {
        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                const excluded = new Set();
                if (col >= 2 && this.grid[row][col - 1].colorType === this.grid[row][col - 2].colorType) {
                    excluded.add(this.grid[row][col - 1].colorType);
                }
                if (row >= 2 && this.grid[row - 1][col].colorType === this.grid[row - 2][col].colorType) {
                    excluded.add(this.grid[row - 1][col].colorType);
                }

                const available = excluded.size > 0 
                    ? this.colors.filter(c => !excluded.has(c))
                    : this.colors;
                const randomColor = Phaser.Math.RND.pick(available);

                const pos = this.worldPos(row, col);
                const tile = new Tile(this.scene, pos.x, pos.y, `tile_${randomColor}`, row, col);
                this.add(tile);
                this.grid[row][col] = tile;
            }
        }
    }

    selectTile(tile) {
        if (this.isBusy) return;

        // 規則：Rainbow 不能直接單點發動，必須進行交換
        if (tile.specialType !== 'none' && tile.specialType !== 'rainbow') {
            if (this.selectedTile) {
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
            }
            this.triggerSingleSpecial(tile);
            return;
        }

        if (!this.selectedTile) {
            this.selectedTile = tile;
            tile.setSelected(true);
        } else if (this.selectedTile === tile) {
            this.selectedTile.setSelected(false);
            this.selectedTile = null;
        } else {
            const isNeighbor = (Math.abs(this.selectedTile.row - tile.row) + Math.abs(this.selectedTile.col - tile.col)) === 1;
            if (isNeighbor) {
                const tileA = this.selectedTile;
                const tileB = tile;
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
                this.swapTiles(tileA, tileB);
            } else {
                this.selectedTile.setSelected(false);
                this.selectedTile = tile;
                tile.setSelected(true);
            }
        }
    }

    handleDragSwap(tileA, targetRow, targetCol) {
        if (this.isBusy) return;
        const tileB = this.grid[targetRow][targetCol];
        if (tileB) {
            if (this.selectedTile) {
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
            }
            this.swapTiles(tileA, tileB);
        }
    }

    swapTiles(tileA, tileB) {
        this.isBusy = true;
        this.comboCount = 1;

        const rA = tileA.row, cA = tileA.col;
        const rB = tileB.row, cB = tileB.col;

        this.grid[rA][cA] = tileB;
        this.grid[rB][cB] = tileA;
        tileA.row = rB; tileA.col = cB;
        tileB.row = rA; tileB.col = cA;

        const posA = this.worldPos(rA, cA);
        const posB = this.worldPos(rB, cB);

        this.scene.tweens.killTweensOf(tileA);
        this.scene.tweens.killTweensOf(tileB);

        this.scene.tweens.add({ targets: tileA, x: posB.x, y: posB.y, duration: 250, ease: 'Back.easeOut' });
        this.scene.tweens.add({
            targets: tileB, x: posA.x, y: posA.y, duration: 250, ease: 'Back.easeOut',
            onComplete: () => {
                // 檢查是否包含特殊方塊互動
                const isSpecialA = tileA.specialType !== 'none';
                const isSpecialB = tileB.specialType !== 'none';

                if (isSpecialA || isSpecialB) {
                    this.handleSpecialCombo(tileA, tileB);
                    return;
                }

                // 普通 3 消判斷
                const matchesResult = this.checkMatchesDetailed(tileA);
                if (matchesResult.tiles.length > 0) {
                    // 步數扣除
                    if (this.scene.moves !== undefined) {
                        this.scene.moves--;
                        if (this.scene.movesText) this.scene.movesText.setText(`Moves: ${this.scene.moves}`);
                    }
                    this.clearMatches(matchesResult);
                } else {
                    // 無效交換：彈回
                    this.grid[rA][cA] = tileA;
                    this.grid[rB][cB] = tileB;
                    tileA.row = rA; tileA.col = cA;
                    tileB.row = rB; tileB.col = cA;

                    this.scene.tweens.add({ targets: tileA, x: posA.x, y: posA.y, duration: 200, ease: 'Power2' });
                    this.scene.tweens.add({
                        targets: tileB, x: posB.x, y: posB.y, duration: 200, ease: 'Power2',
                        onComplete: () => { this.isBusy = false; }
                    });
                }
            }
        });
    }

    // ==========================================
    // 🌟 特殊方塊組合邏輯 (Explicit Combo Handling)
    // ==========================================
    handleSpecialCombo(tileA, tileB) {
        // 扣除步數
        if (this.scene.moves !== undefined) {
            this.scene.moves--;
            if (this.scene.movesText) this.scene.movesText.setText(`Moves: ${this.scene.moves}`);
        }

        const typeA = tileA.specialType;
        const typeB = tileB.specialType;

        // 1. Rainbow + Rainbow (全盤清除)
        if (typeA === 'rainbow' && typeB === 'rainbow') {
            const allTiles = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c]) allTiles.push(this.grid[r][c]);
                }
            }
            this.queueShake(500, 0.05);
            this.flushShake();
            this.clearMatches({ tiles: allTiles, spawnSpecials: [] });
            return;
        }

        // 2. Rainbow + Special (Rocket / Bomb)
        if (typeA === 'rainbow' || typeB === 'rainbow') {
            const rainbowTile = typeA === 'rainbow' ? tileA : tileB;
            const otherTile = typeA === 'rainbow' ? tileB : tileA;
            const targetColor = otherTile.colorType;

            if (otherTile.specialType === 'none') {
                // Rainbow + 普通色：清除全盤該顏色
                const toClear = [rainbowTile];
                for (let r = 0; r < this.rows; r++) {
                    for (let c = 0; c < this.cols; c++) {
                        const t = this.grid[r][c];
                        if (t && t.colorType === targetColor) toClear.push(t);
                    }
                }
                this.queueShake(300, 0.03);
                this.flushShake();
                this.clearMatches({ tiles: toClear, spawnSpecials: [] });
            } else {
                // Rainbow + Rocket 或 Rainbow + Bomb
                // 全盤該顏色轉為該特殊道具，並全部觸發
                const specialToDuplicate = otherTile.specialType;
                const convertedSpecials = [];

                for (let r = 0; r < this.rows; r++) {
                    for (let c = 0; c < this.cols; c++) {
                        const t = this.grid[r][c];
                        if (t && t.colorType === targetColor) {
                            // 隨機指定橫向或直向火箭
                            const newType = (specialToDuplicate.includes('rocket')) 
                                ? (Math.random() > 0.5 ? 'row_rocket' : 'col_rocket') 
                                : 'bomb';
                            t.setSpecial(newType);
                            convertedSpecials.push(t);
                        }
                    }
                }

                // 觸發所有轉換後的特殊道具
                const expanded = new Set([rainbowTile, otherTile, ...convertedSpecials]);
                convertedSpecials.forEach(sp => this.expandSpecialEffect(sp, expanded, new Set()));
                this.flushShake();
                this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
            }
            return;
        }

        // 3. Rocket + Rocket (十字爆破：交換位置所在的整行 + 整列)
        const isRocketA = typeA === 'row_rocket' || typeA === 'col_rocket';
        const isRocketB = typeB === 'row_rocket' || typeB === 'col_rocket';

        if (isRocketA && isRocketB) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;

            this.createRocketBeam(tileB.x, tileB.y, true);
            this.createRocketBeam(tileB.x, tileB.y, false);
            this.queueShake(300, 0.03);

            for (let c = 0; c < this.cols; c++) if (this.grid[centerRow][c]) expanded.add(this.grid[centerRow][c]);
            for (let r = 0; r < this.rows; r++) if (this.grid[r][centerCol]) expanded.add(this.grid[r][centerCol]);

            this.flushShake();
            this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
            return;
        }

        // 4. Rocket + Bomb (3 行 + 3 列交叉爆破)
        const isBombA = typeA === 'bomb';
        const isBombB = typeB === 'bomb';

        if ((isRocketA && isBombB) || (isBombA && isRocketB)) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;

            this.createShockwave(tileB.x, tileB.y);
            this.queueShake(400, 0.04);

            // 3 行
            for (let r = Math.max(0, centerRow - 1); r <= Math.min(this.rows - 1, centerRow + 1); r++) {
                for (let c = 0; c < this.cols; c++) if (this.grid[r][c]) expanded.add(this.grid[r][c]);
            }
            // 3 列
            for (let c = Math.max(0, centerCol - 1); c <= Math.min(this.cols - 1, centerCol + 1); c++) {
                for (let r = 0; r < this.rows; r++) if (this.grid[r][c]) expanded.add(this.grid[r][c]);
            }

            this.flushShake();
            this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
            return;
        }

        // 5. Bomb + Bomb (5x5 區域爆破)
        if (isBombA && isBombB) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;

            this.createShockwave(tileB.x, tileB.y);
            this.queueShake(500, 0.05);

            for (let r = Math.max(0, centerRow - 2); r <= Math.min(this.rows - 1, centerRow + 2); r++) {
                for (let c = Math.max(0, centerCol - 2); c <= Math.min(this.cols - 1, centerCol + 2); c++) {
                    if (this.grid[r][c]) expanded.add(this.grid[r][c]);
                }
            }

            this.flushShake();
            this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
            return;
        }
    }

    triggerSingleSpecial(tile) {
        this.isBusy = true;
        const expanded = new Set([tile]);
        this.expandSpecialEffect(tile, expanded, new Set());
        this.flushShake();
        this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
    }

    expandSpecialEffect(tile, expandedSet, processedSpecials) {
        if (!tile || processedSpecials.has(tile)) return;
        processedSpecials.add(tile);

        if (tile.specialType === 'row_rocket') {
            this.createRocketBeam(tile.x, tile.y, true);
            this.queueShake(200, 0.02);
            for (let c = 0; c < this.cols; c++) {
                const target = this.grid[tile.row][c];
                if (target) {
                    expandedSet.add(target);
                    if (target.specialType !== 'none' && target !== tile) {
                        this.expandSpecialEffect(target, expandedSet, processedSpecials);
                    }
                }
            }
        } else if (tile.specialType === 'col_rocket') {
            this.createRocketBeam(tile.x, tile.y, false);
            this.queueShake(200, 0.02);
            for (let r = 0; r < this.rows; r++) {
                const target = this.grid[r][tile.col];
                if (target) {
                    expandedSet.add(target);
                    if (target.specialType !== 'none' && target !== tile) {
                        this.expandSpecialEffect(target, expandedSet, processedSpecials);
                    }
                }
            }
        } else if (tile.specialType === 'bomb') {
            this.createShockwave(tile.x, tile.y);
            this.queueShake(300, 0.04);
            for (let r = Math.max(0, tile.row - 1); r <= Math.min(this.rows - 1, tile.row + 1); r++) {
                for (let c = Math.max(0, tile.col - 1); c <= Math.min(this.cols - 1, tile.col + 1); c++) {
                    const target = this.grid[r][c];
                    if (target) {
                        expandedSet.add(target);
                        if (target.specialType !== 'none' && target !== tile) {
                            this.expandSpecialEffect(target, expandedSet, processedSpecials);
                        }
                    }
                }
            }
        }
    }

    checkMatchesDetailed(activeSwappedTile = null) {
        const hMatches = [];
        const vMatches = [];

        // 1. 掃描橫向連線
        for (let r = 0; r < this.rows; r++) {
            let matchLen = 1;
            for (let c = 0; c < this.cols; c++) {
                const cur = this.grid[r][c];
                const next = c < this.cols - 1 ? this.grid[r][c + 1] : null;
                const checkNext = next && cur && (cur.colorType === next.colorType) && cur.colorType !== 'rainbow';

                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        const line = [];
                        for (let i = 0; i < matchLen; i++) line.push(this.grid[r][c - i]);
                        hMatches.push({ line, color: cur.colorType, length: matchLen });
                    }
                    matchLen = 1;
                }
            }
        }

        // 2. 掃描直向連線
        for (let c = 0; c < this.cols; c++) {
            let matchLen = 1;
            for (let r = 0; r < this.rows; r++) {
                const cur = this.grid[r][c];
                const next = r < this.rows - 1 ? this.grid[r + 1][c] : null;
                const checkNext = next && cur && (cur.colorType === next.colorType) && cur.colorType !== 'rainbow';

                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        const line = [];
                        for (let i = 0; i < matchLen; i++) line.push(this.grid[r - i][c]);
                        vMatches.push({ line, color: cur.colorType, length: matchLen });
                    }
                    matchLen = 1;
                }
            }
        }

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

        // 3. 處理 5 連消 (Rainbow - Priority 3)
        hMatches.forEach(h => {
            h.line.forEach(t => matchedTilesSet.add(t));
            if (h.length >= 5) registerSpawn(pickSpawnTile(h.line), 'rainbow', 'rainbow');
        });
        vMatches.forEach(v => {
            v.line.forEach(t => matchedTilesSet.add(t));
            if (v.length >= 5) registerSpawn(pickSpawnTile(v.line), 'rainbow', 'rainbow');
        });

        // 4. 處理 T / L 型幾何判定 (Bomb - Priority 2)
        hMatches.forEach(h => {
            vMatches.forEach(v => {
                if (h.color === v.color) {
                    const intersection = h.line.find(ht => v.line.includes(ht));
                    if (intersection) {
                        const r = intersection.row;
                        const c = intersection.col;

                        const sameColor = (tile) => tile && tile.colorType === h.color && tile.colorType !== 'rainbow';
                        const hasLeft = c > 0 && sameColor(this.grid[r][c - 1]);
                        const hasRight = c < this.cols - 1 && sameColor(this.grid[r][c + 1]);
                        const hasUp = r > 0 && sameColor(this.grid[r - 1][c]);
                        const hasDown = r < this.rows - 1 && sameColor(this.grid[r + 1][c]);

                        const isTShape = (hasLeft && hasRight && hasDown) || (hasLeft && hasRight && hasUp) || (hasUp && hasDown && hasLeft) || (hasUp && hasDown && hasRight);
                        const isLShape = (hasRight && hasDown) || (hasRight && hasUp) || (hasLeft && hasDown) || (hasLeft && hasLeft);

                        if (isTShape || isLShape) {
                            registerSpawn(intersection, 'bomb', h.color);
                        }
                    }
                }
            });
        });

        // 5. 處理 4 連消 (Rocket - Priority 1)
        // 水平 4 連 ➔ 產生垂直貫穿火箭 (col_rocket)
        // 垂直 4 連 ➔ 產生水平貫穿火箭 (row_rocket)
        hMatches.forEach(h => {
            if (h.length === 4) registerSpawn(pickSpawnTile(h.line), 'col_rocket', h.color);
        });
        vMatches.forEach(v => {
            if (v.length === 4) registerSpawn(pickSpawnTile(v.line), 'row_rocket', v.color);
        });

        const expanded = new Set(matchedTilesSet);
        matchedTilesSet.forEach(tile => this.expandSpecialEffect(tile, expanded, new Set()));
        this.flushShake();

        return { tiles: Array.from(expanded), spawnSpecials: Array.from(spawnGridMap.values()) };
    }

    clearMatches(matchesResult) {
        const matches = matchesResult.tiles;
        if (matches.length === 0) {
            this.isBusy = false;
            return;
        }

        // 得分倍率與連擊 (Combo) 計算
        if (this.scene.score !== undefined) {
            const scoreGain = matches.length * 10 * this.comboCount;
            this.scene.score += scoreGain;
            if (this.scene.scoreText) this.scene.scoreText.setText(`Score: ${this.scene.score}`);
        }

        matches.forEach(tile => {
            this.grid[tile.row][tile.col] = null;
            this.scene.tweens.add({
                targets: tile,
                scaleX: 0, scaleY: 0, alpha: 0,
                duration: 200, ease: 'Power2',
                onComplete: () => tile.destroy()
            });
        });

        this.scene.time.delayedCall(220, () => {
            if (matchesResult.spawnSpecials) {
                matchesResult.spawnSpecials.forEach(sp => {
                    const pos = this.worldPos(sp.row, sp.col);
                    const newTile = new Tile(this.scene, pos.x, pos.y, `tile_${sp.color === 'rainbow' ? 'red' : sp.color}`, sp.row, sp.col);
                    newTile.setSpecial(sp.type);
                    newTile.setScale(0);
                    this.add(newTile);
                    this.grid[sp.row][sp.col] = newTile;

                    this.scene.tweens.add({
                        targets: newTile,
                        scaleX: newTile.baseScale, scaleY: newTile.baseScale,
                        duration: 300, ease: 'Bounce.easeOut'
                    });
                });
            }
            this.dropAndRefill();
        });
    }

    dropAndRefill() {
        const dropTweens = [];

        for (let col = 0; col < this.cols; col++) {
            let emptySlots = 0;
            for (let row = this.rows - 1; row >= 0; row--) {
                if (this.grid[row][col] === null) {
                    emptySlots++;
                } else if (emptySlots > 0) {
                    const tile = this.grid[row][col];
                    const targetRow = row + emptySlots;

                    this.grid[targetRow][col] = tile;
                    this.grid[row][col] = null;
                    tile.row = targetRow;

                    const targetPos = this.worldPos(targetRow, col);
                    dropTweens.push({ targets: tile, y: targetPos.y, duration: 300, ease: 'Bounce.easeOut' });
                }
            }

            for (let i = 0; i < emptySlots; i++) {
                const targetRow = emptySlots - 1 - i;
                const randomColor = Phaser.Math.RND.pick(this.colors);
                const pos = this.worldPos(targetRow, col);
                const startY = pos.y - (emptySlots * 70);

                const tile = new Tile(this.scene, pos.x, startY, `tile_${randomColor}`, targetRow, col);
                this.add(tile);
                this.grid[targetRow][col] = tile;

                dropTweens.push({ targets: tile, y: pos.y, duration: 350 + (i * 40), ease: 'Bounce.easeOut' });
            }
        }

        if (dropTweens.length > 0) {
            let completed = 0;
            dropTweens.forEach(config => {
                this.scene.tweens.add({
                    ...config,
                    onComplete: () => {
                        completed++;
                        if (completed === dropTweens.length) {
                            this.scene.time.delayedCall(150, () => {
                                const newMatches = this.checkMatchesDetailed();
                                if (newMatches.tiles.length > 0) {
                                    this.comboCount++;
                                    this.clearMatches(newMatches);
                                } else {
                                    this.isBusy = false;
                                    // 檢查是否無解盤面 (Has Possible Move)
                                    if (!this.hasPossibleMove()) {
                                        this.shuffleBoard();
                                    }
                                }
                            });
                        }
                    }
                });
            });
        } else {
            this.isBusy = false;
        }
    }

    hasPossibleMove() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                // 只要盤面有特殊道具，視為有解
                if (this.grid[r][c] && this.grid[r][c].specialType !== 'none') return true;

                // 檢查右側交換
                if (c < this.cols - 1) {
                    if (this.testSwapHasMatch(r, c, r, c + 1)) return true;
                }
                // 檢查下方交換
                if (r < this.rows - 1) {
                    if (this.testSwapHasMatch(r, c, r + 1, c)) return true;
                }
            }
        }
        return false;
    }

    testSwapHasMatch(r1, c1, r2, c2) {
        const t1 = this.grid[r1][c1];
        const t2 = this.grid[r2][c2];
        if (!t1 || !t2) return false;

        this.grid[r1][c1] = t2;
        this.grid[r2][c2] = t1;

        let hasMatch = false;
        // 簡易檢查 3 連
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                if (this.grid[r][c] && this.grid[r][c+1] && this.grid[r][c+2]) {
                    if (this.grid[r][c].colorType === this.grid[r][c+1].colorType &&
                        this.grid[r][c].colorType === this.grid[r][c+2].colorType) {
                        hasMatch = true; break;
                    }
                }
            }
            if (hasMatch) break;
        }

        // 復原
        this.grid[r1][c1] = t1;
        this.grid[r2][c2] = t2;
        return hasMatch;
    }

    shuffleBoard() {
        const allTiles = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c]) allTiles.push(this.grid[r][c]);
            }
        }

        Phaser.Utils.Array.Shuffle(allTiles);
        let idx = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = allTiles[idx++];
                tile.row = r;
                tile.col = c;
                this.grid[r][c] = tile;
                const pos = this.worldPos(r, c);
                this.scene.tweens.add({ targets: tile, x: pos.x, y: pos.y, duration: 400, ease: 'Power2' });
            }
        }
    }

    // ---- 特效輔助 ----
    queueShake(duration, intensity) {
        if (duration > this._shakeDuration) this._shakeDuration = duration;
        if (intensity > this._shakeIntensity) this._shakeIntensity = intensity;
    }

    flushShake() {
        if (this._shakeDuration > 0) {
            this.scene.cameras.main.shake(this._shakeDuration, this._shakeIntensity);
            this._shakeDuration = 0;
            this._shakeIntensity = 0;
        }
    }

    createRocketBeam(x, y, isRow) {
        const beam = this.scene.add.rectangle(x, y, isRow ? 800 : 20, isRow ? 20 : 800, 0xffffff, 1);
        this.add(beam);
        this.scene.tweens.add({
            targets: beam,
            alpha: 0, duration: 300,
            onComplete: () => beam.destroy()
        });
    }

    createShockwave(x, y) {
        const wave = this.scene.add.circle(x, y, 30, 0xffaa00, 1);
        this.add(wave);
        this.scene.tweens.add({
            targets: wave,
            scale: 8, alpha: 0,
            duration: 500, ease: 'Sine.easeOut',
            onComplete: () => wave.destroy()
        });
    }
}

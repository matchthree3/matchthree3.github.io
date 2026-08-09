import Phaser from 'phaser';
import Tile from './Tile.js';
import MatchDetector from '../logic/MatchDetector.js';
import PatternAnalyzer from '../logic/PatternAnalyzer.js';
import SpecialManager from '../logic/SpecialManager.js';
import BoardAnimator from '../logic/BoardAnimator.js';

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
        this.isLocked = false;
        this.comboCount = 1;

        this.colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        this.offsetX = -((this.cols * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);
        this.offsetY = -((this.rows * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);

        this.scoreTextPool = [];
        this.rowBeamPool = [];
        this.colBeamPool = [];
        this.wavePool = [];

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
        if (this.isLocked) return;

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
                this.resolveMove(tileA, tileB);
            } else {
                this.selectedTile.setSelected(false);
                this.selectedTile = tile;
                tile.setSelected(true);
            }
        }
    }

    handleDragSwap(tileA, targetRow, targetCol) {
        if (this.isLocked) return;
        const tileB = this.grid[targetRow][targetCol];
        if (tileB) {
            if (this.selectedTile) {
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
            }
            this.resolveMove(tileA, targetCol ? tileB : tileB);
        }
    }

    /**
     * 核心非同步主流程控制器 (Async Pipeline)
     */
    async resolveMove(tileA, tileB) {
        this.isLocked = true;
        this.comboCount = 1;

        const rA = tileA.row, cA = tileA.col;
        const rB = tileB.row, cB = tileB.col;
        const posA = this.worldPos(rA, cA);
        const posB = this.worldPos(rB, cB);

        // 1. 資料交換
        this.grid[rA][cA] = tileB;
        this.grid[rB][cB] = tileA;
        tileA.row = rB; tileA.col = cB;
        tileB.row = rA; tileB.col = cA;

        // 2. 播放 Swap 動畫
        await BoardAnimator.swap(this.scene, tileA, tileB, posA, posB);

        // 3. 檢查特殊組合或普通 Match
        const isSpecialA = tileA.specialType !== 'none';
        const isSpecialB = tileB.specialType !== 'none';

        if (isSpecialA || isSpecialB) {
            if (this.scene.onMoveUsed) this.scene.onMoveUsed();
            const comboResult = SpecialManager.resolveCombo(tileA, tileB, this.grid, this.rows, this.cols);
            await this.clearAndCascade(comboResult.affectedTiles, []);
            this.isLocked = false;
            return;
        }

        const rawMatches = MatchDetector.findMatches(this.grid, this.rows, this.cols);
        if (rawMatches.hMatches.length > 0 || rawMatches.vMatches.length > 0) {
            if (this.scene.onMoveUsed) this.scene.onMoveUsed();
            const analyzed = PatternAnalyzer.analyzeSpawns(rawMatches, this.grid, tileA, this.rows, this.cols);
            await this.clearAndCascade(analyzed.matchedTiles, analyzed.spawnSpecials);
        } else {
            // 無效交換：還原資料與動畫
            this.grid[rA][cA] = tileA;
            this.grid[rB][cB] = tileB;
            tileA.row = rA; tileA.col = cA;
            tileB.row = rB; tileB.col = cB;
            await BoardAnimator.swap(this.scene, tileA, tileB, posB, posA, 180);
        }

        this.isLocked = false;
    }

    async triggerSingleSpecial(tile) {
        this.isLocked = true;
        const expanded = new Set([tile]);
        const processed = new Set();
        SpecialManager.expandSpecialEffect(tile, expanded, processed, this.grid, this.rows, this.cols);
        await this.clearAndCascade(Array.from(expanded), []);
        this.isLocked = false;
    }

    /**
     * 消除、生成特殊方塊、下落與連鎖 Pipeline (Cascade Loop)
     */
    async clearAndCascade(tilesToClear, spawnSpecials) {
        let currentTiles = tilesToClear;
        let currentSpawns = spawnSpecials;

        while (currentTiles && currentTiles.length > 0) {
            // 1. 計算得分與飄字
            let cx = 0, cy = 0;
            currentTiles.forEach(t => { cx += t.x; cy += t.y; });
            cx /= currentTiles.length; cy /= currentTiles.length;

            const scoreGain = currentTiles.length * 10 * this.comboCount;
            if (this.scene.updateScore) this.scene.updateScore(scoreGain);
            this.showFloatingScore(cx, cy, scoreGain);

            // 2. 標記陣列空位並播放消除動畫
            currentTiles.forEach(tile => {
                this.grid[tile.row][tile.col] = null;
            });
            await BoardAnimator.destroy(this.scene, currentTiles);

            // 3. 原位生成特殊方塊
            if (currentSpawns && currentSpawns.length > 0) {
                currentSpawns.forEach(sp => {
                    const pos = this.worldPos(sp.row, sp.col);
                    const newTile = new Tile(this.scene, pos.x, pos.y, `tile_${sp.color === 'rainbow' ? 'red' : sp.color}`, sp.row, sp.col);
                    newTile.setSpecial(sp.type);
                    this.add(newTile);
                    this.grid[sp.row][sp.col] = newTile;
                });
            }

            // 4. 下落與補充新方塊
            const dropConfigs = this.applyGravityAndRefillData();
            await BoardAnimator.fall(this.scene, dropConfigs);

            // 5. 掃描二次連鎖
            const newRawMatches = MatchDetector.findMatches(this.grid, this.rows, this.cols);
            if (newRawMatches.hMatches.length > 0 || newRawMatches.vMatches.length > 0) {
                this.comboCount++;
                const newAnalyzed = PatternAnalyzer.analyzeSpawns(newRawMatches, this.grid, null, this.rows, this.cols);
                currentTiles = newAnalyzed.matchedTiles;
                currentSpawns = newAnalyzed.spawnSpecials;
            } else {
                currentTiles = [];
                currentSpawns = [];
            }
        }

        // 6. 檢查無解盤面
        if (!this.hasPossibleMove()) {
            this.shuffleBoard();
        }
    }

    applyGravityAndRefillData() {
        const dropConfigs = [];

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
                    dropConfigs.push({ targets: tile, y: targetPos.y, duration: 280, ease: 'Bounce.easeOut' });
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
                dropConfigs.push({ targets: tile, y: pos.y, duration: 320 + (i * 35), ease: 'Bounce.easeOut' });
            }
        }

        return dropConfigs;
    }

    hasPossibleMove() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] && this.grid[r][c].specialType !== 'none') return true;
                if (c < this.cols - 1 && this.testSwapHasMatch(r, c, r, c + 1)) return true;
                if (r < this.rows - 1 && this.testSwapHasMatch(r, c, r + 1, c)) return true;
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

        const raw = MatchDetector.findMatches(this.grid, this.rows, this.cols);
        const hasMatch = raw.hMatches.length > 0 || raw.vMatches.length > 0;

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

    showFloatingScore(x, y, amount) {
        let obj = this.scoreTextPool.find(o => !o.getData('active'));
        if (!obj) {
            obj = this.scene.add.text(0, 0, '', {
                fontSize: '26px',
                fontStyle: 'bold',
                color: '#FFD700',
                stroke: '#5A3311',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(50);
            this.add(obj);
            this.scoreTextPool.push(obj);
        }
        obj.setData('active', true);
        obj.setText(`+${amount}`);
        obj.setPosition(x, y);
        obj.setAlpha(1);
        obj.setScale(0.5);
        obj.setVisible(true);
        this.scene.tweens.killTweensOf(obj);
        this.scene.tweens.add({
            targets: obj,
            y: y - 55,
            alpha: 0,
            scale: 1.15,
            duration: 650,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                obj.setData('active', false);
                obj.setVisible(false);
            }
        });
    }
}

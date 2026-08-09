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

        this.colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        this.offsetX = -((this.cols * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);
        this.offsetY = -((this.rows * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);

        this.createGrid();
    }

    createGrid() {
        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                let randomColor;
                do {
                    randomColor = Phaser.Math.RND.pick(this.colors);
                } while (
                    (col >= 2 && this.grid[row][col - 1].colorType === randomColor && this.grid[row][col - 2].colorType === randomColor) ||
                    (row >= 2 && this.grid[row - 1][col].colorType === randomColor && this.grid[row - 2][col].colorType === randomColor)
                );

                const posX = this.offsetX + col * (this.tileSize + this.spacing);
                const posY = this.offsetY + row * (this.tileSize + this.spacing);

                const tile = new Tile(this.scene, posX, posY, `tile_${randomColor}`, row, col);
                this.add(tile);
                this.grid[row][col] = tile;
            }
        }
    }

    // 點擊選取或單點觸發道具
    selectTile(tile) {
        if (this.isBusy) return;

        // 【做法 B】直接點擊特殊道具（火箭/炸彈/彩虹球）立即引爆
        if (tile.specialType !== 'none') {
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
                tileA.setSelected(false);
                this.selectedTile = null;
                this.swapTiles(tileA, tileB);
            } else {
                this.selectedTile.setSelected(false);
                this.selectedTile = tile;
                tile.setSelected(true);
            }
        }
    }

    handleDragSwap(tile, targetRow, targetCol) {
        if (this.selectedTile) {
            this.selectedTile.setSelected(false);
            this.selectedTile = null;
        }

        if (targetRow >= 0 && targetRow < this.rows && targetCol >= 0 && targetCol < this.cols) {
            const targetTile = this.grid[targetRow][targetCol];
            if (targetTile) {
                this.swapTiles(tile, targetTile);
            }
        }
    }

    swapTiles(tileA, tileB) {
        this.isBusy = true;

        const rA = tileA.row, cA = tileA.col;
        const rB = tileB.row, cB = tileB.col;

        this.grid[rA][cA] = tileB;
        this.grid[rB][cB] = tileA;
        tileA.row = rB; tileA.col = cB;
        tileB.row = rA; tileB.col = cA;

        const posA = { x: tileA.x, y: tileA.y };
        const posB = { x: tileB.x, y: tileB.y };

        this.scene.tweens.add({ targets: tileA, x: posB.x, y: posB.y, duration: 250, ease: 'Back.easeOut' });
        this.scene.tweens.add({
            targets: tileB, x: posA.x, y: posA.y, duration: 250, ease: 'Back.easeOut',
            onComplete: () => {
                // 1. 彩虹球交換優先判定
                if (tileA.specialType === 'rainbow' || tileB.specialType === 'rainbow') {
                    this.triggerRainbow(tileA.specialType === 'rainbow' ? tileA : tileB, tileA.specialType === 'rainbow' ? tileB : tileA);
                    return;
                }

                // 2. 【做法 B】只要交換的其中一方包含火箭或炸彈，無條件直接引爆！不用湊 3 連消
                const isSpecialA = ['row_rocket', 'col_rocket', 'bomb'].includes(tileA.specialType);
                const isSpecialB = ['row_rocket', 'col_rocket', 'bomb'].includes(tileB.specialType);
                
                if (isSpecialA || isSpecialB) {
                    this.triggerSpecialSwap(tileA, tileB);
                    return;
                }

                // 3. 一般軟糖的 3 消檢查
                const matchesResult = this.checkMatchesDetailed();
                if (matchesResult.tiles.length > 0) {
                    this.clearMatches(matchesResult);
                } else {
                    // 無效交換：彈回
                    this.grid[rA][cA] = tileA;
                    this.grid[rB][cB] = tileB;
                    tileA.row = rA; tileA.col = cA;
                    tileB.row = rB; tileB.col = cB;

                    this.scene.tweens.add({ targets: tileA, x: posA.x, y: posA.y, duration: 200, ease: 'Power2' });
                    this.scene.tweens.add({
                        targets: tileB, x: posB.x, y: posB.y, duration: 200, ease: 'Power2',
                        onComplete: () => { this.isBusy = false; }
                    });
                }
            }
        });
    }

    // 單點特殊道具引爆
    triggerSingleSpecial(tile) {
        this.isBusy = true;
        const expanded = new Set([tile]);
        this.expandSpecialEffect(tile, expanded);

        this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
    }

    // 交換特殊道具引爆
    triggerSpecialSwap(tileA, tileB) {
        const expanded = new Set([tileA, tileB]);
        
        this.expandSpecialEffect(tileA, expanded);
        this.expandSpecialEffect(tileB, expanded);

        this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
    }

    // 計算特殊道具的爆炸影響區域
    expandSpecialEffect(tile, expandedSet) {
        if (tile.specialType === 'row_rocket') {
            this.createRocketBeam(tile.x, tile.y, true);
            this.scene.cameras.main.shake(200, 0.02);
            for (let c = 0; c < this.cols; c++) if (this.grid[tile.row][c]) expandedSet.add(this.grid[tile.row][c]);
        } else if (tile.specialType === 'col_rocket') {
            this.createRocketBeam(tile.x, tile.y, false);
            this.scene.cameras.main.shake(200, 0.02);
            for (let r = 0; r < this.rows; r++) if (this.grid[r][tile.col]) expandedSet.add(this.grid[r][tile.col]);
        } else if (tile.specialType === 'bomb') {
            this.createShockwave(tile.x, tile.y);
            this.scene.cameras.main.shake(300, 0.04);
            for (let r = Math.max(0, tile.row - 1); r <= Math.min(this.rows - 1, tile.row + 1); r++) {
                for (let c = Math.max(0, tile.col - 1); c <= Math.min(this.cols - 1, tile.col + 1); c++) {
                    if (this.grid[r][c]) expandedSet.add(this.grid[r][c]);
                }
            }
        }
    }

    // 特效 1：基礎爆破與飄浮分數
    createPopEffect(x, y, colorStr) {
        const flash = this.scene.add.circle(x, y, 20, 0xffffff, 0.8);
        this.add(flash);
        this.scene.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 300, onComplete: () => flash.destroy() });

        const scoreText = this.scene.add.text(x, y - 10, '+10', {
            fontSize: '24px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.add(scoreText);
        
        this.scene.tweens.add({
            targets: scoreText,
            y: y - 50,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => scoreText.destroy()
        });
    }

    // 特效 2：火箭貫穿雷射光束
    createRocketBeam(x, y, isRow) {
        const width = isRow ? 800 : 20;
        const height = isRow ? 20 : 800;
        
        const beam = this.scene.add.rectangle(x, y, width, height, 0xffffff, 1);
        this.add(beam);
        
        this.scene.tweens.add({
            targets: beam,
            scaleY: isRow ? 3 : 1,
            scaleX: isRow ? 1 : 3,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => beam.destroy()
        });
    }

    // 特效 3：炸彈衝擊波
    createShockwave(x, y) {
        const wave = this.scene.add.circle(x, y, 30, 0xffaa00, 1);
        this.add(wave);
        
        this.scene.tweens.add({
            targets: wave,
            scale: 8,
            alpha: 0,
            duration: 500,
            ease: 'Sine.easeOut',
            onComplete: () => wave.destroy()
        });
    }

    // 特效 4：彩虹球全場閃電束
    triggerRainbow(rainbowTile, otherTile) {
        const targetColor = otherTile.colorType;
        const toClear = [rainbowTile];
        const beams = [];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const t = this.grid[r][c];
                if (t && (t.colorType === targetColor || t === otherTile)) {
                    toClear.push(t);
                    
                    const line = this.scene.add.line(0, 0, rainbowTile.x, rainbowTile.y, t.x, t.y, 0xffffff, 0.8).setOrigin(0,0);
                    line.setLineWidth(4);
                    this.add(line);
                    beams.push(line);
                }
            }
        }

        this.scene.cameras.main.shake(400, 0.03);

        this.scene.time.delayedCall(300, () => {
            beams.forEach(b => b.destroy());
            this.clearMatches({ tiles: toClear, spawnSpecials: [] });
        });
    }

    checkMatchesDetailed() {
        const matchedTiles = new Set();
        const spawnSpecials = [];

        for (let r = 0; r < this.rows; r++) {
            let matchLen = 1;
            for (let c = 0; c < this.cols; c++) {
                const checkNext = (c < this.cols - 1) && this.grid[r][c] && this.grid[r][c + 1] &&
                    (this.grid[r][c].colorType === this.grid[r][c + 1].colorType) && this.grid[r][c].colorType !== 'rainbow';

                if (checkNext) { matchLen++; } else {
                    if (matchLen >= 3) {
                        for (let i = 0; i < matchLen; i++) matchedTiles.add(this.grid[r][c - i]);
                        if (matchLen === 4) spawnSpecials.push({ row: r, col: c - Math.floor(matchLen / 2), type: 'row_rocket', color: this.grid[r][c].colorType });
                        else if (matchLen >= 5) spawnSpecials.push({ row: r, col: c - Math.floor(matchLen / 2), type: 'rainbow', color: 'rainbow' });
                    }
                    matchLen = 1;
                }
            }
        }

        for (let c = 0; c < this.cols; c++) {
            let matchLen = 1;
            for (let r = 0; r < this.rows; r++) {
                const checkNext = (r < this.rows - 1) && this.grid[r][c] && this.grid[r + 1][c] &&
                    (this.grid[r][c].colorType === this.grid[r + 1][c].colorType) && this.grid[r][c].colorType !== 'rainbow';

                if (checkNext) { matchLen++; } else {
                    if (matchLen >= 3) {
                        for (let i = 0; i < matchLen; i++) matchedTiles.add(this.grid[r - i][c]);
                        if (matchLen === 4) spawnSpecials.push({ row: r - Math.floor(matchLen / 2), col: c, type: 'col_rocket', color: this.grid[r][c].colorType });
                        else if (matchLen >= 5) spawnSpecials.push({ row: r - Math.floor(matchLen / 2), col: c, type: 'rainbow', color: 'rainbow' });
                    }
                    matchLen = 1;
                }
            }
        }

        const expanded = new Set(matchedTiles);
        matchedTiles.forEach(tile => {
            this.expandSpecialEffect(tile, expanded);
        });

        return { tiles: Array.from(expanded), spawnSpecials };
    }

    clearMatches(matchesResult) {
        const matches = matchesResult.tiles;

        // 加分邏輯
        if (this.scene.score !== undefined) {
            this.scene.score += matches.length * 10;
            if (this.scene.scoreText) {
                this.scene.scoreText.setText('Score: ' + this.scene.score);
            }
        }

        matches.forEach(tile => {
            if (this.grid[tile.row] && this.grid[tile.row][tile.col] === tile) {
                this.grid[tile.row][tile.col] = null;
            }

            this.createPopEffect(tile.x, tile.y, tile.colorType);
            
            this.scene.tweens.add({
                targets: tile,
                scaleX: tile.scaleX * 1.3,
                scaleY: tile.scaleY * 1.3,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: tile,
                        scaleX: 0, scaleY: 0, alpha: 0, duration: 150,
                        onComplete: () => {
                            tile.destroy();
                        }
                    });
                }
            });
        });

        this.scene.time.delayedCall(360, () => {
            if (matchesResult.spawnSpecials) {
                matchesResult.spawnSpecials.forEach(sp => {
                    const posX = this.offsetX + sp.col * (this.tileSize + this.spacing);
                    const posY = this.offsetY + sp.row * (this.tileSize + this.spacing);
                    const newTile = new Tile(this.scene, posX, posY, `tile_${sp.color === 'rainbow' ? 'red' : sp.color}`, sp.row, sp.col);
                    newTile.setSpecial(sp.type);
                    
                    newTile.setScale(0);
                    this.add(newTile);
                    this.grid[sp.row][sp.col] = newTile;
                    
                    this.scene.tweens.add({
                        targets: newTile,
                        scaleX: newTile.baseScale, scaleY: newTile.baseScale,
                        duration: 400, ease: 'Bounce.easeOut'
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

                    const targetY = this.offsetY + targetRow * (this.tileSize + this.spacing);
                    dropTweens.push({ targets: tile, y: targetY, duration: 350, ease: 'Bounce.easeOut' });
                }
            }

            for (let i = 0; i < emptySlots; i++) {
                const targetRow = emptySlots - 1 - i;
                const randomColor = Phaser.Math.RND.pick(this.colors);

                const posX = this.offsetX + col * (this.tileSize + this.spacing);
                const startY = this.offsetY - (i + 1) * (this.tileSize + this.spacing) - 100;
                const targetY = this.offsetY + targetRow * (this.tileSize + this.spacing);

                const tile = new Tile(this.scene, posX, startY, `tile_${randomColor}`, targetRow, col);
                this.add(tile);
                this.grid[targetRow][col] = tile;

                dropTweens.push({ targets: tile, y: targetY, duration: 400 + (i * 50), ease: 'Bounce.easeOut' });
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
                                const newMatchesResult = this.checkMatchesDetailed();
                                if (newMatchesResult.tiles.length > 0) {
                                    this.clearMatches(newMatchesResult);
                                } else {
                                    this.isBusy = false;
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
}

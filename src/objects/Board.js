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

    selectTile(tile) {
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

        this.scene.tweens.add({ targets: tileA, x: posB.x, y: posB.y, duration: 200 });

        this.scene.tweens.add({
            targets: tileB, x: posA.x, y: posA.y, duration: 200,
            onComplete: () => {
                if (tileA.specialType === 'rainbow' || tileB.specialType === 'rainbow') {
                    this.triggerRainbow(tileA, tileB);
                    return;
                }

                const matchesResult = this.checkMatchesDetailed();
                if (matchesResult.tiles.length > 0) {
                    this.clearMatches(matchesResult);
                } else {
                    this.grid[rA][cA] = tileA;
                    this.grid[rB][cB] = tileB;
                    tileA.row = rA; tileA.col = cA;
                    tileB.row = rB; tileB.col = cB;

                    this.scene.tweens.add({ targets: tileA, x: posA.x, y: posA.y, duration: 200 });
                    this.scene.tweens.add({
                        targets: tileB, x: posB.x, y: posB.y, duration: 200,
                        onComplete: () => { this.isBusy = false; }
                    });
                }
            }
        });
    }

    triggerRainbow(rainbowTile, otherTile) {
        const targetColor = otherTile.colorType;
        const toClear = [rainbowTile];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const t = this.grid[r][c];
                if (t && (t.colorType === targetColor || t === otherTile)) {
                    toClear.push(t);
                }
            }
        }

        this.scene.cameras.main.shake(300, 0.02);
        this.clearMatches({ tiles: toClear, spawnSpecials: [] });
    }

    checkMatchesDetailed() {
        const matchedTiles = new Set();
        const spawnSpecials = [];

        // 橫向連線判定
        for (let r = 0; r < this.rows; r++) {
            let matchLen = 1;
            for (let c = 0; c < this.cols; c++) {
                const checkNext = (c < this.cols - 1) && this.grid[r][c] && this.grid[r][c + 1] &&
                    (this.grid[r][c].colorType === this.grid[r][c + 1].colorType);

                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        for (let i = 0; i < matchLen; i++) {
                            matchedTiles.add(this.grid[r][c - i]);
                        }
                        if (matchLen === 4) {
                            spawnSpecials.push({ row: r, col: c - Math.floor(matchLen / 2), type: 'row_rocket', color: this.grid[r][c].colorType });
                        } else if (matchLen >= 5) {
                            spawnSpecials.push({ row: r, col: c - Math.floor(matchLen / 2), type: 'rainbow', color: 'rainbow' });
                        }
                    }
                    matchLen = 1;
                }
            }
        }

        // 直向連線判定
        for (let c = 0; c < this.cols; c++) {
            let matchLen = 1;
            for (let r = 0; r < this.rows; r++) {
                const checkNext = (r < this.rows - 1) && this.grid[r][c] && this.grid[r + 1][c] &&
                    (this.grid[r][c].colorType === this.grid[r + 1][c].colorType);

                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        for (let i = 0; i < matchLen; i++) {
                            matchedTiles.add(this.grid[r - i][c]);
                        }
                        if (matchLen === 4) {
                            spawnSpecials.push({ row: r - Math.floor(matchLen / 2), col: c, type: 'col_rocket', color: this.grid[r][c].colorType });
                        } else if (matchLen >= 5) {
                            spawnSpecials.push({ row: r - Math.floor(matchLen / 2), col: c, type: 'rainbow', color: 'rainbow' });
                        }
                    }
                    matchLen = 1;
                }
            }
        }

        // 觸發特殊道具爆破連帶範圍
        const expanded = new Set(matchedTiles);
        let hasSpecialExploded = false;

        matchedTiles.forEach(tile => {
            if (tile.specialType === 'row_rocket') {
                hasSpecialExploded = true;
                for (let c = 0; c < this.cols; c++) if (this.grid[tile.row][c]) expanded.add(this.grid[tile.row][c]);
            } else if (tile.specialType === 'col_rocket') {
                hasSpecialExploded = true;
                for (let r = 0; r < this.rows; r++) if (this.grid[r][tile.col]) expanded.add(this.grid[r][tile.col]);
            } else if (tile.specialType === 'bomb') {
                hasSpecialExploded = true;
                for (let r = Math.max(0, tile.row - 1); r <= Math.min(this.rows - 1, tile.row + 1); r++) {
                    for (let c = Math.max(0, tile.col - 1); c <= Math.min(this.cols - 1, tile.col + 1); c++) {
                        if (this.grid[r][c]) expanded.add(this.grid[r][c]);
                    }
                }
            }
        });

        if (hasSpecialExploded) {
            this.scene.cameras.main.shake(200, 0.015);
        }

        return { tiles: Array.from(expanded), spawnSpecials };
    }

    createExplosionEffect(x, y) {
        // 生成粒子消除特效
        const emitter = this.scene.add.particles(x + this.x, y + this.y, 'tile_red', {
            speed: { min: 50, max: 200 },
            scale: { start: 0.2, end: 0 },
            lifespan: 300,
            blendMode: 'ADD',
            quantity: 8
        });

        this.scene.time.delayedCall(300, () => {
            emitter.destroy();
        });
    }

    clearMatches(matchesResult) {
        const matches = matchesResult.tiles;

        // 生成消除爆破粒子
        matches.forEach(tile => {
            this.createExplosionEffect(tile.x, tile.y);
        });

        this.scene.tweens.add({
            targets: matches,
            scaleX: 0, scaleY: 0, alpha: 0, duration: 200,
            onComplete: () => {
                matches.forEach(tile => {
                    this.grid[tile.row][tile.col] = null;
                    tile.destroy();
                });

                if (matchesResult.spawnSpecials) {
                    matchesResult.spawnSpecials.forEach(sp => {
                        const posX = this.offsetX + sp.col * (this.tileSize + this.spacing);
                        const posY = this.offsetY + sp.row * (this.tileSize + this.spacing);
                        const newTile = new Tile(this.scene, posX, posY, `tile_${sp.color === 'rainbow' ? 'red' : sp.color}`, sp.row, sp.col);
                        newTile.setSpecial(sp.type);
                        this.add(newTile);
                        this.grid[sp.row][sp.col] = newTile;
                    });
                }

                this.dropAndRefill();
            }
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
                    dropTweens.push({ targets: tile, y: targetY, duration: 250, ease: 'Bounce.easeOut' });
                }
            }

            for (let i = 0; i < emptySlots; i++) {
                const targetRow = emptySlots - 1 - i;
                const randomColor = Phaser.Math.RND.pick(this.colors);

                const posX = this.offsetX + col * (this.tileSize + this.spacing);
                const startY = this.offsetY - (i + 1) * (this.tileSize + this.spacing);
                const targetY = this.offsetY + targetRow * (this.tileSize + this.spacing);

                const tile = new Tile(this.scene, posX, startY, `tile_${randomColor}`, targetRow, col);
                this.add(tile);
                this.grid[targetRow][col] = tile;

                dropTweens.push({ targets: tile, y: targetY, duration: 250, ease: 'Bounce.easeOut' });
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
                            const newMatchesResult = this.checkMatchesDetailed();
                            if (newMatchesResult.tiles.length > 0) {
                                this.clearMatches(newMatchesResult);
                            } else {
                                this.isBusy = false;
                            }
                        }
                    }
                });
            });
        } else {
            this.isBusy = false;
        }
    }
}

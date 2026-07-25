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

        this.scene.tweens.add({
            targets: tileA,
            x: posB.x,
            y: posB.y,
            duration: 200
        });

        this.scene.tweens.add({
            targets: tileB,
            x: posA.x,
            y: posA.y,
            duration: 200,
            onComplete: () => {
                const matches = this.checkMatches();
                if (matches.length > 0) {
                    this.clearMatches(matches);
                } else {
                    this.grid[rA][cA] = tileA;
                    this.grid[rB][cB] = tileB;
                    tileA.row = rA; tileA.col = cA;
                    tileB.row = rB; tileB.col = cB;

                    this.scene.tweens.add({
                        targets: tileA,
                        x: posA.x,
                        y: posA.y,
                        duration: 200
                    });

                    this.scene.tweens.add({
                        targets: tileB,
                        x: posB.x,
                        y: posB.y,
                        duration: 200,
                        onComplete: () => {
                            this.isBusy = false;
                        }
                    });
                }
            }
        });
    }

    checkMatches() {
        const matchedTiles = new Set();

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                const t1 = this.grid[r][c];
                const t2 = this.grid[r][c + 1];
                const t3 = this.grid[r][c + 2];

                if (t1 && t2 && t3 && t1.colorType === t2.colorType && t1.colorType === t3.colorType) {
                    matchedTiles.add(t1);
                    matchedTiles.add(t2);
                    matchedTiles.add(t3);
                }
            }
        }

        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows - 2; r++) {
                const t1 = this.grid[r][c];
                const t2 = this.grid[r + 1][c];
                const t3 = this.grid[r + 2][c];

                if (t1 && t2 && t3 && t1.colorType === t2.colorType && t1.colorType === t3.colorType) {
                    matchedTiles.add(t1);
                    matchedTiles.add(t2);
                    matchedTiles.add(t3);
                }
            }
        }

        return Array.from(matchedTiles);
    }

    clearMatches(matches) {
        this.scene.tweens.add({
            targets: matches,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                matches.forEach(tile => {
                    this.grid[tile.row][tile.col] = null;
                    tile.destroy();
                });
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

                    dropTweens.push({
                        targets: tile,
                        y: targetY,
                        duration: 250,
                        ease: 'Bounce.easeOut'
                    });
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

                dropTweens.push({
                    targets: tile,
                    y: targetY,
                    duration: 250,
                    ease: 'Bounce.easeOut'
                });
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
                            const newMatches = this.checkMatches();
                            if (newMatches.length > 0) {
                                this.clearMatches(newMatches);
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

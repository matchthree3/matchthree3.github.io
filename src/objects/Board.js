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
        this.isBusy = false; // 播放動畫時禁止操作

        this.createGrid();
    }

    createGrid() {
        const colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        const offsetX = -((this.cols * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);
        const offsetY = -((this.rows * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);

        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                let randomColor;
                // 初始生成時避免直接出現 3 連線
                do {
                    randomColor = Phaser.Math.RND.pick(colors);
                } while (
                    (col >= 2 && this.grid[row][col - 1].colorType === randomColor && this.grid[row][col - 2].colorType === randomColor) ||
                    (row >= 2 && this.grid[row - 1][col].colorType === randomColor && this.grid[row - 2][col].colorType === randomColor)
                );

                const posX = offsetX + col * (this.tileSize + this.spacing);
                const posY = offsetY + row * (this.tileSize + this.spacing);

                const tile = new Tile(this.scene, posX, posY, `tile_${randomColor}`, row, col);
                this.add(tile);
                this.grid[row][col] = tile;
            }
        }
    }

    selectTile(tile) {
        if (!this.selectedTile) {
            // 第一次點擊：選取
            this.selectedTile = tile;
            tile.setSelected(true);
        } else if (this.selectedTile === tile) {
            // 點擊同一個：取消選取
            this.selectedTile.setSelected(false);
            this.selectedTile = null;
        } else {
            // 點擊第二個：檢查是否相鄰
            const isNeighbor = (Math.abs(this.selectedTile.row - tile.row) + Math.abs(this.selectedTile.col - tile.col)) === 1;

            if (isNeighbor) {
                const tileA = this.selectedTile;
                const tileB = tile;
                tileA.setSelected(false);
                this.selectedTile = null;
                this.swapTiles(tileA, tileB);
            } else {
                // 不相鄰，改選新點擊的方塊
                this.selectedTile.setSelected(false);
                this.selectedTile = tile;
                tile.setSelected(true);
            }
        }
    }

    swapTiles(tileA, tileB) {
        this.isBusy = true;

        // 更新網陣中的位置紀錄
        const rA = tileA.row, cA = tileA.col;
        const rB = tileB.row, cB = tileB.col;

        this.grid[rA][cA] = tileB;
        this.grid[rB][cB] = tileA;

        tileA.row = rB; tileA.col = cB;
        tileB.row = rA; tileB.col = cA;

        // 位移動畫
        this.scene.tweens.add({
            targets: tileA,
            x: tileB.x,
            y: tileB.y,
            duration: 200
        });

        this.scene.tweens.add({
            targets: tileB,
            x: tileA.x,
            y: tileA.y,
            duration: 200,
            onComplete: () => {
                const matches = this.checkMatches();
                if (matches.length > 0) {
                    // 有連線成功
                    this.clearMatches(matches);
                } else {
                    // 無連線：彈回原位
                    this.grid[rA][cA] = tileA;
                    this.grid[rB][cB] = tileB;
                    tileA.row = rA; tileA.col = cA;
                    tileB.row = rB; tileB.col = cB;

                    this.scene.tweens.add({
                        targets: tileA,
                        x: tileB.x,
                        y: tileB.y,
                        duration: 200
                    });

                    this.scene.tweens.add({
                        targets: tileB,
                        x: tileA.x,
                        y: tileA.y,
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

        // 檢查橫向
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

        // 檢查直向
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
        // 縮小淡出消除動畫
        this.scene.tweens.add({
            targets: matches,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 250,
            onComplete: () => {
                matches.forEach(tile => {
                    this.grid[tile.row][tile.col] = null;
                    tile.destroy();
                });
                this.isBusy = false;
                // 下一步：消除後掉落補位與分數計算
            }
        });
    }
}

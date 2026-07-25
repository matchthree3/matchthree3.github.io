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

        this.createGrid();
    }

    createGrid() {
        const colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        const offsetX = -((this.cols * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);
        const offsetY = -((this.rows * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);

        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                const randomColor = Phaser.Math.RND.pick(colors);
                const posX = offsetX + col * (this.tileSize + this.spacing);
                const posY = offsetY + row * (this.tileSize + this.spacing);

                const tile = new Tile(this.scene, posX, posY, `tile_${randomColor}`, row, col);
                this.add(tile);
                this.grid[row][col] = tile;
            }
        }
    }
}

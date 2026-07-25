import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // --- 修改這裡：載入你上傳的真實軟糖圖片 ---
        this.load.image('tile_red', 'assets/tile_red.png');
        this.load.image('tile_blue', 'assets/tile_blue.png');
        this.load.image('tile_yellow', 'assets/tile_yellow.png');
        this.load.image('tile_green', 'assets/tile_green.png');
        this.load.image('tile_purple', 'assets/tile_purple.png');
        // ----------------------------------------------------
    }

    create() {
        this.scene.start('GameScene');
    }
}

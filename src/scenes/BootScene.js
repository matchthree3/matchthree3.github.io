import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // 基礎水果軟糖
        this.load.image('tile_red', 'assets/tile_red.png');
        this.load.image('tile_blue', 'assets/tile_blue.png');
        this.load.image('tile_yellow', 'assets/tile_yellow.png');
        this.load.image('tile_green', 'assets/tile_green.png');
        this.load.image('tile_purple', 'assets/tile_purple.png');

        // 特殊爆破道具圖案
        this.load.image('tile_rocket', 'assets/tile_rocket.png');
        this.load.image('tile_rainbow', 'assets/tile_rainbow.png');
        this.load.image('tile_bomb', 'assets/tile_bomb.png');
    }

    create() {
        this.scene.start('MenuScene');
    }
}

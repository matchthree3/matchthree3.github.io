import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        const colors = {
            'red': 0xff4d4d,
            'blue': 0x4d94ff,
            'green': 0x4dff4d,
            'yellow': 0xffff4d,
            'purple': 0xff4dff
        };

        for (const [key, color] of Object.entries(colors)) {
            const graphics = this.add.graphics();
            graphics.fillStyle(color, 1);
            graphics.fillRoundedRect(0, 0, 64, 64, 16);
            graphics.generateTexture(`tile_${key}`, 64, 64);
            graphics.destroy();
        }
    }

    create() {
        this.scene.start('GameScene');
    }
}

import Phaser from 'phaser';

export default class Tile extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, row, col) {
        super(scene, x, y, texture);
        scene.add.existing(this);

        this.row = row;
        this.col = col;

        this.setInteractive();
        this.on('pointerdown', this.onClick, this);
    }

    onClick() {
        this.setTint(0xaaaaaa);
        this.scene.time.delayedCall(100, () => {
            this.clearTint();
        });
    }
}

import Phaser from 'phaser';

export default class Tile extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, row, col) {
        super(scene, x, y, texture);
        scene.add.existing(this);

        this.row = row;
        this.col = col;
        this.colorType = texture.replace('tile_', ''); // 紀錄顏色標籤 (red, blue, 等)

        this.setInteractive();
        this.on('pointerdown', this.onPointerDown, this);
    }

    onPointerDown() {
        // 觸發 Board 的選取機制
        if (this.scene.board && !this.scene.board.isBusy) {
            this.scene.board.selectTile(this);
        }
    }

    setSelected(selected) {
        if (selected) {
            this.setAlpha(0.6);
            this.setScale(0.9);
        } else {
            this.setAlpha(1);
            this.setScale(1);
        }
    }
}

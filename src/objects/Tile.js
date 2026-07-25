import Phaser from 'phaser';

export default class Tile extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, row, col) {
        super(scene, x, y, texture);
        scene.add.existing(this);

        this.row = row;
        this.col = col;
        this.colorType = texture.replace('tile_', '');

        this.setInteractive();
        
        this.scene.input.setDraggable(this);

        this.on('pointerdown', this.onPointerDown, this);
        this.on('dragstart', this.onDragStart, this);
        this.on('dragend', this.onDragEnd, this);
    }

    onPointerDown() {
        if (this.scene.board && !this.scene.board.isBusy) {
            this.scene.board.selectTile(this);
        }
    }

    onDragStart(pointer) {
        if (this.scene.board && !this.scene.board.isBusy) {
            this.startX = pointer.x;
            this.startY = pointer.y;
        }
    }

    onDragEnd(pointer) {
        if (!this.scene.board || this.scene.board.isBusy) return;

        const deltaX = pointer.x - this.startX;
        const deltaY = pointer.y - this.startY;
        const threshold = 20;

        let targetRow = this.row;
        let targetCol = this.col;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > threshold) targetCol += 1;
            else if (deltaX < -threshold) targetCol -= 1;
        } else {
            if (deltaY > threshold) targetRow += 1;
            else if (deltaY < -threshold) targetRow -= 1;
        }

        if (targetRow !== this.row || targetCol !== this.col) {
            this.scene.board.handleDragSwap(this, targetRow, targetCol);
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

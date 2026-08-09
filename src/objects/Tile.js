import Phaser from 'phaser';

export default class Tile extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, row, col) {
        super(scene, x, y, texture);
        scene.add.existing(this);

        this.row = row;
        this.col = col;
        this.colorType = texture.replace('tile_', '');
        this.specialType = 'none';

        // 強制根據 64px 限制縮放，防止大圖爆開
        const targetSize = 64;
        this.baseScale = targetSize / Math.max(this.width, this.height);
        this.setScale(this.baseScale);

        this.setInteractive();
        this.scene.input.setDraggable(this);

        this.on('pointerdown', this.onPointerDown, this);
        this.on('dragstart', this.onDragStart, this);
        this.on('dragend', this.onDragEnd, this);
    }

    setSpecial(type) {
        this.specialType = type;
        this.clearTint();

        if (type === 'row_rocket' || type === 'col_rocket') {
            this.setTexture('tile_rocket');
            // 上傳直立圖片時：row_rocket (橫爆) 轉 90 度，col_rocket (直爆) 轉 0 度
            this.setAngle(type === 'row_rocket' ? 90 : 0);
        } else if (type === 'bomb') {
            this.setTexture('tile_bomb');
            this.setAngle(0);
        } else if (type === 'rainbow') {
            this.setTexture('tile_rainbow');
            this.colorType = 'rainbow';
            this.setAngle(0);
        }

        const targetSize = 64;
        this.baseScale = (targetSize / Math.max(this.width, this.height)) * (type === 'none' ? 1 : 1.1);
        this.setScale(this.baseScale);
    }

    onPointerDown() {
        if (this.scene.board && !this.scene.board.isBusy) {
            this.scene.board.selectTile(this);
        }
    }

    onDragStart(pointer) {
        if (this.scene.board && !this.scene.board.isBusy) {
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
        }
    }

    onDragEnd(pointer) {
        const diffX = pointer.x - this.dragStartX;
        const diffY = pointer.y - this.dragStartY;
        const threshold = 20;

        if (Math.abs(diffX) > threshold || Math.abs(diffY) > threshold) {
            let targetRow = this.row;
            let targetCol = this.col;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                targetCol += diffX > 0 ? 1 : -1;
            } else {
                targetRow += diffY > 0 ? 1 : -1;
            }

            if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
                this.scene.board.handleDragSwap(this, targetRow, targetCol);
            }
        }
    }

    setSelected(selected) {
        if (selected) {
            this.setAlpha(0.7);
            this.setScale(this.baseScale * 0.9);
        } else {
            this.setAlpha(1);
            this.setScale(this.baseScale);
        }
    }
}

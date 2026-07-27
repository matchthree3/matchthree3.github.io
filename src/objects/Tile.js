import Phaser from 'phaser';

export default class Tile extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, row, col) {
        super(scene, x, y, texture);
        scene.add.existing(this);

        this.row = row;
        this.col = col;
        this.colorType = texture.replace('tile_', '');
        this.specialType = 'none';

        // 依據格子 64px 自動計算縮放
        const targetSize = 64;
        this.baseScale = targetSize / Math.max(this.width, this.height);
        this.setScale(this.baseScale);

        this.setInteractive();
        this.scene.input.setDraggable(this);

        this.on('pointerdown', this.onPointerDown, this);
        this.on('dragstart', this.onDragStart, this);
        this.on('dragend', this.onDragEnd, this);
    }

    // 設定特殊道具樣式與貼圖
    setSpecial(type) {
        this.specialType = type;
        this.clearTint();

        if (type === 'row_rocket' || type === 'col_rocket') {
            this.setTexture('tile_rocket');
            // 直向火箭旋轉 90 度區分方向
            if (type === 'col_rocket') {
                this.setAngle(90);
            }
        } else if (type === 'bomb') {
            this.setTexture('tile_bomb');
        } else if (type === 'rainbow') {
            this.setTexture('tile_rainbow');
            this.colorType = 'rainbow';
        }

        // 更換貼圖後重新依原圖尺寸調整為 64px 比例
        const targetSize = 64;
        this.baseScale = targetSize / Math.max(this.width, this.height);
        this.setScale(this.baseScale);
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
            this.setAlpha(0.7);
            this.setScale(this.baseScale * 0.9);
        } else {
            this.setAlpha(1);
            this.setScale(this.baseScale);
        }
    }
}

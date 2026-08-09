import Phaser from 'phaser';

export default class Tile extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, row, col) {
        super(scene, x, y, texture);
        scene.add.existing(this);

        this.row = row;
        this.col = col;
        this.colorType = texture.replace('tile_', '');
        this.specialType = 'none'; // 'none', 'row_rocket', 'col_rocket', 'bomb', 'rainbow'
        this.baseScale = 1;

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
            // row_rocket (水平貫穿): 旋轉 90 度讓直立圖案平躺
            // col_rocket (垂直貫穿): 保持 0 度直立
            if (type === 'row_rocket') {
                this.setAngle(90);
            } else {
                this.setAngle(0);
            }
        } else if (type === 'bomb') {
            this.setTexture('tile_bomb');
        } else if (type === 'rainbow') {
            this.setTexture('tile_rainbow');
            this.colorType = 'rainbow';
        }

        const maxDim = Math.max(this.width, this.height);
        this.baseScale = (64 / maxDim) * (type === 'none' ? 1 : 1.15);
        this.setScale(this.baseScale);
    }

    onPointerDown() {
        this.scene.board.selectTile(this);
    }

    onDragStart(pointer) {
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
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

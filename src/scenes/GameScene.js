import Phaser from 'phaser';
import Board from '../objects/Board.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        // 使用高解析度字形渲染，大幅提升高清螢幕下的文字銳利度
        const scoreText = this.add.text(270, 100, 'Score: 0', {
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        // 縮放回原本合適的大小
        scoreText.setScale(0.6);

        this.board = new Board(this, 270, 520);
    }
}

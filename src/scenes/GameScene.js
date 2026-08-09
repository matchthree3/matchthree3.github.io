import Phaser from 'phaser';
import Board from '../objects/Board.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create(data) {
        // 1. 初始化分數與關卡資料 (解決分數不增加的 Bug)
        this.score = 0;
        this.levelData = data || { id: 1, target: 1000, moves: 20 };

        // 2. 顯示高解析度分數文字並掛載至場景
        this.scoreText = this.add.text(270, 80, 'Score: 0', {
            fontSize: '64px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        this.scoreText.setScale(0.6);

        // 3. 建立棋盤物件
        this.board = new Board(this, 270, 520);
    }
}

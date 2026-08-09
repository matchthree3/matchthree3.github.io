import Phaser from 'phaser';
import Board from '../objects/Board.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create(data) {
        // 1. 接收關卡資料 (來自 MenuScene 或預設關卡 1)
        this.levelData = data || { id: 1, name: '第一關', target: 500, moves: 20 };
        this.score = 0;
        this.movesLeft = this.levelData.moves;
        this.isGameOver = false;

        // 2. UI 介面顯示
        this.add.text(270, 40, this.levelData.name, {
            fontSize: '32px', fontStyle: 'bold', color: '#ffd700'
        }).setOrigin(0.5);

        this.scoreText = this.add.text(150, 90, `Score: 0 / ${this.levelData.target}`, {
            fontSize: '28px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);

        this.movesText = this.add.text(390, 90, `Moves: ${this.movesLeft}`, {
            fontSize: '28px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);

        // 3. 載入 8x8 棋盤
        this.board = new Board(this, 270, 520);
    }

    // 扣除步數 (由 Board 呼叫)
    useMove() {
        if (this.isGameOver) return;
        this.movesLeft--;
        this.movesText.setText(`Moves: ${this.movesLeft}`);

        this.checkGameEndStatus();
    }

    // 更新分數與勝負檢查
    updateScore(amount) {
        if (this.isGameOver) return;
        this.scoreText.setText(`Score: ${this.score} / ${this.levelData.target}`);
        this.checkGameEndStatus();
    }

    checkGameEndStatus() {
        if (this.isGameOver) return;

        // 勝利判定
        if (this.score >= this.levelData.target) {
            this.isGameOver = true;
            this.showEndDialog(true);
        } 
        // 失敗判定 (步數用盡且無後續連鎖)
        else if (this.movesLeft <= 0) {
            this.isGameOver = true;
            this.time.delayedCall(500, () => this.showEndDialog(false));
        }
    }

    // 彈出勝利/失敗面板
    showEndDialog(isWin) {
        this.board.isBusy = true; // 鎖定棋盤不讓玩家繼續操作

        const bg = this.add.rectangle(270, 480, 400, 300, 0x000000, 0.85);
        
        const titleText = isWin ? '關卡完成！🌟' : '挑戰失敗 💔';
        this.add.text(270, 400, titleText, {
            fontSize: '40px', fontStyle: 'bold', color: isWin ? '#4dff9d' : '#ff4d4d'
        }).setOrigin(0.5);

        const btnText = isWin ? '返回選關' : '重新挑戰';
        const button = this.add.text(270, 520, btnText, {
            fontSize: '32px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#3388ff', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        button.on('pointerdown', () => {
            this.scene.start(isWin ? 'MenuScene' : 'GameScene', this.levelData);
        });
    }
}

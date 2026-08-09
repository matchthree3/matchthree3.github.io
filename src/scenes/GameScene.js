import Phaser from 'phaser';
import Board from '../objects/Board.js';
import UIHelper from '../utils/UIHelper.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        // 接收傳入的關卡資料，若無預設為第 1 關
        this.levelData = data && data.id ? data : {
            id: 1,
            name: '第一關',
            target: 500,
            moves: 20,
            stars: { 1: 500, 2: 800, 3: 1200 }
        };

        // 補充預設星級門檻 (若未帶入)
        if (!this.levelData.stars) {
            const target = this.levelData.target || 500;
            this.levelData.stars = {
                1: target,
                2: Math.floor(target * 1.5),
                3: Math.floor(target * 2.2)
            };
        }

        this.score = 0;
        this.moves = this.levelData.moves || 20;
        this.isGameOver = false;
    }

    create() {
        const { width, height } = this.scale;

        // 1. 背景天藍漸層
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x3B82F6, 0x3B82F6, 0x6366F1, 0x8B5CF6, 1);
        bg.fillRect(0, 0, width, height);

        // 2. 建立頂部遊戲 HUD 面板
        this.createHUD(width);

        // 3. 建立 8x8 三消棋盤 (置中)
        this.board = new Board(this, width / 2, height / 2 + 30);

        // 4. 底部返回地圖按鈕
        UIHelper.createButton(this, 70, height - 40, 100, 40, '🏠 地圖', '', 0x6C5CE7, 0x3B27B2, () => {
            this.scene.start('MenuScene');
        });
    }

    createHUD(width) {
        // HUD 背景奶油圓角卡片
        const hudBg = this.add.graphics();
        hudBg.fillStyle(0x000000, 0.2);
        hudBg.fillRoundedRect(16, 16, width - 32, 100, 16);
        hudBg.fillStyle(0xFFFDF0, 1);
        hudBg.fillRoundedRect(20, 20, width - 40, 92, 14);
        hudBg.lineStyle(3, 0x8B5A2B, 1);
        hudBg.strokeRoundedRect(20, 20, width - 40, 92, 14);

        // 關卡標題
        this.add.text(width / 2, 38, `第 ${this.levelData.id} 關`, {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#8B5A2B'
        }).setOrigin(0.5);

        // 分數顯示與目標
        this.scoreText = this.add.text(40, 70, `★ 0 / ${this.levelData.target}`, {
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#D97706'
        });

        // 剩餘步數
        this.movesText = this.add.text(width - 50, 70, `${this.moves} 步`, {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#EF4444'
        }).setOrigin(1, 0);
    }

    /**
     * 正確累加分數並檢測勝負條件 (大師指定修復點)
     */
    updateScore(amount) {
        if (this.isGameOver) return;

        // 【大師指定修正】正確進行分數加總
        this.score += amount;

        // 更新 HUD 文字
        if (this.scoreText) {
            this.scoreText.setText(`★ ${this.score} / ${this.levelData.target}`);
        }

        // 檢查是否達成通關目標 (達到 1 星門檻即可過關)
        if (this.score >= this.levelData.target && !this.isGameOver) {
            // 不立刻中斷，等步數完畢或觸發勝利 Modal
        }
    }

    /**
     * 步數扣除與勝負判定 (由 Board.js 在每次無效/有效交換時呼叫或同步)
     */
    onMoveUsed() {
        if (this.isGameOver) return;

        if (this.movesText) {
            this.movesText.setText(`${this.moves} 步`);
        }

        // 步數耗盡：進行勝負結算
        if (this.moves <= 0) {
            this.time.delayedCall(600, () => {
                this.checkLevelEnd();
            });
        }
    }

    checkLevelEnd() {
        if (this.isGameOver) return;
        this.isGameOver = true;

        const isWin = this.score >= this.levelData.target;
        
        // 計算獲得星數 (1 ~ 3 星)
        let earnedStars = 0;
        if (this.score >= this.levelData.stars[3]) earnedStars = 3;
        else if (this.score >= this.levelData.stars[2]) earnedStars = 2;
        else if (this.score >= this.levelData.stars[1]) earnedStars = 1;

        if (isWin) {
            // 儲存通關進度至 LocalStorage
            const saved = JSON.parse(localStorage.getItem('match3_progress') || '{}');
            const currentMax = saved.maxUnlocked || 1;
            const nextLevel = this.levelData.id + 1;
            
            saved.maxUnlocked = Math.max(currentMax, nextLevel);
            saved[`level_${this.levelData.id}_stars`] = Math.max(saved[`level_${this.levelData.id}_stars`] || 0, earnedStars);
            localStorage.setItem('match3_progress', JSON.stringify(saved));

            this.showVictoryModal(earnedStars);
        } else {
            this.showDefeatModal();
        }
    }

    /**
     * 勝利結算彈窗 (1~3 星依次彈跳動畫)
     */
    showVictoryModal(earnedStars) {
        const { width, height } = this.scale;
        const container = this.add.container(width / 2, height / 2).setDepth(100);

        // 半透明黑底遮罩
        const mask = this.add.graphics();
        mask.fillStyle(0x000000, 0.6);
        mask.fillRect(-width / 2, -height / 2, width, height);

        // 主面板
        const panel = this.add.graphics();
        panel.fillStyle(0x8B5A2B, 1);
        panel.fillRoundedRect(-160, -180, 320, 360, 24);
        panel.fillStyle(0xFFFDF0, 1);
        panel.fillRoundedRect(-154, -174, 308, 348, 20);

        // 標題
        const title = this.add.text(0, -130, '關卡完成！', {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#D97706',
            stroke: '#5A3311',
            strokeThickness: 4
        }).setOrigin(0.5);

        // 得分顯示
        const scoreLbl = this.add.text(0, -10, `最終得分：${this.score}`, {
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#4B5563'
        }).setOrigin(0.5);

        container.add([mask, panel, title, scoreLbl]);

        // 1~3 星星動畫（ scale: 0 -> 1.2 -> 1 依次彈出）
        for (let i = 0; i < 3; i++) {
            const starX = (i - 1) * 60;
            const isLit = i < earnedStars;

            const star = this.add.text(starX, -70, '★', {
                fontSize: '48px',
                color: isLit ? '#FFD700' : '#D1D5DB',
                stroke: isLit ? '#B45309' : '#4B5563',
                strokeThickness: isLit ? 4 : 2
            }).setOrigin(0.5).setScale(0);

            container.add(star);

            // 依次延遲彈出動畫
            this.tweens.add({
                targets: star,
                scale: 1,
                duration: 400,
                delay: 300 + (i * 250),
                ease: 'Back.easeOut'
            });
        }

        // 按鈕 1：下一關 (主要 CTA)
        const nextLevelId = this.levelData.id + 1;
        UIHelper.createButton(this, width / 2, height / 2 + 80, 180, 50, '▶ 下一關', '', 0xFFB700, 0x8B5A2B, () => {
            this.scene.start('GameScene', { id: nextLevelId, name: `第 ${nextLevelId} 關`, target: 500 + nextLevelId * 300, moves: 20 });
        });

        // 按鈕 2：返回選關
        UIHelper.createButton(this, width / 2, height / 2 + 140, 180, 44, '選擇關卡', '', 0x9CA3AF, 0x4B5563, () => {
            this.scene.start('MenuScene');
        });
    }

    /**
     * 失敗結算彈窗
     */
    showDefeatModal() {
        const { width, height } = this.scale;
        const container = this.add.container(width / 2, height / 2).setDepth(100);

        const mask = this.add.graphics();
        mask.fillStyle(0x000000, 0.6);
        mask.fillRect(-width / 2, -height / 2, width, height);

        const panel = this.add.graphics();
        panel.fillStyle(0x4B5563, 1);
        panel.fillRoundedRect(-150, -140, 300, 280, 24);
        panel.fillStyle(0xFFFDF0, 1);
        panel.fillRoundedRect(-144, -134, 288, 268, 20);

        const title = this.add.text(0, -90, '步數用盡！', {
            fontSize: '30px',
            fontStyle: 'bold',
            color: '#EF4444'
        }).setOrigin(0.5);

        const info = this.add.text(0, -30, `還差 ${Math.max(0, this.levelData.target - this.score)} 分`, {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#6B7280'
        }).setOrigin(0.5);

        container.add([mask, panel, title, info]);

        // 重試按鈕
        UIHelper.createButton(this, width / 2, height / 2 + 30, 160, 48, '🔄 重試', '', 0xFFB700, 0x8B5A2B, () => {
            this.scene.start('GameScene', this.levelData);
        });

        // 選關按鈕
        UIHelper.createButton(this, width / 2, height / 2 + 88, 160, 40, '選擇關卡', '', 0x9CA3AF, 0x4B5563, () => {
            this.scene.start('MenuScene');
        });
    }
}

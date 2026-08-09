import Phaser from 'phaser';
import Board from '../objects/Board.js';
import UIHelper from '../utils/UIHelper.js';
import LevelConfig from '../config/LevelConfig.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.levelData = (data && data.id)
            ? { ...LevelConfig.getLevel(data.id), ...data }
            : LevelConfig.getLevel(1);

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

        const bg = this.add.graphics();
        bg.fillGradientStyle(0x3B82F6, 0x3B82F6, 0x6366F1, 0x8B5CF6, 1);
        bg.fillRect(0, 0, width, height);

        this.createHUD(width);

        this.board = new Board(this, width / 2, height / 2 + 30);

        UIHelper.createButton(this, 70, height - 40, 100, 40, '🏠 地圖', '', 0x6C5CE7, 0x3B27B2, () => {
            this.scene.start('MenuScene');
        });
    }

    createHUD(width) {
        const hudBg = this.add.graphics();
        hudBg.fillStyle(0x000000, 0.2);
        hudBg.fillRoundedRect(16, 16, width - 32, 100, 16);
        hudBg.fillStyle(0xFFFDF0, 1);
        hudBg.fillRoundedRect(20, 20, width - 40, 92, 14);
        hudBg.lineStyle(3, 0x8B5A2B, 1);
        hudBg.strokeRoundedRect(20, 20, width - 40, 92, 14);

        this.add.text(width / 2, 38, `第 ${this.levelData.id} 關`, {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#8B5A2B'
        }).setOrigin(0.5);

        this.scoreText = this.add.text(40, 70, `★ 0 / ${this.levelData.target}`, {
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#D97706'
        });

        this.movesText = this.add.text(width - 50, 70, `${this.moves} 步`, {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#EF4444'
        }).setOrigin(1, 0);
    }

    updateScore(amount) {
        if (this.isGameOver || !amount) return;
        this.score += amount;
        if (this.scoreText) {
            this.scoreText.setText(`★ ${this.score} / ${this.levelData.target}`);
            this.tweens.killTweensOf(this.scoreText);
            this.scoreText.setScale(1.15);
            this.tweens.add({ targets: this.scoreText, scale: 1, duration: 180, ease: 'Back.easeOut' });
        }
    }

    onMoveUsed() {
        if (this.isGameOver) return;
        this.moves--;
        if (this.movesText) {
            this.movesText.setText(`${this.moves} 步`);
            if (this.moves <= 3) {
                this.movesText.setColor('#DC2626');
                this.tweens.add({ targets: this.movesText, scale: 1.3, duration: 150, yoyo: true, ease: 'Sine.easeInOut' });
            }
        }
        if (this.moves <= 0) {
            this.time.delayedCall(600, () => this.checkLevelEnd());
        }
    }

    checkLevelEnd() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        const isWin = this.score >= this.levelData.target;

        let earnedStars = 0;
        if (this.score >= this.levelData.stars[3]) earnedStars = 3;
        else if (this.score >= this.levelData.stars[2]) earnedStars = 2;
        else if (this.score >= this.levelData.stars[1]) earnedStars = 1;

        if (isWin) {
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

    showVictoryModal(earnedStars) {
        const { width, height } = this.scale;
        const container = this.add.container(width / 2, height / 2).setDepth(100);

        const mask = this.add.graphics();
        mask.fillStyle(0x000000, 0.6);
        mask.fillRect(-width / 2, -height / 2, width, height);

        const panel = this.add.graphics();
        panel.fillStyle(0x8B5A2B, 1);
        panel.fillRoundedRect(-160, -180, 320, 360, 24);
        panel.fillStyle(0xFFFDF0, 1);
        panel.fillRoundedRect(-154, -174, 308, 348, 20);

        const title = this.add.text(0, -130, '關卡完成！', {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#D97706',
            stroke: '#5A3311',
            strokeThickness: 4
        }).setOrigin(0.5);

        const scoreLbl = this.add.text(0, -10, `最終得分：${this.score}`, {
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#4B5563'
        }).setOrigin(0.5);

        container.add([mask, panel, title, scoreLbl]);
        container.setScale(0.7).setAlpha(0);
        this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

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

            this.tweens.add({
                targets: star,
                scale: 1,
                duration: 400,
                delay: 300 + (i * 250),
                ease: 'Back.easeOut'
            });

            if (isLit) {
                this.time.delayedCall(300 + (i * 250) + 400, () => {
                    this.tweens.add({ targets: star, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, repeat: 2 });
                });
            }
        }

        const nextLevelId = this.levelData.id + 1;
        UIHelper.createButton(this, width / 2, height / 2 + 80, 180, 50, '▶ 下一關', '', 0xFFB700, 0x8B5A2B, () => {
            this.scene.start('GameScene', LevelConfig.getLevel(nextLevelId));
        });

        UIHelper.createButton(this, width / 2, height / 2 + 140, 180, 44, '選擇關卡', '', 0x9CA3AF, 0x4B5563, () => {
            this.scene.start('MenuScene');
        });
    }

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
        container.setScale(0.7).setAlpha(0);
        this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });

        UIHelper.createButton(this, width / 2, height / 2 + 30, 160, 48, '🔄 重試', '', 0xFFB700, 0x8B5A2B, () => {
            this.scene.start('GameScene', this.levelData);
        });

        UIHelper.createButton(this, width / 2, height / 2 + 88, 160, 40, '選擇關卡', '', 0x9CA3AF, 0x4B5563, () => {
            this.scene.start('MenuScene');
        });
    }
}

import Phaser from 'phaser';
import UIHelper from '../utils/UIHelper.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.scale;

        // 1. 溫暖的天空藍漸層背景與遠景裝飾
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x4A90E2, 0x4A90E2, 0x50E3C2, 0x50E3C2, 1);
        bg.fillRect(0, 0, width, height);

        // 背景微動雲朵
        for (let i = 0; i < 5; i++) {
            const cloudX = Phaser.Math.Between(50, width - 50);
            const cloudY = Phaser.Math.Between(80, height - 100);
            const cloud = this.add.circle(cloudX, cloudY, Phaser.Math.Between(30, 60), 0xFFFFFF, 0.25);
            this.tweens.add({
                targets: cloud,
                x: cloudX + 30,
                duration: Phaser.Math.Between(3000, 5000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // 2. 主標題 Panel / Logo
        const titleText = this.add.text(width / 2, 80, 'SWEET MATCH', {
            fontSize: '40px',
            fontStyle: 'bold',
            color: '#FFFDF0',
            stroke: '#7A4B1A',
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 6, color: '#000000', blur: 4, fill: true }
        }).setOrigin(0.5);

        // 標題輕微浮動
        this.tweens.add({
            targets: titleText,
            y: 85,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 3. 關卡資料與本地存檔讀取 (LocalStorage)
        const savedProgress = JSON.parse(localStorage.getItem('match3_progress') || '{}');
        const levels = [
            { id: 1, name: '第一關', target: 500, moves: 20, x: width * 0.25, y: height * 0.78 },
            { id: 2, name: '第二關', target: 1000, moves: 18, x: width * 0.65, y: height * 0.64 },
            { id: 3, name: '第三關', target: 1800, moves: 15, x: width * 0.35, y: height * 0.50 },
            { id: 4, name: '第四關', target: 2500, moves: 15, x: width * 0.70, y: height * 0.36 },
            { id: 5, name: '第五關', target: 3500, moves: 12, x: width * 0.45, y: height * 0.22 }
        ];

        // 4. 繪製關卡之間的連接線/虛線道路 (Path)
        const pathGraphics = this.add.graphics();
        pathGraphics.lineStyle(8, 0xFFFFFF, 0.6);
        pathGraphics.beginPath();
        pathGraphics.moveTo(levels[0].x, levels[0].y);
        for (let i = 1; i < levels.length; i++) {
            pathGraphics.lineTo(levels[i].x, levels[i].y);
        }
        pathGraphics.strokePath();

        // 5. 生成地圖節點
        let maxUnlocked = savedProgress.maxUnlocked || 1;

        levels.forEach((lvl) => {
            const isUnlocked = lvl.id <= maxUnlocked;
            lvl.isCurrent = lvl.id === maxUnlocked;
            const stars = savedProgress[`level_${lvl.id}_stars`] || 0;

            UIHelper.createLevelNode(this, lvl.x, lvl.y, lvl, isUnlocked, stars, () => {
                this.scene.start('GameScene', lvl);
            });
        });

        // 6. 底部主選單/開局大按鈕 (PLAY)
        UIHelper.createButton(this, width / 2, height - 60, 200, 56, '繼續挑戰', 0xFFB700, 0x8B5A2B, () => {
            const currentLevel = levels.find(l => l.id === maxUnlocked) || levels[0];
            this.scene.start('GameScene', currentLevel);
        });
    }
}

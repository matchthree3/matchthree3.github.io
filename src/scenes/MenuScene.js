import Phaser from 'phaser';
import UIHelper from '../utils/UIHelper.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.scale;

        // 1. 夢幻藍紫天空漸層背景
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x3B82F6, 0x3B82F6, 0x6366F1, 0x8B5CF6, 1);
        bg.fillRect(0, 0, width, height);

        // 背景動態雲朵層
        for (let i = 0; i < 5; i++) {
            const cloudX = Phaser.Math.Between(40, width - 40);
            const cloudY = Phaser.Math.Between(60, height - 80);
            const cloud = this.add.circle(cloudX, cloudY, Phaser.Math.Between(35, 60), 0xFFFFFF, 0.2);
            this.tweens.add({
                targets: cloud,
                x: cloudX + 25,
                duration: Phaser.Math.Between(3500, 5500),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // 2. 雙層 Logo / 品牌標題
        const subTitle = this.add.text(width / 2, 45, '✦ CANDY VALLEY ✦', {
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#FFEAA7',
            stroke: '#2D3436',
            strokeThickness: 3
        }).setOrigin(0.5);

        const logoMain = this.add.text(width / 2, 80, 'SWEET\nMATCH', {
            fontSize: '34px',
            fontStyle: 'bold',
            align: 'center',
            color: '#FFFDF0',
            stroke: '#5A3311',
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 6, color: '#000000', blur: 6, fill: true }
        }).setOrigin(0.5);

        this.tweens.add({
            targets: [subTitle, logoMain],
            y: '+=5',
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 3. 關卡資料與垂直間距拉開（解決擠在一起的核心修復點）
        const savedProgress = JSON.parse(localStorage.getItem('match3_progress') || '{}');
        
        // 將 y 軸間距拉寬（涵蓋從 height * 0.81 到 height * 0.20），並做 S 型交錯
        const levels = [
            { id: 1, name: '第一關', target: 500, moves: 20, x: width * 0.28, y: height * 0.81 },
            { id: 2, name: '第二關', target: 1000, moves: 18, x: width * 0.72, y: height * 0.66 },
            { id: 3, name: '第三關', target: 1800, moves: 15, x: width * 0.30, y: height * 0.51 },
            { id: 4, name: '第四關', target: 2500, moves: 15, x: width * 0.70, y: height * 0.36 },
            { id: 5, name: '第五關', target: 3500, moves: 12, x: width * 0.50, y: height * 0.20 }
        ];

        // 4. 繪製有立體厚度與土木質感的「冒險小徑 (Adventure Road Path)」
        const pathGfx = this.add.graphics();
        
        // 4a. 道路深色邊緣陰影
        pathGfx.lineStyle(18, 0x3E2723, 0.4);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y + 4);
        for (let i = 1; i < levels.length; i++) {
            pathGfx.lineTo(levels[i].x, levels[i].y + 4);
        }
        pathGfx.strokePath();

        // 4b. 道路土木質感主體
        pathGfx.lineStyle(12, 0x8D6E63, 0.9);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y);
        for (let i = 1; i < levels.length; i++) {
            pathGfx.lineTo(levels[i].x, levels[i].y);
        }
        pathGfx.strokePath();

        // 4c. 道路中心黃色虛線
        pathGfx.lineStyle(3, 0xFFECB3, 0.8);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y);
        for (let i = 1; i < levels.length; i++) {
            pathGfx.lineTo(levels[i].x, levels[i].y);
        }
        pathGfx.strokePath();

        // 5. 終點頂部城堡地標 (Castle Destination)
        const castleMarker = this.add.text(levels[4].x, levels[4].y - 60, '🏰', {
            fontSize: '38px'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: castleMarker,
            scale: 1.1,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 6. 生成關卡節點 (Level Nodes)
        let maxUnlocked = savedProgress.maxUnlocked || 1;

        levels.forEach((lvl) => {
            const isUnlocked = lvl.id <= maxUnlocked;
            lvl.isCurrent = lvl.id === maxUnlocked;
            const stars = savedProgress[`level_${lvl.id}_stars`] || 0;

            UIHelper.createLevelNode(this, lvl.x, lvl.y, lvl, isUnlocked, stars, () => {
                this.scene.start('GameScene', lvl);
            });
        });

        // 7. 底部醒目「▶ 繼續挑戰」主要控制按鈕
        const currentLevel = levels.find(l => l.id === maxUnlocked) || levels[0];
        UIHelper.createButton(
            this,
            width / 2,
            height - 50,
            210,
            54,
            '▶ 繼續挑戰',
            `第 ${currentLevel.id} 關`,
            0xFFB700,
            0x8B5A2B,
            () => {
                this.scene.start('GameScene', currentLevel);
            }
        );
    }
}

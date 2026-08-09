import Phaser from 'phaser';
import UIHelper from '../utils/UIHelper.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.scale;

        // 1. 夢幻藍紫天空漸層背景 (Candy Adventure Tone)
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x3B82F6, 0x3B82F6, 0x6366F1, 0x8B5CF6, 1);
        bg.fillRect(0, 0, width, height);

        // 背景動態雲朵層
        for (let i = 0; i < 6; i++) {
            const cloudX = Phaser.Math.Between(40, width - 40);
            const cloudY = Phaser.Math.Between(60, height - 80);
            const cloud = this.add.circle(cloudX, cloudY, Phaser.Math.Between(35, 65), 0xFFFFFF, 0.2);
            this.tweens.add({
                targets: cloud,
                x: cloudX + 25,
                duration: Phaser.Math.Between(3500, 5500),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // 2. 雙層 Logo / 品牌標題 (SWEET MATCH + Candy Valley)
        const subTitle = this.add.text(width / 2, 55, '✦ CANDY VALLEY ✦', {
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#FFEAA7',
            stroke: '#2D3436',
            strokeThickness: 3
        }).setOrigin(0.5);

        const logoMain = this.add.text(width / 2, 92, 'SWEET\nMATCH', {
            fontSize: '38px',
            fontStyle: 'bold',
            align: 'center',
            color: '#FFFDF0',
            stroke: '#5A3311',
            strokeThickness: 9,
            shadow: { offsetX: 0, offsetY: 8, color: '#000000', blur: 6, fill: true }
        }).setOrigin(0.5);

        // Logo 浮動動畫
        this.tweens.add({
            targets: [subTitle, logoMain],
            y: '+=6',
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 3. 關卡資料與 LocalStorage 存檔讀取
        const savedProgress = JSON.parse(localStorage.getItem('match3_progress') || '{}');
        const levels = [
            { id: 1, name: '第一關', target: 500, moves: 20, x: width * 0.28, y: height * 0.78 },
            { id: 2, name: '第二關', target: 1000, moves: 18, x: width * 0.72, y: height * 0.65 },
            { id: 3, name: '第三關', target: 1800, moves: 15, x: width * 0.32, y: height * 0.51 },
            { id: 4, name: '第四關', target: 2500, moves: 15, x: width * 0.68, y: height * 0.37 },
            { id: 5, name: '第五關', target: 3500, moves: 12, x: width * 0.50, y: height * 0.22 }
        ];

        // 4. 繪製有立體厚度與土木質感的「冒險小徑 (Adventure Road Path)」
        const pathGfx = this.add.graphics();
        
        // 4a. 道路深色立體邊緣陰影 (18px)
        pathGfx.lineStyle(20, 0x3E2723, 0.4);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y + 4);
        for (let i = 1; i < levels.length; i++) {
            pathGfx.lineTo(levels[i].x, levels[i].y + 4);
        }
        pathGfx.strokePath();

        // 4b. 道路土木質感主體 (14px)
        pathGfx.lineStyle(14, 0x8D6E63, 0.9);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y);
        for (let i = 1; i < levels.length; i++) {
            pathGfx.lineTo(levels[i].x, levels[i].y);
        }
        pathGfx.strokePath();

        // 4c. 道路中心淺黃步道虛線
        pathGfx.lineStyle(4, 0xFFECB3, 0.8);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y);
        for (let i = 1; i < levels.length; i++) {
            pathGfx.lineTo(levels[i].x, levels[i].y);
        }
        pathGfx.strokePath();

        // 5. 終點頂部城堡地標 (Castle Destination)
        const castleMarker = this.add.text(levels[4].x, levels[4].y - 70, '🏰', {
            fontSize: '44px'
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
            height - 58,
            220,
            60,
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

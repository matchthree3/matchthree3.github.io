import Phaser from 'phaser';
import UIHelper from '../utils/UIHelper.js';
import LevelConfig from '../config/LevelConfig.js';

const VISIBLE_LEVEL_COUNT = 20;

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.scale;

        const bg = this.add.graphics();
        bg.fillGradientStyle(0x3B82F6, 0x3B82F6, 0x6366F1, 0x8B5CF6, 1);
        bg.fillRect(0, 0, width, height);
        bg.setScrollFactor(0);

        for (let i = 0; i < 6; i++) {
            const cloudX = Phaser.Math.Between(40, width - 40);
            const cloudY = Phaser.Math.Between(60, height - 80);
            const cloud = this.add.circle(cloudX, cloudY, Phaser.Math.Between(35, 60), 0xFFFFFF, 0.2);
            cloud.setScrollFactor(0);
            this.tweens.add({
                targets: cloud,
                x: cloudX + 25,
                duration: Phaser.Math.Between(3500, 5500),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        const subTitle = this.add.text(width / 2, 45, '✦ CANDY VALLEY ✦', {
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#FFEAA7',
            stroke: '#2D3436',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

        const logoMain = this.add.text(width / 2, 80, 'SWEET\nMATCH', {
            fontSize: '34px',
            fontStyle: 'bold',
            align: 'center',
            color: '#FFFDF0',
            stroke: '#5A3311',
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 6, color: '#000000', blur: 6, fill: true }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

        this.tweens.add({
            targets: [subTitle, logoMain],
            y: '+=5',
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const savedProgress = JSON.parse(localStorage.getItem('match3_progress') || '{}');
        const maxUnlocked = savedProgress.maxUnlocked || 1;

        const rawLevels = LevelConfig.getLevelRange(1, VISIBLE_LEVEL_COUNT);
        const marginTop = 160;
        const marginBottom = 120;
        const stepY = 110;
        const contentHeight = marginTop + marginBottom + stepY * (rawLevels.length - 1);

        const levels = rawLevels.map((lvl, i) => {
            const swing = Math.sin(i * 0.9) * (width * 0.22);
            return {
                ...lvl,
                x: width / 2 + swing,
                y: contentHeight - marginBottom - i * stepY,
                isCurrent: lvl.id === maxUnlocked
            };
        });

        const world = this.add.container(0, 0);
        const currentLvl = levels.find(l => l.isCurrent) || levels[0];
        const minScrollY = Math.min(0, height - contentHeight);
        let startOffset = Phaser.Math.Clamp(-(currentLvl.y - height * 0.6), minScrollY, 0);
        world.y = startOffset;

        const pathGfx = this.add.graphics();
        pathGfx.lineStyle(18, 0x3E2723, 0.4);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y + 4);
        for (let i = 1; i < levels.length; i++) pathGfx.lineTo(levels[i].x, levels[i].y + 4);
        pathGfx.strokePath();

        pathGfx.lineStyle(12, 0x8D6E63, 0.9);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y);
        for (let i = 1; i < levels.length; i++) pathGfx.lineTo(levels[i].x, levels[i].y);
        pathGfx.strokePath();

        pathGfx.lineStyle(3, 0xFFECB3, 0.8);
        pathGfx.beginPath();
        pathGfx.moveTo(levels[0].x, levels[0].y);
        for (let i = 1; i < levels.length; i++) pathGfx.lineTo(levels[i].x, levels[i].y);
        pathGfx.strokePath();
        world.add(pathGfx);

        const lastLvl = levels[levels.length - 1];
        const castleMarker = this.add.text(lastLvl.x, lastLvl.y - 60, '🏰', { fontSize: '38px' }).setOrigin(0.5);
        world.add(castleMarker);
        this.tweens.add({
            targets: castleMarker,
            scale: 1.1,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        levels.forEach((lvl) => {
            const isUnlocked = lvl.id <= maxUnlocked;
            const stars = savedProgress[`level_${lvl.id}_stars`] || 0;
            const node = UIHelper.createLevelNode(this, lvl.x, lvl.y, lvl, isUnlocked, stars, () => {
                this.scene.start('GameScene', lvl);
            });
            world.add(node);
        });

        this.input.on('pointermove', (pointer) => {
            if (!pointer.isDown) return;
            world.y = Phaser.Math.Clamp(world.y + pointer.velocity.y * 0.016, minScrollY - 40, 40);
        });
        this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
            world.y = Phaser.Math.Clamp(world.y - dy * 0.5, minScrollY - 40, 40);
        });

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
        ).setScrollFactor(0).setDepth(30);
    }
}

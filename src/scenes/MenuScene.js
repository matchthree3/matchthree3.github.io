import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        this.add.text(270, 180, '軟糖大冒險', {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(270, 240, '選擇關卡', {
            fontSize: '24px',
            color: '#aaaaaa'
        }).setOrigin(0.5);

        const levels = [
            { id: 1, name: '第一關', target: 500, moves: 20 },
            { id: 2, name: '第二關', target: 1000, moves: 18 },
            { id: 3, name: '第三關', target: 2000, moves: 15 }
        ];

        levels.forEach((lvl, index) => {
            const yPos = 360 + index * 130;

            const btn = this.add.rectangle(270, yPos, 320, 90, 0x4e54c8, 1)
                .setInteractive({ useHandCursor: true });

            this.add.text(270, yPos - 15, `第 ${lvl.id} 關`, {
                fontSize: '28px',
                fontStyle: 'bold',
                color: '#ffffff'
            }).setOrigin(0.5);

            this.add.text(270, yPos + 20, `目標: ${lvl.target}分 | 步數: ${lvl.moves}`, {
                fontSize: '18px',
                color: '#dddddd'
            }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                this.scene.start('GameScene', lvl);
            });
        });
    }
}

import Phaser from 'phaser';

export default class UIHelper {
    // 繪製立體 Q 彈膠囊按鈕
    static createButton(scene, x, y, width, height, text, color = 0xFFB700, strokeColor = 0x8B5A2B, callback) {
        const container = scene.add.container(x, y);

        const graphics = scene.add.graphics();
        // 陰影
        graphics.fillStyle(0x000000, 0.25);
        graphics.fillRoundedRect(-width / 2, -height / 2 + 6, width, height, 20);
        // 按鈕邊框與主體
        graphics.fillStyle(strokeColor, 1);
        graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 20);
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 10, 18);
        // 高光
        graphics.fillStyle(0xFFFFFF, 0.3);
        graphics.fillRoundedRect(-width / 2 + 6, -height / 2 + 5, width - 12, height / 3, 10);

        const btnText = scene.add.text(0, -2, text, {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#FFFFFF',
            stroke: '#5A3311',
            strokeThickness: 5
        }).setOrigin(0.5);

        container.add([graphics, btnText]);
        container.setSize(width, height);
        container.setInteractive({ useHandCursor: true });

        // 按壓與彈跳動畫
        container.on('pointerdown', () => {
            scene.tweens.add({ targets: container, scale: 0.92, duration: 80, ease: 'Power2' });
        });
        container.on('pointerup', () => {
            scene.tweens.add({
                targets: container,
                scale: 1,
                duration: 120,
                ease: 'Back.easeOut',
                onComplete: () => { if (callback) callback(); }
            });
        });
        container.on('pointerout', () => {
            scene.tweens.add({ targets: container, scale: 1, duration: 100 });
        });

        return container;
    }

    // 繪製圓形關卡地圖節點 (Level Node)
    static createLevelNode(scene, x, y, levelData, isUnlocked, stars = 0, callback) {
        const container = scene.add.container(x, y);
        const radius = 34;

        const graphics = scene.add.graphics();

        if (isUnlocked) {
            // 陰影
            graphics.fillStyle(0x000000, 0.2);
            graphics.fillCircle(0, 6, radius);
            // 木質邊框與金黃底色
            graphics.fillStyle(0x8B5A2B, 1);
            graphics.fillCircle(0, 0, radius);
            graphics.fillStyle(0xFFC72C, 1);
            graphics.fillCircle(0, -2, radius - 4);
            // 內圈奶油高光
            graphics.fillStyle(0xFFFDE8, 1);
            graphics.fillCircle(0, -4, radius - 8);

            // 關卡數字
            const numText = scene.add.text(0, -4, `${levelData.id}`, {
                fontSize: '28px',
                fontStyle: 'bold',
                color: '#6B3E0E'
            }).setOrigin(0.5);
            container.add([graphics, numText]);

            // 1~3 星星展示
            for (let i = 0; i < 3; i++) {
                const starX = (i - 1) * 18;
                const starY = radius + 10;
                const isLit = i < stars;
                const starText = scene.add.text(starX, starY, '★', {
                    fontSize: '18px',
                    color: isLit ? '#FFD700' : '#BDC3C7',
                    stroke: '#4A2800',
                    strokeThickness: isLit ? 3 : 1
                }).setOrigin(0.5);
                container.add(starText);
            }

            // 當前最新關卡高亮呼吸光圈
            if (levelData.isCurrent) {
                const ring = scene.add.graphics();
                ring.lineStyle(4, 0xFFFFFF, 0.8);
                ring.strokeCircle(0, 0, radius + 6);
                container.add(ring);

                scene.tweens.add({
                    targets: ring,
                    scale: 1.15,
                    alpha: 0.2,
                    duration: 800,
                    yoyo: true,
                    repeat: -1
                });
            }

            container.setSize(radius * 2, radius * 2);
            container.setInteractive({ useHandCursor: true });
            container.on('pointerdown', () => {
                scene.tweens.add({
                    targets: container,
                    scale: 0.88,
                    duration: 80,
                    yoyo: true,
                    onComplete: () => { if (callback) callback(); }
                });
            });
        } else {
            // 未解鎖 (Locked) 灰色圓盤
            graphics.fillStyle(0x7F8C8D, 1);
            graphics.fillCircle(0, 0, radius);
            graphics.fillStyle(0xBDC3C7, 1);
            graphics.fillCircle(0, -2, radius - 4);

            const lockText = scene.add.text(0, -2, '🔒', { fontSize: '22px' }).setOrigin(0.5);
            container.add([graphics, lockText]);
        }

        return container;
    }
}

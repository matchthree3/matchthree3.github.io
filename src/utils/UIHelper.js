import Phaser from 'phaser';

export default class UIHelper {
    /**
     * 繪製具備立體厚度與高光按壓感的實體遊戲按鈕
     */
    static createButton(scene, x, y, width, height, text, subText = '', color = 0xFFB700, strokeColor = 0x8B5A2B, callback) {
        const container = scene.add.container(x, y);

        const graphics = scene.add.graphics();
        // 底層沉穩陰影
        graphics.fillStyle(0x000000, 0.25);
        graphics.fillRoundedRect(-width / 2, -height / 2 + 8, width, height, 22);
        // 按鈕邊框
        graphics.fillStyle(strokeColor, 1);
        graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 22);
        // 按鈕主體色盤
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 12, 18);
        // 頂部 Q 彈高光層
        graphics.fillStyle(0xFFFFFF, 0.35);
        graphics.fillRoundedRect(-width / 2 + 8, -height / 2 + 6, width - 16, height / 3, 12);

        // 主文字
        const btnText = scene.add.text(subText ? -10 : 0, subText ? -8 : -2, text, {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#FFFFFF',
            stroke: '#5A3311',
            strokeThickness: 5
        }).setOrigin(0.5);

        container.add([graphics, btnText]);

        if (subText) {
            const subLabel = scene.add.text(0, 14, subText, {
                fontSize: '13px',
                fontStyle: 'bold',
                color: '#FFEAA7',
                stroke: '#3A210A',
                strokeThickness: 3
            }).setOrigin(0.5);
            container.add(subLabel);
        }

        container.setSize(width, height);
        container.setInteractive({ useHandCursor: true });

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

    /**
     * 繪製關卡地圖節點
     */
    static createLevelNode(scene, x, y, levelData, isUnlocked, stars = 0, callback) {
        const container = scene.add.container(x, y);
        const isCurrent = levelData.isCurrent;
        
        // 普通關卡半徑 36px (直徑 72px)，當前關卡半徑 44px (直徑 88px)
        const radius = isCurrent ? 44 : 36;
        const graphics = scene.add.graphics();

        if (isUnlocked) {
            // 底層陰影
            graphics.fillStyle(0x000000, 0.25);
            graphics.fillCircle(0, 6, radius);

            if (isCurrent) {
                // 當前挑戰關卡發光外圈
                graphics.fillStyle(0xFF9F43, 1);
                graphics.fillCircle(0, 0, radius + 5);
                graphics.fillStyle(0xFFEE72, 1);
                graphics.fillCircle(0, 0, radius + 2);
            }

            // 邊框與底色
            graphics.fillStyle(0x7F4C1E, 1);
            graphics.fillCircle(0, 0, radius);
            graphics.fillStyle(0xFFC048, 1);
            graphics.fillCircle(0, -2, radius - 4);

            // 內圈高光
            graphics.fillStyle(0xFFFEEA, 1);
            graphics.fillCircle(0, -4, radius - 8);

            // 關卡數字
            const numText = scene.add.text(0, isCurrent ? -6 : -4, `${levelData.id}`, {
                fontSize: isCurrent ? '32px' : '26px',
                fontStyle: 'bold',
                color: '#57330B'
            }).setOrigin(0.5);
            container.add([graphics, numText]);

            // 1~3 星星展示
            const starY = radius + 10;
            for (let i = 0; i < 3; i++) {
                const starX = (i - 1) * 18;
                const isLit = i < stars;

                const starGraphic = scene.add.text(starX, starY, '★', {
                    fontSize: isLit ? '18px' : '15px',
                    color: isLit ? '#FFD700' : '#8895A7',
                    stroke: isLit ? '#5E3800' : '#2D3436',
                    strokeThickness: isLit ? 3 : 1
                }).setOrigin(0.5);
                container.add(starGraphic);
            }

            if (isCurrent) {
                const ring = scene.add.graphics();
                ring.lineStyle(4, 0xFFFFFF, 0.9);
                ring.strokeCircle(0, 0, radius + 8);
                container.add(ring);

                scene.tweens.add({
                    targets: ring,
                    scale: 1.15,
                    alpha: 0.1,
                    duration: 900,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
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
            // 未解鎖 (Locked) 節點
            graphics.fillStyle(0x000000, 0.2);
            graphics.fillCircle(0, 5, radius);
            
            graphics.fillStyle(0x576574, 1);
            graphics.fillCircle(0, 0, radius);
            graphics.fillStyle(0x8395A7, 1);
            graphics.fillCircle(0, -2, radius - 4);

            const lockGfx = scene.add.graphics();
            lockGfx.lineStyle(3, 0x576574, 1);
            lockGfx.strokeRoundedRect(-7, -14, 14, 14, 5);
            lockGfx.fillStyle(0xD6A2E8, 1);
            lockGfx.fillRoundedRect(-10, -4, 20, 16, 4);

            container.add([graphics, lockGfx]);
        }

        return container;
    }
}

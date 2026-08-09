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
        // 按鈕邊框 (木質/金屬厚度)
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
            fontSize: '26px',
            fontStyle: 'bold',
            color: '#FFFFFF',
            stroke: '#5A3311',
            strokeThickness: 5
        }).setOrigin(0.5);

        container.add([graphics, btnText]);

        // 次要標籤 (如：第 3 關)
        if (subText) {
            const subLabel = scene.add.text(0, 14, subText, {
                fontSize: '14px',
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
     * 繪製具備幾何質感與手繪 Vector 鎖頭的關卡地圖節點
     */
    static createLevelNode(scene, x, y, levelData, isUnlocked, stars = 0, callback) {
        const container = scene.add.container(x, y);
        const isCurrent = levelData.isCurrent;
        
        // 普通關卡半徑 42px (直徑 84px)，當前關卡半徑 52px (直徑 104px)
        const radius = isCurrent ? 52 : 42;
        const graphics = scene.add.graphics();

        if (isUnlocked) {
            // 1. 底層厚重陰影
            graphics.fillStyle(0x000000, 0.25);
            graphics.fillCircle(0, 8, radius);

            if (isCurrent) {
                // 當前挑戰關卡：金黃耀眼璀璨外圈
                graphics.fillStyle(0xFF9F43, 1);
                graphics.fillCircle(0, 0, radius + 6);
                graphics.fillStyle(0xFFEE72, 1);
                graphics.fillCircle(0, 0, radius + 2);
            }

            // 2. 節點金屬外框與主體外圍
            graphics.fillStyle(0x7F4C1E, 1);
            graphics.fillCircle(0, 0, radius);
            graphics.fillStyle(0xFFC048, 1);
            graphics.fillCircle(0, -3, radius - 5);

            // 3. 內圈奶油高光盤
            graphics.fillStyle(0xFFFEEA, 1);
            graphics.fillCircle(0, -6, radius - 10);

            // 4. 關卡數字 (大型清晰字體)
            const numText = scene.add.text(0, isCurrent ? -8 : -5, `${levelData.id}`, {
                fontSize: isCurrent ? '38px' : '30px',
                fontStyle: 'bold',
                color: '#57330B'
            }).setOrigin(0.5);
            container.add([graphics, numText]);

            // 5. 1~3 星星展示 (非純文字，具備質感層級)
            const starY = radius + 12;
            for (let i = 0; i < 3; i++) {
                const starX = (i - 1) * 22;
                const isLit = i < stars;

                const starGraphic = scene.add.text(starX, starY, '★', {
                    fontSize: isLit ? '22px' : '18px',
                    color: isLit ? '#FFD700' : '#8895A7',
                    stroke: isLit ? '#5E3800' : '#2D3436',
                    strokeThickness: isLit ? 4 : 2,
                    shadow: isLit ? { offsetX: 0, offsetY: 2, color: '#FF9F43', blur: 4, fill: true } : null
                }).setOrigin(0.5);
                container.add(starGraphic);
            }

            // 6. 3 星滿星玩家獲得專屬金屬葉冠外框
            if (stars === 3) {
                const crown = scene.add.text(0, -radius - 8, '👑', { fontSize: '20px' }).setOrigin(0.5);
                container.add(crown);
            }

            // 7. 當前關卡呼吸光芒動畫
            if (isCurrent) {
                const ring = scene.add.graphics();
                ring.lineStyle(5, 0xFFFFFF, 0.9);
                ring.strokeCircle(0, 0, radius + 10);
                container.add(ring);

                scene.tweens.add({
                    targets: ring,
                    scale: 1.2,
                    alpha: 0.1,
                    duration: 900,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                // 當前標籤 (CURRENT)
                const tag = scene.add.text(0, -radius - 12, 'PLAY', {
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#FFFFFF',
                    backgroundColor: '#FF3838',
                    padding: { x: 8, y: 3 }
                }).setOrigin(0.5);
                container.add(tag);
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
            // 未解鎖 (Locked) 節點 (完全摒棄 Unicode 🔒 Emoji)
            graphics.fillStyle(0x000000, 0.2);
            graphics.fillCircle(0, 6, radius);
            
            // 灰色石塊質感底盤
            graphics.fillStyle(0x576574, 1);
            graphics.fillCircle(0, 0, radius);
            graphics.fillStyle(0x8395A7, 1);
            graphics.fillCircle(0, -2, radius - 4);
            graphics.fillStyle(0xC8D6E5, 1);
            graphics.fillCircle(0, -4, radius - 8);

            // 用 Phaser Vector Graphics 手繪質感木質銅鎖
            const lockGfx = scene.add.graphics();
            // 鎖扣 (U 型環)
            lockGfx.lineStyle(4, 0x576574, 1);
            lockGfx.strokeRoundedRect(-8, -16, 16, 16, 6);
            // 鎖身
            lockGfx.fillStyle(0xD6A2E8, 1);
            lockGfx.fillRoundedRect(-11, -5, 22, 18, 4);
            lockGfx.lineStyle(2, 0x5F27CD, 1);
            lockGfx.strokeRoundedRect(-11, -5, 22, 18, 4);
            // 鑰匙孔
            lockGfx.fillStyle(0x2D3436, 1);
            lockGfx.fillCircle(0, 2, 3);

            container.add([graphics, lockGfx]);
        }

        return container;
    }
}

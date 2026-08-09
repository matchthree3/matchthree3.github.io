export default class BoardAnimator {
    /**
     * 方塊交換動畫
     */
    static swap(scene, tileA, tileB, posA, posB, duration = 200) {
        return new Promise((resolve) => {
            scene.tweens.killTweensOf(tileA);
            scene.tweens.killTweensOf(tileB);

            scene.tweens.add({ targets: tileA, x: posB.x, y: posB.y, duration, ease: 'Back.easeOut' });
            scene.tweens.add({
                targets: tileB, x: posA.x, y: posA.y, duration, ease: 'Back.easeOut',
                onComplete: () => resolve()
            });
        });
    }

    /**
     * 消除與縮放動畫 (帶有輕微旋轉與錯開延遲)
     */
    static destroy(scene, tiles) {
        return new Promise((resolve) => {
            if (!tiles || tiles.length === 0) return resolve();

            let completed = 0;
            tiles.forEach((tile, i) => {
                scene.tweens.add({
                    targets: tile,
                    scaleX: 0, scaleY: 0, alpha: 0,
                    angle: Phaser.Math.Between(-90, 90),
                    duration: 200,
                    delay: Math.min(i * 8, 120),
                    ease: 'Back.easeIn',
                    onComplete: () => {
                        tile.destroy();
                        completed++;
                        if (completed === tiles.length) resolve();
                    }
                });
            });
        });
    }

    /**
     * 下落動畫與彈跳
     */
    static fall(scene, dropConfigs) {
        return new Promise((resolve) => {
            if (!dropConfigs || dropConfigs.length === 0) return resolve();

            let completed = 0;
            dropConfigs.forEach((config) => {
                scene.tweens.add({
                    ...config,
                    onComplete: () => {
                        completed++;
                        if (completed === dropConfigs.length) resolve();
                    }
                });
            });
        });
    }
}

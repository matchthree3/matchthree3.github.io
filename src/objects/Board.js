import Phaser from 'phaser';
import Tile from './Tile.js';

/**
 * 【效能優化重點】
 * 1. 物件池 (Object Pool)：閃光、分數文字、火箭光束、炸彈衝擊波不再「每次 new + 每次 destroy」，
 *    而是重複使用同一批已建立的 GameObject，大幅降低 GC 壓力與記憶體配置次數。
 * 2. 彩虹球連線：原本每格連線各建立一個 Line GameObject（最多可達 63 個），
 *    改用單一 Graphics 物件一次畫完，Draw Call 數量從 O(N) 降到 O(1)。
 * 3. 攝影機震動合併 (Shake Debounce)：同一輪連鎖若觸發多個火箭/炸彈，
 *    原本會疊加呼叫 shake() 造成畫面抖動不自然，現在合併成單次、取最大強度執行。
 * 4. 分數文字聚合：原本每消除一格就建立一個「+10」文字物件，
 *    改為整批消除只建立一個聚合分數彈跳文字（Text 物件建立成本較高，因為要生成材質）。
 * 5. createGrid 初始盤面生成：原本用 do-while 隨機重抽直到不撞色，
 *    改為直接從「排除會連線的顏色」清單中挑選，保證一次到位，無重試迴圈。
 * 6. 減少重複陣列索引查找（cache row/tile 參照），並用 worldPos() 統一座標計算避免重複運算式。
 * 7. 消除前對目標 tile 呼叫 killTweensOf，避免極端情況下殘留 tween 造成視覺錯誤。
 * 8. 修正原始碼中 triggerSpecialSwap 忘記設定 isBusy = true 的邊界情況（可能導致連消中被搶點）。
 *
 * 註：Tile 物件本身（磚塊）目前未做物件池復用，因為 Tile.js 內部實作未提供，
 * 若要進一步把「磚塊生成/銷毀」也池化，需要在 Tile.js 加上 reset() 方法，可另外提供。
 */
export default class Board extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);
        scene.add.existing(this);

        this.rows = 8;
        this.cols = 8;
        this.tileSize = 64;
        this.spacing = 4;
        this.grid = [];
        this.selectedTile = null;
        this.isBusy = false;

        this.colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        this.offsetX = -((this.cols * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);
        this.offsetY = -((this.rows * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);

        // 顏色對應的特效色碼（用於閃光染色，原本這個資訊被丟棄）
        this.colorHexMap = {
            red: 0xff4d4d,
            blue: 0x4d94ff,
            green: 0x4dff9d,
            yellow: 0xffe14d,
            purple: 0xc44dff,
            rainbow: 0xffffff
        };

        // ---- 物件池 ----
        this.flashPool = [];
        this.scoreTextPool = [];
        this.rowBeamPool = [];
        this.colBeamPool = [];
        this.wavePool = [];

        // 彩虹球連線改用單一 Graphics，避免大量 Line GameObject
        this.rainbowGraphics = this.scene.add.graphics();
        this.add(this.rainbowGraphics);

        // ---- 攝影機震動合併狀態 ----
        this._shakeDuration = 0;
        this._shakeIntensity = 0;

        this.createGrid();
    }

    // 統一座標換算，避免各處重複相同運算式
    worldPos(row, col) {
        return {
            x: this.offsetX + col * (this.tileSize + this.spacing),
            y: this.offsetY + row * (this.tileSize + this.spacing)
        };
    }

    // ---- 通用物件池工具 ----
    _acquireFromPool(pool, createFn) {
        for (let i = 0; i < pool.length; i++) {
            const obj = pool[i];
            if (!obj.getData('inUse')) {
                obj.setData('inUse', true);
                obj.setActive(true).setVisible(true);
                return obj;
            }
        }
        const obj = createFn();
        obj.setData('inUse', true);
        pool.push(obj);
        return obj;
    }

    _releaseToPool(obj) {
        obj.setData('inUse', false);
        obj.setActive(false).setVisible(false);
    }

    createGrid() {
        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                // 【優化】不再用 do-while 重抽，而是直接排除會造成連線的顏色，保證一次選中
                const excluded = new Set();
                if (col >= 2 && this.grid[row][col - 1].colorType === this.grid[row][col - 2].colorType) {
                    excluded.add(this.grid[row][col - 1].colorType);
                }
                if (row >= 2 && this.grid[row - 1][col].colorType === this.grid[row - 2][col].colorType) {
                    excluded.add(this.grid[row - 1][col].colorType);
                }

                const available = excluded.size > 0
                    ? this.colors.filter(c => !excluded.has(c))
                    : this.colors;
                const randomColor = Phaser.Math.RND.pick(available);

                const pos = this.worldPos(row, col);
                const tile = new Tile(this.scene, pos.x, pos.y, `tile_${randomColor}`, row, col);
                this.add(tile);
                this.grid[row][col] = tile;
            }
        }
    }

    // 點擊選取或單點觸發道具
    selectTile(tile) {
        if (this.isBusy) return;

        // 【做法 B】直接點擊特殊道具（火箭/炸彈/彩虹球）立即引爆
        if (tile.specialType !== 'none') {
            if (this.selectedTile) {
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
            }
            this.triggerSingleSpecial(tile);
            return;
        }

        if (!this.selectedTile) {
            this.selectedTile = tile;
            tile.setSelected(true);
        } else if (this.selectedTile === tile) {
            this.selectedTile.setSelected(false);
            this.selectedTile = null;
        } else {
            const isNeighbor = (Math.abs(this.selectedTile.row - tile.row) + Math.abs(this.selectedTile.col - tile.col)) === 1;

            if (isNeighbor) {
                const tileA = this.selectedTile;
                const tileB = tile;
                tileA.setSelected(false);
                this.selectedTile = null;
                this.swapTiles(tileA, tileB);
            } else {
                this.selectedTile.setSelected(false);
                this.selectedTile = tile;
                tile.setSelected(true);
            }
        }
    }

    handleDragSwap(tile, targetRow, targetCol) {
        if (this.selectedTile) {
            this.selectedTile.setSelected(false);
            this.selectedTile = null;
        }

        if (targetRow >= 0 && targetRow < this.rows && targetCol >= 0 && targetCol < this.cols) {
            const targetTile = this.grid[targetRow][targetCol];
            if (targetTile) {
                this.swapTiles(tile, targetTile);
            }
        }
    }

    swapTiles(tileA, tileB) {
        this.isBusy = true;

        const rA = tileA.row, cA = tileA.col;
        const rB = tileB.row, cB = tileB.col;

        this.grid[rA][cA] = tileB;
        this.grid[rB][cB] = tileA;
        tileA.row = rB; tileA.col = cB;
        tileB.row = rA; tileB.col = cA;

        const posA = { x: tileA.x, y: tileA.y };
        const posB = { x: tileB.x, y: tileB.y };

        this.scene.tweens.killTweensOf(tileA);
        this.scene.tweens.killTweensOf(tileB);

        this.scene.tweens.add({ targets: tileA, x: posB.x, y: posB.y, duration: 250, ease: 'Back.easeOut' });
        this.scene.tweens.add({
            targets: tileB, x: posA.x, y: posA.y, duration: 250, ease: 'Back.easeOut',
            onComplete: () => {
                // 1. 彩虹球交換優先判定
                if (tileA.specialType === 'rainbow' || tileB.specialType === 'rainbow') {
                    this.triggerRainbow(tileA.specialType === 'rainbow' ? tileA : tileB, tileA.specialType === 'rainbow' ? tileB : tileA);
                    return;
                }

                // 2. 【做法 B】只要交換的其中一方包含火箭或炸彈，無條件直接引爆！不用湊 3 連消
                const isSpecialA = ['row_rocket', 'col_rocket', 'bomb'].includes(tileA.specialType);
                const isSpecialB = ['row_rocket', 'col_rocket', 'bomb'].includes(tileB.specialType);

                if (isSpecialA || isSpecialB) {
                    this.triggerSpecialSwap(tileA, tileB);
                    return;
                }

                // 3. 一般軟糖的 3 消檢查
                const matchesResult = this.checkMatchesDetailed();
                if (matchesResult.tiles.length > 0) {
                    this.clearMatches(matchesResult);
                } else {
                    // 無效交換：彈回
                    this.grid[rA][cA] = tileA;
                    this.grid[rB][cB] = tileB;
                    tileA.row = rA; tileA.col = cA;
                    tileB.row = rB; tileB.col = cB;

                    this.scene.tweens.add({ targets: tileA, x: posA.x, y: posA.y, duration: 200, ease: 'Power2' });
                    this.scene.tweens.add({
                        targets: tileB, x: posB.x, y: posB.y, duration: 200, ease: 'Power2',
                        onComplete: () => { this.isBusy = false; }
                    });
                }
            }
        });
    }

    // 單點特殊道具引爆
    triggerSingleSpecial(tile) {
        this.isBusy = true;
        const expanded = new Set([tile]);
        this.expandSpecialEffect(tile, expanded);
        this.flushShake();

        this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
    }

    // 交換特殊道具引爆
    triggerSpecialSwap(tileA, tileB) {
        this.isBusy = true; // 【修正】原始碼漏設，可能導致連消進行中仍可被點擊
        const expanded = new Set([tileA, tileB]);

        this.expandSpecialEffect(tileA, expanded);
        this.expandSpecialEffect(tileB, expanded);
        this.flushShake();

        this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
    }

    // 計算特殊道具的爆炸影響區域
    expandSpecialEffect(tile, expandedSet) {
        if (tile.specialType === 'row_rocket') {
            this.createRocketBeam(tile.x, tile.y, true);
            this.queueShake(200, 0.02);
            const rowArr = this.grid[tile.row];
            for (let c = 0; c < this.cols; c++) if (rowArr[c]) expandedSet.add(rowArr[c]);
        } else if (tile.specialType === 'col_rocket') {
            this.createRocketBeam(tile.x, tile.y, false);
            this.queueShake(200, 0.02);
            for (let r = 0; r < this.rows; r++) if (this.grid[r][tile.col]) expandedSet.add(this.grid[r][tile.col]);
        } else if (tile.specialType === 'bomb') {
            this.createShockwave(tile.x, tile.y);
            this.queueShake(300, 0.04);
            for (let r = Math.max(0, tile.row - 1); r <= Math.min(this.rows - 1, tile.row + 1); r++) {
                const rowArr = this.grid[r];
                for (let c = Math.max(0, tile.col - 1); c <= Math.min(this.cols - 1, tile.col + 1); c++) {
                    if (rowArr[c]) expandedSet.add(rowArr[c]);
                }
            }
        }
    }

    // ---- 攝影機震動合併：同一輪連鎖只震一次，取最大強度/時長 ----
    queueShake(duration, intensity) {
        if (intensity > this._shakeIntensity) this._shakeIntensity = intensity;
        if (duration > this._shakeDuration) this._shakeDuration = duration;
    }

    flushShake() {
        if (this._shakeIntensity > 0) {
            this.scene.cameras.main.shake(this._shakeDuration, this._shakeIntensity);
            this._shakeIntensity = 0;
            this._shakeDuration = 0;
        }
    }

    // 特效 1：基礎爆破閃光（物件池復用，不再每次 new/destroy）
    createPopEffect(x, y, colorType) {
        const flash = this._acquireFromPool(this.flashPool, () => {
            const c = this.scene.add.circle(0, 0, 20, 0xffffff, 0.8);
            this.add(c);
            return c;
        });

        flash.setPosition(x, y);
        flash.setScale(1);
        flash.setAlpha(0.8);
        flash.setFillStyle(this.colorHexMap[colorType] || 0xffffff, 0.8);

        this.scene.tweens.add({
            targets: flash,
            scale: 3,
            alpha: 0,
            duration: 300,
            onComplete: () => this._releaseToPool(flash)
        });
    }

    // 聚合分數彈跳文字：整批消除只建立/復用一個文字物件，取代逐格建立
    showScorePopup(x, y, amount) {
        const txt = this._acquireFromPool(this.scoreTextPool, () => {
            const t = this.scene.add.text(0, 0, '', {
                fontSize: '28px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 5
            }).setOrigin(0.5);
            this.add(t);
            return t;
        });

        txt.setText('+' + amount);
        txt.setPosition(x, y);
        txt.setAlpha(1);

        this.scene.tweens.add({
            targets: txt,
            y: y - 60,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => this._releaseToPool(txt)
        });
    }

    // 特效 2：火箭貫穿雷射光束（依方向分開池化，避免動態改尺寸）
    createRocketBeam(x, y, isRow) {
        const pool = isRow ? this.rowBeamPool : this.colBeamPool;
        const beam = this._acquireFromPool(pool, () => {
            const r = isRow
                ? this.scene.add.rectangle(0, 0, 800, 20, 0xffffff, 1)
                : this.scene.add.rectangle(0, 0, 20, 800, 0xffffff, 1);
            this.add(r);
            return r;
        });

        beam.setPosition(x, y);
        beam.setScale(1);
        beam.setAlpha(1);

        this.scene.tweens.add({
            targets: beam,
            scaleY: isRow ? 3 : 1,
            scaleX: isRow ? 1 : 3,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => this._releaseToPool(beam)
        });
    }

    // 特效 3：炸彈衝擊波（物件池復用）
    createShockwave(x, y) {
        const wave = this._acquireFromPool(this.wavePool, () => {
            const c = this.scene.add.circle(0, 0, 30, 0xffaa00, 1);
            this.add(c);
            return c;
        });

        wave.setPosition(x, y);
        wave.setScale(1);
        wave.setAlpha(1);

        this.scene.tweens.add({
            targets: wave,
            scale: 8,
            alpha: 0,
            duration: 500,
            ease: 'Sine.easeOut',
            onComplete: () => this._releaseToPool(wave)
        });
    }

    // 特效 4：彩虹球全場閃電束（單一 Graphics 一次畫完，取代大量 Line 物件）
    triggerRainbow(rainbowTile, otherTile) {
        const targetColor = otherTile.colorType;
        const toClear = [rainbowTile];

        const gfx = this.rainbowGraphics;
        gfx.clear();
        gfx.setAlpha(1);
        gfx.lineStyle(4, 0xffffff, 0.8);

        for (let r = 0; r < this.rows; r++) {
            const rowArr = this.grid[r];
            for (let c = 0; c < this.cols; c++) {
                const t = rowArr[c];
                if (t && (t.colorType === targetColor || t === otherTile)) {
                    toClear.push(t);
                    gfx.lineBetween(rainbowTile.x, rainbowTile.y, t.x, t.y);
                }
            }
        }

        this.queueShake(400, 0.03);
        this.flushShake();

        this.scene.tweens.add({
            targets: gfx,
            alpha: 0,
            duration: 300,
            onComplete: () => gfx.clear()
        });

        this.scene.time.delayedCall(300, () => {
            this.clearMatches({ tiles: toClear, spawnSpecials: [] });
        });
    }

    checkMatchesDetailed() {
        const matchedTiles = new Set();
        const spawnSpecials = [];

        for (let r = 0; r < this.rows; r++) {
            const rowArr = this.grid[r];
            let matchLen = 1;
            for (let c = 0; c < this.cols; c++) {
                const cur = rowArr[c];
                const next = c < this.cols - 1 ? rowArr[c + 1] : null;
                const checkNext = next && cur && (cur.colorType === next.colorType) && cur.colorType !== 'rainbow';

                if (checkNext) { matchLen++; } else {
                    if (matchLen >= 3) {
                        for (let i = 0; i < matchLen; i++) matchedTiles.add(rowArr[c - i]);
                        if (matchLen === 4) spawnSpecials.push({ row: r, col: c - Math.floor(matchLen / 2), type: 'row_rocket', color: cur.colorType });
                        else if (matchLen >= 5) spawnSpecials.push({ row: r, col: c - Math.floor(matchLen / 2), type: 'rainbow', color: 'rainbow' });
                    }
                    matchLen = 1;
                }
            }
        }

        for (let c = 0; c < this.cols; c++) {
            let matchLen = 1;
            for (let r = 0; r < this.rows; r++) {
                const cur = this.grid[r][c];
                const next = r < this.rows - 1 ? this.grid[r + 1][c] : null;
                const checkNext = next && cur && (cur.colorType === next.colorType) && cur.colorType !== 'rainbow';

                if (checkNext) { matchLen++; } else {
                    if (matchLen >= 3) {
                        for (let i = 0; i < matchLen; i++) matchedTiles.add(this.grid[r - i][c]);
                        if (matchLen === 4) spawnSpecials.push({ row: r - Math.floor(matchLen / 2), col: c, type: 'col_rocket', color: cur.colorType });
                        else if (matchLen >= 5) spawnSpecials.push({ row: r - Math.floor(matchLen / 2), col: c, type: 'rainbow', color: 'rainbow' });
                    }
                    matchLen = 1;
                }
            }
        }

        const expanded = new Set(matchedTiles);
        matchedTiles.forEach(tile => {
            this.expandSpecialEffect(tile, expanded);
        });
        this.flushShake();

        return { tiles: Array.from(expanded), spawnSpecials };
    }

    clearMatches(matchesResult) {
        const matches = matchesResult.tiles;
        if (matches.length === 0) {
            this.isBusy = false;
            return;
        }

        // 加分邏輯 + 聚合分數彈跳文字（取代逐格文字物件）
        let sumX = 0;
        let sumY = 0;
        let scoreGain = 0;

        if (this.scene.score !== undefined) {
            scoreGain = matches.length * 10;
            this.scene.score += scoreGain;
            if (this.scene.scoreText) {
                this.scene.scoreText.setText('Score: ' + this.scene.score);
            }
        }

        matches.forEach(tile => {
            if (this.grid[tile.row] && this.grid[tile.row][tile.col] === tile) {
                this.grid[tile.row][tile.col] = null;
            }

            sumX += tile.x;
            sumY += tile.y;

            this.createPopEffect(tile.x, tile.y, tile.colorType);

            this.scene.tweens.killTweensOf(tile);
            this.scene.tweens.add({
                targets: tile,
                scaleX: tile.scaleX * 1.3,
                scaleY: tile.scaleY * 1.3,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: tile,
                        scaleX: 0, scaleY: 0, alpha: 0, duration: 150,
                        onComplete: () => {
                            tile.destroy();
                        }
                    });
                }
            });
        });

        if (scoreGain > 0) {
            this.showScorePopup(sumX / matches.length, (sumY / matches.length) - 10, scoreGain);
        }

        this.scene.time.delayedCall(360, () => {
            if (matchesResult.spawnSpecials) {
                matchesResult.spawnSpecials.forEach(sp => {
                    const pos = this.worldPos(sp.row, sp.col);
                    const newTile = new Tile(this.scene, pos.x, pos.y, `tile_${sp.color === 'rainbow' ? 'red' : sp.color}`, sp.row, sp.col);
                    newTile.setSpecial(sp.type);

                    newTile.setScale(0);
                    this.add(newTile);
                    this.grid[sp.row][sp.col] = newTile;

                    this.scene.tweens.add({
                        targets: newTile,
                        scaleX: newTile.baseScale, scaleY: newTile.baseScale,
                        duration: 400, ease: 'Bounce.easeOut'
                    });
                });
            }
            this.dropAndRefill();
        });
    }

    dropAndRefill() {
        const dropTweens = [];

        for (let col = 0; col < this.cols; col++) {
            let emptySlots = 0;

            for (let row = this.rows - 1; row >= 0; row--) {
                if (this.grid[row][col] === null) {
                    emptySlots++;
                } else if (emptySlots > 0) {
                    const tile = this.grid[row][col];
                    const targetRow = row + emptySlots;

                    this.grid[targetRow][col] = tile;
                    this.grid[row][col] = null;
                    tile.row = targetRow;

                    const targetY = this.worldPos(targetRow, col).y;
                    dropTweens.push({ targets: tile, y: targetY, duration: 350, ease: 'Bounce.easeOut' });
                }
            }

            for (let i = 0; i < emptySlots; i++) {
                const targetRow = emptySlots - 1 - i;
                const randomColor = Phaser.Math.RND.pick(this.colors);

                const pos = this.worldPos(targetRow, col);
                const startY = pos.y - (i + 1) * (this.tileSize + this.spacing) - 100;

                const tile = new Tile(this.scene, pos.x, startY, `tile_${randomColor}`, targetRow, col);
                this.add(tile);
                this.grid[targetRow][col] = tile;

                dropTweens.push({ targets: tile, y: pos.y, duration: 400 + (i * 50), ease: 'Bounce.easeOut' });
            }
        }

        if (dropTweens.length > 0) {
            let completed = 0;
            dropTweens.forEach(config => {
                this.scene.tweens.add({
                    ...config,
                    onComplete: () => {
                        completed++;
                        if (completed === dropTweens.length) {
                            this.scene.time.delayedCall(150, () => {
                                const newMatchesResult = this.checkMatchesDetailed();
                                if (newMatchesResult.tiles.length > 0) {
                                    this.clearMatches(newMatchesResult);
                                } else {
                                    this.isBusy = false;
                                }
                            });
                        }
                    }
                });
            });
        } else {
            this.isBusy = false;
        }
    }
}

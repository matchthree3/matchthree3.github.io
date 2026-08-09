import Phaser from 'phaser';
import Tile from './Tile.js';

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
        this.comboCount = 1;

        this.colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        this.offsetX = -((this.cols * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);
        this.offsetY = -((this.rows * (this.tileSize + this.spacing)) / 2) + (this.tileSize / 2);

        this.colorHexMap = {
            red: 0xff4d4d,
            blue: 0x4d94ff,
            green: 0x4dff9d,
            yellow: 0xffe14d,
            purple: 0xc44dff,
            rainbow: 0xffffff
        };

        this.flashPool = [];
        this.scoreTextPool = [];
        this.rowBeamPool = [];
        this.colBeamPool = [];
        this.wavePool = [];

        this.rainbowGraphics = this.scene.add.graphics();
        this.add(this.rainbowGraphics);

        this._shakeDuration = 0;
        this._shakeIntensity = 0;

        this.createGrid();
    }

    worldPos(row, col) {
        return {
            x: this.offsetX + col * (this.tileSize + this.spacing),
            y: this.offsetY + row * (this.tileSize + this.spacing)
        };
    }

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

        // 開局若無解，自動洗牌
        if (!this.hasPossibleMove()) {
            this.shuffleBoard();
        }
    }

    selectTile(tile) {
        if (this.isBusy) return;

        if (tile.specialType !== 'none') {
            if (this.selectedTile) {
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
            }
            if (this.scene.useMove) this.scene.useMove();
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
        this.comboCount = 1;

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
                if (tileA.specialType === 'rainbow' || tileB.specialType === 'rainbow') {
                    if (this.scene.useMove) this.scene.useMove();
                    this.triggerRainbow(tileA.specialType === 'rainbow' ? tileA : tileB, tileA.specialType === 'rainbow' ? tileB : tileA);
                    return;
                }

                const isSpecialA = ['row_rocket', 'col_rocket', 'bomb'].includes(tileA.specialType);
                const isSpecialB = ['row_rocket', 'col_rocket', 'bomb'].includes(tileB.specialType);

                if (isSpecialA || isSpecialB) {
                    if (this.scene.useMove) this.scene.useMove();
                    this.triggerSpecialSwap(tileA, tileB);
                    return;
                }

                const matchesResult = this.checkMatchesDetailed(tileA);
                if (matchesResult.tiles.length > 0) {
                    if (this.scene.useMove) this.scene.useMove();
                    this.clearMatches(matchesResult);
                } else {
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

    triggerSingleSpecial(tile) {
        this.isBusy = true;
        this.comboCount = 1;
        const expanded = new Set([tile]);
        this.expandSpecialEffect(tile, expanded, new Set());
        this.flushShake();

        this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
    }

    triggerSpecialSwap(tileA, tileB) {
        this.isBusy = true;
        this.comboCount = 1;
        const expanded = new Set([tileA, tileB]);
        const processedSpecials = new Set();

        this.expandSpecialEffect(tileA, expanded, processedSpecials);
        this.expandSpecialEffect(tileB, expanded, processedSpecials);
        this.flushShake();

        this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
    }

    expandSpecialEffect(tile, expandedSet, processedSpecials = new Set()) {
        if (!tile || processedSpecials.has(tile)) return;
        processedSpecials.add(tile);
        expandedSet.add(tile);

        if (tile.specialType === 'row_rocket') {
            this.createRocketBeam(tile.x, tile.y, true);
            this.queueShake(200, 0.02);
            const rowArr = this.grid[tile.row];
            for (let c = 0; c < this.cols; c++) {
                const target = rowArr[c];
                if (target) {
                    expandedSet.add(target);
                    if (target.specialType !== 'none' && !processedSpecials.has(target)) {
                        this.expandSpecialEffect(target, expandedSet, processedSpecials);
                    }
                }
            }
        } else if (tile.specialType === 'col_rocket') {
            this.createRocketBeam(tile.x, tile.y, false);
            this.queueShake(200, 0.02);
            for (let r = 0; r < this.rows; r++) {
                const target = this.grid[r][tile.col];
                if (target) {
                    expandedSet.add(target);
                    if (target.specialType !== 'none' && !processedSpecials.has(target)) {
                        this.expandSpecialEffect(target, expandedSet, processedSpecials);
                    }
                }
            }
        } else if (tile.specialType === 'bomb') {
            this.createShockwave(tile.x, tile.y);
            this.queueShake(300, 0.04);
            for (let r = Math.max(0, tile.row - 1); r <= Math.min(this.rows - 1, tile.row + 1); r++) {
                const rowArr = this.grid[r];
                for (let c = Math.max(0, tile.col - 1); c <= Math.min(this.cols - 1, tile.col + 1); c++) {
                    const target = rowArr[c];
                    if (target) {
                        expandedSet.add(target);
                        if (target.specialType !== 'none' && !processedSpecials.has(target)) {
                            this.expandSpecialEffect(target, expandedSet, processedSpecials);
                        }
                    }
                }
            }
        }
    }

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

    showScorePopup(x, y, amount, combo) {
        const txt = this._acquireFromPool(this.scoreTextPool, () => {
            const t = this.scene.add.text(0, 0, '', {
                fontSize: '28px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 5
            }).setOrigin(0.5);
            this.add(t);
            return t;
        });

        const label = combo > 1 ? `+${amount} (${combo}x)` : `+${amount}`;
        txt.setText(label);
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

    triggerRainbow(rainbowTile, otherTile) {
        const toClear = [rainbowTile];
        const gfx = this.rainbowGraphics;
        gfx.clear();
        gfx.setAlpha(1);
        gfx.lineStyle(4, 0xffffff, 0.8);

        if (otherTile.specialType === 'rainbow') {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const t = this.grid[r][c];
                    if (t) {
                        toClear.push(t);
                        gfx.lineBetween(rainbowTile.x, rainbowTile.y, t.x, t.y);
                    }
                }
            }
            this.queueShake(500, 0.05);
        } else {
            const targetColor = otherTile.colorType;
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
        }

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

    checkMatchesDetailed(activeSwappedTile = null) {
        const matchedTiles = new Set();
        const spawnSpecials = [];
        const spawnGridMap = new Map();

        const PRIORITY = {
            rainbow: 3,
            bomb: 2,
            row_rocket: 1,
            col_rocket: 1
        };

        const addCandidate = (r, c, type, color) => {
            const key = `${r},${c}`;
            const p = PRIORITY[type] || 0;
            const existing = spawnGridMap.get(key);
            if (!existing || p > existing.priority) {
                spawnGridMap.set(key, { row: r, col: c, type, color, priority: p });
            }
        };

        const hMatches = [];
        for (let r = 0; r < this.rows; r++) {
            let matchLen = 1;
            for (let c = 0; c < this.cols; c++) {
                const cur = this.grid[r][c];
                const next = c < this.cols - 1 ? this.grid[r][c + 1] : null;
                const checkNext = next && cur && (cur.colorType === next.colorType) && cur.colorType !== 'rainbow';

                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        const line = [];
                        for (let i = 0; i < matchLen; i++) line.push(this.grid[r][c - i]);
                        hMatches.push({ line, color: cur.colorType, len: matchLen });
                        line.forEach(t => matchedTiles.add(t));
                    }
                    matchLen = 1;
                }
            }
        }

        const vMatches = [];
        for (let c = 0; c < this.cols; c++) {
            let matchLen = 1;
            for (let r = 0; r < this.rows; r++) {
                const cur = this.grid[r][c];
                const next = r < this.rows - 1 ? this.grid[r + 1][c] : null;
                const checkNext = next && cur && (cur.colorType === next.colorType) && cur.colorType !== 'rainbow';

                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        const line = [];
                        for (let i = 0; i < matchLen; i++) line.push(this.grid[r - i][c]);
                        vMatches.push({ line, color: cur.colorType, len: matchLen });
                        line.forEach(t => matchedTiles.add(t));
                    }
                    matchLen = 1;
                }
            }
        }

        hMatches.forEach(h => {
            if (h.len >= 5) {
                const target = h.line.includes(activeSwappedTile) ? activeSwappedTile : h.line[Math.floor(h.len / 2)];
                addCandidate(target.row, target.col, 'rainbow', 'rainbow');
            }
        });
        vMatches.forEach(v => {
            if (v.len >= 5) {
                const target = v.line.includes(activeSwappedTile) ? activeSwappedTile : v.line[Math.floor(v.len / 2)];
                addCandidate(target.row, target.col, 'rainbow', 'rainbow');
            }
        });

        const processedT = new Set();
        hMatches.forEach((h, hIdx) => {
            vMatches.forEach((v, vIdx) => {
                if (h.color !== v.color) return;

                const intersection = h.line.find(tile => v.line.includes(tile));
                if (!intersection) return;

                const r = intersection.row;
                const c = intersection.col;

                const left  = this.grid[r]?.[c - 1];
                const right = this.grid[r]?.[c + 1];
                const up    = this.grid[r - 1]?.[c];
                const down  = this.grid[r + 1]?.[c];

                const sameColor = (tile) =>
                    tile &&
                    tile.colorType === h.color &&
                    tile.colorType !== 'rainbow';

                const hasLeft = sameColor(left);
                const hasRight = sameColor(right);
                const hasUp = sameColor(up);
                const hasDown = sameColor(down);

                const isTShape =
                    (hasLeft && hasRight && hasUp) ||
                    (hasLeft && hasRight && hasDown) ||
                    (hasUp && hasDown && hasLeft) ||
                    (hasUp && hasDown && hasRight);

                const isLShape =
                    (hasLeft && hasDown) ||
                    (hasLeft && hasUp) ||
                    (hasRight && hasDown) ||
                    (hasRight && hasUp);

                if (!isTShape && !isLShape) return;

                processedT.add(`h_${hIdx}`);
                processedT.add(`v_${vIdx}`);

                const target =
                    activeSwappedTile &&
                    (h.line.includes(activeSwappedTile) || v.line.includes(activeSwappedTile))
                        ? activeSwappedTile
                        : intersection;

                addCandidate(target.row, target.col, 'bomb', h.color);
            });
        });

        hMatches.forEach((h, hIdx) => {
            if (h.len === 4 && !processedT.has(`h_${hIdx}`)) {
                const target = h.line.includes(activeSwappedTile) ? activeSwappedTile : h.line[Math.floor(h.len / 2)];
                addCandidate(target.row, target.col, 'row_rocket', h.color);
            }
        });
        vMatches.forEach((v, vIdx) => {
            if (v.len === 4 && !processedT.has(`v_${vIdx}`)) {
                const target = v.line.includes(activeSwappedTile) ? activeSwappedTile : v.line[Math.floor(v.len / 2)];
                addCandidate(target.row, target.col, 'col_rocket', v.color);
            }
        });

        spawnGridMap.forEach(sp => spawnSpecials.push(sp));

        const expanded = new Set(matchedTiles);
        const processedSpecials = new Set();
        matchedTiles.forEach(tile => {
            this.expandSpecialEffect(tile, expanded, processedSpecials);
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

        let sumX = 0;
        let sumY = 0;
        let scoreGain = 0;

        if (this.scene.score !== undefined) {
            scoreGain = matches.length * 10 * this.comboCount;
            this.scene.score += scoreGain;
            if (this.scene.updateScore) {
                this.scene.updateScore(scoreGain);
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
            this.showScorePopup(sumX / matches.length, (sumY / matches.length) - 10, scoreGain, this.comboCount);
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
                                    this.comboCount++;
                                    this.clearMatches(newMatchesResult);
                                } else {
                                    // 下落完成後檢查是否有解，若死局則自動洗牌
                                    if (!this.hasPossibleMove()) {
                                        this.shuffleBoard();
                                    } else {
                                        this.isBusy = false;
                                    }
                                }
                            });
                        }
                    }
                });
            });
        } else {
            if (!this.hasPossibleMove()) {
                this.shuffleBoard();
            } else {
                this.isBusy = false;
            }
        }
    }

    // 檢查是否有至少一步可消除的棋（無解盤面檢測）
    hasPossibleMove() {
        // 先檢查盤面上是否有特殊道具（特殊道具可以直接點擊）
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] && this.grid[r][c].specialType !== 'none') return true;
            }
        }

        // 模擬交換檢查
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cur = this.grid[r][c];
                if (!cur) continue;

                // 檢查右邊交換
                if (c + 1 < this.cols) {
                    const right = this.grid[r][c + 1];
                    if (right && this.wouldMatch(cur, right)) return true;
                }

                // 檢查下邊交換
                if (r + 1 < this.rows) {
                    const down = this.grid[r + 1][c];
                    if (down && this.wouldMatch(cur, down)) return true;
                }
            }
        }
        return false;
    }

    wouldMatch(tileA, tileB) {
        // 虛擬交換
        const rA = tileA.row, cA = tileA.col;
        const rB = tileB.row, cB = tileB.col;

        this.grid[rA][cA] = tileB;
        this.grid[rB][cB] = tileA;

        tileA.row = rB; tileA.col = cB;
        tileB.row = rA; tileB.col = cA;

        const res = this.checkMatchesDetailed();
        const hasMatch = res.tiles.length > 0;

        // 還原
        this.grid[rA][cA] = tileA;
        this.grid[rB][cB] = tileB;

        tileA.row = rA; tileA.col = cA;
        tileB.row = rB; tileB.col = cB;

        return hasMatch;
    }

    // 無解盤面自動洗牌
    shuffleBoard() {
        this.isBusy = true;

        const txt = this.scene.add.text(this.x, this.y, '無解，自動洗牌中... 🔄', {
            fontSize: '32px', fontStyle: 'bold', color: '#ffe14d', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: txt,
            scale: 1.2,
            alpha: 0,
            duration: 1200,
            onComplete: () => txt.destroy()
        });

        // 將所有一般方塊重新分配位置
        const allTiles = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c]) allTiles.push(this.grid[r][c]);
            }
        }

        Phaser.Utils.Array.Shuffle(allTiles);

        let idx = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = allTiles[idx++];
                this.grid[r][c] = tile;
                tile.row = r;
                tile.col = c;

                const pos = this.worldPos(r, c);
                this.scene.tweens.add({
                    targets: tile,
                    x: pos.x,
                    y: pos.y,
                    duration: 400,
                    ease: 'Cubic.easeInOut'
                });
            }
        }

        this.scene.time.delayedCall(500, () => {
            const matches = this.checkMatchesDetailed();
            if (matches.tiles.length > 0 || !this.hasPossibleMove()) {
                this.shuffleBoard();
            } else {
                this.isBusy = false;
            }
        });
    }
}

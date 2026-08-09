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

        this.scoreTextPool = [];
        this.rowBeamPool = [];
        this.colBeamPool = [];
        this.wavePool = [];

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
    }

    selectTile(tile) {
        if (this.isBusy) return;
        if (tile.specialType !== 'none' && tile.specialType !== 'rainbow') {
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
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
                this.swapTiles(tileA, tileB);
            } else {
                this.selectedTile.setSelected(false);
                this.selectedTile = tile;
                tile.setSelected(true);
            }
        }
    }

    handleDragSwap(tileA, targetRow, targetCol) {
        if (this.isBusy) return;
        const tileB = this.grid[targetRow][targetCol];
        if (tileB) {
            if (this.selectedTile) {
                this.selectedTile.setSelected(false);
                this.selectedTile = null;
            }
            this.swapTiles(tileA, tileB);
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
        const posA = this.worldPos(rA, cA);
        const posB = this.worldPos(rB, cB);
        this.scene.tweens.killTweensOf(tileA);
        this.scene.tweens.killTweensOf(tileB);
        this.scene.tweens.add({ targets: tileA, x: posB.x, y: posB.y, duration: 200, ease: 'Back.easeOut' });
        this.scene.tweens.add({
            targets: tileB, x: posA.x, y: posA.y, duration: 200, ease: 'Back.easeOut',
            onComplete: () => {
                const isSpecialA = tileA.specialType !== 'none';
                const isSpecialB = tileB.specialType !== 'none';
                if (isSpecialA || isSpecialB) {
                    this.handleSpecialCombo(tileA, tileB);
                    return;
                }
                const matchesResult = this.checkMatchesDetailed(tileA);
                if (matchesResult.tiles.length > 0) {
                    if (this.scene.onMoveUsed) this.scene.onMoveUsed();
                    this.clearMatches(matchesResult);
                } else {
                    this.grid[rA][cA] = tileA;
                    this.grid[rB][cB] = tileB;
                    tileA.row = rA; tileA.col = cA;
                    tileB.row = rB; tileB.col = cB;
                    this.scene.tweens.add({ targets: tileA, x: posA.x, y: posA.y, duration: 180, ease: 'Power2' });
                    this.scene.tweens.add({
                        targets: tileB, x: posB.x, y: posB.y, duration: 180, ease: 'Power2',
                        onComplete: () => { this.isBusy = false; }
                    });
                }
            }
        });
    }

    handleSpecialCombo(tileA, tileB) {
        if (this.scene.onMoveUsed) this.scene.onMoveUsed();

        const typeA = tileA.specialType;
        const typeB = tileB.specialType;

        if (typeA === 'rainbow' && typeB === 'rainbow') {
            const allTiles = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c]) allTiles.push(this.grid[r][c]);
                }
            }
            this.queueShake(500, 0.05);
            this.flushShake();
            this.clearMatches({ tiles: allTiles, spawnSpecials: [] });
            return;
        }

        if (typeA === 'rainbow' || typeB === 'rainbow') {
            const rainbowTile = typeA === 'rainbow' ? tileA : tileB;
            const otherTile = typeA === 'rainbow' ? tileB : tileA;
            const targetColor = otherTile.colorType;
            if (otherTile.specialType === 'none') {
                const toClear = [rainbowTile];
                for (let r = 0; r < this.rows; r++) {
                    for (let c = 0; c < this.cols; c++) {
                        const t = this.grid[r][c];
                        if (t && t.colorType === targetColor) toClear.push(t);
                    }
                }
                this.queueShake(300, 0.03);
                this.flushShake();
                this.clearMatches({ tiles: toClear, spawnSpecials: [] });
            } else {
                const targetSpecialType = otherTile.specialType;
                const convertedSpecials = [];
                for (let r = 0; r < this.rows; r++) {
                    for (let c = 0; c < this.cols; c++) {
                        const t = this.grid[r][c];
                        if (t && t.colorType === targetColor) {
                            t.setSpecial(targetSpecialType);
                            convertedSpecials.push(t);
                        }
                    }
                }
                const expanded = new Set([rainbowTile, otherTile, ...convertedSpecials]);
                const processedSpecials = new Set();
                convertedSpecials.forEach(sp => this.expandSpecialEffect(sp, expanded, processedSpecials));

                this.flushShake();
                this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
            }
            return;
        }

        const isRocketA = typeA === 'row_rocket' || typeA === 'col_rocket';
        const isRocketB = typeB === 'row_rocket' || typeB === 'col_rocket';
        if (isRocketA && isRocketB) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;
            this.createRocketBeam(tileB.x, tileB.y, true);
            this.createRocketBeam(tileB.x, tileB.y, false);
            this.queueShake(300, 0.03);
            for (let c = 0; c < this.cols; c++) if (this.grid[centerRow][c]) expanded.add(this.grid[centerRow][c]);
            for (let r = 0; r < this.rows; r++) if (this.grid[r][centerCol]) expanded.add(this.grid[r][centerCol]);
            this.flushShake();
            this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
            return;
        }

        const isBombA = typeA === 'bomb';
        const isBombB = typeB === 'bomb';
        if ((isRocketA && isBombB) || (isBombA && isRocketB)) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;
            this.createShockwave(tileB.x, tileB.y);
            this.queueShake(400, 0.04);
            for (let r = Math.max(0, centerRow - 1); r <= Math.min(this.rows - 1, centerRow + 1); r++) {
                for (let c = 0; c < this.cols; c++) if (this.grid[r][c]) expanded.add(this.grid[r][c]);
            }
            for (let c = Math.max(0, centerCol - 1); c <= Math.min(this.cols - 1, centerCol + 1); c++) {
                for (let r = 0; r < this.rows; r++) if (this.grid[r][c]) expanded.add(this.grid[r][c]);
            }
            this.flushShake();
            this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
            return;
        }

        if (isBombA && isBombB) {
            const expanded = new Set([tileA, tileB]);
            const centerRow = tileB.row;
            const centerCol = tileB.col;
            this.createShockwave(tileB.x, tileB.y);
            this.queueShake(500, 0.05);
            for (let r = Math.max(0, centerRow - 2); r <= Math.min(this.rows - 1, centerRow + 2); r++) {
                for (let c = Math.max(0, centerCol - 2); c <= Math.min(this.cols - 1, centerCol + 2); c++) {
                    if (this.grid[r][c]) expanded.add(this.grid[r][c]);
                }
            }
            this.flushShake();
            this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
            return;
        }
    }

    triggerSingleSpecial(tile) {
        this.isBusy = true;
        const expanded = new Set([tile]);
        this.expandSpecialEffect(tile, expanded, new Set());
        this.flushShake();
        this.clearMatches({ tiles: Array.from(expanded), spawnSpecials: [] });
    }

    expandSpecialEffect(tile, expandedSet, processedSpecials) {
        if (!tile || processedSpecials.has(tile)) return;
        processedSpecials.add(tile);
        if (tile.specialType === 'row_rocket') {
            this.createRocketBeam(tile.x, tile.y, true);
            this.queueShake(200, 0.02);
            for (let c = 0; c < this.cols; c++) {
                const target = this.grid[tile.row][c];
                if (target) {
                    expandedSet.add(target);
                    if (target.specialType !== 'none' && target !== tile) {
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
                    if (target.specialType !== 'none' && target !== tile) {
                        this.expandSpecialEffect(target, expandedSet, processedSpecials);
                    }
                }
            }
        } else if (tile.specialType === 'bomb') {
            this.createShockwave(tile.x, tile.y);
            this.queueShake(300, 0.04);
            for (let r = Math.max(0, tile.row - 1); r <= Math.min(this.rows - 1, tile.row + 1); r++) {
                for (let c = Math.max(0, tile.col - 1); c <= Math.min(this.cols - 1, tile.col + 1); c++) {
                    const target = this.grid[r][c];
                    if (target) {
                        expandedSet.add(target);
                        if (target.specialType !== 'none' && target !== tile) {
                            this.expandSpecialEffect(target, expandedSet, processedSpecials);
                        }
                    }
                }
            }
        }
    }

    checkMatchesDetailed(activeSwappedTile = null) {
        const hMatches = [];
        const vMatches = [];
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
                        hMatches.push({ line, color: cur.colorType, length: matchLen });
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
                if (checkNext) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        const line = [];
                        for (let i = 0; i < matchLen; i++) line.push(this.grid[r - i][c]);
                        vMatches.push({ line, color: cur.colorType, length: matchLen });
                    }
                    matchLen = 1;
                }
            }
        }
        const matchedTilesSet = new Set();
        const spawnGridMap = new Map();
        const PRIORITY = { rainbow: 3, bomb: 2, rocket: 1 };
        const registerSpawn = (tile, type, color) => {
            const key = `${tile.row}_${tile.col}`;
            const pNew = PRIORITY[type.includes('rocket') ? 'rocket' : type];

            if (spawnGridMap.has(key)) {
                const existing = spawnGridMap.get(key);
                const pOld = PRIORITY[existing.type.includes('rocket') ? 'rocket' : existing.type];
                if (pNew > pOld) {
                    spawnGridMap.set(key, { row: tile.row, col: tile.col, type, color });
                }
            } else {
                spawnGridMap.set(key, { row: tile.row, col: tile.col, type, color });
            }
        };
        const pickSpawnTile = (line) => {
            if (activeSwappedTile && line.includes(activeSwappedTile)) {
                return activeSwappedTile;
            }
            return line[Math.floor(line.length / 2)];
        };
        hMatches.forEach(h => {
            h.line.forEach(t => matchedTilesSet.add(t));
            if (h.length >= 5) registerSpawn(pickSpawnTile(h.line), 'rainbow', 'rainbow');
        });
        vMatches.forEach(v => {
            v.line.forEach(t => matchedTilesSet.add(t));
            if (v.length >= 5) registerSpawn(pickSpawnTile(v.line), 'rainbow', 'rainbow');
        });
        hMatches.forEach(h => {
            vMatches.forEach(v => {
                if (h.color === v.color) {
                    const intersection = h.line.find(ht => v.line.includes(ht));
                    if (intersection) {
                        const r = intersection.row;
                        const c = intersection.col;
                        const sameColor = (tile) => tile && tile.colorType === h.color && tile.colorType !== 'rainbow';
                        const hasLeft = c > 0 && sameColor(this.grid[r][c - 1]);
                        const hasRight = c < this.cols - 1 && sameColor(this.grid[r][c + 1]);
                        const hasUp = r > 0 && sameColor(this.grid[r - 1][c]);
                        const hasDown = r < this.rows - 1 && sameColor(this.grid[r + 1][c]);
                        const isTShape = (hasLeft && hasRight && hasDown) || (hasLeft && hasRight && hasUp) || (hasUp && hasDown && hasLeft) || (hasUp && hasDown && hasRight);
                        const isLShape = (hasRight && hasDown) || (hasRight && hasUp) || (hasLeft && hasDown) || (hasLeft && hasUp);
                        if (isTShape || isLShape) {
                            registerSpawn(intersection, 'bomb', h.color);
                        }
                    }
                }
            });
        });
        hMatches.forEach(h => {
            if (h.length === 4) registerSpawn(pickSpawnTile(h.line), 'col_rocket', h.color);
        });
        vMatches.forEach(v => {
            if (v.length === 4) registerSpawn(pickSpawnTile(v.line), 'row_rocket', v.color);
        });
        const expanded = new Set(matchedTilesSet);
        const sharedProcessed = new Set();
        matchedTilesSet.forEach(tile => this.expandSpecialEffect(tile, expanded, sharedProcessed));
        this.flushShake();
        return { tiles: Array.from(expanded), spawnSpecials: Array.from(spawnGridMap.values()) };
    }

    clearMatches(matchesResult) {
        const matches = matchesResult.tiles;
        if (matches.length === 0) {
            this.isBusy = false;
            return;
        }

        let cx = 0, cy = 0;
        matches.forEach(t => { cx += t.x; cy += t.y; });
        cx /= matches.length; cy /= matches.length;

        const scoreGain = matches.length * 10 * this.comboCount;
        if (this.scene.updateScore) this.scene.updateScore(scoreGain);
        this.showFloatingScore(cx, cy, scoreGain);

        matches.forEach((tile, i) => {
            this.grid[tile.row][tile.col] = null;
            this.scene.tweens.add({
                targets: tile,
                scaleX: 0, scaleY: 0, alpha: 0,
                angle: Phaser.Math.Between(-90, 90),
                duration: 200,
                delay: Math.min(i * 8, 120),
                ease: 'Back.easeIn',
                onComplete: () => tile.destroy()
            });
        });

        this.scene.time.delayedCall(220, () => {
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
                        duration: 300, ease: 'Bounce.easeOut'
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
                    const targetPos = this.worldPos(targetRow, col);
                    dropTweens.push({ targets: tile, y: targetPos.y, duration: 280, ease: 'Bounce.easeOut' });
                }
            }
            for (let i = 0; i < emptySlots; i++) {
                const targetRow = emptySlots - 1 - i;
                const randomColor = Phaser.Math.RND.pick(this.colors);
                const pos = this.worldPos(targetRow, col);
                const startY = pos.y - (emptySlots * 70);
                const tile = new Tile(this.scene, pos.x, startY, `tile_${randomColor}`, targetRow, col);
                this.add(tile);
                this.grid[targetRow][col] = tile;
                dropTweens.push({ targets: tile, y: pos.y, duration: 320 + (i * 35), ease: 'Bounce.easeOut' });
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
                            this.scene.time.delayedCall(120, () => {
                                const newMatches = this.checkMatchesDetailed();
                                if (newMatches.tiles.length > 0) {
                                    this.comboCount++;
                                    this.clearMatches(newMatches);
                                } else {
                                    this.isBusy = false;
                                    if (!this.hasPossibleMove()) {
                                        this.shuffleBoard();
                                    }
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

    hasPossibleMove() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] && this.grid[r][c].specialType !== 'none') return true;
                if (c < this.cols - 1) {
                    if (this.testSwapHasMatch(r, c, r, c + 1)) return true;
                }
                if (r < this.rows - 1) {
                    if (this.testSwapHasMatch(r, c, r + 1, c)) return true;
                }
            }
        }
        return false;
    }

    testSwapHasMatch(r1, c1, r2, c2) {
        const t1 = this.grid[r1][c1];
        const t2 = this.grid[r2][c2];
        if (!t1 || !t2) return false;
        this.grid[r1][c1] = t2;
        this.grid[r2][c2] = t1;
        let hasMatch = false;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                if (this.grid[r][c] && this.grid[r][c + 1] && this.grid[r][c + 2]) {
                    if (this.grid[r][c].colorType === this.grid[r][c + 1].colorType &&
                        this.grid[r][c].colorType === this.grid[r][c + 2].colorType) {
                        hasMatch = true; break;
                    }
                }
            }
            if (hasMatch) break;
        }
        this.grid[r1][c1] = t1;
        this.grid[r2][c2] = t2;
        return hasMatch;
    }

    shuffleBoard() {
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
                tile.row = r;
                tile.col = c;
                this.grid[r][c] = tile;
                const pos = this.worldPos(r, c);
                this.scene.tweens.add({ targets: tile, x: pos.x, y: pos.y, duration: 400, ease: 'Power2' });
            }
        }
    }

    queueShake(duration, intensity) {
        if (duration > this._shakeDuration) this._shakeDuration = duration;
        if (intensity > this._shakeIntensity) this._shakeIntensity = intensity;
    }

    flushShake() {
        if (this._shakeDuration > 0) {
            this.scene.cameras.main.shake(this._shakeDuration, this._shakeIntensity);
            this._shakeDuration = 0;
            this._shakeIntensity = 0;
        }
    }

    showFloatingScore(x, y, amount) {
        let obj = this.scoreTextPool.find(o => !o.getData('active'));
        if (!obj) {
            obj = this.scene.add.text(0, 0, '', {
                fontSize: '26px',
                fontStyle: 'bold',
                color: '#FFD700',
                stroke: '#5A3311',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(50);
            this.add(obj);
            this.scoreTextPool.push(obj);
        }
        obj.setData('active', true);
        obj.setText(`+${amount}`);
        obj.setPosition(x, y);
        obj.setAlpha(1);
        obj.setScale(0.5);
        obj.setVisible(true);
        this.scene.tweens.killTweensOf(obj);
        this.scene.tweens.add({
            targets: obj,
            y: y - 55,
            alpha: 0,
            scale: 1.15,
            duration: 650,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                obj.setData('active', false);
                obj.setVisible(false);
            }
        });
    }

    createRocketBeam(x, y, isRow) {
        const pool = isRow ? this.rowBeamPool : this.colBeamPool;
        let beam = pool.find(o => !o.getData('active'));
        if (!beam) {
            beam = this.scene.add.rectangle(0, 0, isRow ? 800 : 20, isRow ? 20 : 800, 0xffffff, 1);
            this.add(beam);
            pool.push(beam);
        }
        beam.setData('active', true);
        beam.setPosition(x, y);
        beam.setAlpha(1);
        beam.setVisible(true);
        this.scene.tweens.killTweensOf(beam);
        this.scene.tweens.add({
            targets: beam,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                beam.setData('active', false);
                beam.setVisible(false);
            }
        });
    }

    createShockwave(x, y) {
        let wave = this.wavePool.find(o => !o.getData('active'));
        if (!wave) {
            wave = this.scene.add.circle(0, 0, 30, 0xffaa00, 1);
            this.add(wave);
            this.wavePool.push(wave);
        }
        wave.setData('active', true);
        wave.setPosition(x, y);
        wave.setScale(1);
        wave.setAlpha(1);
        wave.setVisible(true);
        this.scene.tweens.killTweensOf(wave);
        this.scene.tweens.add({
            targets: wave,
            scale: 8,
            alpha: 0,
            duration: 500,
            ease: 'Sine.easeOut',
            onComplete: () => {
                wave.setData('active', false);
                wave.setVisible(false);
            }
        });
    }
}

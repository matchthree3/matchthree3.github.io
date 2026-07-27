import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    // 核心修正：開啟高 DPI 支援，自動套用裝置的最高像素比（讓文字與圖片無敵清晰）
    resolution: window.devicePixelRatio || 1,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true
    },
    backgroundColor: '#302c34',
    scene: [BootScene, GameScene]
};

new Phaser.Game(config);

import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
        antialias: true,
        roundPixels: true,
        powerPreference: 'high-performance'
    },
    fps: { target: 60, forceSetTimeOut: false },
    backgroundColor: '#302c34',
    scene: [BootScene, MenuScene, GameScene]
};

new Phaser.Game(config);

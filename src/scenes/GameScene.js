import Phaser from 'phaser';
import Board from '../objects/Board.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        this.add.text(270, 100, 'Score: 0', {
            fontSize: '36px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.board = new Board(this, 270, 520);
    }
}

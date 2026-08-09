/**
 * 資料驅動關卡系統。
 * 依關卡編號動態生成目標分數與步數限制，支援無限擴充[cite: 2]。
 */
export default class LevelConfig {
    static getLevel(id) {
        const target = Math.round((420 + id * 260 + Math.pow(id, 1.18) * 45) / 10) * 10;
        const moves = Math.max(12, 22 - Math.floor(id / 4));
        return {
            id,
            name: `第 ${id} 關`,
            target,
            moves,
            stars: {
                1: target,
                2: Math.floor(target * 1.4),
                3: Math.floor(target * 2)
            }
        };
    }

    static getLevelRange(startId, count) {
        const list = [];
        for (let i = 0; i < count; i++) {
            list.push(this.getLevel(startId + i));
        }
        return list;
    }
}

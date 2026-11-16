// ============================================================================
// config.js: 坐標映射公式、PRNG 偽隨機數與全域常數 (100% 保留原本映射)
// ============================================================================
const IMG_W = 1024;
const IMG_H = 534;
const toX = (u) => u - IMG_W / 2;
const toZ = (v) => v - IMG_H / 2;
const toU = (x) => Math.round(x + IMG_W / 2);
const toV = (z) => Math.round(z + IMG_H / 2);

// 地圖靜態隨機種子 (確保 1,200+ 棟建築固定不變)
let mapRngSeed = 1337;
function seededRandom() {
    mapRngSeed = (mapRngSeed * 16807) % 2147483647;
    return (mapRngSeed - 1) / 2147483646;
}
function randRange(min, max) {
    return min + seededRandom() * (max - min);
}

// 任務目標獨立種子
let missionSeed = 1337;
function missionRandom() {
    missionSeed = (missionSeed * 48271) % 2147483647;
    return (missionSeed - 1) / 2147483646;
}

// 全域圖層群組
const layerGroups = {
    rivers: new THREE.Group(),
    parks: new THREE.Group(),
    roads: new THREE.Group(),
    buildings: new THREE.Group(),
    rooftops: new THREE.Group(),
    trees: new THREE.Group(),
    mission: new THREE.Group(),
    fx: new THREE.Group()
};

let totalBuildingCount = 0;
let totalTreeCount = 0;
let totalRoadSegments = 0;

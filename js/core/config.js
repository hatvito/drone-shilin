// ============================================================================
// js/core/config.js: 地圖幾何尺寸、坐標映射公式與 PRNG 偽隨機數生成器
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    // 地圖與世界坐標轉換常數
    const IMG_W = 1024;
    const IMG_H = 534;
    const MAP_HALF_W = IMG_W / 2; // 512.0
    const MAP_HALF_D = IMG_H / 2; // 267.0

    // 飛行空域規範
    const MIN_ALTITUDE = 0.0;
    const MAX_ALTITUDE = 25.0; // 嚴格低空巷戰限高 25m

    // 光達與感測器常數
    const DRONE_RADIUS = 0.25;
    const LIDAR_BEAMS = 16;
    const LIDAR_MAX_DIST = 45.0;

    // UV 到 Three.js 世界坐標 (X, Z) 轉換
    const toX = (u) => u - IMG_W / 2;
    const toZ = (v) => v - IMG_H / 2;
    const toU = (x) => Math.round(x + IMG_W / 2);
    const toV = (z) => Math.round(z + IMG_H / 2);

    // 地圖靜態隨機種子 (確保 1,200+ 棟建築、樹木與高度固定重現)
    let mapRngSeed = 1337;
    function resetMapSeed(seed = 1337) {
        mapRngSeed = seed;
    }
    function seededRandom() {
        mapRngSeed = (mapRngSeed * 16807) % 2147483647;
        return (mapRngSeed - 1) / 2147483646;
    }
    function randRange(min, max) {
        return min + seededRandom() * (max - min);
    }

    // 任務隨機種子 (決定起點與終點停機坪)
    let missionSeed = 1337;
    function setMissionSeed(seed) {
        missionSeed = seed;
    }
    function missionRandom() {
        missionSeed = (missionSeed * 48271) % 2147483647;
        return (missionSeed - 1) / 2147483646;
    }

    ns.Config = {
        IMG_W,
        IMG_H,
        MAP_HALF_W,
        MAP_HALF_D,
        MIN_ALTITUDE,
        MAX_ALTITUDE,
        DRONE_RADIUS,
        LIDAR_BEAMS,
        LIDAR_MAX_DIST,
        toX,
        toZ,
        toU,
        toV,
        resetMapSeed,
        seededRandom,
        randRange,
        setMissionSeed,
        missionRandom
    };
})(window.ShilinDrone);

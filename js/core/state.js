// ============================================================================
// js/core/state.js: 全域狀態儲存庫、圖層群組與遙測記錄
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    // Three.js 分層群組，便於控制可見度與射線探測
    const layerGroups = {
        rivers: new THREE.Group(),
        parks: new THREE.Group(),
        roads: new THREE.Group(),
        buildings: new THREE.Group(),
        rooftops: new THREE.Group(),
        trees: new THREE.Group(),
        mission: new THREE.Group(),
        fx: new THREE.Group(),
        lidar: new THREE.Group()
    };

    // 實體計數統計
    const stats = {
        totalBuildingCount: 0,
        totalTreeCount: 0,
        totalRoadSegments: 0
    };

    // 無人機即時飛行狀態
    const flightState = {
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        yaw: 0,
        status: 'IDLE', // 'IDLE' | 'FLYING' | 'PAUSED' | 'SUCCESS' | 'CRASHED'
        initialDistance: 1,
        remainingDistance: 1,
        progress: 0,
        flightTime: 0
    };

    // 模擬器運行設定
    const simSettings = {
        isSimulating: false,
        simSpeed: 1.0,           // 1.0x, 2.0x, 4.0x 加速測試
        cameraViewMode: 'orbit', // 'orbit' | 'follow'
        showLidarRays: false,    // 是否在 3D 場景即時顯示 16 向光達光束
        soundEnabled: true,      // 是否啟用 Web Audio 音效回饋
        difficulty: 'normal',    // 'easy' (40m) | 'normal' (25m) | 'hard' (15m)
        maxAltitude: 25.0        // 當前難度空域限高
    };

    // 任務相關實體參考
    const missionEntities = {
        startHelipad: null,
        targetHelipad: null,
        startBuildingMesh: null,
        startBuildingOriginalMat: null,
        targetBuildingMesh: null,
        targetBuildingOriginalMat: null,
        candidateBuildings: [] // 所有具備停機坪條件的屋頂
    };

    // 互動與物理實體清單
    const physicalObstacles = []; // { box: Box3, name: string }
    const interactiveMeshes = []; // 點擊建築物高亮檢視
    const roadCurvesForTraffic = [];
    const trafficCars = [];

    // 動態地標實體參考 (動畫更新用)
    const dynamicObjects = {
        ferrisWheelGroup: null,
        carouselGroup: null,
        mrtTrainGroup: null,
        mrtCurve: null
    };

    // 2D HTML 地標與任務標籤清單
    const htmlLabels = [];
    const missionHtmlLabels = [];

    // 黑盒子飛行遙測紀錄 (每 0.1 秒記錄一次)
    const blackboxLogs = [];

    ns.State = {
        layerGroups,
        stats,
        flightState,
        simSettings,
        missionEntities,
        physicalObstacles,
        interactiveMeshes,
        roadCurvesForTraffic,
        trafficCars,
        dynamicObjects,
        htmlLabels,
        missionHtmlLabels,
        blackboxLogs
    };
})(window.ShilinDrone);

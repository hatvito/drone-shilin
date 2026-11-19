// ============================================================================
// js/main.js: 台北士林無人機避障挑戰賽 - 主程式進入點、戰術任務環境載入與渲染迴圈
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const clock = new THREE.Clock();

    window.addEventListener('load', () => {
        // 1. 初始化種子與材質庫 (具備 CDN 容錯保護)
        if (ns.Config && ns.Config.resetMapSeed) {
            ns.Config.resetMapSeed(1337);
        }
        if (ns.Materials && ns.Materials.initMaterials) {
            ns.Materials.initMaterials();
        } else {
            console.warn('[Main] ns.Materials 尚未就緒，已套用安全防護模式');
        }

        // 2. 初始化 Three.js 核心場景與光源
        if (ns.Scene && ns.Scene.initScene) {
            ns.Scene.initScene('canvas-container');
        }

        // 3. 依序建構真實地理環境
        if (ns.Ground && ns.Ground.buildCurvedGroundCanvasMap) ns.Ground.buildCurvedGroundCanvasMap();
        if (ns.Waterways && ns.Waterways.buildOrganicRiversAndLevees) ns.Waterways.buildOrganicRiversAndLevees();
        if (ns.Parks && ns.Parks.buildParksWetlandsAndCurvedPaths) ns.Parks.buildParksWetlandsAndCurvedPaths();
        if (ns.Roads && ns.Roads.buildRealisticCurvedRoadNetwork) ns.Roads.buildRealisticCurvedRoadNetwork();
        if (ns.Landmarks && ns.Landmarks.buildLandmarks) ns.Landmarks.buildLandmarks();
        if (ns.UrbanDistricts && ns.UrbanDistricts.buildUrbanDistricts) ns.UrbanDistricts.buildUrbanDistricts();
        if (ns.Trees && ns.Trees.buildRichTreesAndBusStation) ns.Trees.buildRichTreesAndBusStation();
        if (ns.Traffic && ns.Traffic.buildTrafficSystem) ns.Traffic.buildTrafficSystem();

        // 4. 建立穿梭機實體與物理感測器
        if (ns.DroneModel && ns.DroneModel.createDroneEntity) ns.DroneModel.createDroneEntity();
        if (ns.Trail && ns.Trail.initTrail) ns.Trail.initTrail();
        if (ns.LidarVisualizer && ns.LidarVisualizer.initLidarVisualizer) ns.LidarVisualizer.initLidarVisualizer();
        if (ns.Physics && ns.Physics.buildPhysicsBoundingBoxes) ns.Physics.buildPhysicsBoundingBoxes();

        // 5. 初始化任務起訖點停機坪
        if (ns.MissionManager && ns.MissionManager.applyMissionSeed) ns.MissionManager.applyMissionSeed();

        // 6. 解析當前戰術關卡任務 (URL 參數：?mission=m1_speedrun)
        const urlParams = new URLSearchParams(window.location.search);
        const missionId = urlParams.get('mission') || 'm1_speedrun';
        const activeMission = (ns.MissionData && ns.MissionData.getMissionById)
            ? ns.MissionData.getMissionById(missionId)
            : null;
        ns.State.activeMission = activeMission;

        if (activeMission && ns.MissionHazards && ns.MissionHazards.applyMissionEnvironment) {
            try {
                ns.MissionHazards.applyMissionEnvironment(activeMission);
            } catch (err) {
                console.error('[MissionHazards] 載入關卡環境發生錯誤：', err);
            }
        }

        const missionBadge = document.getElementById('current-mission-badge');
        if (missionBadge && activeMission) {
            missionBadge.innerHTML = `<span>${activeMission.badge}</span> <span class="font-black text-white">${activeMission.title}</span>`;
            missionBadge.title = `當前戰術關卡：${activeMission.title} · 點擊切換任務`;
        }

        // 7. 初始化 3D 霓虹幽靈無人機與 Firebase 雲端排行榜
        if (ns.GhostDrone && ns.GhostDrone.initGhostDrone) {
            ns.GhostDrone.initGhostDrone();
        }
        if (ns.Leaderboard && ns.Leaderboard.initLeaderboard) {
            ns.Leaderboard.initLeaderboard();
        }

        // 8. 初始化 Blockly 視覺化積木系統 (若在 blockly.html 模式)
        if (ns.BlocklyManager && ns.BlocklyManager.initBlocklySystem) {
            ns.BlocklyManager.initBlocklySystem();
        }

        // 9. 設定使用者點擊互動
        if (ns.Interaction && ns.Interaction.setupInteraction) {
            ns.Interaction.setupInteraction();
        }

        // 10. 載入預設程式碼與 AI 提示詞
        const codeEditor = document.getElementById('code-editor');
        if (codeEditor && ns.DefaultCode) codeEditor.value = ns.DefaultCode.DEFAULT_CODE;

        const promptText = document.getElementById('ai-prompt-text');
        if (promptText && ns.DefaultCode) promptText.value = ns.DefaultCode.AI_PROMPT_TEXT;

        // 11. 更新頂部街廓建築統計標籤
        const statsBadge = document.getElementById('stats-badge');
        if (statsBadge && ns.State && ns.State.stats) {
            statsBadge.textContent = `${ns.State.stats.totalBuildingCount.toLocaleString()} 棟多樣化建築 · ${ns.State.stats.totalRoadSegments} 條彎曲道路/水岸`;
        }

        // 12. 啟動主渲染循環
        animate();
    });

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.getElapsedTime();

        // 飛行物理更新步進
        ns.FlightEngine.stepFlight(dt);

        // 無人機螺旋槳自旋
        ns.DroneModel.updateDroneAnimation(dt, ns.State.simSettings.isSimulating);

        // 幽靈車即時同步重播步進與標籤更新
        if (ns.GhostDrone && ns.GhostDrone.updateGhostDrone) {
            ns.GhostDrone.updateGhostDrone(dt, ns.State.flightState.flightTime, ns.State.simSettings.isSimulating);
        }

        // 特種任務動態障礙更新 (如飛鳥拍翅)
        if (ns.MissionHazards && ns.MissionHazards.updateHazards) {
            ns.MissionHazards.updateHazards(dt, elapsed);
        }

        // 兒童新樂園摩天輪與旋轉木馬旋轉
        const dyn = ns.State.dynamicObjects;
        if (dyn.ferrisWheelGroup) dyn.ferrisWheelGroup.rotation.z = elapsed * 0.35;
        if (dyn.carouselGroup) dyn.carouselGroup.rotation.y = elapsed * 0.5;

        // 捷運與道路動態車流步進
        ns.Traffic.updateTraffic(elapsed);

        // 任務停機坪水晶標記旋轉
        ns.State.layerGroups.mission.children.forEach(pad => {
            if (pad.marker) pad.marker.rotation.y += 0.03;
        });

        // 追蹤相機更新
        ns.UIController.updateCameraFollow();

        // 2D HTML 地標與任務懸浮標籤螢幕投影更新
        const camera = ns.Scene.getCamera();
        ns.Labels.updateLabelProjections(camera);

        // WebGL 影格繪製
        const renderer = ns.Scene.getRenderer();
        const scene = ns.Scene.getScene();
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }
})(window.ShilinDrone);

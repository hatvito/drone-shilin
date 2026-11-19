// ============================================================================
// js/world/mission-hazards.js: 特種任務環境障礙生成器 (電線、濃霧、斜屋頂、動態飛鳥、側風)
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { layerGroups, physicalObstacles } = ns.State;
    const hazardGroup = new THREE.Group();
    let currentHazardConfig = null;

    // 動態飛鳥實體
    const flockBirds = [];

    function initMissionHazards() {
        if (!hazardGroup.parent) {
            ns.Scene.getScene().add(hazardGroup);
        }
    }

    function applyMissionEnvironment(missionConfig) {
        initMissionHazards();
        clearHazards();
        currentHazardConfig = missionConfig;

        const scene = ns.Scene.getScene();

        // 1. 濃霧天候控制
        if (missionConfig.hasFog) {
            scene.fog = new THREE.FogExp2(0x94a3b8, 0.024);
        } else {
            scene.fog = null;
        }

        // 2. 高空細電線網生成
        if (missionConfig.hasWires) {
            buildOverheadWires();
        }

        // 3. 斜頂鐵皮屋頂與水塔生成
        if (missionConfig.hasSlopedRoof) {
            buildSlopedRoofsAndWaterTanks();
        }

        // 4. 動態飛鳥群生成
        if (missionConfig.hasBirds) {
            buildBirdFlock();
        }

        // 5. 天候日照切換
        if (missionConfig.weather && ns.Scene.setLightingMode) {
            ns.Scene.setLightingMode(missionConfig.weather);
        }

        console.log(`[Hazards] 已載入任務【${missionConfig.title}】之環境障礙`);
    }

    function clearHazards() {
        const scene = ns.Scene.getScene();
        if (scene) scene.fog = null;

        hazardGroup.clear();
        flockBirds.length = 0;

        // 移除特種障礙物理盒
        for (let i = physicalObstacles.length - 1; i >= 0; i--) {
            if (physicalObstacles[i].isHazard) {
                physicalObstacles.splice(i, 1);
            }
        }
    }

    // 🚡 生成街頭高空細黑電纜與電線桿
    function buildOverheadWires() {
        const roadCurves = ns.State.roadCurvesForTraffic;
        if (!roadCurves || roadCurves.length === 0) return;

        const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

        // 挑選主要路段架設電纜
        roadCurves.slice(0, 10).forEach(road => {
            const curve = road.curve;
            if (!curve) return;

            const p1 = curve.getPoint(0.2);
            const p2 = curve.getPoint(0.8);
            const mid = curve.getPoint(0.5);

            // 兩側電線桿 (高 12m)
            const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 12, 8);
            const pole1 = new THREE.Mesh(poleGeo, poleMat);
            pole1.position.set(p1.x, 6, p1.z);
            hazardGroup.add(pole1);

            const pole2 = new THREE.Mesh(poleGeo, poleMat);
            pole2.position.set(p2.x, 6, p2.z);
            hazardGroup.add(pole2);

            // 橫跨馬路的細電線 (半徑 0.04m 的細管)
            const wireCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(p1.x, 11.5, p1.z),
                new THREE.Vector3(mid.x, 9.8, mid.z), // 垂墜弧度
                new THREE.Vector3(p2.x, 11.5, p2.z)
            ]);

            const wireGeo = new THREE.TubeGeometry(wireCurve, 20, 0.045, 4, false);
            const wireMesh = new THREE.Mesh(wireGeo, wireMat);
            hazardGroup.add(wireMesh);

            // 登錄物理碰撞盒 (細電線致命碰撞)
            const wireBox = new THREE.Box3().setFromObject(wireMesh);
            physicalObstacles.push({
                box: wireBox,
                name: '⚡ 高壓細電纜',
                isHazard: true
            });
        });
    }

    // 🏠 生成斜面鐵皮屋頂與不鏽鋼水塔
    function buildSlopedRoofsAndWaterTanks() {
        const candidates = ns.State.missionEntities.candidateBuildings;
        if (!candidates || candidates.length === 0) return;

        const tinMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 }); // 經典藍色鐵皮
        const steelTankMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 }); // 銀色不鏽鋼水塔

        // 挑選部分候選建築屋頂加蓋斜頂
        candidates.slice(0, 15).forEach((b, idx) => {
            const roofY = b.roofY;
            const cx = b.center.x;
            const cz = b.center.z;

            if (idx % 2 === 0) {
                // 三角稜柱斜頂 (傾角約 18 度)
                const roofGeo = new THREE.ConeGeometry(9.0, 3.2, 4);
                const roofMesh = new THREE.Mesh(roofGeo, tinMat);
                roofMesh.position.set(cx, roofY + 1.6, cz);
                roofMesh.rotation.y = Math.PI / 4;
                hazardGroup.add(roofMesh);

                physicalObstacles.push({
                    box: new THREE.Box3().setFromObject(roofMesh),
                    name: '🏠 鐵皮斜屋頂 (傾角 18°)',
                    isHazard: true,
                    isSlope: true,
                    slopeAngle: 18.0
                });
            } else {
                // 不鏽鋼圓柱水塔
                const tankGeo = new THREE.CylinderGeometry(1.6, 1.6, 2.8, 16);
                const tankMesh = new THREE.Mesh(tankGeo, steelTankMat);
                tankMesh.position.set(cx + 2.5, roofY + 1.4, cz + 2.5);
                hazardGroup.add(tankMesh);

                physicalObstacles.push({
                    box: new THREE.Box3().setFromObject(tankMesh),
                    name: '🛢️ 頂樓不鏽鋼水塔',
                    isHazard: true
                });
            }
        });
    }

    // 🐦 生成低空動態飛鳥群 (基隆河畔)
    function buildBirdFlock() {
        const birdMat = new THREE.MeshStandardMaterial({ color: 0x475569 });

        for (let i = 0; i < 8; i++) {
            const birdGroup = new THREE.Group();

            // 簡潔飛鳥幾何體
            const body = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 5), birdMat);
            body.rotation.x = Math.PI / 2;
            birdGroup.add(body);

            const wingGeo = new THREE.BoxGeometry(0.8, 0.02, 0.25);
            const leftWing = new THREE.Mesh(wingGeo, birdMat);
            leftWing.position.x = -0.4;
            birdGroup.add(leftWing);

            const rightWing = new THREE.Mesh(wingGeo, birdMat);
            rightWing.position.x = 0.4;
            birdGroup.add(rightWing);

            birdGroup.leftWing = leftWing;
            birdGroup.rightWing = rightWing;

            // 初始隨機飛行高度與河畔位置
            const initX = (Math.random() - 0.5) * 300;
            const initY = 12.0 + Math.random() * 8.0;
            const initZ = (Math.random() - 0.5) * 300;
            birdGroup.position.set(initX, initY, initZ);

            // 飛行動量
            birdGroup.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 4.0,
                0,
                (Math.random() - 0.5) * 4.0
            );

            hazardGroup.add(birdGroup);
            flockBirds.push(birdGroup);
        }
    }

    // 每幀更新動態飛鳥拍翅與飛行
    function updateHazards(dt, elapsed) {
        // 更新飛鳥
        if (flockBirds.length > 0) {
            flockBirds.forEach(bird => {
                bird.position.addScaledVector(bird.velocity, dt);

                // 拍翅動畫
                const wingAngle = Math.sin(elapsed * 12.0) * 0.45;
                if (bird.leftWing) bird.leftWing.rotation.z = wingAngle;
                if (bird.rightWing) bird.rightWing.rotation.z = -wingAngle;

                // 面向飛行方向
                if (bird.velocity.lengthSq() > 0.1) {
                    bird.rotation.y = Math.atan2(bird.velocity.x, bird.velocity.z);
                }

                // 邊界循環漫遊
                if (bird.position.x > 350) bird.position.x = -350;
                if (bird.position.x < -350) bird.position.x = 350;
                if (bird.position.z > 350) bird.position.z = -350;
                if (bird.position.z < -350) bird.position.z = 350;
            });
        }
    }

    // 取得當前位置地表斜度 (ToF 感測器使用)
    function getSurfaceSlopeAngle(x, z) {
        if (!currentHazardConfig || !currentHazardConfig.hasSlopedRoof) return 0;
        // 搜尋附近是否有斜頂障礙
        const testPt = new THREE.Vector3(x, 15, z);
        for (let i = 0; i < physicalObstacles.length; i++) {
            const obs = physicalObstacles[i];
            if (obs.isSlope && obs.box && obs.box.containsPoint(testPt)) {
                return obs.slopeAngle || 18.0;
            }
        }
        return 0;
    }

    // 取得當前大樓側風推力向量 (物理引擎使用)
    function getCrosswindVector(pos, elapsed) {
        if (!currentHazardConfig || !currentHazardConfig.hasCrosswind) return null;
        // 陣發性穿堂風
        const gust = Math.sin(elapsed * 1.8) * Math.cos(pos.x * 0.05);
        if (gust > 0.3) {
            return new THREE.Vector3(gust * 2.8, 0, gust * 1.5);
        }
        return null;
    }

    ns.MissionHazards = {
        initMissionHazards,
        applyMissionEnvironment,
        clearHazards,
        updateHazards,
        getSurfaceSlopeAngle,
        getCrosswindVector,
        getFlockBirds: () => flockBirds
    };
})(window.ShilinDrone);

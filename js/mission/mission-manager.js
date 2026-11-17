// ============================================================================
// js/mission/mission-manager.js: 隨機種子任務起訖點配對、百米高空導引光柱與停機坪
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { setMissionSeed, missionRandom } = ns.Config;
    const { layerGroups, missionEntities } = ns.State;
    const { createMissionFloatingLabel, clearMissionLabels } = ns.Labels;

    function applyIsolatedHighlight(meshOrGroup, colorHex) {
        if (!meshOrGroup) return [];
        const backups = [];
        const root = (meshOrGroup.parent && meshOrGroup.parent !== layerGroups.buildings)
            ? meshOrGroup.parent
            : meshOrGroup;

        root.traverse(child => {
            if (child.isMesh && child.material) {
                backups.push({ mesh: child, mat: child.material });
                const highlightMat = new THREE.MeshStandardMaterial({
                    color: colorHex,
                    emissive: colorHex,
                    emissiveIntensity: 0.75,
                    roughness: 0.2,
                    metalness: 0.3
                });
                child.material = highlightMat;
            }
        });
        return backups;
    }

    function restoreIsolatedHighlight(backups) {
        if (!backups) return;
        backups.forEach(item => {
            if (item.mesh) item.mesh.material = item.mat;
        });
    }

    function createSuperVisibleHelipad(x, y, z, colorHex) {
        const padGroup = new THREE.Group();
        padGroup.position.set(x, y + 0.1, z);

        // 停機坪圓盤底座
        const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 2.2, 0.3, 32),
            new THREE.MeshBasicMaterial({ color: colorHex })
        );
        padGroup.add(pad);

        // 外圈光環
        const outerRing = new THREE.Mesh(
            new THREE.RingGeometry(2.8, 3.8, 32),
            new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
        );
        outerRing.rotation.x = -Math.PI / 2;
        outerRing.position.y = 0.2;
        padGroup.add(outerRing);

        // 110米超高貫穿核心光柱 (防止遠處被其它高樓遮蔽找不到停機坪)
        const coreBeam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.9, 0.9, 110, 16, 1, true),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
        );
        coreBeam.position.y = 55;
        padGroup.add(coreBeam);

        // 擴散光暈光柱
        const auraBeam = new THREE.Mesh(
            new THREE.CylinderGeometry(2.5, 4.5, 110, 20, 1, true),
            new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false })
        );
        auraBeam.position.y = 55;
        padGroup.add(auraBeam);

        // 旋轉八面體水晶導引信標
        const marker = new THREE.Mesh(
            new THREE.OctahedronGeometry(3.8, 0),
            new THREE.MeshBasicMaterial({ color: colorHex })
        );
        marker.position.y = 28;
        padGroup.add(marker);
        padGroup.marker = marker;

        return { mesh: padGroup, pos: new THREE.Vector3(x, y + 0.5, z) };
    }

    function applyMissionSeed(customSeed = null) {
        const inputEl = document.getElementById('mission-seed-input');
        const seedVal = customSeed !== null
            ? customSeed
            : (inputEl ? parseInt(inputEl.value) || 1337 : 1337);

        if (inputEl) inputEl.value = seedVal;
        setMissionSeed(seedVal);

        const candidates = missionEntities.candidateBuildings;
        if (candidates.length < 2) return;

        // 還原先前起訖點大樓的外觀原材質
        restoreIsolatedHighlight(missionEntities.startBuildingOriginalMat);
        restoreIsolatedHighlight(missionEntities.targetBuildingOriginalMat);

        clearMissionLabels();

        // 根據當前難度動態計算停機坪最高允許屋頂高度 (保留安全起降裕度)
        const maxAlt = (ns.State && ns.State.simSettings && ns.State.simSettings.maxAltitude) || 25.0;
        const maxRoofY = Math.max(7.5, maxAlt - 2.5);

        // 挑選兩棟屋頂高度低於 maxRoofY 且直線距離大於 180m 的大樓作為考題
        const validCandidates = candidates.filter(c => c.roofY <= maxRoofY);
        const pool = validCandidates.length >= 2 ? validCandidates : candidates;

        let idxA = 0, idxB = 1;
        let attempts = 0;
        while (attempts < 500) {
            idxA = Math.floor(missionRandom() * pool.length);
            idxB = Math.floor(missionRandom() * pool.length);
            const candA = pool[idxA];
            const candB = pool[idxB];

            if (idxA !== idxB && candA.roofY <= maxRoofY && candB.roofY <= maxRoofY && candA.center.distanceTo(candB.center) > 180) {
                break;
            }
            attempts++;
        }

        if (attempts >= 500) {
            idxA = 0;
            idxB = Math.min(pool.length - 1, 1);
            for (let i = 1; i < pool.length; i++) {
                if (pool[i].roofY <= maxRoofY && pool[i].center.distanceTo(pool[0].center) > 100) {
                    idxB = i;
                    break;
                }
            }
        }

        layerGroups.mission.clear();
        const bA = pool[idxA];
        const bB = pool[idxB];

        missionEntities.startBuildingMesh = bA.mesh;
        missionEntities.startBuildingOriginalMat = applyIsolatedHighlight(missionEntities.startBuildingMesh, 0x00ff88);

        missionEntities.targetBuildingMesh = bB.mesh;
        missionEntities.targetBuildingOriginalMat = applyIsolatedHighlight(missionEntities.targetBuildingMesh, 0xffaa00);

        missionEntities.startHelipad = createSuperVisibleHelipad(bA.center.x, bA.roofY, bA.center.z, 0x00ff88);
        missionEntities.targetHelipad = createSuperVisibleHelipad(bB.center.x, bB.roofY, bB.center.z, 0xffaa00);
        layerGroups.mission.add(missionEntities.startHelipad.mesh, missionEntities.targetHelipad.mesh);

        createMissionFloatingLabel(bA.center.x, bA.roofY, bA.center.z, 'START', bA.title, bA.roofY);
        createMissionFloatingLabel(bB.center.x, bB.roofY, bB.center.z, 'GOAL', bB.title, bB.roofY);

        const startInfoEl = document.getElementById('start-node-info');
        const targetInfoEl = document.getElementById('target-node-info');
        if (startInfoEl) startInfoEl.textContent = `${bA.title} (${Math.round(bA.roofY)}m)`;
        if (targetInfoEl) targetInfoEl.textContent = `${bB.title} (${Math.round(bB.roofY)}m)`;

        if (ns.FlightEngine && ns.FlightEngine.resetFlightState) {
            ns.FlightEngine.resetFlightState();
        }
    }

    function randomizeSeed() {
        const newSeed = Math.floor(Math.random() * 9000 + 1000);
        applyMissionSeed(newSeed);
    }

    ns.MissionManager = {
        applyIsolatedHighlight,
        restoreIsolatedHighlight,
        createSuperVisibleHelipad,
        applyMissionSeed,
        randomizeSeed
    };
})(window.ShilinDrone);

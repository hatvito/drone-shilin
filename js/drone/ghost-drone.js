// ============================================================================
// js/drone/ghost-drone.js: 3D 霓虹全息幽靈無人機、歷史最速軌跡重播與引導光帶
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { layerGroups, simSettings } = ns.State;

    let ghostDroneGroup = null;
    let ghostPropellers = [];
    let ghostTrailMesh = null;
    let ghostTagEl = null;

    let ghostData = null; // { holder, time, points: [[x,y,z], ...], dt }
    let ghostPointsVec3 = [];

    function initGhostDrone() {
        if (ghostDroneGroup) return;

        ghostDroneGroup = new THREE.Group();

        // 1. 全息半透明青藍色機身
        const bodyGeo = new THREE.BoxGeometry(0.65, 0.16, 0.65);
        const ghostMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x0088cc,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.65,
            roughness: 0.2,
            metalness: 0.8
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, ghostMat);
        ghostDroneGroup.add(bodyMesh);

        // 2. 機身外圈全息青色光環
        const haloGeo = new THREE.TorusGeometry(0.68, 0.025, 8, 24);
        const haloMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
            transparent: true,
            opacity: 0.85
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = Math.PI / 2;
        ghostDroneGroup.add(halo);

        // 3. 機頂幽靈發光晶核
        const beaconGeo = new THREE.OctahedronGeometry(0.24, 0);
        const beaconMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: false
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 0.22;
        ghostDroneGroup.add(beacon);
        ghostDroneGroup.beacon = beacon;

        // 4. 四軸全息旋翼
        const propGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.02, 8);
        const propMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.55
        });
        const arms = [[0.38, 0.38], [-0.38, 0.38], [0.38, -0.38], [-0.38, -0.38]];
        ghostPropellers = [];

        arms.forEach(([ax, az]) => {
            const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.52), ghostMat);
            armMesh.position.set(ax * 0.5, 0, az * 0.5);
            armMesh.rotation.y = Math.atan2(ax, az);
            ghostDroneGroup.add(armMesh);

            const prop = new THREE.Mesh(propGeo, propMat);
            prop.position.set(ax, 0.09, az);
            ghostDroneGroup.add(prop);
            ghostPropellers.push(prop);
        });

        // 加入場景
        ns.Scene.getScene().add(ghostDroneGroup);
        ghostDroneGroup.visible = false;

        // 建立 2D 懸浮標籤
        createGhostFloatingTag();

        // 預設啟用幽靈車
        simSettings.showGhost = true;
    }

    function createGhostFloatingTag() {
        const container = document.getElementById('labels-container');
        if (!container || ghostTagEl) return;

        ghostTagEl = document.createElement('div');
        ghostTagEl.className = 'absolute pointer-events-none transform -translate-x-1/2 -translate-y-full z-20 hidden transition-opacity duration-200';
        ghostTagEl.innerHTML = `
            <div class="px-2 py-0.5 rounded-lg bg-cyan-950/85 backdrop-blur-md border border-cyan-400 text-cyan-200 text-[10px] font-black shadow-[0_0_15px_rgba(6,182,212,0.6)] flex items-center gap-1">
                <span>👻 幽靈最速</span>
                <span id="ghost-tag-text" class="text-white font-bold">--</span>
            </div>
            <div class="w-1 h-3 bg-cyan-400 mx-auto shadow-[0_0_8px_rgba(6,182,212,0.9)]"></div>
        `;
        container.appendChild(ghostTagEl);
    }

    // 設定新的幽靈車數據
    function setGhostRun(data) {
        if (!ghostDroneGroup) initGhostDrone();

        ghostData = data;
        ghostPointsVec3 = [];

        if (ghostTrailMesh) {
            layerGroups.fx.remove(ghostTrailMesh);
            if (ghostTrailMesh.geometry) ghostTrailMesh.geometry.dispose();
            ghostTrailMesh = null;
        }

        if (!data || !data.points || data.points.length < 2) {
            ghostDroneGroup.visible = false;
            if (ghostTagEl) ghostTagEl.classList.add('hidden');
            return;
        }

        // 解析點位為 THREE.Vector3
        for (let i = 0; i < data.points.length; i++) {
            const p = data.points[i];
            ghostPointsVec3.push(new THREE.Vector3(p[0], p[1], p[2]));
        }

        // 繪製半透明青色發光全息航跡圓管
        try {
            const curve = new THREE.CatmullRomCurve3(ghostPointsVec3);
            const tubeGeo = new THREE.TubeGeometry(curve, Math.min(ghostPointsVec3.length * 3, 300), 0.22, 6, false);
            const tubeMat = new THREE.MeshBasicMaterial({
                color: 0x00e5ff,
                transparent: true,
                opacity: 0.38,
                wireframe: false,
                side: THREE.DoubleSide
            });
            ghostTrailMesh = new THREE.Mesh(tubeGeo, tubeMat);
            layerGroups.fx.add(ghostTrailMesh);
        } catch (e) {
            console.warn('[Ghost] 軌跡生成提示：', e);
        }

        // 更新標籤文字
        const tagText = document.getElementById('ghost-tag-text');
        if (tagText) {
            tagText.textContent = `${data.holder} (${parseFloat(data.time).toFixed(1)}s)`;
        }

        // 將幽靈車放置於起點
        resetGhostPosition();
    }

    function resetGhostPosition() {
        if (!ghostDroneGroup || ghostPointsVec3.length === 0) return;

        const startPt = ghostPointsVec3[0];
        ghostDroneGroup.position.copy(startPt);

        if (ghostPointsVec3.length > 1) {
            const nextPt = ghostPointsVec3[1];
            const yaw = Math.atan2(nextPt.x - startPt.x, nextPt.z - startPt.z);
            ghostDroneGroup.rotation.y = yaw;
        }

        const shouldShow = simSettings.showGhost && ghostData != null;
        ghostDroneGroup.visible = shouldShow;
        if (ghostTrailMesh) ghostTrailMesh.visible = shouldShow;
        if (ghostTagEl) {
            if (shouldShow) ghostTagEl.classList.remove('hidden');
            else ghostTagEl.classList.add('hidden');
        }
    }

    // 每一幀由主迴圈呼叫
    function updateGhostDrone(dt, simTime, isSimulating) {
        if (!ghostDroneGroup || !ghostData || ghostPointsVec3.length < 2) {
            if (ghostDroneGroup) ghostDroneGroup.visible = false;
            if (ghostTrailMesh) ghostTrailMesh.visible = false;
            if (ghostTagEl) ghostTagEl.classList.add('hidden');
            return;
        }

        const shouldShow = simSettings.showGhost;
        ghostDroneGroup.visible = shouldShow;
        if (ghostTrailMesh) ghostTrailMesh.visible = shouldShow;

        if (!shouldShow) {
            if (ghostTagEl) ghostTagEl.classList.add('hidden');
            return;
        }

        // 旋翼與發光晶核自旋
        const pSpeed = isSimulating ? 35 : 8;
        for (let i = 0; i < ghostPropellers.length; i++) {
            ghostPropellers[i].rotation.y += pSpeed * dt;
        }
        if (ghostDroneGroup.beacon) {
            ghostDroneGroup.beacon.rotation.y += dt * 2.0;
        }

        // 當正在試飛時，按學生計時器時間插值幽靈車位置
        if (isSimulating) {
            const ptCount = ghostPointsVec3.length;
            const stepDt = ghostData.dt || 0.2;
            const targetIdxFloat = simTime / stepDt;

            let currentPos = new THREE.Vector3();
            let currentYaw = 0;

            if (targetIdxFloat < ptCount - 1) {
                const idxA = Math.floor(targetIdxFloat);
                const idxB = idxA + 1;
                const alpha = targetIdxFloat - idxA;

                const pA = ghostPointsVec3[idxA];
                const pB = ghostPointsVec3[idxB];
                currentPos.lerpVectors(pA, pB, alpha);

                currentYaw = Math.atan2(pB.x - pA.x, pB.z - pA.z);
            } else {
                // 已抵達終點停機坪
                currentPos.copy(ghostPointsVec3[ptCount - 1]);
                if (ptCount >= 2) {
                    const pLastPrev = ghostPointsVec3[ptCount - 2];
                    const pLast = ghostPointsVec3[ptCount - 1];
                    currentYaw = Math.atan2(pLast.x - pLastPrev.x, pLast.z - pLastPrev.z);
                }
            }

            ghostDroneGroup.position.copy(currentPos);
            ghostDroneGroup.rotation.y = currentYaw;
        }

        // 更新 2D 幽靈標籤螢幕投影
        if (ghostTagEl && shouldShow) {
            const camera = ns.Scene.getCamera();
            if (camera) {
                const hw = window.innerWidth / 2;
                const hh = window.innerHeight / 2;
                const worldPos = ghostDroneGroup.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                const p = worldPos.project(camera);

                if (p.z > 1) {
                    ghostTagEl.classList.add('hidden');
                } else {
                    ghostTagEl.classList.remove('hidden');
                    ghostTagEl.style.left = `${(p.x * hw) + hw}px`;
                    ghostTagEl.style.top = `${-(p.y * hh) + hh}px`;
                }
            }
        }
    }

    function toggleGhost() {
        simSettings.showGhost = !simSettings.showGhost;

        const btn = document.getElementById('btn-toggle-ghost');
        if (btn) {
            btn.innerHTML = simSettings.showGhost ? '👻 幽靈車: 開' : '👻 幽靈車: 關';
            btn.className = simSettings.showGhost
                ? 'px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold hover:bg-cyan-500/30 transition text-[10px]'
                : 'px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 font-bold hover:bg-slate-700 transition text-[10px]';
        }

        if (ghostDroneGroup) ghostDroneGroup.visible = simSettings.showGhost && ghostData != null;
        if (ghostTrailMesh) ghostTrailMesh.visible = simSettings.showGhost && ghostData != null;
        if (ghostTagEl) {
            if (simSettings.showGhost && ghostData != null) ghostTagEl.classList.remove('hidden');
            else ghostTagEl.classList.add('hidden');
        }
    }

    ns.GhostDrone = {
        initGhostDrone,
        setGhostRun,
        resetGhostPosition,
        updateGhostDrone,
        toggleGhost,
        getGhostData: () => ghostData
    };

    window.toggleGhostDrone = toggleGhost;
})(window.ShilinDrone);

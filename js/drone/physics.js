// ============================================================================
// js/drone/physics.js: 物理包圍盒建置、CCD 連續碰撞檢測與 16 向虛擬光達
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { DRONE_RADIUS, MAX_ALTITUDE, MIN_ALTITUDE, MAP_HALF_W, MAP_HALF_D, LIDAR_BEAMS, LIDAR_MAX_DIST } = ns.Config;
    const { layerGroups, physicalObstacles } = ns.State;

    function buildPhysicsBoundingBoxes() {
        physicalObstacles.length = 0;

        // 收集所有建築主體包圍盒
        layerGroups.buildings.traverse((obj) => {
            if (obj.isMesh && obj.geometry) {
                obj.updateWorldMatrix(true, false);
                const b = new THREE.Box3().setFromObject(obj);
                physicalObstacles.push({ box: b, name: obj.userData.title || '都市建築主體' });
            }
        });

        // 收集頂樓鐵皮加蓋與水塔包圍盒
        layerGroups.rooftops.traverse((obj) => {
            if (obj.isMesh && obj.geometry) {
                obj.updateWorldMatrix(true, false);
                const b = new THREE.Box3().setFromObject(obj);
                physicalObstacles.push({ box: b, name: '頂樓鐵皮加蓋/水塔' });
            }
        });
    }

    const tempRay = new THREE.Ray();
    const tempVec = new THREE.Vector3();
    const tempOrigin = new THREE.Vector3();
    const tempDir = new THREE.Vector3();

    function raycastSafe(origin, direction, maxDistance = LIDAR_MAX_DIST) {
        if (Array.isArray(origin)) {
            tempOrigin.set(origin[0], origin[1], origin[2]);
        } else {
            tempOrigin.copy(origin);
        }

        if (Array.isArray(direction)) {
            tempDir.set(direction[0], direction[1], direction[2]);
        } else {
            tempDir.copy(direction);
        }

        if (tempDir.lengthSq() < 1e-8) return maxDistance;
        tempDir.normalize();

        tempRay.origin.copy(tempOrigin);
        tempRay.direction.copy(tempDir);

        let closest = maxDistance;

        // 地面射線碰撞檢測
        if (tempDir.y < -1e-4) {
            const dGround = -tempOrigin.y / tempDir.y;
            if (dGround > 0 && dGround < closest) closest = dGround;
        }

        // 所有實體建築物 AABB 碰撞檢測 (加入空間快速距離篩選，大幅提升千棟建築即時光達效能)
        for (let i = 0; i < physicalObstacles.length; i++) {
            const box = physicalObstacles[i].box;
            if (box.min.x - tempOrigin.x > closest || tempOrigin.x - box.max.x > closest) continue;
            if (box.min.z - tempOrigin.z > closest || tempOrigin.z - box.max.z > closest) continue;

            const hit = tempRay.intersectBox(box, tempVec);
            if (hit) {
                const d = tempOrigin.distanceTo(hit);
                if (d < closest) closest = d;
            }
        }
        return Math.max(0, closest - DRONE_RADIUS);
    }

    function query16DirectionLiDAR(pos) {
        const dists = [];
        let minD = 999;
        for (let i = 0; i < LIDAR_BEAMS; i++) {
            const angle = (i / LIDAR_BEAMS) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            const d = raycastSafe(pos, dir, LIDAR_MAX_DIST);
            dists.push(d);
            if (d < minD) minD = d;
        }

        // 警報等級更新
        const warnEl = document.getElementById('tele-lidar-warn');
        if (warnEl) {
            if (minD < 1.8) {
                warnEl.textContent = `緊急！${minD.toFixed(1)}m`;
                warnEl.className = 'text-xs font-black text-rose-500 code-font animate-pulse';
                if (ns.Audio && ns.Audio.playWarningBeep) ns.Audio.playWarningBeep();
            } else if (minD < 4.5) {
                warnEl.textContent = `近距 ${minD.toFixed(1)}m`;
                warnEl.className = 'text-xs font-black text-amber-400 code-font';
            } else {
                warnEl.textContent = '安全';
                warnEl.className = 'text-xs font-black text-cyan-400 code-font';
            }
        }

        return dists;
    }

    // CCD (Continuous Collision Detection) 連續碰撞細分檢測，防止高速穿牆
    function checkContinuousCollision(fromPos, toPos) {
        if (toPos.y < MIN_ALTITUDE || toPos.y > MAX_ALTITUDE) {
            return {
                hit: true,
                reason: toPos.y > MAX_ALTITUDE
                    ? '超出 25.0m 低空空域上限違規墜毀（挑戰賽嚴禁高空飛越！）'
                    : '觸地墜毀 (高度 Y <= 0)'
            };
        }
        if (Math.abs(toPos.x) > MAP_HALF_W || Math.abs(toPos.z) > MAP_HALF_D) {
            return { hit: true, reason: '觸碰台北士林空域邊界電子圍欄失事' };
        }

        const moveVec = new THREE.Vector3().subVectors(toPos, fromPos);
        const moveDist = moveVec.length();
        if (moveDist < 0.0001) return { hit: false };

        const steps = Math.ceil(moveDist / (DRONE_RADIUS * 0.5));
        const stepVec = moveVec.clone().divideScalar(steps);
        const curr = fromPos.clone();
        const sphere = new THREE.Sphere(curr, DRONE_RADIUS);

        for (let s = 1; s <= steps; s++) {
            curr.add(stepVec);
            sphere.center.copy(curr);
            for (let i = 0; i < physicalObstacles.length; i++) {
                const box = physicalObstacles[i].box;
                if (box.min.x - curr.x > DRONE_RADIUS || curr.x - box.max.x > DRONE_RADIUS) continue;
                if (box.min.z - curr.z > DRONE_RADIUS || curr.z - box.max.z > DRONE_RADIUS) continue;
                if (box.intersectsSphere(sphere)) {
                    return { hit: true, reason: `撞擊障礙物：${physicalObstacles[i].name}` };
                }
            }
        }
        return { hit: false };
    }

    ns.Physics = {
        buildPhysicsBoundingBoxes,
        raycastSafe,
        query16DirectionLiDAR,
        checkContinuousCollision
    };
})(window.ShilinDrone);

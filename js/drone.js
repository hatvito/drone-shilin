// ============================================================================
// drone.js: 無人機實體、動態航跡帶、16 向無形虛擬光達與 CCD 物理檢測
// ============================================================================
const DRONE_RADIUS = 0.25;
const MAX_ALTITUDE = 80.0;
const MIN_ALTITUDE = 0.0;
const LIDAR_BEAMS = 16;
const LIDAR_MAX_DIST = 45.0;

let drone = null;
const physicalObstacles = [];
let flightTrailLine = null;
const MAX_TRAIL_POINTS = 800;
const trailPoints = [];

function createDroneEntity() {
    drone = new THREE.Group();

    // 機身
    const bodyGeo = new THREE.BoxGeometry(0.36, 0.08, 0.36);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    drone.add(bodyMesh);

    // 螺旋槳
    const propGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.015, 8);
    const propMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.65 });
    const arms = [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]];
    drone.propellers = [];

    arms.forEach(([ax, az]) => {
        const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.32), bodyMat);
        armMesh.position.set(ax * 0.5, 0, az * 0.5);
        armMesh.rotation.y = Math.atan2(ax, az);
        drone.add(armMesh);

        const prop = new THREE.Mesh(propGeo, propMat);
        prop.position.set(ax, 0.05, az);
        drone.add(prop);
        drone.propellers.push(prop);
    });

    // 4. 動態飛行軌跡帶 (Trail)
    const trailGeo = new THREE.BufferGeometry();
    const posArr = new Float32Array(MAX_TRAIL_POINTS * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const trailMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        linewidth: 2,
        transparent: true,
        opacity: 0.85
    });
    flightTrailLine = new THREE.Line(trailGeo, trailMat);
    flightTrailLine.frustumCulled = false;
    layerGroups.fx.add(flightTrailLine);

    // 5. 注意：光達 16 向線條已被徹底隱形移除，只保留純數學校驗！
    scene.add(drone);
    drone.visible = false;
}

function updateDroneTrail(newPos) {
    trailPoints.push(newPos.clone());
    if (trailPoints.length > MAX_TRAIL_POINTS) trailPoints.shift();

    const positions = flightTrailLine.geometry.attributes.position.array;
    for (let i = 0; i < trailPoints.length; i++) {
        positions[i * 3] = trailPoints[i].x;
        positions[i * 3 + 1] = trailPoints[i].y;
        positions[i * 3 + 2] = trailPoints[i].z;
    }
    flightTrailLine.geometry.setDrawRange(0, trailPoints.length);
    flightTrailLine.geometry.attributes.position.needsUpdate = true;
}

function resetDroneTrail() {
    trailPoints.length = 0;
    if (flightTrailLine) flightTrailLine.geometry.setDrawRange(0, 0);
}

// 物理包圍盒登錄
function buildPhysicsBoundingBoxes() {
    physicalObstacles.length = 0;

    layerGroups.buildings.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
            obj.updateWorldMatrix(true, false);
            const b = new THREE.Box3().setFromObject(obj);
            physicalObstacles.push({ box: b, name: obj.userData.title || '建物本體' });
        }
    });

    layerGroups.rooftops.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
            obj.updateWorldMatrix(true, false);
            const b = new THREE.Box3().setFromObject(obj);
            physicalObstacles.push({ box: b, name: '頂樓加蓋/水塔' });
        }
    });
}

// 16 向無形光達探測與射線檢測
const tempRay = new THREE.Ray();
const tempVec = new THREE.Vector3();

function raycastSafe(origin, direction, maxDistance = LIDAR_MAX_DIST) {
    tempRay.origin.copy(origin);
    tempRay.direction.copy(direction).normalize();

    let closest = maxDistance;
    for (let i = 0; i < physicalObstacles.length; i++) {
        const box = physicalObstacles[i].box;
        const hit = tempRay.intersectBox(box, tempVec);
        if (hit) {
            const d = origin.distanceTo(hit);
            if (d < closest) closest = d;
        }
    }
    return closest;
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

    const warnEl = document.getElementById('tele-lidar-warn');
    if (minD < 1.5) {
        warnEl.textContent = `緊急！${minD.toFixed(1)}m`;
        warnEl.className = 'text-xs font-black text-rose-500 code-font animate-pulse';
    } else if (minD < 4.5) {
        warnEl.textContent = `近距 ${minD.toFixed(1)}m`;
        warnEl.className = 'text-xs font-black text-amber-400 code-font';
    } else {
        warnEl.textContent = '安全';
        warnEl.className = 'text-xs font-black text-cyan-400 code-font';
    }

    return dists;
}

// CCD 連續碰撞細分
function checkContinuousCollision(fromPos, toPos) {
    if (toPos.y < MIN_ALTITUDE || toPos.y > MAX_ALTITUDE) {
        return { hit: true, reason: toPos.y > MAX_ALTITUDE ? '超出 80m 垂直上限' : '觸地墜毀' };
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
            if (physicalObstacles[i].box.intersectsSphere(sphere)) {
                return { hit: true, reason: `碰撞：${physicalObstacles[i].name}` };
            }
        }
    }
    return { hit: false };
}

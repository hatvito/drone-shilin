// ============================================================================
// js/drone.js: 無人機實體、3D 實體粗光管航跡 (解決 1px 看不見問題)、無形光達與 CCD
// ============================================================================
const DRONE_RADIUS = 0.25;
const MAX_ALTITUDE = 80.0;
const MIN_ALTITUDE = 0.0;
const MAP_HALF_W = 512.0;
const MAP_HALF_D = 267.0;
const LIDAR_BEAMS = 16;
const LIDAR_MAX_DIST = 45.0;

let drone = null;
const physicalObstacles = [];

// 3D 立體粗軌跡管與節點群組
let flightTrailMesh = null;
let trailBeaconGroup = null;
const trailPoints = [];
const MAX_TRAIL_POINTS = 600;

function createDroneEntity() {
    drone = new THREE.Group();

    // 機身放大少許並加上高對比螢光護圈，鳥瞰更明顯
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.14, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.2 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    drone.add(bodyMesh);

    // 機頂高可視度發光球標記
    const topBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff007f })
    );
    topBeacon.position.y = 0.2;
    drone.add(topBeacon);

    // 四軸螺旋槳
    const propGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 8);
    const propMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.75 });
    const arms = [[0.38, 0.38], [-0.38, 0.38], [0.38, -0.38], [-0.38, -0.38]];
    drone.propellers = [];

    arms.forEach(([ax, az]) => {
        const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.52), bodyMat);
        armMesh.position.set(ax * 0.5, 0, az * 0.5);
        armMesh.rotation.y = Math.atan2(ax, az);
        drone.add(armMesh);

        const prop = new THREE.Mesh(propGeo, propMat);
        prop.position.set(ax, 0.08, az);
        drone.add(prop);
        drone.propellers.push(prop);
    });

    // 建立 3D 實體粗圓管軌跡 (直徑約 0.9m，高對比螢光洋紅色)
    const emptyGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.MeshBasicMaterial({
        color: 0xff0066,
        side: THREE.DoubleSide
    });
    flightTrailMesh = new THREE.Mesh(emptyGeo, trailMat);
    flightTrailMesh.frustumCulled = false;
    layerGroups.fx.add(flightTrailMesh);

    // 軌跡定位光點群組 (每隔一段距離放一顆發光球，強化立體高度感)
    trailBeaconGroup = new THREE.Group();
    layerGroups.fx.add(trailBeaconGroup);

    scene.add(drone);
    drone.visible = false;
}

// 動態更新 3D 實體粗軌跡管
function updateDroneTrail(newPos) {
    // 距離上一個記錄點超過 1.2m 才新增，避免點位過密影響效能
    if (trailPoints.length > 0) {
        const lastPt = trailPoints[trailPoints.length - 1];
        if (lastPt.distanceTo(newPos) < 1.2) return;
    }

    trailPoints.push(newPos.clone());
    if (trailPoints.length > MAX_TRAIL_POINTS) {
        trailPoints.shift();
    }

    // 至少要有 2 個點才能生成 3D 圓管
    if (trailPoints.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(trailPoints);
        const segments = Math.min(trailPoints.length * 2, 400);
        // 半徑 0.45m (直徑 0.9m) 的實體粗管，任何視角與瀏覽器都清晰可見
        const newTubeGeo = new THREE.TubeGeometry(curve, segments, 0.45, 6, false);
        flightTrailMesh.geometry.dispose();
        flightTrailMesh.geometry = newTubeGeo;
    }

    // 每隔 5 個點放置一顆亮黃色航跡光球，呈現飛行節奏
    if (trailPoints.length % 5 === 0) {
        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.65, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        dot.position.copy(newPos);
        trailBeaconGroup.add(dot);
    }
}

function resetDroneTrail() {
    trailPoints.length = 0;
    if (flightTrailMesh && flightTrailMesh.geometry) {
        flightTrailMesh.geometry.dispose();
        flightTrailMesh.geometry = new THREE.BufferGeometry();
    }
    if (trailBeaconGroup) {
        trailBeaconGroup.clear();
    }
}

function buildPhysicsBoundingBoxes() {
    physicalObstacles.length = 0;

    layerGroups.buildings.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
            obj.updateWorldMatrix(true, false);
            const b = new THREE.Box3().setFromObject(obj);
            physicalObstacles.push({ box: b, name: obj.userData.title || '都市建築主體' });
        }
    });

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

    if (tempDir.y < -1e-4) {
        const dGround = -tempOrigin.y / tempDir.y;
        if (dGround > 0 && dGround < closest) closest = dGround;
    }

    for (let i = 0; i < physicalObstacles.length; i++) {
        const box = physicalObstacles[i].box;
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

    const warnEl = document.getElementById('tele-lidar-warn');
    if (warnEl) {
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
    }

    return dists;
}

function checkContinuousCollision(fromPos, toPos) {
    if (toPos.y < MIN_ALTITUDE || toPos.y > MAX_ALTITUDE) {
        return { hit: true, reason: toPos.y > MAX_ALTITUDE ? '超出 80m 垂直空域上限違規墜毀' : '觸地墜毀 (Y <= 0)' };
    }
    if (Math.abs(toPos.x) > MAP_HALF_W || Math.abs(toPos.z) > MAP_HALF_D) {
        return { hit: true, reason: '觸碰地圖邊界電子圍欄墜毀' };
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
                return { hit: true, reason: `撞擊障礙物：${physicalObstacles[i].name}` };
            }
        }
    }
    return { hit: false };
}

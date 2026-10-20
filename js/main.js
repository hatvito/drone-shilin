// ============================================================================
// js/main.js: 完整呼叫 3d.html 所有圖層建構函式 + 無人機避障挑戰系統
// ============================================================================
let scene, camera, renderer, controls, raycaster, mouse;
let dirLight, ambientLight, hemiLight;
let hoveredMesh = null, selectedMesh = null;
let selectedMeshOriginalMaterials = null;

let isSimulating = false;
let cameraViewMode = 'orbit';
const blackboxLogs = [];

const flightState = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    status: 'IDLE',
    initialDistance: 1,
    remainingDistance: 1,
    progress: 0,
    flightTime: 0
};

let startHelipad = null;
let targetHelipad = null;
let startBuildingMesh = null;
let startBuildingOriginalMat = null;
let targetBuildingMesh = null;
let targetBuildingOriginalMat = null;
let studentUpdateFunc = null;

const htmlLabels = [];
let labelsVisible = true;

const DEFAULT_CODE = `function update(droneState, target, raycastSafe, lidarData, dt) {
    const p = droneState.pos;
    const v = droneState.vel;

    // 1. 目標引力向量
    const toTarget = new THREE.Vector3().subVectors(target.pos, p);
    const dist = toTarget.length();
    let desiredVel = toTarget.clone().normalize().multiplyScalar(Math.min(10.0, dist * 0.8));

    // 2. 16 向虛擬光達斥力場
    const repulsion = new THREE.Vector3(0, 0, 0);
    const SAFE_DIST = 9.0;
    for (let i = 0; i < 16; i++) {
        const d = lidarData[i];
        if (d < SAFE_DIST) {
            const angle = (i / 16) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            repulsion.add(dir.multiplyScalar(-((SAFE_DIST - d) / SAFE_DIST) * 14.0));
        }
    }

    // 3. 空域限高防護 (維持在 8m ~ 72m 安全層)
    let altCorrection = 0;
    if (p.y < 8.0) altCorrection = 7.0;
    if (p.y > 72.0) altCorrection = -7.0;

    let ax = (desiredVel.x + repulsion.x - v.x) * 2.5;
    let ay = (desiredVel.y + altCorrection - v.y) * 2.5;
    let az = (desiredVel.z + repulsion.z - v.z) * 2.5;

    const maxA = 15.0;
    const totalA = Math.hypot(ax, ay, az);
    if (totalA > maxA) {
        const s = maxA / totalA;
        ax *= s; ay *= s; az *= s;
    }
    return { ax, ay, az };
}`;

window.addEventListener('load', () => {
    // 嚴格鎖定地圖 PRNG 種子為 1337，確保每次產生的 1,200+ 棟建築與 3d.html 100% 一致
    mapRngSeed = 1337;

    initRichFacadeAndRoofMaterials();
    initThreeScene();

    // 依序執行原本 3d.html 的 6 大場景建置函數
    buildCurvedGroundCanvasMap();
    buildOrganicRiversAndLevees();
    buildParksWetlandsAndCurvedPaths();
    buildRealisticCurvedRoadNetwork();
    buildLandmarksAnd1200DiverseBuildings();
    buildRichTreesAndSplineTraffic();

    createDroneEntity();
    buildPhysicsBoundingBoxes();
    applyMissionSeed();

    setupInteraction();
    document.getElementById('code-editor').value = DEFAULT_CODE;
    document.getElementById('stats-badge').textContent = `${totalBuildingCount.toLocaleString()} 棟多樣化建築 · ${totalRoadSegments} 條彎曲道路/水岸`;

    animate();
});

function initThreeScene() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbeafe);
    scene.fog = new THREE.FogExp2(0xdbeafe, 0.00042);

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 2, 3400);
    camera.position.set(0, 470, 385);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 10);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 18;
    controls.maxDistance = 1250;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };

    ambientLight = new THREE.AmbientLight(0xffffff, 0.58);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xd6d3d1, 0.45);
    hemiLight.position.set(0, 360, 0);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xfffbeb, 0.98);
    dirLight.position.set(240, 430, 250);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 40;
    dirLight.shadow.camera.far = 1350;
    const d = 560;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.00035;
    scene.add(dirLight);

    Object.values(layerGroups).forEach(g => scene.add(g));

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// 獨立克隆材質並上色（絕不連帶影響其他共用材質的大樓）
function applyIsolatedHighlight(mesh, emissiveHex) {
    if (!mesh || !mesh.material) return null;
    const orig = mesh.material;
    if (Array.isArray(orig)) {
        mesh.material = orig.map(m => {
            const c = m.clone();
            if (c.emissive) {
                c.emissive.setHex(emissiveHex);
                c.emissiveIntensity = 0.55;
            }
            return c;
        });
    } else {
        const c = orig.clone();
        if (c.emissive) {
            c.emissive.setHex(emissiveHex);
            c.emissiveIntensity = 0.55;
        }
        mesh.material = c;
    }
    return orig;
}

function createSuperVisibleHelipad(x, y, z, colorHex) {
    const padGroup = new THREE.Group();
    padGroup.position.set(x, y + 0.08, z);

    // 直徑 1.5m (半徑 0.75m) 停機坪圓盤
    const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.75, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
    );
    padGroup.add(pad);

    // 發光外環
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.62, 0.75, 24),
        new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    padGroup.add(ring);

    // 沖天光柱
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 1.1, 55, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
    );
    beam.position.y = 27.5;
    padGroup.add(beam);

    // 頂空漂浮八面體標記
    const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.5, 0),
        new THREE.MeshBasicMaterial({ color: colorHex })
    );
    marker.position.y = 14;
    padGroup.add(marker);
    padGroup.marker = marker;

    return { mesh: padGroup, pos: new THREE.Vector3(x, y + 0.5, z) };
}

function applyMissionSeed() {
    const seedVal = parseInt(document.getElementById('mission-seed-input').value) || 1337;
    missionSeed = seedVal;
    if (candidateBuildings.length < 2) return;

    // 復原舊起訖點大樓的原始材質
    if (startBuildingMesh && startBuildingOriginalMat) startBuildingMesh.material = startBuildingOriginalMat;
    if (targetBuildingMesh && targetBuildingOriginalMat) targetBuildingMesh.material = targetBuildingOriginalMat;

    let idxA = 0, idxB = 1;
    let attempts = 0;
    while (attempts < 200) {
        idxA = Math.floor(missionRandom() * candidateBuildings.length);
        idxB = Math.floor(missionRandom() * candidateBuildings.length);
        if (idxA !== idxB && candidateBuildings[idxA].center.distanceTo(candidateBuildings[idxB].center) > 220) break;
        attempts++;
    }

    layerGroups.mission.clear();
    const bA = candidateBuildings[idxA];
    const bB = candidateBuildings[idxB];

    // 單獨將起點大樓染為翡翠綠、終點大樓染為流金黃
    startBuildingMesh = bA.mesh;
    startBuildingOriginalMat = applyIsolatedHighlight(startBuildingMesh, 0x10b981);

    targetBuildingMesh = bB.mesh;
    targetBuildingOriginalMat = applyIsolatedHighlight(targetBuildingMesh, 0xf59e0b);

    startHelipad = createSuperVisibleHelipad(bA.center.x, bA.roofY, bA.center.z, 0x10b981);
    targetHelipad = createSuperVisibleHelipad(bB.center.x, bB.roofY, bB.center.z, 0xf59e0b);
    layerGroups.mission.add(startHelipad.mesh, targetHelipad.mesh);

    document.getElementById('start-node-info').textContent = `${bA.title} (${Math.round(bA.roofY)}m)`;
    document.getElementById('target-node-info').textContent = `${bB.title} (${Math.round(bB.roofY)}m)`;

    resetFlightState();
}

function randomizeSeed() {
    document.getElementById('mission-seed-input').value = Math.floor(Math.random() * 9000 + 1000);
    applyMissionSeed();
}

function setupInteraction() {
    const dom = renderer.domElement;
    let downPos = { x: 0, y: 0 };

    dom.addEventListener('pointerdown', (e) => {
        downPos.x = e.clientX;
        downPos.y = e.clientY;
    });

    dom.addEventListener('pointerup', (e) => {
        if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(interactiveMeshes, false);

        if (hits.length > 0) {
            const hitMesh = hits[0].object;

            // 恢復上一棟選取大樓的原始材質
            if (selectedMesh && selectedMeshOriginalMaterials && selectedMesh !== startBuildingMesh && selectedMesh !== targetBuildingMesh) {
                selectedMesh.material = selectedMeshOriginalMaterials;
            }

            if (hitMesh !== startBuildingMesh && hitMesh !== targetBuildingMesh) {
                selectedMesh = hitMesh;
                selectedMeshOriginalMaterials = applyIsolatedHighlight(hitMesh, 0x0ea5e9);
            }

            document.getElementById('info-title').textContent = hitMesh.userData.title;
            document.getElementById('info-category').textContent = hitMesh.userData.category;
            document.getElementById('info-desc').textContent = hitMesh.userData.desc;
            document.getElementById('info-coords').textContent = `坐標：(${toU(hits[0].point.x)}, ${toV(hits[0].point.z)})`;
        }
    });
}

function toggleFlightSimulation() {
    if (isSimulating) {
        pauseFlightSimulation();
    } else {
        startFlightSimulation();
    }
}

function startFlightSimulation() {
    try {
        const rawCode = document.getElementById('code-editor').value;
        const wrapper = new Function(`${rawCode}; return update;`);
        studentUpdateFunc = wrapper();
    } catch (e) {
        alert('避障代碼編譯失敗：' + e.message);
        return;
    }

    isSimulating = true;
    drone.visible = true;
    document.getElementById('flight-toggle-btn').innerHTML = '<span>暫停試飛</span>';
    document.getElementById('flight-status-badge').textContent = '飛行中';
    document.getElementById('flight-status-badge').className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-cyan-500/20 text-cyan-300';
}

function pauseFlightSimulation() {
    isSimulating = false;
    document.getElementById('flight-toggle-btn').innerHTML = '<span>啟動自主避障試飛</span>';
    document.getElementById('flight-status-badge').textContent = '已暫停';
    document.getElementById('flight-status-badge').className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-800 text-slate-300';
}

function resetFlightState() {
    isSimulating = false;
    resetDroneTrail();
    if (startHelipad && targetHelipad) {
        flightState.pos.copy(startHelipad.pos);
        flightState.vel.set(0, 0, 0);
        flightState.flightTime = 0;
        flightState.initialDistance = Math.max(1, flightState.pos.distanceTo(targetHelipad.pos));
        flightState.remainingDistance = flightState.initialDistance;
        flightState.progress = 0;
        flightState.status = 'IDLE';

        drone.position.copy(flightState.pos);
        drone.visible = true;
    }
    pauseFlightSimulation();
    updateTelemetry();
}

function stepFlight(dt) {
    if (!isSimulating || !studentUpdateFunc) return;

    flightState.flightTime += dt;
    const lidarData = query16DirectionLiDAR(flightState.pos);

    let accel = { ax: 0, ay: 0, az: 0 };
    try {
        accel = studentUpdateFunc(
            { pos: flightState.pos.clone(), vel: flightState.vel.clone() },
            { pos: targetHelipad.pos.clone() },
            raycastSafe,
            lidarData,
            dt
        );
    } catch (e) {
        isSimulating = false;
        alert('演算法運行異常：' + e.message);
        return;
    }

    const aVec = new THREE.Vector3(accel.ax || 0, accel.ay || 0, accel.az || 0);
    if (aVec.length() > 15.0) aVec.normalize().multiplyScalar(15.0);

    flightState.vel.addScaledVector(aVec, dt);
    if (flightState.vel.length() > 18.0) flightState.vel.normalize().multiplyScalar(18.0);

    const nextPos = flightState.pos.clone().addScaledVector(flightState.vel, dt);

    const ccd = checkContinuousCollision(flightState.pos, nextPos);
    if (ccd.hit) {
        isSimulating = false;
        alert('⚠️ 無人機任務失敗！' + ccd.reason);
        return;
    }

    flightState.pos.copy(nextPos);
    drone.position.copy(flightState.pos);

    if (flightState.vel.length() > 0.2) {
        const targetYaw = Math.atan2(flightState.vel.x, flightState.vel.z);
        flightState.yaw += (targetYaw - flightState.yaw) * 0.15;
        drone.rotation.y = flightState.yaw;
    }

    updateDroneTrail(flightState.pos);

    const dist = flightState.pos.distanceTo(targetHelipad.pos);
    flightState.remainingDistance = dist;
    flightState.progress = Math.max(0, Math.min(100, (1 - dist / flightState.initialDistance) * 100));

    if (dist < 1.4 && flightState.vel.length() < 3.5) {
        isSimulating = false;
        flightState.progress = 100;
        alert('🏆 恭喜！成功抵達終點停機坪！耗時：' + flightState.flightTime.toFixed(1) + 's');
    }

    updateTelemetry();
}

function updateTelemetry() {
    document.getElementById('tele-dist').textContent = `${flightState.remainingDistance.toFixed(1)} m`;
    document.getElementById('tele-progress').textContent = `${flightState.progress.toFixed(1)}%`;
    document.getElementById('tele-alt').textContent = `${flightState.pos.y.toFixed(1)} m`;
    document.getElementById('progress-bar-inner').style.width = `${flightState.progress}%`;
}

function setCameraViewMode(mode) {
    cameraViewMode = mode;
    document.getElementById('view-orbit-btn').className = mode === 'orbit' ? 'px-2.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 transition' : 'px-2.5 py-1.5 rounded-lg text-slate-300';
    document.getElementById('view-drone-btn').className = mode === 'follow' ? 'px-2.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 transition' : 'px-2.5 py-1.5 rounded-lg text-slate-300';
    controls.enabled = (mode === 'orbit');
}

function addUVLabel(u, v, y, text, styleClass) {
    const container = document.getElementById('labels-container');
    const el = document.createElement('div');
    el.className = `map-label ${styleClass}`;
    el.innerHTML = `<div class="px-2 py-0.5 rounded-md shadow-md border text-[10px] font-bold">${text}</div><div class="pin-stem"></div>`;
    container.appendChild(el);
    htmlLabels.push({ el, pos: new THREE.Vector3(toX(u), y, toZ(v)) });
}

function openAiPromptModal() {
    document.getElementById('ai-modal').classList.remove('hidden');
}
function closeAiPromptModal() {
    document.getElementById('ai-modal').classList.add('hidden');
}
function copyAiPrompt() {
    const ta = document.getElementById('ai-prompt-text');
    ta.select();
    navigator.clipboard.writeText(ta.value).then(() => {
        const btn = document.getElementById('copy-prompt-btn');
        btn.textContent = '✅ 已複製！';
        setTimeout(() => { btn.textContent = '📋 一鍵複製提示詞'; }, 2000);
    });
}
function resetDefaultCode() {
    if (confirm('確定要還原為預設代碼嗎？')) {
        document.getElementById('code-editor').value = DEFAULT_CODE;
    }
}

function setLightingMode(mode) {
    ['day', 'sunset', 'night'].forEach(m => {
        const btn = document.getElementById('btn-' + m);
        btn.className = m === mode
            ? 'px-2 py-1.5 rounded-lg bg-cyan-500 text-slate-950 transition font-bold'
            : 'px-2 py-1.5 rounded-lg hover:bg-slate-700/60 text-slate-300 transition';
    });

    if (mode === 'day') {
        scene.background.setHex(0xdbeafe);
        scene.fog.color.setHex(0xdbeafe);
        ambientLight.intensity = 0.58;
        hemiLight.intensity = 0.45;
        dirLight.color.setHex(0xfffbeb);
        dirLight.intensity = 0.98;
        dirLight.position.set(240, 430, 250);
    } else if (mode === 'sunset') {
        scene.background.setHex(0xfdba74);
        scene.fog.color.setHex(0xfdba74);
        ambientLight.intensity = 0.45;
        hemiLight.intensity = 0.35;
        dirLight.color.setHex(0xf97316);
        dirLight.intensity = 1.12;
        dirLight.position.set(-420, 195, 140);
    } else if (mode === 'night') {
        scene.background.setHex(0x090d16);
        scene.fog.color.setHex(0x090d16);
        ambientLight.intensity = 0.3;
        hemiLight.intensity = 0.24;
        dirLight.color.setHex(0x60a5fa);
        dirLight.intensity = 0.45;
        dirLight.position.set(140, 380, -200);
    }
}

function exportBlackboxJSON() {
    if (blackboxLogs.length === 0) {
        alert('目前尚無黑盒子飛行軌跡資料，請先啟動試飛！');
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        missionSeed: document.getElementById('mission-seed-input').value,
        flightTime: flightState.flightTime,
        progress: flightState.progress,
        status: flightState.status,
        logs: blackboxLogs
    }, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `drone_blackbox_seed_${document.getElementById('mission-seed-input').value}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    stepFlight(dt);

    if (ferrisWheelGroup) ferrisWheelGroup.rotation.z = elapsed * 0.35;
    if (carouselGroup) carouselGroup.rotation.y = elapsed * 0.5;

    if (mrtCurve && mrtTrainGroup) {
        const t = (elapsed * 0.045) % 1;
        const pt = mrtCurve.getPoint(t);
        const tan = mrtCurve.getTangent(t);
        mrtTrainGroup.position.set(pt.x, 16.8, pt.z);
        mrtTrainGroup.lookAt(pt.x + tan.x, 16.8, pt.z + tan.z);
    }

    trafficCars.forEach(c => {
        c.t = (c.t + c.speed + 1) % 1;
        const pt = c.curve.getPoint(c.t);
        const tan = c.curve.getTangent(c.t);
        const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        c.mesh.position.set(pt.x + norm.x * c.laneOffset, 1.8, pt.z + norm.z * c.laneOffset);
        const dir = c.speed > 0 ? 1 : -1;
        c.mesh.lookAt(c.mesh.position.x + tan.x * dir, 1.8, c.mesh.position.z + tan.z * dir);
    });

    layerGroups.mission.children.forEach(pad => {
        if (pad.marker) pad.marker.rotation.y += 0.03;
    });

    if (cameraViewMode === 'follow' && drone && drone.visible) {
        const offset = new THREE.Vector3(
            -Math.sin(flightState.yaw) * 4.5,
            2.2,
            -Math.cos(flightState.yaw) * 4.5
        );
        camera.position.lerp(flightState.pos.clone().add(offset), 0.15);
        camera.lookAt(flightState.pos.x, flightState.pos.y + 0.5, flightState.pos.z);
    } else {
        controls.update();
    }

    if (labelsVisible && cameraViewMode === 'orbit') {
        const hw = window.innerWidth / 2;
        const hh = window.innerHeight / 2;
        htmlLabels.forEach(item => {
            const p = item.pos.clone().project(camera);
            if (p.z > 1) {
                item.el.style.display = 'none';
            } else {
                item.el.style.display = 'block';
                item.el.style.left = `${(p.x * hw) + hw}px`;
                item.el.style.top = `${-(p.y * hh) + hh}px`;
            }
        });
    } else {
        htmlLabels.forEach(item => item.el.style.display = 'none');
    }

    renderer.render(scene, camera);
}

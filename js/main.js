// ============================================================================
// main.js: 主入口、相機、單選大樓隔離機制、起訖點發光地標與動畫迴圈
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
let studentUpdateFunc = null;

const DEFAULT_CODE = `function update(droneState, target, raycastSafe, lidarData, dt) {
    const p = droneState.pos;
    const v = droneState.vel;

    // 1. 目標引力
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

    // 3. 空域高度保護
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
    initRichFacadeAndRoofMaterials();
    initThreeScene();
    buildShilinMapEnvironment();
    createDroneEntity();
    buildPhysicsBoundingBoxes();
    applyMissionSeed();

    setupInteraction();
    document.getElementById('code-editor').value = DEFAULT_CODE;
    document.getElementById('stats-badge').textContent = `${totalBuildingCount.toLocaleString()} 棟台北士林真實街廓載入完成`;

    animate();
});

function initThreeScene() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbeafe);
    scene.fog = new THREE.FogExp2(0xdbeafe, 0.0004);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 3600);
    camera.position.set(0, 480, 400);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 10);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 1400;

    ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xd6d3d1, 0.45);
    hemiLight.position.set(0, 360, 0);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xfffbeb, 0.98);
    dirLight.position.set(240, 430, 250);
    dirLight.castShadow = true;
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

function buildShilinMapEnvironment() {
    // 地板
    const groundGeo = new THREE.BoxGeometry(IMG_W, 8, IMG_H);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xdfd8ce, roughness: 0.9 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -4;
    scene.add(groundMesh);

    // 外雙溪主河道
    const waiShuangUV = [
        [1024, 154], [942, 178], [845, 196], [750, 165], [648, 134],
        [530, 145], [415, 168], [295, 204], [175, 250], [115, 282]
    ];
    const river = createUVSplineRibbon(waiShuangUV, 42, 0.9, 0.15, 0x67abc7);
    layerGroups.rivers.add(river.mesh);

    // 承德路與文昌路幹道
    const chengdeUV = [[290, 0], [308, 98], [335, 196], [376, 330], [422, 458], [452, 534]];
    layerGroups.roads.add(createUVSplineRibbon(chengdeUV, 21.5, 1.15, 0.1, 0xfbbf24).mesh);

    const wenchangUV = [[816, 0], [765, 76], [742, 152], [768, 272], [816, 435]];
    layerGroups.roads.add(createUVSplineRibbon(wenchangUV, 13.5, 1.12, 0.1, 0xfde047).mesh);

    // 核心機構與學校
    buildShilinHighSchoolOfCommerce();
    buildAmusementParkRichAttractions();

    // 新光醫院主醫療大樓
    const skMainUV = [[702, 365], [772, 358], [778, 405], [708, 412]];
    layerGroups.buildings.add(createUVPolygonMesh(skMainUV, 44, facadeMaterials.hospital, 0, {
        title: '新光吳火獅紀念醫院 (主醫療大樓)'
    }));
    addUVLabel(740, 385, 52, '🏥 新光醫院', 'text-rose-200 bg-slate-900/90 border-rose-400/60');

    // 金仁寶雙塔
    createDiverseTaiwanBuilding(374, 76, 34, 30, 72, 0.08, { shapeType: 'chamfer', matKey: 'glassTower', title: '金仁寶總部 (主塔樓 72m)' });
    addUVLabel(376, 80, 78, '🏗️ 金仁寶營運總部', 'text-cyan-100 bg-slate-900/90 border-cyan-400/60');

    // 密集街廓自動鋪設
    populateCurvedStreetBlock([[775, 8], [888, 18]], [[762, 42], [884, 34]], { cols: 14, streetName: '文林路681巷' });
    populateCurvedStreetBlock([[760, 196], [945, 196]], [[762, 216], [952, 226]], { cols: 18, streetName: '文林路587巷' });
    populateCurvedStreetBlock([[784, 302], [972, 275]], [[788, 328], [976, 296]], { cols: 19, streetName: '美崙街密集街廓' });
    populateCurvedStreetBlock([[548, 402], [618, 396]], [[558, 434], [630, 390]], { cols: 9, streetName: '基河路豪宅群' });

    buildSafeTreesExcludingWater();
}

// 3. 超明顯起訖點停機坪與垂直發光引導光柱
function createSuperVisibleHelipad(x, y, z, colorHex, labelText) {
    const padGroup = new THREE.Group();
    padGroup.position.set(x, y + 0.05, z);

    // 停機坪本體
    const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.1, 24),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 })
    );
    padGroup.add(pad);

    // 發光外圈
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.8, 24),
        new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    padGroup.add(ring);

    // 沖天光柱 (垂直通天，保證一眼辨識)
    const beamGeo = new THREE.CylinderGeometry(0.35, 1.0, 50, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 25;
    padGroup.add(beam);

    // 頂空懸浮標記
    const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.2, 0),
        new THREE.MeshBasicMaterial({ color: colorHex })
    );
    marker.position.y = 12;
    padGroup.add(marker);
    padGroup.marker = marker;

    return { mesh: padGroup, pos: new THREE.Vector3(x, y + 0.5, z) };
}

function applyMissionSeed() {
    const seedVal = parseInt(document.getElementById('mission-seed-input').value) || 1337;
    missionSeed = seedVal;
    if (candidateBuildings.length < 2) return;

    let idxA = 0, idxB = 1;
    let attempts = 0;
    while (attempts < 200) {
        idxA = Math.floor(missionRandom() * candidateBuildings.length);
        idxB = Math.floor(missionRandom() * candidateBuildings.length);
        if (idxA !== idxB && candidateBuildings[idxA].center.distanceTo(candidateBuildings[idxB].center) > 200) break;
        attempts++;
    }

    layerGroups.mission.clear();
    const bA = candidateBuildings[idxA];
    const bB = candidateBuildings[idxB];

    startHelipad = createSuperVisibleHelipad(bA.center.x, bA.roofY, bA.center.z, 0x10b981, '起點');
    targetHelipad = createSuperVisibleHelipad(bB.center.x, bB.roofY, bB.center.z, 0xf59e0b, '終點');
    layerGroups.mission.add(startHelipad.mesh, targetHelipad.mesh);

    document.getElementById('start-node-info').textContent = `${bA.title} (${Math.round(bA.roofY)}m)`;
    document.getElementById('target-node-info').textContent = `${bB.title} (${Math.round(bB.roofY)}m)`;

    resetFlightState();
}

function randomizeSeed() {
    document.getElementById('mission-seed-input').value = Math.floor(Math.random() * 9000 + 1000);
    applyMissionSeed();
}

// 2. 徹底解決「點選一棟連帶選取多棟」的獨立材質克隆機制
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

            // 復原上一棟選取大樓的獨立材質
            if (selectedMesh && selectedMeshOriginalMaterials) {
                selectedMesh.material = selectedMeshOriginalMaterials;
            }

            selectedMesh = hitMesh;

            // 克隆專屬材質實例，徹底避免與其他大樓共用造成全部一起發光
            selectedMeshOriginalMaterials = hitMesh.material;
            if (Array.isArray(hitMesh.material)) {
                hitMesh.material = hitMesh.material.map(m => {
                    const cloned = m.clone();
                    cloned.emissive.setHex(0xf59e0b);
                    return cloned;
                });
            } else {
                hitMesh.material = hitMesh.material.clone();
                hitMesh.material.emissive.setHex(0xf59e0b);
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
    document.getElementById('flight-toggle-btn').innerHTML = '<span>繼續試飛</span>';
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
        alert('演算法中斷：' + e.message);
        return;
    }

    const aVec = new THREE.Vector3(accel.ax || 0, accel.ay || 0, accel.az || 0);
    if (aVec.length() > 15.0) aVec.normalize().multiplyScalar(15.0);

    flightState.vel.addScaledVector(aVec, dt);
    const nextPos = flightState.pos.clone().addScaledVector(flightState.vel, dt);

    const ccd = checkContinuousCollision(flightState.pos, nextPos);
    if (ccd.hit) {
        isSimulating = false;
        alert('⚠️ 無人機任務失敗！' + ccd.reason);
        return;
    }

    flightState.pos.copy(nextPos);
    drone.position.copy(flightState.pos);

    // 更新飛行航跡帶
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
const htmlLabels = [];

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    stepFlight(dt);

    if (ferrisWheelGroup) ferrisWheelGroup.rotation.z = elapsed * 0.35;
    if (carouselGroup) carouselGroup.rotation.y = elapsed * 0.5;

    // 起訖點懸浮標記上下漂浮
    layerGroups.mission.children.forEach(pad => {
        if (pad.marker) pad.marker.rotation.y += 0.03;
    });

    if (cameraViewMode === 'follow' && drone && drone.visible) {
        const offset = new THREE.Vector3(0, 2.8, -5.5);
        camera.position.copy(flightState.pos).add(offset);
        camera.lookAt(flightState.pos.x, flightState.pos.y + 0.5, flightState.pos.z);
    } else {
        controls.update();
    }

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

    renderer.render(scene, camera);
}

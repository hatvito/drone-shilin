// ============================================================================
// js/main.js: 主入口、場景構建、單棟選取隔離、沖天停機坪與飛行迴圈
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

const htmlLabels = [];
let labelsVisible = true;

const DEFAULT_CODE = `function update(droneState, target, raycastSafe, lidarData, dt) {
    const p = droneState.pos;
    const v = droneState.vel;

    // 1. 目標引力向量
    const toTarget = new THREE.Vector3().subVectors(target.pos, p);
    const dist = toTarget.length();
    let desiredVel = toTarget.clone().normalize().multiplyScalar(Math.min(10.0, dist * 0.8));

    // 2. 16 向虛擬光達斥力場 (數值避障，無畫面線條干擾)
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
    // 1. 地板基座
    const groundGeo = new THREE.BoxGeometry(IMG_W, 8, IMG_H);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xdfd8ce, roughness: 0.9 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -4;
    scene.add(groundMesh);

    // 2. 水系曲流（外雙溪、洲美蜆仔港水道、磺港溪軟橋水路）
    const waiShuangUV = [
        [1024, 154], [942, 178], [845, 196], [750, 165], [648, 134],
        [530, 145], [415, 168], [295, 204], [175, 250], [115, 282]
    ];
    layerGroups.rivers.add(createUVSplineRibbon(waiShuangUV, 42, 0.9, 0.15, 0x67abc7).mesh);

    const choumeiCanalUV = [[215, 0], [235, 32], [256, 68], [268, 108], [264, 148], [256, 182], [265, 215]];
    layerGroups.rivers.add(createUVSplineRibbon(choumeiCanalUV, 11.5, 0.92, 0.18, 0x67abc7).mesh);

    const jiandeCanalUV = [[608, 0], [602, 32], [594, 62], [602, 92], [596, 118], [588, 142]];
    layerGroups.rivers.add(createUVSplineRibbon(jiandeCanalUV, 11.5, 0.92, 0.18, 0x67abc7).mesh);

    // 3. 幹道網（承德路、文昌路、基河路、北士科福國路/福美路/福善路）
    const chengdeUV = [[290, 0], [308, 98], [335, 196], [376, 330], [422, 458], [452, 534]];
    layerGroups.roads.add(createUVSplineRibbon(chengdeUV, 21.5, 1.15, 0.1, 0xfbbf24).mesh);

    const wenchangUV = [[816, 0], [765, 76], [742, 152], [768, 272], [816, 435]];
    layerGroups.roads.add(createUVSplineRibbon(wenchangUV, 13.5, 1.12, 0.1, 0xfde047).mesh);

    const jiheUV = [[356, 250], [442, 224], [512, 270], [578, 342], [658, 434], [730, 534]];
    layerGroups.roads.add(createUVSplineRibbon(jiheUV, 11.5, 1.02, 0.1, 0xffffff).mesh);

    const northRoads = [
        { uv: [[0, 22], [150, 19], [295, 16], [445, 12], [595, 8]], w: 12 },
        { uv: [[0, 75], [85, 75], [165, 75], [242, 76]], w: 9 },
        { uv: [[0, 148], [85, 148], [168, 148], [252, 150]], w: 9 },
        { uv: [[54, 22], [54, 110], [54, 195], [54, 278]], w: 9 },
        { uv: [[158, 22], [158, 95], [158, 165], [158, 232]], w: 9 }
    ];
    northRoads.forEach(r => layerGroups.roads.add(createUVSplineRibbon(r.uv, r.w, 0.95, 0.08, 0xffffff).mesh));

    // 4. 重點地標：士林高商、兒童新樂園、新光醫院、科教館、天文館
    buildShilinHighSchoolOfCommerce();
    buildAmusementParkRichAttractions();

    const skMainUV = [[702, 365], [772, 358], [778, 405], [708, 412]];
    layerGroups.buildings.add(createUVPolygonMesh(skMainUV, 44, facadeMaterials.hospital, 0, {
        title: '新光吳火獅紀念醫院 (主醫療大樓)'
    }));
    createDiverseTaiwanBuilding(742, 338, 46, 28, 34, 0.14, { shapeType: 'stepped', matKey: 'hospital', noRooftop: true, title: '新光醫院 聖賢大樓' });
    addUVLabel(740, 385, 52, '🏥 新光醫院', 'text-rose-200 bg-slate-900/90 border-rose-400/60');

    const ntsecGroup = new THREE.Group();
    ntsecGroup.position.set(toX(538), 0, toZ(355));
    const ntsecCyl = new THREE.Mesh(new THREE.CylinderGeometry(27, 29, 28, 12), facadeMaterials.institutional);
    ntsecCyl.position.y = 14;
    ntsecGroup.add(ntsecCyl);
    layerGroups.buildings.add(ntsecGroup);
    totalBuildingCount++;

    const goldDome = new THREE.Mesh(
        new THREE.SphereGeometry(13, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 })
    );
    goldDome.position.set(toX(628), 13, toZ(355));
    layerGroups.buildings.add(goldDome);
    addUVLabel(538, 355, 44, '🔬 科教館 & 🪐 天文館', 'text-amber-100 bg-slate-900/90 border-amber-400/60');

    // 5. 【關鍵補齊】：北士科園區核心建築與廠辦街廓群
    // (A) 金仁寶營運總部（多邊形複合裙樓 + 雙摩天塔樓）
    const kinpoFootprintUV = [[335, 44], [424, 40], [428, 120], [385, 134], [348, 142], [336, 92]];
    layerGroups.buildings.add(createUVPolygonMesh(kinpoFootprintUV, 14, facadeMaterials.midriseMansion, 0, {
        title: '金仁寶營運總部大樓 (複合商業裙樓)'
    }, { bevel: true }));
    totalBuildingCount++;
    createDiverseTaiwanBuilding(374, 76, 34, 30, 72, 0.08, { shapeType: 'chamfer', matKey: 'glassTower', title: '金仁寶總部 (主塔樓 72m)' });
    createDiverseTaiwanBuilding(402, 106, 26, 24, 46, 0.08, { shapeType: 'stepped', matKey: 'highriseLuxury', title: '金仁寶總部 (南翼塔樓)' });
    addUVLabel(376, 80, 78, '🏗️ 金仁寶營運總部', 'text-cyan-100 bg-slate-900/90 border-cyan-400/60');

    // (B) NVIDIA Constellation 輝達星群園區與福國路科技園區
    const nvidiaMainUV = [[452, 52], [576, 46], [578, 96], [515, 102], [454, 106]];
    layerGroups.buildings.add(createUVPolygonMesh(nvidiaMainUV, 22, 0x1e293b, 0, {
        title: 'NVIDIA Constellation (輝達北士科星群園區)'
    }, { roughness: 0.22, metalness: 0.75, bevel: true }));
    totalBuildingCount++;
    populateCurvedStreetBlock([[450, 15], [515, 13], [578, 11]], [[450, 38], [515, 36], [578, 34]], {
        cols: 5, doubleRow: false, zoneType: 'avenue_commercial', streetName: '北士科福國路科技園區'
    });
    addUVLabel(515, 76, 30, '🟢 NVIDIA Constellation', 'text-lime-200 bg-slate-900/90 border-lime-400/60');

    // (C) 北士科洲美段：中鼎第二總部、遠雄建設、中興巴士站
    createDiverseTaiwanBuilding(184, 108, 30, 44, 52, 0, { shapeType: 'stepped', matKey: 'glassTower', title: '中鼎集團第二總部' });
    createDiverseTaiwanBuilding(114, 112, 30, 34, 34, 0, { shapeType: 'stepped', matKey: 'highriseLuxury', title: '遠雄建設北士科大樓' });
    createDiverseTaiwanBuilding(74, 114, 20, 32, 11, 0, { shapeType: 'L', matKey: 'institutional', title: '中興/光華巴士洲美站' });
    addUVLabel(184, 108, 58, '🏢 中鼎第二總部 & 洲美段', 'text-sky-200 bg-slate-900/90 border-sky-400/60');

    // (D) 北士科洲美段各街廓廠辦與研發大樓群
    populateCurvedStreetBlock([[4, 30], [46, 30]], [[4, 68], [46, 68]], { cols: 3, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福美路西段' });
    populateCurvedStreetBlock([[62, 28], [150, 28]], [[62, 68], [150, 68]], { cols: 6, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福國路・福美路街廓' });
    populateCurvedStreetBlock([[165, 28], [232, 28]], [[165, 68], [238, 68]], { cols: 5, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福美路洲美公園側' });
    populateCurvedStreetBlock([[4, 156], [46, 156]], [[4, 222], [46, 222]], { cols: 3, doubleRow: true, zoneType: 'avenue_commercial', streetName: '承平路西側廠辦區' });
    populateCurvedStreetBlock([[62, 156], [150, 156]], [[62, 255], [150, 232]], { cols: 6, doubleRow: true, zoneType: 'luxury_highrise', streetName: '福善路科技大樓群' });
    populateCurvedStreetBlock([[165, 156], [248, 156]], [[165, 224], [252, 198]], { cols: 5, doubleRow: true, zoneType: 'avenue_commercial', streetName: '河美街科技園區' });

    // (E) 司法園區與歐洲學校
    createDiverseTaiwanBuilding(644, 35, 38, 34, 28, 0, { shapeType: 'U', matKey: 'institutional', noRooftop: true, title: '台北高等行政法院' });
    createDiverseTaiwanBuilding(644, 78, 36, 30, 26, 0, { shapeType: 'L', matKey: 'institutional', noRooftop: true, title: '法官學院' });
    createDiverseTaiwanBuilding(714, 36, 42, 30, 20, -0.05, { shapeType: 'L', matKey: 'oldWarmTile', noRooftop: true, title: '臺北歐洲學校小學部' });
    addUVLabel(646, 38, 34, '⚖️ 高等行政法院 & 歐洲學校', 'text-amber-100 bg-slate-900/85 border-amber-400/50');

    // 6. 士林本島密集街廓群
    const wenlinNorthCurvedBlocks = [
        { top: [[775, 8], [818, 8], [858, 12], [888, 18]], bot: [[762, 42], [808, 34], [852, 30], [884, 34]], cols: 12, zone: 'old_walkup', name: '文林路681巷' },
        { top: [[760, 48], [805, 42], [848, 38], [886, 42]], bot: [[756, 80], [802, 66], [846, 54], [890, 58]], cols: 13, zone: 'old_walkup', name: '文林路681巷南側' },
        { top: [[762, 88], [806, 74], [850, 62], [894, 66]], bot: [[770, 108], [814, 98], [856, 92], [898, 88]], cols: 13, zone: 'old_walkup', name: '文林路661巷39弄' },
        { top: [[818, 104], [858, 98], [902, 95]], bot: [[824, 130], [864, 125], [908, 120]], cols: 10, zone: 'old_walkup', name: '文林路643巷' },
        { top: [[826, 136], [868, 132], [912, 128]], bot: [[830, 158], [872, 158], [918, 150]], cols: 10, zone: 'old_walkup', name: '文林路615巷' }
    ];
    wenlinNorthCurvedBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, zoneType: b.zone, streetName: b.name }));

    const mrtEastCurvedBlocks = [
        { top: [[912, 4], [968, 4], [1020, 4]], bot: [[922, 40], [972, 28], [1020, 15]], cols: 11, zone: 'mixed_alley', name: '中山北路五段829巷' },
        { top: [[926, 48], [976, 36], [1020, 22]], bot: [[938, 82], [982, 70], [1020, 56]], cols: 11, zone: 'old_walkup', name: '福華路街廓' },
        { top: [[942, 90], [985, 78], [1020, 65]], bot: [[955, 132], [992, 122], [1022, 112]], cols: 10, zone: 'old_walkup', name: '福華路中段' },
        { top: [[958, 140], [994, 130], [1022, 120]], bot: [[975, 185], [1002, 178], [1022, 170]], cols: 9, zone: 'mixed_alley', name: '士林橋東岸' }
    ];
    mrtEastCurvedBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, zoneType: b.zone, streetName: b.name }));

    const wenchangWestBlocks = [
        { top: [[668, 184], [705, 178], [738, 174]], bot: [[672, 204], [708, 195], [744, 186]], cols: 9, zone: 'old_walkup', name: '文昌路179巷' },
        { top: [[674, 210], [712, 200], [748, 190]], bot: [[678, 232], [716, 222], [752, 212]], cols: 9, zone: 'old_walkup', name: '文昌路169巷' },
        { top: [[680, 238], [718, 228], [755, 218]], bot: [[685, 260], [722, 250], [758, 240]], cols: 9, zone: 'mixed_alley', name: '文昌路155巷' },
        { top: [[686, 266], [725, 256], [762, 246]], bot: [[692, 286], [730, 276], [765, 266]], cols: 9, zone: 'old_walkup', name: '文昌路155巷南' }
    ];
    wenchangWestBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, zoneType: b.zone, streetName: b.name }));

    const southeastDenseBlocks = [
        { top: [[760, 196], [825, 212], [895, 208], [945, 196]], bot: [[762, 216], [825, 232], [895, 232], [952, 226]], cols: 18, zone: 'old_walkup', name: '文林路587巷' },
        { top: [[766, 226], [815, 240], [865, 250], [915, 245], [958, 236]], bot: [[772, 258], [820, 266], [870, 265], [918, 260], [962, 252]], cols: 19, zone: 'old_walkup', name: '文昌路140巷' },
        { top: [[774, 262], [822, 270], [872, 268], [920, 262], [964, 255]], bot: [[778, 294], [828, 288], [878, 282], [925, 275], [968, 268]], cols: 19, zone: 'mixed_alley', name: '美崙街86巷' },
        { top: [[784, 302], [835, 294], [888, 286], [935, 280], [972, 275]], bot: [[788, 328], [840, 320], [892, 310], [940, 302], [976, 296]], cols: 19, zone: 'old_walkup', name: '美崙街南側' },
        { top: [[790, 332], [842, 324], [895, 314], [942, 306], [978, 300]], bot: [[794, 354], [846, 342], [898, 332], [946, 324], [980, 318]], cols: 19, zone: 'old_walkup', name: '美崙街49巷' },
        { top: [[802, 402], [858, 390], [918, 378], [986, 368]], bot: [[808, 428], [864, 416], [924, 404], [990, 394]], cols: 19, zone: 'mixed_alley', name: '華光街南段' },
        { top: [[812, 434], [872, 422], [932, 410], [995, 400]], bot: [[822, 472], [882, 458], [942, 444], [1005, 430]], cols: 16, zone: 'avenue_commercial', name: '士林中正路商辦' }
    ];
    southeastDenseBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, zoneType: b.zone, streetName: b.name }));

    const jiheSouthBlocks = [
        { top: [[548, 402], [585, 382], [618, 396]], bot: [[558, 434], [595, 412], [630, 390]], cols: 7, zone: 'luxury_highrise', name: '基河路396巷北' },
        { top: [[554, 444], [598, 420], [638, 398]], bot: [[574, 480], [618, 454], [662, 430]], cols: 8, zone: 'luxury_highrise', name: '基河路396巷南' },
        { top: [[578, 488], [624, 462], [668, 438]], bot: [[602, 522], [648, 494], [692, 470]], cols: 8, zone: 'luxury_highrise', name: '基河路300巷' }
    ];
    jiheSouthBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, zoneType: b.zone, streetName: b.name }));

    // 7. 安全陸地植栽
    buildSafeTreesExcludingWater();
}

function createSuperVisibleHelipad(x, y, z, colorHex, labelText) {
    const padGroup = new THREE.Group();
    padGroup.position.set(x, y + 0.05, z);

    // 停機坪基座 (直徑 1.6m)
    const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.1, 24),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 })
    );
    padGroup.add(pad);

    // 發光外圓環
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.8, 24),
        new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    padGroup.add(ring);

    // 通天垂直引導光柱
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

    // 頂空漂浮八面體標記
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

            // 恢復前一棟大樓的原始材質
            if (selectedMesh && selectedMeshOriginalMaterials) {
                selectedMesh.material = selectedMeshOriginalMaterials;
            }

            selectedMesh = hitMesh;

            // 克隆獨立材質，避免連鎖發光問題
            selectedMeshOriginalMaterials = hitMesh.material;
            if (Array.isArray(hitMesh.material)) {
                hitMesh.material = hitMesh.material.map(m => {
                    const cloned = m.clone();
                    if (cloned.emissive) cloned.emissive.setHex(0xf59e0b);
                    return cloned;
                });
            } else {
                hitMesh.material = hitMesh.material.clone();
                if (hitMesh.material.emissive) hitMesh.material.emissive.setHex(0xf59e0b);
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
        alert('演算法運行異常：' + e.message);
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

    // 更新即時飛行軌跡帶
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
        ambientLight.intensity = 0.6;
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

    // 起訖點懸浮八面體旋轉
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

    if (labelsVisible) {
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
    }

    renderer.render(scene, camera);
}

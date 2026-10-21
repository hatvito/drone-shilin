// ============================================================================
// js/main.js: 完整對齊無語法錯誤版（含 25m 低空巷戰、起訖點巨型置頂標籤與防過曝）
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

let studentControllerInstance = null;
let studentLegacyUpdateFunc = null;

const htmlLabels = [];
const missionHtmlLabels = [];
let labelsVisible = true;

// 預設學生控制器範本（低空巷戰避障模式：限高 25.0m）
const DEFAULT_CODE = `class StudentController {
    constructor(goal_pos) {
        // goal_pos: 終點停機坪座標數組 [gx, gy, gz]
        this.goal = goal_pos.slice();

        // ★ 關鍵參數宣告區（低空巷戰避障模式：限高 25.0m）
        this.speed = 11.0;            // 最高巡航速度 (m/s，建議 6~14，巷弄轉彎多不宜過快)
        this.cruiseAltitude = 12.5;   // 低空巷戰巡航高度 (m，建議 10~16，穿梭於 3~4 樓巷弄間，嚴禁超過 25m)
        this.sensorRange = 22.0;      // 光達感測距離 (m，建議 15~30，提早偵測街角與大樓外牆)
        this.repulsePower = 24.0;     // 障礙物推開強度 (建議 15~35，數值越大閃越遠)
        this.safeBrakeDist = 7.5;     // 動態安全煞車距離 (m，小於此距離時減速轉彎)
        this.rayCount = 16;           // 水平環景光達射線數量 (建議 16~24)
    }

    get_velocity(current_pos, raycast_func, dt) {
        const [x, y, z] = current_pos;
        const [gx, gy, gz] = this.goal;

        // 1. 計算水平距離與目標方向
        const dx = gx - x;
        const dz = gz - z;
        const horizDist = Math.hypot(dx, dz);

        // 低空高度控制：距離終點 > 18m 時維持在 12.5m 巷弄高度穿梭；接近終點時平滑對齊屋頂 gy
        let targetY = (horizDist > 18.0) ? this.cruiseAltitude : gy;
        targetY = Math.min(23.0, Math.max(4.0, targetY));

        const dy = targetY - y;
        const dist3D = Math.hypot(dx, dy, dz) || 1e-5;

        let desiredSpeed = Math.min(this.speed, dist3D * 1.1);
        let vx = (dx / dist3D) * desiredSpeed;
        let vy = (dy / dist3D) * desiredSpeed;
        let vz = (dz / dist3D) * desiredSpeed;

        // 2. 水平環景多向虛擬光達排斥力 + 切線繞行輔助
        let repX = 0, repY = 0, repZ = 0;
        let minFrontDist = this.sensorRange;

        for (let i = 0; i < this.rayCount; i++) {
            const angle = (i / this.rayCount) * Math.PI * 2;
            const rdx = Math.cos(angle);
            const rdz = Math.sin(angle);
            const d = raycast_func(current_pos, [rdx, 0, rdz], this.sensorRange);

            if (d < this.sensorRange) {
                const ratio = (this.sensorRange - d) / this.sensorRange;
                const factor = ratio * ratio * this.repulsePower;
                repX -= (rdx - rdz * 0.35) * factor;
                repZ -= (rdz + rdx * 0.35) * factor;
                if (d < minFrontDist) minFrontDist = d;
            }
        }

        // 3. 垂直防撞探測與 25m 限高保護
        const dDown = raycast_func(current_pos, [0, -1, 0], 6.0);
        if (dDown < 2.5 && y < 21.5) {
            repY += (2.5 - dDown) * 3.5;
        }
        if (y > 22.5) {
            repY -= (y - 22.5) * 12.0;
        }

        // 4. 動態安全煞車機制
        if (minFrontDist < this.safeBrakeDist) {
            const brakeScale = Math.max(0.25, minFrontDist / this.safeBrakeDist);
            vx *= brakeScale;
            vz *= brakeScale;
        }

        let outVx = vx + repX;
        let outVy = vy + repY;
        let outVz = vz + repZ;

        const finalSpd = Math.hypot(outVx, outVy, outVz);
        if (finalSpd > this.speed) {
            const s = this.speed / finalSpd;
            outVx *= s; outVy *= s; outVz *= s;
        }

        return [outVx, outVy, outVz];
    }
}`;

// AI 提示詞範本
const AI_PROMPT_TEXT = `============================================================
【第一部分：演算法策略需求（★ 學生可自行增加／修改此區塊需求）】
============================================================
請根據以下構想設計「台北士林千棟都會區・低空巷戰」避障與導航邏輯（你可以自由添加或替換為其他演算法）：
1. 複合式導航：以朝向終點停機坪的引力為基準，並結合多向虛擬光達排斥力（人工位能場 APF）與側向切線繞行力。
2. 動態安全煞車：當光達探測到距離大樓外牆、頂樓鐵皮加蓋或水塔小於安全門檻時，主動降低前進速度，避免高速慣性煞停不及撞牆。
3. 盲區強化：射線密度建議為 16 向以上水平環景（或針對前進方向錐形加密），並搭配上下垂直探測避免擦撞屋頂女兒牆或鐵皮屋。
4. 防火巷死胡同脫困狀態機：士林美崙街與文昌路有大量狹窄防火巷與 L 型街角屋，若連續一段時間位移極小（卡在局部極小值受力平衡），請切換為後退並沿開闊側橫移繞行，脫困後再恢復巡航。
5. 低空巡航限制（嚴禁高空作弊）：本挑戰賽嚴格限高 25.0m！絕大多數大樓與公寓（15m~72m）皆無法直接從頂部無腦飛越。平時請維持在安全低空巡航高度（約 11~14m）於街道與巷弄間水平穿梭繞障；若前方遇較矮建築且低於 22m 可適度微幅拉升，接近終點（<15m）時再平滑對齊終點屋頂停機坪。

============================================================
【第二部分：世界環境與物理規則（固定規格，不可變更）】
============================================================
1. 地圖空域範圍：台北士林／北士科真實比例街廓（寬 1024 × 深 534），中心座標範圍：東西向 X∈[-512.0, 512.0]，南北向 Z∈[-267.0, 267.0]（超出邊界視為失事墜毀）。
2. 起點位置：隨機種子 (0000~9999) 選定之「翡翠綠」大樓屋頂停機坪（屋頂高度 <= 20.0m）。
3. 終點目標：隨機種子選定之「流金黃」大樓屋頂停機坪（屋頂高度 <= 20.0m）。
4. 機體大小：無人機為半徑 0.25 公尺的穿梭機（具備精準 AABB 包圍盒與 CCD 連續碰撞細分檢測，不可撞牆或墜地）。
5. 空域限高：最高高度嚴格限制為 25.0 公尺（y <= 0 觸地或 y > 25.0 超高會立即違規墜毀！禁止利用高空直線飛越）。
6. 計分機制：進入終點停機坪中心 1.5 公尺內即完成任務；失事時計算「失事點至終點的 3D 直線剩餘距離」，越短名次越高。

============================================================
【第三部分：程式碼輸出規範（★ 參數易讀性與中文註解要求）】
============================================================
為了讓初學學生方便閱讀程式碼與自主微調測試，請務必嚴格遵守：
1. 【參數透明化】：所有控制避障強度、航行速度、巡航高度、安全煞車距離、光達射線數量的「關鍵常數」，請務必統一宣告在 constructor 內（例如 \`this.speed\`、\`this.sensorRange\` 等）。
2. 【繁體中文註解】：在每個關鍵參數宣告後方，必須附上清晰的單行繁體中文註解，說明其「中文意義」、「單位」以及「調大/調小的影響（或建議數值區間）」。
   範例格式：
   this.speed = 11.0;            // 最高巡航速度 (m/s，建議 6~14，數值越高越快但轉彎半徑大)
   this.cruiseAltitude = 12.5;   // 低空巡航基準高度 (m，建議 10~16，嚴禁超過 25.0m 限高)
   this.sensorRange = 22.0;      // 光達感測距離 (m，越遠越能提早轉向，但太遠易受無關建築干擾)
   this.repulsePower = 24.0;     // 障礙物推開強度 (數值越大閃越遠，但太大容易在狹道劇烈震盪)

============================================================
【第四部分：系統必要代碼介面（★ 絕對不可修改類別名與函式簽章）】
============================================================
請嚴格保證輸出符合以下類別定義與函式簽章，勿使用任何未定義的外部套件：

class StudentController {
    constructor(goal_pos) {
        // goal_pos: 終點座標數組 [gx, gy, gz]
        this.goal = goal_pos.slice();

        // ★ 請在此處宣告各項關鍵參數，並加上清楚的繁體中文註解說明
        this.speed = 11.0;            // 巡航速度 (m/s)
        this.cruiseAltitude = 12.5;   // 低空巡航基準高度 (m，限高 25.0m)
    }

    get_velocity(current_pos, raycast_func, dt) {
        /**
         * 參數說明：
         * - current_pos: 當前無人機中心座標 [x, y, z]
         * - raycast_func(origin, direction, max_dist=45.0):
         *     虛擬光達測距函式。
         *     origin: 測距起點 [x, y, z]
         *     direction: 3D 向量 [dx, dy, dz]
         *     max_dist: 最大感測距離（預設 45.0）
         *     回傳值: float（至建築物外牆的淨空距離；前方無障礙則回傳 max_dist）
         * - dt: 該影格的時間差 (約 0.016 ~ 0.033 秒)
         * 
         * 必要回傳值：
         * - 必須回傳一個 3D 速度向量數組 [vx, vy, vz]
         */
        
        // --- 請在此處實作你的避障與導航邏輯 ---

        return [0, 0, 0];
    }
}

請直接輸出完整且乾淨的 JavaScript 類別程式碼。`;

window.addEventListener('load', () => {
    mapRngSeed = 1337;

    initRichFacadeAndRoofMaterials();
    initThreeScene();

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
    const promptEl = document.getElementById('ai-prompt-text');
    if (promptEl) promptEl.value = AI_PROMPT_TEXT;

    document.getElementById('stats-badge').textContent = `${totalBuildingCount.toLocaleString()} 棟多樣化建築 · ${totalRoadSegments} 條彎曲道路/水岸`;

    animate();
});

function initThreeScene() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcbd5e1);
    scene.fog = new THREE.FogExp2(0xcbd5e1, 0.00042);

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 2, 3400);
    camera.position.set(0, 470, 385);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
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

    ambientLight = new THREE.AmbientLight(0xffffff, 0.38);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x94a3b8, 0.28);
    hemiLight.position.set(0, 360, 0);
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(0xfffbeb, 0.68);
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

function applyIsolatedHighlight(meshOrGroup, colorHex) {
    if (!meshOrGroup) return [];
    const backups = [];
    const root = meshOrGroup.parent && meshOrGroup.parent !== layerGroups.buildings ? meshOrGroup.parent : meshOrGroup;

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

    const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 0.3, 32),
        new THREE.MeshBasicMaterial({ color: colorHex })
    );
    padGroup.add(pad);

    const outerRing = new THREE.Mesh(
        new THREE.RingGeometry(2.8, 3.8, 32),
        new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.2;
    padGroup.add(outerRing);

    const coreBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 110, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    coreBeam.position.y = 55;
    padGroup.add(coreBeam);

    const auraBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 4.5, 110, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false })
    );
    auraBeam.position.y = 55;
    padGroup.add(auraBeam);

    const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(3.8, 0),
        new THREE.MeshBasicMaterial({ color: colorHex })
    );
    marker.position.y = 28;
    padGroup.add(marker);
    padGroup.marker = marker;

    return { mesh: padGroup, pos: new THREE.Vector3(x, y + 0.5, z) };
}

function createMissionFloatingLabel(x, y, z, type, titleText, roofY) {
    const container = document.getElementById('labels-container');
    const el = document.createElement('div');
    el.className = 'map-label';
    el.style.zIndex = '50';

    const isStart = (type === 'START');
    const badgeBg = isStart
        ? 'bg-emerald-500 text-slate-950 border-2 border-white shadow-[0_0_25px_rgba(16,185,129,1)]'
        : 'bg-amber-400 text-slate-950 border-2 border-white shadow-[0_0_25px_rgba(245,158,11,1)]';
    const icon = isStart ? '🛫 起點 START' : '🏁 終點 GOAL';
    const stemColor = isStart ? '#10b981' : '#f59e0b';

    el.innerHTML = `
        <div class="px-3 py-1 rounded-xl ${badgeBg} font-black text-xs sm:text-sm flex flex-col items-center animate-bounce">
            <div class="tracking-wider">${icon}</div>
            <div class="text-[10px] font-bold opacity-90 max-w-[140px] truncate">${titleText} (${Math.round(roofY)}m)</div>
        </div>
        <div style="width: 3px; height: 18px; margin: 0 auto; background: ${stemColor}; box-shadow: 0 0 8px ${stemColor};"></div>
    `;

    el.onclick = (e) => {
        e.stopPropagation();
        controls.target.set(x, roofY, z);
        camera.position.set(x, roofY + 85, z + 95);
    };

    container.appendChild(el);
    missionHtmlLabels.push({ el, pos: new THREE.Vector3(x, y + 32, z) });
}

function applyMissionSeed() {
    const seedVal = parseInt(document.getElementById('mission-seed-input').value) || 1337;
    missionSeed = seedVal;
    if (candidateBuildings.length < 2) return;

    restoreIsolatedHighlight(startBuildingOriginalMat);
    restoreIsolatedHighlight(targetBuildingOriginalMat);

    missionHtmlLabels.forEach(item => item.el.remove());
    missionHtmlLabels.length = 0;

    let idxA = 0, idxB = 1;
    let attempts = 0;
    while (attempts < 500) {
        idxA = Math.floor(missionRandom() * candidateBuildings.length);
        idxB = Math.floor(missionRandom() * candidateBuildings.length);
        const candA = candidateBuildings[idxA];
        const candB = candidateBuildings[idxB];

        if (idxA !== idxB && candA.roofY <= 20.0 && candB.roofY <= 20.0 && candA.center.distanceTo(candB.center) > 220) {
            break;
        }
        attempts++;
    }

    if (attempts >= 500) {
        idxA = Math.floor(missionRandom() * candidateBuildings.length);
        do {
            idxB = Math.floor(missionRandom() * candidateBuildings.length);
        } while (idxA === idxB);
    }

    layerGroups.mission.clear();
    const bA = candidateBuildings[idxA];
    const bB = candidateBuildings[idxB];

    startBuildingMesh = bA.mesh;
    startBuildingOriginalMat = applyIsolatedHighlight(startBuildingMesh, 0x00ff88);

    targetBuildingMesh = bB.mesh;
    targetBuildingOriginalMat = applyIsolatedHighlight(targetBuildingMesh, 0xffaa00);

    startHelipad = createSuperVisibleHelipad(bA.center.x, bA.roofY, bA.center.z, 0x00ff88);
    targetHelipad = createSuperVisibleHelipad(bB.center.x, bB.roofY, bB.center.z, 0xffaa00);
    layerGroups.mission.add(startHelipad.mesh, targetHelipad.mesh);

    createMissionFloatingLabel(bA.center.x, bA.roofY, bA.center.z, 'START', bA.title, bA.roofY);
    createMissionFloatingLabel(bB.center.x, bB.roofY, bB.center.z, 'GOAL', bB.title, bB.roofY);

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

            if (selectedMesh && selectedMeshOriginalMaterials && selectedMesh !== startBuildingMesh && selectedMesh !== targetBuildingMesh) {
                restoreIsolatedHighlight(selectedMeshOriginalMaterials);
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
    if (flightState.status === 'CRASHED' || flightState.status === 'SUCCESS') {
        resetFlightState();
    }

    studentControllerInstance = null;
    studentLegacyUpdateFunc = null;

    try {
        const rawCode = document.getElementById('code-editor').value;
        const goalArray = [targetHelipad.pos.x, targetHelipad.pos.y, targetHelipad.pos.z];

        const factory = new Function('goal_pos', `
            ${rawCode}
            if (typeof StudentController !== 'undefined') {
                return { type: 'class', instance: new StudentController(goal_pos) };
            } else if (typeof update === 'function') {
                return { type: 'func', func: update };
            }
            throw new Error('找不到 class StudentController 或 update 函式！');
        `);

        const compiled = factory(goalArray);
        if (compiled.type === 'class') {
            studentControllerInstance = compiled.instance;
        } else {
            studentLegacyUpdateFunc = compiled.func;
        }
    } catch (e) {
        alert('避障代碼編譯失敗：\n' + e.message);
        return;
    }

    isSimulating = true;
    flightState.status = 'FLYING';
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
    blackboxLogs.length = 0;
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
    if (!isSimulating || (!studentControllerInstance && !studentLegacyUpdateFunc)) return;

    flightState.flightTime += dt;
    const lidarData = query16DirectionLiDAR(flightState.pos);

    try {
        if (studentControllerInstance) {
            const currentPosArr = [flightState.pos.x, flightState.pos.y, flightState.pos.z];
            const velArr = studentControllerInstance.get_velocity(currentPosArr, raycastSafe, dt);
            if (!Array.isArray(velArr) || velArr.length < 3) {
                throw new Error('get_velocity 必須回傳長度為 3 的速度陣列 [vx, vy, vz]');
            }
            const desiredVel = new THREE.Vector3(velArr[0] || 0, velArr[1] || 0, velArr[2] || 0);
            if (desiredVel.length() > 18.0) desiredVel.normalize().multiplyScalar(18.0);
            flightState.vel.lerp(desiredVel, Math.min(1.0, dt * 6.0));
        } else if (studentLegacyUpdateFunc) {
            const accel = studentLegacyUpdateFunc(
                { pos: flightState.pos.clone(), vel: flightState.vel.clone() },
                { pos: targetHelipad.pos.clone() },
                raycastSafe,
                lidarData,
                dt
            );
            const aVec = new THREE.Vector3(accel.ax || 0, accel.ay || 0, accel.az || 0);
            if (aVec.length() > 15.0) aVec.normalize().multiplyScalar(15.0);
            flightState.vel.addScaledVector(aVec, dt);
            if (flightState.vel.length() > 18.0) flightState.vel.normalize().multiplyScalar(18.0);
        }
    } catch (e) {
        isSimulating = false;
        flightState.status = 'CRASHED';
        alert('演算法運行異常：\n' + e.message);
        pauseFlightSimulation();
        return;
    }

    const nextPos = flightState.pos.clone().addScaledVector(flightState.vel, dt);

    const ccd = checkContinuousCollision(flightState.pos, nextPos);
    if (ccd.hit) {
        isSimulating = false;
        flightState.status = 'CRASHED';
        document.getElementById('flight-status-badge').textContent = '失事墜毀';
        document.getElementById('flight-status-badge').className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300';
        alert(`⚠️ 無人機任務失敗！\n原因：${ccd.reason}\n失事點剩餘直線距離：${flightState.remainingDistance.toFixed(2)} m\n任務達成率：${flightState.progress.toFixed(1)}%`);
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

    if (blackboxLogs.length === 0 || flightState.flightTime - blackboxLogs[blackboxLogs.length - 1].t >= 0.1) {
        blackboxLogs.push({
            t: parseFloat(flightState.flightTime.toFixed(2)),
            x: parseFloat(flightState.pos.x.toFixed(2)),
            y: parseFloat(flightState.pos.y.toFixed(2)),
            z: parseFloat(flightState.pos.z.toFixed(2)),
            dist: parseFloat(dist.toFixed(2))
        });
    }

    if (dist < 1.5) {
        isSimulating = false;
        flightState.status = 'SUCCESS';
        flightState.progress = 100;
        flightState.remainingDistance = 0;
        updateTelemetry();
        document.getElementById('flight-status-badge').textContent = '任務達成';
        document.getElementById('flight-status-badge').className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300';
        alert(`🏆 恭喜！成功降落於終點大樓停機坪！\n總耗時：${flightState.flightTime.toFixed(1)} 秒\n達成率：100%`);
        return;
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
    if (confirm('確定要還原為預設 StudentController 類別代碼嗎？')) {
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
        scene.background.setHex(0xcbd5e1);
        scene.fog.color.setHex(0xcbd5e1);
        renderer.toneMappingExposure = 0.82;
        ambientLight.intensity = 0.38;
        hemiLight.intensity = 0.28;
        dirLight.color.setHex(0xfffbeb);
        dirLight.intensity = 0.68;
        dirLight.position.set(240, 430, 250);
    } else if (mode === 'sunset') {
        scene.background.setHex(0xfdba74);
        scene.fog.color.setHex(0xfdba74);
        renderer.toneMappingExposure = 0.88;
        ambientLight.intensity = 0.35;
        hemiLight.intensity = 0.25;
        dirLight.color.setHex(0xf97316);
        dirLight.intensity = 0.85;
        dirLight.position.set(-420, 195, 140);
    } else if (mode === 'night') {
        scene.background.setHex(0x090d16);
        scene.fog.color.setHex(0x090d16);
        renderer.toneMappingExposure = 0.95;
        ambientLight.intensity = 0.25;
        hemiLight.intensity = 0.2;
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
        remainingDistance: flightState.remainingDistance,
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

    if (drone && drone.propellers) {
        const pSpeed = isSimulating ? 35 : (drone.visible ? 6 : 0);
        drone.propellers.forEach(p => p.rotation.y += pSpeed * dt);
    }

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

    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;

    if (labelsVisible && cameraViewMode === 'orbit') {
        htmlLabels.forEach(item => {
            const p = item.pos.clone().project(camera);
            if (p.z > 1) {
                item.el.style.display = 'none';
            } else {
                item.el.style.display = 'block';
                item.el.style.opacity = '0.75';
                item.el.style.left = `${(p.x * hw) + hw}px`;
                item.el.style.top = `${-(p.y * hh) + hh}px`;
            }
        });
    } else {
        htmlLabels.forEach(item => item.el.style.display = 'none');
    }

    missionHtmlLabels.forEach(item => {
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

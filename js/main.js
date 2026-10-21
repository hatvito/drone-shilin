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
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0

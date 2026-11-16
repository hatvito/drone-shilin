// ============================================================================
// js/core/scene.js: Three.js 核心場景初始化、相機、控制器與動態日照光影
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    let scene, camera, renderer, controls, raycaster, mouse;
    let dirLight, ambientLight, hemiLight;

    function initScene(containerId = 'canvas-container') {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`找不到畫布容器 #${containerId}`);

        // 1. 場景與大氣霧效
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xdbeafe);
        scene.fog = new THREE.FogExp2(0xdbeafe, 0.00032);

        // 2. 透視相機 (42度視角，最適合千棟街廓鳥瞰)
        camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 2, 3400);
        camera.position.set(0, 470, 385);

        // 3. WebGL 高性能渲染器 (PCF 柔和陰影 + ACES Filmic 色調映射)
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        container.appendChild(renderer.domElement);

        // 4. 軌道控制器 (左右鍵互換：左鍵平移 PAN、右鍵旋轉 ROTATE)
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 10);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.maxPolarAngle = Math.PI / 2 - 0.02; // 防止鑽入地底
        controls.minDistance = 18;
        controls.maxDistance = 1250;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };

        // 避免右鍵旋轉時彈出瀏覽器預設右鍵選單
        renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

        // 5. 自然環境光與半球天光 (充足明亮，照亮背光面與街角)
        ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambientLight);

        hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x94a3b8, 0.45);
        hemiLight.position.set(0, 360, 0);
        scene.add(hemiLight);

        // 6. 主要太陽平行光與高解析度陰影相機
        dirLight = new THREE.DirectionalLight(0xfffaed, 0.85);
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

        // 7. 掛載各功能分層圖層群組
        Object.values(ns.State.layerGroups).forEach(group => scene.add(group));

        // 8. 射線探測器與滑鼠向量
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // 9. 視窗縮放自動適配
        window.addEventListener('resize', onWindowResize);
    }

    function onWindowResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // 白晝 / 夕陽 / 夜間光影模式切換
    function setLightingMode(mode) {
        if (!scene || !dirLight || !ambientLight || !hemiLight) return;

        ['day', 'sunset', 'night'].forEach(m => {
            const btn = document.getElementById('btn-' + m);
            if (btn) {
                btn.className = m === mode
                    ? 'px-2 py-1.5 rounded-lg bg-cyan-500 text-slate-950 transition font-bold'
                    : 'px-2 py-1.5 rounded-lg hover:bg-slate-700/60 text-slate-300 transition font-bold';
            }
        });

        if (mode === 'day') {
            scene.background.setHex(0xdbeafe);
            scene.fog.color.setHex(0xdbeafe);
            renderer.toneMappingExposure = 1.05;
            ambientLight.intensity = 0.65;
            hemiLight.intensity = 0.45;
            dirLight.color.setHex(0xfffaed);
            dirLight.intensity = 0.85;
            dirLight.position.set(240, 430, 250);
        } else if (mode === 'sunset') {
            scene.background.setHex(0xfb923c);
            scene.fog.color.setHex(0xfb923c);
            renderer.toneMappingExposure = 1.0;
            ambientLight.intensity = 0.52;
            hemiLight.intensity = 0.35;
            dirLight.color.setHex(0xf97316);
            dirLight.intensity = 0.95;
            dirLight.position.set(-420, 195, 140);
        } else if (mode === 'night') {
            scene.background.setHex(0x090d16);
            scene.fog.color.setHex(0x090d16);
            renderer.toneMappingExposure = 0.95;
            ambientLight.intensity = 0.35;
            hemiLight.intensity = 0.25;
            dirLight.color.setHex(0x60a5fa);
            dirLight.intensity = 0.45;
            dirLight.position.set(140, 380, -200);
        }
    }

    ns.Scene = {
        initScene,
        getScene: () => scene,
        getCamera: () => camera,
        getRenderer: () => renderer,
        getControls: () => controls,
        getRaycaster: () => raycaster,
        getMouse: () => mouse,
        setLightingMode
    };
})(window.ShilinDrone);

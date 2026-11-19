// ============================================================================
// js/world/landmarks.js: 台北士林與北士科重大真實地標建築群
// (金仁寶總部、NVIDIA星群、兒童新樂園、科教館、天文館、士林高商12棟校舍、新光醫院)
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { toX, toZ } = ns.Config || {};
    const { facadeMaterials = {} } = ns.Materials || {};
    const { createUVPolygonMesh = () => {}, createUVSplineRibbon = () => {}, registerInteractive = () => {} } = ns.GeoHelpers || {};
    const { createDiverseTaiwanBuilding = () => {} } = ns.BuildingGenerator || {};
    const { populateCurvedStreetBlock = () => {} } = ns.StreetBlocks || {};
    const { layerGroups = {}, stats = {}, dynamicObjects = [] } = ns.State || {};

    function buildLandmarks() {
        const addLabel = (u, v, y, text, style) => {
            if (ns.Labels && ns.Labels.addUVLabel) {
                ns.Labels.addUVLabel(u, v, y, text, style);
            }
        };

        // ------------------------------------------------------------------------
        // 1. 金仁寶營運總部大樓 (72m 摩天商辦 + 商業裙樓)
        // ------------------------------------------------------------------------
        const kinpoFootprintUV = [[335, 44], [424, 40], [428, 120], [385, 134], [348, 142], [336, 92]];
        layerGroups.buildings.add(createUVPolygonMesh(kinpoFootprintUV, 14, facadeMaterials.midriseMansion, 0, {
            title: '金仁寶營運總部大樓 (複合商業裙樓)', category: '北士科旗艦總部'
        }, { bevel: true }));
        stats.totalBuildingCount++;

        createDiverseTaiwanBuilding(374, 76, 34, 30, 72, 0.08, {
            shapeType: 'chamfer', matKey: 'glassTower', noRooftop: true,
            title: '金仁寶營運總部大樓 (主摩天塔樓 72m)', category: '摩天企業總部'
        });
        createDiverseTaiwanBuilding(402, 106, 26, 24, 46, 0.08, {
            shapeType: 'stepped', matKey: 'highriseLuxury', noRooftop: true,
            title: '金仁寶營運總部大樓 (南翼塔樓)', category: '企業總部'
        });
        addLabel(376, 80, 78, '🏗️ 金仁寶營運總部大樓', 'text-cyan-100 bg-slate-900/90 border-cyan-400/60');

        // ------------------------------------------------------------------------
        // 2. NVIDIA Constellation 輝達北士科星群園區
        // ------------------------------------------------------------------------
        const nvidiaMainUV = [[452, 52], [576, 46], [578, 96], [515, 102], [454, 106]];
        layerGroups.buildings.add(createUVPolygonMesh(nvidiaMainUV, 22, 0x1e293b, 0, {
            title: 'NVIDIA Constellation (輝達北士科總部)', category: '國際AI科技總部'
        }, { roughness: 0.22, metalness: 0.75, bevel: true }));
        stats.totalBuildingCount++;

        for (let u = 466; u <= 566; u += 16) {
            const skylight = new THREE.Mesh(
                new THREE.BoxGeometry(10, 2.6, 38),
                new THREE.MeshStandardMaterial({ color: 0x84cc16, emissive: 0x4d7c0f, emissiveIntensity: 0.4 })
            );
            skylight.position.set(toX(u), 23.3, toZ(76));
            skylight.rotation.y = 0.06;
            layerGroups.buildings.add(skylight);
        }
        populateCurvedStreetBlock([[450, 15], [515, 13], [578, 11]], [[450, 38], [515, 36], [578, 34]], {
            cols: 5, doubleRow: false, zoneType: 'avenue_commercial', streetName: '北士科福國路科技園區'
        });
        addLabel(515, 76, 30, '🟢 NVIDIA Constellation', 'text-lime-200 bg-slate-900/90 border-lime-400/60');

        // ------------------------------------------------------------------------
        // 3. 北士科洲美段：中鼎第二總部與周邊科技商辦
        // ------------------------------------------------------------------------
        createDiverseTaiwanBuilding(184, 108, 30, 44, 52, 0, {
            shapeType: 'stepped', matKey: 'glassTower', noRooftop: true,
            title: '中鼎集團第二總部大樓 (福善路16號)', category: '企業總部地標'
        });
        createDiverseTaiwanBuilding(114, 112, 30, 34, 34, 0, {
            shapeType: 'stepped', matKey: 'highriseLuxury', title: '遠雄建設北士科新建大樓', category: '商辦大樓'
        });
        createDiverseTaiwanBuilding(74, 114, 20, 32, 11, 0, {
            shapeType: 'L', matKey: 'institutional', title: '中興巴士・光華巴士洲美站站體', category: '交通場站'
        });
        addLabel(184, 108, 58, '🏢 中鼎第二總部 & 洲美段', 'text-sky-200 bg-slate-900/90 border-sky-400/60');

        populateCurvedStreetBlock([[4, 30], [46, 30]], [[4, 68], [46, 68]], { cols: 3, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福美路西段' });
        populateCurvedStreetBlock([[62, 28], [150, 28]], [[62, 68], [150, 68]], { cols: 6, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福國路・福美路街廓' });
        populateCurvedStreetBlock([[165, 28], [232, 28]], [[165, 68], [238, 68]], { cols: 5, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福美路洲美公園側' });
        populateCurvedStreetBlock([[4, 156], [46, 156]], [[4, 222], [46, 222]], { cols: 3, doubleRow: true, zoneType: 'avenue_commercial', streetName: '承平路西側廠辦區' });
        populateCurvedStreetBlock([[62, 156], [150, 156]], [[62, 255], [150, 232]], { cols: 6, doubleRow: true, zoneType: 'luxury_highrise', streetName: '福善路・河美街北士科大樓群' });
        populateCurvedStreetBlock([[165, 156], [248, 156]], [[165, 224], [252, 198]], { cols: 5, doubleRow: true, zoneType: 'avenue_commercial', streetName: '河美街東段科技園區' });

        // ------------------------------------------------------------------------
        // 4. 台北高等行政法院、法官學院、臺北歐洲學校、文昌國小
        // ------------------------------------------------------------------------
        createDiverseTaiwanBuilding(644, 35, 38, 34, 28, 0, { shapeType: 'U', matKey: 'institutional', noRooftop: true, title: '台北高等行政法院', category: '司法機關' });
        createDiverseTaiwanBuilding(644, 78, 36, 30, 26, 0, { shapeType: 'L', matKey: 'institutional', noRooftop: true, title: '法官學院', category: '司法機關' });
        createDiverseTaiwanBuilding(714, 36, 42, 30, 20, -0.05, { shapeType: 'L', matKey: 'oldWarmTile', noRooftop: true, title: '臺北歐洲學校小學部 (TES)', category: '國際學校' });
        createDiverseTaiwanBuilding(715, 92, 16, 15, 11, 0, { shapeType: 'box', matKey: 'oldGreyStone', title: '文昌抽水站', category: '水利設施' });

        createDiverseTaiwanBuilding(782, 128, 36, 12, 15, -0.18, { shapeType: 'box', matKey: 'oldWarmTile', noRooftop: true, title: '文昌國小 北棟教學樓', category: '國民小學' });
        createDiverseTaiwanBuilding(808, 122, 13, 30, 15, -0.18, { shapeType: 'L', matKey: 'oldWarmTile', noRooftop: true, title: '文昌國小 東棟教學樓', category: '國民小學' });
        createDiverseTaiwanBuilding(766, 108, 22, 12, 13, -0.15, { shapeType: 'box', matKey: 'pinkCeramic', noRooftop: true, title: '文昌國小 活動中心', category: '國民小學' });
        addLabel(646, 38, 34, '⚖️ 高等行政法院 & 歐洲學校', 'text-amber-100 bg-slate-900/85 border-amber-400/50');

        // ------------------------------------------------------------------------
        // 5. 兒童新樂園 (雲霄飛車立體軌道、動態摩天輪、旋轉木馬、樹蛙表演場)
        // ------------------------------------------------------------------------
        const parkWallUV = [
            [374, 256], [418, 240], [462, 228], [496, 258], [526, 296],
            [490, 315], [448, 328], [410, 340], [390, 298], [374, 256]
        ];
        layerGroups.buildings.add(createUVSplineRibbon(parkWallUV, 3.2, 4.5, 0, 0x9f5845, {
            title: '兒童新樂園 弧形環園步道與隔音圍欄', category: '主題樂園設施'
        }, { closed: true }).mesh);

        // 立體雲霄飛車立體管道與鋼柱
        const coasterUV = [[392, 265], [415, 252], [438, 262], [432, 285], [405, 288], [392, 265]];
        const coasterCurve = new THREE.CatmullRomCurve3(coasterUV.map(p => new THREE.Vector3(toX(p[0]), 9 + Math.sin(p[0]*0.12)*4, toZ(p[1]))), true);
        const coasterGeo = new THREE.TubeGeometry(coasterCurve, 64, 0.5, 8, true);
        const coasterMesh = new THREE.Mesh(coasterGeo, new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.5 }));
        registerInteractive(coasterMesh, { title: '兒童新樂園「魔法星際飛車」雲霄飛車軌道', category: '遊樂設施' });
        layerGroups.buildings.add(coasterMesh);
        for (let i = 0; i < 14; i++) {
            const pt = coasterCurve.getPoint(i / 14);
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, pt.y, 6), new THREE.MeshStandardMaterial({ color: 0x64748b }));
            col.position.set(pt.x, pt.y / 2, pt.z);
            layerGroups.buildings.add(col);
        }

        // 水果摩天輪 (含支架與動態旋轉輪)
        const ferrisHolder = new THREE.Group();
        ferrisHolder.position.set(toX(422), 0, toZ(258));
        const supportMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
        [-4, 4].forEach(zOff => {
            const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 32, 8), supportMat);
            s1.position.set(-7, 15, zOff); s1.rotation.z = -0.22;
            const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 32, 8), supportMat);
            s2.position.set(7, 15, zOff); s2.rotation.z = 0.22;
            ferrisHolder.add(s1, s2);
        });

        const ferrisWheel = new THREE.Group();
        ferrisWheel.position.set(0, 29, 0);
        ferrisWheel.add(new THREE.Mesh(new THREE.TorusGeometry(18, 0.75, 10, 32), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.35 })));
        ferrisWheel.add(new THREE.Mesh(new THREE.TorusGeometry(11, 0.45, 8, 32), new THREE.MeshStandardMaterial({ color: 0x38bdf8 })));
        const cabCols = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x06b6d4, 0xa855f7, 0xec4899];
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 36, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            sp.rotation.z = ang;
            ferrisWheel.add(sp);
            const cab = new THREE.Mesh(new THREE.SphereGeometry(1.9, 10, 10), new THREE.MeshStandardMaterial({ color: cabCols[i % cabCols.length] }));
            cab.position.set(Math.cos(ang) * 18, Math.sin(ang) * 18, 0);
            registerInteractive(cab, { title: '兒童新樂園「水果摩天輪」', category: '遊樂地標' });
            ferrisWheel.add(cab);
        }
        ferrisHolder.add(ferrisWheel);
        dynamicObjects.ferrisWheelGroup = ferrisWheel;
        layerGroups.buildings.add(ferrisHolder);
        stats.totalBuildingCount++;

        // 台北樹蛙表演場與動態旋轉木馬
        const frogArena = new THREE.Mesh(new THREE.CylinderGeometry(16, 19, 11, 24), facadeMaterials.institutional);
        frogArena.position.set(toX(458), 5.5, toZ(288));
        frogArena.castShadow = true;
        registerInteractive(frogArena, { title: '台北樹蛙表演場 & 美食街大樓', category: '兒童新樂園核心建築' });
        layerGroups.buildings.add(frogArena);
        stats.totalBuildingCount++;

        const carousel = new THREE.Group();
        carousel.position.set(toX(438), 0, toZ(305));
        const cBase = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 1.2, 20), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
        cBase.position.y = 0.6;
        const cRoof = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 20), new THREE.MeshStandardMaterial({ color: 0xec4899 }));
        cRoof.position.y = 4.5;
        carousel.add(cBase, cRoof);
        dynamicObjects.carouselGroup = carousel;
        layerGroups.buildings.add(carousel);

        createDiverseTaiwanBuilding(478, 312, 24, 11, 8.5, 0.24, { shapeType: 'chamfer', matKey: 'pinkCeramic', noRooftop: true, title: '兒童新樂園 園區大門售票處' });
        createDiverseTaiwanBuilding(408, 305, 16, 26, 10.5, 0.32, { shapeType: 'L', matKey: 'institutional', noRooftop: true, title: '兒童新樂園 55號室內遊樂大樓' });
        createDiverseTaiwanBuilding(486, 268, 18, 12, 9.5, -0.45, { shapeType: 'box', matKey: 'oldWarmTile', noRooftop: true, title: '尋寶船 & 叢林吼吼樹屋站體' });
        addLabel(455, 282, 48, '🎡 兒童新樂園', 'text-amber-200 bg-rose-950/90 border-amber-400/60');

        // ------------------------------------------------------------------------
        // 6. 科教館 & 天文館 & 福佳區民活動中心
        // ------------------------------------------------------------------------
        const ntsecGroup = new THREE.Group();
        ntsecGroup.position.set(toX(538), 0, toZ(355));
        const ntsecCyl = new THREE.Mesh(new THREE.CylinderGeometry(27, 29, 28, 12), facadeMaterials.institutional);
        ntsecCyl.position.y = 14;
        ntsecCyl.castShadow = true;
        registerInteractive(ntsecCyl, { title: '國立臺灣科學教育館 (八角懸挑主館)', category: '國家級科學博物館' });
        ntsecGroup.add(ntsecCyl);

        const ntsecTop = new THREE.Mesh(new THREE.BoxGeometry(38, 10, 42), facadeMaterials.highriseLuxury);
        ntsecTop.position.set(0, 31, 0);
        ntsecTop.rotation.y = 0.35;
        ntsecTop.castShadow = true;
        ntsecGroup.add(ntsecTop);
        layerGroups.buildings.add(ntsecGroup);
        stats.totalBuildingCount++;

        createDiverseTaiwanBuilding(578, 368, 18, 15, 11, 0.45, { shapeType: 'chamfer', matKey: 'institutional', noRooftop: true, title: '科學藝術探索基地' });

        const astroPolyUV = [[618, 338], [648, 312], [676, 338], [652, 372], [618, 358]];
        layerGroups.buildings.add(createUVPolygonMesh(astroPolyUV, 20, facadeMaterials.institutional, 0, {
            title: '臺北市立天文科學教育館 (主展示館)', category: '天文博物館'
        }, { bevel: true }));
        stats.totalBuildingCount++;

        const goldDome = new THREE.Mesh(
            new THREE.SphereGeometry(13, 24, 24),
            new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.85, emissive: 0xd97706, emissiveIntensity: 0.15 })
        );
        goldDome.position.set(toX(628), 13, toZ(355));
        goldDome.castShadow = true;
        registerInteractive(goldDome, { title: '臺北市立天文館「金色宇宙劇場球體」', category: '著名建築地標' });
        layerGroups.buildings.add(goldDome);

        createDiverseTaiwanBuilding(592, 295, 18, 14, 11, -0.18, { shapeType: 'L', matKey: 'oldWarmTile', noRooftop: true, title: '福佳區民活動中心 (美崙公園內)' });
        addLabel(538, 355, 44, '🔬 科教館 & 🪐 天文館', 'text-amber-100 bg-slate-900/90 border-amber-400/60');

        // ------------------------------------------------------------------------
        // 7. 臺北市立士林高級商業職業學校 (12棟完整校舍) & 士林監理站
        // ------------------------------------------------------------------------
        const shilinHSBuildings = [
            { u: 468, v: 454, w: 32, d: 8, h: 14, rot: 0.18, name: '士林高商 信義樓' },
            { u: 465, v: 472, w: 32, d: 8, h: 14, rot: 0.18, name: '士林高商 和平樓' },
            { u: 496, v: 468, w: 24, d: 8, h: 14, rot: 0.18, name: '士林高商 仁愛樓' },
            { u: 482, v: 492, w: 34, d: 8.5, h: 14, rot: 0.18, name: '士林高商 忠孝樓' },
            { u: 478, v: 515, w: 34, d: 8.5, h: 14, rot: 0.18, name: '士林高商 力行樓' },
            { u: 515, v: 450, w: 22, d: 18, h: 18, rot: 0.18, name: '士林高商 學生活動中心' },
            { u: 525, v: 478, w: 24, d: 12, h: 16, rot: 0.18, name: '士林高商 行政大樓' },
            { u: 545, v: 462, w: 11, d: 8,  h: 7.5, rot: 0.18, name: '士林高商 傳達室' },
            { u: 518, v: 512, w: 24, d: 8.5, h: 14, rot: 0.18, name: '士林高商 圖書館' },
            { u: 548, v: 505, w: 22, d: 8.5, h: 14, rot: 0.18, name: '士林高商 耕耘軒' },
            { u: 542, v: 524, w: 22, d: 8.5, h: 14, rot: 0.18, name: '士林高商 采風樓' },
            { u: 572, v: 522, w: 22, d: 8.5, h: 14, rot: 0.18, name: '士林高商 悅聞樓' }
        ];
        shilinHSBuildings.forEach(b => {
            createDiverseTaiwanBuilding(b.u, b.v, b.w, b.d, b.h, b.rot, {
                shapeType: 'box', matKey: 'institutional', noRooftop: true, title: b.name, category: '市立士林高商校舍'
            });
        });
        addLabel(495, 485, 25, '🏫 臺北市立士林高商', 'text-amber-200 bg-slate-900/90 border-amber-400/60');

        createDiverseTaiwanBuilding(365, 438, 24, 46, 17, 0.32, { shapeType: 'L', matKey: 'pinkCeramic', title: '臺北市區監理所 士林監理站行政大樓' });
        createDiverseTaiwanBuilding(338, 418, 18, 34, 11, 0.32, { shapeType: 'box', matKey: 'institutional', title: '士林監理站 汽車檢驗線廠房' });
        createDiverseTaiwanBuilding(378, 492, 20, 26, 12, 0.32, { shapeType: 'chamfer', matKey: 'oldWarmTile', title: '士林監理站 路考看台與考驗大樓' });
        createDiverseTaiwanBuilding(408, 505, 16, 22, 14, 0.32, { shapeType: 'box', matKey: 'oldGreyStone', title: '承德路五段78號大樓' });
        createDiverseTaiwanBuilding(356, 345, 18, 16, 10, 0.28, { shapeType: 'box', matKey: 'oldGreyStone', title: '百齡抽水站' });
        addLabel(365, 438, 24, '🚗 士林監理站 (彎曲路考場)', 'text-purple-200 bg-slate-900/85 border-purple-400/50');

        // ------------------------------------------------------------------------
        // 8. 新光吳火獅紀念醫院院區群
        // ------------------------------------------------------------------------
        createDiverseTaiwanBuilding(742, 338, 46, 28, 34, 0.14, {
            shapeType: 'stepped', matKey: 'hospital', noRooftop: true, title: '新光醫院 北棟聖賢大樓', category: '醫學中心'
        });
        const skMainUV = [[702, 365], [772, 358], [778, 405], [708, 412]];
        layerGroups.buildings.add(createUVPolygonMesh(skMainUV, 44, facadeMaterials.hospital, 0, {
            title: '新光吳火獅紀念醫院 (主醫療大樓)', category: '醫學中心'
        }, { bevel: true }));
        stats.totalBuildingCount++;

        const crossMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const c1 = new THREE.Mesh(new THREE.BoxGeometry(3, 9, 1.5), crossMat);
        const c2 = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 1.5), crossMat);
        c1.position.set(toX(740), 47, toZ(385));
        c2.position.set(toX(740), 47, toZ(385));
        layerGroups.buildings.add(c1, c2);

        createDiverseTaiwanBuilding(690, 402, 20, 26, 22, 0.16, { shapeType: 'L', matKey: 'institutional', title: '新光醫院 行政室與中央研究室' });
        addLabel(740, 385, 52, '🏥 新光醫院', 'text-rose-200 bg-slate-900/90 border-rose-400/60');
    }

    ns.Landmarks = {
        buildLandmarks
    };
})(window.ShilinDrone);

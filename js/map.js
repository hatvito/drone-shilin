// ============================================================================
// js/map.js: 100% 完整還原 3d.html 的高解析底圖、蜿蜒河川堤防、公園濕地、
// 彎曲道路網(含緣石/雙黃線/捷運高架) 與 1,200+ 棟真實街廓建築
// ============================================================================
const interactiveMeshes = [];
const candidateBuildings = [];
const roadCurvesForTraffic = [];
const trafficCars = [];

let ferrisWheelGroup = null;
let carouselGroup = null;
let mrtTrainGroup = null;
let mrtCurve = null;

const FACADE_KEYS_WALKUP = ['oldGreyStone', 'oldWarmTile', 'pinkCeramic', 'redBrick', 'greenMosaic', 'ochreStucco'];
const ROOF_TIN_KEYS = ['tinGreen', 'tinDarkGreen', 'tinBlue', 'tinRed', 'tinSilver'];

function registerInteractive(mesh, info) {
    mesh.userData = {
        isInteractive: true,
        title: info.title,
        category: info.category || '都市建築',
        desc: info.desc || ''
    };
    interactiveMeshes.push(mesh);
}

function createUVPolygonMesh(uvPts, height, matOrColor, yOffset = 0, info = null, opts = {}) {
    const shape = new THREE.Shape();
    shape.moveTo(toX(uvPts[0][0]), -toZ(uvPts[0][1]));
    for (let i = 1; i < uvPts.length; i++) {
        shape.lineTo(toX(uvPts[i][0]), -toZ(uvPts[i][1]));
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: opts.bevel || false,
        bevelThickness: opts.bevel ? 0.35 : 0,
        bevelSize: opts.bevel ? 0.3 : 0,
        bevelSegments: 1
    });
    geo.rotateX(-Math.PI / 2);

    let mat;
    if (typeof matOrColor === 'number' || typeof matOrColor === 'string') {
        mat = new THREE.MeshStandardMaterial({
            color: matOrColor,
            roughness: opts.roughness !== undefined ? opts.roughness : 0.72,
            metalness: opts.metalness !== undefined ? opts.metalness : 0.12
        });
    } else {
        mat = matOrColor;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = yOffset;
    mesh.castShadow = height > 1.8;
    mesh.receiveShadow = true;

    if (info) registerInteractive(mesh, info);
    return mesh;
}

// 100% 還原 3d.html 的曲線道路與河道產生器 (包含中央分隔線與兩側立體人行道緣石 curb)
function createUVSplineRibbon(uvPts, width, height, yPos, color, info = null, opts = {}) {
    const curvePts = uvPts.map(p => new THREE.Vector3(toX(p[0]), 0, toZ(p[1])));
    const curve = new THREE.CatmullRomCurve3(curvePts, opts.closed || false, 'centripetal', opts.tension || 0.45);
    const segments = opts.segments || Math.max(64, uvPts.length * 18);
    const sampled = curve.getPoints(segments);

    const leftPts = [];
    const rightPts = [];
    const halfW = width / 2;

    for (let i = 0; i < sampled.length; i++) {
        const t = i / segments;
        const tangent = curve.getTangent(t);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const wScale = opts.widthFunc ? opts.widthFunc(t) : 1.0;
        leftPts.push(new THREE.Vector2(sampled[i].x + normal.x * halfW * wScale, -(sampled[i].z + normal.z * halfW * wScale)));
        rightPts.push(new THREE.Vector2(sampled[i].x - normal.x * halfW * wScale, -(sampled[i].z - normal.z * halfW * wScale)));
    }

    const shape = new THREE.Shape();
    shape.moveTo(leftPts[0].x, leftPts[0].y);
    for (let i = 1; i < leftPts.length; i++) shape.lineTo(leftPts[i].x, leftPts[i].y);
    for (let i = rightPts.length - 1; i >= 0; i--) shape.lineTo(rightPts[i].x, rightPts[i].y);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: opts.roughness !== undefined ? opts.roughness : 0.68,
        metalness: opts.metalness !== undefined ? opts.metalness : 0.1
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = yPos;
    mesh.receiveShadow = true;

    if (info) registerInteractive(mesh, info);

    // 順著彎曲道路鋪設中央雙黃線與車道虛線
    if (opts.centerLine) {
        const lineMat = new THREE.MeshBasicMaterial({ color: opts.centerLineColor || 0xfbbf24 });
        for (let i = 1; i < segments; i += (opts.solidCenter ? 1 : 2)) {
            const p1 = sampled[i - 1];
            const p2 = sampled[i];
            const dist = p1.distanceTo(p2);
            const dash = new THREE.Mesh(
                new THREE.BoxGeometry(opts.solidCenter ? 0.55 : 0.45, 0.08, opts.solidCenter ? dist * 1.02 : dist * 0.62),
                lineMat
            );
            dash.position.set((p1.x + p2.x) / 2, yPos + height + 0.05, (p1.z + p2.z) / 2);
            dash.lookAt(p2.x, yPos + height + 0.05, p2.z);
            mesh.add(dash);
        }
    }

    // 道路兩側灰色人行道緣石
    if (opts.curb) {
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
        for (let side of [-1, 1]) {
            for (let i = 1; i < segments; i++) {
                const p1 = sampled[i - 1];
                const p2 = sampled[i];
                const tan = curve.getTangent(i / segments);
                const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
                const dist = p1.distanceTo(p2);
                const curb = new THREE.Mesh(new THREE.BoxGeometry(0.7, height + 0.25, dist * 1.05), curbMat);
                const midX = (p1.x + p2.x) / 2 + norm.x * (halfW + 0.35) * side;
                const midZ = (p1.z + p2.z) / 2 + norm.z * (halfW + 0.35) * side;
                curb.position.set(midX, yPos + (height + 0.25) / 2, midZ);
                curb.lookAt(midX + tan.x, curb.position.y, midZ + tan.z);
                mesh.add(curb);
            }
        }
    }

    totalRoadSegments++;
    return { mesh, curve, sampled };
}

// ============================================================================
// 1. 100% 還原 3d.html 的 2048x1068 彎曲巷弄與街廓底圖紋理
// ============================================================================
function buildCurvedGroundCanvasMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1068;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#f2efe9';
    ctx.fillRect(0, 0, 1024, 534);

    function fillPolyUV(pts, fillStyle, strokeStyle = null, lineWidth = 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    }

    function strokeSmoothCurveUV(pts, width, color, dash = null) {
        if (pts.length < 2) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 0; i < pts.length - 1; i++) {
            const xc = (pts[i][0] + pts[i + 1][0]) / 2;
            const yc = (pts[i][1] + pts[i + 1][1]) / 2;
            ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        ctx.stroke();
        ctx.restore();
    }

    // 北士科西側粉紫商業/科技分區底色
    const westPinkZones = [
        [[0, 26], [50, 26], [50, 145], [0, 145]],
        [[58, 25], [154, 24], [154, 72], [58, 72]],
        [[58, 78], [154, 78], [154, 145], [58, 145]],
        [[162, 24], [225, 24], [242, 72], [162, 72]],
        [[162, 78], [242, 78], [252, 145], [162, 145]],
        [[0, 152], [50, 152], [50, 290], [0, 298]],
        [[58, 152], [154, 152], [154, 235], [58, 272]],
        [[162, 152], [252, 152], [258, 198], [162, 232]]
    ];
    westPinkZones.forEach(p => fillPolyUV(p, '#eadbe7'));

    // 北士科東側工程/科技基地底色
    fillPolyUV([[302, 16], [435, 13], [442, 128], [390, 145], [335, 165], [312, 95]], '#dfd9cf');
    fillPolyUV([[446, 12], [585, 9], [585, 110], [515, 118], [446, 126]], '#dfd9cf');

    // 司法園區、歐洲學校、文昌國小、士林高商、科教館文教底色
    fillPolyUV([[615, 5], [755, 5], [748, 108], [612, 108]], '#f5eedc');
    fillPolyUV([[752, 82], [848, 95], [842, 162], [752, 148]], '#f5eedc');
    fillPolyUV([[405, 345], [502, 322], [595, 534], [462, 534]], '#f5eedc');
    fillPolyUV([[480, 298], [652, 298], [648, 398], [538, 415]], '#f2ead8');

    // 士林監理站粉紫色園區底色與內部彎曲路考場車道
    fillPolyUV([[262, 362], [362, 330], [438, 534], [368, 534], [282, 428]], '#eadbe7', '#d8b4fe', 1);
    strokeSmoothCurveUV([[282, 372], [328, 355], [345, 395], [305, 412], [325, 448], [362, 435], [382, 488], [348, 502]], 4.5, '#cbd5e1');
    strokeSmoothCurveUV([[282, 372], [328, 355], [345, 395], [305, 412], [325, 448], [362, 435], [382, 488], [348, 502]], 1, '#ffffff', [3, 3]);

    // 原圖中所有彎曲巷弄、街廓內部窄巷與防火巷白線
    const curvedAlleys = [
        { w: 5.5, pts: [[756, 86], [795, 68], [838, 52], [878, 38]] },
        { w: 5.0, pts: [[768, 112], [812, 102], [852, 96], [892, 92]] },
        { w: 5.0, pts: [[782, 138], [828, 132], [865, 128], [902, 124]] },
        { w: 5.5, pts: [[752, 152], [798, 158], [848, 162], [892, 158], [922, 148]] },
        { w: 4.5, pts: [[822, 22], [828, 65], [836, 112], [845, 160]] },
        { w: 4.0, pts: [[858, 32], [866, 78], [872, 122], [878, 158]] },
        { w: 5.5, pts: [[905, 0], [928, 72], [955, 158], [988, 255], [1018, 345]] },
        { w: 4.5, pts: [[912, 46], [965, 34], [1024, 18]] },
        { w: 4.5, pts: [[926, 88], [975, 76], [1024, 62]] },
        { w: 4.5, pts: [[945, 138], [985, 128], [1024, 118]] },
        { w: 5.0, pts: [[665, 208], [705, 198], [748, 188]] },
        { w: 5.0, pts: [[672, 236], [712, 226], [754, 216]] },
        { w: 5.0, pts: [[678, 264], [718, 254], [760, 244]] },
        { w: 5.0, pts: [[684, 290], [725, 280], [766, 270]] },
        { w: 3.5, pts: [[712, 188], [722, 242], [732, 295]] },
        { w: 6.0, pts: [[760, 220], [808, 235], [855, 248], [908, 242], [955, 232]] },
        { w: 6.5, pts: [[690, 312], [768, 298], [845, 286], [912, 278], [968, 272]] },
        { w: 4.8, pts: [[784, 230], [798, 295], [812, 358]] },
        { w: 4.8, pts: [[812, 238], [826, 298], [840, 356]] },
        { w: 4.8, pts: [[840, 245], [854, 298], [868, 352]] },
        { w: 5.2, pts: [[884, 242], [898, 312], [912, 378], [926, 442]] },
        { w: 5.0, pts: [[856, 292], [872, 365], [888, 448]] },
        { w: 5.0, pts: [[826, 298], [842, 372], [858, 454]] },
        { w: 5.2, pts: [[788, 358], [845, 346], [905, 335], [962, 324]] },
        { w: 4.8, pts: [[796, 398], [855, 386], [915, 375], [972, 365]] },
        { w: 4.5, pts: [[805, 432], [865, 420], [925, 408], [982, 398]] },
        { w: 6.0, pts: [[546, 442], [592, 416], [636, 392]] },
        { w: 5.0, pts: [[574, 485], [620, 458], [666, 434]] },
        { w: 5.5, pts: [[604, 526], [652, 498], [698, 474]] },
        { w: 4.5, pts: [[584, 418], [614, 472], [646, 526]] },
        { w: 5.5, pts: [[792, 492], [818, 515], [838, 534]] },
        { w: 5.0, pts: [[848, 478], [856, 508], [864, 534]] },
        { w: 5.0, pts: [[902, 464], [910, 502], [918, 534]] },
        { w: 5.5, pts: [[912, 502], [965, 492], [1024, 480]] }
    ];
    curvedAlleys.forEach(a => strokeSmoothCurveUV(a.pts, a.w, '#ffffff'));

    const bikeAndParkPaths = [
        [[995, 165], [915, 185], [845, 205], [752, 182], [655, 152], [535, 160], [425, 180], [345, 208], [245, 240], [155, 275], [0, 315]],
        [[985, 142], [895, 162], [825, 175], [748, 148], [645, 120], [520, 130], [415, 148], [325, 175], [235, 205]],
        [[505, 215], [555, 195], [618, 192], [658, 222], [662, 275], [615, 305], [552, 285], [505, 215]],
        [[212, 305], [258, 285], [312, 295], [335, 325], [285, 348], [225, 332], [212, 305]]
    ];
    bikeAndParkPaths.forEach(p => strokeSmoothCurveUV(p, 1.8, '#ef4444', [4, 4]));

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const groundGeo = new THREE.BoxGeometry(IMG_W, 8, IMG_H);
    const groundMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xdfd8ce }),
        new THREE.MeshStandardMaterial({ color: 0xdfd8ce }),
        new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.88, metalness: 0.05 }),
        new THREE.MeshStandardMaterial({ color: 0xdfd8ce }),
        new THREE.MeshStandardMaterial({ color: 0xdfd8ce }),
        new THREE.MeshStandardMaterial({ color: 0xdfd8ce })
    ];
    const groundMesh = new THREE.Mesh(groundGeo, groundMaterials);
    groundMesh.position.y = -4;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
}

// ============================================================================
// 2. 100% 還原 3d.html 的蜿蜒河川與河岸水泥防洪堤防
// ============================================================================
function buildOrganicRiversAndLevees() {
    const waiShuangUV = [
        [1024, 154], [985, 165], [942, 178], [892, 192], [845, 196],
        [795, 185], [750, 165], [702, 145], [648, 134], [590, 136],
        [530, 145], [472, 155], [415, 168], [355, 185], [295, 204],
        [235, 224], [175, 250], [115, 282]
    ];

    const greenbelt = createUVSplineRibbon(waiShuangUV, 86, 0.38, 0, 0xc7ecc0, {
        title: '外雙溪蜿蜒河濱綠廊 (雙溪左右岸河濱公園)',
        category: '河濱綠帶',
        desc: '順應外雙溪自然曲流延伸的河濱綠帶，內含彎曲的紅褐色雙溪河濱自行車道。'
    }, { widthFunc: (t) => 0.85 + t * 0.35 });
    layerGroups.parks.add(greenbelt.mesh);

    const riverMain = createUVSplineRibbon(waiShuangUV, 42, 0.9, 0.15, 0x67abc7, {
        title: '外雙溪 (Wai Shuang Creek)',
        category: '自然蜿蜒河川',
        desc: '由東向西蜿蜒流經士林橋、文昌橋、建德橋、雙溪橋與洲美橋，最終匯入基隆河。'
    }, {
        roughness: 0.14,
        metalness: 0.38,
        widthFunc: (t) => 0.82 + Math.sin(t * Math.PI) * 0.18 + t * 0.28
    });
    layerGroups.rivers.add(riverMain.mesh);

    const northLeveeUV = [[935, 145], [845, 162], [752, 132], [648, 108], [530, 118], [415, 138], [335, 165], [262, 192]];
    const southLeveeUV = [[952, 205], [848, 224], [752, 198], [648, 168], [525, 178], [415, 198], [352, 222]];
    layerGroups.parks.add(createUVSplineRibbon(northLeveeUV, 2.2, 2.8, 0.2, 0x94a3b8, {
        title: '外雙溪右岸防洪堤防與堤頂步道', category: '水利設施'
    }).mesh);
    layerGroups.parks.add(createUVSplineRibbon(southLeveeUV, 2.2, 2.8, 0.2, 0x94a3b8, {
        title: '外雙溪左岸防洪堤防', category: '水利設施'
    }).mesh);

    const keelungUV = [
        [0, 282], [85, 272], [155, 258], [202, 272], [206, 308],
        [192, 348], [185, 385], [208, 422], [255, 472], [318, 534],
        [152, 534], [95, 465], [45, 415], [0, 392]
    ];
    layerGroups.rivers.add(createUVPolygonMesh(keelungUV, 0.9, 0x5fa3c0, 0.12, {
        title: '基隆河 (Keelung River) 與雙溪匯流口',
        category: '主要河川'
    }, { roughness: 0.14, metalness: 0.38 }));

    const choumeiCanalUV = [[215, 0], [235, 32], [256, 68], [268, 108], [264, 148], [256, 182], [265, 215]];
    layerGroups.parks.add(createUVSplineRibbon(choumeiCanalUV, 36, 0.4, 0, 0xbfe8b9, {
        title: '洲美蜆仔港生態河岸公園', category: '親水綠帶'
    }).mesh);
    layerGroups.rivers.add(createUVSplineRibbon(choumeiCanalUV, 11.5, 0.92, 0.18, 0x67abc7, {
        title: '洲美蜆仔港彎曲水道', category: '自然支流'
    }).mesh);

    const jiandeCanalUV = [[608, 0], [602, 32], [594, 62], [602, 92], [596, 118], [588, 142]];
    layerGroups.rivers.add(createUVSplineRibbon(jiandeCanalUV, 11.5, 0.92, 0.18, 0x67abc7, {
        title: '磺港溪 / 軟橋段彎曲水路', category: '河道支流'
    }).mesh);

    addUVLabel(530, 145, 7, '🌊 外雙溪 (自然蜿蜒河道)', 'text-sky-100 bg-sky-900/85 border-sky-400/50');
    addUVLabel(165, 480, 7, '🌊 基隆河匯流口', 'text-sky-100 bg-sky-900/85 border-sky-400/50');
}

// ============================================================================
// 3. 100% 還原 3d.html 的公園、濕地生態池與跑道
// ============================================================================
function buildParksWetlandsAndCurvedPaths() {
    const meilunUV = [
        [476, 205], [545, 185], [622, 178], [662, 202], [676, 255],
        [685, 298], [635, 312], [582, 325], [538, 285], [498, 238]
    ];
    layerGroups.parks.add(createUVPolygonMesh(meilunUV, 0.9, 0xc3ecb8, 0, {
        title: '美崙公園 (洲尾頭)', category: '大型都市公園'
    }));

    const hillUV = [[568, 218], [615, 208], [646, 224], [648, 256], [608, 268], [572, 252]];
    layerGroups.parks.add(createUVPolygonMesh(hillUV, 2.5, 0xb0e0a2, 0));

    const wetlandUV = [
        [198, 286], [268, 262], [338, 245], [356, 292], [362, 330],
        [298, 355], [248, 365], [202, 342], [190, 312]
    ];
    layerGroups.parks.add(createUVPolygonMesh(wetlandUV, 0.85, 0xc3ecb8, 0, {
        title: '雙溪濕地公園 (含生態池與水中步道)', category: '生態濕地公園'
    }));

    const pond1UV = [[228, 298], [268, 282], [308, 276], [318, 298], [285, 315], [238, 318]];
    const pond2UV = [[262, 325], [305, 312], [338, 306], [346, 332], [312, 348], [270, 352]];
    layerGroups.rivers.add(createUVPolygonMesh(pond1UV, 1.12, 0x67abc7, 0));
    layerGroups.rivers.add(createUVPolygonMesh(pond2UV, 1.12, 0x67abc7, 0));

    layerGroups.parks.add(createUVPolygonMesh([[212, 398], [278, 422], [365, 534], [292, 534], [208, 445]], 0.8, 0xbbe7b3, 0));
    layerGroups.parks.add(createUVPolygonMesh([[0, 405], [95, 445], [155, 534], [0, 534]], 0.8, 0xc3ecb8, 0));
    layerGroups.parks.add(createUVPolygonMesh([[410, 352], [478, 336], [505, 435], [435, 448]], 0.9, 0xc8f0be, 0));
    layerGroups.parks.add(createUVPolygonMesh([[668, 62], [705, 62], [705, 98], [668, 98]], 0.95, 0x6ee7b7, 0));
    layerGroups.parks.add(createUVPolygonMesh([[852, 345], [892, 338], [896, 368], [856, 375]], 0.95, 0xb8e8ad, 0));
    layerGroups.parks.add(createUVPolygonMesh([[868, 488], [902, 482], [908, 528], [874, 532]], 0.95, 0x7dd3ae, 0));

    // 士林高商橢圓跑道
    const ovalTrack = new THREE.Mesh(
        new THREE.RingGeometry(14.5, 21.5, 36),
        new THREE.MeshStandardMaterial({ color: 0x4ade80, side: THREE.DoubleSide })
    );
    ovalTrack.rotation.x = -Math.PI / 2;
    ovalTrack.scale.set(1.45, 0.82, 1);
    ovalTrack.position.set(toX(468), 1.08, toZ(415));
    layerGroups.parks.add(ovalTrack);
}

// ============================================================================
// 4. 100% 還原 3d.html 的真實彎曲道路網、跨河大橋與捷運高架
// ============================================================================
function buildRealisticCurvedRoadNetwork() {
    // 1. 承德路六段 -> 雙溪橋 -> 承德路五段
    const chengdeUV = [
        [290, 0], [298, 48], [308, 98], [320, 148], [335, 196],
        [354, 260], [376, 330], [398, 392], [422, 458], [452, 534]
    ];
    const chengde = createUVSplineRibbon(chengdeUV, 21.5, 1.15, 0.1, 0xfbbf24, {
        title: '承德路六段・雙溪橋・承德路五段 (省道台2乙線)', category: '省道主幹道'
    }, { centerLine: true, solidCenter: true, centerLineColor: 0xfef3c7, curb: true });
    layerGroups.roads.add(chengde.mesh);
    roadCurvesForTraffic.push({ curve: chengde.curve, count: 22, offset: 4.8 });

    for (let side of [-11.5, 11.5]) {
        const rail = createUVSplineRibbon([[318, 142], [335, 196], [350, 245]], 1.2, 2.6, 0.5, 0xe2e8f0);
        rail.mesh.position.x += side;
        layerGroups.roads.add(rail.mesh);
    }

    // 2. 文林北路 -> 文昌橋 -> 文昌路 (S型跨河彎道)
    const wenchangUV = [
        [816, 0], [790, 38], [765, 76], [748, 114], [742, 152],
        [745, 186], [755, 226], [768, 272], [782, 325], [798, 382],
        [816, 435], [835, 482]
    ];
    const wenchang = createUVSplineRibbon(wenchangUV, 13.5, 1.12, 0.1, 0xfde047, {
        title: '文林北路・文昌橋・文昌路 (S型跨河彎道)', category: '主要彎曲幹道與橋樑'
    }, { centerLine: true, centerLineColor: 0xd97706, curb: true });
    layerGroups.roads.add(wenchang.mesh);
    roadCurvesForTraffic.push({ curve: wenchang.curve, count: 14, offset: 3.2 });

    // 3. 基河路
    const jiheUV = [
        [356, 250], [398, 236], [442, 224], [468, 224], [488, 238],
        [512, 270], [542, 305], [578, 342], [618, 386], [658, 434],
        [695, 485], [730, 534]
    ];
    const jihe = createUVSplineRibbon(jiheUV, 11.5, 1.02, 0.1, 0xffffff, {
        title: '基河路 (Jihe Rd 弧形景觀道路)', category: '次要主幹道'
    }, { centerLine: true, centerLineColor: 0x94a3b8, curb: true });
    layerGroups.roads.add(jihe.mesh);
    roadCurvesForTraffic.push({ curve: jihe.curve, count: 12, offset: 2.8 });

    // 4. 承德路五段150巷 -> 洲美二號橋 -> 通河東街二段 (大C型彎道)
    const tongheUV = [
        [350, 252], [302, 266], [248, 282], [212, 298], [194, 322],
        [192, 352], [208, 382], [242, 412], [285, 448], [328, 492], [366, 534]
    ];
    const tonghe = createUVSplineRibbon(tongheUV, 10.5, 1.0, 0.1, 0xffffff, {
        title: '承德路五段150巷・洲美二號橋・通河東街二段 (大C型河岸彎道)', category: '河岸彎曲道路'
    }, { centerLine: true, centerLineColor: 0xcbd5e1, curb: true });
    layerGroups.roads.add(tonghe.mesh);
    roadCurvesForTraffic.push({ curve: tonghe.curve, count: 10, offset: 2.5 });

    // 5. 軟橋街 -> 建德橋 -> 文林北路5巷
    const ruanqiaoRiverUV = [
        [330, 168], [378, 150], [435, 132], [495, 120], [552, 114],
        [605, 112], [658, 110], [708, 112], [748, 116]
    ];
    layerGroups.roads.add(createUVSplineRibbon(ruanqiaoRiverUV, 10.0, 0.98, 0.1, 0xffffff, {
        title: '軟橋街・建德橋・文林北路5巷', category: '河岸道路與橋樑'
    }, { curb: true }).mesh);

    // 6. 河美街
    const hemeiUV = [[0, 298], [54, 278], [112, 255], [168, 232], [222, 212], [268, 196], [330, 170]];
    layerGroups.roads.add(createUVSplineRibbon(hemeiUV, 9.5, 0.95, 0.1, 0xffffff, {
        title: '河美街', category: '市區道路'
    }, { curb: true }).mesh);

    // 7. 士商路
    const shishangUV = [
        [378, 338], [435, 326], [488, 314], [506, 338], [535, 392],
        [568, 445], [598, 495], [624, 534]
    ];
    layerGroups.roads.add(createUVSplineRibbon(shishangUV, 10.5, 1.0, 0.1, 0xffffff, {
        title: '士商路 (Shishang Rd)', category: '次要主幹道'
    }, { centerLine: true, centerLineColor: 0xcbd5e1, curb: true }).mesh);

    // 8. 文林路 & 士林橋
    const wenlinUV = [
        [852, 0], [878, 48], [904, 98], [928, 145], [948, 186],
        [960, 235], [970, 292], [982, 355], [994, 422], [1008, 495]
    ];
    const wenlin = createUVSplineRibbon(wenlinUV, 12.5, 1.08, 0.1, 0xffffff, {
        title: '文林路 & 士林橋', category: '主要幹道'
    }, { centerLine: true, centerLineColor: 0xfbbf24, curb: true });
    layerGroups.roads.add(wenlin.mesh);
    roadCurvesForTraffic.push({ curve: wenlin.curve, count: 10, offset: 3.0 });

    // 9. 中正路
    const zhongzhengUV = [[762, 534], [798, 506], [835, 482], [885, 468], [942, 454], [988, 442], [1024, 432]];
    const zhongzheng = createUVSplineRibbon(zhongzhengUV, 16.0, 1.12, 0.1, 0xfde047, {
        title: '士林中正路', category: '東西向主幹道'
    }, { centerLine: true, solidCenter: true, centerLineColor: 0xd97706, curb: true });
    layerGroups.roads.add(zhongzheng.mesh);
    roadCurvesForTraffic.push({ curve: zhongzheng.curve, count: 10, offset: 3.8 });

    // 10. 北士科內部街廓道路
    const northRoads = [
        { uv: [[0, 22], [150, 19], [295, 16], [445, 12], [595, 8]], w: 12, name: '福國路' },
        { uv: [[0, 75], [85, 75], [165, 75], [242, 76]], w: 9, name: '福美路' },
        { uv: [[0, 148], [85, 148], [168, 148], [252, 150]], w: 9, name: '福善路' },
        { uv: [[54, 22], [54, 110], [54, 195], [54, 278]], w: 9, name: '承平路' },
        { uv: [[158, 22], [158, 95], [158, 165], [158, 232]], w: 9, name: '承信路' },
        { uv: [[440, 12], [441, 70], [442, 128]], w: 8.5, name: '十號路' },
        { uv: [[588, 10], [587, 62], [585, 112]], w: 9, name: '軟橋街北段' }
    ];
    northRoads.forEach(r => {
        layerGroups.roads.add(createUVSplineRibbon(r.uv, r.w, 0.95, 0.08, 0xffffff, {
            title: r.name, category: '北士科道路'
        }, { curb: true }).mesh);
    });

    // 11. 台北捷運淡水信義線高架段與橋墩
    const mrtUV = [[898, 0], [918, 55], [938, 110], [958, 162], [978, 215], [1000, 275], [1022, 335]];
    const mrtViaduct = createUVSplineRibbon(mrtUV, 9.5, 2.8, 13.5, 0xcbd5e1, {
        title: '台北捷運淡水信義線 (弧形高架軌道)', category: '大眾捷運系統'
    });
    mrtCurve = mrtViaduct.curve;
    layerGroups.roads.add(mrtViaduct.mesh);
    layerGroups.roads.add(createUVSplineRibbon(mrtUV, 10.4, 0.9, 15.8, 0xe11d48).mesh);

    for (let i = 0; i <= 15; i++) {
        const pt = mrtCurve.getPoint(i / 15);
        const pier = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 1.9, 13.5, 10),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
        );
        pier.position.set(pt.x, 6.75, pt.z);
        pier.castShadow = true;
        layerGroups.roads.add(pier);
    }
}

// ============================================================================
// 5. 建築生成核心與 1,200+ 棟真實街廓完整列表
// ============================================================================
function pickRealisticHeight(zoneType = 'mixed_alley', isCorner = false) {
    const r = seededRandom();
    if (zoneType === 'old_walkup') {
        if (r < 0.12) return randRange(4.8, 7.8);
        if (r < 0.78) return randRange(12.2, 17.8);
        return randRange(21.0, 29.5);
    } else if (zoneType === 'avenue_commercial') {
        if (r < 0.15) return randRange(7.5, 13.5);
        if (r < 0.65) return randRange(18.0, 31.0);
        return randRange(32.0, 46.0);
    } else if (zoneType === 'luxury_highrise') {
        if (r < 0.25) return randRange(13.5, 18.5);
        if (r < 0.60) return randRange(26.0, 38.0);
        return randRange(42.0, 62.0);
    } else {
        if (r < 0.10) return randRange(5.0, 8.5);
        if (r < 0.68) return randRange(12.8, 18.2);
        if (r < 0.90) return randRange(20.5, 29.0);
        return randRange(30.0, 38.0);
    }
}

function pickMaterialByHeight(h) {
    if (h > 36) return seededRandom() > 0.4 ? 'highriseLuxury' : 'glassTower';
    if (h > 21) return seededRandom() > 0.35 ? 'midriseMansion' : 'pinkCeramic';
    return FACADE_KEYS_WALKUP[Math.floor(seededRandom() * FACADE_KEYS_WALKUP.length)];
}

function createDiverseTaiwanBuilding(u, v, w, d, h, rotRad, opts = {}) {
    const group = new THREE.Group();
    const x = toX(u);
    const z = toZ(v);
    group.position.set(x, 0, z);
    group.rotation.y = rotRad;

    const shapeType = opts.shapeType || 'box';
    const matKey = opts.matKey || FACADE_KEYS_WALKUP[Math.floor(seededRandom() * FACADE_KEYS_WALKUP.length)];
    const wallMat = facadeMaterials[matKey] || facadeMaterials.oldGreyStone;
    const roofMat = opts.roofMat || (seededRandom() > 0.5 ? roofMaterials.concrete : roofMaterials.darkConcrete);

    const floors = Math.max(1, Math.round(h / 3.2));
    const defaultInfo = opts.info || {
        title: opts.title || `士林街廓建築 (${floors}層樓・高約${Math.round(h)}m)`,
        category: opts.category || (floors <= 2 ? '街角透天/店鋪' : (floors <= 5 ? '台灣步登老公寓 (含防火巷)' : (floors <= 11 ? '退縮式電梯華廈' : '高層住宅/商辦大樓'))),
        desc: opts.desc || `座落於原圖座標 (${Math.round(u)}, ${Math.round(v)})，基地約 ${Math.round(w*1.9)}m × ${Math.round(d*1.9)}m，順應彎曲街廓排列並保留真實防火巷間隙。`
    };

    let mainMesh;
    let topHeight = h;

    if (shapeType === 'L' || shapeType === 'chamfer') {
        const s = new THREE.Shape();
        const hw = w / 2, hd = d / 2;
        if (shapeType === 'L') {
            const cutW = w * 0.42, cutD = d * 0.42;
            s.moveTo(-hw, -hd); s.lineTo(hw, -hd); s.lineTo(hw, hd - cutD);
            s.lineTo(hw - cutW, hd - cutD); s.lineTo(hw - cutW, hd); s.lineTo(-hw, hd);
        } else {
            const ch = Math.min(w, d) * 0.28;
            s.moveTo(-hw, -hd); s.lineTo(hw - ch, -hd); s.lineTo(hw, -hd + ch);
            s.lineTo(hw, hd); s.lineTo(-hw, hd);
        }
        s.closePath();
        const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        mainMesh = new THREE.Mesh(geo, [wallMat, roofMat]);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        registerInteractive(mainMesh, defaultInfo);
        group.add(mainMesh);
    } else if (shapeType === 'stepped' && h > 18) {
        const podiumH = Math.min(9.5, h * 0.3);
        const podiumGeo = new THREE.BoxGeometry(w, podiumH, d);
        const podiumMesh = new THREE.Mesh(podiumGeo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        podiumMesh.position.y = podiumH / 2;
        podiumMesh.castShadow = true;
        podiumMesh.receiveShadow = true;
        registerInteractive(podiumMesh, defaultInfo);
        group.add(podiumMesh);

        const towerW = w * 0.78;
        const towerD = d * 0.78;
        const towerH = h - podiumH;
        const towerGeo = new THREE.BoxGeometry(towerW, towerH, towerD);
        mainMesh = new THREE.Mesh(towerGeo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        mainMesh.position.set((seededRandom() - 0.5) * (w * 0.12), podiumH + towerH / 2, (seededRandom() - 0.5) * (d * 0.12));
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        registerInteractive(mainMesh, defaultInfo);
        group.add(mainMesh);
    } else {
        const boxGeo = new THREE.BoxGeometry(w, h, d);
        mainMesh = new THREE.Mesh(boxGeo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        mainMesh.position.y = h / 2;
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        registerInteractive(mainMesh, defaultInfo);
        group.add(mainMesh);
    }

    totalBuildingCount++;

    if (!opts.noRooftop && w >= 4.2 && d >= 4.2) {
        const roofGroup = new THREE.Group();
        roofGroup.position.set(x, h, z);
        roofGroup.rotation.y = rotRad;

        const rSeed = seededRandom();
        if (h >= 10 && h <= 23 && rSeed < 0.74) {
            const tinMat = roofMaterials[ROOF_TIN_KEYS[Math.floor(seededRandom() * ROOF_TIN_KEYS.length)]];
            const addonW = w * randRange(0.65, 0.86);
            const addonD = d * randRange(0.65, 0.86);
            const addonH = randRange(2.2, 3.4);
            const addonMesh = new THREE.Mesh(new THREE.BoxGeometry(addonW, addonH, addonD), tinMat);
            addonMesh.position.set((seededRandom() - 0.5) * (w - addonW) * 0.5, addonH / 2, (seededRandom() - 0.5) * (d - addonD) * 0.5);
            addonMesh.castShadow = true;
            roofGroup.add(addonMesh);
            topHeight += addonH;
        } else if (h > 23) {
            const phW = Math.min(w * 0.42, 7.5);
            const phD = Math.min(d * 0.42, 7.5);
            const phH = randRange(3.2, 5.2);
            const phMesh = new THREE.Mesh(new THREE.BoxGeometry(phW, phH, phD), wallMat);
            phMesh.position.set(0, phH / 2, 0);
            phMesh.castShadow = true;
            roofGroup.add(phMesh);
            topHeight += phH;
        }

        if (rSeed > 0.2) {
            const tankMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
            const numTanks = rSeed > 0.65 ? 2 : 1;
            for (let t = 0; t < numTanks; t++) {
                const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.55, 7), tankMat);
                tank.position.set((t === 0 ? 1 : -1) * (w * 0.24), 0.8, (seededRandom() - 0.5) * (d * 0.4));
                roofGroup.add(tank);
            }
        }
        layerGroups.rooftops.add(roofGroup);
    }

    layerGroups.buildings.add(group);

    if (w >= 4.5 && d >= 4.5 && h >= 6.0) {
        candidateBuildings.push({
            group: group,
            mesh: mainMesh,
            center: new THREE.Vector3(x, 0, z),
            roofY: topHeight,
            title: defaultInfo.title
        });
    }

    return group;
}

function populateCurvedStreetBlock(topUVs, botUVs, opts = {}) {
    const topCurve = new THREE.CatmullRomCurve3(topUVs.map(p => new THREE.Vector3(p[0], 0, p[1])));
    const botCurve = new THREE.CatmullRomCurve3(botUVs.map(p => new THREE.Vector3(p[0], 0, p[1])));

    const blockLen = topCurve.getLength();
    const cols = opts.cols || Math.max(3, Math.floor(blockLen / (opts.avgWidth || 10.5)));
    const doubleRow = opts.doubleRow !== undefined ? opts.doubleRow : true;
    const fireAlleyGap = opts.fireAlleyGap || 2.2;
    const sideGapBase = opts.sideGap || 1.4;

    for (let c = 0; c < cols; c++) {
        const tStart = c / cols;
        const tEnd = (c + 1) / cols;
        const tMid = (tStart + tEnd) / 2;

        const pTop1 = topCurve.getPoint(tStart);
        const pTop2 = topCurve.getPoint(tEnd);
        const pTopMid = topCurve.getPoint(tMid);

        const pBot1 = botCurve.getPoint(tStart);
        const pBot2 = botCurve.getPoint(tEnd);
        const pBotMid = botCurve.getPoint(tMid);

        const dxTop = pTop2.x - pTop1.x;
        const dzTop = pTop2.z - pTop1.z;
        const rotTop = -Math.atan2(dzTop, dxTop);

        const dxBot = pBot2.x - pBot1.x;
        const dzBot = pBot2.z - pBot1.z;
        const rotBot = -Math.atan2(dzBot, dxBot);

        const segWTop = Math.hypot(dxTop, dzTop);
        const segWBot = Math.hypot(dxBot, dzBot);
        const totalDepth = Math.hypot(pBotMid.x - pTopMid.x, pBotMid.z - pTopMid.z);

        const extraAlley = (c > 0 && c < cols - 1 && seededRandom() < 0.22) ? 2.4 : 0;
        const wTop = Math.max(4.2, segWTop - sideGapBase - extraAlley);
        const wBot = Math.max(4.2, segWBot - sideGapBase - extraAlley);

        if (doubleRow && totalDepth > 13) {
            const depthEach = (totalDepth - fireAlleyGap) / 2;
            const d1 = Math.max(4.5, depthEach * randRange(0.84, 0.98));
            const d2 = Math.max(4.5, depthEach * randRange(0.84, 0.98));

            const u1 = pTopMid.x + (pBotMid.x - pTopMid.x) * (d1 / (2 * totalDepth));
            const v1 = pTopMid.z + (pBotMid.z - pTopMid.z) * (d1 / (2 * totalDepth));
            const u2 = pBotMid.x + (pTopMid.x - pBotMid.x) * (d2 / (2 * totalDepth));
            const v2 = pBotMid.z + (pTopMid.z - pBotMid.z) * (d2 / (2 * totalDepth));

            const isCorner = (c === 0 || c === cols - 1);
            const h1 = pickRealisticHeight(opts.zoneType, isCorner);
            const h2 = pickRealisticHeight(opts.zoneType, isCorner);

            const shape1 = isCorner && seededRandom() < 0.55 ? 'chamfer' : (h1 > 22 ? 'stepped' : (seededRandom() < 0.25 ? 'L' : 'box'));
            const shape2 = isCorner && seededRandom() < 0.55 ? 'chamfer' : (h2 > 22 ? 'stepped' : (seededRandom() < 0.25 ? 'L' : 'box'));

            createDiverseTaiwanBuilding(u1, v1, wTop, d1, h1, rotTop, {
                shapeType: shape1,
                matKey: pickMaterialByHeight(h1),
                title: `${opts.streetName || '士林街廓'} ${Math.round(h1 / 3.2)}層樓建築`,
                category: opts.category || '密集住宅街廓'
            });

            createDiverseTaiwanBuilding(u2, v2, wBot, d2, h2, rotBot, {
                shapeType: shape2,
                matKey: pickMaterialByHeight(h2),
                title: `${opts.streetName || '士林街廓'} ${Math.round(h2 / 3.2)}層樓建築`,
                category: opts.category || '密集住宅街廓'
            });
        } else {
            const uMid = (pTopMid.x + pBotMid.x) / 2;
            const vMid = (pTopMid.z + pBotMid.z) / 2;
            const dSingle = Math.max(4.5, totalDepth * randRange(0.82, 0.95));
            const isCorner = (c === 0 || c === cols - 1);
            const h = pickRealisticHeight(opts.zoneType, isCorner);

            createDiverseTaiwanBuilding(uMid, vMid, (wTop + wBot) / 2, dSingle, h, rotTop, {
                shapeType: isCorner ? 'chamfer' : (h > 22 ? 'stepped' : 'box'),
                matKey: pickMaterialByHeight(h),
                title: `${opts.streetName || '士林街廓'} ${Math.round(h / 3.2)}層樓建築`,
                category: opts.category || '密集住宅街廓'
            });
        }
    }
}

function buildLandmarksAnd1200DiverseBuildings() {
    // 1. 金仁寶營運總部大樓
    const kinpoFootprintUV = [[335, 44], [424, 40], [428, 120], [385, 134], [348, 142], [336, 92]];
    layerGroups.buildings.add(createUVPolygonMesh(kinpoFootprintUV, 14, facadeMaterials.midriseMansion, 0, {
        title: '金仁寶營運總部大樓 (複合商業裙樓)', category: '北士科旗艦總部'
    }, { bevel: true }));
    totalBuildingCount++;

    createDiverseTaiwanBuilding(374, 76, 34, 30, 72, 0.08, {
        shapeType: 'chamfer', matKey: 'glassTower', noRooftop: true,
        title: '金仁寶營運總部大樓 (主摩天塔樓 72m)', category: '摩天企業總部'
    });
    createDiverseTaiwanBuilding(402, 106, 26, 24, 46, 0.08, {
        shapeType: 'stepped', matKey: 'highriseLuxury', noRooftop: true,
        title: '金仁寶營運總部大樓 (南翼塔樓)', category: '企業總部'
    });
    addUVLabel(376, 80, 78, '🏗️ 金仁寶營運總部大樓', 'text-cyan-100 bg-slate-900/90 border-cyan-400/60');

    // 2. NVIDIA Constellation 輝達北士科星群園區
    const nvidiaMainUV = [[452, 52], [576, 46], [578, 96], [515, 102], [454, 106]];
    layerGroups.buildings.add(createUVPolygonMesh(nvidiaMainUV, 22, 0x1e293b, 0, {
        title: 'NVIDIA Constellation (輝達北士科總部)', category: '國際AI科技總部'
    }, { roughness: 0.22, metalness: 0.75, bevel: true }));
    totalBuildingCount++;

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
    addUVLabel(515, 76, 30, '🟢 NVIDIA Constellation', 'text-lime-200 bg-slate-900/90 border-lime-400/60');

    // 3. 北士科洲美段：中鼎第二總部與周邊街廓
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
    addUVLabel(184, 108, 58, '🏢 中鼎第二總部 & 洲美段', 'text-sky-200 bg-slate-900/90 border-sky-400/60');

    populateCurvedStreetBlock([[4, 30], [46, 30]], [[4, 68], [46, 68]], { cols: 3, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福美路西段' });
    populateCurvedStreetBlock([[62, 28], [150, 28]], [[62, 68], [150, 68]], { cols: 6, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福國路・福美路街廓' });
    populateCurvedStreetBlock([[165, 28], [232, 28]], [[165, 68], [238, 68]], { cols: 5, doubleRow: true, zoneType: 'avenue_commercial', streetName: '福美路洲美公園側' });
    populateCurvedStreetBlock([[4, 156], [46, 156]], [[4, 222], [46, 222]], { cols: 3, doubleRow: true, zoneType: 'avenue_commercial', streetName: '承平路西側廠辦區' });
    populateCurvedStreetBlock([[62, 156], [150, 156]], [[62, 255], [150, 232]], { cols: 6, doubleRow: true, zoneType: 'luxury_highrise', streetName: '福善路・河美街北士科大樓群' });
    populateCurvedStreetBlock([[165, 156], [248, 156]], [[165, 224], [252, 198]], { cols: 5, doubleRow: true, zoneType: 'avenue_commercial', streetName: '河美街東段科技園區' });

    // 4. 台北高等行政法院、法官學院、臺北歐洲學校、文昌國小
    createDiverseTaiwanBuilding(644, 35, 38, 34, 28, 0, { shapeType: 'U', matKey: 'institutional', noRooftop: true, title: '台北高等行政法院', category: '司法機關' });
    createDiverseTaiwanBuilding(644, 78, 36, 30, 26, 0, { shapeType: 'L', matKey: 'institutional', noRooftop: true, title: '法官學院', category: '司法機關' });
    createDiverseTaiwanBuilding(714, 36, 42, 30, 20, -0.05, { shapeType: 'L', matKey: 'oldWarmTile', noRooftop: true, title: '臺北歐洲學校小學部 (TES)', category: '國際學校' });
    createDiverseTaiwanBuilding(715, 92, 16, 15, 11, 0, { shapeType: 'box', matKey: 'oldGreyStone', title: '文昌抽水站', category: '水利設施' });

    createDiverseTaiwanBuilding(782, 128, 36, 12, 15, -0.18, { shapeType: 'box', matKey: 'oldWarmTile', noRooftop: true, title: '文昌國小 北棟教學樓', category: '國民小學' });
    createDiverseTaiwanBuilding(808, 122, 13, 30, 15, -0.18, { shapeType: 'L', matKey: 'oldWarmTile', noRooftop: true, title: '文昌國小 東棟教學樓', category: '國民小學' });
    createDiverseTaiwanBuilding(766, 108, 22, 12, 13, -0.15, { shapeType: 'box', matKey: 'pinkCeramic', noRooftop: true, title: '文昌國小 活動中心', category: '國民小學' });
    addUVLabel(646, 38, 34, '⚖️ 高等行政法院 & 歐洲學校', 'text-amber-100 bg-slate-900/85 border-amber-400/50');

    // 5. 兒童新樂園 (完整環園圍牆、雲霄飛車立體軌道、雙圈摩天輪、旋轉木馬、樹蛙表演場、各場館)
    const parkWallUV = [
        [374, 256], [418, 240], [462, 228], [496, 258], [526, 296],
        [490, 315], [448, 328], [410, 340], [390, 298], [374, 256]
    ];
    layerGroups.buildings.add(createUVSplineRibbon(parkWallUV, 3.2, 4.5, 0, 0x9f5845, {
        title: '兒童新樂園 弧形環園步道與隔音圍欄', category: '主題樂園設施'
    }, { closed: true }).mesh);

    // 立體雲霄飛車軌道與支柱
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

    // 水果摩天輪
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
    ferrisWheelGroup = new THREE.Group();
    ferrisWheelGroup.position.set(0, 29, 0);
    ferrisWheelGroup.add(new THREE.Mesh(new THREE.TorusGeometry(18, 0.75, 10, 32), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.35 })));
    ferrisWheelGroup.add(new THREE.Mesh(new THREE.TorusGeometry(11, 0.45, 8, 32), new THREE.MeshStandardMaterial({ color: 0x38bdf8 })));
    const cabCols = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x06b6d4, 0xa855f7, 0xec4899];
    for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 36, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        sp.rotation.z = ang;
        ferrisWheelGroup.add(sp);
        const cab = new THREE.Mesh(new THREE.SphereGeometry(1.9, 10, 10), new THREE.MeshStandardMaterial({ color: cabCols[i % cabCols.length] }));
        cab.position.set(Math.cos(ang) * 18, Math.sin(ang) * 18, 0);
        registerInteractive(cab, { title: '兒童新樂園「水果摩天輪」', category: '遊樂地標' });
        ferrisWheelGroup.add(cab);
    }
    ferrisHolder.add(ferrisWheelGroup);
    layerGroups.buildings.add(ferrisHolder);
    totalBuildingCount++;

    // 樹蛙表演場與旋轉木馬
    const frogArena = new THREE.Mesh(new THREE.CylinderGeometry(16, 19, 11, 24), facadeMaterials.institutional);
    frogArena.position.set(toX(458), 5.5, toZ(288));
    frogArena.castShadow = true;
    registerInteractive(frogArena, { title: '台北樹蛙表演場 & 美食街大樓', category: '兒童新樂園核心建築' });
    layerGroups.buildings.add(frogArena);
    totalBuildingCount++;

    carouselGroup = new THREE.Group();
    carouselGroup.position.set(toX(438), 0, toZ(305));
    const cBase = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 1.2, 20), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
    cBase.position.y = 0.6;
    const cRoof = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 20), new THREE.MeshStandardMaterial({ color: 0xec4899 }));
    cRoof.position.y = 4.5;
    carouselGroup.add(cBase, cRoof);
    layerGroups.buildings.add(carouselGroup);

    createDiverseTaiwanBuilding(478, 312, 24, 11, 8.5, 0.24, { shapeType: 'chamfer', matKey: 'pinkCeramic', noRooftop: true, title: '兒童新樂園 園區大門售票處' });
    createDiverseTaiwanBuilding(408, 305, 16, 26, 10.5, 0.32, { shapeType: 'L', matKey: 'institutional', noRooftop: true, title: '兒童新樂園 55號室內遊樂大樓' });
    createDiverseTaiwanBuilding(486, 268, 18, 12, 9.5, -0.45, { shapeType: 'box', matKey: 'oldWarmTile', noRooftop: true, title: '尋寶船 & 叢林吼吼樹屋站體' });
    addUVLabel(455, 282, 48, '🎡 兒童新樂園', 'text-amber-200 bg-rose-950/90 border-amber-400/60');

    // 6. 科教館 & 天文館 & 福佳區民活動中心
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
    totalBuildingCount++;

    createDiverseTaiwanBuilding(578, 368, 18, 15, 11, 0.45, { shapeType: 'chamfer', matKey: 'institutional', noRooftop: true, title: '科學藝術探索基地' });

    const astroPolyUV = [[618, 338], [648, 312], [676, 338], [652, 372], [618, 358]];
    layerGroups.buildings.add(createUVPolygonMesh(astroPolyUV, 20, facadeMaterials.institutional, 0, {
        title: '臺北市立天文科學教育館 (主展示館)', category: '天文博物館'
    }, { bevel: true }));
    totalBuildingCount++;

    const goldDome = new THREE.Mesh(
        new THREE.SphereGeometry(13, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.85, emissive: 0xd97706, emissiveIntensity: 0.15 })
    );
    goldDome.position.set(toX(628), 13, toZ(355));
    goldDome.castShadow = true;
    registerInteractive(goldDome, { title: '臺北市立天文館「金色宇宙劇場球體」', category: '著名建築地標' });
    layerGroups.buildings.add(goldDome);

    createDiverseTaiwanBuilding(592, 295, 18, 14, 11, -0.18, { shapeType: 'L', matKey: 'oldWarmTile', noRooftop: true, title: '福佳區民活動中心 (美崙公園內)' });
    addUVLabel(538, 355, 44, '🔬 科教館 & 🪐 天文館', 'text-amber-100 bg-slate-900/90 border-amber-400/60');

    // 7. 臺北市立士林高商 (12棟完整校舍) & 士林監理站園區
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
    addUVLabel(495, 485, 25, '🏫 臺北市立士林高商', 'text-amber-200 bg-slate-900/90 border-amber-400/60');

    createDiverseTaiwanBuilding(365, 438, 24, 46, 17, 0.32, { shapeType: 'L', matKey: 'pinkCeramic', title: '臺北市區監理所 士林監理站行政大樓' });
    createDiverseTaiwanBuilding(338, 418, 18, 34, 11, 0.32, { shapeType: 'box', matKey: 'institutional', title: '士林監理站 汽車檢驗線廠房' });
    createDiverseTaiwanBuilding(378, 492, 20, 26, 12, 0.32, { shapeType: 'chamfer', matKey: 'oldWarmTile', title: '士林監理站 路考看台與考驗大樓' });
    createDiverseTaiwanBuilding(408, 505, 16, 22, 14, 0.32, { shapeType: 'box', matKey: 'oldGreyStone', title: '承德路五段78號大樓' });
    createDiverseTaiwanBuilding(356, 345, 18, 16, 10, 0.28, { shapeType: 'box', matKey: 'oldGreyStone', title: '百齡抽水站' });
    addUVLabel(365, 438, 24, '🚗 士林監理站 (彎曲路考場)', 'text-purple-200 bg-slate-900/85 border-purple-400/50');

    // 8. 新光吳火獅紀念醫院院區群
    createDiverseTaiwanBuilding(742, 338, 46, 28, 34, 0.14, {
        shapeType: 'stepped', matKey: 'hospital', noRooftop: true, title: '新光醫院 北棟聖賢大樓', category: '醫學中心'
    });
    const skMainUV = [[702, 365], [772, 358], [778, 405], [708, 412]];
    layerGroups.buildings.add(createUVPolygonMesh(skMainUV, 44, facadeMaterials.hospital, 0, {
        title: '新光吳火獅紀念醫院 (主醫療大樓)', category: '醫學中心'
    }, { bevel: true }));
    totalBuildingCount++;

    const crossMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(3, 9, 1.5), crossMat);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 1.5), crossMat);
    c1.position.set(toX(740), 47, toZ(385));
    c2.position.set(toX(740), 47, toZ(385));
    layerGroups.buildings.add(c1, c2);

    createDiverseTaiwanBuilding(690, 402, 20, 26, 22, 0.16, { shapeType: 'L', matKey: 'institutional', title: '新光醫院 行政室與中央研究室' });
    addUVLabel(740, 385, 52, '🏥 新光醫院', 'text-rose-200 bg-slate-900/90 border-rose-400/60');

    // ========================================================================
    // Part B: 100% 完整還原 3d.html 的五大密集街廓群 (1,000+ 棟老公寓與華廈)
    // ========================================================================
    const wenlinNorthCurvedBlocks = [
        { top: [[775, 8], [818, 8], [858, 12], [888, 18]], bot: [[762, 42], [808, 34], [852, 30], [884, 34]], cols: 12, zone: 'old_walkup', name: '文林北路・文林路681巷北段' },
        { top: [[760, 48], [805, 42], [848, 38], [886, 42]], bot: [[756, 80], [802, 66], [846, 54], [890, 58]], cols: 13, zone: 'old_walkup', name: '文林路681巷・博愛牙醫街廓' },
        { top: [[762, 88], [806, 74], [850, 62], [894, 66]], bot: [[770, 108], [814, 98], [856, 92], [898, 88]], cols: 13, zone: 'old_walkup', name: '文林路661巷39弄街廓' },
        { top: [[818, 104], [858, 98], [902, 95]], bot: [[824, 130], [864, 125], [908, 120]], cols: 10, zone: 'old_walkup', name: '文林路643巷街廓' },
        { top: [[826, 136], [868, 132], [912, 128]], bot: [[830, 158], [872, 158], [918, 150]], cols: 10, zone: 'old_walkup', name: '文林路615巷河岸北側街廓' }
    ];
    wenlinNorthCurvedBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 2.0, sideGap: 1.2, zoneType: b.zone, streetName: b.name }));
    addUVLabel(845, 75, 24, '🏘️ 文林路615~681巷 (彎曲窄巷老公寓群)', 'text-orange-200 bg-slate-900/85 border-orange-400/50');

    const mrtEastCurvedBlocks = [
        { top: [[912, 4], [968, 4], [1020, 4]], bot: [[922, 40], [972, 28], [1020, 15]], cols: 11, zone: 'mixed_alley', name: '中山北路五段829巷北段' },
        { top: [[926, 48], [976, 36], [1020, 22]], bot: [[938, 82], [982, 70], [1020, 56]], cols: 11, zone: 'old_walkup', name: '中山北路五段829巷中段' },
        { top: [[942, 90], [985, 78], [1020, 65]], bot: [[955, 132], [992, 122], [1022, 112]], cols: 10, zone: 'old_walkup', name: '福華路・文林路東側街廓' },
        { top: [[958, 140], [994, 130], [1022, 120]], bot: [[975, 185], [1002, 178], [1022, 170]], cols: 9, zone: 'mixed_alley', name: '士林橋東北側河岸街廓' },
        { top: [[985, 205], [1022, 198]], bot: [[1005, 275], [1022, 270]], cols: 6, zone: 'avenue_commercial', name: '福華路南段捷運沿線' }
    ];
    mrtEastCurvedBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 2.0, sideGap: 1.3, zoneType: b.zone, streetName: b.name }));

    const wenchangWestBlocks = [
        { top: [[668, 184], [705, 178], [738, 174]], bot: [[672, 204], [708, 195], [744, 186]], cols: 9, zone: 'old_walkup', name: '文昌路179巷北側' },
        { top: [[674, 210], [712, 200], [748, 190]], bot: [[678, 232], [716, 222], [752, 212]], cols: 9, zone: 'old_walkup', name: '文昌路179巷~169巷' },
        { top: [[680, 238], [718, 228], [755, 218]], bot: [[685, 260], [722, 250], [758, 240]], cols: 9, zone: 'mixed_alley', name: '文昌路169巷~155巷' },
        { top: [[686, 266], [725, 256], [762, 246]], bot: [[692, 286], [730, 276], [765, 266]], cols: 9, zone: 'old_walkup', name: '文昌路155巷北側' },
        { top: [[694, 292], [732, 282], [766, 272]], bot: [[698, 308], [736, 298], [768, 290]], cols: 9, zone: 'avenue_commercial', name: '美崙街西段北側' }
    ];
    wenchangWestBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 1.8, sideGap: 1.1, zoneType: b.zone, streetName: b.name }));

    const southeastDenseBlocks = [
        { top: [[760, 196], [825, 212], [895, 208], [945, 196]], bot: [[762, 216], [825, 232], [895, 232], [952, 226]], cols: 18, zone: 'old_walkup', name: '文林路587巷北側河岸街廓' },
        { top: [[766, 226], [815, 240], [865, 250], [915, 245], [958, 236]], bot: [[772, 258], [820, 266], [870, 265], [918, 260], [962, 252]], cols: 19, zone: 'old_walkup', name: '文昌路140巷・下樹林街廓' },
        { top: [[774, 262], [822, 270], [872, 268], [920, 262], [964, 255]], bot: [[778, 294], [828, 288], [878, 282], [925, 275], [968, 268]], cols: 19, zone: 'mixed_alley', name: '美崙街86巷・82巷・62巷北側' },
        { top: [[784, 302], [835, 294], [888, 286], [935, 280], [972, 275]], bot: [[788, 328], [840, 320], [892, 310], [940, 302], [976, 296]], cols: 19, zone: 'old_walkup', name: '美崙街南側・大北路街廓' },
        { top: [[790, 332], [842, 324], [895, 314], [942, 306], [978, 300]], bot: [[794, 354], [846, 342], [898, 332], [946, 324], [980, 318]], cols: 19, zone: 'old_walkup', name: '美崙街49巷北側密集老公寓' },
        { top: [[796, 362], [824, 356], [848, 352]], bot: [[800, 392], [828, 386], [850, 382]], cols: 7, zone: 'old_walkup', name: '美德街・公園西側街廓' },
        { top: [[900, 340], [942, 332], [982, 326]], bot: [[904, 372], [946, 364], [986, 358]], cols: 10, zone: 'mixed_alley', name: '華光街・貴富街・文林路街廓' },
        { top: [[802, 402], [858, 390], [918, 378], [986, 368]], bot: [[808, 428], [864, 416], [924, 404], [990, 394]], cols: 19, zone: 'mixed_alley', name: '美德街・中興街・華光街南段' },
        { top: [[812, 434], [872, 422], [932, 410], [995, 400]], bot: [[822, 472], [882, 458], [942, 444], [1005, 430]], cols: 16, zone: 'avenue_commercial', name: '士林中正路北側商辦與騎樓街廓' },
        { top: [[785, 502], [825, 492], [858, 484]], bot: [[795, 532], [832, 530], [862, 528]], cols: 9, zone: 'avenue_commercial', name: '中正路399巷・365巷街廓' },
        { top: [[908, 472], [965, 458], [1020, 445]], bot: [[914, 498], [968, 488], [1022, 476]], cols: 12, zone: 'avenue_commercial', name: '中正路金融銀行街廓 (富邦/彰銀/中信)' },
        { top: [[916, 506], [970, 496], [1022, 484]], bot: [[920, 532], [974, 530], [1022, 526]], cols: 12, zone: 'mixed_alley', name: '士林國中・文林路421巷街廓' }
    ];
    southeastDenseBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 1.9, sideGap: 1.15, zoneType: b.zone, streetName: b.name }));

    const jiheSouthBlocks = [
        { top: [[548, 402], [585, 382], [618, 396]], bot: [[558, 434], [595, 412], [630, 390]], cols: 7, zone: 'luxury_highrise', name: '基河路396巷北側 (雲硯・鄉林陽明社區)' },
        { top: [[554, 444], [598, 420], [638, 398]], bot: [[574, 480], [618, 454], [662, 430]], cols: 8, zone: 'luxury_highrise', name: '基河路396巷南側 (圓山1號院・宏泰陽明)' },
        { top: [[578, 488], [624, 462], [668, 438]], bot: [[602, 522], [648, 494], [692, 470]], cols: 8, zone: 'luxury_highrise', name: '基河路300巷北側 (達麗陽明大苑周邊)' },
        { top: [[608, 526], [654, 500], [698, 476]], bot: [[625, 534], [675, 526], [718, 512]], cols: 7, zone: 'luxury_highrise', name: '基河路300巷南側 (藝術陽明社區)' },
        { top: [[665, 418], [715, 415]], bot: [[688, 462], [738, 458]], cols: 5, zone: 'avenue_commercial', name: '基河路東側・中興巴士士林站街廓' },
        { top: [[698, 472], [752, 468]], bot: [[728, 524], [778, 512]], cols: 6, zone: 'avenue_commercial', name: '基河路・台灣啤酒士林營業所街廓' }
    ];
    jiheSouthBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 2.5, sideGap: 1.6, zoneType: b.zone, streetName: b.name }));

    addUVLabel(885, 335, 28, '🔥 美崙街・文昌路 (防火巷與高低樓群)', 'text-amber-100 bg-slate-900/90 border-amber-400/60');
    addUVLabel(615, 455, 52, '🏙️ 基河路396巷高低差豪宅群', 'text-cyan-100 bg-slate-900/90 border-cyan-400/60');
}

// ============================================================================
// 6. 豐富植栽（含水域避開檢查）、公車場站車輛與動態車流/捷運列車
// ============================================================================
function buildRichTreesAndSplineTraffic() {
    const treeList = [];

    // 精準河道水域安全過濾（避免樹長到外雙溪或基隆河水面上）
    function isInsideRiverWater(u, v) {
        // 外雙溪主河道折線近似檢查
        const waiPts = [
            [1024, 154], [942, 178], [845, 196], [750, 165], [648, 134],
            [530, 145], [415, 168], [295, 204], [175, 250], [115, 282]
        ];
        for (let i = 0; i < waiPts.length - 1; i++) {
            const [u1, v1] = waiPts[i];
            const [u2, v2] = waiPts[i + 1];
            if (u <= u1 + 10 && u >= u2 - 10) {
                const t = (u - u2) / Math.max(1, (u1 - u2));
                const rv = v2 + t * (v1 - v2);
                if (Math.abs(v - rv) < 26) return true;
            }
        }
        // 左下角基隆河水域與濕地水塘排除
        if (u < 215 && v > 265) return true;
        if (u >= 215 && u <= 325 && v >= 420) return true;
        if (u >= 225 && u <= 350 && v >= 275 && v <= 355) return true; // 濕地水池區
        return false;
    }

    function addTreesInUVRect(uMin, uMax, vMin, vMax, count) {
        for (let i = 0; i < count; i++) {
            const u = uMin + seededRandom() * (uMax - uMin);
            const v = vMin + seededRandom() * (vMax - vMin);
            if (!isInsideRiverWater(u, v)) {
                treeList.push({ x: toX(u), z: toZ(v), s: 0.6 + seededRandom() * 0.75 });
            }
        }
    }

    addTreesInUVRect(492, 675, 186, 308, 420);
    addTreesInUVRect(195, 350, 248, 358, 300);
    addTreesInUVRect(218, 282, 20, 215, 220);

    // 沿外雙溪兩岸河濱綠地種樹（加寬偏移量至 32，確保落在綠岸不落入河心）
    for (let u = 140; u <= 990; u += 6) {
        const vRiver = 165 + Math.sin((u - 520) * 0.007) * 28;
        const vN = vRiver - 32 + (seededRandom() - 0.5) * 6;
        const vS = vRiver + 32 + (seededRandom() - 0.5) * 6;
        if (!isInsideRiverWater(u, vN)) treeList.push({ x: toX(u), z: toZ(vN), s: 0.7 + seededRandom() * 0.6 });
        if (!isInsideRiverWater(u, vS)) treeList.push({ x: toX(u), z: toZ(vS), s: 0.7 + seededRandom() * 0.6 });
    }

    addTreesInUVRect(382, 515, 232, 332, 180);
    addTreesInUVRect(412, 568, 342, 525, 160);
    addTreesInUVRect(212, 348, 402, 530, 200);
    addTreesInUVRect(852, 895, 342, 372, 35);

    totalTreeCount = treeList.length;

    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.52, 2.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTreeCount);

    const crownGeo = new THREE.ConeGeometry(2.2, 5.4, 7);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 });
    const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, totalTreeCount);
    crownInst.castShadow = true;
    crownInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const palette = [0x16a34a, 0x22c55e, 0x15803d, 0x4ade80, 0x059669];

    treeList.forEach((t, i) => {
        dummy.position.set(t.x, 1.25 * t.s, t.z);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, 4.1 * t.s, t.z);
        dummy.rotation.y = (i * 1.7) % Math.PI;
        dummy.updateMatrix();
        crownInst.setMatrixAt(i, dummy.matrix);

        col.setHex(palette[i % palette.length]);
        crownInst.setColorAt(i, col);
    });

    layerGroups.trees.add(trunkInst, crownInst);

    // 洲美站公車群
    const busGeo = new THREE.BoxGeometry(2.3, 2.2, 7.2);
    const busMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 6; c++) {
            const bus = new THREE.Mesh(busGeo, busMat);
            bus.position.set(toX(63 + c * 5.2), 1.1, toZ(85 + r * 52));
            layerGroups.buildings.add(bus);
        }
    }

    // 台北捷運淡水信義線動態列車
    mrtTrainGroup = new THREE.Group();
    for (let i = 0; i < 4; i++) {
        const car = new THREE.Mesh(
            new THREE.BoxGeometry(3.2, 3.0, 10.5),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.5 })
        );
        car.position.z = i * 11.2;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.65, 10.5), new THREE.MeshBasicMaterial({ color: 0xe11d48 }));
        stripe.position.y = 0.2;
        car.add(stripe);
        mrtTrainGroup.add(car);
    }
    layerGroups.roads.add(mrtTrainGroup);

    // 動態車流
    const vCols = [0xef4444, 0x3b82f6, 0xfacc15, 0xffffff, 0x10b981, 0xf97316, 0xcbd5e1];
    roadCurvesForTraffic.forEach(cfg => {
        for (let i = 0; i < cfg.count; i++) {
            const dir = i % 2 === 0 ? 1 : -1;
            const isBus = i % 7 === 0;
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(isBus ? 2.4 : 2.0, isBus ? 2.1 : 1.3, isBus ? 7.2 : 4.0),
                new THREE.MeshStandardMaterial({ color: vCols[i % vCols.length], roughness: 0.3 })
            );
            layerGroups.roads.add(m);
            trafficCars.push({
                mesh: m,
                curve: cfg.curve,
                t: seededRandom(),
                speed: (0.00065 + seededRandom() * 0.00055) * dir,
                laneOffset: dir * cfg.offset
            });
        }
    });
}

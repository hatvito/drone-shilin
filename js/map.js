// ============================================================================
// js/map.js: 1,200+ 棟士林真實街廓、士林高商、外雙溪曲流、兒樂與避水植栽
// ============================================================================
const interactiveMeshes = [];
const candidateBuildings = [];
const roadCurvesForTraffic = [];
const trafficCars = [];

let ferrisWheelGroup = null;
let carouselGroup = null;

function registerInteractive(mesh, info) {
    mesh.userData = {
        isInteractive: true,
        title: info.title,
        category: info.category || '都市建築',
        desc: info.desc || '',
        originalMaterials: null
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
    totalRoadSegments++;
    return { mesh, curve, sampled };
}

const FACADE_KEYS_WALKUP = ['oldGreyStone', 'oldWarmTile', 'pinkCeramic', 'redBrick', 'greenMosaic', 'ochreStucco'];
const ROOF_TIN_KEYS = ['tinGreen', 'tinDarkGreen', 'tinBlue', 'tinRed', 'tinSilver'];

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
    const matKey = opts.matKey || pickMaterialByHeight(h);
    const wallMat = facadeMaterials[matKey] || facadeMaterials.oldGreyStone;
    const roofMat = opts.roofMat || (seededRandom() > 0.5 ? roofMaterials.concrete : roofMaterials.darkConcrete);

    const floors = Math.max(1, Math.round(h / 3.2));
    const defaultInfo = opts.info || {
        title: opts.title || `士林街廓建築 (${floors}層樓・約${Math.round(h)}m)`,
        category: opts.category || (floors <= 2 ? '街角透天/店鋪' : (floors <= 5 ? '台灣步登老公寓 (含防火巷)' : (floors <= 11 ? '退縮式電梯華廈' : '高層住宅/商辦'))),
        desc: opts.desc || `座標 (${Math.round(u)}, ${Math.round(v)})，基地約 ${Math.round(w*1.9)}m × ${Math.round(d*1.9)}m。`
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
    } else if (shapeType === 'stepped' && h > 18) {
        const podiumH = Math.min(9.5, h * 0.3);
        const podiumMesh = new THREE.Mesh(new THREE.BoxGeometry(w, podiumH, d), [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        podiumMesh.position.y = podiumH / 2;
        podiumMesh.castShadow = true;
        podiumMesh.receiveShadow = true;
        registerInteractive(podiumMesh, defaultInfo);
        group.add(podiumMesh);

        const towerW = w * 0.78;
        const towerD = d * 0.78;
        const towerH = h - podiumH;
        mainMesh = new THREE.Mesh(new THREE.BoxGeometry(towerW, towerH, towerD), [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        mainMesh.position.set(0, podiumH + towerH / 2, 0);
    } else {
        mainMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        mainMesh.position.y = h / 2;
    }

    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    registerInteractive(mainMesh, defaultInfo);
    group.add(mainMesh);

    totalBuildingCount++;

    // 屋頂鐵皮加蓋與水塔
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
            addonMesh.position.set(0, addonH / 2, 0);
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
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.55, 7), tankMat);
            tank.position.set(w * 0.24, 0.8, 0);
            roofGroup.add(tank);
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

            const shape1 = isCorner && seededRandom() < 0.55 ? 'chamfer' : (h1 > 22 ? 'stepped' : 'box');
            const shape2 = isCorner && seededRandom() < 0.55 ? 'chamfer' : (h2 > 22 ? 'stepped' : 'box');

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

// 士林高商完整校舍群
function buildShilinHighSchoolOfCommerce() {
    const shilinHSBuildings = [
        { u: 468, v: 454, w: 32, d: 8, h: 14, name: '士林高商 信義樓' },
        { u: 465, v: 472, w: 32, d: 8, h: 14, name: '士林高商 和平樓' },
        { u: 496, v: 468, w: 24, d: 8, h: 14, name: '士林高商 仁愛樓' },
        { u: 482, v: 492, w: 34, d: 8.5, h: 14, name: '士林高商 忠孝樓' },
        { u: 478, v: 515, w: 34, d: 8.5, h: 14, name: '士林高商 力行樓' },
        { u: 515, v: 450, w: 22, d: 18, h: 18, name: '士林高商 學生活動中心' },
        { u: 525, v: 478, w: 24, d: 12, h: 16, name: '士林高商 行政大樓' },
        { u: 518, v: 512, w: 24, d: 8.5, h: 14, name: '士林高商 圖書館' },
        { u: 548, v: 505, w: 22, d: 8.5, h: 14, name: '士林高商 耕耘軒' },
        { u: 572, v: 522, w: 22, d: 8.5, h: 14, name: '士林高商 悅聞樓' }
    ];

    shilinHSBuildings.forEach(b => {
        createDiverseTaiwanBuilding(b.u, b.v, b.w, b.d, b.h, 0.18, {
            shapeType: 'box',
            matKey: 'institutional',
            noRooftop: true,
            title: b.name,
            category: '臺北市立士林高商校舍'
        });
    });

    const track = new THREE.Mesh(
        new THREE.RingGeometry(14, 21, 32),
        new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide })
    );
    track.rotation.x = -Math.PI / 2;
    track.scale.set(1.4, 0.85, 1);
    track.position.set(toX(445), 0.5, toZ(420));
    layerGroups.parks.add(track);

    addUVLabel(495, 485, 25, '🏫 臺北市立士林高商', 'text-amber-200 bg-slate-900/90 border-amber-400/60');
}

// 兒童新樂園設施
function buildAmusementParkRichAttractions() {
    const ferrisHolder = new THREE.Group();
    ferrisHolder.position.set(toX(422), 0, toZ(258));

    const frameMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.3 });
    [-4, 4].forEach(zOff => {
        const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 32, 8), frameMat);
        leg1.position.set(-6, 15, zOff); leg1.rotation.z = -0.22;
        const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 32, 8), frameMat);
        leg2.position.set(6, 15, zOff); leg2.rotation.z = 0.22;
        ferrisHolder.add(leg1, leg2);
    });

    ferrisWheelGroup = new THREE.Group();
    ferrisWheelGroup.position.set(0, 29, 0);
    ferrisWheelGroup.add(new THREE.Mesh(new THREE.TorusGeometry(18, 0.8, 10, 36), new THREE.MeshStandardMaterial({ color: 0xfacc15 })));
    ferrisWheelGroup.add(new THREE.Mesh(new THREE.TorusGeometry(12, 0.5, 8, 36), new THREE.MeshStandardMaterial({ color: 0x38bdf8 })));

    const cabColors = [0xef4444, 0x10b981, 0x3b82f6, 0xf59e0b, 0x8b5cf6, 0xec4899];
    for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 36, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        spoke.rotation.z = ang;
        ferrisWheelGroup.add(spoke);

        const cab = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 10), new THREE.MeshStandardMaterial({ color: cabColors[i % 6] }));
        cab.position.set(Math.cos(ang) * 18, Math.sin(ang) * 18, 0);
        ferrisWheelGroup.add(cab);
    }
    ferrisHolder.add(ferrisWheelGroup);
    layerGroups.buildings.add(ferrisHolder);

    const coasterUV = [[390, 260], [405, 245], [430, 250], [440, 275], [415, 290], [390, 275], [390, 260]];
    const coasterCurve = new THREE.CatmullRomCurve3(coasterUV.map(p => new THREE.Vector3(toX(p[0]), 8 + Math.sin(p[0]*0.1)*5, toZ(p[1]))), true);
    const coasterGeo = new THREE.TubeGeometry(coasterCurve, 64, 0.45, 8, true);
    layerGroups.buildings.add(new THREE.Mesh(coasterGeo, new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6 })));

    carouselGroup = new THREE.Group();
    carouselGroup.position.set(toX(455), 0, toZ(285));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0xf1f5f9 }));
    base.position.y = 0.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.8, 4.5, 24), new THREE.MeshStandardMaterial({ color: 0xf43f5e }));
    roof.position.y = 5.2;
    carouselGroup.add(base, roof);
    layerGroups.buildings.add(carouselGroup);

    addUVLabel(435, 275, 38, '🎡 台北市立兒童新樂園', 'text-amber-200 bg-rose-950/90 border-amber-400/60');
}

// 植栽安全排除
function buildSafeTreesExcludingWater() {
    const treeList = [];
    function isWaterZone(u, v) {
        const riverCenterV = 165 + Math.sin((u - 520) * 0.007) * 28;
        if (Math.abs(v - riverCenterV) < 28) return true;
        if (u < 260 && v > 260 && (u + v < 600)) return true;
        return false;
    }

    function addSafeTreesInRect(uMin, uMax, vMin, vMax, count) {
        let added = 0;
        let tries = 0;
        while (added < count && tries < count * 3) {
            tries++;
            const u = uMin + seededRandom() * (uMax - uMin);
            const v = vMin + seededRandom() * (vMax - vMin);
            if (!isWaterZone(u, v)) {
                treeList.push({ x: toX(u), z: toZ(v), s: 0.6 + seededRandom() * 0.7 });
                added++;
            }
        }
    }

    addSafeTreesInRect(495, 665, 195, 305, 380);
    addSafeTreesInRect(220, 340, 260, 350, 180);
    addSafeTreesInRect(380, 500, 320, 430, 150);

    totalTreeCount = treeList.length;

    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.48, 2.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTreeCount);

    const crownGeo = new THREE.ConeGeometry(2.1, 5.2, 7);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 });
    const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, totalTreeCount);
    crownInst.castShadow = true;

    const dummy = new THREE.Object3D();
    treeList.forEach((t, i) => {
        dummy.position.set(t.x, 1.25 * t.s, t.z);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, 4.0 * t.s, t.z);
        dummy.updateMatrix();
        crownInst.setMatrixAt(i, dummy.matrix);
    });

    layerGroups.trees.add(trunkInst, crownInst);
}

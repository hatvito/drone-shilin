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

// ============================================================================
// js/world/geo-helpers.js: 3D 幾何多邊形擠壓、多段平滑彎曲道路與河道帶狀生成器
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { toX, toZ } = ns.Config;
    const { interactiveMeshes } = ns.State;

    function registerInteractive(mesh, info) {
        mesh.userData = {
            isInteractive: true,
            title: info.title || '都市街廓建築',
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

        // 道路中央分隔雙黃線或虛線
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

        // 兩側立體人行道灰色緣石 (Curb)
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

        ns.State.stats.totalRoadSegments++;
        return { mesh, curve, sampled };
    }

    ns.GeoHelpers = {
        registerInteractive,
        createUVPolygonMesh,
        createUVSplineRibbon
    };
})(window.ShilinDrone);

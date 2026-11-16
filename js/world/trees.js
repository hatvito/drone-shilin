// ============================================================================
// js/world/trees.js: 台北士林豐富植栽生態林網（水域過濾）與公車調度站
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { toX, toZ, seededRandom } = ns.Config;
    const { layerGroups, stats } = ns.State;

    function buildRichTreesAndBusStation() {
        const treeList = [];

        // 精準河道水域安全過濾（避免行道樹生長在外雙溪水心或基隆河中）
        function isInsideRiverWater(u, v) {
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
            if (u < 215 && v > 265) return true;
            if (u >= 215 && u <= 325 && v >= 420) return true;
            if (u >= 225 && u <= 350 && v >= 275 && v <= 355) return true;
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

        // 各公園區域林蔭覆蓋
        addTreesInUVRect(492, 675, 186, 308, 420); // 美崙公園
        addTreesInUVRect(195, 350, 248, 358, 300); // 雙溪濕地公園
        addTreesInUVRect(218, 282, 20, 215, 220);  // 洲美生態河岸

        // 沿外雙溪兩側河濱綠廊種植茂密林蔭
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

        stats.totalTreeCount = treeList.length;

        // 使用 GPU InstancedMesh 渲染數千棵樹木，保證 60 FPS 流暢度
        const trunkGeo = new THREE.CylinderGeometry(0.32, 0.52, 2.5, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
        const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, stats.totalTreeCount);

        const crownGeo = new THREE.ConeGeometry(2.2, 5.4, 7);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 });
        const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, stats.totalTreeCount);
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

        // 洲美公車調度站停靠車輛
        const busGeo = new THREE.BoxGeometry(2.3, 2.2, 7.2);
        const busMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 6; c++) {
                const bus = new THREE.Mesh(busGeo, busMat);
                bus.position.set(toX(63 + c * 5.2), 1.1, toZ(85 + r * 52));
                layerGroups.buildings.add(bus);
            }
        }
    }

    ns.Trees = {
        buildRichTreesAndBusStation
    };
})(window.ShilinDrone);

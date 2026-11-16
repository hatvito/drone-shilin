// ============================================================================
// js/world/roads.js: 台北士林真實彎曲幹道網、跨河大橋與台北捷運高架軌道系統
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { createUVSplineRibbon } = ns.GeoHelpers;
    const { layerGroups, roadCurvesForTraffic, dynamicObjects } = ns.State;

    function buildRealisticCurvedRoadNetwork() {
        // 1. 承德路六段 -> 雙溪橋 -> 承德路五段 (省道台2乙線主幹道)
        const chengdeUV = [
            [290, 0], [298, 48], [308, 98], [320, 148], [335, 196],
            [354, 260], [376, 330], [398, 392], [422, 458], [452, 534]
        ];
        const chengde = createUVSplineRibbon(chengdeUV, 21.5, 1.15, 0.1, 0xfbbf24, {
            title: '承德路六段・雙溪橋・承德路五段 (省道台2乙線)', category: '省道主幹道'
        }, { centerLine: true, solidCenter: true, centerLineColor: 0xfef3c7, curb: true });
        layerGroups.roads.add(chengde.mesh);
        roadCurvesForTraffic.push({ curve: chengde.curve, count: 22, offset: 4.8 });

        // 雙溪橋兩側立體水泥防護護欄
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

        // 3. 基河路 (弧形景觀道路)
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

        // 4. 承德路五段150巷 -> 洲美二號橋 -> 通河東街二段 (大C型河岸景觀彎道)
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

        // 11. 台北捷運淡水信義線 (高架弧形軌道與連續橋墩)
        const mrtUV = [[898, 0], [918, 55], [938, 110], [958, 162], [978, 215], [1000, 275], [1022, 335]];
        const mrtViaduct = createUVSplineRibbon(mrtUV, 9.5, 2.8, 13.5, 0xcbd5e1, {
            title: '台北捷運淡水信義線 (弧形高架軌道)', category: '大眾捷運系統'
        });
        dynamicObjects.mrtCurve = mrtViaduct.curve;
        layerGroups.roads.add(mrtViaduct.mesh);
        layerGroups.roads.add(createUVSplineRibbon(mrtUV, 10.4, 0.9, 15.8, 0xe11d48).mesh); // 紅線專屬色帶

        for (let i = 0; i <= 15; i++) {
            const pt = dynamicObjects.mrtCurve.getPoint(i / 15);
            const pier = new THREE.Mesh(
                new THREE.CylinderGeometry(1.5, 1.9, 13.5, 10),
                new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
            );
            pier.position.set(pt.x, 6.75, pt.z);
            pier.castShadow = true;
            layerGroups.roads.add(pier);
        }
    }

    ns.Roads = {
        buildRealisticCurvedRoadNetwork
    };
})(window.ShilinDrone);

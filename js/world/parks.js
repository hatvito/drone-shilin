// ============================================================================
// js/world/parks.js: 台北士林大型都會公園、雙溪濕地生態池與學校運動操場
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { toX, toZ } = ns.Config;
    const { createUVPolygonMesh } = ns.GeoHelpers;
    const { layerGroups } = ns.State;

    function buildParksWetlandsAndCurvedPaths() {
        // 1. 美崙公園 (洲尾頭) 廣大綠地
        const meilunUV = [
            [476, 205], [545, 185], [622, 178], [662, 202], [676, 255],
            [685, 298], [635, 312], [582, 325], [538, 285], [498, 238]
        ];
        layerGroups.parks.add(createUVPolygonMesh(meilunUV, 0.9, 0xc3ecb8, 0, {
            title: '美崙公園 (洲尾頭)', category: '大型都市公園'
        }));

        // 美崙公園中央丘陵起伏土丘
        const hillUV = [[568, 218], [615, 208], [646, 224], [648, 256], [608, 268], [572, 252]];
        layerGroups.parks.add(createUVPolygonMesh(hillUV, 2.5, 0xb0e0a2, 0));

        // 2. 雙溪濕地公園 (具備生態沉澱池與水中漫步木棧道)
        const wetlandUV = [
            [198, 286], [268, 262], [338, 245], [356, 292], [362, 330],
            [298, 355], [248, 365], [202, 342], [190, 312]
        ];
        layerGroups.parks.add(createUVPolygonMesh(wetlandUV, 0.85, 0xc3ecb8, 0, {
            title: '雙溪濕地公園 (含生態池與水中步道)', category: '生態濕地公園'
        }));

        // 雙溪濕地公園內雙水塘
        const pond1UV = [[228, 298], [268, 282], [308, 276], [318, 298], [285, 315], [238, 318]];
        const pond2UV = [[262, 325], [305, 312], [338, 306], [346, 332], [312, 348], [270, 352]];
        layerGroups.rivers.add(createUVPolygonMesh(pond1UV, 1.12, 0x67abc7, 0));
        layerGroups.rivers.add(createUVPolygonMesh(pond2UV, 1.12, 0x67abc7, 0));

        // 周邊社區鄰里綠地與街角口袋公園
        layerGroups.parks.add(createUVPolygonMesh([[212, 398], [278, 422], [365, 534], [292, 534], [208, 445]], 0.8, 0xbbe7b3, 0));
        layerGroups.parks.add(createUVPolygonMesh([[0, 405], [95, 445], [155, 534], [0, 534]], 0.8, 0xc3ecb8, 0));
        layerGroups.parks.add(createUVPolygonMesh([[410, 352], [478, 336], [505, 435], [435, 448]], 0.9, 0xc8f0be, 0));
        layerGroups.parks.add(createUVPolygonMesh([[668, 62], [705, 62], [705, 98], [668, 98]], 0.95, 0x6ee7b7, 0));
        layerGroups.parks.add(createUVPolygonMesh([[852, 345], [892, 338], [896, 368], [856, 375]], 0.95, 0xb8e8ad, 0));
        layerGroups.parks.add(createUVPolygonMesh([[868, 488], [902, 482], [908, 528], [874, 532]], 0.95, 0x7dd3ae, 0));

        // 3. 臺北市立士林高級商業職業學校・標準橢圓 PU 田徑跑道
        const ovalTrack = new THREE.Mesh(
            new THREE.RingGeometry(14.5, 21.5, 36),
            new THREE.MeshStandardMaterial({ color: 0x4ade80, side: THREE.DoubleSide })
        );
        ovalTrack.rotation.x = -Math.PI / 2;
        ovalTrack.scale.set(1.45, 0.82, 1);
        ovalTrack.position.set(toX(468), 1.08, toZ(415));
        layerGroups.parks.add(ovalTrack);
    }

    ns.Parks = {
        buildParksWetlandsAndCurvedPaths
    };
})(window.ShilinDrone);

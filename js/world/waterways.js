// ============================================================================
// js/world/waterways.js: 台北士林自然河道（外雙溪、基隆河、雙溪匯流口與防洪堤防）
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { createUVPolygonMesh, createUVSplineRibbon } = ns.GeoHelpers;
    const { layerGroups } = ns.State;

    function buildOrganicRiversAndLevees() {
        // 1. 外雙溪主河道折線 (由東向西曲流)
        const waiShuangUV = [
            [1024, 154], [985, 165], [942, 178], [892, 192], [845, 196],
            [795, 185], [750, 165], [702, 145], [648, 134], [590, 136],
            [530, 145], [472, 155], [415, 168], [355, 185], [295, 204],
            [235, 224], [175, 250], [115, 282]
        ];

        // 雙溪左右岸河濱公園綠帶 (底層較寬淺綠帶)
        const greenbelt = createUVSplineRibbon(waiShuangUV, 86, 0.38, 0, 0xc7ecc0, {
            title: '外雙溪蜿蜒河濱綠廊 (雙溪左右岸河濱公園)',
            category: '河濱綠帶',
            desc: '順應外雙溪自然曲流延伸的河濱綠帶，內含彎曲的紅褐色雙溪河濱自行車道。'
        }, { widthFunc: (t) => 0.85 + t * 0.35 });
        layerGroups.parks.add(greenbelt.mesh);

        // 外雙溪清澈藍色水體
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

        // 外雙溪左右兩岸高聳混凝土防洪堤防 (水利工程)
        const northLeveeUV = [[935, 145], [845, 162], [752, 132], [648, 108], [530, 118], [415, 138], [335, 165], [262, 192]];
        const southLeveeUV = [[952, 205], [848, 224], [752, 198], [648, 168], [525, 178], [415, 198], [352, 222]];
        layerGroups.parks.add(createUVSplineRibbon(northLeveeUV, 2.2, 2.8, 0.2, 0x94a3b8, {
            title: '外雙溪右岸防洪堤防與堤頂步道', category: '水利設施'
        }).mesh);
        layerGroups.parks.add(createUVSplineRibbon(southLeveeUV, 2.2, 2.8, 0.2, 0x94a3b8, {
            title: '外雙溪左岸防洪堤防', category: '水利設施'
        }).mesh);

        // 2. 基隆河河段 (左下角寬闊河面)
        const keelungUV = [
            [0, 282], [85, 272], [155, 258], [202, 272], [206, 308],
            [192, 348], [185, 385], [208, 422], [255, 472], [318, 534],
            [152, 534], [95, 465], [45, 415], [0, 392]
        ];
        layerGroups.rivers.add(createUVPolygonMesh(keelungUV, 0.9, 0x5fa3c0, 0.12, {
            title: '基隆河 (Keelung River) 與雙溪匯流口',
            category: '主要河川'
        }, { roughness: 0.14, metalness: 0.38 }));

        // 3. 洲美蜆仔港生態水道與綠帶
        const choumeiCanalUV = [[215, 0], [235, 32], [256, 68], [268, 108], [264, 148], [256, 182], [265, 215]];
        layerGroups.parks.add(createUVSplineRibbon(choumeiCanalUV, 36, 0.4, 0, 0xbfe8b9, {
            title: '洲美蜆仔港生態河岸公園', category: '親水綠帶'
        }).mesh);
        layerGroups.rivers.add(createUVSplineRibbon(choumeiCanalUV, 11.5, 0.92, 0.18, 0x67abc7, {
            title: '洲美蜆仔港彎曲水道', category: '自然支流'
        }).mesh);

        // 4. 磺港溪 / 軟橋段彎曲水路
        const jiandeCanalUV = [[608, 0], [602, 32], [594, 62], [602, 92], [596, 118], [588, 142]];
        layerGroups.rivers.add(createUVSplineRibbon(jiandeCanalUV, 11.5, 0.92, 0.18, 0x67abc7, {
            title: '磺港溪 / 軟橋段彎曲水路', category: '河道支流'
        }).mesh);

        if (ns.Labels && ns.Labels.addUVLabel) {
            ns.Labels.addUVLabel(530, 145, 7, '🌊 外雙溪 (自然蜿蜒河道)', 'text-sky-100 bg-sky-900/85 border-sky-400/50');
            ns.Labels.addUVLabel(165, 480, 7, '🌊 基隆河匯流口', 'text-sky-100 bg-sky-900/85 border-sky-400/50');
        }
    }

    ns.Waterways = {
        buildOrganicRiversAndLevees
    };
})(window.ShilinDrone);

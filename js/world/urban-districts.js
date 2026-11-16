// ============================================================================
// js/world/urban-districts.js: 士林五大真實密集街廓群（1,000+ 棟步登老公寓、防火巷與豪宅群）
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { populateCurvedStreetBlock } = ns.StreetBlocks;

    function buildUrbanDistricts() {
        const addLabel = (u, v, y, text, style) => {
            if (ns.Labels && ns.Labels.addUVLabel) {
                ns.Labels.addUVLabel(u, v, y, text, style);
            }
        };

        // 1. 文林北路・文林路巷弄老社區 (雙排老公寓群)
        const wenlinNorthCurvedBlocks = [
            { top: [[775, 8], [818, 8], [858, 12], [888, 18]], bot: [[762, 42], [808, 34], [852, 30], [884, 34]], cols: 12, zone: 'old_walkup', name: '文林北路・文林路681巷北段' },
            { top: [[760, 48], [805, 42], [848, 38], [886, 42]], bot: [[756, 80], [802, 66], [846, 54], [890, 58]], cols: 13, zone: 'old_walkup', name: '文林路681巷・博愛牙醫街廓' },
            { top: [[762, 88], [806, 74], [850, 62], [894, 66]], bot: [[770, 108], [814, 98], [856, 92], [898, 88]], cols: 13, zone: 'old_walkup', name: '文林路661巷39弄街廓' },
            { top: [[818, 104], [858, 98], [902, 95]], bot: [[824, 130], [864, 125], [908, 120]], cols: 10, zone: 'old_walkup', name: '文林路643巷街廓' },
            { top: [[826, 136], [868, 132], [912, 128]], bot: [[830, 158], [872, 158], [918, 150]], cols: 10, zone: 'old_walkup', name: '文林路615巷河岸北側街廓' }
        ];
        wenlinNorthCurvedBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 2.0, sideGap: 1.2, zoneType: b.zone, streetName: b.name }));
        addLabel(845, 75, 24, '🏘️ 文林路615~681巷 (彎曲窄巷老公寓群)', 'text-orange-200 bg-slate-900/85 border-orange-400/50');

        // 2. 捷運淡水線東側（中山北路五段829巷與福華路）
        const mrtEastCurvedBlocks = [
            { top: [[912, 4], [968, 4], [1020, 4]], bot: [[922, 40], [972, 28], [1020, 15]], cols: 11, zone: 'mixed_alley', name: '中山北路五段829巷北段' },
            { top: [[926, 48], [976, 36], [1020, 22]], bot: [[938, 82], [982, 70], [1020, 56]], cols: 11, zone: 'old_walkup', name: '中山北路五段829巷中段' },
            { top: [[942, 90], [985, 78], [1020, 65]], bot: [[955, 132], [992, 122], [1022, 112]], cols: 10, zone: 'old_walkup', name: '福華路・文林路東側街廓' },
            { top: [[958, 140], [994, 130], [1022, 120]], bot: [[975, 185], [1002, 178], [1022, 170]], cols: 9, zone: 'mixed_alley', name: '士林橋東北側河岸街廓' },
            { top: [[985, 205], [1022, 198]], bot: [[1005, 275], [1022, 270]], cols: 6, zone: 'avenue_commercial', name: '福華路南段捷運沿線' }
        ];
        mrtEastCurvedBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 2.0, sideGap: 1.3, zoneType: b.zone, streetName: b.name }));

        // 3. 文昌路西側（文昌路155~179巷）
        const wenchangWestBlocks = [
            { top: [[668, 184], [705, 178], [738, 174]], bot: [[672, 204], [708, 195], [744, 186]], cols: 9, zone: 'old_walkup', name: '文昌路179巷北側' },
            { top: [[674, 210], [712, 200], [748, 190]], bot: [[678, 232], [716, 222], [752, 212]], cols: 9, zone: 'old_walkup', name: '文昌路179巷~169巷' },
            { top: [[680, 238], [718, 228], [755, 218]], bot: [[685, 260], [722, 250], [758, 240]], cols: 9, zone: 'mixed_alley', name: '文昌路169巷~155巷' },
            { top: [[686, 266], [725, 256], [762, 246]], bot: [[692, 286], [730, 276], [765, 266]], cols: 9, zone: 'old_walkup', name: '文昌路155巷北側' },
            { top: [[694, 292], [732, 282], [766, 272]], bot: [[698, 308], [736, 298], [768, 290]], cols: 9, zone: 'avenue_commercial', name: '美崙街西段北側' }
        ];
        wenchangWestBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 1.8, sideGap: 1.1, zoneType: b.zone, streetName: b.name }));

        // 4. 東南密集住宅與商業金融街廓（美崙街、文昌路、大北路、美德街、士林中正路）
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

        // 5. 基河路南段（基河路300~396巷高低差豪宅社區群）
        const jiheSouthBlocks = [
            { top: [[548, 402], [585, 382], [618, 396]], bot: [[558, 434], [595, 412], [630, 390]], cols: 7, zone: 'luxury_highrise', name: '基河路396巷北側 (雲硯・鄉林陽明社區)' },
            { top: [[554, 444], [598, 420], [638, 398]], bot: [[574, 480], [618, 454], [662, 430]], cols: 8, zone: 'luxury_highrise', name: '基河路396巷南側 (圓山1號院・宏泰陽明)' },
            { top: [[578, 488], [624, 462], [668, 438]], bot: [[602, 522], [648, 494], [692, 470]], cols: 8, zone: 'luxury_highrise', name: '基河路300巷北側 (達麗陽明大苑周邊)' },
            { top: [[608, 526], [654, 500], [698, 476]], bot: [[625, 534], [675, 526], [718, 512]], cols: 7, zone: 'luxury_highrise', name: '基河路300巷南側 (藝術陽明社區)' },
            { top: [[665, 418], [715, 415]], bot: [[688, 462], [738, 458]], cols: 5, zone: 'avenue_commercial', name: '基河路東側・中興巴士士林站街廓' },
            { top: [[698, 472], [752, 468]], bot: [[728, 524], [778, 512]], cols: 6, zone: 'avenue_commercial', name: '基河路・台灣啤酒士林營業所街廓' }
        ];
        jiheSouthBlocks.forEach(b => populateCurvedStreetBlock(b.top, b.bot, { cols: b.cols, doubleRow: true, fireAlleyGap: 2.5, sideGap: 1.6, zoneType: b.zone, streetName: b.name }));

        addLabel(885, 335, 28, '🔥 美崙街・文昌路 (防火巷與高低樓群)', 'text-amber-100 bg-slate-900/90 border-amber-400/60');
        addLabel(615, 455, 52, '🏙️ 基河路396巷高低差豪宅群', 'text-cyan-100 bg-slate-900/90 border-cyan-400/60');
    }

    ns.UrbanDistricts = {
        buildUrbanDistricts
    };
})(window.ShilinDrone);

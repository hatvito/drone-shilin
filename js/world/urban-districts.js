// ============================================================================
// js/world/urban-districts.js: 台北士林全區都市街廓建築群演算法自主生成系統
// 100% 幾何自主運算：嚴格保障捷運廊道與幹道完全淨空、無任何建物重疊道路或捷運
// 涵蓋北士科、芝山福華路、文昌美崙舊街、文林路商圈、後港前港街與中正路商業大道
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { seededRandom, randRange } = ns.Config || {};
    const { createDiverseTaiwanBuilding = () => {} } = ns.BuildingGenerator || {};

    // ------------------------------------------------------------------------
    // 道路、捷運軌道與河川核心幾何參考點 (用於嚴格安全退縮淨空運算)
    // ------------------------------------------------------------------------
    const MRT_UV = [[898, 0], [918, 55], [938, 110], [958, 162], [978, 215], [1000, 275], [1022, 335]];
    const CHENGDE_UV = [
        [290, 0], [298, 48], [308, 98], [320, 148], [335, 196],
        [354, 260], [376, 330], [398, 392], [422, 458], [452, 534]
    ];
    const WENCHANG_UV = [
        [816, 0], [790, 38], [765, 76], [748, 114], [742, 152],
        [745, 186], [755, 226], [768, 272], [782, 325], [798, 382],
        [816, 435], [835, 482]
    ];
    const JIHE_UV = [
        [356, 250], [398, 236], [442, 224], [468, 224], [488, 238],
        [512, 270], [542, 305], [578, 342], [618, 386], [658, 434],
        [695, 485], [730, 534]
    ];
    const TONGHE_UV = [
        [350, 252], [302, 266], [248, 282], [212, 298], [194, 322],
        [192, 352], [208, 382], [242, 412], [285, 448], [328, 492], [366, 534]
    ];
    const SHISHANG_UV = [
        [378, 338], [435, 326], [488, 314], [506, 338], [535, 392],
        [568, 445], [598, 495], [624, 534]
    ];
    const WENLIN_UV = [
        [852, 0], [878, 48], [904, 98], [928, 145], [948, 186],
        [960, 235], [970, 292], [982, 355], [994, 422], [1008, 495]
    ];
    const ZHONGZHENG_UV = [[762, 534], [798, 506], [835, 482], [885, 468], [942, 454], [988, 442], [1024, 432]];
    const WAISHUANG_UV = [
        [1024, 154], [985, 165], [942, 178], [892, 192], [845, 196],
        [795, 185], [750, 165], [702, 145], [648, 134], [590, 136],
        [530, 145], [472, 155], [415, 168], [355, 185], [295, 204],
        [235, 224], [175, 250], [115, 282]
    ];

    const NORTH_ROADS = [
        [[0, 22], [150, 19], [295, 16], [445, 12], [595, 8]], // 福國路
        [[0, 75], [85, 75], [165, 75], [242, 76]],           // 福美路
        [[0, 148], [85, 148], [168, 148], [252, 150]],       // 福善路
        [[54, 22], [54, 110], [54, 195], [54, 278]],         // 承平路
        [[158, 22], [158, 95], [158, 165], [158, 232]]       // 承信路
    ];

    // 重大地標建築禁建保留區 (避免與 landmarks.js 重疊)
    const LANDMARK_EXCLUSIONS = [
        { minU: 330, minV: 35,  maxU: 435, maxV: 145 }, // 金仁寶營運總部
        { minU: 445, minV: 40,  maxU: 585, maxV: 110 }, // NVIDIA 星群
        { minU: 635, minV: 25,  maxU: 730, maxV: 100 }, // 高等行政法院 & 歐洲學校
        { minU: 755, minV: 100, maxU: 825, maxV: 145 }, // 文昌國小
        { minU: 365, minV: 225, maxU: 530, maxV: 345 }, // 兒童新樂園
        { minU: 530, minV: 310, maxU: 680, maxV: 380 }, // 科教館 & 天文館
        { minU: 450, minV: 445, maxU: 580, maxV: 534 }, // 士林高商完整校區
        { minU: 330, minV: 410, maxU: 420, maxV: 520 }, // 士林監理站
        { minU: 690, minV: 335, maxU: 785, maxV: 420 }  // 新光醫院主院區
    ];

    // 點到線段距離計算
    function distToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    // 點到折線距離計算
    function distToPolyline(px, py, polyline) {
        let minD = Infinity;
        for (let i = 0; i < polyline.length - 1; i++) {
            const d = distToSegment(px, py, polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]);
            if (d < minD) minD = d;
        }
        return minD;
    }

    // 嚴格檢驗點是否遠離所有道路、捷運與河川
    function isParcelClear(u, v, radius) {
        // 1. 台北捷運高架廊道：嚴格保持至少 16.5m 淨空，確保高架軌道與紅色列車全線清晰無遮蔽
        if (distToPolyline(u, v, MRT_UV) < (16.5 + radius)) return false;

        // 2. 外雙溪曲流河道與河濱綠帶：嚴格保持 35m 淨空
        if (distToPolyline(u, v, WAISHUANG_UV) < (34.0 + radius)) return false;

        // 3. 基隆河河段 (左下角水域)
        if (u < 210 && v > 270) {
            if ((v - 270) > (210 - u) * 0.7) return false;
        }

        // 4. 各主要彎曲幹道退縮距離 (路寬 / 2 + 安全路緣石人行道退縮)
        if (distToPolyline(u, v, CHENGDE_UV) < (12.0 + radius)) return false;
        if (distToPolyline(u, v, WENLIN_UV) < (8.0 + radius)) return false;
        if (distToPolyline(u, v, ZHONGZHENG_UV) < (10.0 + radius)) return false;
        if (distToPolyline(u, v, JIHE_UV) < (7.5 + radius)) return false;
        if (distToPolyline(u, v, WENCHANG_UV) < (8.5 + radius)) return false;
        if (distToPolyline(u, v, SHISHANG_UV) < (7.0 + radius)) return false;
        if (distToPolyline(u, v, TONGHE_UV) < (7.0 + radius)) return false;

        for (let i = 0; i < NORTH_ROADS.length; i++) {
            if (distToPolyline(u, v, NORTH_ROADS[i]) < (6.0 + radius)) return false;
        }

        // 5. 重大地標建築區排他
        for (let i = 0; i < LANDMARK_EXCLUSIONS.length; i++) {
            const b = LANDMARK_EXCLUSIONS[i];
            if (u >= b.minU - radius && u <= b.maxU + radius && v >= b.minV - radius && v <= b.maxV + radius) {
                return false;
            }
        }

        // 6. 地圖邊緣保護
        if (u < 10 || u > 1014 || v < 10 || v > 524) return false;

        return true;
    }

    // 根據建築高度與街區性格推薦明亮生動的台灣特色材質
    function pickVibrantMaterial(zone, height, r) {
        if (zone === 'tech') {
            if (height > 32) return r < 0.5 ? 'glassTower' : 'techSilver';
            if (height > 20) return r < 0.5 ? 'techSilver' : 'midriseMansion';
            return r < 0.5 ? 'whiteTileStucco' : 'institutional';
        }

        if (zone === 'commercial') {
            if (height > 35) return r < 0.45 ? 'glassTower' : (r < 0.75 ? 'highriseLuxury' : 'techSilver');
            if (height > 22) return r < 0.5 ? 'arcadeCommercial' : 'midriseMansion';
            return r < 0.6 ? 'arcadeCommercial' : 'whiteTileStucco';
        }

        if (zone === 'mansion') {
            if (height > 28) return r < 0.5 ? 'highriseLuxury' : 'midriseMansion';
            if (height > 18) return r < 0.5 ? 'midriseMansion' : 'whiteTileStucco';
            const m = ['whiteTileStucco', 'oldWarmTile', 'pinkCeramic', 'arcadeCommercial'];
            return m[Math.floor(r * m.length) % m.length];
        }

        // 步登老公寓與舊街傳統生活圈 (老士林、後港)
        if (height > 24) {
            return r < 0.5 ? 'midriseMansion' : 'pinkCeramic';
        }
        
        // 台灣最經典步登公寓明亮色票
        const walkupPalette = [
            'whiteTileStucco',     // 純白二丁掛
            'oldWarmTile',         // 米黃象牙磁磚
            'pinkCeramic',         // 暖粉橘珊瑚磚
            'redBrick',            // 暖紅磚
            'greenMosaic',         // 淺薄荷綠馬賽克
            'arcadeCommercial',    // 騎樓商鋪看板
            'vintageGreenStucco',  // 翡翠淺綠水磨石子
            'ochreStucco',         // 金黃粉刷
            'retroBrownTile',      // 焦糖琥珀磁磚
            'oldGreyStone'         // 淺灰洗石子
        ];
        return walkupPalette[Math.floor(r * walkupPalette.length) % walkupPalette.length];
    }

    // ------------------------------------------------------------------------
    // 自主演算法都市街廓生成核心
    // ------------------------------------------------------------------------
    function buildUrbanDistricts() {
        const addLabel = (u, v, y, text, style) => {
            if (ns.Labels && ns.Labels.addUVLabel) {
                ns.Labels.addUVLabel(u, v, y, text, style);
            }
        };

        // 街區批次填充輔助函式
        function populateBlock(cfg) {
            const { uStart, uEnd, vStart, vEnd, stepU, stepV, wBase, dBase, hMin, hMax, zone, streetName, category } = cfg;
            let u = uStart;
            let row = 0;

            while (u <= uEnd) {
                let v = vStart;
                let col = 0;

                while (v <= vEnd) {
                    // 偽隨機確定性因子 (保持地圖穩定可重現)
                    const r = ((row * 37 + col * 73) % 100) / 100.0;
                    const r2 = ((row * 53 + col * 41) % 100) / 100.0;

                    // 順應真實地籍面寬與進深
                    const w = wBase * (0.86 + r * 0.28);
                    const d = dBase * (0.88 + r2 * 0.24);
                    const radius = Math.max(w, d) / 2;

                    // 嚴格淨空偵測：確保絕不入侵道路或捷運
                    if (isParcelClear(u, v, radius)) {
                        // 建築高度運算 (樓層化)
                        const h = hMin + r * (hMax - hMin);
                        const floors = Math.max(1, Math.round(h / 3.2));

                        // 建築形狀多樣性隨機：
                        // chamfer (街角45度斜切店面), L (L型採光大樓), U (口字型集合住宅), stepped (退縮商辦), box (標準長條街廓)
                        let shape = 'box';
                        if (r < 0.18) shape = 'chamfer';
                        else if (r < 0.32) shape = 'L';
                        else if (r < 0.40) shape = 'U';
                        else if (h > 22 && r < 0.58) shape = 'stepped';

                        // 材質與外觀
                        const matKey = pickVibrantMaterial(zone, h, r);
                        const rot = (r - 0.5) * 0.08; // 順應街廓微小自然旋轉

                        createDiverseTaiwanBuilding(u, v, w, d, h, rot, {
                            shapeType: shape,
                            matKey: matKey,
                            title: `${streetName} (${floors}層樓・${Math.round(h * 10) / 10}m)`,
                            category: category || (floors <= 3 ? '沿街透天厝/店面' : (floors <= 6 ? '步登老公寓' : (floors <= 12 ? '電梯華廈' : '高層商辦'))),
                            desc: `座落於士林街廓 (${Math.round(u)}, ${Math.round(v)})，${floors}層樓 (${Math.round(h)}m)，${shape === 'chamfer' ? '街角斜切' : (shape === 'L' ? 'L型通風' : (shape === 'U' ? '中庭社區' : (shape === 'stepped' ? '退縮階梯商辦' : '標準臨路')))}建築，設有防火巷與防撞退縮。`
                        });
                    }

                    v += stepV;
                    col++;
                }
                u += stepU;
                row++;
            }
        }

        // --------------------------------------------------------------------
        // 1. 北士科洲美科技園區 (福國路・福美路・福善路科技廠辦)
        // --------------------------------------------------------------------
        populateBlock({
            uStart: 14, uEnd: 305, vStart: 30, vEnd: 260,
            stepU: 12.0, stepV: 14.0, wBase: 9.8, dBase: 11.2,
            hMin: 14, hMax: 42, zone: 'tech',
            streetName: '北士科科技廠辦', category: '北士科現代化企業園區'
        });

        // --------------------------------------------------------------------
        // 2. 芝山站與文林北路西側、福華路、捷運東側生活圈 (雙溪以北)
        // --------------------------------------------------------------------
        // 2A. 文林北路西側 (德行西路生活圈)
        populateBlock({
            uStart: 815, uEnd: 875, vStart: 12, vEnd: 135,
            stepU: 7.8, stepV: 9.8, wBase: 6.4, dBase: 8.0,
            hMin: 11, hMax: 20, zone: 'walkup',
            streetName: '文林北路西側街廓', category: '芝山住宅生活圈'
        });

        // 2B. 文林北路與捷運淡水信義線之間街廓 (保留 16.5m 捷運全線淨空)
        populateBlock({
            uStart: 870, uEnd: 920, vStart: 12, vEnd: 135,
            stepU: 7.6, stepV: 9.8, wBase: 6.0, dBase: 7.8,
            hMin: 11, hMax: 18, zone: 'walkup',
            streetName: '文林北路・福華路街廓', category: '芝山捷運站旁住宅'
        });

        // 2C. 捷運淡水信義線東側 (福華路・中山北路六段側)
        populateBlock({
            uStart: 935, uEnd: 1018, vStart: 12, vEnd: 145,
            stepU: 8.6, stepV: 10.8, wBase: 7.2, dBase: 9.0,
            hMin: 14, hMax: 34, zone: 'mansion',
            streetName: '福華路電梯華廈', category: '天母芝山優質住宅區'
        });

        // --------------------------------------------------------------------
        // 3. 美崙街・文昌路老士林文教住宅聚落 (雙溪以南、新光醫院周邊)
        // --------------------------------------------------------------------
        // 3A. 文昌路醫療商業街・美崙街北段
        populateBlock({
            uStart: 750, uEnd: 960, vStart: 215, vEnd: 335,
            stepU: 7.8, stepV: 9.8, wBase: 6.4, dBase: 8.0,
            hMin: 11, hMax: 24, zone: 'old_shilin',
            streetName: '美崙街・文昌路商住街廓', category: '老士林傳統街廓住宅'
        });

        // 3B. 士林舊街・新光醫院東側至文林路
        populateBlock({
            uStart: 780, uEnd: 960, vStart: 340, vEnd: 435,
            stepU: 7.8, stepV: 9.8, wBase: 6.4, dBase: 8.0,
            hMin: 11, hMax: 22, zone: 'old_shilin',
            streetName: '士林舊街傳統步登公寓', category: '老士林傳統街廓住宅'
        });

        // --------------------------------------------------------------------
        // 4. 文林路東側與捷運士林站商圈 (文林路、福德路商圈)
        // --------------------------------------------------------------------
        populateBlock({
            uStart: 975, uEnd: 1018, vStart: 220, vEnd: 435,
            stepU: 8.6, stepV: 10.8, wBase: 7.2, dBase: 9.0,
            hMin: 18, hMax: 38, zone: 'commercial',
            streetName: '文林路士林夜市商圈建築', category: '捷運士林站核心商圈'
        });

        // --------------------------------------------------------------------
        // 5. 後港街・前港街・基河路大生活圈 (科教館與新光醫院以南、承德路以東)
        // --------------------------------------------------------------------
        // 5A. 後港街・前港街核心密集公寓與華廈
        populateBlock({
            uStart: 535, uEnd: 745, vStart: 380, vEnd: 525,
            stepU: 8.0, stepV: 10.0, wBase: 6.6, dBase: 8.2,
            hMin: 12, hMax: 36, zone: 'hougang',
            streetName: '後港街・前港街街廓建築', category: '後港前港住宅生活圈'
        });

        // 5B. 承德路五段與基河路景觀住宅段
        populateBlock({
            uStart: 405, uEnd: 520, vStart: 345, vEnd: 435,
            stepU: 8.6, stepV: 10.6, wBase: 7.0, dBase: 8.8,
            hMin: 14, hMax: 32, zone: 'hougang',
            streetName: '承德路・基河路高層住宅', category: '後港前港住宅生活圈'
        });

        // --------------------------------------------------------------------
        // 6. 士林中正路主要商業大道軸線 (東西向主幹道兩側商辦大樓)
        // --------------------------------------------------------------------
        populateBlock({
            uStart: 780, uEnd: 1018, vStart: 440, vEnd: 525,
            stepU: 8.6, stepV: 11.0, wBase: 7.4, dBase: 9.4,
            hMin: 18, hMax: 48, zone: 'commercial',
            streetName: '士林中正路主要商業大樓', category: '士林東西向主要商業軸線'
        });

        // --------------------------------------------------------------------
        // 7. 設置街廓區域懸浮標籤
        // --------------------------------------------------------------------
        addLabel(855, 75, 24, '🏙️ 芝山站・文林北路生活圈 (捷運全線高架淨空廊道)', 'text-amber-100 bg-slate-900/90 border-amber-400/60');
        addLabel(870, 310, 26, '🏘️ 美崙街・文昌路 (士林舊街傳統步登公寓與街角店面)', 'text-orange-100 bg-slate-900/90 border-orange-400/60');
        addLabel(630, 455, 38, '🏡 後港街・前港街・基河路住商大生活圈', 'text-cyan-100 bg-slate-900/90 border-cyan-400/60');
        addLabel(160, 160, 38, '🏗️ 北士科洲美科技園區 (現代化AI與科技廠辦聚落)', 'text-sky-200 bg-slate-900/90 border-sky-400/60');
        addLabel(920, 485, 34, '🏢 士林中正路主要商業商辦大樓群', 'text-emerald-200 bg-slate-900/90 border-emerald-400/60');
    }

    ns.UrbanDistricts = {
        buildUrbanDistricts
    };
})(window.ShilinDrone);

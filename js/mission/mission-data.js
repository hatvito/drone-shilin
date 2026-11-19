// ============================================================================
// js/mission/mission-data.js: 台北士林都會避障賽 - 六大戰術任務關卡設定與環境定義
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const MISSIONS = [
        {
            id: 'm1_speedrun',
            number: '01',
            title: '晴空直線飆速賽',
            subtitle: 'Clear Sky Speedrun',
            stars: 1,
            badge: '☀️ 晴空萬里',
            badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
            desc: '在萬里無雲的士林標準空域展開競速！無任何特種天候干擾，停機坪平坦安全，目標是追求最高推重比、最少負載與最優化直線航向！',
            envDetails: '晴天白晝 · 平坦屋頂停機坪 · 無電線干擾 · 零風速',
            hazards: [],
            weather: 'day',
            hasFog: false,
            hasWires: false,
            hasSlopedRoof: false,
            hasBirds: false,
            hasCrosswind: false,
            maxPayload: 600, // 總負重上限 (克)
            baseWeight: 280, // 基本空機重量
            batteryCapacitySec: 45.0, // 電池最大安全滯空秒數
            recommendedSensors: ['16 向光達'],
            targetScoreSec: 18.0
        },
        {
            id: 'm2_alley_wind',
            number: '02',
            title: '老街夾縫與穿堂側風',
            subtitle: 'Alleyway Crosswind Challenge',
            stars: 2,
            badge: '🏙️ 穿堂側風',
            badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
            desc: '士林老街區樓宇密集，兩棟大樓之間的夾縫通道僅有 3~5 米寬，且不時伴隨大樓峽谷穿堂側風！極度考驗近距超音波氣墊反彈力場。',
            envDetails: '密集巷弄 · 穿堂強陣風 (3.5 m/s) · 棟距狹窄',
            hazards: ['crosswind', 'narrow_alley'],
            weather: 'sunset',
            hasFog: false,
            hasWires: false,
            hasSlopedRoof: false,
            hasBirds: false,
            hasCrosswind: true,
            maxPayload: 700,
            baseWeight: 280,
            batteryCapacitySec: 50.0,
            recommendedSensors: ['四周近距超音波', '16 向光達'],
            targetScoreSec: 22.0
        },
        {
            id: 'm3_sloped_roof',
            number: '03',
            title: '斜面鐵皮屋頂險降救援',
            subtitle: 'Sloped Roof Air-Drop',
            stars: 3,
            badge: '🏥 斜頂降落',
            badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
            desc: '緊急醫療物資空投任務！目標大樓頂樓設有高低起伏的鐵皮斜屋頂（傾角 18 度）與不鏽鋼水塔，若未校正地表傾角直接著陸將瞬間翻覆！',
            envDetails: '斜坡屋頂 (傾角 15~20°) · 水塔避雷針 · 嚴格平穩著陸判定',
            hazards: ['sloped_roof'],
            weather: 'day',
            hasFog: false,
            hasWires: false,
            hasSlopedRoof: true,
            hasBirds: false,
            hasCrosswind: false,
            maxPayload: 750,
            baseWeight: 280,
            batteryCapacitySec: 55.0,
            recommendedSensors: ['下視 ToF 測距儀', '16 向光達'],
            targetScoreSec: 24.0
        },
        {
            id: 'm4_overhead_wires',
            number: '04',
            title: '低空穿越高壓細電線網',
            subtitle: 'Wire Strike Defense',
            stars: 4,
            badge: '⚡ 高空電纜',
            badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
            desc: '士林老街上空縱橫交錯著高壓電纜與細黑天線鋼纜，光達水平掃描束極易穿透漏抓！必須依賴雙目立體相機深度矩陣提前辨識並翻越。',
            envDetails: '街道低空電線網 · 避雷細鋼索 · 光達偵測盲區',
            hazards: ['overhead_wires'],
            weather: 'sunset',
            hasFog: false,
            hasWires: true,
            hasSlopedRoof: false,
            hasBirds: false,
            hasCrosswind: false,
            maxPayload: 800,
            baseWeight: 280,
            batteryCapacitySec: 55.0,
            recommendedSensors: ['雙目立體相機', '16 向光達'],
            targetScoreSec: 25.0
        },
        {
            id: 'm5_dense_fog_birds',
            number: '05',
            title: '基隆河畔濃霧與動態飛鳥',
            subtitle: 'Misty River & Dynamic Birds',
            stars: 4,
            badge: '🌫️ 濃霧飛鳥',
            badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
            desc: '基隆河畔清晨突發濃霧，光學相機與雷射視距驟降 75%！空中更有低空飛掠的麻雀與白鷺鷥群，必須仰賴 4D 毫米波都卜勒雷達穿透迷霧並規避動態飛鳥。',
            envDetails: '濃霧迷濛 (視距僅 25m) · 動態飛鳥群 (都卜勒速度 4 m/s)',
            hazards: ['fog', 'birds'],
            weather: 'night',
            hasFog: true,
            hasWires: false,
            hasSlopedRoof: false,
            hasBirds: true,
            hasCrosswind: false,
            maxPayload: 850,
            baseWeight: 280,
            batteryCapacitySec: 60.0,
            recommendedSensors: ['4D 毫米波都卜勒雷達', '超音波'],
            targetScoreSec: 28.0
        },
        {
            id: 'm6_endless_sandbox',
            number: '06',
            title: '全天候突發障礙大師賽',
            subtitle: 'Grandmaster Multi-Hazard Sandbox',
            stars: 5,
            badge: '👑 終極大師',
            badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
            desc: '極限全感知考驗！結合老街狹巷側風、突發迷霧、高壓電纜與斜頂降落，無人機必須精算 SWaP 負重與功耗預算，打造全天候魯棒性避障大師演算法！',
            envDetails: '全複合障礙 · 突發陣風 · 細電線 · 斜坡屋頂 · 嚴格 SWaP 預算',
            hazards: ['fog', 'birds', 'overhead_wires', 'sloped_roof', 'crosswind'],
            weather: 'sunset',
            hasFog: true,
            hasWires: true,
            hasSlopedRoof: true,
            hasBirds: true,
            hasCrosswind: true,
            maxPayload: 900,
            baseWeight: 280,
            batteryCapacitySec: 65.0,
            recommendedSensors: ['全感測器融合', '雙目視覺', '毫米波雷達', 'ToF'],
            targetScoreSec: 32.0
        }
    ];

    function getMissionById(id) {
        return MISSIONS.find(m => m.id === id) || MISSIONS[0];
    }

    ns.MissionData = {
        MISSIONS,
        getMissionById
    };
})(window.ShilinDrone);

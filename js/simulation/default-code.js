// ============================================================================
// js/simulation/default-code.js: 預設學生控制器演算法範本與 AI 提示詞
// 支援三級難度自適應演算法代碼與提示詞 (🟢 入門 40m / 🟡 標準 25m / 🔴 極限 15m)
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    function getDefaultCode(diff = 'normal') {
        const isEasy = diff === 'easy';
        const isHard = diff === 'hard';
        const speed = isEasy ? 12.5 : (isHard ? 9.5 : 11.0);
        const cruiseAlt = isEasy ? 24.0 : (isHard ? 8.5 : 12.5);
        const maxAlt = isEasy ? 40.0 : (isHard ? 15.0 : 25.0);
        const ceilingClamp = isEasy ? 37.0 : (isHard ? 13.0 : 23.0);
        const diffName = isEasy ? '🟢 入門巡航模式：限高 40.0m' : (isHard ? '🔴 極限巷戰模式：限高 15.0m' : '🟡 標準競賽模式：限高 25.0m');
        const cruiseDesc = isEasy ? '巡航高度約 24m，可越過普通公寓，須避開高樓華廈' : (isHard ? '貼地巡航高度約 8.5m，強制於馬路、巷弄與河道穿梭，嚴禁越頂' : '穿梭於 3~4 樓巷弄間，嚴禁超過 25m');

        return `class StudentController {
    constructor(goal_pos) {
        // goal_pos: 終點停機坪座標數組 [gx, gy, gz]
        this.goal = goal_pos.slice();

        // ★ 關鍵參數宣告區（${diffName}）
        this.speed = ${speed.toFixed(1)};            // 最高巡航速度 (m/s，建議 6~14)
        this.cruiseAltitude = ${cruiseAlt.toFixed(1)};   // 巡航高度 (m，${cruiseDesc}，限高 ${maxAlt.toFixed(0)}m)
        this.sensorRange = 22.0;      // 光達感測距離 (m，建議 15~30，提早偵測街角與大樓外牆)
        this.repulsePower = 24.0;     // 障礙物推開強度 (建議 15~35，數值越大閃越遠)
        this.safeBrakeDist = 7.5;     // 動態安全煞車距離 (m，小於此距離時減速轉彎)
        this.rayCount = 16;           // 水平環景光達射線數量 (建議 16~24)
    }

    get_velocity(current_pos, raycast_func, dt) {
        const [x, y, z] = current_pos;
        const [gx, gy, gz] = this.goal;

        // 1. 計算水平距離與目標方向
        const dx = gx - x;
        const dz = gz - z;
        const horizDist = Math.hypot(dx, dz);

        // 高度控制：距離終點 > 18m 時維持在 ${cruiseAlt.toFixed(1)}m 巡航高度；接近終點時平滑對齊屋頂停機坪 gy
        let targetY = (horizDist > 18.0) ? this.cruiseAltitude : gy;
        targetY = Math.min(${ceilingClamp.toFixed(1)}, Math.max(3.5, targetY));

        const dy = targetY - y;
        const dist3D = Math.hypot(dx, dy, dz) || 1e-5;

        let desiredSpeed = Math.min(this.speed, dist3D * 1.1);
        let vx = (dx / dist3D) * desiredSpeed;
        let vy = (dy / dist3D) * desiredSpeed;
        let vz = (dz / dist3D) * desiredSpeed;

        // 2. 水平環景多向虛擬光達排斥力 + 切線繞行輔助
        let repX = 0, repY = 0, repZ = 0;
        let minFrontDist = this.sensorRange;

        for (let i = 0; i < this.rayCount; i++) {
            const angle = (i / this.rayCount) * Math.PI * 2;
            const rdx = Math.cos(angle);
            const rdz = Math.sin(angle);
            const d = raycast_func(current_pos, [rdx, 0, rdz], this.sensorRange);

            if (d < this.sensorRange) {
                const ratio = (this.sensorRange - d) / this.sensorRange;
                const factor = ratio * ratio * this.repulsePower;
                repX -= (rdx - rdz * 0.35) * factor;
                repZ -= (rdz + rdx * 0.35) * factor;
                if (d < minFrontDist) minFrontDist = d;
            }
        }

        // 3. 垂直防撞探測與限高保護 (${maxAlt.toFixed(0)}m 限高)
        const dDown = raycast_func(current_pos, [0, -1, 0], 6.0);
        if (dDown < 2.5 && y < ${ceilingClamp.toFixed(1)}) {
            repY += (2.5 - dDown) * 3.5;
        }
        if (y > ${(maxAlt - 2.5).toFixed(1)}) {
            repY -= (y - ${(maxAlt - 2.5).toFixed(1)}) * 12.0;
        }

        // 4. 動態安全煞車機制
        if (minFrontDist < this.safeBrakeDist) {
            const brakeScale = Math.max(0.25, minFrontDist / this.safeBrakeDist);
            vx *= brakeScale;
            vz *= brakeScale;
        }

        let outVx = vx + repX;
        let outVy = vy + repY;
        let outVz = vz + repZ;

        const finalSpd = Math.hypot(outVx, outVy, outVz);
        if (finalSpd > this.speed) {
            const s = this.speed / finalSpd;
            outVx *= s; outVy *= s; outVz *= s;
        }

        return [outVx, outVy, outVz];
    }
}`;
    }

    function getAiPrompt(diff = 'normal') {
        const isEasy = diff === 'easy';
        const isHard = diff === 'hard';
        const maxAlt = isEasy ? 40.0 : (isHard ? 15.0 : 25.0);
        const cruiseAlt = isEasy ? 24.0 : (isHard ? 8.5 : 12.5);
        const diffTitle = isEasy ? '【🟢 入門巡航難度】' : (isHard ? '【🔴 極限巷戰難度】' : '【🟡 標準競賽難度】');
        const diffDesc = isEasy
            ? `當前空域限高為 40.0m。無人機可飛越一般 4~5 樓老公寓，但必須自主避開 10 樓以上華廈、科技廠辦與摩天大樓。建議巡航高度約 22~28m。`
            : (isHard
                ? `當前空域限高為嚴格 15.0m！嚴禁飛越公寓屋頂！無人機強制只能在寬闊幹道（承德路、基河路、文林路）、街廓小巷與雙溪河道貼地穿梭。建議巡航高度約 7~10m。`
                : `當前空域限高為嚴格 25.0m！經典都會峽谷穿梭模式。絕大多數大樓與公寓皆無法直接無腦飛越，必須在街道與巷弄間水平穿梭繞障。建議巡航高度約 11~14m。`);

        return `============================================================
【第一部分：演算法策略需求 ${diffTitle}】
============================================================
請根據以下構想設計「台北士林都會區・避障導航」邏輯（你可以自由添加或替換為其他演算法）：
1. 複合式導航：以朝向終點停機坪的引力為基準，並結合多向虛擬光達排斥力（人工位能場 APF）與側向切線繞行力。
2. 動態安全煞車：當光達探測到距離大樓外牆、頂樓鐵皮加蓋或水塔小於安全門檻時，主動降低前進速度，避免高速慣性煞停不及撞牆。
3. 盲區強化：射線密度建議為 16 向以上水平環景（或針對前進方向錐形加密），並搭配上下垂直探測避免擦撞地面或女兒牆。
4. 防火巷死胡同脫困狀態機：士林美崙街與文昌路有大量狹窄防火巷與 L 型街角屋，若連續一段時間位移極小（卡在局部極小值受力平衡），請切換為後退並沿開闊側橫移繞行，脫困後再恢復巡航。
5. 空域限高規範（★ 重要）：
   ${diffDesc}
   超高（y > ${maxAlt.toFixed(1)}m）或觸地（y <= 0）將立即判定失事墜毀！請務必設置嚴格的垂直速度限制保護。

============================================================
【第二部分：世界環境與物理規則（固定規格，不可變更）】
============================================================
1. 地圖空域範圍：台北士林／北士科真實比例街廓（寬 1024 × 深 534），中心座標範圍：東西向 X∈[-512.0, 512.0]，南北向 Z∈[-267.0, 267.0]（超出邊界視為失事墜毀）。
2. 起點位置：隨機種子 (0000~9999) 選定之「翡翠綠」大樓屋頂停機坪。
3. 終點目標：隨機種子選定之「流金黃」大樓屋頂停機坪。
4. 機體大小：無人機為半徑 0.25 公尺的穿梭機（具備精準 AABB 包圍盒與 CCD 連續碰撞細分檢測，不可撞牆或墜地）。
5. 當前空域限高：最高高度嚴格限制為 ${maxAlt.toFixed(1)} 公尺（y <= 0 觸地或 y > ${maxAlt.toFixed(1)} 超高會立即違規墜毀！禁止利用高空直線飛越）。
6. 計分機制：進入終點停機坪中心 1.5 公尺內即完成任務；失事時計算「失事點至終點的 3D 直線剩餘距離」，越短名次越高。

============================================================
【第三部分：程式碼輸出規範（★ 參數易讀性與中文註解要求）】
============================================================
為了讓初學學生方便閱讀程式碼與自主微調測試，請務必嚴格遵守：
1. 【參數透明化】：所有控制避障強度、航行速度、巡航高度、安全煞車距離、光達射線數量的「關鍵常數」，請務必統一宣告在 constructor 內（例如 \`this.speed\`、\`this.sensorRange\` 等）。
2. 【繁體中文註解】：在每個關鍵參數宣告後方，必須附上清晰的單行繁體中文註解，說明其「中文意義」、「單位」以及「調大/調小的影響（或建議數值區間）」。
   範例格式：
   this.speed = 11.0;            // 最高巡航速度 (m/s，建議 6~14，數值越高越快但轉彎半徑大)
   this.cruiseAltitude = ${cruiseAlt.toFixed(1)};   // 巡航基準高度 (m，嚴禁超過 ${maxAlt.toFixed(1)}m 限高)
   this.sensorRange = 22.0;      // 光達感測距離 (m，越遠越能提早轉向，但太遠易受無關建築干擾)
   this.repulsePower = 24.0;     // 障礙物推開強度 (數值越大閃越遠，但太大容易在狹道劇烈震盪)

============================================================
【第四部分：系統必要代碼介面（★ 絕對不可修改類別名與函式簽章）】
============================================================
請嚴格保證輸出符合以下類別定義與函式簽章，勿使用任何未定義的外部套件：

class StudentController {
    constructor(goal_pos) {
        // goal_pos: 終點座標數組 [gx, gy, gz]
        this.goal = goal_pos.slice();

        // ★ 請在此處宣告各項關鍵參數，並加上清楚的繁體中文註解說明
        this.speed = 11.0;            // 巡航速度 (m/s)
        this.cruiseAltitude = ${cruiseAlt.toFixed(1)};   // 巡航基準高度 (m，限高 ${maxAlt.toFixed(1)}m)
    }

    get_velocity(current_pos, raycast_func, dt) {
        /**
         * 參數說明：
         * - current_pos: 當前無人機中心座標 [x, y, z]
         * - raycast_func(origin, direction, max_dist=45.0):
         *     虛擬光達測距函式。
         *     origin: 測距起點 [x, y, z]
         *     direction: 3D 向量 [dx, dy, dz]
         *     max_dist: 最大感測距離（預設 45.0）
         *     回傳值: float（至建築物外牆的淨空距離；前方無障礙則回傳 max_dist）
         * - dt: 該影格的時間差 (約 0.016 ~ 0.033 秒)
         * 
         * 必要回傳值：
         * - 必須回傳一個 3D 速度向量數組 [vx, vy, vz]
         */
        
        // --- 請在此處實作你的避障與導航邏輯 ---

        return [0, 0, 0];
    }
}

請直接輸出完整且乾淨的 JavaScript 類別程式碼。`;
    }

    const DEFAULT_CODE = getDefaultCode('normal');
    const AI_PROMPT_TEXT = getAiPrompt('normal');

    ns.DefaultCode = {
        DEFAULT_CODE,
        AI_PROMPT_TEXT,
        getDefaultCode,
        getAiPrompt
    };
})(window.ShilinDrone);

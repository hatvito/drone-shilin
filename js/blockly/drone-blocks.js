// ============================================================================
// js/blockly/drone-blocks.js: 台北士林無人機避障挑戰賽 - 自訂 Blockly 積木定義
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    function initDroneBlocks() {
        if (typeof Blockly === 'undefined') return;

        // 1. 核心根節點積木：當無人機每步航行時
        Blockly.Blocks['drone_on_step'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🛸 當無人機每步航行時 (計算航向與速度)");
                this.appendStatementInput("DO")
                    .setCheck(null)
                    .appendField("執行避障策略:");
                this.setColour(35); // 琥珀金
                this.setTooltip("每一模擬影格 (dt) 呼叫一次，無人機會根據內部組裝的積木邏輯決定當前航速與避障方向。");
                this.setHelpUrl("");
                this.setDeletable(false);
            }
        };

        // 2. 巡航速度設定
        Blockly.Blocks['drone_set_cruise_speed'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("⚡ 設定前進巡航速度為")
                    .appendField(new Blockly.FieldNumber(11.5, 1.0, 18.0, 0.5), "SPEED")
                    .appendField("公尺/秒");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(200); // 湛藍
                this.setTooltip("設定向終點停機坪推進的基本航速 (最大上限 18.0 m/s)。");
                this.setHelpUrl("");
            }
        };

        // 3. 巡航高度鎖定
        Blockly.Blocks['drone_set_cruise_altitude'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🏔️ 鎖定飛行巡航高度為")
                    .appendField(new Blockly.FieldNumber(12.5, 2.0, 40.0, 0.5), "ALTITUDE")
                    .appendField("公尺 (限高內)");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(200); // 湛藍
                this.setTooltip("平滑維持在特定巡航高度，請注意不能高於當前難度空域限高 (入門40m / 標準25m / 極限15m)。");
                this.setHelpUrl("");
            }
        };

        // 4. 16 向虛擬光達自動環周排斥避障
        Blockly.Blocks['drone_auto_lidar_repulsion'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("📡 啟用 16 向光達環周排斥力場")
                    .appendField("(警戒距")
                    .appendField(new Blockly.FieldNumber(15.0, 5.0, 30.0, 1.0), "RADIUS")
                    .appendField("m, 斥力")
                    .appendField(new Blockly.FieldNumber(2.2, 0.5, 10.0, 0.2), "FORCE")
                    .appendField(")");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(270); // 紫色
                this.setTooltip("自動發射 16 向水平光達雷射，當探測到大樓障礙物小於警戒距離時，自動朝反方向施加推力彈開！");
                this.setHelpUrl("");
            }
        };

        // 5. 特定方向障礙物測距
        Blockly.Blocks['drone_raycast_distance'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("探測")
                    .appendField(new Blockly.FieldDropdown([
                        ["前方 (0°)", "FRONT"],
                        ["左前方 (-45°)", "LEFT_FRONT"],
                        ["右前方 (45°)", "RIGHT_FRONT"],
                        ["正左方 (-90°)", "LEFT"],
                        ["正右方 (90°)", "RIGHT"],
                        ["終點前進方向", "TOWARDS_GOAL"]
                    ]), "DIR")
                    .appendField("障礙物距離 (射程")
                    .appendField(new Blockly.FieldNumber(25.0, 5.0, 60.0, 5.0), "RANGE")
                    .appendField("m)");
                this.setOutput(true, "Number");
                this.setColour(185); // 青色
                this.setTooltip("發射一條雷射探測光束，回傳指定方向到最近建築物表面的距離 (若無障礙物則回傳設定的最大射程)。");
                this.setHelpUrl("");
            }
        };

        // 6. 16 向光達最近障礙物距離
        Blockly.Blocks['drone_lidar_min_distance'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("📡 16 向光達四周【最近障礙物距離】");
                this.setOutput(true, "Number");
                this.setColour(185);
                this.setTooltip("回傳周遭 360 度 16 向虛擬光達中，距離大樓最近的那條雷射讀數。");
                this.setHelpUrl("");
            }
        };

        // 7. 終點剩餘直線水平距離
        Blockly.Blocks['drone_target_distance'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🏁 到終點停機坪的【水平剩餘距離】");
                this.setOutput(true, "Number");
                this.setColour(150); // 翠綠
                this.setTooltip("回傳無人機目前到終點停機坪的水平直線距離 (公尺)。");
                this.setHelpUrl("");
            }
        };

        // 8. 目前飛行高度
        Blockly.Blocks['drone_current_altitude'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("📏 目前無人機飛行高度 (Y)");
                this.setOutput(true, "Number");
                this.setColour(150);
                this.setTooltip("回傳無人機離地面的公尺高度。");
                this.setHelpUrl("");
            }
        };

        // 9. 緊急轉向偏向避障
        Blockly.Blocks['drone_steer_dodge'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🚨 緊急向")
                    .appendField(new Blockly.FieldDropdown([
                        ["正左方偏轉", "LEFT"],
                        ["正右方偏轉", "RIGHT"],
                        ["上方爬升", "UP"],
                        ["反方向後退", "BACK"]
                    ]), "DIR")
                    .appendField("施加避障推力")
                    .appendField(new Blockly.FieldNumber(5.0, 1.0, 15.0, 0.5), "POWER");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(0); // 紅色
                this.setTooltip("在當前飛行向量上，立即疊加一個強烈的側向推力，以迅速避開迎面而來的高樓。");
                this.setHelpUrl("");
            }
        };

        // 10. 前方危急減速
        Blockly.Blocks['drone_emergency_brake'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🛑 前方危急減速避碰 (減速為原本的")
                    .appendField(new Blockly.FieldNumber(50, 10, 90, 10), "PERCENT")
                    .appendField("%)");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(0);
                this.setTooltip("降低前進航速，爭取雷達探測與繞過障礙物的時間。");
                this.setHelpUrl("");
            }
        };

        // 11. 手動自訂航向速度向量
        Blockly.Blocks['drone_custom_velocity'] = {
            init: function() {
                this.appendValueInput("VX")
                    .setCheck("Number")
                    .appendField("✈️ 覆寫速度向量 VX");
                this.appendValueInput("VY")
                    .setCheck("Number")
                    .appendField("VY (垂直升降)");
                this.appendValueInput("VZ")
                    .setCheck("Number")
                    .appendField("VZ");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(210);
                this.setTooltip("高級進階控制：直接計算並覆寫三維航向速度分量。");
                this.setHelpUrl("");
            }
        };

        // ====================================================================
        // 🔋 動力電池與節能巡航積木
        // ====================================================================
        // 12. 讀取目前剩餘電量百分比
        Blockly.Blocks['drone_get_battery'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🔋 目前剩餘電量百分比 (%)");
                this.setOutput(true, "Number");
                this.setColour(140);
                this.setTooltip("回傳無人機目前鋰電池剩餘百分比 (100% ~ 0%)，電量耗盡時將失事墜毀。");
                this.setHelpUrl("");
            }
        };

        // 13. 電池處於低電量警戒判定
        Blockly.Blocks['drone_is_low_battery'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("⚠️ 電池處於低電量 (低於")
                    .appendField(new Blockly.FieldNumber(25, 5, 50, 5), "THRESHOLD")
                    .appendField("%)");
                this.setOutput(true, "Boolean");
                this.setColour(140);
                this.setTooltip("判斷當前電池是否已進入低電量警戒區，可用於觸發節能巡航或提前返航下降。");
                this.setHelpUrl("");
            }
        };

        // 14. 啟用節能巡航省電模式
        Blockly.Blocks['drone_enable_eco_mode'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🌿 啟用節能巡航模式 (限速")
                    .appendField(new Blockly.FieldNumber(9.0, 5.0, 12.0, 0.5), "SPEED")
                    .appendField("m/s, 降低 30% 耗電)");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(140);
                this.setTooltip("限制無人機最高推力，使動力電池每秒消耗速率減少 30%，大幅增加滯空時間！");
                this.setHelpUrl("");
            }
        };

        // ====================================================================
        // ⚖️ SWaP 負重與配額檢視積木
        // ====================================================================
        // 15. 讀取目前總配重
        Blockly.Blocks['drone_get_total_payload'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("⚖️ 無人機目前總配重 (含感測器) (g)");
                this.setOutput(true, "Number");
                this.setColour(45);
                this.setTooltip("回傳機身基本空重加上所有啟用感測器的總重量 (公克)。");
                this.setHelpUrl("");
            }
        };

        // 16. 讀取當前關卡負重配額上限
        Blockly.Blocks['drone_get_payload_limit'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("📦 當前任務【負重上限】(g)");
                this.setOutput(true, "Number");
                this.setColour(45);
                this.setTooltip("回傳本關卡最大允許起飛總重量，若超重將大幅增加轉彎慣性、煞車距離與電池消耗。");
                this.setHelpUrl("");
            }
        };

        // ====================================================================
        // 👁️ 雙目立體視覺感測器積木 (抓高空細電線)
        // ====================================================================
        // 17. 雙目立體視覺探測細電線距離
        Blockly.Blocks['drone_stereo_detect_wire'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("👁️ 雙目視覺探測前方細電纜距離 (基線")
                    .appendField(new Blockly.FieldNumber(15, 8, 30, 1), "BASELINE")
                    .appendField("cm, 射程")
                    .appendField(new Blockly.FieldNumber(20, 5, 40, 5), "RANGE")
                    .appendField("m)");
                this.setOutput(true, "Number");
                this.setColour(290);
                this.setTooltip("利用雙鏡頭基線視差深度矩陣，精準探測水平光達容易穿透漏抓的街道細電纜與天線鋼索。");
                this.setHelpUrl("");
            }
        };

        // 18. 雙目細電線危急預警
        Blockly.Blocks['drone_stereo_wire_warning'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("⚡ 雙目預警：前方")
                    .appendField(new Blockly.FieldNumber(12, 3, 25, 1), "DISTANCE")
                    .appendField("m 內存在高壓細電纜");
                this.setOutput(true, "Boolean");
                this.setColour(290);
                this.setTooltip("當前方特定距離內偵測到懸空細電纜時回傳 true，供條件式進行緊急翻越或爬升決策。");
                this.setHelpUrl("");
            }
        };

        // ====================================================================
        // 📡 4D 毫米波都卜勒雷達積木 (穿透濃霧抓動態飛鳥)
        // ====================================================================
        // 19. 4D 毫米波雷達探測動態物體距離
        Blockly.Blocks['drone_radar_detect_moving'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("📡 4D 毫米波雷達探測動態飛鳥距離 (速度 >")
                    .appendField(new Blockly.FieldNumber(2.0, 0.5, 8.0, 0.5), "MIN_SPEED")
                    .appendField("m/s)");
                this.setOutput(true, "Number");
                this.setColour(190);
                this.setTooltip("發射毫米波雷達射頻，完全無視濃霧阻隔，利用都卜勒頻移精準偵測前方逼近的動態物體（如低空飛鳥）相對距離。");
                this.setHelpUrl("");
            }
        };

        // 20. 毫米波雷達飛鳥逼近預警
        Blockly.Blocks['drone_radar_has_incoming_threat'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🐦 毫米波雷達預警：")
                    .appendField(new Blockly.FieldNumber(15, 5, 30, 2), "DISTANCE")
                    .appendField("m 內有飛鳥高速迎面逼近");
                this.setOutput(true, "Boolean");
                this.setColour(190);
                this.setTooltip("判定前方特定距離內是否有迎面而來的動態飛鳥威脅。");
                this.setHelpUrl("");
            }
        };

        // ====================================================================
        // 📐 下視 ToF 測距儀積木 (斜頂傾角降落與離地淨高)
        // ====================================================================
        // 21. 下視 ToF 探測著陸表面斜率角度
        Blockly.Blocks['drone_tof_surface_slope'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("📐 下視 ToF 探測著陸屋頂【傾斜角度】(度)");
                this.setOutput(true, "Number");
                this.setColour(30);
                this.setTooltip("測量無人機正下方目標著陸面的坡度角。若降落在大於 15° 的傾斜鐵皮屋頂上，直接關閉馬達將導致側翻墜樓！");
                this.setHelpUrl("");
            }
        };

        // 22. 下視 ToF 精準離地淨高 (AGL)
        Blockly.Blocks['drone_tof_ground_clearance'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("📏 下視 ToF 精準離地淨高 (AGL m)");
                this.setOutput(true, "Number");
                this.setColour(30);
                this.setTooltip("垂直向下發射紅外雷射，精準量測無人機與下方建築屋頂或地面的實際垂直距離。");
                this.setHelpUrl("");
            }
        };

        // ====================================================================
        // 🔊 四周近距超音波氣墊陣列積木 (老街狹巷反彈)
        // ====================================================================
        // 23. 四周超音波近距氣墊自動反彈力場
        Blockly.Blocks['drone_ultrasonic_cushion'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🔊 啟用四周超音波氣墊反彈 (緩衝距")
                    .appendField(new Blockly.FieldNumber(2.5, 1.0, 5.0, 0.5), "DISTANCE")
                    .appendField("m, 推力")
                    .appendField(new Blockly.FieldNumber(4.0, 1.0, 8.0, 0.5), "FORCE")
                    .appendField(")");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(220);
                this.setTooltip("模擬四周近距高頻超音波聲納，當被穿堂側風吹向狹窄巷弄牆面時，自動產生強烈反彈推力彈開！");
                this.setHelpUrl("");
            }
        };

        // 24. 四周超音波探測最近夾縫牆面距離
        Blockly.Blocks['drone_ultrasonic_min_distance'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🔊 超音波探測周圍【最近狹巷牆面距離】(m)");
                this.setOutput(true, "Number");
                this.setColour(220);
                this.setTooltip("回傳無人機四周 5 米以內與兩側街屋牆面的最短距離。");
                this.setHelpUrl("");
            }
        };

        // ====================================================================
        // 🌀 單眼光流與抗風補償積木
        // ====================================================================
        // 25. 光流估算側向風切漂移速度
        Blockly.Blocks['drone_optical_flow_drift'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🌀 單眼光流估算【側向風切漂移速度】(m/s)");
                this.setOutput(true, "Number");
                this.setColour(240);
                this.setTooltip("透過地面紋理運動視差，精確估算無人機被穿堂側風推移的側向漂移速率。");
                this.setHelpUrl("");
            }
        };

        // 26. 光流自動抗風補償
        Blockly.Blocks['drone_optical_flow_wind_compensation'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🌀 啟用光流自動抗風補償 (抵抗穿堂風偏推)");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(240);
                this.setTooltip("根據光流估算的側向風切漂移量，自動向反方向注入等量平衡推力，抵消側風干擾。");
                this.setHelpUrl("");
            }
        };

        console.log('[Blockly] 無人機自訂積木庫註冊完成');
    }

    ns.BlocklyBlocks = {
        initDroneBlocks
    };
})(window.ShilinDrone);

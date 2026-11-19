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

        console.log('[Blockly] 無人機自訂積木庫註冊完成');
    }

    ns.BlocklyBlocks = {
        initDroneBlocks
    };
})(window.ShilinDrone);

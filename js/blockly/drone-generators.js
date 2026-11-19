// ============================================================================
// js/blockly/drone-generators.js: Blockly 積木轉 JavaScript 避障演算法生成器
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    function initDroneGenerators() {
        const jsGen = (typeof javascript !== 'undefined' && javascript.javascriptGenerator)
            ? javascript.javascriptGenerator
            : (typeof Blockly !== 'undefined' ? Blockly.JavaScript : null);

        if (!jsGen) return;

        // 1. 核心根節點積木生成器
        jsGen['drone_on_step'] = function(block) {
            const branch = jsGen.statementToCode(block, 'DO');
            const code = `
class StudentController {
    constructor(goal_pos) {
        this.goal = goal_pos;
        this.speed = 11.5;
        this.cruiseAltitude = 12.5;
    }

    get_velocity(current_pos, raycast, dt) {
        const [x, y, z] = current_pos;
        const [gx, gy, gz] = this.goal;
        const dx = gx - x;
        const dz = gz - z;
        const horizDist = Math.max(0.001, Math.hypot(dx, dz));

        let currentSpeed = this.speed;
        let targetAlt = this.cruiseAltitude;

        // 朝終點停機坪方向之基準速度向量
        let vx = (dx / horizDist) * currentSpeed;
        let vy = (targetAlt - y) * 2.2;
        let vz = (dz / horizDist) * currentSpeed;

        // === 學生 Blockly 積木邏輯區段開始 ===
${branch}
        // === 學生 Blockly 積木邏輯區段結束 ===

        // 物理極限安全防護 (最大速率 18 m/s)
        const speedMagnitude = Math.hypot(vx, vy, vz);
        if (speedMagnitude > 18.0) {
            const scale = 18.0 / speedMagnitude;
            vx *= scale;
            vy *= scale;
            vz *= scale;
        }

        return [vx, vy, vz];
    }
}
`;
            return code;
        };

        // 2. 巡航速度設定
        jsGen['drone_set_cruise_speed'] = function(block) {
            const speed = Number(block.getFieldValue('SPEED')) || 11.5;
            return `        currentSpeed = ${speed};\n        vx = (dx / horizDist) * currentSpeed;\n        vz = (dz / horizDist) * currentSpeed;\n`;
        };

        // 3. 巡航高度鎖定
        jsGen['drone_set_cruise_altitude'] = function(block) {
            const alt = Number(block.getFieldValue('ALTITUDE')) || 12.5;
            return `        targetAlt = ${alt};\n        vy = (targetAlt - y) * 2.2;\n`;
        };

        // 4. 16 向虛擬光達自動環周排斥避障
        jsGen['drone_auto_lidar_repulsion'] = function(block) {
            const radius = Number(block.getFieldValue('RADIUS')) || 15.0;
            const force = Number(block.getFieldValue('FORCE')) || 2.2;
            return `
        // [積木] 16 向光達環周排斥力場
        for (let _i = 0; _i < 16; _i++) {
            const _rad = (_i / 16) * Math.PI * 2;
            const _rDir = [Math.sin(_rad), 0, Math.cos(_rad)];
            const _dist = raycast(current_pos, _rDir, ${radius});
            if (_dist < ${radius}) {
                const _push = (${radius} - _dist) * ${force};
                vx -= _rDir[0] * _push;
                vz -= _rDir[2] * _push;
            }
        }\n`;
        };

        // 5. 探測指定方向障礙物距離
        jsGen['drone_raycast_distance'] = function(block) {
            const dir = block.getFieldValue('DIR');
            const range = Number(block.getFieldValue('RANGE')) || 25.0;

            let dirCode = `[dx / horizDist, 0, dz / horizDist]`;
            if (dir === 'LEFT') {
                dirCode = `[-dz / horizDist, 0, dx / horizDist]`;
            } else if (dir === 'RIGHT') {
                dirCode = `[dz / horizDist, 0, -dx / horizDist]`;
            } else if (dir === 'LEFT_FRONT') {
                dirCode = `[((dx - dz) * 0.707) / horizDist, 0, ((dz + dx) * 0.707) / horizDist]`;
            } else if (dir === 'RIGHT_FRONT') {
                dirCode = `[((dx + dz) * 0.707) / horizDist, 0, ((dz - dx) * 0.707) / horizDist]`;
            } else if (dir === 'TOWARDS_GOAL') {
                dirCode = `[dx / horizDist, (gy - y) / horizDist, dz / horizDist]`;
            }

            const code = `raycast(current_pos, ${dirCode}, ${range})`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // 6. 16 向光達四周最近障礙物距離
        jsGen['drone_lidar_min_distance'] = function(block) {
            const code = `(function() {
            let _min = 999;
            for (let _i = 0; _i < 16; _i++) {
                const _rad = (_i / 16) * Math.PI * 2;
                const _d = raycast(current_pos, [Math.sin(_rad), 0, Math.cos(_rad)], 30.0);
                if (_d < _min) _min = _d;
            }
            return _min;
        })()`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // 7. 到終點停機坪水平距離
        jsGen['drone_target_distance'] = function(block) {
            return ['horizDist', jsGen.ORDER_ATOMIC || 0];
        };

        // 8. 目前飛行高度
        jsGen['drone_current_altitude'] = function(block) {
            return ['y', jsGen.ORDER_ATOMIC || 0];
        };

        // 9. 緊急向指定方向偏向避障
        jsGen['drone_steer_dodge'] = function(block) {
            const dir = block.getFieldValue('DIR');
            const power = Number(block.getFieldValue('POWER')) || 5.0;

            if (dir === 'LEFT') {
                return `        vx += (-dz / horizDist) * ${power};\n        vz += (dx / horizDist) * ${power};\n`;
            } else if (dir === 'RIGHT') {
                return `        vx += (dz / horizDist) * ${power};\n        vz += (-dx / horizDist) * ${power};\n`;
            } else if (dir === 'UP') {
                return `        vy += ${power};\n`;
            } else if (dir === 'BACK') {
                return `        vx -= (dx / horizDist) * ${power};\n        vz -= (dz / horizDist) * ${power};\n`;
            }
            return '';
        };

        // 10. 前方危急緊急減速
        jsGen['drone_emergency_brake'] = function(block) {
            const percent = Number(block.getFieldValue('PERCENT')) || 50;
            const factor = (percent / 100).toFixed(2);
            return `        vx *= ${factor};\n        vz *= ${factor};\n`;
        };

        // 11. 手動自訂航向速度向量
        jsGen['drone_custom_velocity'] = function(block) {
            const vx = jsGen.valueToCode(block, 'VX', jsGen.ORDER_ASSIGNMENT || 0) || 'vx';
            const vy = jsGen.valueToCode(block, 'VY', jsGen.ORDER_ASSIGNMENT || 0) || 'vy';
            const vz = jsGen.valueToCode(block, 'VZ', jsGen.ORDER_ASSIGNMENT || 0) || 'vz';
            return `        vx = ${vx};\n        vy = ${vy};\n        vz = ${vz};\n`;
        };

        console.log('[Blockly] 無人機 JavaScript 代碼產生器已註冊');
    }

    ns.BlocklyGenerators = {
        initDroneGenerators
    };
})(window.ShilinDrone);

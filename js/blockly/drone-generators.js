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
        const dict = (jsGen.forBlock) ? jsGen.forBlock : jsGen;

        // 1. 核心根節點積木生成器
        dict['drone_on_step'] = function(block) {
            const branch = jsGen.statementToCode(block, 'DO');
            const code = `
class StudentController {
    constructor(goal_pos) {
        this.goal = goal_pos;
        this.speed = 11.5;
        this.cruiseAltitude = 12.5;
        this.ecoMode = false;
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

        // 全域航電環境與感測器參考
        const _sd = window.ShilinDrone || {};
        const _flightState = (_sd.State && _sd.State.flightState) || { battery: 100 };
        const _activeMission = (_sd.State && _sd.State.activeMission) || {};
        const _hazards = _sd.MissionHazards || null;

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
        dict['drone_set_cruise_speed'] = function(block) {
            const speed = Number(block.getFieldValue('SPEED')) || 11.5;
            return `        currentSpeed = ${speed};\n        vx = (dx / horizDist) * currentSpeed;\n        vz = (dz / horizDist) * currentSpeed;\n`;
        };

        // 3. 巡航高度鎖定
        dict['drone_set_cruise_altitude'] = function(block) {
            const alt = Number(block.getFieldValue('ALTITUDE')) || 12.5;
            return `        targetAlt = ${alt};\n        vy = (targetAlt - y) * 2.2;\n`;
        };

        // 4. 16 向虛擬光達自動環周排斥避障
        dict['drone_auto_lidar_repulsion'] = function(block) {
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
        dict['drone_raycast_distance'] = function(block) {
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
        dict['drone_lidar_min_distance'] = function(block) {
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
        dict['drone_target_distance'] = function(block) {
            return ['horizDist', jsGen.ORDER_ATOMIC || 0];
        };

        // 8. 目前飛行高度
        dict['drone_current_altitude'] = function(block) {
            return ['y', jsGen.ORDER_ATOMIC || 0];
        };

        // 9. 緊急向指定方向偏向避障
        dict['drone_steer_dodge'] = function(block) {
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
        dict['drone_emergency_brake'] = function(block) {
            const percent = Number(block.getFieldValue('PERCENT')) || 50;
            const factor = (percent / 100).toFixed(2);
            return `        vx *= ${factor};\n        vz *= ${factor};\n`;
        };

        // 11. 手動自訂航向速度向量
        dict['drone_custom_velocity'] = function(block) {
            const vx = jsGen.valueToCode(block, 'VX', jsGen.ORDER_ASSIGNMENT || 0) || 'vx';
            const vy = jsGen.valueToCode(block, 'VY', jsGen.ORDER_ASSIGNMENT || 0) || 'vy';
            const vz = jsGen.valueToCode(block, 'VZ', jsGen.ORDER_ASSIGNMENT || 0) || 'vz';
            return `        vx = ${vx};\n        vy = ${vy};\n        vz = ${vz};\n`;
        };

        // ====================================================================
        // 🔋 動力電池與節能巡航積木生成器
        // ====================================================================
        // 12. 讀取目前剩餘電量百分比
        dict['drone_get_battery'] = function(block) {
            const code = `(_flightState.battery !== undefined ? parseFloat(_flightState.battery.toFixed(1)) : 100)`;
            return [code, jsGen.ORDER_MEMBER || 0];
        };

        // 13. 電池處於低電量警戒判定
        dict['drone_is_low_battery'] = function(block) {
            const threshold = Number(block.getFieldValue('THRESHOLD')) || 25;
            const code = `((_flightState.battery !== undefined ? _flightState.battery : 100) < ${threshold})`;
            return [code, jsGen.ORDER_RELATIONAL || 0];
        };

        // 14. 啟用節能巡航省電模式
        dict['drone_enable_eco_mode'] = function(block) {
            const speed = Number(block.getFieldValue('SPEED')) || 9.0;
            return `
        // [積木] 啟用節能巡航模式 (降低 30% 功耗)
        this.ecoMode = true;
        currentSpeed = Math.min(currentSpeed, ${speed});
        vx = (dx / horizDist) * currentSpeed;
        vz = (dz / horizDist) * currentSpeed;\n`;
        };

        // ====================================================================
        // ⚖️ SWaP 負重與配額檢視積木生成器
        // ====================================================================
        // 15. 讀取目前總配重
        dict['drone_get_total_payload'] = function(block) {
            const code = `((_activeMission.baseWeight || 280) + (this.ecoMode ? 80 : 130))`;
            return [code, jsGen.ORDER_MEMBER || 0];
        };

        // 16. 讀取當前關卡負重配額上限
        dict['drone_get_payload_limit'] = function(block) {
            const code = `(_activeMission.maxPayload || 700)`;
            return [code, jsGen.ORDER_MEMBER || 0];
        };

        // ====================================================================
        // 👁️ 雙目立體視覺感測器積木生成器 (抓細電線)
        // ====================================================================
        // 17. 雙目立體視覺探測細電線距離
        dict['drone_stereo_detect_wire'] = function(block) {
            const range = Number(block.getFieldValue('RANGE')) || 20.0;
            const code = `(function() {
            if (_hazards && _sd.State && _sd.State.physicalObstacles) {
                const _obs = _sd.State.physicalObstacles.filter(o => o.isHazard && o.name && o.name.includes('電'));
                let _minDist = ${range};
                const _p = new THREE.Vector3(x, y, z);
                for (let _o of _obs) {
                    if (_o.box) {
                        const _c = new THREE.Vector3();
                        _o.box.getCenter(_c);
                        const _d = _p.distanceTo(_c);
                        if (_d < _minDist) _minDist = _d;
                    }
                }
                return _minDist;
            }
            return raycast(current_pos, [dx/horizDist, 0, dz/horizDist], ${range});
        })()`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // 18. 雙目細電線危急預警
        dict['drone_stereo_wire_warning'] = function(block) {
            const distance = Number(block.getFieldValue('DISTANCE')) || 12.0;
            const code = `(function() {
            if (_hazards && _sd.State && _sd.State.physicalObstacles) {
                const _obs = _sd.State.physicalObstacles.filter(o => o.isHazard && o.name && o.name.includes('電'));
                const _p = new THREE.Vector3(x, y, z);
                for (let _o of _obs) {
                    if (_o.box) {
                        const _c = new THREE.Vector3();
                        _o.box.getCenter(_c);
                        if (_p.distanceTo(_c) < ${distance}) return true;
                    }
                }
            }
            return false;
        })()`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // ====================================================================
        // 📡 4D 毫米波都卜勒雷達積木生成器 (穿透濃霧抓動態飛鳥)
        // ====================================================================
        // 19. 4D 毫米波雷達探測動態目標距離
        dict['drone_radar_detect_moving'] = function(block) {
            const minSpeed = Number(block.getFieldValue('MIN_SPEED')) || 2.0;
            const code = `(function() {
            if (_hazards && _hazards.getFlockBirds) {
                const _birds = _hazards.getFlockBirds();
                let _minDist = 999;
                const _p = new THREE.Vector3(x, y, z);
                for (let _b of _birds) {
                    const _spd = _b.velocity ? _b.velocity.length() : 0;
                    if (_spd >= ${minSpeed}) {
                        const _d = _p.distanceTo(_b.position);
                        if (_d < _minDist) _minDist = _d;
                    }
                }
                return _minDist < 900 ? _minDist : 999;
            }
            return 999;
        })()`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // 20. 毫米波雷達飛鳥逼近預警
        dict['drone_radar_has_incoming_threat'] = function(block) {
            const distance = Number(block.getFieldValue('DISTANCE')) || 15.0;
            const code = `(function() {
            if (_hazards && _hazards.getFlockBirds) {
                const _birds = _hazards.getFlockBirds();
                const _p = new THREE.Vector3(x, y, z);
                for (let _b of _birds) {
                    if (_p.distanceTo(_b.position) < ${distance}) return true;
                }
            }
            return false;
        })()`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // ====================================================================
        // 📐 下視 ToF 測距儀積木生成器 (斜頂傾角降落與離地淨高)
        // ====================================================================
        // 21. 下視 ToF 探測著陸表面斜率角度
        dict['drone_tof_surface_slope'] = function(block) {
            const code = `(_hazards && _hazards.getSurfaceSlopeAngle ? _hazards.getSurfaceSlopeAngle(x, z) : 0)`;
            return [code, jsGen.ORDER_MEMBER || 0];
        };

        // 22. 下視 ToF 精準離地淨高 (AGL)
        dict['drone_tof_ground_clearance'] = function(block) {
            const code = `raycast(current_pos, [0, -1, 0], 35.0)`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // ====================================================================
        // 🔊 四周近距超音波氣墊陣列積木生成器 (老街狹巷反彈)
        // ====================================================================
        // 23. 四周超音波近距氣墊自動反彈力場
        dict['drone_ultrasonic_cushion'] = function(block) {
            const distance = Number(block.getFieldValue('DISTANCE')) || 2.5;
            const force = Number(block.getFieldValue('FORCE')) || 4.0;
            return `
        // [積木] 四周超音波近距氣墊自動反彈
        for (let _u = 0; _u < 8; _u++) {
            const _ang = (_u / 8) * Math.PI * 2;
            const _uDir = [Math.sin(_ang), 0, Math.cos(_ang)];
            const _uDist = raycast(current_pos, _uDir, ${distance});
            if (_uDist < ${distance}) {
                const _push = (${distance} - _uDist) * ${force};
                vx -= _uDir[0] * _push;
                vz -= _uDir[2] * _push;
            }
        }\n`;
        };

        // 24. 四周超音波探測最近夾縫牆面距離
        dict['drone_ultrasonic_min_distance'] = function(block) {
            const code = `(function() {
            let _min = 5.0;
            for (let _u = 0; _u < 8; _u++) {
                const _ang = (_u / 8) * Math.PI * 2;
                const _d = raycast(current_pos, [Math.sin(_ang), 0, Math.cos(_ang)], 5.0);
                if (_d < _min) _min = _d;
            }
            return _min;
        })()`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // ====================================================================
        // 🌀 單眼光流與抗風補償積木生成器
        // ====================================================================
        // 25. 光流估算側向風切漂移速度
        dict['drone_optical_flow_drift'] = function(block) {
            const code = `(function() {
            if (_hazards && _hazards.getCrosswindVector) {
                const _w = _hazards.getCrosswindVector(new THREE.Vector3(x, y, z), _flightState.flightTime || 0);
                return _w ? parseFloat(_w.length().toFixed(2)) : 0;
            }
            return 0;
        })()`;
            return [code, jsGen.ORDER_FUNCTION_CALL || 0];
        };

        // 26. 光流自動抗風補償
        dict['drone_optical_flow_wind_compensation'] = function(block) {
            return `
        // [積木] 光流自動抗風補償
        if (_hazards && _hazards.getCrosswindVector) {
            const _w = _hazards.getCrosswindVector(new THREE.Vector3(x, y, z), _flightState.flightTime || 0);
            if (_w) {
                vx -= _w.x * 1.5;
                vz -= _w.z * 1.5;
            }
        }\n`;
        };

        console.log('[Blockly] 無人機 JavaScript 代碼產生器已註冊');
    }

    ns.BlocklyGenerators = {
        initDroneGenerators
    };
})(window.ShilinDrone);

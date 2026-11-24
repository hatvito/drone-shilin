// ============================================================================
// js/simulation/flight-engine.js: 演算法動態編譯沙盒、飛行物理步進、SWaP電量與特種碰撞判決
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { flightState, simSettings, missionEntities, blackboxLogs } = ns.State;
    const { raycastSafe, query16DirectionLiDAR, checkContinuousCollision } = ns.Physics;
    const { updateTrail, resetTrail } = ns.Trail;
    const { updateLidarVisuals } = ns.LidarVisualizer;
    const updateTelemetry = () => { if (ns.TelemetryUI) ns.TelemetryUI.updateTelemetry(); };

    let studentControllerInstance = null;
    let studentLegacyUpdateFunc = null;

    function toggleFlightSimulation() {
        if (simSettings.isSimulating) {
            pauseFlightSimulation();
        } else {
            startFlightSimulation();
        }
    }

    function startFlightSimulation() {
        if (ns.MissionDebrief && ns.MissionDebrief.isReplaying && ns.MissionDebrief.isReplaying()) {
            ns.MissionDebrief.exitReplayMode();
        }
        if (flightState.status === 'CRASHED' || flightState.status === 'SUCCESS') {
            resetFlightState();
        }

        const editorEl = document.getElementById('code-editor');
        if (!editorEl) return;

        const rawCode = editorEl.value;
        const targetHelipad = missionEntities.targetHelipad;
        if (!targetHelipad) {
            alert('尚未初始化目標停機坪，請重新選定任務種子碼！');
            return;
        }

        studentControllerInstance = null;
        studentLegacyUpdateFunc = null;

        // 動態編譯學生輸入之程式碼 (隔離沙盒執行)
        try {
            const goalArray = [targetHelipad.pos.x, targetHelipad.pos.y, targetHelipad.pos.z];
            const factory = new Function('goal_pos', `
                ${rawCode}
                if (typeof StudentController !== 'undefined') {
                    return { type: 'class', instance: new StudentController(goal_pos) };
                } else if (typeof update === 'function') {
                    return { type: 'func', func: update };
                }
                throw new Error('找不到 class StudentController 或 update 函式！');
            `);

            const compiled = factory(goalArray);
            if (compiled.type === 'class') {
                studentControllerInstance = compiled.instance;
            } else {
                studentLegacyUpdateFunc = compiled.func;
            }
        } catch (e) {
            if (ns.MissionDebrief && ns.MissionDebrief.showDebrief) {
                ns.MissionDebrief.showDebrief({
                    type: 'COMPILE_ERROR',
                    reason: e.message,
                    flightState: { ...flightState },
                    activeMission: ns.State.activeMission
                });
            } else {
                alert('避障代碼編譯失敗：\n' + e.message);
            }
            return;
        }

        simSettings.isSimulating = true;
        flightState.status = 'FLYING';

        const drone = ns.DroneModel.getDrone();
        if (drone) drone.visible = true;

        const toggleBtn = document.getElementById('flight-toggle-btn');
        if (toggleBtn) toggleBtn.innerHTML = '<span>暫停試飛</span>';

        const statusBadge = document.getElementById('flight-status-badge');
        if (statusBadge) {
            statusBadge.textContent = '飛行中';
            statusBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30';
        }

        if (ns.Audio && ns.Audio.startPropellerHum) ns.Audio.startPropellerHum();
    }

    function pauseFlightSimulation() {
        simSettings.isSimulating = false;
        if (flightState.status === 'FLYING') {
            flightState.status = 'PAUSED';
        }

        const toggleBtn = document.getElementById('flight-toggle-btn');
        if (toggleBtn) toggleBtn.innerHTML = '<span>啟動自主避障試飛</span>';

        const statusBadge = document.getElementById('flight-status-badge');
        if (statusBadge && flightState.status === 'PAUSED') {
            statusBadge.textContent = '已暫停';
            statusBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-800 text-slate-300';
        }

        if (ns.Audio && ns.Audio.stopPropellerHum) ns.Audio.stopPropellerHum();
    }

    function resetFlightState() {
        simSettings.isSimulating = false;
        blackboxLogs.length = 0;
        resetTrail();

        const startHelipad = missionEntities.startHelipad;
        const targetHelipad = missionEntities.targetHelipad;
        const drone = ns.DroneModel.getDrone();

        if (startHelipad && targetHelipad) {
            flightState.pos.copy(startHelipad.pos);
            flightState.vel.set(0, 0, 0);
            flightState.yaw = 0;
            flightState.flightTime = 0;
            flightState.battery = 100;
            flightState.initialDistance = Math.max(1, flightState.pos.distanceTo(targetHelipad.pos));
            flightState.remainingDistance = flightState.initialDistance;
            flightState.progress = 0;
            flightState.status = 'IDLE';

            if (drone) {
                drone.position.copy(flightState.pos);
                drone.rotation.y = 0;
                drone.visible = true;
            }
        }

        // 同步重設幽靈車位置至起點
        if (ns.GhostDrone && ns.GhostDrone.resetGhostPosition) {
            ns.GhostDrone.resetGhostPosition();
        }

        pauseFlightSimulation();

        const statusBadge = document.getElementById('flight-status-badge');
        if (statusBadge) {
            statusBadge.textContent = '待命';
            statusBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-800 text-slate-300';
        }

        if (ns.TelemetryUI && ns.TelemetryUI.updateTelemetry) {
            ns.TelemetryUI.updateTelemetry();
        }
    }

    function stepFlight(rawDt) {
        if (!simSettings.isSimulating || (!studentControllerInstance && !studentLegacyUpdateFunc)) return;

        // 支援多倍速加速模擬 (1x / 2x / 4x)
        const dt = rawDt * (simSettings.simSpeed || 1.0);
        flightState.flightTime += dt;

        // 0. 電池電量動態衰減計算 (SWaP 約束)
        const activeMission = ns.State.activeMission;
        const batteryLimit = (activeMission && activeMission.batteryCapacitySec) || 55.0;
        // 若學生控制器啟用節能省電模式 (ecoMode)，電池耗電減緩 30% (滯空時間延長)
        const drainFactor = (studentControllerInstance && studentControllerInstance.ecoMode) ? 0.70 : 1.0;
        const effectiveLimit = batteryLimit / drainFactor;
        flightState.battery = Math.max(0, 100 - (flightState.flightTime / effectiveLimit) * 100);

        if (flightState.battery <= 0) {
            simSettings.isSimulating = false;
            flightState.status = 'CRASHED';
            pauseFlightSimulation();

            if (ns.Audio && ns.Audio.playCrashSound) ns.Audio.playCrashSound();

            const statusBadge = document.getElementById('flight-status-badge');
            if (statusBadge) {
                statusBadge.textContent = '電量耗盡';
                statusBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40';
            }

            blackboxLogs.push({
                t: parseFloat(flightState.flightTime.toFixed(2)),
                x: parseFloat(flightState.pos.x.toFixed(2)),
                y: parseFloat(flightState.pos.y.toFixed(2)),
                z: parseFloat(flightState.pos.z.toFixed(2)),
                dist: parseFloat(flightState.remainingDistance.toFixed(2)),
                vx: parseFloat(flightState.vel.x.toFixed(2)),
                vy: parseFloat(flightState.vel.y.toFixed(2)),
                vz: parseFloat(flightState.vel.z.toFixed(2)),
                speed: parseFloat(flightState.vel.length().toFixed(2)),
                yaw: parseFloat(flightState.yaw.toFixed(2)),
                battery: 0,
                isCrashPoint: true,
                crashReason: '動力電池電量耗盡迫降'
            });

            if (ns.MissionDebrief && ns.MissionDebrief.showDebrief) {
                ns.MissionDebrief.showDebrief({
                    type: 'BATTERY',
                    reason: '動力電池電量耗盡 (0%)，迫降失事墜毀',
                    flightState: { ...flightState },
                    activeMission: activeMission
                });
            } else {
                alert(`⚠️ 無人機任務失敗！\n原因：動力電池電量耗盡 (0%)，迫降失事墜毀！\n請優化航線規劃、提高巡航速度或減輕感測器功耗負擔。`);
            }
            return;
        }

        // 1. 執行 16 向虛擬光達測距並同步視覺化
        const lidarData = query16DirectionLiDAR(flightState.pos);
        updateLidarVisuals(flightState.pos, lidarData);

        // 2. 執行學生控制器演算
        try {
            if (studentControllerInstance) {
                const currentPosArr = [flightState.pos.x, flightState.pos.y, flightState.pos.z];
                const velArr = studentControllerInstance.get_velocity(currentPosArr, raycastSafe, dt);
                if (!Array.isArray(velArr) || velArr.length < 3) {
                    throw new Error('get_velocity 必須回傳包含三個元素的數組 [vx, vy, vz]');
                }
                const desiredVel = new THREE.Vector3(velArr[0] || 0, velArr[1] || 0, velArr[2] || 0);
                if (desiredVel.length() > 18.0) desiredVel.normalize().multiplyScalar(18.0);
                flightState.vel.lerp(desiredVel, Math.min(1.0, dt * 6.0));
            } else if (studentLegacyUpdateFunc) {
                const targetHelipad = missionEntities.targetHelipad;
                const accel = studentLegacyUpdateFunc(
                    { pos: flightState.pos.clone(), vel: flightState.vel.clone() },
                    { pos: targetHelipad.pos.clone() },
                    raycastSafe,
                    lidarData,
                    dt
                );
                const aVec = new THREE.Vector3(accel.ax || 0, accel.ay || 0, accel.az || 0);
                if (aVec.length() > 15.0) aVec.normalize().multiplyScalar(15.0);
                flightState.vel.addScaledVector(aVec, dt);
                if (flightState.vel.length() > 18.0) flightState.vel.normalize().multiplyScalar(18.0);
            }
        } catch (e) {
            simSettings.isSimulating = false;
            flightState.status = 'CRASHED';
            pauseFlightSimulation();
            if (ns.MissionDebrief && ns.MissionDebrief.showDebrief) {
                ns.MissionDebrief.showDebrief({
                    type: 'RUNTIME_ERROR',
                    reason: e.message,
                    flightState: { ...flightState },
                    activeMission: activeMission
                });
            } else {
                alert('演算法運行異常：\n' + e.message);
            }
            return;
        }

        // 穿堂側風環境推力注入
        if (ns.MissionHazards && ns.MissionHazards.getCrosswindVector) {
            const wind = ns.MissionHazards.getCrosswindVector(flightState.pos, flightState.flightTime);
            if (wind) {
                flightState.vel.addScaledVector(wind, dt * 1.5);
            }
        }

        // 動態調整無人機螺旋槳馬達音調
        if (ns.Audio && ns.Audio.setPropellerPitch) {
            ns.Audio.setPropellerPitch(flightState.vel.length() / 11.0);
        }

        // 3. 計算下一個目標位置與進行 CCD 連續碰撞檢測
        const nextPos = flightState.pos.clone().addScaledVector(flightState.vel, dt);
        const ccd = checkContinuousCollision(flightState.pos, nextPos);

        if (ccd.hit) {
            simSettings.isSimulating = false;
            flightState.status = 'CRASHED';
            pauseFlightSimulation();

            if (ns.Audio && ns.Audio.playCrashSound) ns.Audio.playCrashSound();

            const statusBadge = document.getElementById('flight-status-badge');
            if (statusBadge) {
                statusBadge.textContent = '失事墜毀';
                statusBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40';
            }

            // 記錄精確碰撞點至黑盒子日誌
            blackboxLogs.push({
                t: parseFloat(flightState.flightTime.toFixed(2)),
                x: parseFloat(nextPos.x.toFixed(2)),
                y: parseFloat(nextPos.y.toFixed(2)),
                z: parseFloat(nextPos.z.toFixed(2)),
                dist: parseFloat(flightState.remainingDistance.toFixed(2)),
                vx: parseFloat(flightState.vel.x.toFixed(2)),
                vy: parseFloat(flightState.vel.y.toFixed(2)),
                vz: parseFloat(flightState.vel.z.toFixed(2)),
                speed: parseFloat(flightState.vel.length().toFixed(2)),
                yaw: parseFloat(flightState.yaw.toFixed(2)),
                battery: parseFloat(flightState.battery.toFixed(1)),
                isCrashPoint: true,
                crashReason: ccd.reason
            });

            if (ns.MissionDebrief && ns.MissionDebrief.showDebrief) {
                ns.MissionDebrief.showDebrief({
                    type: 'COLLISION',
                    reason: ccd.reason,
                    ccd: ccd,
                    flightState: { ...flightState },
                    activeMission: activeMission
                });
            } else {
                alert(`⚠️ 無人機任務失敗！\n原因：${ccd.reason}\n失事點剩餘直線距離：${flightState.remainingDistance.toFixed(2)} m\n任務達成率：${flightState.progress.toFixed(1)}%`);
            }
            return;
        }

        // 4. 更新無人機物理與 3D 姿態
        flightState.pos.copy(nextPos);
        const drone = ns.DroneModel.getDrone();
        if (drone) {
            drone.position.copy(flightState.pos);
            if (flightState.vel.length() > 0.2) {
                const targetYaw = Math.atan2(flightState.vel.x, flightState.vel.z);
                flightState.yaw += (targetYaw - flightState.yaw) * 0.15;
                drone.rotation.y = flightState.yaw;
            }
        }

        // 5. 更新航跡圓管
        updateTrail(flightState.pos);

        // 6. 計算剩餘距離與進度
        const targetHelipad = missionEntities.targetHelipad;
        if (targetHelipad) {
            const dist = flightState.pos.distanceTo(targetHelipad.pos);
            flightState.remainingDistance = dist;
            flightState.progress = Math.max(0, Math.min(100, (1 - dist / flightState.initialDistance) * 100));

            // 黑盒子飛行記錄器 (每 0.1 秒記錄)
            if (blackboxLogs.length === 0 || flightState.flightTime - blackboxLogs[blackboxLogs.length - 1].t >= 0.1) {
                blackboxLogs.push({
                    t: parseFloat(flightState.flightTime.toFixed(2)),
                    x: parseFloat(flightState.pos.x.toFixed(2)),
                    y: parseFloat(flightState.pos.y.toFixed(2)),
                    z: parseFloat(flightState.pos.z.toFixed(2)),
                    dist: parseFloat(dist.toFixed(2)),
                    vx: parseFloat(flightState.vel.x.toFixed(2)),
                    vy: parseFloat(flightState.vel.y.toFixed(2)),
                    vz: parseFloat(flightState.vel.z.toFixed(2)),
                    speed: parseFloat(flightState.vel.length().toFixed(2)),
                    yaw: parseFloat(flightState.yaw.toFixed(2)),
                    battery: parseFloat(flightState.battery.toFixed(1))
                });
            }

            // 7. 到達終點停機坪判決 (中心距離 < 1.5m)
            if (dist < 1.5) {
                // 檢查是否處於斜面鐵皮屋頂 (特種降落考驗)
                if (activeMission && activeMission.hasSlopedRoof && ns.MissionHazards && ns.MissionHazards.getSurfaceSlopeAngle) {
                    const slope = ns.MissionHazards.getSurfaceSlopeAngle(flightState.pos.x, flightState.pos.z);
                    if (slope > 15.0) {
                        simSettings.isSimulating = false;
                        flightState.status = 'CRASHED';
                        pauseFlightSimulation();
                        if (ns.Audio && ns.Audio.playCrashSound) ns.Audio.playCrashSound();
                        const statusBadge = document.getElementById('flight-status-badge');
                        if (statusBadge) {
                            statusBadge.textContent = '著陸翻覆';
                            statusBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40';
                        }

                        blackboxLogs.push({
                            t: parseFloat(flightState.flightTime.toFixed(2)),
                            x: parseFloat(flightState.pos.x.toFixed(2)),
                            y: parseFloat(flightState.pos.y.toFixed(2)),
                            z: parseFloat(flightState.pos.z.toFixed(2)),
                            dist: parseFloat(dist.toFixed(2)),
                            vx: 0, vy: 0, vz: 0, speed: 0,
                            yaw: parseFloat(flightState.yaw.toFixed(2)),
                            battery: parseFloat(flightState.battery.toFixed(1)),
                            isCrashPoint: true,
                            crashReason: `鐵皮斜頂 (${slope.toFixed(1)}°) 著陸翻覆`
                        });

                        if (ns.MissionDebrief && ns.MissionDebrief.showDebrief) {
                            ns.MissionDebrief.showDebrief({
                                type: 'SLOPE',
                                slope: slope,
                                reason: `目標停機坪處於 ${slope.toFixed(1)}° 傾斜鐵皮斜頂，直接關閉馬達導致無人機失衡側翻墜樓`,
                                flightState: { ...flightState },
                                activeMission: activeMission
                            });
                        } else {
                            alert(`⚠️ 著陸翻覆失事！\n原因：目標停機坪處於 ${slope}° 傾斜鐵皮斜頂！\n直接關閉馬達導致無人機失衡側翻墜樓！\n提示：請利用下視 ToF 感測器判斷坡度並修正著陸位置。`);
                        }
                        return;
                    }
                }

                simSettings.isSimulating = false;
                flightState.status = 'SUCCESS';
                flightState.progress = 100;
                flightState.remainingDistance = 0;
                pauseFlightSimulation();

                if (ns.Audio && ns.Audio.playVictoryFanfare) ns.Audio.playVictoryFanfare();

                const statusBadge = document.getElementById('flight-status-badge');
                if (statusBadge) {
                    statusBadge.textContent = '任務達成';
                    statusBadge.className = 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40';
                }

                if (ns.TelemetryUI && ns.TelemetryUI.updateTelemetry) {
                    ns.TelemetryUI.updateTelemetry();
                }

                // 啟動完賽排行榜登錄視窗與幽靈車判定
                if (ns.Leaderboard && ns.Leaderboard.showVictoryModal) {
                    ns.Leaderboard.showVictoryModal(flightState.flightTime, blackboxLogs);
                } else {
                    alert(`🏆 恭喜！成功抵達士林終點大樓停機坪！\n總耗時：${flightState.flightTime.toFixed(1)} 秒\n達成率：100%`);
                }
                return;
            }
        }

        if (ns.TelemetryUI && ns.TelemetryUI.updateTelemetry) {
            ns.TelemetryUI.updateTelemetry();
        }
    }

    ns.FlightEngine = {
        toggleFlightSimulation,
        startFlightSimulation,
        pauseFlightSimulation,
        resetFlightState,
        stepFlight
    };
})(window.ShilinDrone);

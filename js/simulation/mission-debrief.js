// ============================================================================
// js/simulation/mission-debrief.js: 任務結算覆盤、黑盒子物理科學歸因診斷與軌跡重播系統
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    let lastIncidentData = null;
    let isReplayActive = false;
    let isReplayPlaying = false;
    let replaySpeed = 1.0;
    let replayCurrentTime = 0.0;
    let replayDuration = 0.0;
    let crashMarkerMesh = null;
    let crashMarkerLabel = null;

    // Toast 浮動提示控制器
    let toastTimeout = null;
    function showToast(message, type = 'info') {
        const toast = document.getElementById('system-toast');
        const text = document.getElementById('toast-message');
        if (!toast || !text) return;

        text.textContent = message;
        toast.className = 'fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl glass-panel text-xs font-bold shadow-2xl transition-all duration-300 pointer-events-none opacity-100 translate-y-0 ';

        if (type === 'success') {
            toast.className += 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-emerald-500/20';
        } else if (type === 'error') {
            toast.className += 'bg-rose-950/90 text-rose-300 border border-rose-500/50 shadow-rose-500/20';
        } else if (type === 'warning') {
            toast.className += 'bg-amber-950/90 text-amber-300 border border-amber-500/50 shadow-amber-500/20';
        } else {
            toast.className += 'bg-slate-900/95 text-cyan-300 border border-cyan-500/50 shadow-cyan-500/20';
        }

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.className = toast.className.replace('opacity-100 translate-y-0', 'opacity-0 translate-y-[-10px]');
        }, 2800);
    }

    // ========================================================================
    // 1. 物理科學歸因與除錯診斷演算法 (Scientific Causality Diagnostics)
    // ========================================================================
    function analyzeIncident(data) {
        const { flightState, activeMission } = data;
        const vel = flightState.vel || new THREE.Vector3();
        const speed = vel.length();
        const maxDecel = 12.0; // 航太物理模型之最大安全反向減速度 (m/s^2)
        const brakingDist = (speed * speed) / (2 * maxDecel);
        const reactTime = 0.15; // 演算法步進與電調反應延遲
        const reactDist = speed * reactTime;
        const safeLookahead = brakingDist + reactDist;

        let title = '任務失敗 · 都會障礙物撞擊';
        let badge = '💥 失事墜毀';
        let badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-400/40';
        let icon = '💥';
        let iconBg = 'bg-rose-500/20 text-rose-300 border-rose-400/40 shadow-rose-500/20';

        let causeSummary = '';
        let physicsDetails = [];
        let adviceList = [];

        if (data.type === 'BATTERY') {
            title = '任務終止 · SWaP 動力電量耗盡';
            badge = '🔋 電量耗盡';
            badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-400/40';
            icon = '🔋';
            iconBg = 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-amber-500/20';

            causeSummary = '無人機滯空時間已超過動力鋰電池極限（0%），馬達熄火迫降墜毀！這是典型的航太 SWaP (Size, Weight, Power) 能源約束瓶頸。';
            physicsDetails = [
                `• 飛行總耗時：${flightState.flightTime.toFixed(1)} 秒（任務額定電池安全上限：${(activeMission && activeMission.batteryCapacitySec) || 55} 秒）`,
                `• 功耗衰減因子：未開啟節能模式（ecoMode: false），全感測器高頻掃描加速放電`,
                `• 平均巡航前進速度偏慢，導致在空中停留消耗過多基礎懸停功耗`
            ];
            adviceList = [
                '1. 在「電池與負載」分類中拖出【啟用節能省電模式 (ecoMode)】積木，可減緩 30% 電池放電速率。',
                '2. 適度提高巡航航速（建議 11.5 ~ 14.0 m/s），縮短航程總飛行秒數，減少空中懸停功耗浪費。',
                '3. 優化航向規劃，減少不必要的直角折彎與無謂原地打轉。'
            ];
        } else if (data.type === 'SLOPE') {
            title = '著陸翻覆 · 傾斜斜頂降落失衡';
            badge = '📐 斜頂翻覆';
            badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-400/40';
            icon = '📐';
            iconBg = 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-amber-500/20';

            const slope = data.slope || 18.0;
            causeSummary = `目標大樓停機坪位於 ${slope.toFixed(1)}° 的鐵皮斜屋頂！無人機接觸地面時若仍保有水平動能且未校正機身姿態，將瞬間因重力分力失衡側翻墜樓。`;
            physicsDetails = [
                `• 屋頂傾斜角：${slope.toFixed(1)}°（安全平坦臨界角：≤ 15.0°）`,
                `• 斜面重力分力：F = mg · sin(${slope.toFixed(1)}°) = ${(Math.sin(slope * Math.PI / 180) * 100).toFixed(1)}% 重力加速度`,
                `• 接觸面靜摩擦係數不足以支撐未經水平平飄校正的急降`
            ];
            adviceList = [
                '1. 在「坡度與超音波」分類中取用【下視 ToF 探測坡頂傾斜角度】積木，提前偵測地表坡度。',
                '2. 條件判斷：若傾斜角度 > 15°，在抵達停機坪前將前進速度降至 2.0 m/s 以下進行懸停平飄。',
                '3. 啟用【四周近距超音波氣墊緩衝】以減輕著地瞬間的反衝力矩。'
            ];
        } else if (data.type === 'RUNTIME_ERROR' || data.type === 'COMPILE_ERROR') {
            title = '程式異常 · 演算法例外中斷';
            badge = '⚠️ 代碼報錯';
            badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-400/40';
            icon = '⚠️';
            iconBg = 'bg-rose-500/20 text-rose-300 border-rose-400/40 shadow-rose-500/20';

            causeSummary = `演算法在即時步進演算時拋出未捕捉的例外異常：${data.reason}`;
            physicsDetails = [
                `• 錯誤訊息：${data.reason}`,
                `• 檢查積木或程式碼中是否有未宣告變數、除以零、或回傳值格式錯誤。`
            ];
            adviceList = [
                '1. 檢查積木中的數值除法是否可能出現除以 0 的情形。',
                '2. 若使用 JavaScript 模式，請確認 get_velocity 函式回傳值格式為三維數組 [vx, vy, vz]。',
                '3. 可點擊「還原」按鈕還原為預設避障範本重新開始。'
            ];
        } else {
            // 普通撞擊障礙物
            const hitReason = data.reason || '碰撞建築物外牆';
            const isWireHit = hitReason.includes('電線') || hitReason.includes('電纜') || (activeMission && activeMission.hasWires && flightState.pos.y < 14);
            const isWindActive = activeMission && activeMission.hasCrosswind;

            if (isWireHit) {
                title = '空中事故 · 高壓電纜掛網纏繞';
                badge = '⚡ 電纜撞擊';
                badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-400/40';
                icon = '⚡';
                iconBg = 'bg-purple-500/20 text-purple-300 border-purple-400/40 shadow-purple-500/20';

                causeSummary = '無人機撞上老街空中的高壓電纜網或細黑鋼線！電纜直徑僅數公分，水平單層光達雷射束極易從間隙漏抓。';
                physicsDetails = [
                    `• 碰撞障礙物類型：細高壓電線網 (高度約 10~13 公尺)`,
                    `• 光達掃描盲區：16 向水平光達射線僅在固定高度平面發射，無法捕捉上下幾何落差細線`,
                    `• 當前航行高度：${flightState.pos.y.toFixed(1)} m（處於危險電纜層）`
                ];
                adviceList = [
                    '1. 在「飛行動作」分類中將【鎖定巡航高度】設定為 15.0 公尺以上，直接從電纜網上方安全飛躍。',
                    '2. 取用「雙目與毫米波」分類之【雙目立體相機深度矩陣】積木，以前向立體影像偵測細線。',
                    '3. 若偵測到細電線警告，執行緊急爬升動作。'
                ];
            } else if (speed > 13.0 && safeLookahead > 10.0) {
                // 高速煞車距離不足
                title = '都會撞擊 · 巡航速度過快煞車不及';
                causeSummary = `無人機碰撞時航速高達 ${speed.toFixed(1)} m/s！根據動能物理定律，所需最短煞車滑行距離大於雷達警戒反應範圍，避障演算法在物理上來不及煞停！`;
                physicsDetails = [
                    `• 失事航速：${speed.toFixed(1)} m/s (約 ${(speed * 3.6).toFixed(1)} km/h)`,
                    `• 物理極限最短煞車距離：d = v² / (2a) = (${speed.toFixed(1)}²) / (2 × ${maxDecel}) = ${brakingDist.toFixed(1)} 公尺`,
                    `• 系統反應緩衝距離：${reactDist.toFixed(1)} 公尺（以 0.15s 計算）`,
                    `• 總計安全避障視距門檻：至少需 ≥ ${safeLookahead.toFixed(1)} 公尺`
                ];
                adviceList = [
                    `1. 擴大前方感測射程：將「偵測前方障礙物距離」的射程參數至少調高至 ${Math.ceil(safeLookahead + 2)} 公尺。`,
                    '2. 將巡航速度設定為更穩健的 10.0 ~ 11.5 m/s，大幅縮短煞車所需物理距離。',
                    '3. 在偵測到障礙物時加大減速力道，例如將緊急減速調為 70% ~ 80%。'
                ];
            } else {
                // 轉角或死角撞擊
                title = '都會撞擊 · 邊緣死角或側風偏航碰撞';
                causeSummary = isWindActive
                    ? '士林狹弄穿堂側風造成橫向推力偏航，將無人機吹向兩側建築外牆！'
                    : '障礙物恰好穿過相鄰光達光束的角解析度夾角死角，或轉彎時側向推力不足。';

                const gapAt20m = (2 * 20 * Math.sin((22.5 / 2) * Math.PI / 180)).toFixed(1);
                physicsDetails = [
                    `• 失事航速：${speed.toFixed(1)} m/s · 剩餘距離：${flightState.remainingDistance.toFixed(1)} m`,
                    `• 光達角解析度死角：16 束光達在 20 公尺處相鄰光束間距寬達 ${gapAt20m} 公尺，窄角障礙物容易漏網`,
                    isWindActive ? `• 穿堂強陣風：風速約 3.5 m/s 橫向推動機身，未修正將產生橫向漂移` : `• 前方排斥力場範圍可能過小`
                ];
                adviceList = isWindActive ? [
                    '1. 取用「坡度與超音波」中的【啟用光流自動抗風補償】積木，自動抵銷側向風切偏推。',
                    '2. 啟用「16 向光達環周排斥力場」並將警戒半徑設為 16 ~ 18 公尺。',
                    '3. 適度提高巡航航速以增強抗風剛性。'
                ] : [
                    '1. 啟用【16 向光達環周排斥力場】積木（半徑 15~18m，斥力 2.5~3.0），在接近任何建築時提前推離。',
                    '2. 搭配「坡度與超音波」中的【四周近距超音波氣墊反彈力場】，彌補光達射線夾角的幾何盲區。',
                    '3. 檢查轉彎控制是否過於遲緩，確保側向分速度能夠即時避開邊緣。'
                ];
            }
        }

        return {
            title,
            badge,
            badgeClass,
            icon,
            iconBg,
            causeSummary,
            physicsDetails,
            adviceList,
            speed,
            brakingDist,
            safeLookahead
        };
    }

    // ========================================================================
    // 2. 顯示結算覆盤面板 (Show Debrief Modal)
    // ========================================================================
    function showDebrief(data) {
        lastIncidentData = data;
        const analysis = analyzeIncident(data);
        const { flightState, activeMission } = data;

        const modal = document.getElementById('mission-debrief-modal');
        if (!modal) return;

        // 注入標題與 Badge
        const titleEl = document.getElementById('debrief-title');
        const badgeEl = document.getElementById('debrief-status-pill');
        const iconBox = document.getElementById('debrief-icon-box');
        const metaEl = document.getElementById('debrief-meta');

        if (titleEl) titleEl.textContent = analysis.title;
        if (badgeEl) {
            badgeEl.textContent = analysis.badge;
            badgeEl.className = `text-[10px] font-bold px-2 py-0.5 rounded-full ${analysis.badgeClass}`;
        }
        if (iconBox) {
            iconBox.textContent = analysis.icon;
            iconBox.className = `w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg ${analysis.iconBg}`;
        }
        if (metaEl) {
            const seed = (ns.Config && ns.Config.MAP_SEED) || 1337;
            const mTitle = (activeMission && activeMission.title) || '自訂挑戰';
            const diffName = (ns.State && ns.State.simSettings && ns.State.simSettings.difficulty === 'easy') ? '入門巡航 (40m)' : ((ns.State && ns.State.simSettings && ns.State.simSettings.difficulty === 'hard') ? '極限巷戰 (15m)' : '標準競賽 (25m)');
            metaEl.textContent = `關卡：${mTitle} · 種子碼 #${seed} · ${diffName}`;
        }

        // 注入四大數據
        const timeEl = document.getElementById('debrief-time');
        const progEl = document.getElementById('debrief-progress');
        const speedEl = document.getElementById('debrief-speed');
        const distEl = document.getElementById('debrief-dist');

        if (timeEl) timeEl.textContent = `${(flightState.flightTime || 0).toFixed(1)} s`;
        if (progEl) progEl.textContent = `${(flightState.progress || 0).toFixed(1)}%`;
        if (speedEl) speedEl.textContent = `${analysis.speed.toFixed(1)} m/s`;
        if (distEl) distEl.textContent = `${(flightState.remainingDistance || 0).toFixed(1)} m`;

        // 注入科學物理歸因
        const causeEl = document.getElementById('debrief-cause-text');
        const detailsEl = document.getElementById('debrief-physics-details');
        if (causeEl) causeEl.textContent = analysis.causeSummary;
        if (detailsEl) {
            detailsEl.innerHTML = analysis.physicsDetails.map(item => `<div>${item}</div>`).join('');
        }

        // 注入調校建議
        const adviceEl = document.getElementById('debrief-advice-list');
        if (adviceEl) {
            adviceEl.innerHTML = analysis.adviceList.map(a => `<div class="flex items-start gap-1.5"><span class="text-cyan-400 font-bold shrink-0">▸</span><span>${a}</span></div>`).join('');
        }

        // 顯示彈窗
        modal.classList.remove('hidden');
    }

    function closeDebrief() {
        const modal = document.getElementById('mission-debrief-modal');
        if (modal) modal.classList.add('hidden');
    }

    // ========================================================================
    // 3. 一鍵複製診斷報告 (Copy Debug Report to Clipboard)
    // ========================================================================
    function copyDebriefReport() {
        if (!lastIncidentData) return;
        const analysis = analyzeIncident(lastIncidentData);
        const { flightState, activeMission } = lastIncidentData;
        const seed = (ns.Config && ns.Config.MAP_SEED) || 1337;

        const report = `【台北士林無人機避障・黑盒子飛行診斷報告】
========================================
- 任務關卡：${(activeMission && activeMission.title) || '標準考題'} (#${seed})
- 失事狀態：${analysis.title}
- 飛行耗時：${(flightState.flightTime || 0).toFixed(2)} 秒
- 任務達成率：${(flightState.progress || 0).toFixed(1)}%
- 失事航速：${analysis.speed.toFixed(2)} m/s (${(analysis.speed * 3.6).toFixed(1)} km/h)
- 剩餘直線距離：${(flightState.remainingDistance || 0).toFixed(2)} 公尺
----------------------------------------
【物理歸因診斷】：
${analysis.causeSummary}
${analysis.physicsDetails.join('\n')}

【演算法調校建議】：
${analysis.adviceList.join('\n')}
========================================
產生時間：${new Date().toLocaleString('zh-TW')}`;

        navigator.clipboard.writeText(report).then(() => {
            const btn = document.getElementById('btn-copy-debrief');
            if (btn) {
                btn.innerHTML = '<span>✅ 已複製！</span>';
                setTimeout(() => {
                    btn.innerHTML = '<span>📋 複製報告</span>';
                }, 2000);
            }
            showToast('✅ 黑盒子診斷報告已複製至剪貼簿！', 'success');
        }).catch(err => {
            console.error('複製失敗：', err);
            showToast('⚠️ 複製失敗，請手動選取文字', 'warning');
        });
    }

    function retryFlightFromDebrief() {
        closeDebrief();
        exitReplayMode();
        if (ns.FlightEngine && ns.FlightEngine.resetFlightState) {
            ns.FlightEngine.resetFlightState();
        }
        setTimeout(() => {
            if (ns.FlightEngine && ns.FlightEngine.startFlightSimulation) {
                ns.FlightEngine.startFlightSimulation();
            }
        }, 150);
    }

    // ========================================================================
    // 4. 黑盒子軌跡重播回放引擎 (Blackbox Replay Engine)
    // ========================================================================
    function startBlackboxReplay() {
        const logs = ns.State.blackboxLogs;
        if (!logs || logs.length < 2) {
            showToast('⚠️ 本次飛行記錄不足，無法啟動黑盒子重播', 'warning');
            return;
        }

        closeDebrief();
        isReplayActive = true;
        isReplayPlaying = true;
        replaySpeed = 1.0;
        replayCurrentTime = 0.0;
        replayDuration = logs[logs.length - 1].t || 1.0;

        // 停止即時物理模擬
        ns.State.simSettings.isSimulating = false;
        const toggleBtn = document.getElementById('flight-toggle-btn');
        if (toggleBtn) toggleBtn.innerHTML = '<span>啟動自主避障試飛</span>';

        // 建立或顯示失事點 3D 碰撞標記
        setupCrashMarker(logs[logs.length - 1]);

        // 顯示浮動重播控制列
        const replayBar = document.getElementById('blackbox-replay-bar');
        if (replayBar) replayBar.classList.remove('hidden');

        updateReplaySpeedButtons();
        updateReplayUI();

        showToast('⏪ 黑盒子遙測重播啟動：可拖曳滑桿自由穿梭時間', 'info');
    }

    function setupCrashMarker(lastLog) {
        removeCrashMarker();
        const scene = ns.Scene.getScene();
        if (!scene || !lastLog) return;

        // 建立紅色能量碰撞衝擊環
        const group = new THREE.Group();
        group.position.set(lastLog.x, lastLog.y, lastLog.z);

        const sphereGeo = new THREE.SphereGeometry(0.7, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        group.add(sphere);

        const ringGeo = new THREE.RingGeometry(0.8, 1.4, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0055, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        // 標記針桿
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.0, 8);
        const poleMat = new THREE.MeshBasicMaterial({ color: 0xfb7185 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 1.5;
        group.add(pole);

        scene.add(group);
        crashMarkerMesh = group;

        // 建立 2D 懸浮標籤
        const labelContainer = document.getElementById('labels-container');
        if (labelContainer) {
            const div = document.createElement('div');
            div.className = 'label-building px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-500 font-black text-[10px] pointer-events-none shadow-lg';
            div.innerHTML = '💥 碰撞發生點';
            labelContainer.appendChild(div);
            crashMarkerLabel = { element: div, pos: new THREE.Vector3(lastLog.x, lastLog.y + 3.2, lastLog.z) };
            if (ns.State && ns.State.htmlLabels) {
                ns.State.htmlLabels.push(crashMarkerLabel);
            }
        }
    }

    function removeCrashMarker() {
        const scene = ns.Scene.getScene();
        if (scene && crashMarkerMesh) {
            scene.remove(crashMarkerMesh);
            crashMarkerMesh = null;
        }
        if (crashMarkerLabel && crashMarkerLabel.element) {
            crashMarkerLabel.element.remove();
            if (ns.State && ns.State.htmlLabels) {
                const idx = ns.State.htmlLabels.indexOf(crashMarkerLabel);
                if (idx !== -1) ns.State.htmlLabels.splice(idx, 1);
            }
            crashMarkerLabel = null;
        }
    }

    function toggleReplayPlayPause() {
        isReplayPlaying = !isReplayPlaying;
        const btn = document.getElementById('btn-replay-playpause');
        if (btn) {
            btn.textContent = isReplayPlaying ? '暫停' : '播放';
        }
    }

    function onReplaySliderSeek(val) {
        const pct = parseFloat(val) / 100.0;
        replayCurrentTime = pct * replayDuration;
        applyReplayAtTime(replayCurrentTime);
    }

    function setReplaySpeed(spd) {
        replaySpeed = spd;
        updateReplaySpeedButtons();
    }

    function updateReplaySpeedButtons() {
        ['05', '10', '20'].forEach(s => {
            const btn = document.getElementById(`btn-replay-speed-${s}`);
            if (btn) {
                const expected = s === '05' ? 0.5 : (s === '10' ? 1.0 : 2.0);
                if (replaySpeed === expected) {
                    btn.className = 'px-1.5 py-0.5 rounded bg-purple-500 text-slate-950 font-bold transition';
                } else {
                    btn.className = 'px-1.5 py-0.5 rounded text-slate-400 font-bold hover:text-white transition';
                }
            }
        });
    }

    function exitReplayMode() {
        isReplayActive = false;
        isReplayPlaying = false;
        removeCrashMarker();

        const replayBar = document.getElementById('blackbox-replay-bar');
        if (replayBar) replayBar.classList.add('hidden');

        // 將無人機復歸至起點停機坪
        if (ns.FlightEngine && ns.FlightEngine.resetFlightState) {
            ns.FlightEngine.resetFlightState();
        }
        showToast('已退出黑盒子重播模式', 'info');
    }

    function updateReplayUI() {
        const slider = document.getElementById('replay-time-slider');
        const display = document.getElementById('replay-time-display');
        const playBtn = document.getElementById('btn-replay-playpause');

        if (slider && replayDuration > 0) {
            slider.value = ((replayCurrentTime / replayDuration) * 100).toFixed(1);
        }
        if (display) {
            display.textContent = `${replayCurrentTime.toFixed(1)} / ${replayDuration.toFixed(1)}s`;
        }
        if (playBtn) {
            playBtn.textContent = isReplayPlaying ? '暫停' : '播放';
        }
    }

    // 在給定時間點插值計算無人機位置與遙測
    function applyReplayAtTime(targetTime) {
        const logs = ns.State.blackboxLogs;
        if (!logs || logs.length === 0) return;

        // 尋找相鄰點
        let idx = 0;
        while (idx < logs.length - 1 && logs[idx + 1].t < targetTime) {
            idx++;
        }

        const drone = ns.DroneModel.getDrone();
        if (!drone) return;

        const p1 = logs[idx];
        const p2 = logs[Math.min(idx + 1, logs.length - 1)];
        const segDt = p2.t - p1.t;
        const alpha = segDt > 0.001 ? THREE.MathUtils.clamp((targetTime - p1.t) / segDt, 0.0, 1.0) : 0.0;

        const currentPos = new THREE.Vector3().lerpVectors(
            new THREE.Vector3(p1.x, p1.y, p1.z),
            new THREE.Vector3(p2.x, p2.y, p2.z),
            alpha
        );
        drone.position.copy(currentPos);
        ns.State.flightState.pos.copy(currentPos);

        // 旋轉插值
        const yaw = THREE.MathUtils.lerp(p1.yaw || 0, p2.yaw || 0, alpha);
        drone.rotation.y = yaw;
        ns.State.flightState.yaw = yaw;

        // 遙測指標回放
        const currentSpeed = THREE.MathUtils.lerp(p1.speed || 0, p2.speed || 0, alpha);
        const currentDist = THREE.MathUtils.lerp(p1.dist || 0, p2.dist || 0, alpha);
        const currentBattery = THREE.MathUtils.lerp(p1.battery || 100, p2.battery || 100, alpha);

        ns.State.flightState.flightTime = targetTime;
        ns.State.flightState.remainingDistance = currentDist;
        ns.State.flightState.battery = currentBattery;

        const initialDist = ns.State.flightState.initialDistance || 1.0;
        ns.State.flightState.progress = Math.max(0, Math.min(100, (1 - currentDist / initialDist) * 100));

        // 更新 HUD 遙測
        if (ns.TelemetryUI && ns.TelemetryUI.updateTelemetry) {
            ns.TelemetryUI.updateTelemetry();
        }

        // 光達光束視覺化在回放時自動跟隨
        if (ns.LidarVisualizer && ns.Physics && ns.Physics.query16DirectionLiDAR) {
            const lidarData = ns.Physics.query16DirectionLiDAR(currentPos);
            ns.LidarVisualizer.updateLidarVisuals(currentPos, lidarData);
        }
    }

    // 主迴圈每幀步進回放
    function stepReplay(dt) {
        if (!isReplayActive) return;

        // 碰撞標記自旋動畫
        if (crashMarkerMesh) {
            crashMarkerMesh.children.forEach(c => {
                if (c.geometry && c.geometry.type === 'RingGeometry') c.rotation.z += dt * 1.5;
            });
        }

        if (!isReplayPlaying) {
            updateReplayUI();
            return;
        }

        replayCurrentTime += dt * replaySpeed;
        if (replayCurrentTime >= replayDuration) {
            replayCurrentTime = replayDuration;
            isReplayPlaying = false; // 播放至結尾自動暫停
        }

        applyReplayAtTime(replayCurrentTime);
        updateReplayUI();
    }

    function isReplaying() {
        return isReplayActive;
    }

    // ========================================================================
    // 模組介面導出與全域掛載
    // ========================================================================
    ns.MissionDebrief = {
        showDebrief,
        closeDebrief,
        copyDebriefReport,
        retryFlightFromDebrief,
        startBlackboxReplay,
        toggleReplayPlayPause,
        onReplaySliderSeek,
        setReplaySpeed,
        exitReplayMode,
        isReplaying,
        stepReplay,
        showToast,
        analyzeIncident
    };

    window.closeMissionDebrief = closeDebrief;
    window.copyDebriefReport = copyDebriefReport;
    window.retryFlightFromDebrief = retryFlightFromDebrief;
    window.startBlackboxReplay = startBlackboxReplay;
    window.toggleReplayPlayPause = toggleReplayPlayPause;
    window.onReplaySliderSeek = onReplaySliderSeek;
    window.setReplaySpeed = setReplaySpeed;
    window.exitReplayMode = exitReplayMode;
    window.showToast = showToast;

})(window.ShilinDrone);

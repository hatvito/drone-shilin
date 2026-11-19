// ============================================================================
// js/ui/ui-controller.js: 介面事件綁定、全螢幕代碼編輯器、相機視角與輔助工具
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { simSettings, flightState } = ns.State;
    let currentEditorFontSize = 13;

    function toggleFlightSimulation() {
        if (ns.FlightEngine && ns.FlightEngine.toggleFlightSimulation) {
            ns.FlightEngine.toggleFlightSimulation();
        }
    }

    function resetFlightState() {
        if (ns.FlightEngine && ns.FlightEngine.resetFlightState) {
            ns.FlightEngine.resetFlightState();
        }
    }

    function applyMissionSeed(customSeed) {
        if (ns.MissionManager && ns.MissionManager.applyMissionSeed) {
            ns.MissionManager.applyMissionSeed(customSeed);
        }
    }

    function randomizeSeed() {
        if (ns.MissionManager && ns.MissionManager.randomizeSeed) {
            ns.MissionManager.randomizeSeed();
        }
    }

    function exportBlackboxJSON() {
        if (ns.TelemetryUI && ns.TelemetryUI.exportBlackboxJSON) {
            ns.TelemetryUI.exportBlackboxJSON();
        }
    }

    function setCameraViewMode(mode) {
        simSettings.cameraViewMode = mode;
        const orbitBtn = document.getElementById('view-orbit-btn');
        const droneBtn = document.getElementById('view-drone-btn');

        if (orbitBtn) {
            orbitBtn.className = (mode === 'orbit')
                ? 'px-2.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 transition font-bold shadow-md'
                : 'px-2.5 py-1.5 rounded-lg hover:bg-slate-700/60 text-slate-300 transition font-bold';
        }
        if (droneBtn) {
            droneBtn.className = (mode === 'follow')
                ? 'px-2.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 transition font-bold shadow-md'
                : 'px-2.5 py-1.5 rounded-lg hover:bg-slate-700/60 text-slate-300 transition font-bold';
        }

        const controls = ns.Scene.getControls();
        if (controls) {
            controls.enabled = (mode === 'orbit');
        }
    }

    function setSimSpeed(speed) {
        simSettings.simSpeed = speed;
        ['1', '2', '4'].forEach(s => {
            const btn = document.getElementById('btn-speed-' + s);
            if (btn) {
                if (parseFloat(s) === speed) {
                    btn.classList.add('bg-cyan-500', 'text-slate-950');
                    btn.classList.remove('text-slate-400');
                } else {
                    btn.classList.remove('bg-cyan-500', 'text-slate-950');
                    btn.classList.add('text-slate-400');
                }
            }
        });
    }

    function toggleLidarVisuals() {
        simSettings.showLidarRays = !simSettings.showLidarRays;
        const btn = document.getElementById('btn-toggle-lidar');
        if (btn) {
            btn.className = simSettings.showLidarRays
                ? 'px-2 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold transition'
                : 'px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition';
            btn.innerHTML = simSettings.showLidarRays ? '📡 光達射線: 開' : '📡 光達射線: 關';
        }
    }

    function toggleSound() {
        simSettings.soundEnabled = !simSettings.soundEnabled;
        const btn = document.getElementById('btn-toggle-sound');
        if (btn) {
            btn.innerHTML = simSettings.soundEnabled ? '🔊 音效: 開' : '🔇 音效: 關';
            btn.className = simSettings.soundEnabled
                ? 'px-2 py-1.5 rounded-lg bg-slate-800 text-cyan-300 font-bold hover:bg-slate-700 transition'
                : 'px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 transition';
        }
        if (!simSettings.soundEnabled && ns.Audio && ns.Audio.stopPropellerHum) {
            ns.Audio.stopPropellerHum();
        }
    }

    function openAiPromptModal() {
        const modal = document.getElementById('ai-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeAiPromptModal() {
        const modal = document.getElementById('ai-modal');
        if (modal) modal.classList.add('hidden');
    }

    function copyAiPrompt() {
        const ta = document.getElementById('ai-prompt-text');
        if (!ta) return;
        ta.select();
        navigator.clipboard.writeText(ta.value).then(() => {
            const btn = document.getElementById('copy-prompt-btn');
            if (btn) {
                btn.textContent = '✅ 已複製！';
                setTimeout(() => { btn.textContent = '📋 一鍵複製提示詞'; }, 2000);
            }
        });
    }

    // === 全螢幕大視窗代碼編輯器 ===
    function openCodeModal() {
        const smallEd = document.getElementById('code-editor');
        const modalEd = document.getElementById('modal-code-editor');
        const modal = document.getElementById('code-modal');
        if (!modal) return;

        if (smallEd && modalEd) {
            modalEd.value = smallEd.value;
            updateModalCodeStats();
        }

        const diff = simSettings.difficulty || 'normal';
        const diffBadges = {
            easy: '🟢 入門 40m',
            normal: '🟡 標準 25m',
            hard: '🔴 極限 15m'
        };
        const diffSpan = document.getElementById('modal-code-diff-badge');
        if (diffSpan) {
            diffSpan.textContent = diffBadges[diff] || diff;
        }

        modal.classList.remove('hidden');
        if (modalEd) {
            modalEd.focus();
        }
    }

    function closeCodeModal(save = true) {
        const modal = document.getElementById('code-modal');
        const smallEd = document.getElementById('code-editor');
        const modalEd = document.getElementById('modal-code-editor');

        if (save && smallEd && modalEd) {
            smallEd.value = modalEd.value;
        }

        if (modal) modal.classList.add('hidden');
    }

    function applyAndFlyCodeModal() {
        closeCodeModal(true);
        if (ns.FlightEngine && ns.FlightEngine.startFlightSimulation) {
            ns.FlightEngine.startFlightSimulation();
        }
    }

    function updateModalCodeStats() {
        const modalEd = document.getElementById('modal-code-editor');
        const statsEl = document.getElementById('modal-code-stats');
        if (!modalEd || !statsEl) return;

        const lines = modalEd.value.split('\n').length;
        const chars = modalEd.value.length;
        statsEl.textContent = `共 ${lines} 行 · ${chars} 字元 · 支援 Tab 縮排 · 按 Ctrl + Enter 立即試飛`;
    }

    function changeEditorFontSize(delta) {
        currentEditorFontSize = Math.max(10, Math.min(22, currentEditorFontSize + delta));
        const modalEd = document.getElementById('modal-code-editor');
        if (modalEd) {
            modalEd.style.fontSize = currentEditorFontSize + 'px';
        }
        const indicator = document.getElementById('modal-font-size-val');
        if (indicator) {
            indicator.textContent = currentEditorFontSize + 'px';
        }
    }

    function insertCodeSnippet(type) {
        const modalEd = document.getElementById('modal-code-editor');
        if (!modalEd) return;

        const snippets = {
            lidar_dodge: `
        // === 常用範本：16向光達環周排斥避障 ===
        // 探測四周障礙物，施加反向斥力
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const rDir = [Math.sin(angle), 0, Math.cos(angle)];
            const dist = raycast(current_pos, rDir, 25.0);
            if (dist < 15.0) {
                const force = (15.0 - dist) * 2.2;
                vx -= rDir[0] * force;
                vz -= rDir[2] * force;
            }
        }`,
            altitude_hold: `
        // === 常用範本：平滑巡航高度鎖定 ===
        const targetAlt = this.cruiseAltitude; // 例如 12.5m
        const altErr = targetAlt - y;
        vy = Math.max(-4.0, Math.min(4.0, altErr * 2.0));`,
            emergency_brake: `
        // === 常用範本：前方危急減速避碰 ===
        const forwardDist = raycast(current_pos, [dx / Math.max(0.1, horizDist), 0, dz / Math.max(0.1, horizDist)], 20.0);
        if (forwardDist < 8.0) {
            this.speed = Math.max(3.0, this.speed * (forwardDist / 8.0));
        }`
        };

        if (snippets[type]) {
            const snippet = snippets[type];
            const start = modalEd.selectionStart;
            const end = modalEd.selectionEnd;
            modalEd.value = modalEd.value.substring(0, start) + snippet + '\n' + modalEd.value.substring(end);
            modalEd.selectionStart = modalEd.selectionEnd = start + snippet.length + 1;
            modalEd.focus();
            updateModalCodeStats();
        }
    }

    function resetDefaultCodeModal() {
        const mode = simSettings.difficulty || 'normal';
        const modeName = DIFFICULTY_CONFIGS[mode] ? DIFFICULTY_CONFIGS[mode].name : '標準競賽';
        if (confirm(`確定要還原為【${modeName}】預設 StudentController 代碼嗎？`)) {
            const modalEd = document.getElementById('modal-code-editor');
            if (modalEd && ns.DefaultCode && ns.DefaultCode.getDefaultCode) {
                modalEd.value = ns.DefaultCode.getDefaultCode(mode);
                updateModalCodeStats();
            }
        }
    }

    function setupEditorTabIndent() {
        ['code-editor', 'modal-code-editor'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = this.selectionStart;
                    const end = this.selectionEnd;
                    this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                    this.selectionStart = this.selectionEnd = start + 4;
                    if (id === 'modal-code-editor') updateModalCodeStats();
                } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (id === 'modal-code-editor') {
                        applyAndFlyCodeModal();
                    } else {
                        toggleFlightSimulation();
                    }
                } else if (e.key === 'Escape' && id === 'modal-code-editor') {
                    closeCodeModal(true);
                }
            });
            if (id === 'modal-code-editor') {
                el.addEventListener('input', updateModalCodeStats);
            } else if (id === 'code-editor') {
                // 雙擊小編輯框也可快速展開大視窗
                el.addEventListener('dblclick', openCodeModal);
            }
        });
    }

    const DIFFICULTY_CONFIGS = {
        easy: {
            name: '入門巡航',
            maxAltitude: 40.0,
            recommendedCruise: 24.0,
            badgeClass: 'px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30 transition',
            inactiveClass: 'px-2.5 py-1.5 rounded-lg hover:bg-slate-700/60 text-emerald-300 font-bold transition',
            limitText: '🟢 入門限高：0 ~ 40.0 公尺 (適合新手測試演算法)'
        },
        normal: {
            name: '標準競賽',
            maxAltitude: 25.0,
            recommendedCruise: 12.5,
            badgeClass: 'px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 transition',
            inactiveClass: 'px-2.5 py-1.5 rounded-lg hover:bg-slate-700/60 text-amber-300 font-bold transition',
            limitText: '🟡 標準限高：0 ~ 25.0 公尺 (經典都會峽谷穿梭)'
        },
        hard: {
            name: '極限巷戰',
            maxAltitude: 15.0,
            recommendedCruise: 8.5,
            badgeClass: 'px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-white font-black shadow-lg shadow-rose-500/30 transition',
            inactiveClass: 'px-2.5 py-1.5 rounded-lg hover:bg-slate-700/60 text-rose-300 font-bold transition',
            limitText: '🔴 極限限高：0 ~ 15.0 公尺 (嚴格貼地・禁止越頂)'
        }
    };

    function setDifficultyMode(mode = 'normal', silent = false) {
        if (!DIFFICULTY_CONFIGS[mode]) mode = 'normal';
        const cfg = DIFFICULTY_CONFIGS[mode];

        simSettings.difficulty = mode;
        simSettings.maxAltitude = cfg.maxAltitude;
        if (ns.Config && ns.Config.setMaxAltitude) {
            ns.Config.setMaxAltitude(cfg.maxAltitude);
        }

        // 更新頂部難度切換按鈕視覺
        ['easy', 'normal', 'hard'].forEach(m => {
            const btn = document.getElementById('btn-diff-' + m);
            if (btn) {
                btn.className = (m === mode) ? DIFFICULTY_CONFIGS[m].badgeClass : DIFFICULTY_CONFIGS[m].inactiveClass;
            }
        });

        // 更新右下角空域限高標籤
        const limitSpan = document.getElementById('info-limit-span');
        if (limitSpan) {
            limitSpan.textContent = cfg.limitText;
            limitSpan.className = (mode === 'easy')
                ? 'text-emerald-400 font-bold'
                : (mode === 'hard' ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold');
        }

        // 更新 AI 提示詞彈窗文字
        const aiPromptEl = document.getElementById('ai-prompt-text');
        if (aiPromptEl && ns.DefaultCode && ns.DefaultCode.getAiPrompt) {
            aiPromptEl.value = ns.DefaultCode.getAiPrompt(mode);
        }

        // 重新依當前難度上限過濾並生成適配停機坪
        if (ns.MissionManager && ns.MissionManager.applyMissionSeed) {
            ns.MissionManager.applyMissionSeed();
        }

        // 重設飛行姿態與狀態
        if (ns.FlightEngine && ns.FlightEngine.resetFlightState) {
            ns.FlightEngine.resetFlightState();
        }

        if (ns.TelemetryUI && ns.TelemetryUI.updateTelemetry) {
            ns.TelemetryUI.updateTelemetry();
        }
    }

    function resetDefaultCode() {
        const mode = simSettings.difficulty || 'normal';
        const modeName = DIFFICULTY_CONFIGS[mode] ? DIFFICULTY_CONFIGS[mode].name : '標準競賽';
        if (confirm(`確定要還原為【${modeName}】預設 StudentController 代碼嗎？`)) {
            const ed = document.getElementById('code-editor');
            if (ed && ns.DefaultCode && ns.DefaultCode.getDefaultCode) {
                ed.value = ns.DefaultCode.getDefaultCode(mode);
            }
        }
    }

    function updateCameraFollow() {
        const camera = ns.Scene.getCamera();
        const drone = ns.DroneModel.getDrone();
        if (simSettings.cameraViewMode === 'follow' && drone && drone.visible && camera) {
            const offset = new THREE.Vector3(
                -Math.sin(flightState.yaw) * 4.5,
                2.2,
                -Math.cos(flightState.yaw) * 4.5
            );
            camera.position.lerp(flightState.pos.clone().add(offset), 0.15);
            camera.lookAt(flightState.pos.x, flightState.pos.y + 0.5, flightState.pos.z);
        } else {
            const controls = ns.Scene.getControls();
            if (controls) controls.update();
        }
    }

    // 初始化時綁定 Tab 鍵縮排與雙擊事件
    window.addEventListener('DOMContentLoaded', () => {
        setupEditorTabIndent();
    });

    ns.UIController = {
        setDifficultyMode,
        setCameraViewMode,
        setSimSpeed,
        toggleLidarVisuals,
        toggleSound,
        openAiPromptModal,
        closeAiPromptModal,
        copyAiPrompt,
        resetDefaultCode,
        applyMissionSeed,
        randomizeSeed,
        toggleFlightSimulation,
        resetFlightState,
        exportBlackboxJSON,
        updateCameraFollow,
        openCodeModal,
        closeCodeModal,
        applyAndFlyCodeModal,
        changeEditorFontSize,
        insertCodeSnippet,
        resetDefaultCodeModal,
        setupEditorTabIndent
    };

    // 掛載至 window 供 HTML 中的 onclick 直接呼叫
    window.setDifficultyMode = setDifficultyMode;
    window.setCameraViewMode = setCameraViewMode;
    window.setSimSpeed = setSimSpeed;
    window.toggleLidarVisuals = toggleLidarVisuals;
    window.toggleSound = toggleSound;
    window.openAiPromptModal = openAiPromptModal;
    window.closeAiPromptModal = closeAiPromptModal;
    window.copyAiPrompt = copyAiPrompt;
    window.resetDefaultCode = resetDefaultCode;
    window.applyMissionSeed = applyMissionSeed;
    window.randomizeSeed = randomizeSeed;
    window.toggleFlightSimulation = toggleFlightSimulation;
    window.resetFlightState = resetFlightState;
    window.exportBlackboxJSON = exportBlackboxJSON;
    window.setLightingMode = (mode) => ns.Scene.setLightingMode(mode);
    window.openCodeModal = openCodeModal;
    window.closeCodeModal = closeCodeModal;
    window.applyAndFlyCodeModal = applyAndFlyCodeModal;
    window.changeEditorFontSize = changeEditorFontSize;
    window.insertCodeSnippet = insertCodeSnippet;
    window.resetDefaultCodeModal = resetDefaultCodeModal;
})(window.ShilinDrone);

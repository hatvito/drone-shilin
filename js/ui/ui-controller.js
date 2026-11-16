// ============================================================================
// js/ui/ui-controller.js: 介面事件綁定、相機視角切換、模擬倍速與輔助工具
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { simSettings, flightState } = ns.State;

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

    function resetDefaultCode() {
        if (confirm('確定要還原為預設 StudentController 類別代碼嗎？')) {
            const ed = document.getElementById('code-editor');
            if (ed && ns.DefaultCode) ed.value = ns.DefaultCode.DEFAULT_CODE;
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

    ns.UIController = {
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
        updateCameraFollow
    };

    // 掛載至 window 供 HTML 中的 onclick 直接呼叫
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
})(window.ShilinDrone);

// ============================================================================
// js/ui/telemetry-ui.js: 遙測數據即時刷新面板與黑盒子軌跡 JSON 檔案匯出
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { flightState, blackboxLogs } = ns.State;

    function updateTelemetry() {
        const distEl = document.getElementById('tele-dist');
        const progEl = document.getElementById('tele-progress');
        const altEl = document.getElementById('tele-alt');
        const barInner = document.getElementById('progress-bar-inner');
        const timeEl = document.getElementById('tele-time');

        if (distEl) distEl.textContent = `${flightState.remainingDistance.toFixed(1)} m`;
        if (progEl) progEl.textContent = `${flightState.progress.toFixed(1)}%`;
        if (altEl) {
            const maxAlt = (ns.State && ns.State.simSettings && ns.State.simSettings.maxAltitude) || 25.0;
            altEl.textContent = `${flightState.pos.y.toFixed(1)} / ${maxAlt.toFixed(0)}m`;
            if (maxAlt - flightState.pos.y < 2.5) {
                altEl.className = 'text-xs font-black text-rose-500 code-font animate-pulse';
            } else if (maxAlt - flightState.pos.y < 5.0) {
                altEl.className = 'text-xs font-black text-amber-400 code-font';
            } else {
                altEl.className = 'text-xs font-black text-emerald-400 code-font';
            }
        }
        if (barInner) barInner.style.width = `${flightState.progress}%`;
        if (timeEl) timeEl.textContent = `${flightState.flightTime.toFixed(1)} s`;
    }

    function exportBlackboxJSON() {
        if (blackboxLogs.length === 0) {
            alert('目前尚無黑盒子飛行軌跡資料，請先啟動試飛！');
            return;
        }

        const seedInput = document.getElementById('mission-seed-input');
        const seed = seedInput ? seedInput.value : '1337';

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            missionSeed: seed,
            flightTime: flightState.flightTime,
            remainingDistance: flightState.remainingDistance,
            progress: flightState.progress,
            status: flightState.status,
            logs: blackboxLogs
        }, null, 2));

        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `drone_blackbox_seed_${seed}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    }

    ns.TelemetryUI = {
        updateTelemetry,
        exportBlackboxJSON
    };
})(window.ShilinDrone);

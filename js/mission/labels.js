// ============================================================================
// js/mission/labels.js: 2D HTML 世界地標標籤、任務起訖點懸浮徽章與動態投影
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { toX, toZ } = ns.Config;
    const { htmlLabels, missionHtmlLabels, simSettings } = ns.State;

    function addUVLabel(u, v, y, text, styleClass) {
        const container = document.getElementById('labels-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = `map-label ${styleClass}`;
        el.innerHTML = `<div class="px-2 py-0.5 rounded-md shadow-md border text-[10px] font-bold">${text}</div><div class="pin-stem"></div>`;
        container.appendChild(el);
        htmlLabels.push({ el, pos: new THREE.Vector3(toX(u), y, toZ(v)) });
    }

    function createMissionFloatingLabel(x, y, z, type, titleText, roofY) {
        const container = document.getElementById('labels-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'mission-label';

        const isStart = (type === 'START');
        const badgeBg = isStart
            ? 'bg-emerald-500 text-slate-950 border-2 border-white shadow-[0_0_25px_rgba(16,185,129,1)]'
            : 'bg-amber-400 text-slate-950 border-2 border-white shadow-[0_0_25px_rgba(245,158,11,1)]';
        const icon = isStart ? '🛫 起點 START' : '🏁 終點 GOAL';
        const stemColor = isStart ? '#10b981' : '#f59e0b';

        el.innerHTML = `
            <div class="px-3 py-1 rounded-xl ${badgeBg} font-black text-xs sm:text-sm flex flex-col items-center animate-floating">
                <div class="tracking-wider">${icon}</div>
                <div class="text-[10px] font-bold opacity-90 max-w-[140px] truncate">${titleText} (${Math.round(roofY)}m)</div>
            </div>
            <div style="width: 3px; height: 18px; margin: 0 auto; background: ${stemColor}; box-shadow: 0 0 8px ${stemColor};"></div>
        `;

        el.onclick = (e) => {
            e.stopPropagation();
            const controls = ns.Scene.getControls();
            const camera = ns.Scene.getCamera();
            if (controls && camera) {
                controls.target.set(x, roofY, z);
                camera.position.set(x, roofY + 85, z + 95);
            }
        };

        container.appendChild(el);
        missionHtmlLabels.push({ el, pos: new THREE.Vector3(x, y + 32, z) });
    }

    function clearMissionLabels() {
        missionHtmlLabels.forEach(item => {
            if (item.el && item.el.parentNode) item.el.remove();
        });
        missionHtmlLabels.length = 0;
    }

    function updateLabelProjections(camera) {
        if (!camera) return;
        const hw = window.innerWidth / 2;
        const hh = window.innerHeight / 2;
        const isOrbit = (simSettings.cameraViewMode === 'orbit');

        // 一般地標標籤 (僅在鳥瞰模式顯示，追蹤模式隱藏以免遮擋視野)
        for (let i = 0; i < htmlLabels.length; i++) {
            const item = htmlLabels[i];
            if (!isOrbit) {
                item.el.style.display = 'none';
                continue;
            }
            const p = item.pos.clone().project(camera);
            if (p.z > 1) {
                item.el.style.display = 'none';
            } else {
                item.el.style.display = 'block';
                item.el.style.opacity = '0.8';
                item.el.style.left = `${(p.x * hw) + hw}px`;
                item.el.style.top = `${-(p.y * hh) + hh}px`;
            }
        }

        // 任務起訖點標籤 (無論哪種視角均顯示)
        for (let i = 0; i < missionHtmlLabels.length; i++) {
            const item = missionHtmlLabels[i];
            const p = item.pos.clone().project(camera);
            if (p.z > 1) {
                item.el.style.display = 'none';
            } else {
                item.el.style.display = 'block';
                item.el.style.left = `${(p.x * hw) + hw}px`;
                item.el.style.top = `${-(p.y * hh) + hh}px`;
            }
        }
    }

    ns.Labels = {
        addUVLabel,
        createMissionFloatingLabel,
        clearMissionLabels,
        updateLabelProjections
    };
})(window.ShilinDrone);

// ============================================================================
// js/ui/interaction.js: 3D 視角互動點擊、建築物屬性檢視器與獨立高亮光圈
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { toU, toV } = ns.Config;
    const { interactiveMeshes, missionEntities } = ns.State;
    const { applyIsolatedHighlight, restoreIsolatedHighlight } = ns.MissionManager;

    let selectedMesh = null;
    let selectedMeshOriginalMaterials = null;

    function setupInteraction() {
        const renderer = ns.Scene.getRenderer();
        const camera = ns.Scene.getCamera();
        const raycaster = ns.Scene.getRaycaster();
        const mouse = ns.Scene.getMouse();

        if (!renderer) return;
        const dom = renderer.domElement;
        let downPos = { x: 0, y: 0 };

        dom.addEventListener('pointerdown', (e) => {
            downPos.x = e.clientX;
            downPos.y = e.clientY;
        });

        dom.addEventListener('pointerup', (e) => {
            // 排除拖曳旋轉視角的點擊行為
            if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;

            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(interactiveMeshes, false);

            if (hits.length > 0) {
                const hitMesh = hits[0].object;

                // 還原前一次選中建築的原材質 (避免重設起訖點大樓的高亮)
                if (selectedMesh && selectedMeshOriginalMaterials &&
                    selectedMesh !== missionEntities.startBuildingMesh &&
                    selectedMesh !== missionEntities.targetBuildingMesh) {
                    restoreIsolatedHighlight(selectedMeshOriginalMaterials);
                }

                // 賦予新選中建築水藍色高亮光圈
                if (hitMesh !== missionEntities.startBuildingMesh && hitMesh !== missionEntities.targetBuildingMesh) {
                    selectedMesh = hitMesh;
                    selectedMeshOriginalMaterials = applyIsolatedHighlight(hitMesh, 0x0ea5e9);
                }

                // 更新右下角建築資訊面板
                const titleEl = document.getElementById('info-title');
                const catEl = document.getElementById('info-category');
                const descEl = document.getElementById('info-desc');
                const coordsEl = document.getElementById('info-coords');

                if (titleEl) titleEl.textContent = hitMesh.userData.title || '士林街廓建築';
                if (catEl) catEl.textContent = hitMesh.userData.category || '都市建築';
                if (descEl) descEl.textContent = hitMesh.userData.desc || '點擊任一建築物即可單獨檢視其屬性與高程。';
                if (coordsEl) coordsEl.textContent = `坐標：(${toU(hits[0].point.x)}, ${toV(hits[0].point.z)})`;
            }
        });
    }

    ns.Interaction = {
        setupInteraction
    };
})(window.ShilinDrone);

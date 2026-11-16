// ============================================================================
// js/drone/lidar-visualizer.js: 即時 3D 光達雷射光束視覺化器 (便於學生除錯避障演算法)
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { LIDAR_BEAMS, LIDAR_MAX_DIST } = ns.Config;
    const { layerGroups, simSettings } = ns.State;

    let lineSegmentsMesh = null;
    let positions = null;
    let colors = null;

    function initLidarVisualizer() {
        const numLines = LIDAR_BEAMS;
        const totalVerts = numLines * 2;
        positions = new Float32Array(totalVerts * 3);
        colors = new Float32Array(totalVerts * 3);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending
        });

        lineSegmentsMesh = new THREE.LineSegments(geo, mat);
        lineSegmentsMesh.frustumCulled = false;
        layerGroups.lidar.add(lineSegmentsMesh);
    }

    function updateLidarVisuals(dronePos, dists) {
        if (!simSettings.showLidarRays) {
            if (lineSegmentsMesh) lineSegmentsMesh.visible = false;
            return;
        }

        if (!lineSegmentsMesh) initLidarVisualizer();
        lineSegmentsMesh.visible = true;

        for (let i = 0; i < LIDAR_BEAMS; i++) {
            const angle = (i / LIDAR_BEAMS) * Math.PI * 2;
            const rdx = Math.cos(angle);
            const rdz = Math.sin(angle);
            const d = dists[i] !== undefined ? dists[i] : LIDAR_MAX_DIST;

            const idx = i * 6;
            // 起點 (無人機中心)
            positions[idx] = dronePos.x;
            positions[idx + 1] = dronePos.y;
            positions[idx + 2] = dronePos.z;

            // 終點 (射線命中點或最大距離點)
            positions[idx + 3] = dronePos.x + rdx * d;
            positions[idx + 4] = dronePos.y;
            positions[idx + 5] = dronePos.z + rdz * d;

            // 依距離設定顏色：近距離為亮紅/亮橘，遠處為螢光青色
            const isNear = d < 4.0;
            const isMid = d < 10.0;

            const r = isNear ? 1.0 : (isMid ? 1.0 : 0.0);
            const g = isNear ? 0.1 : (isMid ? 0.7 : 0.9);
            const b = isNear ? 0.2 : (isMid ? 0.1 : 1.0);

            colors[idx] = r; colors[idx + 1] = g; colors[idx + 2] = b;
            colors[idx + 3] = r; colors[idx + 4] = g; colors[idx + 5] = b;
        }

        lineSegmentsMesh.geometry.attributes.position.needsUpdate = true;
        lineSegmentsMesh.geometry.attributes.color.needsUpdate = true;
    }

    ns.LidarVisualizer = {
        initLidarVisualizer,
        updateLidarVisuals
    };
})(window.ShilinDrone);

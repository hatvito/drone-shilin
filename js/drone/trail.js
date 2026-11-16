// ============================================================================
// js/drone/trail.js: 3D 實體粗圓管航跡 (TubeGeometry 直徑 0.9m) 與立體高度光球
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { layerGroups } = ns.State;
    const MAX_TRAIL_POINTS = 600;
    const trailPoints = [];

    let flightTrailMesh = null;
    let trailBeaconGroup = null;

    function initTrail() {
        const emptyGeo = new THREE.BufferGeometry();
        const trailMat = new THREE.MeshBasicMaterial({
            color: 0xff0066,
            side: THREE.DoubleSide
        });
        flightTrailMesh = new THREE.Mesh(emptyGeo, trailMat);
        flightTrailMesh.frustumCulled = false;
        layerGroups.fx.add(flightTrailMesh);

        trailBeaconGroup = new THREE.Group();
        layerGroups.fx.add(trailBeaconGroup);
    }

    function updateTrail(newPos) {
        if (!flightTrailMesh) initTrail();

        // 點位間隔過濾 (大於 1.2m 才紀錄新點，防止頂點爆炸)
        if (trailPoints.length > 0) {
            const lastPt = trailPoints[trailPoints.length - 1];
            if (lastPt.distanceTo(newPos) < 1.2) return;
        }

        trailPoints.push(newPos.clone());
        if (trailPoints.length > MAX_TRAIL_POINTS) {
            trailPoints.shift();
        }

        // 至少要有 2 個點才能建構 3D 實體圓管
        if (trailPoints.length >= 2) {
            const curve = new THREE.CatmullRomCurve3(trailPoints);
            const segments = Math.min(trailPoints.length * 2, 400);
            // 半徑 0.45m 的實體圓管，在各角度鳥瞰與遠距時皆清晰可見
            const newTubeGeo = new THREE.TubeGeometry(curve, segments, 0.45, 6, false);
            if (flightTrailMesh.geometry) flightTrailMesh.geometry.dispose();
            flightTrailMesh.geometry = newTubeGeo;
        }

        // 每隔 5 個點放置一顆金黃色高度標記球
        if (trailPoints.length % 5 === 0) {
            const dot = new THREE.Mesh(
                new THREE.SphereGeometry(0.65, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xfacc15 })
            );
            dot.position.copy(newPos);
            trailBeaconGroup.add(dot);
        }
    }

    function resetTrail() {
        trailPoints.length = 0;
        if (flightTrailMesh && flightTrailMesh.geometry) {
            flightTrailMesh.geometry.dispose();
            flightTrailMesh.geometry = new THREE.BufferGeometry();
        }
        if (trailBeaconGroup) {
            trailBeaconGroup.clear();
        }
    }

    ns.Trail = {
        initTrail,
        updateTrail,
        resetTrail
    };
})(window.ShilinDrone);

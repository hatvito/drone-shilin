// ============================================================================
// js/world/traffic.js: 台北捷運高架列車、雙向多車道動態車流模擬系統
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { seededRandom } = ns.Config;
    const { layerGroups, roadCurvesForTraffic, trafficCars, dynamicObjects } = ns.State;

    function buildTrafficSystem() {
        // 1. 台北捷運淡水信義線 (4節編組車廂，帶有紅線專屬紅色彩帶)
        const mrtTrain = new THREE.Group();
        for (let i = 0; i < 4; i++) {
            const car = new THREE.Mesh(
                new THREE.BoxGeometry(3.2, 3.0, 10.5),
                new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.5 })
            );
            car.position.z = i * 11.2;
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(3.35, 0.65, 10.5),
                new THREE.MeshBasicMaterial({ color: 0xe11d48 })
            );
            stripe.position.y = 0.2;
            car.add(stripe);
            mrtTrain.add(car);
        }
        dynamicObjects.mrtTrainGroup = mrtTrain;
        layerGroups.roads.add(mrtTrain);

        // 2. 道路多色車流 (含公車、自用小客車)
        const vCols = [0xef4444, 0x3b82f6, 0xfacc15, 0xffffff, 0x10b981, 0xf97316, 0xcbd5e1];
        roadCurvesForTraffic.forEach(cfg => {
            for (let i = 0; i < cfg.count; i++) {
                const dir = i % 2 === 0 ? 1 : -1;
                const isBus = i % 7 === 0;
                const m = new THREE.Mesh(
                    new THREE.BoxGeometry(isBus ? 2.4 : 2.0, isBus ? 2.1 : 1.3, isBus ? 7.2 : 4.0),
                    new THREE.MeshStandardMaterial({ color: vCols[i % vCols.length], roughness: 0.3 })
                );
                layerGroups.roads.add(m);
                trafficCars.push({
                    mesh: m,
                    curve: cfg.curve,
                    t: seededRandom(),
                    speed: (0.00065 + seededRandom() * 0.00055) * dir,
                    laneOffset: dir * cfg.offset
                });
            }
        });
    }

    function updateTraffic(elapsed) {
        // 更新捷運列車行駛
        if (dynamicObjects.mrtCurve && dynamicObjects.mrtTrainGroup) {
            const t = (elapsed * 0.045) % 1;
            const pt = dynamicObjects.mrtCurve.getPoint(t);
            const tan = dynamicObjects.mrtCurve.getTangent(t);
            dynamicObjects.mrtTrainGroup.position.set(pt.x, 16.8, pt.z);
            dynamicObjects.mrtTrainGroup.lookAt(pt.x + tan.x, 16.8, pt.z + tan.z);
        }

        // 更新各幹道動態車流
        for (let i = 0; i < trafficCars.length; i++) {
            const c = trafficCars[i];
            c.t = (c.t + c.speed + 1) % 1;
            const pt = c.curve.getPoint(c.t);
            const tan = c.curve.getTangent(c.t);
            const norm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
            c.mesh.position.set(pt.x + norm.x * c.laneOffset, 1.8, pt.z + norm.z * c.laneOffset);
            const dir = c.speed > 0 ? 1 : -1;
            c.mesh.lookAt(c.mesh.position.x + tan.x * dir, 1.8, c.mesh.position.z + tan.z * dir);
        }
    }

    ns.Traffic = {
        buildTrafficSystem,
        updateTraffic
    };
})(window.ShilinDrone);

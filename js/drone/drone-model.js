// ============================================================================
// js/drone/drone-model.js: 3D 穿梭四軸無人機模型、發光頂標與旋轉螺旋槳
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    let drone = null;

    function createDroneEntity() {
        drone = new THREE.Group();

        // 1. 機身 (金屬藍機身，鳥瞰具備高對比度)
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.14, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.2 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        drone.add(bodyMesh);

        // 2. 機頂高可視度發光球標記 (洋紅色發光信標)
        const topBeacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xff007f })
        );
        topBeacon.position.y = 0.2;
        drone.add(topBeacon);

        // 3. 四軸懸臂與半透明旋轉螺旋槳
        const propGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 8);
        const propMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.75 });
        const arms = [[0.38, 0.38], [-0.38, 0.38], [0.38, -0.38], [-0.38, -0.38]];
        drone.propellers = [];

        arms.forEach(([ax, az]) => {
            const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.52), bodyMat);
            armMesh.position.set(ax * 0.5, 0, az * 0.5);
            armMesh.rotation.y = Math.atan2(ax, az);
            drone.add(armMesh);

            const prop = new THREE.Mesh(propGeo, propMat);
            prop.position.set(ax, 0.08, az);
            drone.add(prop);
            drone.propellers.push(prop);
        });

        ns.Scene.getScene().add(drone);
        drone.visible = false;
        return drone;
    }

    function updateDroneAnimation(dt, isSimulating) {
        if (!drone || !drone.propellers) return;
        const pSpeed = isSimulating ? 35 : (drone.visible ? 6 : 0);
        for (let i = 0; i < drone.propellers.length; i++) {
            drone.propellers[i].rotation.y += pSpeed * dt;
        }
    }

    ns.DroneModel = {
        createDroneEntity,
        getDrone: () => drone,
        updateDroneAnimation
    };
})(window.ShilinDrone);

// ============================================================================
// js/world/building-generator.js: 台灣特色建築生成器（斜切街角、L型、退縮高樓、鐵皮屋頂與水塔）
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { toX, toZ, seededRandom, randRange } = ns.Config;
    const { facadeMaterials, roofMaterials, FACADE_KEYS_WALKUP, ROOF_TIN_KEYS } = ns.Materials;
    const { registerInteractive } = ns.GeoHelpers;
    const { layerGroups, stats, missionEntities } = ns.State;

    function pickRealisticHeight(zoneType = 'mixed_alley', isCorner = false) {
        const r = seededRandom();
        if (zoneType === 'old_walkup') {
            if (r < 0.12) return randRange(4.8, 7.8);
            if (r < 0.78) return randRange(12.2, 17.8);
            return randRange(21.0, 29.5);
        } else if (zoneType === 'avenue_commercial') {
            if (r < 0.15) return randRange(7.5, 13.5);
            if (r < 0.65) return randRange(18.0, 31.0);
            return randRange(32.0, 46.0);
        } else if (zoneType === 'luxury_highrise') {
            if (r < 0.25) return randRange(13.5, 18.5);
            if (r < 0.60) return randRange(26.0, 38.0);
            return randRange(42.0, 62.0);
        } else {
            if (r < 0.10) return randRange(5.0, 8.5);
            if (r < 0.68) return randRange(12.8, 18.2);
            if (r < 0.90) return randRange(20.5, 29.0);
            return randRange(30.0, 38.0);
        }
    }

    function pickMaterialByHeight(h) {
        if (h > 36) return seededRandom() > 0.4 ? 'highriseLuxury' : 'glassTower';
        if (h > 21) return seededRandom() > 0.35 ? 'midriseMansion' : 'pinkCeramic';
        return FACADE_KEYS_WALKUP[Math.floor(seededRandom() * FACADE_KEYS_WALKUP.length)];
    }

    function createDiverseTaiwanBuilding(u, v, w, d, h, rotRad, opts = {}) {
        const group = new THREE.Group();
        const x = toX(u);
        const z = toZ(v);
        group.position.set(x, 0, z);
        group.rotation.y = rotRad;

        const shapeType = opts.shapeType || 'box';
        const matKey = opts.matKey || FACADE_KEYS_WALKUP[Math.floor(seededRandom() * FACADE_KEYS_WALKUP.length)];
        const wallMat = facadeMaterials[matKey] || facadeMaterials.oldGreyStone;
        const roofMat = opts.roofMat || (seededRandom() > 0.5 ? roofMaterials.concrete : roofMaterials.darkConcrete);

        const floors = Math.max(1, Math.round(h / 3.2));
        const defaultInfo = opts.info || {
            title: opts.title || `士林街廓建築 (${floors}層樓・高約${Math.round(h)}m)`,
            category: opts.category || (floors <= 2 ? '街角透天/店鋪' : (floors <= 5 ? '台灣步登老公寓 (含防火巷)' : (floors <= 11 ? '退縮式電梯華廈' : '高層住宅/商辦大樓'))),
            desc: opts.desc || `座落於原圖座標 (${Math.round(u)}, ${Math.round(v)})，基地約 ${Math.round(w*1.9)}m × ${Math.round(d*1.9)}m，順應彎曲街廓排列並保留真實防火巷間隙。`
        };

        let mainMesh;
        let topHeight = h;

        if (shapeType === 'L' || shapeType === 'chamfer') {
            const s = new THREE.Shape();
            const hw = w / 2, hd = d / 2;
            if (shapeType === 'L') {
                const cutW = w * 0.42, cutD = d * 0.42;
                s.moveTo(-hw, -hd); s.lineTo(hw, -hd); s.lineTo(hw, hd - cutD);
                s.lineTo(hw - cutW, hd - cutD); s.lineTo(hw - cutW, hd); s.lineTo(-hw, hd);
            } else {
                // 台灣路口常見八角街角削角 (Chamfer)
                const ch = Math.min(w, d) * 0.28;
                s.moveTo(-hw, -hd); s.lineTo(hw - ch, -hd); s.lineTo(hw, -hd + ch);
                s.lineTo(hw, hd); s.lineTo(-hw, hd);
            }
            s.closePath();
            const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
            geo.rotateX(-Math.PI / 2);
            mainMesh = new THREE.Mesh(geo, [wallMat, roofMat]);
            mainMesh.castShadow = true;
            mainMesh.receiveShadow = true;
            registerInteractive(mainMesh, defaultInfo);
            group.add(mainMesh);
        } else if (shapeType === 'stepped' && h > 18) {
            // 逐層退縮式建築
            const podiumH = Math.min(9.5, h * 0.3);
            const podiumGeo = new THREE.BoxGeometry(w, podiumH, d);
            const podiumMesh = new THREE.Mesh(podiumGeo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
            podiumMesh.position.y = podiumH / 2;
            podiumMesh.castShadow = true;
            podiumMesh.receiveShadow = true;
            registerInteractive(podiumMesh, defaultInfo);
            group.add(podiumMesh);

            const towerW = w * 0.78;
            const towerD = d * 0.78;
            const towerH = h - podiumH;
            const towerGeo = new THREE.BoxGeometry(towerW, towerH, towerD);
            mainMesh = new THREE.Mesh(towerGeo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
            mainMesh.position.set((seededRandom() - 0.5) * (w * 0.12), podiumH + towerH / 2, (seededRandom() - 0.5) * (d * 0.12));
            mainMesh.castShadow = true;
            mainMesh.receiveShadow = true;
            registerInteractive(mainMesh, defaultInfo);
            group.add(mainMesh);
        } else {
            // 一般長方體街廓單元
            const boxGeo = new THREE.BoxGeometry(w, h, d);
            mainMesh = new THREE.Mesh(boxGeo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
            mainMesh.position.y = h / 2;
            mainMesh.castShadow = true;
            mainMesh.receiveShadow = true;
            registerInteractive(mainMesh, defaultInfo);
            group.add(mainMesh);
        }

        stats.totalBuildingCount++;

        // 台灣特色頂樓鐵皮加蓋、電梯機房與不銹鋼水塔
        if (!opts.noRooftop && w >= 4.2 && d >= 4.2) {
            const roofGroup = new THREE.Group();
            roofGroup.position.set(x, h, z);
            roofGroup.rotation.y = rotRad;

            const rSeed = seededRandom();
            if (h >= 10 && h <= 23 && rSeed < 0.74) {
                const tinMat = roofMaterials[ROOF_TIN_KEYS[Math.floor(seededRandom() * ROOF_TIN_KEYS.length)]];
                const addonW = w * randRange(0.65, 0.86);
                const addonD = d * randRange(0.65, 0.86);
                const addonH = randRange(2.2, 3.4);
                const addonMesh = new THREE.Mesh(new THREE.BoxGeometry(addonW, addonH, addonD), tinMat);
                addonMesh.position.set((seededRandom() - 0.5) * (w - addonW) * 0.5, addonH / 2, (seededRandom() - 0.5) * (d - addonD) * 0.5);
                addonMesh.castShadow = true;
                roofGroup.add(addonMesh);
                topHeight += addonH;
            } else if (h > 23) {
                const phW = Math.min(w * 0.42, 7.5);
                const phD = Math.min(d * 0.42, 7.5);
                const phH = randRange(3.2, 5.2);
                const phMesh = new THREE.Mesh(new THREE.BoxGeometry(phW, phH, phD), wallMat);
                phMesh.position.set(0, phH / 2, 0);
                phMesh.castShadow = true;
                roofGroup.add(phMesh);
                topHeight += phH;
            }

            if (rSeed > 0.2) {
                const tankMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
                const numTanks = rSeed > 0.65 ? 2 : 1;
                for (let t = 0; t < numTanks; t++) {
                    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.55, 7), tankMat);
                    tank.position.set((t === 0 ? 1 : -1) * (w * 0.24), 0.8, (seededRandom() - 0.5) * (d * 0.4));
                    roofGroup.add(tank);
                }
            }
            layerGroups.rooftops.add(roofGroup);
        }

        layerGroups.buildings.add(group);

        // 符合停機坪候選條件的建築 (寬度與深度充足且高度 >= 6m)
        if (w >= 4.5 && d >= 4.5 && h >= 6.0) {
            missionEntities.candidateBuildings.push({
                group: group,
                mesh: mainMesh,
                center: new THREE.Vector3(x, 0, z),
                roofY: topHeight,
                title: defaultInfo.title
            });
        }

        return group;
    }

    ns.BuildingGenerator = {
        pickRealisticHeight,
        pickMaterialByHeight,
        createDiverseTaiwanBuilding
    };
})(window.ShilinDrone);

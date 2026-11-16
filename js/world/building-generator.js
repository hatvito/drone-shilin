// ============================================================================
// js/world/building-generator.js: 台灣特色建築生成器
// 支援極致擬真單棟 2D 多邊形輪廓 (THREE.ExtrudeGeometry)、斜切街角、退縮式商辦、
// 5色波浪鐵皮加蓋、電梯機房突出物與合批不銹鋼水塔 (InstancedMesh 60 FPS)
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { toX, toZ, seededRandom, randRange } = ns.Config;
    const { facadeMaterials, roofMaterials, FACADE_KEYS_WALKUP, ROOF_TIN_KEYS } = ns.Materials;
    const { registerInteractive } = ns.GeoHelpers;
    const { layerGroups, stats, missionEntities, physicalObstacles } = ns.State;

    // 收集所有屋頂鐵皮加蓋、電梯機房與水塔的矩陣轉換，用於合批渲染
    const rooftopBatches = {
        tinGreen: [],
        tinDarkGreen: [],
        tinBlue: [],
        tinRustRed: [],
        tinSilver: [],
        tinYellowGreen: []
    };
    const penthouseTransforms = [];
    const waterTankTransforms = [];

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

    // ------------------------------------------------------------------------
    // 依據真實 Google Map 提取的 2D 多邊形輪廓擠壓生成單棟 3D 建築
    // ------------------------------------------------------------------------
    function createUVPolygonBuilding(polygonPts, centerUV, sizeUV, height, opts = {}) {
        if (!polygonPts || polygonPts.length < 3) return null;

        // 1. 建立 2D 輪廓 Shape
        const shape = new THREE.Shape();
        const p0 = polygonPts[0];
        shape.moveTo(toX(p0[0]), -toZ(p0[1]));
        for (let i = 1; i < polygonPts.length; i++) {
            shape.lineTo(toX(polygonPts[i][0]), -toZ(polygonPts[i][1]));
        }
        shape.closePath();

        // 2. 擠壓為 3D 立體幾何 (Extrude along +Z, then rotate onto Y-axis)
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: false
        });
        geo.rotateX(-Math.PI / 2);
        geo.computeBoundingBox();

        // 3. 材質配置 (Three.js ExtrudeGeometry: index 0 為頂底蓋, index 1 為側立面)
        const matKey = opts.matKey || 'oldGreyStone';
        const wallMat = facadeMaterials[matKey] || facadeMaterials.oldGreyStone;
        const roofMat = roofMaterials.concrete || new THREE.MeshStandardMaterial({ color: 0xb8b4ac });

        const mesh = new THREE.Mesh(geo, [roofMat, wallMat]);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();

        if (height >= 7.5) {
            mesh.castShadow = true;
        }
        mesh.receiveShadow = true;

        // 4. 註冊街廓屬性互動資訊
        const floors = Math.max(1, Math.round(height / 3.2));
        const cu = centerUV[0], cv = centerUV[1];
        const wu = sizeUV[0], dv = sizeUV[1];
        const approxArea = Math.round(wu * dv * 0.85);

        const title = opts.title || `士林街廓建築 (${floors}層樓・${height}m)`;
        const cat = opts.category || (floors <= 3 ? '透天厝/沿街店面' : (floors <= 6 ? '步登老公寓 (精準多邊形)' : (floors <= 12 ? '電梯華廈' : '高層商辦/科技廠辦')));
        const desc = `座落於原圖街廓坐標 (${Math.round(cu)}, ${Math.round(cv)})，頂點數: ${polygonPts.length} 邊形真實輪廓，基地約 ${approxArea} m²，高度 ${height}m (${floors}層樓)。順應真實街廓地籍線排列並保留防火巷間距。`;

        registerInteractive(mesh, {
            title: title,
            category: cat,
            desc: desc
        });

        // 5. 註冊實體 AABB 物理碰撞盒 (加入頂樓加蓋高度以保障光達精準避障)
        let topHeight = height;
        if (opts.roofAddon === 'tin') {
            topHeight += 2.8;
        } else if (opts.roofAddon === 'penthouse') {
            topHeight += 3.8;
        }
        mesh.userData.roofTopY = topHeight;

        if (mesh.geometry.boundingBox) {
            const b = mesh.geometry.boundingBox.clone();
            b.max.y = topHeight;
            physicalObstacles.push({ box: b, name: title });
        }

        // 6. 收集頂樓加蓋與水塔轉換矩陣 (用於 InstancedMesh 零負擔合批)
        const cx = toX(cu);
        const cz = toZ(cv);
        const addonW = Math.max(2.8, wu * 0.72);
        const addonD = Math.max(2.8, dv * 0.72);

        if (opts.roofAddon === 'tin' && wu >= 3.6 && dv >= 3.6) {
            const tinKey = opts.tinKey || 'tinGreen';
            if (rooftopBatches[tinKey]) {
                const mat4 = new THREE.Matrix4();
                mat4.compose(
                    new THREE.Vector3(cx, height + 1.4, cz),
                    new THREE.Quaternion(),
                    new THREE.Vector3(addonW, 2.8, addonD)
                );
                rooftopBatches[tinKey].push(mat4);
            }
        } else if (opts.roofAddon === 'penthouse' && wu >= 4.2 && dv >= 4.2) {
            const phW = Math.min(addonW * 0.65, 6.5);
            const phD = Math.min(addonD * 0.65, 6.5);
            const mat4 = new THREE.Matrix4();
            mat4.compose(
                new THREE.Vector3(cx, height + 1.9, cz),
                new THREE.Quaternion(),
                new THREE.Vector3(phW, 3.8, phD)
            );
            penthouseTransforms.push(mat4);
        }

        // 不銹鋼水塔
        const numTanks = opts.waterTanks || 0;
        if (numTanks > 0 && wu >= 3.5 && dv >= 3.5) {
            for (let t = 0; t < numTanks; t++) {
                const offX = (t === 0 ? 1 : -1) * (wu * 0.22);
                const offZ = (t === 0 ? -1 : 1) * (dv * 0.22);
                const mat4 = new THREE.Matrix4();
                mat4.compose(
                    new THREE.Vector3(cx + offX, height + 0.8, cz + offZ),
                    new THREE.Quaternion(),
                    new THREE.Vector3(1, 1, 1)
                );
                waterTankTransforms.push(mat4);
            }
        }

        // 7. 停機坪候選大樓 (適合降落條件：寬度與深度充足，屋頂高度在 6m ~ 20m 之間)
        if (wu >= 4.5 && dv >= 4.5 && height >= 6.0 && height <= 20.0) {
            missionEntities.candidateBuildings.push({
                group: mesh,
                mesh: mesh,
                center: new THREE.Vector3(cx, 0, cz),
                roofY: topHeight,
                title: title
            });
        }

        layerGroups.buildings.add(mesh);
        stats.totalBuildingCount++;

        return mesh;
    }

    // ------------------------------------------------------------------------
    // 合批渲染所有頂樓鐵皮加蓋與不銹鋼水塔 (InstancedMesh)
    // ------------------------------------------------------------------------
    function finalizeRooftops() {
        // 1. 各色鐵皮加蓋合批
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let key in rooftopBatches) {
            const list = rooftopBatches[key];
            if (list.length === 0) continue;

            const tinMat = roofMaterials[key] || roofMaterials.tinGreen;
            const instMesh = new THREE.InstancedMesh(boxGeo, tinMat, list.length);
            for (let i = 0; i < list.length; i++) {
                instMesh.setMatrixAt(i, list[i]);
            }
            instMesh.instanceMatrix.needsUpdate = true;
            instMesh.castShadow = true;
            instMesh.receiveShadow = true;
            layerGroups.rooftops.add(instMesh);
        }

        // 2. 電梯機房與梯間突出物合批
        if (penthouseTransforms.length > 0) {
            const phMat = facadeMaterials.oldWarmTile || new THREE.MeshStandardMaterial({ color: 0xcbd5e1 });
            const phInst = new THREE.InstancedMesh(boxGeo, phMat, penthouseTransforms.length);
            for (let i = 0; i < penthouseTransforms.length; i++) {
                phInst.setMatrixAt(i, penthouseTransforms[i]);
            }
            phInst.instanceMatrix.needsUpdate = true;
            phInst.castShadow = true;
            layerGroups.rooftops.add(phInst);
        }

        // 3. 不銹鋼水塔合批 (圓柱體)
        if (waterTankTransforms.length > 0) {
            const tankGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.45, 8);
            const tankMat = new THREE.MeshStandardMaterial({
                color: 0xe2e8f0,
                metalness: 0.85,
                roughness: 0.22
            });
            const tankInst = new THREE.InstancedMesh(tankGeo, tankMat, waterTankTransforms.length);
            for (let i = 0; i < waterTankTransforms.length; i++) {
                tankInst.setMatrixAt(i, waterTankTransforms[i]);
            }
            tankInst.instanceMatrix.needsUpdate = true;
            layerGroups.rooftops.add(tankInst);
        }
    }

    // ------------------------------------------------------------------------
    // 保留原始 createDiverseTaiwanBuilding (供地標建築使用)
    // ------------------------------------------------------------------------
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
            const boxGeo = new THREE.BoxGeometry(w, h, d);
            mainMesh = new THREE.Mesh(boxGeo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
            mainMesh.position.y = h / 2;
            mainMesh.castShadow = true;
            mainMesh.receiveShadow = true;
            registerInteractive(mainMesh, defaultInfo);
            group.add(mainMesh);
        }

        stats.totalBuildingCount++;

        // 頂樓加蓋與水塔
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
        createDiverseTaiwanBuilding,
        createUVPolygonBuilding,
        finalizeRooftops
    };
})(window.ShilinDrone);

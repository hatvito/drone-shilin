// ============================================================================
// js/world/street-blocks.js: 雙曲線街廓建築自動群化生成器（雙排建築與防火巷配置）
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const { seededRandom, randRange } = ns.Config || {};
    const { pickRealisticHeight = () => 12, pickMaterialByHeight = () => null, createDiverseTaiwanBuilding = () => {} } = ns.BuildingGenerator || {};

    function populateCurvedStreetBlock(topUVs, botUVs, opts = {}) {
        const topCurve = new THREE.CatmullRomCurve3(topUVs.map(p => new THREE.Vector3(p[0], 0, p[1])));
        const botCurve = new THREE.CatmullRomCurve3(botUVs.map(p => new THREE.Vector3(p[0], 0, p[1])));

        const blockLen = topCurve.getLength();
        const cols = opts.cols || Math.max(3, Math.floor(blockLen / (opts.avgWidth || 10.5)));
        const doubleRow = opts.doubleRow !== undefined ? opts.doubleRow : true;
        const fireAlleyGap = opts.fireAlleyGap || 2.2;
        const sideGapBase = opts.sideGap || 1.4;

        for (let c = 0; c < cols; c++) {
            const tStart = c / cols;
            const tEnd = (c + 1) / cols;
            const tMid = (tStart + tEnd) / 2;

            const pTop1 = topCurve.getPoint(tStart);
            const pTop2 = topCurve.getPoint(tEnd);
            const pTopMid = topCurve.getPoint(tMid);

            const pBot1 = botCurve.getPoint(tStart);
            const pBot2 = botCurve.getPoint(tEnd);
            const pBotMid = botCurve.getPoint(tMid);

            const dxTop = pTop2.x - pTop1.x;
            const dzTop = pTop2.z - pTop1.z;
            const rotTop = -Math.atan2(dzTop, dxTop);

            const dxBot = pBot2.x - pBot1.x;
            const dzBot = pBot2.z - pBot1.z;
            const rotBot = -Math.atan2(dzBot, dxBot);

            const segWTop = Math.hypot(dxTop, dzTop);
            const segWBot = Math.hypot(dxBot, dzBot);
            const totalDepth = Math.hypot(pBotMid.x - pTopMid.x, pBotMid.z - pTopMid.z);

            const extraAlley = (c > 0 && c < cols - 1 && seededRandom() < 0.22) ? 2.4 : 0;
            const wTop = Math.max(4.2, segWTop - sideGapBase - extraAlley);
            const wBot = Math.max(4.2, segWBot - sideGapBase - extraAlley);

            if (doubleRow && totalDepth > 13) {
                const depthEach = (totalDepth - fireAlleyGap) / 2;
                const d1 = Math.max(4.5, depthEach * randRange(0.84, 0.98));
                const d2 = Math.max(4.5, depthEach * randRange(0.84, 0.98));

                const u1 = pTopMid.x + (pBotMid.x - pTopMid.x) * (d1 / (2 * totalDepth));
                const v1 = pTopMid.z + (pBotMid.z - pTopMid.z) * (d1 / (2 * totalDepth));
                const u2 = pBotMid.x + (pTopMid.x - pBotMid.x) * (d2 / (2 * totalDepth));
                const v2 = pBotMid.z + (pTopMid.z - pBotMid.z) * (d2 / (2 * totalDepth));

                const isCorner = (c === 0 || c === cols - 1);
                const h1 = pickRealisticHeight(opts.zoneType, isCorner);
                const h2 = pickRealisticHeight(opts.zoneType, isCorner);

                const shape1 = isCorner && seededRandom() < 0.55 ? 'chamfer' : (h1 > 22 ? 'stepped' : (seededRandom() < 0.25 ? 'L' : 'box'));
                const shape2 = isCorner && seededRandom() < 0.55 ? 'chamfer' : (h2 > 22 ? 'stepped' : (seededRandom() < 0.25 ? 'L' : 'box'));

                createDiverseTaiwanBuilding(u1, v1, wTop, d1, h1, rotTop, {
                    shapeType: shape1,
                    matKey: pickMaterialByHeight(h1),
                    title: `${opts.streetName || '士林街廓'} ${Math.round(h1 / 3.2)}層樓建築`,
                    category: opts.category || '密集住宅街廓'
                });

                createDiverseTaiwanBuilding(u2, v2, wBot, d2, h2, rotBot, {
                    shapeType: shape2,
                    matKey: pickMaterialByHeight(h2),
                    title: `${opts.streetName || '士林街廓'} ${Math.round(h2 / 3.2)}層樓建築`,
                    category: opts.category || '密集住宅街廓'
                });
            } else {
                const uMid = (pTopMid.x + pBotMid.x) / 2;
                const vMid = (pTopMid.z + pBotMid.z) / 2;
                const dSingle = Math.max(4.5, totalDepth * randRange(0.82, 0.95));
                const isCorner = (c === 0 || c === cols - 1);
                const h = pickRealisticHeight(opts.zoneType, isCorner);

                createDiverseTaiwanBuilding(uMid, vMid, (wTop + wBot) / 2, dSingle, h, rotTop, {
                    shapeType: isCorner ? 'chamfer' : (h > 22 ? 'stepped' : 'box'),
                    matKey: pickMaterialByHeight(h),
                    title: `${opts.streetName || '士林街廓'} ${Math.round(h / 3.2)}層樓建築`,
                    category: opts.category || '密集住宅街廓'
                });
            }
        }
    }

    ns.StreetBlocks = {
        populateCurvedStreetBlock
    };
})(window.ShilinDrone);

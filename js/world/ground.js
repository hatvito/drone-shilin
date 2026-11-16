// ============================================================================
// js/world/ground.js: 2048x1068 高解析底圖、微細彎曲巷弄網與街廓分區地表
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    function buildCurvedGroundCanvasMap() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1068;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        // 預設大地底色 (台北盆地柔和灰褐石質)
        ctx.fillStyle = '#ddd6cc';
        ctx.fillRect(0, 0, 1024, 534);

        function fillPolyUV(pts, fillStyle, strokeStyle = null, lineWidth = 1) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.closePath();
            ctx.fillStyle = fillStyle;
            ctx.fill();
            if (strokeStyle) {
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = lineWidth;
                ctx.stroke();
            }
        }

        function strokeSmoothCurveUV(pts, width, color, dash = null) {
            if (pts.length < 2) return;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (dash) ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 0; i < pts.length - 1; i++) {
                const xc = (pts[i][0] + pts[i + 1][0]) / 2;
                const yc = (pts[i][1] + pts[i + 1][1]) / 2;
                ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
            }
            ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
            ctx.stroke();
            ctx.restore();
        }

        // 北士科西側粉紫商業/科技分區底色
        const westPinkZones = [
            [[0, 26], [50, 26], [50, 145], [0, 145]],
            [[58, 25], [154, 24], [154, 72], [58, 72]],
            [[58, 78], [154, 78], [154, 145], [58, 145]],
            [[162, 24], [225, 24], [242, 72], [162, 72]],
            [[162, 78], [242, 78], [252, 145], [162, 145]],
            [[0, 152], [50, 152], [50, 290], [0, 298]],
            [[58, 152], [154, 152], [154, 235], [58, 272]],
            [[162, 152], [252, 152], [258, 198], [162, 232]]
        ];
        westPinkZones.forEach(p => fillPolyUV(p, '#eadbe7'));

        // 北士科東側工程/科技基地底色
        fillPolyUV([[302, 16], [435, 13], [442, 128], [390, 145], [335, 165], [312, 95]], '#dfd9cf');
        fillPolyUV([[446, 12], [585, 9], [585, 110], [515, 118], [446, 126]], '#dfd9cf');

        // 司法園區、歐洲學校、文昌國小、士林高商、科教館文教底色
        fillPolyUV([[615, 5], [755, 5], [748, 108], [612, 108]], '#f5eedc');
        fillPolyUV([[752, 82], [848, 95], [842, 162], [752, 148]], '#f5eedc');
        fillPolyUV([[405, 345], [502, 322], [595, 534], [462, 534]], '#f5eedc');
        fillPolyUV([[480, 298], [652, 298], [648, 398], [538, 415]], '#f2ead8');

        // 士林監理站粉紫色園區底色與內部彎曲路考場車道
        fillPolyUV([[262, 362], [362, 330], [438, 534], [368, 534], [282, 428]], '#eadbe7', '#d8b4fe', 1);
        strokeSmoothCurveUV([[282, 372], [328, 355], [345, 395], [305, 412], [325, 448], [362, 435], [382, 488], [348, 502]], 4.5, '#cbd5e1');
        strokeSmoothCurveUV([[282, 372], [328, 355], [345, 395], [305, 412], [325, 448], [362, 435], [382, 488], [348, 502]], 1, '#ffffff', [3, 3]);

        // 原圖中所有彎曲巷弄、街廓內部窄巷與防火巷白線
        const curvedAlleys = [
            { w: 5.5, pts: [[756, 86], [795, 68], [838, 52], [878, 38]] },
            { w: 5.0, pts: [[768, 112], [812, 102], [852, 96], [892, 92]] },
            { w: 5.0, pts: [[782, 138], [828, 132], [865, 128], [902, 124]] },
            { w: 5.5, pts: [[752, 152], [798, 158], [848, 162], [892, 158], [922, 148]] },
            { w: 4.5, pts: [[822, 22], [828, 65], [836, 112], [845, 160]] },
            { w: 4.0, pts: [[858, 32], [866, 78], [872, 122], [878, 158]] },
            { w: 5.5, pts: [[905, 0], [928, 72], [955, 158], [988, 255], [1018, 345]] },
            { w: 4.5, pts: [[912, 46], [965, 34], [1024, 18]] },
            { w: 4.5, pts: [[926, 88], [975, 76], [1024, 62]] },
            { w: 4.5, pts: [[945, 138], [985, 128], [1024, 118]] },
            { w: 5.0, pts: [[665, 208], [705, 198], [748, 188]] },
            { w: 5.0, pts: [[672, 236], [712, 226], [754, 216]] },
            { w: 5.0, pts: [[678, 264], [718, 254], [760, 244]] },
            { w: 5.0, pts: [[684, 290], [725, 280], [766, 270]] },
            { w: 3.5, pts: [[712, 188], [722, 242], [732, 295]] },
            { w: 6.0, pts: [[760, 220], [808, 235], [855, 248], [908, 242], [955, 232]] },
            { w: 6.5, pts: [[690, 312], [768, 298], [845, 286], [912, 278], [968, 272]] },
            { w: 4.8, pts: [[784, 230], [798, 295], [812, 358]] },
            { w: 4.8, pts: [[812, 238], [826, 298], [840, 356]] },
            { w: 4.8, pts: [[840, 245], [854, 298], [868, 352]] },
            { w: 5.2, pts: [[884, 242], [898, 312], [912, 378], [926, 442]] },
            { w: 5.0, pts: [[856, 292], [872, 365], [888, 448]] },
            { w: 5.0, pts: [[826, 298], [842, 372], [858, 454]] },
            { w: 5.2, pts: [[788, 358], [845, 346], [905, 335], [962, 324]] },
            { w: 4.8, pts: [[796, 398], [855, 386], [915, 375], [972, 365]] },
            { w: 4.5, pts: [[805, 432], [865, 420], [925, 408], [982, 398]] },
            { w: 6.0, pts: [[546, 442], [592, 416], [636, 392]] },
            { w: 5.5, pts: [[572, 482], [618, 455], [662, 430]] },
            { w: 5.5, pts: [[598, 520], [645, 492], [690, 468]] },
            { w: 4.5, pts: [[578, 342], [558, 432]] },
            { w: 4.5, pts: [[615, 386], [596, 465], [576, 534]] }
        ];

        curvedAlleys.forEach(a => strokeSmoothCurveUV(a.pts, a.w, '#ffffff'));

        // 生成高清晰 Three.js 紋理
        const groundTex = new THREE.CanvasTexture(canvas);
        const groundGeo = new THREE.BoxGeometry(ns.Config.IMG_W, 8, ns.Config.IMG_H);
        const sideMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
        const groundMaterials = [
            sideMat, sideMat,
            new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.88, metalness: 0.05 }),
            sideMat, sideMat, sideMat
        ];

        const groundMesh = new THREE.Mesh(groundGeo, groundMaterials);
        groundMesh.position.y = -4;
        groundMesh.receiveShadow = true;
        ns.Scene.getScene().add(groundMesh);
    }

    ns.Ground = {
        buildCurvedGroundCanvasMap
    };
})(window.ShilinDrone);

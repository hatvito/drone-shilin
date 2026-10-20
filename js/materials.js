// ============================================================================
// materials.js: 建築外牆、台灣特色洗石子、二丁掛、鐵皮與水塔材質庫
// ============================================================================
const facadeMaterials = {};
const roofMaterials = {};

function initRichFacadeAndRoofMaterials() {
    function makeFacadeTexture(opts) {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = opts.bg;
        ctx.fillRect(0, 0, 128, 128);

        if (opts.tileLines) {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 128, 1);
        }

        const cellW = 128 / opts.cols;
        const cellH = 128 / opts.rows;

        for (let r = 0; r < opts.rows; r++) {
            ctx.fillStyle = opts.ledgeColor || 'rgba(0,0,0,0.16)';
            ctx.fillRect(0, r * cellH, 128, 2.5);

            for (let col = 0; col < opts.cols; col++) {
                const padX = cellW * (opts.padX || 0.16);
                const padY = cellH * (opts.padY || 0.22);
                const wx = col * cellW + padX;
                const wy = r * cellH + padY;
                const ww = cellW - padX * 2;
                const wh = cellH - padY * 2;

                ctx.fillStyle = ((r + col) % 5 === 0 && opts.litWindow) ? opts.litWindow : opts.win;
                ctx.fillRect(wx, wy, ww, wh);

                if (opts.ironBars && (r + col) % 2 === 0) {
                    ctx.strokeStyle = 'rgba(30,41,59,0.45)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(wx - 1, wy - 1, ww + 2, wh + 2);
                }
                if (opts.balcony) {
                    ctx.fillStyle = opts.balconyColor || 'rgba(51,65,85,0.38)';
                    ctx.fillRect(col * cellW + 3, (r + 0.62) * cellH, cellW - 6, cellH * 0.28);
                }
                if (opts.acUnit && (r * 3 + col) % 4 === 0) {
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(wx + ww - 5, wy + wh + 1, 5, 3.5);
                }
            }
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    facadeMaterials.oldGreyStone = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#cec8be', win: '#334155', litWindow: '#fef08a', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true }),
        roughness: 0.85, metalness: 0.08
    });
    facadeMaterials.oldWarmTile = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#dfd3c3', win: '#1e293b', litWindow: '#fde68a', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true, tileLines: true }),
        roughness: 0.8, metalness: 0.1
    });
    facadeMaterials.pinkCeramic = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#d9beb8', win: '#334155', litWindow: '#fef3c7', rows: 6, cols: 4, balcony: true, tileLines: true, acUnit: true }),
        roughness: 0.75, metalness: 0.12
    });
    facadeMaterials.redBrick = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#b87d6b', win: '#1e293b', litWindow: '#fde047', rows: 5, cols: 4, balcony: true, tileLines: true, ledgeColor: '#e2d9ce' }),
        roughness: 0.82, metalness: 0.08
    });
    facadeMaterials.greenMosaic = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#b8cbbd', win: '#1e293b', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true }),
        roughness: 0.82, metalness: 0.1
    });
    facadeMaterials.ochreStucco = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#d6c19e', win: '#334155', rows: 4, cols: 3, balcony: false, acUnit: true }),
        roughness: 0.85, metalness: 0.05
    });
    facadeMaterials.midriseMansion = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#cbd5e1', win: '#0f172a', litWindow: '#bae6fd', rows: 8, cols: 5, balcony: true, balconyColor: 'rgba(15,23,42,0.45)', tileLines: true }),
        roughness: 0.5, metalness: 0.3
    });
    facadeMaterials.highriseLuxury = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#94a3b8', win: '#0f172a', litWindow: '#e0f2fe', rows: 12, cols: 6, padX: 0.1, padY: 0.15 }),
        roughness: 0.3, metalness: 0.55
    });
    facadeMaterials.glassTower = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#60a5fa', win: '#091526', litWindow: '#7dd3fc', rows: 14, cols: 8, padX: 0.08, padY: 0.12 }),
        roughness: 0.18, metalness: 0.78
    });
    facadeMaterials.institutional = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#d6ccc0', win: '#334155', rows: 4, cols: 6, padX: 0.18, padY: 0.24 }),
        roughness: 0.65, metalness: 0.15
    });
    facadeMaterials.hospital = new THREE.MeshStandardMaterial({
        map: makeFacadeTexture({ bg: '#f1f5f9', win: '#0369a1', rows: 9, cols: 6, padX: 0.14, padY: 0.2 }),
        roughness: 0.4, metalness: 0.25
    });

    roofMaterials.concrete = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.9 });
    roofMaterials.darkConcrete = new THREE.MeshStandardMaterial({ color: 0x8c8881, roughness: 0.92 });
    roofMaterials.tinGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55, metalness: 0.25 });
    roofMaterials.tinDarkGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, metalness: 0.25 });
    roofMaterials.tinBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.55, metalness: 0.3 });
    roofMaterials.tinRed = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6, metalness: 0.25 });
    roofMaterials.tinSilver = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.5 });
}

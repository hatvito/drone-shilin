// ============================================================================
// js/materials/facade-textures.js: 台灣傳統街廓外牆程序化 Canvas 紋理生成器
// (洗石子、二丁掛、老式鐵窗花、冷氣室外機、陽台線條、一樓騎樓店面招牌、磨石子與科技鋁板)
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    function makeFacadeTexture(opts) {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d');

        // 牆面基底底色
        ctx.fillStyle = opts.bg;
        ctx.fillRect(0, 0, 128, 128);

        // 台灣磨石子/洗石子微顆粒質斑
        if (opts.speckled) {
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            for (let i = 0; i < 180; i++) {
                const sx = (i * 37) % 128;
                const sy = (i * 61) % 128;
                ctx.fillRect(sx, sy, 1.5, 1.5);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            for (let i = 0; i < 120; i++) {
                const sx = (i * 47) % 128;
                const sy = (i * 73) % 128;
                ctx.fillRect(sx, sy, 1.5, 1.5);
            }
        }

        // 二丁掛磁磚縫隙橫線
        if (opts.tileLines) {
            ctx.fillStyle = opts.groutColor || 'rgba(0,0,0,0.08)';
            for (let y = 0; y < 128; y += 4) {
                ctx.fillRect(0, y, 128, 1);
            }
        }

        // 現代科技帷幕垂直飾條 (Mullions)
        if (opts.verticalPanels) {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            for (let x = 0; x < 128; x += 16) {
                ctx.fillRect(x, 0, 1.5, 128);
            }
        }

        const cellW = 128 / opts.cols;
        const cellH = 128 / opts.rows;

        // 逐層繪製窗戶、窗台橫樑與台灣街景特徵
        for (let r = 0; r < opts.rows; r++) {
            // 底層騎樓店鋪招牌與玻璃櫥窗 (Arcade Commercial)
            if (opts.arcade && r === opts.rows - 1) {
                // 商業招牌橫幅看板
                const signColors = ['#dc2626', '#2563eb', '#059669', '#d97706', '#7c3aed'];
                ctx.fillStyle = signColors[(opts.cols + r) % signColors.length];
                ctx.fillRect(4, r * cellH + 2, 120, cellH * 0.32);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(10, r * cellH + 5, 20, 2);
                ctx.fillRect(36, r * cellH + 5, 24, 2);
                ctx.fillRect(66, r * cellH + 5, 18, 2);

                // 騎樓玻璃大門與店內燈光
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(8, r * cellH + cellH * 0.38, 112, cellH * 0.58);
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(40, r * cellH + cellH * 0.38, 2, cellH * 0.58);
                ctx.fillRect(86, r * cellH + cellH * 0.38, 2, cellH * 0.58);
                continue;
            }

            // 水泥橫樑雨遮
            ctx.fillStyle = opts.ledgeColor || 'rgba(0,0,0,0.16)';
            ctx.fillRect(0, r * cellH, 128, 2.5);

            for (let col = 0; col < opts.cols; col++) {
                const padX = cellW * (opts.padX || 0.16);
                const padY = cellH * (opts.padY || 0.22);
                const wx = col * cellW + padX;
                const wy = r * cellH + padY;
                const ww = cellW - padX * 2;
                const wh = cellH - padY * 2;

                // 窗戶玻璃 (少數亮燈)
                ctx.fillStyle = ((r + col) % 5 === 0 && opts.litWindow) ? opts.litWindow : opts.win;
                ctx.fillRect(wx, wy, ww, wh);

                // 台灣步登公寓特色：不銹鋼/鑄鐵防盜鐵窗
                if (opts.ironBars && (r + col) % 2 === 0) {
                    ctx.strokeStyle = 'rgba(30,41,59,0.45)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(wx - 1, wy - 1, ww + 2, wh + 2);
                }

                // 突出小陽台與實體欄杆
                if (opts.balcony) {
                    ctx.fillStyle = opts.balconyColor || 'rgba(51,65,85,0.38)';
                    ctx.fillRect(col * cellW + 3, (r + 0.62) * cellH, cellW - 6, cellH * 0.28);
                }

                // 牆外隨機懸掛的冷氣室外機 (AC Unit)
                if (opts.acUnit && (r * 3 + col) % 4 === 0) {
                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillRect(wx + ww - 5, wy + wh + 1, 5, 3.5);
                    ctx.fillStyle = '#64748b';
                    ctx.fillRect(wx + ww - 4, wy + wh + 2, 3, 1.5);
                }
            }
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    ns.FacadeTextures = {
        makeFacadeTexture
    };
})(window.ShilinDrone);

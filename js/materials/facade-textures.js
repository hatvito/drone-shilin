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

        // 1. 牆面基底底色 (明亮、溫暖)
        ctx.fillStyle = opts.bg || '#f8fafc';
        ctx.fillRect(0, 0, 128, 128);

        // 2. 台灣磨石子/洗石子微顆粒質斑 (細緻淺色顆粒)
        if (opts.speckled) {
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            for (let i = 0; i < 120; i++) {
                const sx = (i * 37) % 128;
                const sy = (i * 61) % 128;
                ctx.fillRect(sx, sy, 1.2, 1.2);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            for (let i = 0; i < 120; i++) {
                const sx = (i * 47) % 128;
                const sy = (i * 73) % 128;
                ctx.fillRect(sx, sy, 1.5, 1.5);
            }
        }

        // 3. 二丁掛磁磚縫隙橫線 (細白或淺灰勾縫)
        if (opts.tileLines) {
            ctx.fillStyle = opts.groutColor || 'rgba(255,255,255,0.25)';
            for (let y = 0; y < 128; y += 4) {
                ctx.fillRect(0, y, 128, 1);
            }
        }

        // 4. 現代科技帷幕垂直飾條 (Mullions)
        if (opts.verticalPanels) {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            for (let x = 0; x < 128; x += 16) {
                ctx.fillRect(x, 0, 1.8, 128);
            }
        }

        const cellW = 128 / opts.cols;
        const cellH = 128 / opts.rows;

        // 5. 逐層繪製窗戶、窗台橫樑與台灣街景特徵
        for (let r = 0; r < opts.rows; r++) {
            // 底層騎樓店鋪招牌與玻璃櫥窗 (Arcade Commercial)
            if (opts.arcade && r === opts.rows - 1) {
                // 商業招牌橫幅看板 (紅、藍、綠、橘、紫多色招牌看板)
                const signColors = ['#ef4444', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6'];
                ctx.fillStyle = signColors[(opts.cols + r) % signColors.length];
                ctx.fillRect(4, r * cellH + 2, 120, cellH * 0.32);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(10, r * cellH + 5, 20, 2);
                ctx.fillRect(36, r * cellH + 5, 24, 2);
                ctx.fillRect(66, r * cellH + 5, 18, 2);

                // 騎樓玻璃大門與店內溫暖燈光
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(8, r * cellH + cellH * 0.38, 112, cellH * 0.58);
                ctx.fillStyle = '#64748b';
                ctx.fillRect(40, r * cellH + cellH * 0.38, 2, cellH * 0.58);
                ctx.fillRect(86, r * cellH + cellH * 0.38, 2, cellH * 0.58);
                continue;
            }

            // 水泥橫樑雨遮 (淺水泥色)
            ctx.fillStyle = opts.ledgeColor || 'rgba(255,255,255,0.45)';
            ctx.fillRect(0, r * cellH, 128, 2.0);

            for (let col = 0; col < opts.cols; col++) {
                const padX = cellW * (opts.padX || 0.16);
                const padY = cellH * (opts.padY || 0.22);
                const wx = col * cellW + padX;
                const wy = r * cellH + padY;
                const ww = cellW - padX * 2;
                const wh = cellH - padY * 2;

                // 窗戶外框 (細緻鋁窗外框)
                ctx.fillStyle = 'rgba(71,85,105,0.32)';
                ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);

                // 窗戶玻璃 (白天日光反射藍天或亮窗，徹底告別黑漆漆死黑！)
                const isLit = (r + col) % 4 === 0;
                ctx.fillStyle = isLit ? (opts.litWindow || '#fef08a') : (opts.win || '#7dd3fc');
                ctx.fillRect(wx, wy, ww, wh);

                // 窗戶白天自然光高光漸層 (上部天光亮面)
                ctx.fillStyle = 'rgba(255,255,255,0.28)';
                ctx.fillRect(wx, wy, ww, wh * 0.42);

                // 台灣步登公寓特色：細白/淺色防盜鐵窗花
                if (opts.ironBars && (r + col) % 2 === 0) {
                    ctx.strokeStyle = 'rgba(203,213,225,0.75)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(wx, wy, ww, wh);
                    ctx.beginPath();
                    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
                    ctx.stroke();
                }

                // 突出小陽台與實體欄杆 (明亮淺水泥色)
                if (opts.balcony) {
                    ctx.fillStyle = opts.balconyColor || 'rgba(241,245,249,0.9)';
                    ctx.fillRect(col * cellW + 2, (r + 0.65) * cellH, cellW - 4, cellH * 0.28);
                    ctx.fillStyle = 'rgba(148,163,184,0.65)';
                    ctx.fillRect(col * cellW + 2, (r + 0.65) * cellH, cellW - 4, 1.2);
                }

                // 牆外隨機懸掛的冷氣室外機 (白色金屬外殼)
                if (opts.acUnit && (r * 3 + col) % 3 === 0) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(wx + ww - 6, wy + wh + 1, 6, 3.8);
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillRect(wx + ww - 5, wy + wh + 2, 4, 1.8);
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

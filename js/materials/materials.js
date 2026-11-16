// ============================================================================
// js/materials/materials.js: 建築立面材質庫、鐵皮加蓋屋頂、洗石子、二丁掛與公共建築材質
// (全面升級明亮、溫暖、生動的台灣都市街景風貌，徹底告別暗沉黑壓壓)
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const facadeMaterials = {};
    const roofMaterials = {};

    const FACADE_KEYS_WALKUP = [
        'whiteTileStucco', 'oldWarmTile', 'pinkCeramic', 'redBrick', 
        'greenMosaic', 'arcadeCommercial', 'vintageGreenStucco', 'ochreStucco', 
        'retroBrownTile', 'oldGreyStone'
    ];
    const ROOF_TIN_KEYS = [
        'tinGreen', 'tinBlue', 'tinRustRed', 'tinYellowGreen', 'tinSilver', 'tinDarkGreen'
    ];

    function initMaterials() {
        const makeTex = ns.FacadeTextures.makeFacadeTexture;

        // --------------------------------------------------------------------
        // 1. 台灣步登公寓與市區透天經典外牆 (明亮、溫暖、色彩層次豐富)
        // --------------------------------------------------------------------
        
        // 台灣最經典白色二丁掛純白外牆
        facadeMaterials.whiteTileStucco = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#ffffff', win: '#67e8f9', litWindow: '#fef08a', rows: 6, cols: 4, balcony: true, tileLines: true, groutColor: 'rgba(148,163,184,0.18)', acUnit: true }),
            roughness: 0.55, metalness: 0.12
        });

        // 溫潤米黃象牙色二丁掛磁磚
        facadeMaterials.oldWarmTile = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#fef3c7', win: '#93c5fd', litWindow: '#fde047', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true, tileLines: true, groutColor: 'rgba(217,119,6,0.15)' }),
            roughness: 0.62, metalness: 0.1
        });

        // 暖粉橘/珊瑚色二丁掛磁磚
        facadeMaterials.pinkCeramic = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#fed7aa', win: '#7dd3fc', litWindow: '#fef08a', rows: 6, cols: 4, balcony: true, tileLines: true, acUnit: true, groutColor: 'rgba(234,88,12,0.15)' }),
            roughness: 0.6, metalness: 0.1
        });

        // 經典台灣暖紅磚牆 (白灰勾縫)
        facadeMaterials.redBrick = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#ea580c', win: '#bae6fd', litWindow: '#fef08a', rows: 5, cols: 4, balcony: true, tileLines: true, ledgeColor: '#ffffff', groutColor: 'rgba(255,255,255,0.45)' }),
            roughness: 0.68, metalness: 0.08
        });

        // 淺湖水綠/薄荷綠馬賽克磁磚
        facadeMaterials.greenMosaic = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#a7f3d0', win: '#7dd3fc', litWindow: '#fef08a', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true, tileLines: true }),
            roughness: 0.62, metalness: 0.1
        });

        // 臨路1樓騎樓熱鬧商鋪看板 + 2樓以上明亮住宅 (Arcade Commercial)
        facadeMaterials.arcadeCommercial = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#fef9c3', win: '#7dd3fc', litWindow: '#fef08a', rows: 5, cols: 4, balcony: true, tileLines: true, acUnit: true, arcade: true }),
            roughness: 0.58, metalness: 0.12
        });

        // 老士林翡翠/淺玉石綠水磨石子公寓
        facadeMaterials.vintageGreenStucco = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#6ee7b7', win: '#93c5fd', litWindow: '#fef9c3', rows: 5, cols: 4, balcony: true, speckled: true, acUnit: true }),
            roughness: 0.65, metalness: 0.08
        });

        // 溫暖明亮金黃土黃色粉刷
        facadeMaterials.ochreStucco = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#fde047', win: '#7dd3fc', rows: 4, cols: 3, balcony: false, acUnit: true }),
            roughness: 0.68, metalness: 0.05
        });

        // 暖焦糖琥珀長條二丁掛磁磚
        facadeMaterials.retroBrownTile = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#d97706', win: '#7dd3fc', litWindow: '#fde047', rows: 5, cols: 4, balcony: true, ironBars: true, tileLines: true, acUnit: true, ledgeColor: '#ffffff' }),
            roughness: 0.65, metalness: 0.1
        });

        // 洗石子/淺淺淺灰花崗岩
        facadeMaterials.oldGreyStone = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#f1f5f9', win: '#7dd3fc', litWindow: '#fef08a', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true, speckled: true }),
            roughness: 0.65, metalness: 0.1
        });

        // --------------------------------------------------------------------
        // 2. 現代電梯華廈、北士科科技廠辦與玻璃帷幕摩天商辦
        // --------------------------------------------------------------------

        // 亮銀鈦合金與蔚藍玻璃 (北士科科技商辦)
        facadeMaterials.techSilver = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#f1f5f9', win: '#38bdf8', litWindow: '#e0f2fe', rows: 8, cols: 5, verticalPanels: true, padX: 0.1, padY: 0.16 }),
            roughness: 0.28, metalness: 0.55
        });

        // 珍珠白現代電梯華廈
        facadeMaterials.midriseMansion = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#f8fafc', win: '#60a5fa', litWindow: '#e0f2fe', rows: 8, cols: 5, balcony: true, balconyColor: 'rgba(226,232,240,0.85)', tileLines: true }),
            roughness: 0.45, metalness: 0.25
        });

        // 象牙白高層豪邸/總部商辦
        facadeMaterials.highriseLuxury = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#f8fafc', win: '#38bdf8', litWindow: '#e0f2fe', rows: 12, cols: 6, padX: 0.1, padY: 0.15 }),
            roughness: 0.25, metalness: 0.5
        });

        // 蔚藍天空反光玻璃帷幕大樓
        facadeMaterials.glassTower = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#38bdf8', win: '#e0f2fe', litWindow: '#ffffff', rows: 14, cols: 8, padX: 0.08, padY: 0.12 }),
            roughness: 0.15, metalness: 0.75
        });

        // 公共文教機關 (學校、法院、行政大樓)
        facadeMaterials.institutional = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#f1f5f9', win: '#60a5fa', rows: 4, cols: 6, padX: 0.18, padY: 0.24 }),
            roughness: 0.55, metalness: 0.12
        });

        // 醫院醫療大樓
        facadeMaterials.hospital = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#ffffff', win: '#0284c7', rows: 9, cols: 6, padX: 0.14, padY: 0.2 }),
            roughness: 0.35, metalness: 0.2
        });

        // --------------------------------------------------------------------
        // 3. 屋頂材質庫：明亮淺水泥粉光與台灣五彩繽紛波浪鐵皮加蓋
        // --------------------------------------------------------------------
        roofMaterials.concrete = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72 });
        roofMaterials.darkConcrete = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 });
        
        // 經典台灣頂樓鐵皮五彩 (鮮豔、清爽、生動)
        roofMaterials.tinGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45, metalness: 0.2 });
        roofMaterials.tinDarkGreen = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5, metalness: 0.2 });
        roofMaterials.tinBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45, metalness: 0.25 });
        roofMaterials.tinRustRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5, metalness: 0.2 });
        roofMaterials.tinSilver = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.45 });
        roofMaterials.tinYellowGreen = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.48, metalness: 0.2 });
    }

    ns.Materials = {
        facadeMaterials,
        roofMaterials,
        FACADE_KEYS_WALKUP,
        ROOF_TIN_KEYS,
        initMaterials
    };
})(window.ShilinDrone);

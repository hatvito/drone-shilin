// ============================================================================
// js/materials/materials.js: 建築立面材質庫、鐵皮加蓋屋頂、洗石子與公共建築材質
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    const facadeMaterials = {};
    const roofMaterials = {};

    const FACADE_KEYS_WALKUP = ['oldGreyStone', 'oldWarmTile', 'pinkCeramic', 'redBrick', 'greenMosaic', 'ochreStucco'];
    const ROOF_TIN_KEYS = ['tinGreen', 'tinDarkGreen', 'tinBlue', 'tinRed', 'tinSilver'];

    function initMaterials() {
        const makeTex = ns.FacadeTextures.makeFacadeTexture;

        // 台灣步登公寓外牆（老灰石、暖色二丁掛、粉紅馬賽克、紅磚、青苔綠磚、黃赭粉刷）
        facadeMaterials.oldGreyStone = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#cec8be', win: '#334155', litWindow: '#fef08a', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true }),
            roughness: 0.85, metalness: 0.08
        });

        facadeMaterials.oldWarmTile = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#dfd3c3', win: '#1e293b', litWindow: '#fde68a', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true, tileLines: true }),
            roughness: 0.8, metalness: 0.1
        });

        facadeMaterials.pinkCeramic = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#d9beb8', win: '#334155', litWindow: '#fef3c7', rows: 6, cols: 4, balcony: true, tileLines: true, acUnit: true }),
            roughness: 0.75, metalness: 0.12
        });

        facadeMaterials.redBrick = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#b87d6b', win: '#1e293b', litWindow: '#fde047', rows: 5, cols: 4, balcony: true, tileLines: true, ledgeColor: '#e2d9ce' }),
            roughness: 0.82, metalness: 0.08
        });

        facadeMaterials.greenMosaic = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#b8cbbd', win: '#1e293b', rows: 5, cols: 4, balcony: true, ironBars: true, acUnit: true }),
            roughness: 0.82, metalness: 0.1
        });

        facadeMaterials.ochreStucco = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#d6c19e', win: '#334155', rows: 4, cols: 3, balcony: false, acUnit: true }),
            roughness: 0.85, metalness: 0.05
        });

        // 現代華廈與北士科玻璃帷幕摩天商辦
        facadeMaterials.midriseMansion = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#cbd5e1', win: '#0f172a', litWindow: '#bae6fd', rows: 8, cols: 5, balcony: true, balconyColor: 'rgba(15,23,42,0.45)', tileLines: true }),
            roughness: 0.5, metalness: 0.3
        });

        facadeMaterials.highriseLuxury = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#94a3b8', win: '#0f172a', litWindow: '#e0f2fe', rows: 12, cols: 6, padX: 0.1, padY: 0.15 }),
            roughness: 0.3, metalness: 0.55
        });

        facadeMaterials.glassTower = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#60a5fa', win: '#091526', litWindow: '#7dd3fc', rows: 14, cols: 8, padX: 0.08, padY: 0.12 }),
            roughness: 0.18, metalness: 0.78
        });

        facadeMaterials.institutional = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#d6ccc0', win: '#334155', rows: 4, cols: 6, padX: 0.18, padY: 0.24 }),
            roughness: 0.65, metalness: 0.15
        });

        facadeMaterials.hospital = new THREE.MeshStandardMaterial({
            map: makeTex({ bg: '#f1f5f9', win: '#0369a1', rows: 9, cols: 6, padX: 0.14, padY: 0.2 }),
            roughness: 0.4, metalness: 0.25
        });

        // 屋頂材質庫：水泥粉光與台灣常見五彩波浪鐵皮加蓋
        roofMaterials.concrete = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.9 });
        roofMaterials.darkConcrete = new THREE.MeshStandardMaterial({ color: 0x8c8881, roughness: 0.92 });
        roofMaterials.tinGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55, metalness: 0.25 });
        roofMaterials.tinDarkGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, metalness: 0.25 });
        roofMaterials.tinBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.55, metalness: 0.3 });
        roofMaterials.tinRed = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6, metalness: 0.25 });
        roofMaterials.tinSilver = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.5 });
    }

    ns.Materials = {
        facadeMaterials,
        roofMaterials,
        FACADE_KEYS_WALKUP,
        ROOF_TIN_KEYS,
        initMaterials
    };
})(window.ShilinDrone);

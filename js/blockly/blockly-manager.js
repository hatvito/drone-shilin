// ============================================================================
// js/blockly/blockly-manager.js: Blockly 工作區生命週期、即時代碼編譯與沙盒橋接
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    let workspace = null;
    let isFullscreenWorkspace = false;

    function initBlocklySystem() {
        if (typeof Blockly === 'undefined') {
            console.error('[Blockly] 尚未載入 Blockly 函式庫');
            return;
        }

        // 1. 初始化積木與生成器
        if (ns.BlocklyBlocks && ns.BlocklyBlocks.initDroneBlocks) {
            ns.BlocklyBlocks.initDroneBlocks();
        }
        if (ns.BlocklyGenerators && ns.BlocklyGenerators.initDroneGenerators) {
            ns.BlocklyGenerators.initDroneGenerators();
        }

        const container = document.getElementById('blockly-workspace-div');
        if (!container) return;

        // 2. 注入 Blockly 工作區 (套用深色主題與縮放控制)
        const theme = Blockly.Themes.Dark || null;
        workspace = Blockly.inject(container, {
            toolbox: ns.BlocklyToolbox.DRONE_TOOLBOX,
            theme: theme,
            grid: {
                spacing: 20,
                length: 3,
                colour: 'rgba(255, 255, 255, 0.08)',
                snap: true
            },
            zoom: {
                controls: true,
                wheel: true,
                startScale: 0.85,
                maxScale: 2.0,
                minScale: 0.4,
                scaleSpeed: 1.15
            },
            trashcan: true,
            move: {
                scrollbars: true,
                drag: true,
                wheel: false
            }
        });

        // 3. 載入預設初始避障積木範本
        loadDefaultWorkspace();

        // 4. 監聽積木變更，即時編譯為 JavaScript
        workspace.addChangeListener((event) => {
            if (event.isUiEvent) return;
            compileBlocksToCode();
        });

        // 首次即時編譯
        compileBlocksToCode();

        // 5. 設定 Flyout 自動關閉 (拖拉積木完成後自動收回抽屜)
        const flyout = (workspace.getFlyout ? workspace.getFlyout() : null) || (workspace.getToolbox && workspace.getToolbox().getFlyout ? workspace.getToolbox().getFlyout() : null);
        if (flyout) {
            flyout.autoClose = true;

            const origHide = flyout.hide.bind(flyout);
            flyout.hide = function() {
                origHide();
                syncFlyoutScrollbars();
            };

            const origSetVisible = flyout.setVisible.bind(flyout);
            flyout.setVisible = function(visible) {
                origSetVisible(visible);
                syncFlyoutScrollbars();
            };
        }

        // 6. 攔截 Toolbox 點擊：再次點擊同一分類即可取消選取並收回抽屜
        const toolbox = workspace.getToolbox();
        if (toolbox) {
            const origSetSelectedItem = toolbox.setSelectedItem.bind(toolbox);
            toolbox.setSelectedItem = function(item) {
                // 如果點擊的是目前已經展開的同一分類，則清除選取並收回抽屜
                if (this.selectedItem_ === item && item !== null) {
                    this.clearSelection();
                    const activeFlyout = this.getFlyout ? this.getFlyout() : this.flyout_;
                    if (activeFlyout) activeFlyout.hide();
                    syncFlyoutScrollbars();
                    updateFlyoutCloseButton(false);
                    return;
                }
                origSetSelectedItem(item);
                syncFlyoutScrollbars();
                updateFlyoutCloseButton(item !== null);
            };
        }

        // 7. 點擊工作區空白背景或非抽屜區域時，自動收回抽屜
        container.addEventListener('pointerdown', (e) => {
            const isInsideDrawer = e.target && e.target.closest && (e.target.closest('.blocklyFlyout') || e.target.closest('.blocklyToolboxDiv'));
            if (!isInsideDrawer) {
                closeFlyout();
            }
        });

        // 8. 點擊 3D 場景或其他外部區域時，自動收回抽屜
        document.addEventListener('pointerdown', (e) => {
            const blocklyCard = document.getElementById('blockly-card');
            if (blocklyCard && !blocklyCard.contains(e.target)) {
                closeFlyout();
            }
        });

        // 9. 按下 Escape 鍵時，自動收回抽屜
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeFlyout();
            }
        });

        // 10. 監聽 DOM 變動，確保 Tailwind CSS 重置不會覆蓋 display="none"
        const observer = new MutationObserver(() => {
            syncFlyoutScrollbars();
        });
        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['display', 'style', 'class']
        });

        // 響應視窗縮放
        window.addEventListener('resize', onWorkspaceResize);

        // 確保 DOM 渲染與 Flex 尺寸計算完成後呼叫 svgResize 與置中
        setTimeout(() => {
            if (workspace) {
                Blockly.svgResize(workspace);
                workspace.scrollCenter();
                syncFlyoutScrollbars();
            }
        }, 120);

        console.log('[Blockly] 視覺化積木工作區啟動成功');
    }

    function onWorkspaceResize() {
        if (workspace) {
            Blockly.svgResize(workspace);
        }
    }

    function loadDefaultWorkspace() {
        if (!workspace) return;
        try {
            workspace.clear();
            const xml = Blockly.utils.xml.textToDom(ns.BlocklyToolbox.DEFAULT_WORKSPACE_XML);
            Blockly.Xml.domToWorkspace(xml, workspace);
            compileBlocksToCode();
        } catch (e) {
            console.error('[Blockly] 載入預設積木範本失敗：', e);
        }
    }

    function resetDefaultBlocks() {
        if (confirm('確定要還原為預設避障積木範本嗎？現有積木排列將被重置。')) {
            loadDefaultWorkspace();
        }
    }

    // 將 Blockly 積木即時轉換為 JavaScript 代碼並寫入底層 code-editor
    function compileBlocksToCode() {
        if (!workspace) return '';

        const jsGen = (typeof javascript !== 'undefined' && javascript.javascriptGenerator)
            ? javascript.javascriptGenerator
            : (typeof Blockly !== 'undefined' ? Blockly.JavaScript : null);

        if (!jsGen) return '';

        let generatedCode = '';
        try {
            generatedCode = jsGen.workspaceToCode(workspace);
        } catch (e) {
            console.warn('[Blockly] 代碼生成中：', e);
            return '';
        }

        // 同步寫入 #code-editor 供 FlightEngine 執行
        const hiddenEditor = document.getElementById('code-editor');
        if (hiddenEditor) {
            hiddenEditor.value = generatedCode;
        }

        // 若開啟了代碼預覽彈窗，同步更新
        const previewEl = document.getElementById('blockly-code-preview-text');
        if (previewEl) {
            previewEl.value = generatedCode;
        }

        return generatedCode;
    }

    // 查看當前積木生成的 JavaScript
    function openCodePreviewModal() {
        const modal = document.getElementById('blockly-preview-modal');
        const code = compileBlocksToCode();
        const previewEl = document.getElementById('blockly-code-preview-text');
        if (previewEl) previewEl.value = code;
        if (modal) modal.classList.remove('hidden');
    }

    function closeCodePreviewModal() {
        const modal = document.getElementById('blockly-preview-modal');
        if (modal) modal.classList.add('hidden');
    }

    function copyGeneratedCode() {
        const previewEl = document.getElementById('blockly-code-preview-text');
        if (!previewEl) return;
        previewEl.select();
        navigator.clipboard.writeText(previewEl.value).then(() => {
            const btn = document.getElementById('btn-copy-generated-code');
            if (btn) {
                btn.textContent = '✅ 已複製！';
                setTimeout(() => { btn.textContent = '📋 一鍵複製 JavaScript'; }, 2000);
            }
        });
    }

    // 同步並確保 Flyout 關閉時其垂直捲軸 (blocklyFlyoutScrollbar) 100% 隱藏消失
    function syncFlyoutScrollbars() {
        if (!workspace) return;
        const toolbox = workspace.getToolbox ? workspace.getToolbox() : null;
        const flyout = (toolbox && toolbox.getFlyout) ? toolbox.getFlyout() : (workspace.getFlyout ? workspace.getFlyout() : null);
        const isFlyoutVisible = flyout && flyout.isVisible && flyout.isVisible();
        const flyoutScrollbars = document.querySelectorAll('.blocklyFlyoutScrollbar');
        flyoutScrollbars.forEach(sb => {
            if (!isFlyoutVisible) {
                sb.style.setProperty('display', 'none', 'important');
                sb.style.setProperty('visibility', 'hidden', 'important');
                sb.setAttribute('display', 'none');
                sb.querySelectorAll('rect, g').forEach(el => {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                });
            } else {
                sb.style.removeProperty('display');
                sb.style.removeProperty('visibility');
                sb.querySelectorAll('rect, g').forEach(el => {
                    el.style.removeProperty('display');
                    el.style.removeProperty('visibility');
                });
            }
        });
    }

    // 收回積木抽屜與取消選取
    function closeFlyout() {
        if (!workspace) return;
        const toolbox = workspace.getToolbox();
        if (toolbox) {
            toolbox.clearSelection();
        }
        const flyout = (toolbox && toolbox.getFlyout) ? toolbox.getFlyout() : (workspace.getFlyout ? workspace.getFlyout() : null);
        if (flyout) {
            flyout.hide();
        }
        syncFlyoutScrollbars();
        updateFlyoutCloseButton(false);
    }

    // 控制「✕ 收回」按鈕的顯隱狀態
    function updateFlyoutCloseButton(show) {
        const btn = document.getElementById('btn-close-flyout');
        if (btn) {
            if (show) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        }
    }

    // 展開 / 收合全螢幕積木工作區
    function toggleFullscreenWorkspace() {
        isFullscreenWorkspace = !isFullscreenWorkspace;
        const panel = document.getElementById('blockly-panel');
        const btn = document.getElementById('btn-toggle-fs-blockly');

        if (panel) {
            if (isFullscreenWorkspace) {
                panel.classList.remove('w-80', 'sm:w-96', 'left-2.5', 'top-16', 'sm:top-20', 'bottom-3');
                panel.classList.add('fixed', 'inset-3', 'z-40', 'w-auto');
                if (btn) btn.innerHTML = '<span>🗗 縮回</span>';
            } else {
                panel.classList.remove('fixed', 'inset-3', 'z-40', 'w-auto');
                panel.classList.add('fixed', 'left-2.5', 'top-16', 'sm:top-20', 'bottom-3', 'z-20', 'w-80', 'sm:w-96');
                if (btn) btn.innerHTML = '<span>⛶ 展開</span>';
            }
            setTimeout(onWorkspaceResize, 150);
        }
    }

    ns.BlocklyManager = {
        initBlocklySystem,
        compileBlocksToCode,
        loadDefaultWorkspace,
        resetDefaultBlocks,
        openCodePreviewModal,
        closeCodePreviewModal,
        copyGeneratedCode,
        toggleFullscreenWorkspace,
        onWorkspaceResize,
        resize: onWorkspaceResize,
        closeFlyout
    };

    // 掛載至 window 供 HTML 按鈕直接呼叫
    window.openCodePreviewModal = openCodePreviewModal;
    window.closeCodePreviewModal = closeCodePreviewModal;
    window.copyGeneratedCode = copyGeneratedCode;
    window.resetDefaultBlocks = resetDefaultBlocks;
    window.toggleFullscreenWorkspace = toggleFullscreenWorkspace;
    window.closeFlyout = closeFlyout;
})(window.ShilinDrone);

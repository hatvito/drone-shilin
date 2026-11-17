// ============================================================================
// js/network/leaderboard.js: Firebase 雲端即時排行榜、防作弊物理校驗與成績登錄
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    // Firebase 專案設定金鑰
    const firebaseConfig = {
        apiKey: "AIzaSyAWGILP7NFim_Lk94VvI-_4mBXvoW918ZQ",
        authDomain: "drone-shilin.firebaseapp.com",
        databaseURL: "https://drone-shilin-default-rtdb.firebaseio.com",
        projectId: "drone-shilin",
        storageBucket: "drone-shilin.firebasestorage.app",
        messagingSenderId: "646209844970",
        appId: "1:646209844970:web:9e620ed17353abb1fa4993"
    };

    let db = null;
    let isConnected = false;
    let currentLeaderboardData = [];
    let currentGhostData = null;
    let activeFilterDifficulty = 'normal';

    // 暫存上次完賽紀錄
    let lastVictoryRecord = null;

    function initLeaderboard() {
        try {
            if (window.firebase && firebase.initializeApp) {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(firebaseConfig);
                }
                db = firebase.database();

                // 監聽連線狀態
                const connectedRef = db.ref('.info/connected');
                connectedRef.on('value', snap => {
                    isConnected = snap.val() === true;
                    updateConnectionStatusUI(isConnected);
                });
                console.log('[Leaderboard] Firebase Realtime Database 初始化成功');
            } else {
                console.warn('[Leaderboard] 未偵測到 Firebase SDK，將自動使用離線 LocalStorage 模式');
                updateConnectionStatusUI(false);
            }
        } catch (e) {
            console.warn('[Leaderboard] Firebase 初始化異常，啟用離線容錯模式：', e);
            updateConnectionStatusUI(false);
        }

        // 綁定預設輸入姓名 (記住上次使用者名稱)
        const savedName = localStorage.getItem('shilin_player_name');
        const nameInput = document.getElementById('player-name-input');
        if (nameInput && savedName) {
            nameInput.value = savedName;
        }

        // 初始化當前考題即時排行與幽靈車
        const initialSeed = (ns.Config && ns.Config.getMissionSeed) ? ns.Config.getMissionSeed() : 1337;
        const initialDiff = (ns.State && ns.State.simSettings && ns.State.simSettings.difficulty) || 'normal';
        activeFilterDifficulty = initialDiff;
        onMissionChanged(initialSeed, initialDiff);
    }

    function updateConnectionStatusUI(online) {
        const dot = document.getElementById('lb-online-dot');
        const text = document.getElementById('lb-status-text');
        if (dot) {
            dot.className = online
                ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse'
                : 'w-2 h-2 rounded-full bg-amber-400';
            dot.title = online ? '雲端資料庫連線正常 (即時同步)' : '本機離線模式 (資料保存在本機)';
        }
        if (text) {
            text.textContent = online ? '🟢 雲端資料庫連線正常 (即時同步)' : '🟠 離線容錯模式 (LocalStorage)';
            text.className = online ? 'text-[11px] text-emerald-400 font-bold' : 'text-[11px] text-amber-400 font-bold';
        }
    }

    function getMissionKey(seed, difficulty) {
        return `${seed}_${difficulty}`;
    }

    // 當題目種子或難度等級改變時觸發
    function onMissionChanged(seed, difficulty) {
        if (!seed) seed = (ns.Config && ns.Config.getMissionSeed) ? ns.Config.getMissionSeed() : 1337;
        if (!difficulty) difficulty = (ns.State && ns.State.simSettings && ns.State.simSettings.difficulty) || 'normal';
        activeFilterDifficulty = difficulty;

        fetchLeaderboard(seed, difficulty, (list) => {
            currentLeaderboardData = list;
            updateBestBadgeUI(list);
            renderLeaderboardTable(list);
        });

        fetchGhost(seed, difficulty, (ghost) => {
            currentGhostData = ghost;
            if (ns.GhostDrone && ns.GhostDrone.setGhostRun) {
                ns.GhostDrone.setGhostRun(ghost);
            }
            updateGhostStatusUI(ghost);
        });
    }

    // 取得當前題目前的 10 名排行榜
    function fetchLeaderboard(seed, difficulty, callback) {
        const key = getMissionKey(seed, difficulty);

        if (db) {
            try {
                const lbRef = db.ref(`leaderboards/${key}`).orderByChild('time').limitToFirst(10);
                lbRef.off(); // 移除舊監聽
                lbRef.on('value', snap => {
                    const data = snap.val();
                    const list = [];
                    if (data) {
                        Object.keys(data).forEach(id => {
                            list.push({ id, ...data[id] });
                        });
                        list.sort((a, b) => a.time - b.time);
                    }
                    if (callback) callback(list);
                }, err => {
                    console.warn('[Leaderboard] 讀取雲端排行失敗，切換離線讀取：', err);
                    fallbackLocalLeaderboard(key, callback);
                });
                return;
            } catch (e) {
                console.warn('[Leaderboard] 資料庫連線異常：', e);
            }
        }

        fallbackLocalLeaderboard(key, callback);
    }

    function fallbackLocalLeaderboard(key, callback) {
        try {
            const raw = localStorage.getItem(`shilin_lb_${key}`);
            const list = raw ? JSON.parse(raw) : [];
            list.sort((a, b) => a.time - b.time);
            if (callback) callback(list.slice(0, 10));
        } catch (e) {
            if (callback) callback([]);
        }
    }

    // 取得當前題目第 1 名幽靈車航跡
    function fetchGhost(seed, difficulty, callback) {
        const key = getMissionKey(seed, difficulty);

        if (db) {
            try {
                const ghostRef = db.ref(`ghosts/${key}`);
                ghostRef.off();
                ghostRef.on('value', snap => {
                    const ghost = snap.val();
                    if (callback) callback(ghost);
                }, err => {
                    console.warn('[Ghost] 讀取幽靈車失敗，切換離線讀取：', err);
                    fallbackLocalGhost(key, callback);
                });
                return;
            } catch (e) {
                console.warn('[Ghost] 幽靈車連線異常：', e);
            }
        }

        fallbackLocalGhost(key, callback);
    }

    function fallbackLocalGhost(key, callback) {
        try {
            const raw = localStorage.getItem(`shilin_ghost_${key}`);
            const ghost = raw ? JSON.parse(raw) : null;
            if (callback) callback(ghost);
        } catch (e) {
            if (callback) callback(null);
        }
    }

    // 防作弊物理合理性校驗
    function validateFlightPhysics(flightTime, initialDist, blackboxLogs) {
        if (!flightTime || flightTime <= 0) return { valid: false, reason: '飛行時間無效' };
        if (initialDist < 20) return { valid: false, reason: '起訖距離過近' };

        // 無人機物理引擎最高設計限速為 18 m/s，放寬至 22 m/s 作為瞬時上限
        const avgSpeed = initialDist / flightTime;
        if (avgSpeed > 22.0) {
            return { valid: false, reason: `平均速度 (${avgSpeed.toFixed(1)} m/s) 超出無人機物理極限 (22 m/s)` };
        }

        if (!blackboxLogs || blackboxLogs.length < 5) {
            return { valid: false, reason: '黑盒子軌跡樣本不足，判定為瞬間瞬移' };
        }

        return { valid: true, avgSpeed };
    }

    // 提交成績與幽靈車軌跡
    function submitScore(nameInputVal) {
        if (!lastVictoryRecord) {
            alert('尚未有完賽紀錄可登錄！');
            return;
        }

        const name = (nameInputVal || '匿名飛手').trim().substring(0, 16);
        localStorage.setItem('shilin_player_name', name);

        const { seed, difficulty, flightTime, initialDist, logs } = lastVictoryRecord;
        const validation = validateFlightPhysics(flightTime, initialDist, logs);

        if (!validation.valid) {
            alert(`⚠️ 成績登錄失敗：${validation.reason}`);
            return;
        }

        const avgSpeed = validation.avgSpeed;
        const key = getMissionKey(seed, difficulty);
        const recordId = 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        const entry = {
            id: recordId,
            name: name,
            time: parseFloat(flightTime.toFixed(2)),
            avgSpeed: parseFloat(avgSpeed.toFixed(1)),
            difficulty: difficulty,
            seed: seed,
            date: new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }),
            timestamp: Date.now()
        };

        // 判斷是否刷新該題最佳紀錄 (Ghost 幽靈車)
        const isNewBest = (!currentGhostData || flightTime < currentGhostData.time);

        // 軌跡降採樣 (~0.2s 取一點，壓低儲存負擔)
        let sampledPath = [];
        if (isNewBest && logs && logs.length > 0) {
            let lastT = -1;
            for (let i = 0; i < logs.length; i++) {
                const pt = logs[i];
                if (pt.t - lastT >= 0.2 || i === logs.length - 1) {
                    sampledPath.push([
                        parseFloat(pt.x.toFixed(2)),
                        parseFloat(pt.y.toFixed(2)),
                        parseFloat(pt.z.toFixed(2))
                    ]);
                    lastT = pt.t;
                }
            }
        }

        const newGhost = isNewBest ? {
            holder: name,
            time: entry.time,
            seed: seed,
            difficulty: difficulty,
            points: sampledPath,
            dt: 0.2,
            timestamp: Date.now()
        } : null;

        // 寫入雲端 Firebase
        if (db) {
            try {
                // 1. 寫入排行榜清單
                db.ref(`leaderboards/${key}/${recordId}`).set(entry);

                // 2. 若打破第一名，更新幽靈車
                if (isNewBest && newGhost) {
                    db.ref(`ghosts/${key}`).set(newGhost);
                }
            } catch (err) {
                console.warn('[Leaderboard] 寫入雲端失敗，同步寫入本機備份：', err);
            }
        }

        // 同步存入 LocalStorage 容錯
        try {
            const raw = localStorage.getItem(`shilin_lb_${key}`);
            const list = raw ? JSON.parse(raw) : [];
            list.push(entry);
            list.sort((a, b) => a.time - b.time);
            localStorage.setItem(`shilin_lb_${key}`, JSON.stringify(list.slice(0, 20)));

            if (isNewBest && newGhost) {
                localStorage.setItem(`shilin_ghost_${key}`, JSON.stringify(newGhost));
            }
        } catch (e) {}

        // 更新 UI 提示
        const victoryResultEl = document.getElementById('victory-submit-result');
        if (victoryResultEl) {
            victoryResultEl.className = 'p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold text-center';
            victoryResultEl.innerHTML = isNewBest
                ? `🎉 登錄成功！你創下了種子碼 #${seed} 的【全場最速紀錄 (${entry.time}s)】！<br>你的飛行軌跡已升級為全區「幽靈領跑無人機」！👻`
                : `✅ 登錄成功！成績：${entry.time} 秒，平均速度：${entry.avgSpeed} m/s。已納入雲端前十傑！`;
            victoryResultEl.classList.remove('hidden');
        }

        const submitBtn = document.getElementById('btn-confirm-submit-score');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '✅ 已成功登錄';
            submitBtn.className = 'w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs cursor-not-allowed';
        }

        // 刷新排行榜介面
        onMissionChanged(seed, difficulty);
    }

    // 彈出完賽登錄視窗
    function showVictoryModal(flightTime, blackboxLogs) {
        const seed = (ns.Config && ns.Config.getMissionSeed) ? ns.Config.getMissionSeed() : 1337;
        const difficulty = (ns.State && ns.State.simSettings && ns.State.simSettings.difficulty) || 'normal';
        const initialDist = (ns.State && ns.State.flightState && ns.State.flightState.initialDistance) || 200;

        lastVictoryRecord = {
            seed,
            difficulty,
            flightTime,
            initialDist,
            logs: (blackboxLogs || []).slice()
        };

        const modal = document.getElementById('victory-modal');
        if (!modal) return;

        // 填寫數據
        const timeEl = document.getElementById('victory-time-val');
        if (timeEl) timeEl.textContent = flightTime.toFixed(2);

        const infoEl = document.getElementById('victory-info-meta');
        if (infoEl) {
            const diffNames = { easy: '🟢 入門 40m', normal: '🟡 標準 25m', hard: '🔴 極限 15m' };
            const speed = (initialDist / flightTime).toFixed(1);
            infoEl.textContent = `種子碼 #${seed} · 難度：${diffNames[difficulty] || difficulty} · 航程：${initialDist.toFixed(1)}m · 均速：${speed} m/s`;
        }

        // 判斷是否為新紀錄
        const crownNotice = document.getElementById('victory-crown-notice');
        if (crownNotice) {
            if (!currentGhostData || flightTime < currentGhostData.time) {
                crownNotice.classList.remove('hidden');
                crownNotice.innerHTML = `👑 卓越成就！此秒數打破了目前第 1 名紀錄 (${currentGhostData ? currentGhostData.time + 's' : '尚無紀錄'})，登錄後將成為幽靈領航員！`;
            } else {
                crownNotice.classList.add('hidden');
            }
        }

        const submitResult = document.getElementById('victory-submit-result');
        if (submitResult) submitResult.classList.add('hidden');

        const submitBtn = document.getElementById('btn-confirm-submit-score');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 登錄到雲端排行榜';
            submitBtn.className = 'w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-cyan-500/25 transition';
        }

        modal.classList.remove('hidden');
    }

    function closeVictoryModal() {
        const modal = document.getElementById('victory-modal');
        if (modal) modal.classList.add('hidden');
    }

    // 排行榜彈窗控制
    function openLeaderboardModal() {
        const modal = document.getElementById('leaderboard-modal');
        if (!modal) return;

        const seed = (ns.Config && ns.Config.getMissionSeed) ? ns.Config.getMissionSeed() : 1337;
        const diff = (ns.State && ns.State.simSettings && ns.State.simSettings.difficulty) || 'normal';
        activeFilterDifficulty = diff;

        // 設定難度標籤高亮
        updateFilterTabsUI(diff);

        // 載入即時資料
        onMissionChanged(seed, diff);

        modal.classList.remove('hidden');
    }

    function closeLeaderboardModal() {
        const modal = document.getElementById('leaderboard-modal');
        if (modal) modal.classList.add('hidden');
    }

    function switchLeaderboardTab(difficulty) {
        activeFilterDifficulty = difficulty;
        updateFilterTabsUI(difficulty);
        const seed = (ns.Config && ns.Config.getMissionSeed) ? ns.Config.getMissionSeed() : 1337;

        fetchLeaderboard(seed, difficulty, (list) => {
            currentLeaderboardData = list;
            renderLeaderboardTable(list);
        });

        fetchGhost(seed, difficulty, (ghost) => {
            updateGhostStatusUI(ghost);
        });
    }

    function updateFilterTabsUI(activeDiff) {
        ['easy', 'normal', 'hard'].forEach(d => {
            const btn = document.getElementById('lb-tab-' + d);
            if (btn) {
                if (d === activeDiff) {
                    btn.className = 'px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black shadow-md transition text-xs';
                } else {
                    btn.className = 'px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-bold transition text-xs';
                }
            }
        });
    }

    // 渲染排行榜表格
    function renderLeaderboardTable(list) {
        const tbody = document.getElementById('leaderboard-tbody');
        const emptyState = document.getElementById('leaderboard-empty');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!list || list.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        list.slice(0, 10).forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800/80 hover:bg-slate-800/40 transition';

            // 排名勳章樣式
            let rankBadge = `<span class="px-2 py-0.5 rounded font-black text-xs text-slate-400">#${index + 1}</span>`;
            if (index === 0) rankBadge = `<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/50 font-black text-xs">🥇 冠軍</span>`;
            else if (index === 1) rankBadge = `<span class="px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-200 border border-slate-300/40 font-black text-xs">🥈 亞軍</span>`;
            else if (index === 2) rankBadge = `<span class="px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-400 border border-amber-600/40 font-black text-xs">🥉 季軍</span>`;

            tr.innerHTML = `
                <td class="py-2.5 px-3 text-center whitespace-nowrap">${rankBadge}</td>
                <td class="py-2.5 px-3 font-bold text-white whitespace-nowrap">${escapeHtml(item.name || '飛手')}</td>
                <td class="py-2.5 px-3 code-font font-black text-emerald-400 whitespace-nowrap">${parseFloat(item.time).toFixed(2)} s</td>
                <td class="py-2.5 px-3 code-font text-cyan-300 text-xs whitespace-nowrap">${item.avgSpeed ? item.avgSpeed + ' m/s' : '--'}</td>
                <td class="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">${item.date || '--'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function updateBestBadgeUI(list) {
        const badge = document.getElementById('seed-best-record');
        if (!badge) return;

        if (list && list.length > 0) {
            const best = list[0];
            badge.innerHTML = `<span class="text-amber-300 font-bold">${best.time.toFixed(2)}s</span> <span class="text-slate-300 text-[10px]">(${escapeHtml(best.name)})</span>`;
        } else {
            badge.innerHTML = `<span class="text-slate-500">尚無紀錄</span>`;
        }
    }

    function updateGhostStatusUI(ghost) {
        const ghostDesc = document.getElementById('lb-ghost-desc');
        if (ghostDesc) {
            if (ghost && ghost.holder && ghost.points && ghost.points.length > 0) {
                ghostDesc.innerHTML = `👑 目前最速保持人：<span class="text-amber-300 font-bold">${escapeHtml(ghost.holder)}</span> · 紀錄：<span class="text-emerald-300 font-bold code-font">${ghost.time.toFixed(2)}s</span> · 軌跡點數：${ghost.points.length} 點`;
            } else {
                ghostDesc.innerHTML = `👻 該題型尚未有幽靈車紀錄。第一個成功抵達終點的同學，將成為首位幽靈領航員！`;
            }
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    ns.Leaderboard = {
        initLeaderboard,
        onMissionChanged,
        fetchLeaderboard,
        fetchGhost,
        submitScore,
        showVictoryModal,
        closeVictoryModal,
        openLeaderboardModal,
        closeLeaderboardModal,
        switchLeaderboardTab
    };

    // 掛載至 window
    window.openLeaderboardModal = openLeaderboardModal;
    window.closeLeaderboardModal = closeLeaderboardModal;
    window.showVictoryModal = showVictoryModal;
    window.closeVictoryModal = closeVictoryModal;
    window.switchLeaderboardTab = switchLeaderboardTab;
    window.submitScoreFromUI = () => {
        const input = document.getElementById('player-name-input');
        submitScore(input ? input.value : '');
    };
})(window.ShilinDrone);

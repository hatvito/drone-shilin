// ============================================================================
// js/simulation/audio.js: 輕量原生 Web Audio API 音效合成器 (免依賴外部音檔)
// ============================================================================
window.ShilinDrone = window.ShilinDrone || {};

(function(ns) {
    'use strict';

    let ctx = null;
    let propOsc = null;
    let propGain = null;
    let lastBeepTime = 0;

    function getAudioContext() {
        if (!ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) ctx = new AudioCtx();
        }
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }
        return ctx;
    }

    function startPropellerHum() {
        if (!ns.State.simSettings.soundEnabled) return;
        const ac = getAudioContext();
        if (!ac) return;

        if (!propOsc) {
            propOsc = ac.createOscillator();
            propOsc.type = 'sawtooth';
            propOsc.frequency.setValueAtTime(110, ac.currentTime);

            // 低通濾波器模擬馬達低鳴
            const filter = ac.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(320, ac.currentTime);

            propGain = ac.createGain();
            propGain.gain.setValueAtTime(0.04, ac.currentTime);

            propOsc.connect(filter);
            filter.connect(propGain);
            propGain.connect(ac.destination);
            propOsc.start();
        }
    }

    function stopPropellerHum() {
        if (propOsc) {
            try {
                propOsc.stop();
                propOsc.disconnect();
            } catch (e) {}
            propOsc = null;
            propGain = null;
        }
    }

    function setPropellerPitch(speedRatio) {
        if (propOsc && ctx) {
            const targetFreq = 110 + Math.min(speedRatio, 1.5) * 160;
            propOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);
        }
    }

    // 近距碰撞警戒短促嗶聲
    function playWarningBeep() {
        if (!ns.State.simSettings.soundEnabled) return;
        const now = Date.now();
        if (now - lastBeepTime < 350) return;
        lastBeepTime = now;

        const ac = getAudioContext();
        if (!ac) return;

        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ac.currentTime);
        gain.gain.setValueAtTime(0.12, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start();
        osc.stop(ac.currentTime + 0.12);
    }

    // 墜毀撞擊悶響
    function playCrashSound() {
        if (!ns.State.simSettings.soundEnabled) return;
        stopPropellerHum();
        const ac = getAudioContext();
        if (!ac) return;

        // 產生瞬間白噪音爆破聲
        const bufferSize = ac.sampleRate * 0.4;
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.08));
        }

        const noise = ac.createBufferSource();
        noise.buffer = buffer;
        const filter = ac.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, ac.currentTime);

        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.35, ac.currentTime);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ac.destination);
        noise.start();
    }

    // 成功降落勝利琶音
    function playVictoryFanfare() {
        if (!ns.State.simSettings.soundEnabled) return;
        stopPropellerHum();
        const ac = getAudioContext();
        if (!ac) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ac.currentTime + i * 0.12);
            gain.gain.setValueAtTime(0.15, ac.currentTime + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.35);

            osc.connect(gain);
            gain.connect(ac.destination);
            osc.start(ac.currentTime + i * 0.12);
            osc.stop(ac.currentTime + i * 0.12 + 0.35);
        });
    }

    ns.Audio = {
        startPropellerHum,
        stopPropellerHum,
        setPropellerPitch,
        playWarningBeep,
        playCrashSound,
        playVictoryFanfare
    };
})(window.ShilinDrone);

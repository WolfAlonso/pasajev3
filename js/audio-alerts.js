// =============================================================
// js/audio-alerts.js
// Alertas sonoras sintéticas usando Web Audio API.
// Sin dependencias externas, sin archivos mp3.
// =============================================================

(function () {
  'use strict';

  let audioCtx = null;
  let unlocked = false;

  // -------------------------------------------------------------
  // Inicializar / desbloquear el AudioContext
  // (los navegadores requieren una interacción del usuario)
  // -------------------------------------------------------------
  function ensureContext() {
    if (audioCtx) return audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    } catch (e) {
      console.warn('[PasajeAudio] No se pudo crear AudioContext:', e);
      audioCtx = null;
    }
    return audioCtx;
  }

  function unlock() {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => { unlocked = true; }).catch(() => {});
    } else {
      unlocked = true;
    }
  }

  // -------------------------------------------------------------
  // Tono base: crea un oscilador con envolvente ADSR simple
  // -------------------------------------------------------------
  function playTone(ctx, {
    freq = 880,
    duration = 0.18,
    type = 'sine',
    gain = 0.18,
    startAt = 0,
    attack = 0.01,
    release = 0.12
  } = {}) {
    const now = ctx.currentTime + startAt;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

    osc.connect(gainNode).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + release + 0.05);
  }

  // Aplica un barrido de frecuencia
  function playSweep(ctx, {
    freqStart = 600,
    freqEnd = 1200,
    duration = 0.22,
    type = 'sine',
    gain = 0.18,
    startAt = 0
  } = {}) {
    const now = ctx.currentTime + startAt;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.08);

    osc.connect(gainNode).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.15);
  }

  // -------------------------------------------------------------
  // Presets de sonido por tipo de evento
  // -------------------------------------------------------------
  const PRESETS = {
    // 🛒 Nuevo pedido: dos notas ascendentes
    order: (ctx) => {
      playTone(ctx, { freq: 784, duration: 0.14, type: 'triangle', gain: 0.20, startAt: 0 });
      playTone(ctx, { freq: 1046, duration: 0.18, type: 'triangle', gain: 0.20, startAt: 0.15 });
    },

    // 🛵 Nueva carrera / oferta: barrido tipo campana
    delivery: (ctx) => {
      playSweep(ctx, { freqStart: 520, freqEnd: 900, duration: 0.24, type: 'sine', gain: 0.22 });
      playTone(ctx, { freq: 1320, duration: 0.16, type: 'sine', gain: 0.14, startAt: 0.10 });
    },

    // 🏠 Nuevo lead inmobiliario: dos notas suaves tipo "ding"
    lead: (ctx) => {
      playTone(ctx, { freq: 660, duration: 0.22, type: 'sine', gain: 0.18, startAt: 0 });
      playTone(ctx, { freq: 880, duration: 0.26, type: 'sine', gain: 0.16, startAt: 0.18 });
    },

    // 💬 Mensaje nuevo: nota corta y aguda
    message: (ctx) => {
      playTone(ctx, { freq: 1200, duration: 0.09, type: 'sine', gain: 0.15, startAt: 0 });
      playTone(ctx, { freq: 1400, duration: 0.10, type: 'sine', gain: 0.13, startAt: 0.08 });
    },

    // ✅ Confirmación
    success: (ctx) => {
      playTone(ctx, { freq: 660, duration: 0.10, type: 'triangle', gain: 0.18, startAt: 0 });
      playTone(ctx, { freq: 880, duration: 0.10, type: 'triangle', gain: 0.18, startAt: 0.09 });
      playTone(ctx, { freq: 1320, duration: 0.16, type: 'triangle', gain: 0.16, startAt: 0.18 });
    },

    // ⚠️ Advertencia
    warning: (ctx) => {
      playTone(ctx, { freq: 440, duration: 0.16, type: 'square', gain: 0.12, startAt: 0 });
      playTone(ctx, { freq: 440, duration: 0.16, type: 'square', gain: 0.12, startAt: 0.22 });
    },

    // ❌ Error
    error: (ctx) => {
      playTone(ctx, { freq: 320, duration: 0.20, type: 'sawtooth', gain: 0.14, startAt: 0 });
      playTone(ctx, { freq: 240, duration: 0.26, type: 'sawtooth', gain: 0.14, startAt: 0.20 });
    }
  };

  // -------------------------------------------------------------
  // API pública
  // -------------------------------------------------------------
  function playAlert(type) {
    const preset = PRESETS[type] || PRESETS.message;
    const ctx = ensureContext();
    if (!ctx) return false;

    // Si está suspendido, intentar reanudar. Si no puede, salir silenciosamente.
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        try { preset(ctx); } catch (e) {}
      }).catch(() => {});
      return true;
    }

    try {
      preset(ctx);
      return true;
    } catch (e) {
      console.warn('[PasajeAudio] playAlert error:', e);
      return false;
    }
  }

  function setEnabled(flag) {
    try { localStorage.setItem('pasaje_audio_enabled', flag ? '1' : '0'); } catch (e) {}
  }

  function isEnabled() {
    try {
      const v = localStorage.getItem('pasaje_audio_enabled');
      return v === null ? true : v === '1';
    } catch (e) { return true; }
  }

  // -------------------------------------------------------------
  // Auto-unlock en la primera interacción del usuario
  // -------------------------------------------------------------
  function autoUnlock() {
    unlock();
    document.removeEventListener('click', autoUnlock);
    document.removeEventListener('touchstart', autoUnlock);
    document.removeEventListener('keydown', autoUnlock);
  }

  document.addEventListener('click', autoUnlock, { once: true });
  document.addEventListener('touchstart', autoUnlock, { once: true });
  document.addEventListener('keydown', autoUnlock, { once: true });

  // Reanudar AudioContext cuando la pestaña vuelve a primer plano
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  });

  window.PasajeAudio = {
    playAlert: (type) => isEnabled() ? playAlert(type) : false,
    play: playAlert,
    unlock,
    enable: () => setEnabled(true),
    disable: () => setEnabled(false),
    isEnabled
  };
})();
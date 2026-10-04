// =============================================================
// js/liquid-glass.js
// Aplica componentes de vidrio, tipografía, badges y botones.
// Renderizado optimizado para Confort Visual.
// =============================================================

(function () {
  'use strict';

  if (document.getElementById('pasajeLiquidGlassStyles')) return;

  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name);
      const t = (v || '').trim();
      return t || fallback;
    } catch (e) { return fallback; }
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '').trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return `${r},${g},${b}`;
    }
    if (clean.length !== 6) return '255,255,255';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r},${g},${b}`;
  }

  function injectStyles() {
    const blur    = cssVar('--glass-blur', '20px');
    const opacity = cssVar('--glass-opacity', '0.75');
    const tint    = cssVar('--glass-tint', '#FFFFFF');
    const border  = cssVar('--glass-border-opacity', '0.3');
    const radius  = cssVar('--theme-radius', '1rem');
    const tintRgb = hexToRgb(tint);

    const styleTag = document.createElement('style');
    styleTag.id = 'pasajeLiquidGlassStyles';
    styleTag.textContent = `
      :root {
        --glass-tint-rgb: ${tintRgb};
        --glass-bg: rgba(${tintRgb}, ${opacity});
        --glass-border-color: rgba(255, 255, 255, ${border});
        --glass-shadow: 0 10px 40px -12px rgba(15, 23, 42, 0.18);
      }

      .glass-card, .glass-panel, .liquid-glass {
        background-color: rgba(${tintRgb}, ${opacity}) !important;
        -webkit-backdrop-filter: blur(${blur}) saturate(150%);
        backdrop-filter: blur(${blur}) saturate(150%);
        border: 1px solid rgba(255, 255, 255, ${border});
        border-radius: ${radius};
        box-shadow: var(--glass-shadow);
        color: var(--color-text, inherit);
      }

      .glass-card h1, .glass-card h2, .glass-card h3, .glass-card h4,
      .glass-panel h1, .glass-panel h2, .glass-panel h3, .glass-panel h4 {
        color: var(--color-heading, inherit) !important;
      }

      .glass-card p, .glass-panel p, .liquid-glass p {
        color: var(--color-text, inherit) !important;
      }
    `;
    document.head.appendChild(styleTag);
  }

  injectStyles();

  window.addEventListener('pasaje:theme-applied', () => {
    const existing = document.getElementById('pasajeLiquidGlassStyles');
    if (existing) existing.remove();
    injectStyles();
  });

  window.PasajeLiquidGlass = {
    refresh: () => {
      const existing = document.getElementById('pasajeLiquidGlassStyles');
      if (existing) existing.remove();
      injectStyles();
    }
  };
})();
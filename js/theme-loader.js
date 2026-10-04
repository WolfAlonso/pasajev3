// =============================================================
// js/theme-loader.js
// Carga y aplica el tema activo, imágenes de fondo, logotipo, 
// sidebars, Liquid Glass y componentes en todo el sitio.
// =============================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'pasaje_theme_settings';

  // Catálogo completo de los 20 Presets Temáticos
  const PRESETS = {
    // 1. Confort Visual
    lectura_calida: {
      primary: '#D97706', secondary: '#FBF0D9', accent: '#78350F',
      heading_color: '#451A03', text_color: '#78350F', glass_tint: '#FDF6E2',
      bodyClass: 'theme-sepia'
    },
    oled_descanso: {
      primary: '#14B8A6', secondary: '#0F172A', accent: '#F59E0B',
      heading_color: '#F8FAFC', text_color: '#E2E8F0', glass_tint: '#1E293B',
      bodyClass: 'theme-slate-dark'
    },
    menta_bosque: {
      primary: '#10B981', secondary: '#064E3B', accent: '#A7F3D0',
      heading_color: '#ECFDF5', text_color: '#D1FAE5', glass_tint: '#065F46',
      bodyClass: 'theme-sage'
    },
    niebla_nordica: {
      primary: '#2563EB', secondary: '#F1F5F9', accent: '#1D4ED8',
      heading_color: '#0F172A', text_color: '#1E293B', glass_tint: '#FFFFFF',
      bodyClass: 'theme-nordic'
    },
    cafe_mocha: {
      primary: '#D97706', secondary: '#1C1917', accent: '#F59E0B',
      heading_color: '#FAFAF9', text_color: '#E7E5E4', glass_tint: '#292524',
      bodyClass: 'theme-mocha'
    },
    pergamino: {
      primary: '#C85A32', secondary: '#F5EBE0', accent: '#9A3412',
      heading_color: '#1C1917', text_color: '#2B2B2B', glass_tint: '#EAE0D5',
      bodyClass: 'theme-pergamino'
    },
    oled_puro: {
      primary: '#10B981', secondary: '#000000', accent: '#059669',
      heading_color: '#FFFFFF', text_color: '#E5E7EB', glass_tint: '#111111',
      bodyClass: 'theme-oled'
    },
    oceano_profundo: {
      primary: '#64FFDA', secondary: '#0A192F', accent: '#38BDF8',
      heading_color: '#E6F1FF', text_color: '#CCD6F6', glass_tint: '#112240',
      bodyClass: 'theme-ocean'
    },
    sombra_cerezo: {
      primary: '#EC4899', secondary: '#1A1625', accent: '#F43F5E',
      heading_color: '#FDF2F8', text_color: '#F3E8EE', glass_tint: '#2D2438',
      bodyClass: 'theme-cherry'
    },
    luz_atenuada: {
      primary: '#16A34A', secondary: '#F8FAF8', accent: '#059669',
      heading_color: '#0F172A', text_color: '#334155', glass_tint: '#FFFFFF',
      bodyClass: 'theme-soft-light'
    },

    // 2. Ferias & Festividades GT
    independencia: {
      primary: '#0066FF', secondary: '#0F172A', accent: '#60A5FA',
      heading_color: '#FFFFFF', text_color: '#E2E8F0', glass_tint: '#1E293B',
      bodyClass: 'theme-gt-independencia'
    },
    feria_xelaju: {
      primary: '#3B82F6', secondary: '#1E1B4B', accent: '#EF4444',
      heading_color: '#FFFFFF', text_color: '#E0E7FF', glass_tint: '#2E2A72',
      bodyClass: 'theme-xelafer'
    },
    semana_santa: {
      primary: '#7C3AED', secondary: '#2E1065', accent: '#FBBF24',
      heading_color: '#FEF3C7', text_color: '#EDE9FE', glass_tint: '#4C1D95',
      bodyClass: 'theme-semana-santa'
    },
    fiambre: {
      primary: '#9333EA', secondary: '#3B0764', accent: '#FACC15',
      heading_color: '#FEF08A', text_color: '#F5D0FE', glass_tint: '#581C87',
      bodyClass: 'theme-fiambre'
    },
    barriletes_gigantes: {
      primary: '#F97316', secondary: '#0F172A', accent: '#06B6D4',
      heading_color: '#FFFFFF', text_color: '#F1F5F9', glass_tint: '#1E293B',
      bodyClass: 'theme-barriletes'
    },
    navidad_chapina: {
      primary: '#DC2626', secondary: '#052E16', accent: '#FBBF24',
      heading_color: '#FEF3C7', text_color: '#DCFCE7', glass_tint: '#14532D',
      bodyClass: 'theme-navidad'
    },
    ano_nuevo: {
      primary: '#FBBF24', secondary: '#09090B', accent: '#F59E0B',
      heading_color: '#FFFFFF', text_color: '#F4F4F5', glass_tint: '#18181B',
      bodyClass: 'theme-ano-nuevo'
    },
    halloween: {
      primary: '#EA580C', secondary: '#180228', accent: '#A855F7',
      heading_color: '#FAF5FF', text_color: '#F3E8FF', glass_tint: '#2E1065',
      bodyClass: 'theme-halloween'
    },
    rabin_ajau: {
      primary: '#0D9488', secondary: '#064E3B', accent: '#F43F5E',
      heading_color: '#ECFDF5', text_color: '#CCFBF1', glass_tint: '#047857',
      bodyClass: 'theme-rabin-ajau'
    },
    quema_del_diablo: {
      primary: '#EF4444', secondary: '#1C1917', accent: '#F97316',
      heading_color: '#FAFAF9', text_color: '#F5F5F4', glass_tint: '#292524',
      bodyClass: 'theme-quema-diablo'
    },
    default: {
      primary: '#10B981', secondary: '#064E3B', accent: '#F59E0B',
      heading_color: '#1F2937', text_color: '#4B5563', glass_tint: '#FFFFFF',
      bodyClass: ''
    }
  };

  const DEFAULTS = {
    heading_color: '#1F2937',
    text_color: '#4B5563',
    glass_blur: '20px',
    glass_opacity: '0.75',
    glass_tint: '#FFFFFF',
    glass_border_opacity: '0.3',
    product_card_tint: '#FFFFFF',
    product_card_opacity: '0.92',
    product_card_blur: '14px',
    product_card_radius: '1rem',
    product_card_padding: '1rem'
  };

  function loadFromCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveToCache(settings) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
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

  function normalizeBlur(v, fallback) {
    const s = String(v || '').trim();
    if (!s) return fallback;
    return /^\d+(\.\d+)?$/.test(s) ? s + 'px' : s;
  }

  function normalizeOpacity(v, fallback) {
    const s = String(v || '').trim();
    if (!s) return fallback;
    if (s.endsWith('%')) {
      const n = parseFloat(s) / 100;
      return isNaN(n) ? fallback : String(Math.max(0, Math.min(1, n)));
    }
    const n = parseFloat(s);
    if (isNaN(n)) return fallback;
    if (n > 1) return String(Math.max(0, Math.min(1, n / 100)));
    return String(Math.max(0, Math.min(1, n)));
  }

  function injectDynamicStyles() {
    let styleEl = document.getElementById('pasajeThemeDynamicStyles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'pasajeThemeDynamicStyles';
      (document.head || document.documentElement).appendChild(styleEl);
    }

    styleEl.textContent = `
      body {
        background-color: var(--color-secondary, #f8fafc) !important;
        color: var(--color-text, #1e293b) !important;
      }

      h1, h2, h3, h4, h5, h6, .theme-heading {
        color: var(--color-heading, var(--color-text, #0f172a));
      }

      .glass-header, .theme-header {
        background-color: rgba(var(--header-glass-tint-rgb, var(--color-primary-rgb, 30, 58, 138)), var(--header-glass-opacity, 0.95)) !important;
        backdrop-filter: blur(var(--header-glass-blur, 16px)) saturate(160%) !important;
        -webkit-backdrop-filter: blur(var(--header-glass-blur, 16px)) saturate(160%) !important;
      }

      /* 1. Módulos y Contenedores (Afectados por admin-diseno-efectos.html) */
      .glass-container, .glass-module {
        background-color: rgba(var(--glass-tint-rgb, 255, 255, 255), var(--glass-opacity, 0.75)) !important;
        backdrop-filter: blur(var(--glass-blur, 20px)) saturate(160%) !important;
        -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(160%) !important;
        border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity, 0.3)) !important;
        border-radius: 1.25rem !important;
      }

      .glass-container .module-title, .glass-module .module-title {
        color: var(--module-heading-color, var(--color-heading, #0f172a)) !important;
      }

      .glass-container .module-body, .glass-module .module-body {
        color: var(--module-text-color, var(--color-text, #334155)) !important;
      }

      /* 2. Tarjetas de Productos EXCLUSIVAMENTE (Afectadas por admin-diseno-componentes.html) */
      .glass-card-product, .product-card {
        background-color: rgba(var(--product-card-tint-rgb, 255, 255, 255), var(--product-card-opacity, 0.92)) !important;
        backdrop-filter: blur(var(--product-card-blur, 14px)) saturate(160%) !important;
        -webkit-backdrop-filter: blur(var(--product-card-blur, 14px)) saturate(160%) !important;
        border: 1px solid rgba(226, 232, 240, var(--product-card-border-opacity, 0.8)) !important;
        border-radius: var(--product-card-radius, 1rem) !important;
      }

      .glass-card-product .product-title, .product-card .product-title {
        color: var(--product-card-heading-color, #1F2937) !important;
        font-size: var(--card-title-size, 0.875rem) !important;
        font-weight: var(--card-title-weight, 700) !important;
      }

      .glass-card-product .product-desc, .product-card .product-desc {
        color: var(--product-card-text-color, #4B5563) !important;
      }

      .glass-card-product .product-store, .product-card .product-store {
        color: var(--product-card-muted-color, #6B7280) !important;
      }

      .glass-card-product .product-price, .product-card .product-price {
        font-size: var(--price-size, 1rem) !important;
        font-weight: var(--price-weight, 800) !important;
      }
    `;
  }

  function applySidebarConfigs(settings) {
    if (!settings) return;
    const root = document.documentElement;
    const cfg = {
      pub: settings.sidebar_public_config || {},
      dash: settings.sidebar_dash_config || {},
      adm: settings.sidebar_admin_config || {}
    };

    const applyBase = (prefix, c, fallback) => {
      const tint = String(c.tint || fallback.tint).trim();
      const tintRgb = hexToRgb(tint);
      const opacity = c.opacity != null ? normalizeOpacity(String(c.opacity) + '%', fallback.opacity) : fallback.opacity;
      const blur = c.blur != null ? normalizeBlur(String(c.blur) + 'px', fallback.blur) : fallback.blur;

      root.style.setProperty(`--${prefix}-tint`, tint);
      root.style.setProperty(`--${prefix}-tint-rgb`, tintRgb);
      root.style.setProperty(`--${prefix}-opacity`, opacity);
      root.style.setProperty(`--${prefix}-blur`, blur);
    };

    applyBase('pub-sidebar', cfg.pub, { tint: '#FFFFFF', opacity: '0.85', blur: '20px' });
    root.style.setProperty('--pub-sidebar-text', cfg.pub.textColor || '#1E293B');
    root.style.setProperty('--pub-sidebar-active', cfg.pub.activeColor || '#10B981');

    applyBase('dash-sidebar', cfg.dash, { tint: '#FFFFFF', opacity: '0.85', blur: '20px' });
    root.style.setProperty('--dash-sidebar-text', cfg.dash.textColor || '#1E293B');
    root.style.setProperty('--dash-sidebar-active', cfg.dash.activeColor || '#10B981');

    applyBase('adm-sidebar', cfg.adm, { tint: '#0F172A', opacity: '0.85', blur: '20px' });
    root.style.setProperty('--adm-sidebar-text', cfg.adm.textColor || '#E2E8F0');
    root.style.setProperty('--adm-sidebar-active', cfg.adm.activeColor || '#F59E0B');
  }

  function applyDomUpdates(settings) {
    if (!settings) return;

    if (document.body) {
      const preset = PRESETS[settings.active_theme] || PRESETS.default;
      const secondary = (settings.secondary_color || preset.secondary || '#f8fafc').trim();
      const textColor = (settings.text_color || preset.text_color || '#1e293b').trim();

      document.body.style.setProperty('background-color', secondary, 'important');
      document.body.style.setProperty('color', textColor, 'important');

      const bgImg = settings.bg_image_url || settings.body_bg_image || '';
      if (bgImg) {
        document.body.style.backgroundImage = `url("${bgImg}")`;
        document.body.style.backgroundSize = settings.bg_size || 'cover';
        document.body.style.backgroundRepeat = settings.bg_repeat || 'no-repeat';
        document.body.style.backgroundAttachment = settings.bg_attachment || 'fixed';
        document.body.style.backgroundPosition = 'center center';
      } else {
        document.body.style.backgroundImage = 'none';
      }

      Object.values(PRESETS).forEach(p => {
        if (p.bodyClass) document.body.classList.remove(p.bodyClass);
      });
      if (preset.bodyClass) document.body.classList.add(preset.bodyClass);
    }

    const logoUrl = settings.logo_url || settings.site_logo || '';
    document.querySelectorAll('.theme-logo').forEach(img => {
      if (logoUrl) {
        img.src = logoUrl;
        img.classList.remove('hidden');
      }
    });

    const siteTitle = settings.site_title || settings.title || '';
    if (siteTitle) {
      document.querySelectorAll('.theme-title').forEach(el => {
        if (el.tagName.toLowerCase() === 'title') {
          document.title = siteTitle;
        } else if (!el.children.length) {
          el.textContent = siteTitle;
        }
      });
    }
  }

  function applyTheme(settings) {
    if (!settings) return;

    injectDynamicStyles();

    const root = document.documentElement;
    const preset = PRESETS[settings.active_theme] || PRESETS.default;

    // Colores globales
    const primary = (settings.primary_color || '').trim() || preset.primary;
    const secondary = (settings.secondary_color || '').trim() || preset.secondary;
    const accent = (settings.accent_color || '').trim() || preset.accent;
    const headingColor = (settings.heading_color || '').trim() || preset.heading_color;
    const textColor = (settings.text_color || '').trim() || preset.text_color;

    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-secondary', secondary);
    root.style.setProperty('--color-accent', accent);
    root.style.setProperty('--color-heading', headingColor);
    root.style.setProperty('--color-text', textColor);
    root.style.setProperty('--color-primary-rgb', hexToRgb(primary));
    root.style.setProperty('--color-secondary-rgb', hexToRgb(secondary));
    root.style.setProperty('--color-accent-rgb', hexToRgb(accent));

    // Liquid Glass Módulos (admin-diseno-efectos.html)
    const glassTint = settings.glass_tint || preset.glass_tint || '#FFFFFF';
    root.style.setProperty('--glass-tint', glassTint);
    root.style.setProperty('--glass-tint-rgb', hexToRgb(glassTint));
    root.style.setProperty('--glass-blur', normalizeBlur(settings.glass_blur, DEFAULTS.glass_blur));
    root.style.setProperty('--glass-opacity', normalizeOpacity(settings.glass_opacity, DEFAULTS.glass_opacity));
    root.style.setProperty('--glass-border-opacity', normalizeOpacity(settings.glass_border_opacity, DEFAULTS.glass_border_opacity));
    if (settings.heading_color) root.style.setProperty('--module-heading-color', settings.heading_color);
    if (settings.text_color) root.style.setProperty('--module-text-color', settings.text_color);

    // Header Glass
    const headerTint = settings.header_glass_tint || primary || '#1E3A8A';
    root.style.setProperty('--header-glass-tint', headerTint);
    root.style.setProperty('--header-glass-tint-rgb', hexToRgb(headerTint));
    root.style.setProperty('--header-glass-opacity', normalizeOpacity(settings.header_glass_opacity, '0.95'));
    root.style.setProperty('--header-glass-blur', normalizeBlur(settings.header_glass_blur, '16px'));
    if (settings.header_radius) root.style.setProperty('--header-radius', settings.header_radius);

    // Tarjetas de Producto EXCLUSIVO (admin-diseno-componentes.html)
    const cardTint = settings.product_card_tint || '#FFFFFF';
    root.style.setProperty('--product-card-tint', cardTint);
    root.style.setProperty('--product-card-tint-rgb', hexToRgb(cardTint));
    root.style.setProperty('--product-card-opacity', normalizeOpacity(settings.product_card_opacity, '0.92'));
    root.style.setProperty('--product-card-blur', normalizeBlur(settings.product_card_blur, '14px'));
    if (settings.product_card_radius) root.style.setProperty('--product-card-radius', settings.product_card_radius);
    if (settings.product_card_padding) root.style.setProperty('--product-card-padding', settings.product_card_padding);
    if (settings.product_card_heading_color) root.style.setProperty('--product-card-heading-color', settings.product_card_heading_color);
    if (settings.product_card_text_color) root.style.setProperty('--product-card-text-color', settings.product_card_text_color);
    if (settings.product_card_muted_color) root.style.setProperty('--product-card-muted-color', settings.product_card_muted_color);
    if (settings.card_title_size) root.style.setProperty('--card-title-size', settings.card_title_size);
    if (settings.card_title_weight) root.style.setProperty('--card-title-weight', settings.card_title_weight);
    if (settings.price_size) root.style.setProperty('--price-size', settings.price_size);
    if (settings.price_weight) root.style.setProperty('--price-weight', settings.price_weight);

    // Badges & Botones
    if (settings.badge_bg) root.style.setProperty('--badge-bg', settings.badge_bg);
    if (settings.badge_text) root.style.setProperty('--badge-text', settings.badge_text);

    // Efectos RGB y Animaciones Globales
    if (settings.rgb_enabled) {
      document.body.classList.add('rgb-glow-enabled');
      root.style.setProperty('--rgb-speed', (settings.rgb_speed || 6) + 's');
    } else {
      document.body.classList.remove('rgb-glow-enabled');
    }

    if (settings.animation_enabled && settings.animation_type !== 'none') {
      document.body.setAttribute('data-glass-anim', settings.animation_type);
    } else {
      document.body.removeAttribute('data-glass-anim');
    }

    applySidebarConfigs(settings);
    applyDomUpdates(settings);

    try {
      window.dispatchEvent(new CustomEvent('pasaje:theme-applied', { detail: settings }));
    } catch (e) {}
  }

  async function fetchFromSupabase() {
    let attempts = 0;
    while (typeof window._supabase === 'undefined' && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (typeof window._supabase === 'undefined') return null;

    try {
      const { data, error } = await window._supabase
        .from('site_settings').select('*').eq('id', 'global').maybeSingle();
      if (error) return null;
      return data || null;
    } catch (e) { return null; }
  }

  async function init() {
    injectDynamicStyles();

    const cached = loadFromCache();
    if (cached) applyTheme(cached);

    const fresh = await fetchFromSupabase();
    if (fresh) {
      saveToCache(fresh);
      applyTheme(fresh);
    }
  }

  const publicApi = {
    applyTheme,
    refresh: init,
    clearCache: () => { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} },
    PRESETS,
    DEFAULTS
  };

  window.PasajeTheme = publicApi;
  window.PasajeThemeLoader = publicApi;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
// =============================================================
// js/express-sidebar.js
// Sidebar exclusivo de Pasaje Express / Pasaje Ride
// Responsivo: fijo en escritorio (>=1024px), drawer en móvil.
// =============================================================

(function () {
  'use strict';

  const SIDEBAR_ID = 'pasajeExpressSidebar';
  const OVERLAY_ID = 'pasajeExpressSidebarOverlay';
  const STYLES_ID  = 'pasajeExpressSidebarStyles';

  let authState = { session: null, user: null, isAdmin: false };

  // -------------------------------------------------------------
  // Calcula el prefijo relativo a la raíz del proyecto
  // según la profundidad de la página actual.
  // Ej:
  //   /index.html                 → ''
  //   /delivery/index.html        → '../'
  //   /delivery/dashboard/foo.html→ '../../'
  //   /inmuebles/index.html       → '../'
  //   /admin/delivery/foo.html    → '../../'
  // -------------------------------------------------------------
  function getRootPrefix() {
    const path = (window.location.pathname || '').toLowerCase();

    if (path.includes('/delivery/dashboard/'))  return '../../';
    if (path.includes('/inmuebles/dashboard/')) return '../../';
    if (path.includes('/admin/delivery/'))      return '../../';
    if (path.includes('/admin/inmuebles/'))     return '../../';
    if (path.includes('/admin/'))               return '../';
    if (path.includes('/dashboard/'))           return '../';
    if (path.includes('/delivery/'))            return '../';
    if (path.includes('/inmuebles/'))           return '../';
    return '';
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function currentHash() {
    return (window.location.hash || '').toLowerCase();
  }

  function injectStyles() {
    let s = document.getElementById(STYLES_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLES_ID;
      document.head.appendChild(s);
    }

    s.textContent = `
      #${SIDEBAR_ID} {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        z-index: 9999;
        width: 18.5rem;
        max-width: 85vw;
        display: flex;
        flex-direction: column;
        transform: translateX(-100%);
        transition: transform .3s cubic-bezier(.16,1,.3,1), background-color .2s, color .2s;
        background-color: var(--express-sidebar-bg, rgba(var(--pub-sidebar-tint-rgb, 255, 255, 255), var(--pub-sidebar-opacity, 0.92))) !important;
        backdrop-filter: blur(var(--pub-sidebar-blur, 24px)) saturate(180%) !important;
        -webkit-backdrop-filter: blur(var(--pub-sidebar-blur, 24px)) saturate(180%) !important;
        color: var(--pub-sidebar-text, #0f172a) !important;
        border-right: 1px solid rgba(226, 232, 240, 0.8);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
      #${SIDEBAR_ID}.open { transform: translateX(0) !important; }

      body.pasaje-express-sidebar-open { overflow: hidden !important; }

      #${OVERLAY_ID} {
        position: fixed; inset: 0; z-index: 9998;
        background-color: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        opacity: 0; pointer-events: none;
        transition: opacity .3s ease;
      }
      #${OVERLAY_ID}.open { opacity: 1; pointer-events: auto; }

      #${SIDEBAR_ID} .express-nav-link {
        display: flex; align-items: center; gap: .75rem;
        padding: .625rem .875rem;
        border-radius: .875rem;
        font-size: .8125rem; font-weight: 600;
        color: var(--pub-sidebar-text, #1e293b);
        text-decoration: none !important;
        transition: all .15s ease;
        border-left: 4px solid transparent;
      }
      #${SIDEBAR_ID} .express-nav-link:hover {
        background-color: rgba(20, 184, 166, 0.12) !important;
        color: #0d9488 !important;
        transform: translateX(2px);
      }
      #${SIDEBAR_ID} .express-nav-link.active {
        background-color: rgba(20, 184, 166, 0.18) !important;
        color: #0d9488 !important;
        border-left-color: #14b8a6 !important;
        font-weight: 800;
      }
      #${SIDEBAR_ID} .express-block-title {
        font-size: .6875rem; font-weight: 800;
        text-transform: uppercase; letter-spacing: .05em;
        color: #64748b; margin-bottom: .375rem; padding-left: .5rem;
      }
      #${SIDEBAR_ID} .express-badge {
        margin-left: auto;
        font-size: 10px; font-weight: 800;
        padding: 2px 7px; border-radius: 999px;
      }
      #${SIDEBAR_ID} .sidebar-scroll::-webkit-scrollbar { width: 4px; }
      #${SIDEBAR_ID} .sidebar-scroll::-webkit-scrollbar-thumb {
        background-color: rgba(148,163,184,.3); border-radius: 9999px;
      }

      @media (min-width: 1024px) {
        body.pasaje-has-express-sidebar {
          padding-left: 18.5rem !important;
        }
        #${SIDEBAR_ID} {
          transform: translateX(0) !important;
          box-shadow: none !important;
          z-index: 30 !important;
        }
        #${OVERLAY_ID} { display: none !important; }
        #${SIDEBAR_ID}CloseBtn { display: none !important; }
      }
    `;
  }

  async function checkAuth() {
    if (typeof window._supabase === 'undefined') {
      return { session: null, user: null, isAdmin: false };
    }
    try {
      const { data: { session } } = await window._supabase.auth.getSession();
      if (!session) return { session: null, user: null, isAdmin: false };

      let isAdmin = false;
      try {
        if (typeof window.isAdmin === 'function') isAdmin = await window.isAdmin();
      } catch (e) { /* silencioso */ }

      return { session, user: session.user, isAdmin };
    } catch (e) {
      return { session: null, user: null, isAdmin: false };
    }
  }

  // Detecta si el link corresponde a la página actual
  function isNavActive(href) {
    const current = (window.location.pathname || '').toLowerCase();
    const cleanHref = href.replace(/^\.\.\//, '').split('#')[0].toLowerCase();
    const targetHash = href.includes('#') ? '#' + href.split('#')[1].toLowerCase() : '';
    const curHash = currentHash();

    // Match por hash si el link tiene hash
    if (targetHash) {
      if (curHash !== targetHash) return false;
    } else {
      if (curHash && curHash !== '#') return false;
    }

    if (!cleanHref) return false;

    // Match exacto al final del path
    return current.endsWith('/' + cleanHref) || current === '/' + cleanHref;
  }

  function renderNavLink(href, icon, label, opts = {}) {
    const R = getRootPrefix();

    // Construcción del href final:
    // - URLs http → se dejan
    // - Rutas absolutas que empiezan con "/" → se dejan
    // - Todo lo demás → se le añade el prefijo R
    let fullHref;
    if (/^https?:\/\//i.test(href)) {
      fullHref = href;
    } else if (href.startsWith('/')) {
      fullHref = href;
    } else {
      fullHref = `${R}${href}`;
    }

    const active = isNavActive(href);

    const badge = opts.badge
      ? `<span class="express-badge ${opts.badgeClass || 'bg-rose-500 text-white'}">${escapeHtml(opts.badge)}</span>`
      : '';

    return `
      <a href="${fullHref}" class="express-nav-link ${active ? 'active' : ''}">
        <span class="text-base flex-shrink-0">${icon}</span>
        <span class="truncate flex-1">${escapeHtml(label)}</span>
        ${badge}
      </a>
    `;
  }

  function renderSidebarHTML(auth) {
    const R = getRootPrefix();

    // ---------------------------------------------------------
    // Encabezado
    // ---------------------------------------------------------
    const headerHTML = `
      <div class="flex items-center justify-between px-4 py-4 border-b border-slate-200/60 flex-shrink-0 bg-white/40 backdrop-blur-md">
        <a href="${R}index.html" class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-600 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">
            🛵
          </div>
          <div class="min-w-0 leading-tight">
            <h3 class="font-extrabold text-sm text-slate-900 truncate tracking-tight">Pasaje Express</h3>
            <p class="text-[10px] font-bold text-teal-600 truncate">Mandaditos &amp; Ride · Xela</p>
          </div>
        </a>
        <button type="button" id="${SIDEBAR_ID}CloseBtn"
          class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs transition shadow-sm lg:hidden"
          aria-label="Cerrar menú">
          ✕
        </button>
      </div>
    `;

    // ---------------------------------------------------------
    // Bloque de sesión
    // ---------------------------------------------------------
    let sessionBlock;
    if (auth.session) {
      const email = auth.user?.email || 'Usuario Activo';
      const initial = escapeHtml(email.charAt(0).toUpperCase());

      sessionBlock = `
        <div class="p-3.5 rounded-2xl bg-gradient-to-br from-teal-500/10 via-cyan-500/10 to-slate-100 border border-teal-500/20 shadow-sm mb-5">
          <div class="flex items-center gap-2.5 mb-3">
            <div class="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-sm flex-shrink-0">
              ${initial}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-black text-slate-900 truncate">${escapeHtml(email)}</p>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600">
                <span class="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                Sesión iniciada
              </span>
            </div>
          </div>
          <div class="space-y-1.5">
            <a href="${R}delivery/dashboard/cliente.html"
               class="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
              <span>👤</span>
              <span>Mi Panel Express</span>
            </a>
            <a href="${R}delivery/dashboard/index.html"
               class="w-full bg-white hover:bg-slate-50 text-teal-700 font-extrabold text-xs px-3 py-2 rounded-xl border border-teal-200 shadow-sm transition flex items-center justify-center gap-2">
              <span>🛵</span>
              <span>Panel de Piloto</span>
            </a>
            ${auth.isAdmin ? `
              <a href="${R}admin/delivery/index.html"
                 class="w-full bg-slate-900 hover:bg-slate-800 text-teal-400 font-extrabold text-xs px-3 py-2 rounded-xl transition flex items-center justify-center gap-2">
                <span>🛡️</span>
                <span>Consola de Flota</span>
              </a>
            ` : ''}
            <button type="button" id="${SIDEBAR_ID}LogoutBtn"
              class="w-full bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-[11px] px-3 py-1.5 rounded-xl transition flex items-center justify-center gap-1.5">
              <span>🚪</span>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      `;
    } else {
      sessionBlock = `
        <div class="p-3 rounded-2xl bg-slate-100/80 border border-slate-200/80 mb-5 space-y-2">
          <p class="text-[10px] font-black text-slate-500 uppercase px-1 mb-1">Accede a tu cuenta</p>
          <a href="${R}login.html?redirect=delivery/index.html"
             class="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
            <span>🔑</span>
            <span>Iniciar Sesión</span>
          </a>
          <a href="${R}registro.html?role=delivery"
             class="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition flex items-center justify-center gap-2">
            <span>🛵</span>
            <span>Unirme como Piloto</span>
          </a>
        </div>
      `;
    }

    // ---------------------------------------------------------
    // Bloque principal — Pasaje Express
    // ---------------------------------------------------------
    const mainBlock = `
      <div class="mb-5">
        <h4 class="express-block-title">Pasaje Express</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('delivery/index.html', '🛵', 'Pedir Viaje / Mandado')}
          ${renderNavLink('delivery/radar.html', '📍', 'Radar en Vivo')}
          ${renderNavLink('delivery/historial.html', '📜', 'Mis Encargos')}
          ${renderNavLink('delivery/dashboard/cliente.html', '👤', 'Mi Panel Express')}
        </nav>
      </div>
    `;

    // ---------------------------------------------------------
    // Bloque Piloto
    // ---------------------------------------------------------
    const pilotBlock = `
      <div class="mb-5">
        <h4 class="express-block-title">Para Pilotos</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('delivery/dashboard/index.html', '🎯', 'Mi Panel de Piloto')}
          ${renderNavLink('registro.html?role=delivery', '🤝', 'Únete como Piloto')}
        </nav>
      </div>
    `;

    // ---------------------------------------------------------
    // Bloque Explorar
    // ---------------------------------------------------------
    const exploreBlock = `
      <div class="mb-5">
        <h4 class="express-block-title">Explorar</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('index.html', '🏬', 'Catálogo Público')}
          ${renderNavLink('inmuebles/index.html', '🏠', 'Pasaje Inmuebles')}
          ${renderNavLink('ofertas.html', '🔥', 'Ofertas Relámpago')}
        </nav>
      </div>
    `;

    // ---------------------------------------------------------
    // Bloque Información
    // ---------------------------------------------------------
    const infoBlock = `
      <div class="mb-4">
        <h4 class="express-block-title">Información</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('nosotros.html', '📖', 'Sobre Pasaje Express')}
          ${renderNavLink('contacto.html', '🎧', 'Soporte y Ayuda')}
          ${renderNavLink('terminos.html', '📜', 'Términos y Condiciones')}
        </nav>
      </div>
    `;

    // ---------------------------------------------------------
    // Footer
    // ---------------------------------------------------------
    const footerHTML = `
      <div class="px-4 py-3 border-t border-slate-200/60 flex-shrink-0 bg-white/40 text-center">
        <p class="text-[10px] font-bold text-slate-400">
          © ${new Date().getFullYear()} Pasaje Express · Xela
        </p>
      </div>
    `;

    return `
      <aside id="${SIDEBAR_ID}" role="dialog" aria-modal="true" aria-label="Menú de Pasaje Express">
        ${headerHTML}

        <div class="flex-1 overflow-y-auto p-3.5 sidebar-scroll">
          ${sessionBlock}
          ${mainBlock}
          ${pilotBlock}
          ${exploreBlock}
          ${infoBlock}
        </div>

        ${footerHTML}
      </aside>

      <div id="${OVERLAY_ID}" aria-hidden="true"></div>
    `;
  }

  function openExpressSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (!sidebar || !overlay) return;
    overlay.classList.add('open');
    sidebar.classList.add('open');
    if (window.innerWidth < 1024) {
      document.body.classList.add('pasaje-express-sidebar-open');
    }
  }

  function closeExpressSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (!sidebar || !overlay) return;
    overlay.classList.remove('open');
    sidebar.classList.remove('open');
    document.body.classList.remove('pasaje-express-sidebar-open');
  }

  function toggleExpressSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) closeExpressSidebar();
    else openExpressSidebar();
  }

  function bindEvents() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    const closeBtn = document.getElementById(`${SIDEBAR_ID}CloseBtn`);
    const logoutBtn = document.getElementById(`${SIDEBAR_ID}LogoutBtn`);

    if (overlay) overlay.addEventListener('click', closeExpressSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeExpressSidebar);

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          if (window._supabase) await window._supabase.auth.signOut();
        } catch (e) {
          console.warn('[ExpressSidebar] logout error:', e);
        }
        localStorage.removeItem('activeStoreId');
        closeExpressSidebar();
        window.location.reload();
      });
    }

    sidebar?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1024) closeExpressSidebar();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.innerWidth < 1024) closeExpressSidebar();
    });
  }

  async function initExpressSidebar() {
    injectStyles();

    authState = await checkAuth();

    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();

    const html = renderSidebarHTML(authState);
    const container = document.getElementById('expressSidebar');

    if (container) {
      container.innerHTML = html;
    } else {
      document.body.insertAdjacentHTML('beforeend', html);
    }

    document.body.classList.add('pasaje-has-express-sidebar');
    bindEvents();
  }

  if (typeof window._supabase !== 'undefined' && window._supabase.auth) {
    window._supabase.auth.onAuthStateChange(() => {
      initExpressSidebar();
    });
  }

  window.initExpressSidebar   = initExpressSidebar;
  window.openExpressSidebar   = openExpressSidebar;
  window.closeExpressSidebar  = closeExpressSidebar;
  window.toggleExpressSidebar = toggleExpressSidebar;

  window.PasajeExpressSidebar = {
    init: initExpressSidebar,
    open: openExpressSidebar,
    close: closeExpressSidebar,
    toggle: toggleExpressSidebar,
    refresh: initExpressSidebar
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExpressSidebar);
  } else {
    initExpressSidebar();
  }
})();
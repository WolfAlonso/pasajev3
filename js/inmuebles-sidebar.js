// =============================================================
// js/inmuebles-sidebar.js
// Sidebar exclusivo de Pasaje Inmuebles
// Usado en: /inmuebles/*  y  /inmuebles/dashboard/*
// =============================================================

(function () {
  'use strict';

  const SIDEBAR_ID = 'pasajeInmueblesSidebar';
  const OVERLAY_ID = 'pasajeInmueblesSidebarOverlay';
  const STYLES_ID  = 'pasajeInmueblesSidebarStyles';

  let authState = { session: null, user: null, isRealEstate: false, isAdmin: false };

  // -------------------------------------------------------------
  // Detecta el prefijo relativo a la raíz del proyecto
  // según la profundidad de la carpeta actual.
  // Ej:
  //   /index.html                     → ''
  //   /inmuebles/index.html           → '../'
  //   /inmuebles/dashboard/foo.html   → '../../'
  //   /admin/inmuebles/foo.html       → '../../'
  //   /delivery/dashboard/foo.html    → '../../'
  // -------------------------------------------------------------
  function getRootPrefix() {
    const path = (window.location.pathname || '').toLowerCase();

    if (path.includes('/inmuebles/dashboard/'))  return '../../';
    if (path.includes('/admin/inmuebles/'))      return '../../';
    if (path.includes('/delivery/dashboard/'))   return '../../';
    if (path.includes('/admin/delivery/'))       return '../../';
    if (path.includes('/inmuebles/'))            return '../';
    if (path.includes('/delivery/'))             return '../';
    if (path.includes('/admin/'))                return '../';
    if (path.includes('/dashboard/'))            return '../';
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

  function currentParams() {
    try { return new URLSearchParams(window.location.search); }
    catch (e) { return new URLSearchParams(''); }
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
        background-color: var(--inmuebles-sidebar-bg, rgba(var(--pub-sidebar-tint-rgb, 255, 255, 255), var(--pub-sidebar-opacity, 0.92))) !important;
        backdrop-filter: blur(var(--pub-sidebar-blur, 24px)) saturate(180%) !important;
        -webkit-backdrop-filter: blur(var(--pub-sidebar-blur, 24px)) saturate(180%) !important;
        color: var(--pub-sidebar-text, #0f172a) !important;
        border-right: 1px solid rgba(226, 232, 240, 0.8);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
      #${SIDEBAR_ID}.open { transform: translateX(0) !important; }

      body.pasaje-inmuebles-sidebar-open { overflow: hidden !important; }

      #${OVERLAY_ID} {
        position: fixed; inset: 0; z-index: 9998;
        background-color: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        opacity: 0; pointer-events: none;
        transition: opacity .3s ease;
      }
      #${OVERLAY_ID}.open { opacity: 1; pointer-events: auto; }

      #${SIDEBAR_ID} .inmuebles-nav-link {
        display: flex; align-items: center; gap: .75rem;
        padding: .625rem .875rem;
        border-radius: .875rem;
        font-size: .8125rem; font-weight: 600;
        color: var(--pub-sidebar-text, #1e293b);
        text-decoration: none !important;
        transition: all .15s ease;
        border-left: 4px solid transparent;
      }
      #${SIDEBAR_ID} .inmuebles-nav-link:hover {
        background-color: rgba(99, 102, 241, 0.12) !important;
        color: #4f46e5 !important;
        transform: translateX(2px);
      }
      #${SIDEBAR_ID} .inmuebles-nav-link.active {
        background-color: rgba(99, 102, 241, 0.18) !important;
        color: #4f46e5 !important;
        border-left-color: #6366f1 !important;
        font-weight: 800;
      }
      #${SIDEBAR_ID} .inmuebles-block-title {
        font-size: .6875rem; font-weight: 800;
        text-transform: uppercase; letter-spacing: .05em;
        color: #64748b; margin-bottom: .375rem; padding-left: .5rem;
      }
      #${SIDEBAR_ID} .sidebar-scroll::-webkit-scrollbar { width: 4px; }
      #${SIDEBAR_ID} .sidebar-scroll::-webkit-scrollbar-thumb {
        background-color: rgba(148,163,184,.3); border-radius: 9999px;
      }

      @media (min-width: 1024px) {
        body.pasaje-has-inmuebles-sidebar {
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
      return { session: null, user: null, isRealEstate: false, isAdmin: false };
    }
    try {
      const { data: { session } } = await window._supabase.auth.getSession();
      if (!session) return { session: null, user: null, isRealEstate: false, isAdmin: false };

      let isRealEstate = false;
      let isAdmin = false;

      try {
        const { data: roles } = await window._supabase
          .from('user_roles')
          .select('is_real_estate, is_admin')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (roles) {
          isRealEstate = !!roles.is_real_estate;
          isAdmin      = !!roles.is_admin;
        }
      } catch (e) { /* silencioso */ }

      return { session, user: session.user, isRealEstate, isAdmin };
    } catch (e) {
      return { session: null, user: null, isRealEstate: false, isAdmin: false };
    }
  }

  // Detecta si el link corresponde a la página actual
  function isNavActive(href) {
    const current = (window.location.pathname || '').toLowerCase();
    const cleanHref = href.replace(/^\.\.\//, '').split('?')[0].split('#')[0].toLowerCase();
    const params = currentParams();

    // Match de query string
    const [, queryPart] = href.split('?');
    if (queryPart) {
      const targetParams = new URLSearchParams(queryPart.split('#')[0]);
      let match = true;
      targetParams.forEach((v, k) => {
        if (params.get(k) !== v) match = false;
      });
      if (!match) return false;
    } else if (params.get('type')) {
      // El href no tiene type pero la URL sí → no marcar activo
      return false;
    }

    if (!cleanHref) return false;

    // Match: el path actual termina con /<cleanHref>
    return current.endsWith('/' + cleanHref) || current === '/' + cleanHref;
  }

  function renderNavLink(href, icon, label, opts = {}) {
    const R = getRootPrefix();

    let fullHref;
    if (/^https?:\/\//i.test(href) || href.startsWith('/')) {
      fullHref = href;
    } else {
      fullHref = `${R}${href}`;
    }

    const isActive = isNavActive(href);
    const badge = opts.badge
      ? `<span class="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full ${opts.badgeClass || 'bg-rose-500 text-white'}">${escapeHtml(opts.badge)}</span>`
      : '';

    return `
      <a href="${fullHref}" class="inmuebles-nav-link ${isActive ? 'active' : ''}">
        <span class="text-base flex-shrink-0">${icon}</span>
        <span class="truncate flex-1">${escapeHtml(label)}</span>
        ${badge}
      </a>
    `;
  }

  function renderSidebarHTML(auth) {
    const R = getRootPrefix();

    // ---------------------------------------------------------
    // Header
    // ---------------------------------------------------------
    const headerHTML = `
      <div class="flex items-center justify-between px-4 py-4 border-b border-slate-200/60 flex-shrink-0 bg-white/40 backdrop-blur-md">
        <a href="${R}inmuebles/index.html" class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">
            🏠
          </div>
          <div class="min-w-0 leading-tight">
            <h3 class="font-extrabold text-sm text-slate-900 truncate tracking-tight">Pasaje Inmuebles</h3>
            <p class="text-[10px] font-bold text-indigo-600 truncate">Quetzaltenango</p>
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
      const email = auth.user?.email || 'Usuario';
      const initial = escapeHtml(email.charAt(0).toUpperCase());

      sessionBlock = `
        <div class="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-blue-500/10 to-slate-100 border border-indigo-500/20 shadow-sm mb-5">
          <div class="flex items-center gap-2.5 mb-3">
            <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm flex-shrink-0">
              ${initial}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-black text-slate-900 truncate">${escapeHtml(email)}</p>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600">
                <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                ${auth.isRealEstate ? 'Agente Inmobiliario' : 'Explorando'}
              </span>
            </div>
          </div>
          <div class="space-y-1.5">
            ${auth.isRealEstate ? `
              <a href="${R}inmuebles/dashboard/index.html"
                 class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
                <span>🔑</span>
                <span>Mi Panel de Propiedades</span>
              </a>
            ` : `
              <a href="${R}registro.html?role=real_estate"
                 class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
                <span>🏢</span>
                <span>Ser Agente Inmobiliario</span>
              </a>
            `}
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
          <p class="text-[10px] font-black text-slate-500 uppercase px-1 mb-1">¿Tienes una propiedad?</p>
          <a href="${R}login.html"
             class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
            <span>🔑</span>
            <span>Iniciar Sesión</span>
          </a>
          <a href="${R}registro.html?role=real_estate"
             class="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition flex items-center justify-center gap-2">
            <span>🏢</span>
            <span>Registrarme como Agente</span>
          </a>
        </div>
      `;
    }

    // ---------------------------------------------------------
    // Bloques de navegación
    // ---------------------------------------------------------
    const exploreBlock = `
      <div class="mb-5">
        <h4 class="inmuebles-block-title">Explorar</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('inmuebles/index.html', '🏠', 'Todas las Propiedades')}
          ${renderNavLink('inmuebles/index.html?type=rent', '🏢', 'Alquileres')}
          ${renderNavLink('inmuebles/index.html?type=sale', '🏡', 'Ventas')}
          ${renderNavLink('inmuebles/index.html?type=usufruct', '📜', 'Usufructo')}
        </nav>
      </div>
    `;

    const publishBlock = `
      <div class="mb-5">
        <h4 class="inmuebles-block-title">Publica tu Propiedad</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('inmuebles/dashboard/index.html', '🔑', 'Mi Panel Inmobiliario')}
          ${renderNavLink('inmuebles/dashboard/index.html#listings', '📋', 'Mis Publicaciones')}
          ${renderNavLink('inmuebles/dashboard/index.html#leads', '📩', 'Interesados')}
        </nav>
      </div>
    `;

    const otherModulesBlock = `
      <div class="mb-5">
        <h4 class="inmuebles-block-title">Otros Módulos</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('index.html', '🏬', 'Catálogo Público')}
          ${renderNavLink('delivery/index.html', '🛵', 'Pasaje Express')}
          ${renderNavLink('ofertas.html', '🔥', 'Ofertas Relámpago')}
        </nav>
      </div>
    `;

    const infoBlock = `
      <div class="mb-4">
        <h4 class="inmuebles-block-title">Información</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('nosotros.html', '📖', 'Sobre Nosotros')}
          ${renderNavLink('contacto.html', '🎧', 'Soporte y Ayuda')}
          ${renderNavLink('terminos.html', '📜', 'Términos y Condiciones')}
        </nav>
      </div>
    `;

    const footerHTML = `
      <div class="px-4 py-3 border-t border-slate-200/60 flex-shrink-0 bg-white/40 text-center">
        <p class="text-[10px] font-bold text-slate-400">
          © ${new Date().getFullYear()} Pasaje Inmuebles · Xela
        </p>
      </div>
    `;

    return `
      <aside id="${SIDEBAR_ID}" role="dialog" aria-modal="true" aria-label="Menú de Pasaje Inmuebles">
        ${headerHTML}

        <div class="flex-1 overflow-y-auto p-3.5 sidebar-scroll">
          ${sessionBlock}
          ${exploreBlock}
          ${publishBlock}
          ${otherModulesBlock}
          ${infoBlock}
        </div>

        ${footerHTML}
      </aside>

      <div id="${OVERLAY_ID}" aria-hidden="true"></div>
    `;
  }

  function openInmueblesSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (!sidebar || !overlay) return;
    overlay.classList.add('open');
    sidebar.classList.add('open');
    if (window.innerWidth < 1024) {
      document.body.classList.add('pasaje-inmuebles-sidebar-open');
    }
  }

  function closeInmueblesSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (!sidebar || !overlay) return;
    overlay.classList.remove('open');
    sidebar.classList.remove('open');
    document.body.classList.remove('pasaje-inmuebles-sidebar-open');
  }

  function toggleInmueblesSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) closeInmueblesSidebar();
    else openInmueblesSidebar();
  }

  function bindEvents() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    const closeBtn = document.getElementById(`${SIDEBAR_ID}CloseBtn`);
    const logoutBtn = document.getElementById(`${SIDEBAR_ID}LogoutBtn`);

    if (overlay) overlay.addEventListener('click', closeInmueblesSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeInmueblesSidebar);

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          if (window._supabase) await window._supabase.auth.signOut();
        } catch (e) {
          console.warn('[InmueblesSidebar] logout error:', e);
        }
        localStorage.removeItem('activeStoreId');
        closeInmueblesSidebar();
        window.location.reload();
      });
    }

    sidebar?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1024) closeInmueblesSidebar();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.innerWidth < 1024) closeInmueblesSidebar();
    });
  }

  async function initInmueblesSidebar() {
    injectStyles();
    authState = await checkAuth();

    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();

    const html = renderSidebarHTML(authState);
    const container = document.getElementById('inmueblesSidebar');

    if (container) {
      container.innerHTML = html;
    } else {
      document.body.insertAdjacentHTML('beforeend', html);
    }

    document.body.classList.add('pasaje-has-inmuebles-sidebar');
    bindEvents();
  }

  if (typeof window._supabase !== 'undefined' && window._supabase.auth) {
    window._supabase.auth.onAuthStateChange(() => {
      initInmueblesSidebar();
    });
  }

  window.initInmueblesSidebar   = initInmueblesSidebar;
  window.openInmueblesSidebar   = openInmueblesSidebar;
  window.closeInmueblesSidebar  = closeInmueblesSidebar;
  window.toggleInmueblesSidebar = toggleInmueblesSidebar;

  window.PasajeInmueblesSidebar = {
    init: initInmueblesSidebar,
    open: openInmueblesSidebar,
    close: closeInmueblesSidebar,
    toggle: toggleInmueblesSidebar,
    refresh: initInmueblesSidebar
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInmueblesSidebar);
  } else {
    initInmueblesSidebar();
  }
})();
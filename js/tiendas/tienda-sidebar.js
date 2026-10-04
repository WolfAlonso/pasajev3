// =============================================================
// /js/tiendas/tienda-sidebar.js
// Sidebar dedicado para la sección pública /tiendas/
// - Escritorio (>=1024px): siempre visible y fijo.
// - Móvil (<1024px): drawer deslizable con overlay.
// - Menú: catálogo, tiendas, ofertas, categorías, favoritos,
//   rastreo, mi tienda/panel, dashboard público, etc.
// FASE 23-B: "Categorías" apunta a productos.html?openCategories=true
// =============================================================

(function () {
  'use strict';

  const SIDEBAR_ID = 'pasajeTiendaSidebar';
  const OVERLAY_ID = 'pasajeTiendaSidebarOverlay';
  const STYLES_ID  = 'pasajeTiendaSidebarStyles';
  const MOUNT_ID   = 'tiendaSidebar';

  let cachedCategories = [];
  let authState = { session: null, user: null, accountType: null };

  // ----------------------------------------------------------
  // ROOT PREFIX HELPERS
  // ----------------------------------------------------------
  function getRootPrefix() {
    const path = window.location.pathname.toLowerCase();
    if (/\/tiendas\/[^\/]+\//.test(path)) return '../../';
    if (/\/tiendas\//.test(path)) return '../';
    return '../';
  }

  function getTiendasPrefix() {
    const path = window.location.pathname.toLowerCase();
    if (/\/tiendas\/[^\/]+\//.test(path)) return '../';
    return '';
  }

  // ----------------------------------------------------------
  // UTILS
  // ----------------------------------------------------------
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getFavoritesCount() {
    if (window.Favorites && typeof window.Favorites.count === 'function') {
      return window.Favorites.count();
    }
    try {
      const favs = JSON.parse(
        localStorage.getItem('pasaje_favorites') ||
        localStorage.getItem('pasaje_favoritos_v1') ||
        '[]'
      );
      return Array.isArray(favs) ? favs.length : 0;
    } catch (e) {
      return 0;
    }
  }

  // ----------------------------------------------------------
  // ESTILOS
  // ----------------------------------------------------------
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
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    background-color 0.2s, color 0.2s;
        background-color: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        color: #0f172a;
        border-right: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }

      #${SIDEBAR_ID}.open {
        transform: translateX(0) !important;
      }

      body.pasaje-tienda-sidebar-open {
        overflow: hidden !important;
      }

      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 9998;
        background-color: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      #${OVERLAY_ID}.open {
        opacity: 1;
        pointer-events: auto;
      }

      #${SIDEBAR_ID} .tienda-nav-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 0.875rem;
        border-radius: 0.875rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #1e293b;
        text-decoration: none !important;
        transition: all 0.15s ease;
        border-left: 4px solid transparent;
      }

      #${SIDEBAR_ID} .tienda-nav-link:hover {
        background-color: rgba(79, 70, 229, 0.10) !important;
        color: #4f46e5 !important;
        transform: translateX(2px);
      }

      #${SIDEBAR_ID} .tienda-nav-link.active {
        background-color: rgba(79, 70, 229, 0.15) !important;
        color: #4f46e5 !important;
        border-left-color: #4f46e5 !important;
        font-weight: 800;
      }

      #${SIDEBAR_ID} .tienda-block-title {
        font-size: 0.6875rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        margin-bottom: 0.375rem;
        padding-left: 0.5rem;
      }

      #${SIDEBAR_ID} .tienda-scroll::-webkit-scrollbar { width: 4px; }
      #${SIDEBAR_ID} .tienda-scroll::-webkit-scrollbar-thumb {
        background-color: rgba(148, 163, 184, 0.3);
        border-radius: 9999px;
      }

      @media (min-width: 1024px) {
        body.pasaje-has-tienda-sidebar {
          padding-left: 18.5rem !important;
        }
        body.pasaje-has-tienda-sidebar #${SIDEBAR_ID} {
          transform: translateX(0) !important;
          box-shadow: none !important;
        }
        body.pasaje-has-tienda-sidebar #${OVERLAY_ID} {
          display: none !important;
        }
        #${SIDEBAR_ID}CloseBtn {
          display: none !important;
        }
        #sidebarToggleBtn {
          display: none !important;
        }
      }
    `;
  }

  // ----------------------------------------------------------
  // AUTH (usa account_type de user_profiles)
  // ----------------------------------------------------------
  async function checkAuthAndRole() {
    const client = window._supabase ||
      (typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null);

    if (!client) return { session: null, user: null, accountType: null };

    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session) return { session: null, user: null, accountType: null };

      let accountType = 'customer';

      try {
        const { data: p1 } = await client
          .from('user_profiles')
          .select('account_type')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (p1 && p1.account_type) accountType = p1.account_type;
        else {
          const { data: p2 } = await client
            .from('user_profiles')
            .select('account_type')
            .eq('id', session.user.id)
            .maybeSingle();
          if (p2 && p2.account_type) accountType = p2.account_type;
        }
      } catch (e) { /* silencioso */ }

      return { session, user: session.user, accountType };
    } catch (e) {
      console.warn('[TiendaSidebar] auth check:', e);
      return { session: null, user: null, accountType: null };
    }
  }

  // ----------------------------------------------------------
  // CATEGORÍAS
  // ----------------------------------------------------------
  async function fetchTopCategories() {
    const client = window._supabase ||
      (typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null);

    if (!client) return [];

    try {
      const { data, error } = await client
        .from('categories')
        .select('id, name, slug, icon, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(6);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[TiendaSidebar] categorías:', e);
      return [];
    }
  }

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------
  function renderNavLink(href, icon, label, badgeCount = null, extraClass = '') {
    const currentPath = window.location.pathname.toLowerCase();
    const targetPath = href.toLowerCase();

    let isActive = false;
    try {
      const page = currentPath.split('/').pop() || '';
      const targetPage = targetPath.split('?')[0].split('/').pop() || '';
      isActive = page === targetPage && page !== '';
    } catch (e) { /* noop */ }

    const badgeHTML = (badgeCount !== null && badgeCount > 0)
      ? `<span class="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">${badgeCount}</span>`
      : '';

    return `
      <a href="${href}" class="tienda-nav-link ${isActive ? 'active' : ''} ${extraClass}">
        <span class="text-base flex-shrink-0">${icon}</span>
        <span class="truncate flex-1">${escapeHtml(label)}</span>
        ${badgeHTML}
      </a>
    `;
  }

  function renderSidebarHTML(categories, auth) {
    const ROOT = getRootPrefix();
    const T = getTiendasPrefix();
    const favCount = getFavoritesCount();

    const headerHTML = `
      <div class="flex items-center justify-between px-4 py-4 border-b border-slate-200/60 flex-shrink-0 bg-white/40 backdrop-blur-md">
        <a href="${ROOT}index.html" class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">
            🛍️
          </div>
          <div class="min-w-0 leading-tight">
            <h3 class="font-extrabold text-sm text-slate-900 truncate tracking-tight">Pasaje Tiendas</h3>
            <p class="text-[10px] font-bold text-indigo-600 truncate">Mercado local Xela</p>
          </div>
        </a>
        <button type="button" id="${SIDEBAR_ID}CloseBtn"
          class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs transition shadow-sm lg:hidden"
          aria-label="Cerrar menú">
          ✕
        </button>
      </div>
    `;

    let block1HTML = '';
    if (auth.session) {
      const email = auth.user?.email || 'Usuario';
      const initial = email.charAt(0).toUpperCase();
      const accountLabel = {
        customer: 'Cliente',
        merchant: 'Comercio',
        delivery: 'Repartidor',
        real_estate: 'Inmobiliaria',
        admin: 'Administrador'
      }[auth.accountType] || 'Cliente';

      block1HTML = `
        <div class="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-blue-500/10 to-slate-100 border border-indigo-500/20 shadow-sm mb-5">
          <div class="flex items-center gap-2.5 mb-3">
            <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm flex-shrink-0">
              ${escapeHtml(initial)}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-black text-slate-900 truncate">${escapeHtml(email)}</p>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600">
                <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                ${escapeHtml(accountLabel)}
              </span>
            </div>
          </div>

          <div class="space-y-1.5">
            <a href="${ROOT}dashboard/dashboard.html"
               class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
              <span>⚙️</span>
              <span>Ir a mi Dashboard</span>
            </a>
            ${auth.accountType === 'admin' ? `
              <a href="${ROOT}admin/admin.html"
                 class="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs px-3 py-2 rounded-xl transition flex items-center justify-center gap-2">
                <span>🛡️</span>
                <span>Panel Admin</span>
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
      block1HTML = `
        <div class="p-3 rounded-2xl bg-slate-100/80 border border-slate-200/80 mb-5 space-y-2">
          <a href="${ROOT}login.html"
             class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
            <span>🔑</span>
            <span>Iniciar Sesión</span>
          </a>
          <a href="${ROOT}registro.html"
             class="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition flex items-center justify-center gap-2">
            <span>🏪</span>
            <span>Registrar mi Tienda</span>
          </a>
        </div>
      `;
    }

    // ============================================================
    // BLOQUE 2: Catálogo — Cambio Fase 23-B: "Categorías" apunta a
    // productos.html?openCategories=true en lugar de categorias.html
    // ============================================================
    const block2HTML = `
      <div class="mb-5">
        <h4 class="tienda-block-title">Catálogo</h4>
        <nav class="space-y-0.5">
          ${renderNavLink(`${T}productos.html`, '🛍️', 'Todos los Productos')}
          ${renderNavLink(`${T}tienda.html`, '🏪', 'Tiendas en Xela')}
          ${renderNavLink(`${T}ofertas.html`, '🏷️', 'Ofertas Relámpago')}
          ${renderNavLink(`${T}productos.html?openCategories=true`, '📂', 'Categorías')}
          ${renderNavLink(`${T}favoritos.html`, '⭐', 'Mis Favoritos', favCount)}
          ${renderNavLink(`${T}rastreo.html`, '📦', 'Rastrear Pedido')}
        </nav>
      </div>
    `;

    const block3HTML = `
      <div class="mb-5">
        <h4 class="tienda-block-title">Mi Cuenta</h4>
        <nav class="space-y-0.5">
          <button type="button" data-tienda-action="open-cart"
            class="tienda-nav-link w-full text-left">
            <span class="text-base flex-shrink-0">🛒</span>
            <span class="truncate flex-1">Mi Carrito</span>
            <span class="cart-count-badge hidden bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">0</span>
          </button>
          ${renderNavLink(`${T}dashboard/index.html`, '🔑', 'Mi Tienda / Panel')}
        </nav>
      </div>
    `;

    let categoriesListHTML = '';
    if (categories && categories.length > 0) {
      categoriesListHTML = categories.map(c => `
        <a href="${T}productos.html?cat=${encodeURIComponent(c.slug)}"
           class="tienda-nav-link text-xs">
          <span class="text-sm flex-shrink-0">${escapeHtml(c.icon || '📦')}</span>
          <span class="truncate">${escapeHtml(c.name)}</span>
        </a>
      `).join('');
    } else {
      categoriesListHTML = `<p class="text-[11px] text-slate-400 italic px-2 py-1">Cargando categorías...</p>`;
    }

    const block4HTML = `
      <div class="mb-5">
        <div class="flex items-center justify-between pr-2 mb-1">
          <h4 class="tienda-block-title !mb-0">Categorías</h4>
          <a href="${T}productos.html?openCategories=true" class="text-[10px] font-bold text-indigo-600 hover:underline">Ver todas →</a>
        </div>
        <nav class="space-y-0.5">
          ${categoriesListHTML}
        </nav>
      </div>
    `;

    const block5HTML = `
      <div class="mb-4">
        <h4 class="tienda-block-title">Información</h4>
        <nav class="space-y-0.5">
          ${renderNavLink(`${ROOT}nosotros.html`, '📖', 'Sobre Nosotros')}
          ${renderNavLink(`${ROOT}contacto.html`, '🎧', 'Contacto y Ayuda')}
          ${renderNavLink(`${ROOT}terminos.html`, '📜', 'Términos y Condiciones')}
          ${renderNavLink(`${ROOT}index.html`, '🏠', 'Volver al Inicio')}
        </nav>
      </div>
    `;

    const footerHTML = `
      <div class="px-4 py-3 border-t border-slate-200/60 flex-shrink-0 bg-white/40 text-center">
        <p class="text-[10px] font-bold text-slate-400">
          © ${new Date().getFullYear()} Pasaje de los Altos GT
        </p>
      </div>
    `;

    return `
      <aside id="${SIDEBAR_ID}" role="dialog" aria-modal="true" aria-label="Menú de la sección tiendas">
        ${headerHTML}
        <div class="flex-1 overflow-y-auto p-3.5 tienda-scroll">
          ${block1HTML}
          ${block2HTML}
          ${block3HTML}
          ${block4HTML}
          ${block5HTML}
        </div>
        ${footerHTML}
      </aside>
      <div id="${OVERLAY_ID}" aria-hidden="true"></div>
    `;
  }

  // ----------------------------------------------------------
  // OPEN / CLOSE
  // ----------------------------------------------------------
  function openSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (!sidebar || !overlay) return;

    refreshFavBadge();
    overlay.classList.add('open');
    sidebar.classList.add('open');

    if (window.innerWidth < 1024) {
      document.body.classList.add('pasaje-tienda-sidebar-open');
    }
  }

  function closeSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (!sidebar || !overlay) return;

    overlay.classList.remove('open');
    sidebar.classList.remove('open');
    document.body.classList.remove('pasaje-tienda-sidebar-open');
  }

  function toggleSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  }

  function refreshFavBadge() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) return;

    const favLink = sidebar.querySelector('a[href*="favoritos.html"]');
    if (!favLink) return;

    const currentFavs = getFavoritesCount();
    let badge = favLink.querySelector('.bg-rose-500');

    if (currentFavs > 0) {
      if (badge) {
        badge.textContent = currentFavs;
      } else {
        favLink.insertAdjacentHTML('beforeend', `
          <span class="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">
            ${currentFavs}
          </span>
        `);
      }
    } else if (badge) {
      badge.remove();
    }
  }

  // ----------------------------------------------------------
  // EVENTOS
  // ----------------------------------------------------------
  function bindEvents() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    const closeBtn = document.getElementById(`${SIDEBAR_ID}CloseBtn`);
    const logoutBtn = document.getElementById(`${SIDEBAR_ID}LogoutBtn`);

    if (overlay) overlay.addEventListener('click', closeSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);

    sidebar?.querySelectorAll('[data-tienda-action="open-cart"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.PasajeCart && typeof window.PasajeCart.openDrawer === 'function') {
          window.PasajeCart.openDrawer();
          if (window.innerWidth < 1024) closeSidebar();
        } else {
          window.location.href = `${getTiendasPrefix()}productos.html`;
        }
      });
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          const client = window._supabase ||
            (typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null);
          if (client) await client.auth.signOut();
        } catch (e) {
          console.warn('[TiendaSidebar] logout:', e);
        }
        try { localStorage.removeItem('activeStoreId'); } catch (e) {}
        closeSidebar();
        window.location.reload();
      });
    }

    sidebar?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1024) closeSidebar();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.innerWidth < 1024) closeSidebar();
    });
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  async function initTiendaSidebar() {
    injectStyles();

    const [auth, categories] = await Promise.all([
      checkAuthAndRole(),
      fetchTopCategories()
    ]);

    authState = auth;
    cachedCategories = categories;

    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();

    const html = renderSidebarHTML(cachedCategories, authState);
    const mount = document.getElementById(MOUNT_ID);

    if (mount) {
      mount.innerHTML = html;
    } else {
      document.body.insertAdjacentHTML('afterbegin', html);
    }

    document.body.classList.add('pasaje-has-tienda-sidebar');
    bindEvents();
    refreshFavBadge();
  }

  (function hookAuthChange() {
    const client = window._supabase ||
      (typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null);
    if (client && client.auth && typeof client.auth.onAuthStateChange === 'function') {
      try {
        client.auth.onAuthStateChange(() => initTiendaSidebar());
      } catch (e) { /* noop */ }
    }
  })();

  window.initTiendaSidebar    = initTiendaSidebar;
  window.openTiendaSidebar    = openSidebar;
  window.closeTiendaSidebar   = closeSidebar;
  window.toggleTiendaSidebar  = toggleSidebar;

  window.PasajeTiendaSidebar = {
    init: initTiendaSidebar,
    open: openSidebar,
    close: closeSidebar,
    toggle: toggleSidebar,
    refresh: initTiendaSidebar
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTiendaSidebar);
  } else {
    initTiendaSidebar();
  }
})();
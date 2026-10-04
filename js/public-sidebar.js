// =============================================================
// js/public-sidebar.js
// Sidebar Público Responsivo para Pasaje de los Altos
// - Escritorio (>=1024px): Siempre visible y fijo.
// - Móvil (<1024px): Panel deslizable (Drawer) con overlay.
// FASE 24-A: Enlaces al marketplace apuntan a /tiendas/*
// =============================================================

(function () {
  'use strict';

  const SIDEBAR_ID = 'pasajePublicSidebar';
  const OVERLAY_ID = 'pasajePublicSidebarOverlay';
  const STYLES_ID  = 'pasajePublicSidebarStyles';

  let cachedCategories = [];
  let authState = { session: null, isAdmin: false, user: null };

  // Obtener prefijo relativo para subcarpetas (/admin/, /dashboard/)
  function getRootPrefix() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/admin/') || path.includes('/dashboard/')) return '../';
    return '';
  }

  // Escapar HTML para seguridad XSS
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Obtener conteo de favoritos en tiempo real desde localStorage o helper global
  function getFavoritesCount() {
    if (window.Favorites && typeof window.Favorites.count === 'function') {
      return window.Favorites.count();
    }
    try {
      const favs = JSON.parse(localStorage.getItem('pasaje_favorites') || localStorage.getItem('pasaje_favoritos_v1') || '[]');
      return Array.isArray(favs) ? favs.length : 0;
    } catch (e) {
      return 0;
    }
  }

  // Inyección de Estilos CSS nativos adaptados a Liquid Glass
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
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s, color 0.2s;
        background-color: var(--pub-sidebar-bg, rgba(var(--pub-sidebar-tint-rgb, 255, 255, 255), var(--pub-sidebar-opacity, 0.92))) !important;
        backdrop-filter: blur(var(--pub-sidebar-blur, 24px)) saturate(180%) !important;
        -webkit-backdrop-filter: blur(var(--pub-sidebar-blur, 24px)) saturate(180%) !important;
        color: var(--pub-sidebar-text, #0f172a) !important;
        border-right: 1px solid rgba(226, 232, 240, 0.8);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }

      #${SIDEBAR_ID}.open {
        transform: translateX(0) !important;
      }

      body.pasaje-public-sidebar-open {
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

      #${SIDEBAR_ID} .sidebar-nav-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 0.875rem;
        border-radius: 0.875rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--pub-sidebar-text, #1e293b);
        text-decoration: none !important;
        transition: all 0.15s ease;
        border-left: 4px solid transparent;
      }

      #${SIDEBAR_ID} .sidebar-nav-link:hover {
        background-color: rgba(16, 185, 129, 0.1) !important;
        color: var(--pub-sidebar-active, #10b981) !important;
        transform: translateX(2px);
      }

      #${SIDEBAR_ID} .sidebar-nav-link.active {
        background-color: rgba(16, 185, 129, 0.15) !important;
        color: var(--pub-sidebar-active, #10b981) !important;
        border-left-color: var(--pub-sidebar-active, #10b981) !important;
        font-weight: 800;
      }

      #${SIDEBAR_ID} .sidebar-block-title {
        font-size: 0.6875rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        margin-bottom: 0.375rem;
        padding-left: 0.5rem;
      }

      #${SIDEBAR_ID} .sidebar-scroll::-webkit-scrollbar {
        width: 4px;
      }
      #${SIDEBAR_ID} .sidebar-scroll::-webkit-scrollbar-thumb {
        background-color: rgba(148, 163, 184, 0.3);
        border-radius: 9999px;
      }

      /* COMPORTAMIENTO EN PANTALLAS GRANDES (ESCRITORIO >= 1024px) */
      @media (min-width: 1024px) {
        body {
          padding-left: 18.5rem !important;
        }

        #${SIDEBAR_ID} {
          transform: translateX(0) !important;
          box-shadow: none !important;
          z-index: 30 !important;
        }

        #${OVERLAY_ID} {
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

  // Comprobar estado de sesión y rol con Supabase Auth
  async function checkAuthAndRole() {
    if (typeof window._supabase === 'undefined') {
      return { session: null, isAdmin: false, user: null };
    }
    try {
      const { data: { session } } = await window._supabase.auth.getSession();
      if (!session) return { session: null, isAdmin: false, user: null };

      let isAdmin = false;
      if (typeof window.isAdmin === 'function') {
        try { isAdmin = await window.isAdmin(); } catch (e) {}
      }
      if (!isAdmin && session.user) {
        const { data: profile } = await window._supabase
          .from('profiles')
          .select('is_admin, role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile && (profile.is_admin === true || profile.role === 'admin')) {
          isAdmin = true;
        }
      }
      return { session, isAdmin, user: session.user };
    } catch (e) {
      return { session: null, isAdmin: false, user: null };
    }
  }

  // Consultar las 5 categorías principales activas
  async function fetchTopCategories() {
    if (typeof window._supabase === 'undefined') return [];
    try {
      const { data, error } = await window._supabase
        .from('categories')
        .select('id, name, slug, icon, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[PublicSidebar] Error al cargar categorías:', e);
      return [];
    }
  }

  // Helper para renderizar enlace de navegación
  function renderNavLink(href, icon, label, badgeCount = null, extraClass = '') {
    const R = getRootPrefix();
    const fullHref = href.startsWith('http') ? href : `${R}${href}`;

    const currentPath = window.location.pathname.toLowerCase();
    const targetPath = href.replace('../', '').toLowerCase();
    const isActive = currentPath.endsWith(targetPath) || (targetPath === 'index.html' && (currentPath.endsWith('/') || currentPath.endsWith('index.htm')));

    return `
      <a href="${fullHref}" class="sidebar-nav-link ${isActive ? 'active' : ''} ${extraClass}">
        <span class="text-base flex-shrink-0">${icon}</span>
        <span class="truncate flex-1">${escapeHtml(label)}</span>
        ${badgeCount !== null && badgeCount > 0 ? `
          <span class="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">
            ${badgeCount}
          </span>
        ` : ''}
      </a>
    `;
  }

  // Renderizar la estructura HTML del Sidebar por bloques
  function renderSidebarHTML(categories, auth) {
    const R = getRootPrefix();
    const favCount = getFavoritesCount();

    // ENCABEZADO
    const headerHTML = `
      <div class="flex items-center justify-between px-4 py-4 border-b border-slate-200/60 flex-shrink-0 bg-white/40 backdrop-blur-md">
        <a href="${R}index.html" class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">
            🏔️
          </div>
          <div class="min-w-0 leading-tight">
            <h3 class="font-extrabold text-sm text-slate-900 truncate tracking-tight">Pasaje de los Altos</h3>
            <p class="text-[10px] font-bold text-emerald-600 truncate">Quetzaltenango</p>
          </div>
        </a>
        <button type="button" id="${SIDEBAR_ID}CloseBtn"
          class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs transition shadow-sm lg:hidden"
          aria-label="Cerrar menú">
          ✕
        </button>
      </div>
    `;

    // BLOQUE 1: Estado de Cuenta y Acceso Rápido
    let block1HTML = '';
    if (auth.session) {
      const email = auth.user?.email || 'Usuario Activo';
      const userInitial = email.charAt(0).toUpperCase();

      block1HTML = `
        <div class="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-slate-100 border border-emerald-500/20 shadow-sm mb-5">
          <div class="flex items-center gap-2.5 mb-3">
            <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm flex-shrink-0">
              ${userInitial}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-black text-slate-900 truncate">${escapeHtml(email)}</p>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sesión iniciada
              </span>
            </div>
          </div>
          
          <div class="space-y-1.5">
            <a href="${R}dashboard/dashboard.html"
               class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
              <span>⚙️</span>
              <span>Ir a mi Dashboard</span>
            </a>
            ${auth.isAdmin ? `
              <a href="${R}admin/admin.html"
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
          <a href="${R}login.html"
             class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
            <span>🔑</span>
            <span>Iniciar Sesión</span>
          </a>
          <a href="${R}registro.html"
             class="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition flex items-center justify-center gap-2">
            <span>🏪</span>
            <span>Registrar mi Tienda</span>
          </a>
        </div>
      `;
    }

    // ============================================================
    // BLOQUE 2: Navegación Principal
    // FASE 24-A: todos los enlaces del marketplace apuntan a /tiendas/
    // ============================================================
    const block2HTML = `
      <div class="mb-5">
        <h4 class="sidebar-block-title">Navegación Principal</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('index.html', '🏠', 'Inicio')}
          ${renderNavLink('tiendas/productos.html', '🛍️', 'Todos los Productos')}
          ${renderNavLink('tiendas/productos.html?openCategories=true', '🗂️', 'Categorías')}
          ${renderNavLink('tiendas/ofertas.html', '🔥', 'Ofertas Relámpago')}
          ${renderNavLink('delivery.html', '🛵', 'Pasaje Express / Mandaditos')}
          ${renderNavLink('tiendas/tienda.html', '🏪', 'Directorio de Tiendas')}
          ${renderNavLink('tiendas/favoritos.html', '❤️', 'Mis Favoritos', favCount)}
          ${renderNavLink('tiendas/rastreo.html', '📍', 'Rastreo de Pedido')}
        </nav>
      </div>
    `;

    // BLOQUE 3: Acceso Directo a Categorías Destacadas
    let categoriesListHTML = '';
    if (categories && categories.length > 0) {
      categoriesListHTML = categories.map(c => `
        <a href="${R}tiendas/productos.html?cat=${encodeURIComponent(c.slug)}"
           class="sidebar-nav-link text-xs">
          <span class="text-sm flex-shrink-0">${escapeHtml(c.icon || '📦')}</span>
          <span class="truncate">${escapeHtml(c.name)}</span>
        </a>
      `).join('');
    } else {
      categoriesListHTML = `<p class="text-[11px] text-slate-400 italic px-2 py-1">Cargando categorías...</p>`;
    }

    const block3HTML = `
      <div class="mb-5">
        <div class="flex items-center justify-between pr-2 mb-1">
          <h4 class="sidebar-block-title !mb-0">Categorías Destacadas</h4>
          <a href="${R}tiendas/productos.html?openCategories=true" class="text-[10px] font-bold text-emerald-600 hover:underline">Ver todas →</a>
        </div>
        <nav class="space-y-0.5">
          ${categoriesListHTML}
        </nav>
      </div>
    `;

    // BLOQUE 4: Información y Soporte
    const block4HTML = `
      <div class="mb-4">
        <h4 class="sidebar-block-title">Información y Soporte</h4>
        <nav class="space-y-0.5">
          ${renderNavLink('nosotros.html', '📖', 'Sobre Nosotros')}
          ${renderNavLink('contacto.html', '🎧', 'Contacto y Ayuda')}
          ${renderNavLink('terminos.html', '📜', 'Términos y Condiciones')}
        </nav>
      </div>
    `;

    // PIE DE PÁGINA DEL SIDEBAR
    const footerHTML = `
      <div class="px-4 py-3 border-t border-slate-200/60 flex-shrink-0 bg-white/40 text-center">
        <p class="text-[10px] font-bold text-slate-400">
          © ${new Date().getFullYear()} Pasaje de los Altos GT
        </p>
      </div>
    `;

    return `
      <aside id="${SIDEBAR_ID}" role="dialog" aria-modal="true" aria-label="Menú de navegación">
        ${headerHTML}
        
        <div class="flex-1 overflow-y-auto p-3.5 sidebar-scroll">
          ${block1HTML}
          ${block2HTML}
          ${block3HTML}
          ${block4HTML}
        </div>

        ${footerHTML}
      </aside>

      <div id="${OVERLAY_ID}" aria-hidden="true"></div>
    `;
  }

  // Abrir sidebar (solo activo en móvil)
  function openPublicSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (!sidebar || !overlay) return;

    // Actualizar el contador de favoritos
    const favBadge = sidebar.querySelector('a[href*="favoritos.html"] span.bg-rose-500');
    const favLink = sidebar.querySelector('a[href*="favoritos.html"]');
    const currentFavs = getFavoritesCount();

    if (favLink) {
      if (currentFavs > 0) {
        if (favBadge) {
          favBadge.textContent = currentFavs;
        } else {
          favLink.insertAdjacentHTML('beforeend', `
            <span class="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">
              ${currentFavs}
            </span>
          `);
        }
      } else if (favBadge) {
        favBadge.remove();
      }
    }

    overlay.classList.add('open');
    sidebar.classList.add('open');
    if (window.innerWidth < 1024) {
      document.body.classList.add('pasaje-public-sidebar-open');
    }
  }

  // Cerrar sidebar
  function closePublicSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (!sidebar || !overlay) return;

    overlay.classList.remove('open');
    sidebar.classList.remove('open');
    document.body.classList.remove('pasaje-public-sidebar-open');
  }

  // Alternar apertura/cierre
  function togglePublicSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) return;
    if (sidebar.classList.contains('open')) {
      closePublicSidebar();
    } else {
      openPublicSidebar();
    }
  }

  // Asignar eventos interactivos
  function bindEvents() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    const closeBtn = document.getElementById(`${SIDEBAR_ID}CloseBtn`);
    const logoutBtn = document.getElementById(`${SIDEBAR_ID}LogoutBtn`);

    if (overlay) overlay.addEventListener('click', closePublicSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closePublicSidebar);

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          if (window._supabase) await window._supabase.auth.signOut();
        } catch (e) {
          console.warn('[SidebarLogout] Error:', e);
        }
        localStorage.removeItem('activeStoreId');
        closePublicSidebar();
        window.location.reload();
      });
    }

    // Cierre automático en móvil al presionar cualquier enlace
    sidebar?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1024) {
          closePublicSidebar();
        }
      });
    });

    // Tecla Escape para cerrar en móvil
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.innerWidth < 1024) closePublicSidebar();
    });
  }

  // Inicialización y renderizado global
  async function initPublicSidebar() {
    injectStyles();

    // Consultar sesión y categorías en paralelo
    const [auth, categories] = await Promise.all([
      checkAuthAndRole(),
      fetchTopCategories()
    ]);

    authState = auth;
    cachedCategories = categories;

    // Eliminar previas instancias si existen
    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();

    const container = document.getElementById('publicSidebar');
    const html = renderSidebarHTML(cachedCategories, authState);

    if (container) {
      container.innerHTML = html;
    } else {
      document.body.insertAdjacentHTML('beforeend', html);
    }

    bindEvents();
  }

  // Suscribirse a cambios de autenticación en tiempo real
  if (typeof window._supabase !== 'undefined' && window._supabase.auth) {
    window._supabase.auth.onAuthStateChange(() => {
      initPublicSidebar();
    });
  }

  // Exponer funciones globales requeridas
  window.initPublicSidebar = initPublicSidebar;
  window.openPublicSidebar = openPublicSidebar;
  window.closePublicSidebar = closePublicSidebar;
  window.togglePublicSidebar = togglePublicSidebar;

  window.PasajePublicSidebar = {
    init: initPublicSidebar,
    open: openPublicSidebar,
    close: closePublicSidebar,
    toggle: togglePublicSidebar,
    refresh: initPublicSidebar
  };

  // Auto-inicializar al cargar la página
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPublicSidebar);
  } else {
    initPublicSidebar();
  }
})();
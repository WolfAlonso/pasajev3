// =============================================================
// js/dashboard-sidebar.js
// Sidebar y Topbar adaptativos con soporte Multi-Rol,
// Enrutamiento Inteligente, Selector de Modo, Activador de Perfiles
// y Badges de Notificación en tiempo real (Fase 17.3).
// =============================================================

(function () {
  'use strict';

  const ROOT              = '../';
  const ACTIVE_STORE_KEY  = 'activeStoreId';
  const DASH_MODE_KEY     = 'pasajeDashMode';
  const SIDEBAR_ID        = 'pasajeDashSidebar';
  const OVERLAY_ID        = 'pasajeDashSidebarOverlay';
  const SECTION_STATE_KEY = 'pasaje_dash_sidebar_sections';

  let badgeChannel = null;
  let badgeDebounce = null;

  const SECTIONS_MERCHANT = [
    {
      id: 'commercial',
      title: 'Gestión Comercial',
      openByDefault: true,
      items: [
        { key: 'productos', label: 'Productos e Inventario', href: 'dashboard-productos.html', icon: '📦' },
        { key: 'pedidos',   label: 'Pedidos',                href: 'dashboard-pedidos.html',   icon: '🛒', badge: 'pedidos' },
        { key: 'cupones',   label: 'Cupones',                href: 'dashboard-cupones.html',   icon: '🎟️' },
        { key: 'tiendas',   label: 'Mis Tiendas',            href: 'dashboard-tiendas.html',   icon: '🏪' }
      ]
    },
    {
      id: 'analytics',
      title: 'Análisis y Clientes',
      openByDefault: true,
      items: [
        { key: 'metricas',  label: 'Métricas y Ventas', href: 'dashboard-metricas.html', icon: '📊' },
        { key: 'clientes',  label: 'Clientes',          href: 'dashboard-clientes.html', icon: '👥' },
        { key: 'zonas',     label: 'Zonas y Mapa',      href: 'dashboard-zonas.html',    icon: '🗺️' }
      ]
    },
    {
      id: 'tools',
      title: 'Herramientas',
      openByDefault: true,
      items: [
        { key: 'asistente-ai',    label: 'Asistente de Ventas AI', href: 'dashboard-asistente-ai.html', icon: '🪄' },
        { key: 'material',        label: 'Kit Imprimible QR',      href: 'dashboard-material.html',     icon: '🖨️' },
        { key: 'calculadora',     label: 'Calculadora Producción', href: 'dashboard-calculadora.html',  icon: '🧮' },
        { key: 'calculadora-rev', label: 'Calculadora Reventa',    href: 'dashboard-calculadora2.html', icon: '🛍️' },
        { key: 'soporte',         label: 'Soporte y Casos',        href: 'dashboard-soporte.html',      icon: '🎧', badge: 'soporte' }
      ]
    }
  ];

  const SECTIONS_DELIVERY = [
    {
      id: 'delivery',
      title: 'Pasaje Delivery Xela',
      openByDefault: true,
      items: [
        { key: 'delivery-feed', label: 'Feed de Carreras', href: 'dashboard-delivery.html', icon: '🛵', badge: 'delivery' }
      ]
    }
  ];

  const SECTIONS_REAL_ESTATE = [
    {
      id: 'real_estate',
      title: 'Pasaje Inmuebles Xela',
      openByDefault: true,
      items: [
        { key: 'inmuebles-list', label: 'Mis Inmuebles y Propiedades', href: 'dashboard-inmuebles.html', icon: '🏠' }
      ]
    }
  ];

  function idEq(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return false;
    return String(a) === String(b);
  }

  function getCurrentPage() {
    return window.location.pathname.split('/').pop() || '';
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getSectionState() {
    try { return JSON.parse(localStorage.getItem(SECTION_STATE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveSectionState(state) {
    try { localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function isSectionOpen(id, defaultOpen) {
    const state = getSectionState();
    return Object.prototype.hasOwnProperty.call(state, id) ? !!state[id] : !!defaultOpen;
  }

  function client() {
    return window._supabase || (typeof initSupabaseClient === 'function' ? initSupabaseClient() : null);
  }

  async function getUserRoles(userId) {
    if (!userId) return { is_merchant: true, is_delivery: false, is_real_estate: false };
    const c = client();
    if (!c) return { is_merchant: true, is_delivery: false, is_real_estate: false };

    const { data } = await c.from('user_roles')
      .select('is_merchant, is_delivery, is_real_estate')
      .eq('user_id', userId).maybeSingle();

    return {
      is_merchant: data ? data.is_merchant !== false : true,
      is_delivery: data ? !!data.is_delivery : false,
      is_real_estate: data ? !!data.is_real_estate : false
    };
  }

  async function getMyStores() {
    const session = typeof window.requireAuth === 'function' ? await window.requireAuth() : null;
    if (!session) return { session: null, stores: [] };
    const c = client();
    if (!c) return { session, stores: [] };

    const { data, error } = await c.from('stores').select('*')
      .eq('user_id', session.user.id).order('created_at', { ascending: true });
    if (error) { console.error('[DashboardSidebar] getMyStores:', error); return { session, stores: [] }; }
    return { session, stores: data || [] };
  }

  async function getActiveStore() {
    const { session, stores } = await getMyStores();
    if (!session) return { session: null, stores: [], store: null };
    if (!stores || stores.length === 0) return { session, stores: [], store: null };

    const storedId = localStorage.getItem(ACTIVE_STORE_KEY);
    let active = stores.find(s => idEq(s.id, storedId));
    if (!active) { active = stores[0]; localStorage.setItem(ACTIVE_STORE_KEY, String(active.id)); }
    return { session, stores, store: active };
  }

  function setActiveStore(id) { if (id) localStorage.setItem(ACTIVE_STORE_KEY, String(id)); }
  function clearActiveStore() { localStorage.removeItem(ACTIVE_STORE_KEY); }
  async function loadMyStore() { const { store } = await getActiveStore(); return store; }

  async function guardDashboardPage() {
    const { session, stores, store } = await getActiveStore();
    if (!session) return { session: null, stores: [], store: null };

    const page = getCurrentPage();
    if (page === 'dashboard-delivery.html' || page === 'dashboard-inmuebles.html' || page === 'dashboard.html') {
      return { session, stores: stores || [], store: store || null };
    }
    if (!store) { window.location.replace('dashboard-tiendas.html'); return { session, stores: [], store: null }; }
    return { session, stores, store };
  }

  function injectStyles() {
    let s = document.getElementById('pasajeDashSidebarStyles');
    if (!s) {
      s = document.createElement('style');
      s.id = 'pasajeDashSidebarStyles';
      document.head.appendChild(s);
    }
    s.textContent = `
      #${SIDEBAR_ID} {
        transition: transform .3s cubic-bezier(.2,.7,.2,1), background-color .2s, color .2s;
        background-color: var(--dash-sidebar-bg, rgba(var(--dash-sidebar-tint-rgb, 255, 255, 255), var(--dash-sidebar-opacity, 0.88))) !important;
        backdrop-filter: blur(var(--dash-sidebar-blur, 20px)) saturate(160%) !important;
        -webkit-backdrop-filter: blur(var(--dash-sidebar-blur, 20px)) saturate(160%) !important;
        color: var(--dash-sidebar-text, #1e293b) !important;
        border-right: 1px solid rgba(148, 163, 184, 0.25);
      }
      #${SIDEBAR_ID} a, #${SIDEBAR_ID} button, #${SIDEBAR_ID} span, #${SIDEBAR_ID} p, #${SIDEBAR_ID} div { text-decoration: none !important; }
      #${SIDEBAR_ID}.open { transform: translateX(0) !important; }
      body.pasaje-dash-sidebar-open { overflow: hidden; }

      #${SIDEBAR_ID} .pasaje-nav-link {
        transition: background .15s ease, color .15s ease, border .15s ease;
        text-decoration: none !important; border-radius: 0.75rem !important;
        border: none !important; border-left: 5px solid transparent !important;
        color: var(--dash-sidebar-text, #1e293b) !important;
      }
      #${SIDEBAR_ID} .pasaje-nav-link:hover {
        background: color-mix(in srgb, var(--dash-sidebar-active, #10b981) 10%, transparent) !important;
        color: var(--dash-sidebar-active, #10b981) !important;
      }
      #${SIDEBAR_ID} .pasaje-nav-link.active {
        background: color-mix(in srgb, var(--dash-sidebar-active, #10b981) 18%, transparent) !important;
        color: var(--dash-sidebar-active, #10b981) !important;
        border-left: 5px solid var(--dash-sidebar-active, #10b981) !important;
        font-weight: 800 !important;
      }

      #${SIDEBAR_ID} .pasaje-nav-badge {
        margin-left: auto; font-size: 10px; font-weight: 800;
        background: #ef4444; color: #fff;
        padding: 2px 7px; border-radius: 999px;
        box-shadow: 0 2px 6px -2px rgba(239,68,68,.6);
        animation: dashBadgePop .28s ease-out;
      }
      @keyframes dashBadgePop {
        0%   { transform: scale(.5); opacity: 0; }
        60%  { transform: scale(1.12); }
        100% { transform: scale(1); opacity: 1; }
      }

      .dash-topbar-dynamic {
        background-color: rgba(var(--header-glass-tint-rgb, var(--color-primary-rgb, 30, 58, 138)), var(--header-glass-opacity, 0.95)) !important;
        backdrop-filter: blur(var(--header-glass-blur, 16px)) saturate(160%) !important;
        -webkit-backdrop-filter: blur(var(--header-glass-blur, 16px)) saturate(160%) !important;
        color: #ffffff !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      }

      @media (min-width: 1024px) {
        body.pasaje-has-dash-sidebar { padding-left: 17rem !important; }
        body.pasaje-has-dash-sidebar #${SIDEBAR_ID} { transform: translateX(0) !important; }
        body.pasaje-has-dash-sidebar #${OVERLAY_ID} { display: none !important; }
      }
    `;
  }

  function storeAvatarHTML(store, sizeClasses, textClasses) {
    const rawName = (store && store.name) ? String(store.name).trim() : '?';
    const initial = escapeHtml((rawName.charAt(0) || '?').toUpperCase());
    if (store && store.logo_url) {
      return `<img src="${escapeHtml(store.logo_url)}" alt="" class="${sizeClasses} rounded-full object-cover flex-shrink-0 border border-white/70 shadow-sm">`;
    }
    return `<div class="${sizeClasses} rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center font-extrabold flex-shrink-0 shadow-sm ${textClasses}">${initial}</div>`;
  }

  function renderModeSelector(roles, currentMode) {
    const modes = [];
    if (roles.is_merchant) modes.push({ key: 'merchant', label: 'Comercio', icon: '🏪' });
    if (roles.is_delivery) modes.push({ key: 'delivery', label: 'Repartidor', icon: '🛵' });
    if (roles.is_real_estate) modes.push({ key: 'real_estate', label: 'Inmuebles', icon: '🏠' });

    const buttons = modes.map(m => {
      const isActive = currentMode === m.key;
      return `
        <button type="button" data-switch-mode="${m.key}" class="flex-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'opacity-70 hover:opacity-100'}">
          <span>${m.icon}</span><span class="truncate">${m.label}</span>
        </button>`;
    }).join('');

    const hasMissingRoles = !roles.is_merchant || !roles.is_delivery || !roles.is_real_estate;

    return `
      <div class="px-3 pt-2 flex-shrink-0 space-y-1.5">
        <div class="bg-black/10 p-1 rounded-xl flex items-center gap-1 border border-black/10">${buttons}</div>
        ${hasMissingRoles ? `
          <button type="button" id="btnOpenActivateRoleModal" class="w-full text-center py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 border border-emerald-300/40 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1">
            <span>➕</span><span>Activar Nuevo Perfil</span>
          </button>` : ''}
      </div>`;
  }

  function renderSection(section, currentPage) {
    const open = isSectionOpen(section.id, section.openByDefault);
    const itemsHTML = section.items.map(m => {
      const isActive = currentPage === m.href;
      const badgeHTML = m.badge
        ? `<span data-dash-badge="${m.badge}" class="pasaje-nav-badge hidden">0</span>`
        : '';
      return `
        <a href="${m.href}" class="pasaje-nav-link flex items-center gap-3 pl-3 pr-2 py-2 rounded-r-xl text-sm ${isActive ? 'active' : ''}">
          <span class="text-lg flex-shrink-0">${m.icon}</span>
          <span class="truncate">${escapeHtml(m.label)}</span>
          ${badgeHTML}
        </a>`;
    }).join('');

    return `
      <section data-acc-section="${section.id}" class="mb-1">
        <button type="button" data-acc-toggle="${section.id}" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-black/5 transition">
          <span class="pasaje-section-title text-[10px] font-bold uppercase tracking-wider">${escapeHtml(section.title)}</span>
          <svg class="pasaje-chevron w-3.5 h-3.5 ${open ? '' : 'rotated'}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="pasaje-section-body ${open ? '' : 'collapsed'}">
          <div class="pasaje-section-inner"><div class="space-y-0.5 pb-1">${itemsHTML}</div></div>
        </div>
      </section>`;
  }

  function renderStoreSwitcher(store, stores) {
    if (!stores || stores.length === 0 || !store) {
      return `
        <div class="px-3 pt-2 pb-2 flex-shrink-0">
          <div class="p-3 rounded-2xl bg-black/5 border border-black/10 shadow-sm text-center">
            <p class="text-xs opacity-70 mb-2">Sin tiendas registradas</p>
            <a href="dashboard-tiendas.html" class="inline-flex items-center gap-1 text-[11px] bg-emerald-600 !text-white font-bold py-1.5 px-3 rounded-lg transition">+ Crear primera tienda</a>
          </div>
        </div>`;
    }

    const storeItems = stores.map(s => {
      const isActive = idEq(s.id, store.id);
      return `
        <button type="button" data-store-id="${escapeHtml(s.id)}" class="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-black/5 transition ${isActive ? 'bg-black/10' : ''}">
          ${storeAvatarHTML(s, 'w-7 h-7', 'text-xs')}
          <span class="flex-1 truncate text-left text-xs font-semibold">${escapeHtml(s.name)}</span>
          ${isActive ? '<span class="text-emerald-500 text-sm font-bold">✓</span>' : ''}
        </button>`;
    }).join('');

    return `
      <div class="px-3 pt-2 pb-2 flex-shrink-0">
        <details id="${SIDEBAR_ID}StoreSwitcher" class="group">
          <summary class="cursor-pointer select-none">
            <div class="flex items-center gap-3 p-2 rounded-2xl bg-black/5 hover:bg-black/10 border border-black/10 shadow-sm transition-all">
              ${storeAvatarHTML(store, 'w-10 h-10', 'text-sm')}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Activa</span>
                </div>
                <div class="text-xs font-bold truncate">${escapeHtml(store.name)}</div>
              </div>
              <svg class="w-4 h-4 opacity-50 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </summary>
          <div class="mt-2 rounded-2xl bg-white/95 text-slate-900 border border-black/10 shadow-xl p-1.5">
            <div class="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Tus tiendas (${stores.length})</div>
            ${storeItems}
            <a href="dashboard-tiendas.html" class="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-emerald-50 text-xs font-bold text-emerald-700 transition mt-1 border-t border-gray-100 pt-2"><span class="text-base leading-none">+</span> Nueva tienda</a>
          </div>
        </details>
      </div>`;
  }

  function renderSidebar(user, store, stores, roles, activeMode) {
    const current = getCurrentPage();
    let activeSections = SECTIONS_MERCHANT;
    let modeTitle = 'Panel Emprendedor';

    if (activeMode === 'delivery') { activeSections = SECTIONS_DELIVERY; modeTitle = 'Panel Repartidor'; }
    else if (activeMode === 'real_estate') { activeSections = SECTIONS_REAL_ESTATE; modeTitle = 'Panel Inmuebles'; }

    const sectionsHTML = activeSections.map(sec => renderSection(sec, current)).join('');

    return `
      <aside id="${SIDEBAR_ID}" class="fixed inset-y-0 left-0 z-[60] w-[17rem] flex flex-col shadow-2xl" style="transform: translateX(-100%);">
        <div class="flex items-center justify-between px-4 py-3 border-b border-black/10 flex-shrink-0">
          <a href="${ROOT}index.html" class="flex items-center gap-2 min-w-0">
            <span class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg shadow-sm">🏔️</span>
            <div class="leading-tight min-w-0">
              <div class="font-extrabold text-sm truncate">Pasaje de los <span class="text-indigo-500">Altos</span></div>
              <div class="text-[10px] opacity-70 font-medium truncate">${modeTitle}</div>
            </div>
          </a>
          <button type="button" id="${SIDEBAR_ID}Close" class="lg:hidden bg-black/10 hover:bg-black/20 w-8 h-8 rounded-xl flex items-center justify-center transition flex-shrink-0 font-bold text-xs">✕</button>
        </div>

        ${renderModeSelector(roles, activeMode)}

        <div class="px-3 pt-2 pb-1 flex-shrink-0 space-y-1">
          <a href="${ROOT}index.html" class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold bg-black/10 hover:bg-black/20 border border-black/10 transition shadow-sm !text-indigo-600 no-underline">
            <span class="text-base">🏬</span><span>Ver Catálogo Público</span>
          </a>
          <a href="${ROOT}inmuebles.html" class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-200 transition shadow-sm !text-indigo-700 no-underline">
            <span class="text-base">🏠</span><span>Ver Portal Inmuebles</span>
          </a>
        </div>

        ${activeMode === 'merchant' ? renderStoreSwitcher(store, stores) : ''}
        <nav class="flex-1 overflow-y-auto px-2 py-1">${sectionsHTML}</nav>
        <div class="border-t border-black/10 flex-shrink-0 bg-black/5">
          <div class="px-4 py-2 text-[11px] opacity-70 truncate">${escapeHtml(user.email || '')}</div>
          <button id="dashboardLogoutBtn" class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold !text-red-500 hover:bg-red-500/10 transition border-t border-black/10"><span class="text-lg">🚪</span> <span>Cerrar sesión</span></button>
        </div>
      </aside>
      <div id="${OVERLAY_ID}" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] lg:hidden"></div>

      <!-- MODAL DINÁMICO DE ACTIVACIÓN DE ROL -->
      <div id="activateRoleModal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
            <h3 class="font-extrabold text-slate-900 text-base">➕ Activar Nuevo Perfil</h3>
            <button id="btnCloseRoleModal" type="button" class="bg-slate-100 text-slate-700 w-8 h-8 rounded-full font-bold text-xs">✕</button>
          </div>
          <div class="space-y-3" id="roleActivationOptions">
            ${!roles.is_delivery ? `
              <button type="button" onclick="activateUserRole('delivery')" class="w-full p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition flex items-center gap-3">
                <span class="text-3xl">🛵</span>
                <div>
                  <h4 class="font-extrabold text-xs text-emerald-900 uppercase">Activar Perfil de Repartidor</h4>
                  <p class="text-[11px] text-emerald-700">Realiza carreras de Pasaje Delivery en Xela.</p>
                </div>
              </button>` : ''}
            ${!roles.is_real_estate ? `
              <button type="button" onclick="activateUserRole('real_estate')" class="w-full p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-left transition flex items-center gap-3">
                <span class="text-3xl">🏠</span>
                <div>
                  <h4 class="font-extrabold text-xs text-indigo-900 uppercase">Activar Perfil Inmobiliario</h4>
                  <p class="text-[11px] text-indigo-700">Publica casas, cuartos o locales en alquiler/venta.</p>
                </div>
              </button>` : ''}
            ${!roles.is_merchant ? `
              <button type="button" onclick="activateUserRole('merchant')" class="w-full p-4 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition flex items-center gap-3">
                <span class="text-3xl">🏪</span>
                <div>
                  <h4 class="font-extrabold text-xs text-blue-900 uppercase">Activar Perfil de Comercio</h4>
                  <p class="text-[11px] text-blue-700">Crea tu tienda y vende productos en la red.</p>
                </div>
              </button>` : ''}
          </div>
        </div>
      </div>`;
  }

  function renderTopbar(user, store) {
    return `
      <header class="dash-topbar-dynamic shadow-lg sticky top-0 z-40">
        <div class="px-4 py-3 flex justify-between items-center gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <button type="button" id="${SIDEBAR_ID}Open" class="lg:hidden bg-white/10 hover:bg-white/20 p-2 rounded-lg transition flex-shrink-0" aria-label="Abrir menú">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <a href="${ROOT}index.html" class="text-lg font-extrabold truncate">Pasaje de los <span class="text-indigo-400">Altos</span></a>
            ${store ? `<span class="hidden sm:inline text-xs opacity-80 truncate max-w-[180px]">· ${escapeHtml(store.name)}</span>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <a href="${ROOT}inmuebles.html" class="text-xs bg-indigo-500/30 hover:bg-indigo-500/40 text-white border border-indigo-300/30 px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1">
              <span>🏠</span><span>Portal Inmuebles</span>
            </a>
            <a href="${ROOT}index.html" class="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-semibold transition">Catálogo</a>
          </div>
        </div>
      </header>`;
  }

  function openSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    const ov = document.getElementById(OVERLAY_ID);
    if (!el || !ov) return;
    ov.classList.remove('hidden'); el.classList.add('open');
    el.style.transform = 'translateX(0)';
    document.body.classList.add('pasaje-dash-sidebar-open');
  }
  function closeSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    const ov = document.getElementById(OVERLAY_ID);
    if (!el || !ov) return;
    ov.classList.add('hidden'); el.classList.remove('open');
    el.style.transform = 'translateX(-100%)';
    document.body.classList.remove('pasaje-dash-sidebar-open');
  }
  function toggleSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    if (!el) return;
    if (el.classList.contains('open')) closeSidebar(); else openSidebar();
  }

  function bindAccordion() {
    document.querySelectorAll(`#${SIDEBAR_ID} [data-acc-toggle]`).forEach(btn => {
      if (btn.dataset.accBound) return;
      btn.dataset.accBound = '1';
      btn.addEventListener('click', () => {
        const id = btn.dataset.accToggle;
        const section = btn.closest('[data-acc-section]');
        if (!section) return;
        const body = section.querySelector('.pasaje-section-body');
        const chevron = btn.querySelector('.pasaje-chevron');
        const collapsed = body.classList.toggle('collapsed');
        if (chevron) chevron.classList.toggle('rotated', collapsed);
        const state = getSectionState(); state[id] = !collapsed; saveSectionState(state);
      });
    });
  }

  function bindModeSwitcher() {
    document.querySelectorAll(`#${SIDEBAR_ID} [data-switch-mode]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.switchMode;
        localStorage.setItem(DASH_MODE_KEY, mode);
        if (mode === 'delivery') window.location.href = 'dashboard-delivery.html';
        else if (mode === 'real_estate') window.location.href = 'dashboard-inmuebles.html';
        else window.location.href = 'dashboard-productos.html';
      });
    });

    const btnOpenModal = document.getElementById('btnOpenActivateRoleModal');
    if (btnOpenModal) btnOpenModal.addEventListener('click', () => {
      document.getElementById('activateRoleModal').classList.remove('hidden');
    });

    const btnCloseModal = document.getElementById('btnCloseRoleModal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => {
      document.getElementById('activateRoleModal').classList.add('hidden');
    });

    document.querySelectorAll(`[data-store-id]`).forEach(btn => {
      btn.addEventListener('click', () => {
        setActiveStore(btn.dataset.storeId);
        window.location.reload();
      });
    });
  }

  // =========================================================
  // FASE 17.3 — Badges de Notificación en tiempo real
  // =========================================================

  function setBadge(name, count) {
    const el = document.querySelector(`[data-dash-badge="${name}"]`);
    if (!el) return;
    const n = Number(count) || 0;
    if (n <= 0) {
      el.textContent = '';
      el.classList.add('hidden');
    } else {
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.remove('hidden');
    }
  }

  async function refreshNavBadges({ storeId, userId, roles } = {}) {
    const c = client();
    if (!c) return;

    // Pedidos pendientes (status 'sent') de la tienda activa
    if (storeId && (!roles || roles.is_merchant !== false)) {
      try {
        const { count, error } = await c
          .from('cart_orders')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', storeId)
          .eq('status', 'sent');
        if (!error) setBadge('pedidos', count || 0);
      } catch (e) { /* silencioso */ }
    }

    // Delivery: solicitudes broadcast pendientes + counter-ofertas al store
    if (storeId) {
      try {
        const { data, error } = await c
          .from('delivery_requests')
          .select('id, status, store_id, driver_id')
          .in('status', ['pending', 'counter_offered'])
          .eq('store_id', storeId);
        if (!error) setBadge('delivery', (data || []).length);
      } catch (e) { /* silencioso */ }
    }

    // Soporte: si la tabla existe, contar abiertos del store
    // (se deja el badge silencioso si no aplica)
  }

  function subscribeNavBadges({ storeId, userId }) {
    const c = client();
    if (!c || !storeId) return;

    try {
      if (badgeChannel) c.removeChannel(badgeChannel);

      badgeChannel = c
        .channel(`dash_badges_${storeId}_${userId || 'anon'}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'cart_orders', filter: `store_id=eq.${storeId}` },
          () => scheduleBadgeRefresh({ storeId, userId })
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'delivery_requests', filter: `store_id=eq.${storeId}` },
          () => scheduleBadgeRefresh({ storeId, userId })
        )
        .subscribe();
    } catch (e) {
      console.warn('[DashboardSidebar] badge subscription failed:', e);
    }
  }

  function scheduleBadgeRefresh(ctx) {
    if (badgeDebounce) clearTimeout(badgeDebounce);
    badgeDebounce = setTimeout(() => refreshNavBadges(ctx), 250);
  }

  // =========================================================
  // Activación de roles
  // =========================================================
  window.activateUserRole = async function (roleKey) {
    try {
      const session = typeof window.requireAuth === 'function' ? await window.requireAuth() : null;
      if (!session) return;
      const c = client();
      const updateData = {};
      if (roleKey === 'delivery') updateData.is_delivery = true;
      if (roleKey === 'real_estate') updateData.is_real_estate = true;
      if (roleKey === 'merchant') updateData.is_merchant = true;

      await c.from('user_roles').upsert([{ user_id: session.user.id, ...updateData }], { onConflict: 'user_id' });

      localStorage.setItem(DASH_MODE_KEY, roleKey);
      if (roleKey === 'delivery') window.location.href = 'dashboard-delivery.html';
      else if (roleKey === 'real_estate') window.location.href = 'dashboard-inmuebles.html';
      else window.location.href = 'dashboard-tiendas.html';
    } catch (err) {
      alert('Error al activar perfil: ' + err.message);
    }
  };

  // =========================================================
  // initDashboardNav
  // =========================================================
  async function initDashboardNav({ user, store, stores } = {}) {
    if (!user) return;
    injectStyles();

    const roles = await getUserRoles(user.id);
    const currentPage = getCurrentPage();
    let currentMode = localStorage.getItem(DASH_MODE_KEY) || 'merchant';

    if (currentPage === 'dashboard-delivery.html') currentMode = 'delivery';
    else if (currentPage === 'dashboard-inmuebles.html') currentMode = 'real_estate';

    if (!stores && currentMode === 'merchant') {
      const res = await getMyStores();
      stores = res.stores;
    }
    if (!store && stores && stores.length > 0) {
      const storedId = localStorage.getItem(ACTIVE_STORE_KEY);
      store = stores.find(s => idEq(s.id, storedId)) || stores[0];
    }

    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();

    document.body.insertAdjacentHTML('beforeend', renderSidebar(user, store, stores, roles, currentMode));
    document.body.classList.add('pasaje-has-dash-sidebar');

    const headerMount = document.getElementById('dashboardHeader');
    if (headerMount) headerMount.innerHTML = renderTopbar(user, store);

    const openBtn  = document.getElementById(`${SIDEBAR_ID}Open`);
    const closeBtn = document.getElementById(`${SIDEBAR_ID}Close`);
    const overlay  = document.getElementById(OVERLAY_ID);
    if (openBtn)  openBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay)  overlay.addEventListener('click', closeSidebar);

    bindAccordion();
    bindModeSwitcher();

    // Esc cierra el sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    const logoutBtn = document.getElementById('dashboardLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { const c = client(); await c.auth.signOut(); } catch (e) {}
        clearActiveStore();
        window.location.replace(ROOT + 'login.html');
      });
    }

    // Cargar badges y suscribirse a cambios en tiempo real
    const badgeCtx = { storeId: store?.id || null, userId: user.id, roles };
    await refreshNavBadges(badgeCtx);
    subscribeNavBadges(badgeCtx);

    // Refresco al volver el foco a la pestaña
    window.addEventListener('focus', () => refreshNavBadges(badgeCtx));

    // API pública para que las páginas refresquen manualmente tras mutaciones
    window.__pasajeRefreshDashBadges = () => refreshNavBadges(badgeCtx);
  }

  window.initDashboardNav       = initDashboardNav;
  window.initDashboardSidebar   = initDashboardNav;
  window.getMyStores            = getMyStores;
  window.getActiveStore         = getActiveStore;
  window.setActiveStore         = setActiveStore;
  window.clearActiveStore       = clearActiveStore;
  window.loadMyStore            = loadMyStore;
  window.guardDashboardPage     = guardDashboardPage;
  window.toggleDashboardSidebar = toggleSidebar;
})();
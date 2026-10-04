// =============================================================
// /js/tiendas/merchant-sidebar.js
// Sidebar privado del comercio para /tiendas/dashboard/*.html
//
// - Topbar (renderiza en #merchantSidebar)
// - Sidebar fijo en escritorio (>=1024px), drawer en móvil
// - Secciones: Operación / Crecimiento / Mi Tienda
// - Badges en vivo (pedidos nuevos) vía PasajeRealtime
// - Logout → ../../login.html
//
// Uso:
//   const ctx = await window.tiendaRequireMerchant();
//   if (!ctx) return;
//   await window.initMerchantNav(ctx);
// =============================================================

(function () {
  'use strict';

  const SIDEBAR_ID       = 'pasajeMerchantSidebar';
  const OVERLAY_ID       = 'pasajeMerchantSidebarOverlay';
  const STYLES_ID        = 'pasajeMerchantSidebarStyles';
  const TOPBAR_MOUNT_ID  = 'merchantSidebar';
  const ACTIVE_STORE_KEY = 'activeStoreId';
  const SECTION_STATE_KEY = 'pasaje_merchant_sidebar_sections';

  const ROOT    = '../../';  // hacia la raíz del proyecto
  const TIENDAS = '../';     // hacia /tiendas/
  const PUBLIC_STORE_FALLBACK = '../productos.html';

  let badgeChannel = null;
  let badgeDebounce = null;
  let currentStore = null;
  let currentUser  = null;

  // -----------------------------------------------------------
  // ESTRUCTURA DEL MENÚ
  // -----------------------------------------------------------
  const SECTIONS = [
    {
      id: 'ops',
      title: 'Operación',
      openByDefault: true,
      items: [
        { key: 'index',     label: 'Resumen General',    href: 'index.html',     icon: '📊' },
        { key: 'pedidos',   label: 'Buzón de Pedidos',   href: 'pedidos.html',   icon: '🛍️', badge: 'pedidos' },
        { key: 'productos', label: 'Gestor de Catálogo', href: 'productos.html', icon: '📦' }
      ]
    },
    {
      id: 'growth',
      title: 'Crecimiento',
      openByDefault: true,
      items: [
        { key: 'cupones',  label: 'Cupones',   href: 'cupones.html',  icon: '🎟️' },
        { key: 'clientes', label: 'Clientes',  href: 'clientes.html', icon: '👥' },
        { key: 'metricas', label: 'Analítica', href: 'metricas.html', icon: '📈' }
      ]
    },
    {
      id: 'store',
      title: 'Mi Tienda',
      openByDefault: true,
      items: [
        { key: 'tiendas', label: 'Configuración', href: 'tiendas.html', icon: '⚙️' }
      ]
    }
  ];

  // -----------------------------------------------------------
  // UTILS
  // -----------------------------------------------------------
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function idEq(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b);
  }

  function getCurrentPage() {
    return window.location.pathname.split('/').pop() || '';
  }

  function client() {
    return window._supabase ||
      (typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null);
  }

  // -----------------------------------------------------------
  // SECTION STATE (persistencia acordeón)
  // -----------------------------------------------------------
  function getSectionState() {
    try { return JSON.parse(localStorage.getItem(SECTION_STATE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveSectionState(state) {
    try { localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function isSectionOpen(id, defaultOpen) {
    const st = getSectionState();
    return Object.prototype.hasOwnProperty.call(st, id) ? !!st[id] : !!defaultOpen;
  }

  // -----------------------------------------------------------
  // STYLES
  // -----------------------------------------------------------
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
        top: 0; bottom: 0; left: 0;
        z-index: 60;
        width: 17rem;
        max-width: 86vw;
        display: flex;
        flex-direction: column;
        transform: translateX(-100%);
        transition: transform .3s cubic-bezier(.16, 1, .3, 1);
        background-color: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(22px) saturate(180%);
        -webkit-backdrop-filter: blur(22px) saturate(180%);
        color: #0f172a;
        border-right: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
      #${SIDEBAR_ID}.open { transform: translateX(0); }

      body.pasaje-merchant-sidebar-open { overflow: hidden; }

      #${OVERLAY_ID} {
        position: fixed; inset: 0; z-index: 55;
        background-color: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        opacity: 0;
        pointer-events: none;
        transition: opacity .3s ease;
      }
      #${OVERLAY_ID}.open {
        opacity: 1;
        pointer-events: auto;
      }

      #${SIDEBAR_ID} .merchant-nav-link {
        display: flex;
        align-items: center;
        gap: .75rem;
        padding: .6rem .875rem;
        border-radius: .875rem;
        font-size: .8125rem;
        font-weight: 600;
        color: #1e293b;
        text-decoration: none !important;
        transition: all .15s ease;
        border-left: 4px solid transparent;
      }
      #${SIDEBAR_ID} .merchant-nav-link:hover {
        background: rgba(79, 70, 229, 0.10);
        color: #4f46e5;
        transform: translateX(2px);
      }
      #${SIDEBAR_ID} .merchant-nav-link.active {
        background: rgba(79, 70, 229, 0.15);
        color: #4f46e5;
        border-left-color: #4f46e5;
        font-weight: 800;
      }
      #${SIDEBAR_ID} .merchant-nav-badge {
        margin-left: auto;
        font-size: 10px;
        font-weight: 800;
        background: #ef4444;
        color: #fff;
        padding: 2px 7px;
        border-radius: 999px;
        box-shadow: 0 2px 6px -2px rgba(239,68,68,.6);
      }
      #${SIDEBAR_ID} .merchant-scroll::-webkit-scrollbar { width: 4px; }
      #${SIDEBAR_ID} .merchant-scroll::-webkit-scrollbar-thumb {
        background-color: rgba(148,163,184,.3);
        border-radius: 9999px;
      }
      #${SIDEBAR_ID} .merchant-chevron.rotated { transform: rotate(180deg); }
      #${SIDEBAR_ID} .merchant-chevron { transition: transform .2s ease; }

      .merchant-topbar {
        background-color: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(16px) saturate(160%);
        -webkit-backdrop-filter: blur(16px) saturate(160%);
        color: #ffffff;
        border-bottom: 1px solid rgba(255, 255, 255, 0.10);
      }

      @media (min-width: 1024px) {
        body.pasaje-has-merchant-sidebar { padding-left: 17rem !important; }
        body.pasaje-has-merchant-sidebar #${SIDEBAR_ID} { transform: translateX(0) !important; box-shadow: none !important; }
        body.pasaje-has-merchant-sidebar #${OVERLAY_ID} { display: none !important; }
      }
    `;
  }

  // -----------------------------------------------------------
  // AVATAR
  // -----------------------------------------------------------
  function storeAvatarHTML(store, sizeCls, textCls) {
    const raw = (store && store.name) ? String(store.name).trim() : '?';
    const initial = escapeHtml((raw.charAt(0) || '?').toUpperCase());
    if (store && store.logo_url) {
      return `<img src="${escapeHtml(store.logo_url)}" alt="" class="${sizeCls} rounded-full object-cover flex-shrink-0 border border-white/40 shadow-sm">`;
    }
    return `<div class="${sizeCls} rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-extrabold flex-shrink-0 shadow-sm ${textCls}">${initial}</div>`;
  }

  // -----------------------------------------------------------
  // RENDER — TOPBAR
  // -----------------------------------------------------------
  function renderTopbar(user, store) {
    return `
      <header class="merchant-topbar shadow-lg sticky top-0 z-40">
        <div class="px-4 py-3 flex justify-between items-center gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <button type="button" id="${SIDEBAR_ID}Open"
              class="lg:hidden bg-white/10 hover:bg-white/20 p-2 rounded-xl transition flex-shrink-0"
              aria-label="Abrir menú">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <a href="${ROOT}index.html" class="text-lg font-extrabold truncate">
              Pasaje <span class="text-indigo-400">Tiendas</span>
            </a>
            ${store ? `<span class="hidden sm:inline text-xs opacity-80 truncate max-w-[180px]">· ${escapeHtml(store.name)}</span>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <a href="${TIENDAS}productos.html"
               class="hidden sm:inline-block text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-semibold transition">
              🛍️ Catálogo
            </a>
            <a href="${ROOT}index.html"
               class="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-semibold transition">
              🏠 Inicio
            </a>
          </div>
        </div>
      </header>
    `;
  }

  // -----------------------------------------------------------
  // RENDER — STORE SWITCHER
  // -----------------------------------------------------------
  function renderStoreSwitcher(store, stores) {
    if (!stores || stores.length === 0 || !store) return '';

    if (stores.length === 1) {
      return `
        <div class="px-3 pt-2 pb-2 flex-shrink-0">
          <div class="flex items-center gap-3 p-2 rounded-2xl bg-black/5 border border-black/10 shadow-sm">
            ${storeAvatarHTML(store, 'w-9 h-9', 'text-xs')}
            <div class="min-w-0 flex-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Tienda activa</div>
              <div class="text-xs font-bold truncate">${escapeHtml(store.name)}</div>
            </div>
          </div>
        </div>`;
    }

    const items = stores.map(s => {
      const isActive = idEq(s.id, store.id);
      return `
        <button type="button" data-store-id="${escapeHtml(s.id)}"
          class="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-black/5 transition ${isActive ? 'bg-black/10' : ''}">
          ${storeAvatarHTML(s, 'w-7 h-7', 'text-xs')}
          <span class="flex-1 truncate text-left text-xs font-semibold">${escapeHtml(s.name)}</span>
          ${isActive ? '<span class="text-emerald-500 text-sm font-bold">✓</span>' : ''}
        </button>`;
    }).join('');

    return `
      <div class="px-3 pt-2 pb-2 flex-shrink-0">
        <details class="group">
          <summary class="cursor-pointer select-none">
            <div class="flex items-center gap-3 p-2 rounded-2xl bg-black/5 hover:bg-black/10 border border-black/10 shadow-sm transition-all">
              ${storeAvatarHTML(store, 'w-9 h-9', 'text-xs')}
              <div class="min-w-0 flex-1">
                <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Tienda activa</div>
                <div class="text-xs font-bold truncate">${escapeHtml(store.name)}</div>
              </div>
              <svg class="w-4 h-4 opacity-50 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </summary>
          <div class="mt-2 rounded-2xl bg-white/95 text-slate-900 border border-black/10 shadow-xl p-1.5">
            <div class="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Tus tiendas (${stores.length})</div>
            ${items}
          </div>
        </details>
      </div>`;
  }

  // -----------------------------------------------------------
  // RENDER — SECCIÓN
  // -----------------------------------------------------------
  function renderSection(section, currentPage) {
    const open = isSectionOpen(section.id, section.openByDefault);
    const itemsHTML = section.items.map(m => {
      const isActive = currentPage === m.href;
      const badgeHTML = m.badge
        ? `<span data-merchant-badge="${m.badge}" class="merchant-nav-badge hidden">0</span>`
        : '';
      return `
        <a href="${m.href}" class="merchant-nav-link ${isActive ? 'active' : ''}">
          <span class="text-base flex-shrink-0">${m.icon}</span>
          <span class="truncate">${escapeHtml(m.label)}</span>
          ${badgeHTML}
        </a>`;
    }).join('');

    return `
      <section data-acc-section="${section.id}" class="mb-1">
        <button type="button" data-acc-toggle="${section.id}"
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-black/5 transition">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(section.title)}</span>
          <svg class="merchant-chevron w-3.5 h-3.5 ${open ? '' : 'rotated'}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="pasaje-section-body ${open ? '' : 'hidden'}">
          <div class="space-y-0.5 pb-1">${itemsHTML}</div>
        </div>
      </section>`;
  }

  // -----------------------------------------------------------
  // RENDER — SIDEBAR COMPLETO
  // -----------------------------------------------------------
  function renderSidebar(user, store, stores) {
    const current = getCurrentPage();
    const sectionsHTML = SECTIONS.map(sec => renderSection(sec, current)).join('');

    const publicStoreHref = (store && store.slug)
      ? `${TIENDAS}tienda.html?slug=${encodeURIComponent(store.slug)}`
      : PUBLIC_STORE_FALLBACK;

    return `
      <aside id="${SIDEBAR_ID}" class="merchant-scroll">
        <div class="flex items-center justify-between px-4 py-4 border-b border-black/10 flex-shrink-0">
          <a href="index.html" class="flex items-center gap-2 min-w-0">
            <span class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center text-white text-lg shadow-sm flex-shrink-0">🛍️</span>
            <div class="leading-tight min-w-0">
              <div class="font-extrabold text-sm truncate">Panel Comercio</div>
              <div class="text-[10px] opacity-70 font-medium truncate">Pasaje Tiendas</div>
            </div>
          </a>
          <button type="button" id="${SIDEBAR_ID}Close"
            class="lg:hidden bg-black/10 hover:bg-black/20 w-8 h-8 rounded-xl flex items-center justify-center transition flex-shrink-0 font-bold text-xs">✕</button>
        </div>

        <div class="px-3 pt-2 pb-1 flex-shrink-0 space-y-1">
          <a href="${TIENDAS}productos.html"
             class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold bg-black/5 hover:bg-black/10 border border-black/10 transition shadow-sm !text-indigo-600 no-underline">
            <span class="text-base">🛍️</span><span>Catálogo Público</span>
          </a>
          <a href="${publicStoreHref}"
             class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-300/40 transition shadow-sm !text-emerald-700 no-underline">
            <span class="text-base">🌐</span><span>Ver mi Tienda Pública</span>
          </a>
        </div>

        ${renderStoreSwitcher(store, stores)}

        <nav class="flex-1 overflow-y-auto px-2 py-1">${sectionsHTML}</nav>

        <div class="border-t border-black/10 flex-shrink-0 bg-black/5">
          <div class="px-4 py-2 text-[11px] opacity-70 truncate">${escapeHtml(user && user.email ? user.email : '')}</div>
          <button id="merchantLogoutBtn"
            class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold !text-red-500 hover:bg-red-500/10 transition border-t border-black/10">
            <span class="text-lg">🚪</span><span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <div id="${OVERLAY_ID}" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] lg:hidden"></div>
    `;
  }

  // -----------------------------------------------------------
  // OPEN / CLOSE
  // -----------------------------------------------------------
  function openSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    const ov = document.getElementById(OVERLAY_ID);
    if (!el || !ov) return;
    ov.classList.remove('hidden');
    // Force reflow para que la transición se ejecute
    void ov.offsetWidth;
    ov.classList.add('open');
    el.classList.add('open');
    document.body.classList.add('pasaje-merchant-sidebar-open');
  }

  function closeSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    const ov = document.getElementById(OVERLAY_ID);
    if (!el || !ov) return;
    ov.classList.remove('open');
    setTimeout(() => ov.classList.add('hidden'), 250);
    el.classList.remove('open');
    document.body.classList.remove('pasaje-merchant-sidebar-open');
  }

  function toggleSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    if (!el) return;
    if (el.classList.contains('open')) closeSidebar(); else openSidebar();
  }

  // -----------------------------------------------------------
  // BADGES
  // -----------------------------------------------------------
  function setBadge(name, count) {
    const el = document.querySelector(`[data-merchant-badge="${name}"]`);
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

  async function refreshNavBadges() {
    const c = client();
    if (!c || !currentStore || !currentStore.id) return;

    try {
      const { count, error } = await c
        .from('cart_orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', currentStore.id)
        .in('status', ['new', 'sent']);
      if (!error) setBadge('pedidos', count || 0);
    } catch (e) { /* silencioso */ }
  }

  function subscribeBadges() {
    const c = client();
    if (!c || !currentStore || !currentStore.id) return;
    try {
      if (badgeChannel) c.removeChannel(badgeChannel);
      badgeChannel = c
        .channel(`merchant_badges_${currentStore.id}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'cart_orders', filter: `store_id=eq.${currentStore.id}` },
          () => {
            if (badgeDebounce) clearTimeout(badgeDebounce);
            badgeDebounce = setTimeout(refreshNavBadges, 250);
          })
        .subscribe();
    } catch (e) { /* silencioso */ }
  }

  // -----------------------------------------------------------
  // ACCORDION
  // -----------------------------------------------------------
  function bindAccordion() {
    document.querySelectorAll(`#${SIDEBAR_ID} [data-acc-toggle]`).forEach(btn => {
      if (btn.dataset.accBound) return;
      btn.dataset.accBound = '1';
      btn.addEventListener('click', () => {
        const id = btn.dataset.accToggle;
        const section = btn.closest('[data-acc-section]');
        if (!section) return;
        const body = section.querySelector('.pasaje-section-body');
        const chev = btn.querySelector('svg');
        const willOpen = body.classList.contains('hidden');
        body.classList.toggle('hidden', !willOpen);
        if (chev) chev.classList.toggle('rotated', !willOpen);
        const st = getSectionState();
        st[id] = willOpen;
        saveSectionState(st);
      });
    });
  }

  // -----------------------------------------------------------
  // EVENTS
  // -----------------------------------------------------------
  function bindEvents() {
    const openBtn  = document.getElementById(`${SIDEBAR_ID}Open`);
    const closeBtn = document.getElementById(`${SIDEBAR_ID}Close`);
    const overlay  = document.getElementById(OVERLAY_ID);

    if (openBtn)  openBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay)  overlay.addEventListener('click', closeSidebar);

    document.querySelectorAll('[data-store-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        try { localStorage.setItem(ACTIVE_STORE_KEY, String(btn.dataset.storeId)); } catch (e) {}
        window.location.reload();
      });
    });

    const logoutBtn = document.getElementById('merchantLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          const c = client();
          if (c) await c.auth.signOut();
        } catch (e) { /* noop */ }
        try { localStorage.removeItem(ACTIVE_STORE_KEY); } catch (e) {}
        closeSidebar();
        window.location.replace(`${ROOT}login.html`);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });
  }

  // -----------------------------------------------------------
  // INIT
  // -----------------------------------------------------------
  async function initMerchantNav(ctx) {
    if (!ctx || !ctx.user) return;

    currentUser  = ctx.user;
    currentStore = ctx.store || null;

    injectStyles();

    // Topbar
    const topbarMount = document.getElementById(TOPBAR_MOUNT_ID);
    if (topbarMount) {
      topbarMount.innerHTML = renderTopbar(currentUser, currentStore);
    }

    // Sidebar
    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();
    document.body.insertAdjacentHTML('beforeend', renderSidebar(currentUser, currentStore, ctx.stores || []));
    document.body.classList.add('pasaje-has-merchant-sidebar');

    bindAccordion();
    bindEvents();

    await refreshNavBadges();
    subscribeBadges();

    window.addEventListener('focus', () => refreshNavBadges());
    window.__pasajeRefreshMerchantBadges = () => refreshNavBadges();
  }

  window.initMerchantNav        = initMerchantNav;
  window.toggleMerchantSidebar  = toggleSidebar;
})();
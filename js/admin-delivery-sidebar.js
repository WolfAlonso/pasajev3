// =============================================================
// js/admin-delivery-sidebar.js
// Sidebar exclusivo del Administrador de Flota Delivery
// Pensado para: /admin/admin-delivery.html y subpáginas
// =============================================================

(function () {
  'use strict';

  const ROOT              = '../';
  const SIDEBAR_ID        = 'pasajeAdminDeliverySidebar';
  const OVERLAY_ID        = 'pasajeAdminDeliverySidebarOverlay';
  const STYLES_ID         = 'pasajeAdminDeliverySidebarStyles';
  const SECTION_STATE_KEY = 'pasaje_admin_delivery_sections';

  const SECTIONS = [
    {
      id: 'fleet_overview',
      title: 'Flota y Operación',
      openByDefault: true,
      items: [
        { key: 'panel-general',  label: 'Panel General',           href: 'admin-delivery.html',            icon: '📊' },
        { key: 'live-map',       label: 'Mapa de Flota en Vivo',   href: 'admin-delivery-mapa.html',       icon: '🗺️', badge: 'live' },
        { key: 'drivers',        label: 'Gestión de Pilotos',      href: 'admin-delivery-drivers.html',    icon: '🛵' }
      ]
    },
    {
      id: 'requests_admin',
      title: 'Solicitudes y Cupones',
      openByDefault: true,
      items: [
        { key: 'requests-feed',  label: 'Solicitudes Activas',     href: 'admin-delivery-requests.html',   icon: '📡', badge: 'requests' },
        { key: 'coupons-express',label: 'Cupones Express',         href: 'admin-delivery-cupones.html',    icon: '🏷️' },
        { key: 'pricing',        label: 'Tarifas y Configuración', href: 'admin-config-modulos.html',      icon: '⚙️' }
      ]
    },
    {
      id: 'audit_fleet',
      title: 'Auditoría',
      openByDefault: false,
      items: [
        { key: 'audit-pending',  label: 'Disputas Pendientes',     href: 'admin-usuarios.html#auditoria',  icon: '⚠️', badge: 'audit' },
        { key: 'audit-history',  label: 'Historial de Sanciones',  href: 'admin-usuarios.html#historial',  icon: '📜' }
      ]
    },
    {
      id: 'system_fleet',
      title: 'Sistema',
      openByDefault: false,
      items: [
        { key: 'admin-main',     label: 'Volver al Admin Global',  href: 'admin.html',                     icon: '🛡️' },
        { key: 'public-express', label: 'Ver Portal Express',      href: '../delivery.html',               icon: '🌐' }
      ]
    }
  ];

  function getCurrentPage() {
    return window.location.pathname.split('/').pop() || '';
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  function injectStyles() {
    let s = document.getElementById(STYLES_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLES_ID;
      document.head.appendChild(s);
    }

    s.textContent = `
      #${SIDEBAR_ID} {
        transition: transform .3s cubic-bezier(.2,.7,.2,1), background-color .2s, color .2s;
        background-color: var(--adm-delivery-bg, rgba(var(--adm-sidebar-tint-rgb, 15, 23, 42), var(--adm-sidebar-opacity, 0.9))) !important;
        backdrop-filter: blur(var(--adm-sidebar-blur, 20px)) saturate(160%) !important;
        -webkit-backdrop-filter: blur(var(--adm-sidebar-blur, 20px)) saturate(160%) !important;
        color: var(--adm-sidebar-text, #cbd5e1) !important;
        border-right: 1px solid rgba(148, 163, 184, 0.25);
      }

      #${SIDEBAR_ID} a,
      #${SIDEBAR_ID} button,
      #${SIDEBAR_ID} span,
      #${SIDEBAR_ID} p,
      #${SIDEBAR_ID} div {
        text-decoration: none !important;
      }

      #${SIDEBAR_ID}.open { transform: translateX(0) !important; }
      body.pasaje-admin-delivery-sidebar-open { overflow: hidden; }

      #${SIDEBAR_ID} .delivery-nav-link {
        transition: background .15s ease, color .15s ease, border .15s ease;
        text-decoration: none !important;
        border-radius: 0.75rem !important;
        border: none !important;
        border-left: 5px solid transparent !important;
        color: var(--adm-sidebar-text, #cbd5e1) !important;
      }

      #${SIDEBAR_ID} .delivery-nav-link * {
        color: inherit !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .delivery-nav-link:hover {
        background: color-mix(in srgb, #14b8a6 12%, transparent) !important;
        color: #5eead4 !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .delivery-nav-link:hover * {
        color: #5eead4 !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .delivery-nav-link.active {
        background: color-mix(in srgb, #14b8a6 22%, transparent) !important;
        color: #5eead4 !important;
        border-left: 5px solid #14b8a6 !important;
        font-weight: 800 !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .delivery-nav-link.active * {
        color: #5eead4 !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .delivery-section-title {
        opacity: 0.75;
      }

      #${SIDEBAR_ID} .delivery-section-body {
        display: grid;
        grid-template-rows: 1fr;
        transition: grid-template-rows .3s ease, opacity .2s ease;
        opacity: 1;
      }
      #${SIDEBAR_ID} .delivery-section-body > .delivery-section-inner {
        overflow: hidden;
        min-height: 0;
      }
      #${SIDEBAR_ID} .delivery-section-body.collapsed {
        grid-template-rows: 0fr;
        opacity: 0;
      }

      #${SIDEBAR_ID} .delivery-chevron {
        transition: transform .25s ease;
        opacity: 0.7;
      }
      #${SIDEBAR_ID} .delivery-chevron.rotated {
        transform: rotate(180deg);
      }

      #${SIDEBAR_ID} .delivery-badge {
        margin-left: auto;
        font-size: 10px; font-weight: 800;
        padding: 2px 7px; border-radius: 999px;
        animation: delBadgePulse 2s ease-in-out infinite;
      }
      @keyframes delBadgePulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: .55; }
      }

      @media (min-width: 1024px) {
        body.pasaje-has-admin-delivery-sidebar {
          padding-left: 17rem !important;
        }
        body.pasaje-has-admin-delivery-sidebar #${SIDEBAR_ID} {
          transform: translateX(0) !important;
        }
        body.pasaje-has-admin-delivery-sidebar #${OVERLAY_ID} {
          display: none !important;
        }
        #${SIDEBAR_ID}CloseBtn { display: none !important; }
        #adminDeliverySidebarToggleBtn { display: none !important; }
      }
    `;
  }

  function renderSection(section, currentPage) {
    const open = isSectionOpen(section.id, section.openByDefault);

    const itemsHTML = section.items.map(m => {
      const cleanHref = m.href.replace('../', '');
      const isActive = currentPage === cleanHref.split('#')[0];
      const badgeHTML = m.badge
        ? `<span data-delivery-badge="${m.badge}"
              class="delivery-badge hidden bg-red-500 text-white">0</span>`
        : '';

      const fullHref = m.href.startsWith('http') ? m.href : (m.href.startsWith('../') ? m.href : ROOT + m.href);

      return `
        <a href="${fullHref}"
           class="delivery-nav-link flex items-center gap-3 pl-3 pr-2 py-2 rounded-r-xl text-sm ${isActive ? 'active' : ''}">
          <span class="text-lg flex-shrink-0">${m.icon}</span>
          <span class="truncate">${escapeHtml(m.label)}</span>
          ${badgeHTML}
        </a>
      `;
    }).join('');

    return `
      <section data-delivery-acc-section="${section.id}" class="mb-1">
        <button type="button" data-delivery-acc-toggle="${section.id}"
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl transition hover:bg-black/10">
          <span class="delivery-section-title text-[10px] font-bold uppercase tracking-wider">${escapeHtml(section.title)}</span>
          <svg class="delivery-chevron w-3.5 h-3.5 ${open ? '' : 'rotated'}"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="delivery-section-body ${open ? '' : 'collapsed'}">
          <div class="delivery-section-inner">
            <div class="space-y-0.5 pb-1">${itemsHTML}</div>
          </div>
        </div>
      </section>
    `;
  }

  function renderSidebar(user) {
    const current = getCurrentPage();
    const sectionsHTML = SECTIONS.map(sec => renderSection(sec, current)).join('');

    return `
      <aside id="${SIDEBAR_ID}"
        class="fixed inset-y-0 left-0 z-[60] w-[17rem] flex flex-col shadow-2xl"
        style="transform: translateX(-100%);">

        <div class="flex items-center justify-between px-4 py-3 border-b border-black/10 flex-shrink-0">
          <a href="admin-delivery.html" class="flex items-center gap-2 min-w-0">
            <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center text-white text-lg shadow-sm">🛵</span>
            <div class="leading-tight min-w-0">
              <div class="font-extrabold text-sm truncate">
                Flota <span class="text-teal-400">Express</span>
              </div>
              <div class="text-[10px] opacity-70 font-medium truncate">Consola de Repartos</div>
            </div>
          </a>
          <button type="button" id="${SIDEBAR_ID}CloseBtn"
            class="lg:hidden bg-black/10 hover:bg-black/20 w-8 h-8 rounded-xl flex items-center justify-center transition flex-shrink-0 font-bold text-xs">
            ✕
          </button>
        </div>

        <!-- Ir al portal público de Express -->
        <div class="px-3 pt-3 pb-1 flex-shrink-0 space-y-1.5">
          <a href="${ROOT}delivery.html"
             class="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold bg-teal-500/15 hover:bg-teal-500/25 border border-teal-400/20 transition shadow-sm !text-teal-300 no-underline">
            <span class="text-base">🌐</span>
            <span>Ver Portal Express</span>
          </a>
          <a href="admin.html"
             class="w-full flex items-center justify-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-black/10 hover:bg-black/20 border border-black/10 transition !text-slate-300 no-underline">
            <span class="text-base">🛡️</span>
            <span>Admin Global</span>
          </a>
        </div>

        <nav class="flex-1 overflow-y-auto px-2 py-2">
          ${sectionsHTML}
        </nav>

        <div class="border-t border-black/10 flex-shrink-0 bg-black/5">
          <div class="px-4 py-2 text-[11px] opacity-70 truncate">
            ${escapeHtml(user.email || '')}
          </div>
          <button id="adminDeliveryLogoutBtn"
            class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold !text-red-400 hover:bg-red-500/10 transition border-t border-black/10">
            <span class="text-lg">🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div id="${OVERLAY_ID}"
        class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden"></div>
    `;
  }

  function renderTopbar(user) {
    return `
      <header class="glass-header text-white shadow-lg sticky top-0 z-40 border-b border-white/10">
        <div class="px-4 py-3 flex justify-between items-center gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <button type="button" id="adminDeliverySidebarToggleBtn"
              class="lg:hidden bg-white/10 hover:bg-white/20 p-2 rounded-lg transition flex-shrink-0"
              aria-label="Abrir menú">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h1 class="text-lg font-extrabold truncate">
              Flota <span class="text-teal-400">Express</span> <span class="text-slate-300 text-xs font-semibold">· Admin</span>
            </h1>
          </div>

          <div class="flex items-center gap-2">
            <span class="hidden sm:inline text-xs opacity-80 truncate max-w-[180px]">${escapeHtml(user.email || '')}</span>
            <a href="${ROOT}delivery.html"
               class="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-semibold transition">
              🌐 Portal
            </a>
          </div>
        </div>
      </header>
    `;
  }

  function openSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    const ov = document.getElementById(OVERLAY_ID);
    if (!el || !ov) return;
    ov.classList.remove('hidden');
    el.classList.add('open');
    el.style.transform = 'translateX(0)';
    document.body.classList.add('pasaje-admin-delivery-sidebar-open');
  }

  function closeSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    const ov = document.getElementById(OVERLAY_ID);
    if (!el || !ov) return;
    ov.classList.add('hidden');
    el.classList.remove('open');
    el.style.transform = 'translateX(-100%)';
    document.body.classList.remove('pasaje-admin-delivery-sidebar-open');
  }

  function toggleSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    if (!el) return;
    if (el.classList.contains('open')) closeSidebar();
    else openSidebar();
  }

  function bindAccordion() {
    document.querySelectorAll(`#${SIDEBAR_ID} [data-delivery-acc-toggle]`).forEach(btn => {
      if (btn.dataset.accBound) return;
      btn.dataset.accBound = '1';
      btn.addEventListener('click', () => {
        const id = btn.dataset.deliveryAccToggle;
        const section = btn.closest('[data-delivery-acc-section]');
        if (!section) return;
        const body = section.querySelector('.delivery-section-body');
        const chevron = btn.querySelector('.delivery-chevron');
        const collapsed = body.classList.toggle('collapsed');
        if (chevron) chevron.classList.toggle('rotated', collapsed);
        const state = getSectionState();
        state[id] = !collapsed;
        saveSectionState(state);
      });
    });
  }

  async function loadLiveBadge() {
    try {
      if (typeof window._supabase === 'undefined') return;

      // Pilotos activos + solicitudes pendientes
      const [driversRes, requestsRes] = await Promise.all([
        window._supabase
          .from('delivery_drivers')
          .select('id', { count: 'exact', head: true })
          .eq('is_available', true),
        window._supabase
          .from('delivery_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'counter_offered'])
      ]);

      const liveBadge = document.querySelector('[data-delivery-badge="live"]');
      if (liveBadge) {
        const n = driversRes.count ?? 0;
        if (n === 0) { liveBadge.classList.add('hidden'); }
        else {
          liveBadge.textContent = n;
          liveBadge.classList.remove('hidden');
          liveBadge.className = 'delivery-badge bg-emerald-500 text-white';
        }
      }

      const reqBadge = document.querySelector('[data-delivery-badge="requests"]');
      if (reqBadge) {
        const n = requestsRes.count ?? 0;
        if (n === 0) { reqBadge.classList.add('hidden'); }
        else {
          reqBadge.textContent = n;
          reqBadge.classList.remove('hidden');
          reqBadge.className = 'delivery-badge bg-amber-500 text-white';
        }
      }
    } catch (e) {
      // silencioso
    }
  }

  async function loadAuditBadge() {
    try {
      if (typeof window._supabase === 'undefined') return;

      const { count } = await window._supabase
        .from('delivery_requests')
        .select('id', { count: 'exact', head: true })
        .eq('admin_resolution', 'pending')
        .not('cancelled_at', 'is', null);

      const badge = document.querySelector('[data-delivery-badge="audit"]');
      if (!badge) return;

      const n = count ?? 0;
      if (n === 0) {
        badge.classList.add('hidden');
      } else {
        badge.textContent = n;
        badge.classList.remove('hidden');
        badge.className = 'delivery-badge bg-rose-500 text-white';
      }
    } catch (e) {
      // silencioso
    }
  }

  async function initAdminDeliveryNav({ user } = {}) {
    if (!user) {
      console.error('[AdminDeliverySidebar] user requerido');
      return;
    }

    injectStyles();

    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();

    document.body.insertAdjacentHTML('beforeend', renderSidebar(user));
    document.body.classList.add('pasaje-has-admin-delivery-sidebar');

    const headerMount = document.getElementById('adminHeader');
    if (headerMount) {
      headerMount.innerHTML = renderTopbar(user);
    } else {
      document.body.insertAdjacentHTML('afterbegin', renderTopbar(user));
    }

    const tabsMount = document.getElementById('adminTabs');
    if (tabsMount) tabsMount.innerHTML = '';

    const openBtn  = document.getElementById('adminDeliverySidebarToggleBtn');
    const closeBtn = document.getElementById(`${SIDEBAR_ID}CloseBtn`);
    const overlay  = document.getElementById(OVERLAY_ID);

    if (openBtn)  openBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay)  overlay.addEventListener('click', closeSidebar);

    bindAccordion();

    const logoutBtn = document.getElementById('adminDeliveryLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await window._supabase.auth.signOut(); } catch (e) { /* silencioso */ }
        window.location.replace(ROOT + 'login.html');
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    loadLiveBadge();
    loadAuditBadge();

    if (window.PasajeRealtime) {
      const debounced = window.PasajeRealtime.debounce(() => {
        loadLiveBadge();
        loadAuditBadge();
      }, 600);

      window.PasajeRealtime.subscribeToTable(
        'admin_delivery_sidebar_requests',
        'delivery_requests',
        null,
        debounced
      );
      window.PasajeRealtime.subscribeToTable(
        'admin_delivery_sidebar_drivers',
        'delivery_drivers',
        null,
        debounced
      );
    }
  }

  window.initAdminDeliveryNav     = initAdminDeliveryNav;
  window.initAdminDeliverySidebar = initAdminDeliveryNav;
  window.toggleAdminDeliverySidebar = toggleSidebar;

  window.addEventListener('pasaje:theme-applied', () => { injectStyles(); });
})();
// =============================================================
// js/admin-sidebar.js
// Sidebar administrativo dinámico con botón "Ir al Catálogo" superior.
// =============================================================

(function () {
  'use strict';

  const ROOT              = '../';
  const SIDEBAR_ID        = 'pasajeAdminSidebar';
  const OVERLAY_ID        = 'pasajeAdminSidebarOverlay';
  const SECTION_STATE_KEY = 'pasaje_admin_sidebar_sections';

  const SECTIONS = [
    {
      id: 'diseno_web',
      title: '🎨 Diseño de la Web',
      openByDefault: true,
      items: [
        { key: 'diseno-temas', label: 'Presets y Temáticas', href: 'admin-diseno.html',           icon: '🎭' },
        { key: 'diseno-comp',  label: 'Componentes y Cards', href: 'admin-diseno-componentes.html', icon: '🎴' },
        { key: 'diseno-efec',  label: 'Efectos y Liquid',    href: 'admin-diseno-efectos.html',     icon: '✨' },
        { key: 'sidebars',     label: 'Diseño de Sidebars',  href: 'admin-diseno-sidebars.html',  icon: '🪟' }
      ]
    },
    {
      id: 'principal',
      title: 'Principal',
      openByDefault: true,
      items: [
        { key: 'resumen',   label: 'Resumen Global', href: 'admin-resumen.html',   icon: '📈' },
        { key: 'analitica', label: 'Analítica',      href: 'admin-analitica.html', icon: '📊' }
      ]
    },
    {
      id: 'moderation',
      title: 'Moderación',
      openByDefault: true,
      items: [
        { key: 'reportes', label: 'Moderación y Reportes', href: 'admin-reportes.html', icon: '🚨', badge: 'reportes' },
        { key: 'pedidos',  label: 'Pedidos',               href: 'admin-pedidos.html',  icon: '🛒', badge: 'pedidos' }
      ]
    },
    {
      id: 'catalog',
      title: 'Catálogo',
      openByDefault: true,
      items: [
        { key: 'tiendas',    label: 'Gestión de Tiendas', href: 'admin-tiendas.html',    icon: '🏪' },
        { key: 'productos',  label: 'Catálogo Global',    href: 'admin-productos.html',  icon: '🛍️' },
        { key: 'categorias', label: 'Categorías',         href: 'admin-categorias.html', icon: '🏷️' }
      ]
    },
    {
      id: 'system',
      title: 'Sistema',
      openByDefault: false,
      items: [
        { key: 'storage',  label: 'Archivos y Storage', href: 'admin-storage.html',  icon: '📁' },
        { key: 'usuarios', label: 'Usuarios y Roles',   href: 'admin-usuarios.html', icon: '👤' }
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
    let s = document.getElementById('pasajeAdminSidebarStyles');
    if (!s) {
      s = document.createElement('style');
      s.id = 'pasajeAdminSidebarStyles';
      document.head.appendChild(s);
    }

    s.textContent = `
      #${SIDEBAR_ID} {
        transition: transform .3s cubic-bezier(.2,.7,.2,1), background-color .2s, color .2s;
        background-color: var(--adm-sidebar-bg, rgba(var(--adm-sidebar-tint-rgb, 15, 23, 42), var(--adm-sidebar-opacity, 0.85))) !important;
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
      body.pasaje-admin-sidebar-open { overflow: hidden; }

      #${SIDEBAR_ID} .pasaje-nav-link {
        transition: background .15s ease, color .15s ease, border .15s ease;
        text-decoration: none !important;
        border-radius: 0.75rem !important;
        border: none !important;
        border-left: 5px solid transparent !important;
        color: var(--adm-sidebar-text, #cbd5e1) !important;
      }

      #${SIDEBAR_ID} .pasaje-nav-link * {
        color: inherit !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .pasaje-nav-link:hover {
        background: color-mix(in srgb, var(--adm-sidebar-active, #f59e0b) 10%, transparent) !important;
        color: var(--adm-sidebar-active, #f59e0b) !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .pasaje-nav-link:hover * {
        color: var(--adm-sidebar-active, #f59e0b) !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .pasaje-nav-link.active {
        background: color-mix(in srgb, var(--adm-sidebar-active, #f59e0b) 18%, transparent) !important;
        color: var(--adm-sidebar-active, #f59e0b) !important;
        border-left: 5px solid var(--adm-sidebar-active, #f59e0b) !important;
        font-weight: 800 !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .pasaje-nav-link.active * {
        color: var(--adm-sidebar-active, #f59e0b) !important;
        text-decoration: none !important;
      }

      #${SIDEBAR_ID} .pasaje-section-title {
        opacity: 0.75;
      }

      #${SIDEBAR_ID} .pasaje-section-body {
        display: grid;
        grid-template-rows: 1fr;
        transition: grid-template-rows .3s ease, opacity .2s ease;
        opacity: 1;
      }
      #${SIDEBAR_ID} .pasaje-section-body > .pasaje-section-inner {
        overflow: hidden;
        min-height: 0;
      }
      #${SIDEBAR_ID} .pasaje-section-body.collapsed {
        grid-template-rows: 0fr;
        opacity: 0;
      }

      #${SIDEBAR_ID} .pasaje-chevron {
        transition: transform .25s ease;
        opacity: 0.7;
      }
      #${SIDEBAR_ID} .pasaje-chevron.rotated {
        transform: rotate(180deg);
      }

      @media (min-width: 1024px) {
        body.pasaje-has-admin-sidebar {
          padding-left: 17rem !important;
        }
        body.pasaje-has-admin-sidebar #${SIDEBAR_ID} {
          transform: translateX(0) !important;
        }
        body.pasaje-has-admin-sidebar #${OVERLAY_ID} {
          display: none !important;
        }
      }
    `;
  }

  function renderSection(section, currentPage) {
    const open = isSectionOpen(section.id, section.openByDefault);
    const itemsHTML = section.items.map(m => {
      const isActive = currentPage === m.href;
      const badgeHTML = m.badge
        ? `<span data-admin-badge="${m.badge}"
              class="hidden ml-auto text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">0</span>`
        : '';
      return `
        <a href="${m.href}"
           class="pasaje-nav-link flex items-center gap-3 pl-3 pr-2 py-2 rounded-r-xl text-sm ${isActive ? 'active' : ''}">
          <span class="text-lg flex-shrink-0">${m.icon}</span>
          <span class="truncate">${escapeHtml(m.label)}</span>
          ${badgeHTML}
        </a>
      `;
    }).join('');

    return `
      <section data-acc-section="${section.id}" class="mb-1">
        <button type="button" data-acc-toggle="${section.id}"
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl transition hover:bg-black/10">
          <span class="pasaje-section-title text-[10px] font-bold uppercase tracking-wider">${escapeHtml(section.title)}</span>
          <svg class="pasaje-chevron w-3.5 h-3.5 ${open ? '' : 'rotated'}"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="pasaje-section-body ${open ? '' : 'collapsed'}">
          <div class="pasaje-section-inner">
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
          <a href="admin.html" class="flex items-center gap-2 min-w-0">
            <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-lg shadow-sm">🛡️</span>
            <div class="leading-tight min-w-0">
              <div class="font-extrabold text-sm truncate">
                Admin <span class="text-amber-400">· Altos</span>
              </div>
              <div class="text-[10px] opacity-70 font-medium truncate">Consola de control</div>
            </div>
          </a>
          <button type="button" id="${SIDEBAR_ID}Close"
            class="lg:hidden bg-black/10 hover:bg-black/20 w-8 h-8 rounded-xl flex items-center justify-center transition flex-shrink-0 font-bold text-xs">
            ✕
          </button>
        </div>

        <!-- BOTÓN IR AL CATÁLOGO (HASTA ARRIBA) -->
        <div class="px-3 pt-3 pb-1 flex-shrink-0">
          <a href="${ROOT}index.html"
             class="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold bg-black/10 hover:bg-black/20 border border-black/10 transition shadow-sm !text-amber-400 no-underline">
            <span class="text-base">🏠</span>
            <span>Ir al Catálogo Público</span>
          </a>
        </div>

        <nav class="flex-1 overflow-y-auto px-2 py-2">
          ${sectionsHTML}
        </nav>

        <div class="border-t border-black/10 flex-shrink-0 bg-black/5">
          <div class="px-4 py-2 text-[11px] opacity-70 truncate">
            ${escapeHtml(user.email || '')}
          </div>
          <button id="adminLogoutBtn"
            class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold !text-red-500 hover:bg-red-500/10 transition border-t border-black/10">
            <span class="text-lg">🚪</span>
            <span>Cerrar sesión Admin</span>
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
            <button type="button" id="${SIDEBAR_ID}Open"
              class="lg:hidden bg-white/10 hover:bg-white/20 p-2 rounded-lg transition flex-shrink-0"
              aria-label="Abrir menú">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h1 class="text-lg font-extrabold truncate">
              Pasaje de los Altos <span class="text-amber-400">· Admin</span>
            </h1>
          </div>

          <div class="flex items-center gap-2">
            <span class="hidden sm:inline text-xs opacity-80 truncate max-w-[180px]">${escapeHtml(user.email || '')}</span>
            <a href="${ROOT}index.html"
               class="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-semibold transition">
              ← Catálogo
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
    document.body.classList.add('pasaje-admin-sidebar-open');
  }

  function closeSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    const ov = document.getElementById(OVERLAY_ID);
    if (!el || !ov) return;
    ov.classList.add('hidden');
    el.classList.remove('open');
    el.style.transform = 'translateX(-100%)';
    document.body.classList.remove('pasaje-admin-sidebar-open');
  }

  function toggleSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    if (!el) return;
    if (el.classList.contains('open')) closeSidebar();
    else openSidebar();
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
        const state = getSectionState();
        state[id] = !collapsed;
        saveSectionState(state);
      });
    });
  }

  async function loadReportsBadge() {
    try {
      const { count, error } = await _supabase
        .from('reports').select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) return;
      const badge = document.querySelector('[data-admin-badge="reportes"]');
      if (!badge) return;
      const n = count ?? 0;
      if (n === 0) { badge.classList.add('hidden'); badge.textContent = ''; }
      else { badge.textContent = n; badge.classList.remove('hidden'); }
    } catch (e) { console.warn('[AdminSidebar] badge reportes', e); }
  }

  async function loadOrdersBadge() {
    try {
      const { count, error } = await _supabase
        .from('cart_orders').select('*', { count: 'exact', head: true })
        .eq('status', 'sent');
      if (error) return;
      const badge = document.querySelector('[data-admin-badge="pedidos"]');
      if (!badge) return;
      const n = count ?? 0;
      if (n === 0) { badge.classList.add('hidden'); badge.textContent = ''; }
      else { badge.textContent = n; badge.classList.remove('hidden'); }
    } catch (e) { console.warn('[AdminSidebar] badge pedidos', e); }
  }

  async function initAdminNav({ user } = {}) {
    if (!user) {
      console.error('[AdminSidebar] user requerido');
      return;
    }

    if (typeof adminInjectStyles === 'function') adminInjectStyles();
    injectStyles();

    document.getElementById(SIDEBAR_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();

    document.body.insertAdjacentHTML('beforeend', renderSidebar(user));
    document.body.classList.add('pasaje-has-admin-sidebar');

    const headerMount = document.getElementById('adminHeader');
    if (headerMount) {
      headerMount.innerHTML = renderTopbar(user);
    } else {
      document.body.insertAdjacentHTML('afterbegin', renderTopbar(user));
    }

    const tabsMount = document.getElementById('adminTabs');
    if (tabsMount) tabsMount.innerHTML = '';

    const openBtn  = document.getElementById(`${SIDEBAR_ID}Open`);
    const closeBtn = document.getElementById(`${SIDEBAR_ID}Close`);
    const overlay  = document.getElementById(OVERLAY_ID);

    if (openBtn)  openBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay)  overlay.addEventListener('click', closeSidebar);

    bindAccordion();

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await _supabase.auth.signOut(); } catch (e) { console.warn(e); }
        window.location.replace(ROOT + 'login.html');
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    loadReportsBadge();
    loadOrdersBadge();
  }

  window.initAdminNav       = initAdminNav;
  window.initAdminSidebar   = initAdminNav;
  window.toggleAdminSidebar = toggleSidebar;

  window.addEventListener('pasaje:theme-applied', () => { injectStyles(); });
  window.addEventListener('pasaje:sidebar-updated', () => { injectStyles(); });
  window.addEventListener('input', (e) => {
    if (e.target && e.target.id && (e.target.id.includes('sidebar') || e.target.id.includes('Sidebar') || e.target.id.includes('Color') || e.target.id.includes('Tint') || e.target.id.includes('Opacity') || e.target.id.includes('Blur'))) {
      injectStyles();
    }
  });
})();
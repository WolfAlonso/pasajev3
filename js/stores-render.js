// =============================================================
// js/stores-render.js
// Carrusel de tiendas con drag + flechas.
// Redireccionamiento directo a tienda.html (sin QuickView de tienda).
// =============================================================

(function () {
  'use strict';

  const MOUNT_SELECTOR = '#storesCarousel, [data-stores-render]';
  
  let allStores = [];
  let filteredStores = [];
  let carouselUI = null;
  let initialized = false;

  let currentZoneFilter = 'todas';
  let currentTypeFilter = 'todos';

  const XELA_ZONES = [
    'Zona 1', 'Zona 2', 'Zona 3', 'Zona 4', 'Zona 5', 
    'Zona 6', 'Zona 7', 'Zona 8', 'Zona 9', 'Zona 10', 'Zona 11', 'Interurbano'
  ];

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getMount() {
    return document.querySelector(MOUNT_SELECTOR);
  }

  function placeholder() {
    return (typeof window.PLACEHOLDER_IMG !== 'undefined' && window.PLACEHOLDER_IMG) ? window.PLACEHOLDER_IMG : '';
  }

  function renderStoreBadge(s) {
    const isPhysical = s.has_physical_store !== false;
    const zoneName = s.zone || 'Zona 1';

    if (isPhysical) {
      return `<span class="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full shadow-sm">
        📍 Local Físico - ${escapeHtml(zoneName)}
      </span>`;
    } else {
      return `<span class="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full shadow-sm">
        🛵 Venta en Línea / A Domicilio (${escapeHtml(zoneName)})
      </span>`;
    }
  }

  function injectCarouselStyles() {
    if (document.getElementById('pasajeStoresCarouselStyles')) return;
    const s = document.createElement('style');
    s.id = 'pasajeStoresCarouselStyles';
    s.textContent = `
      .pasaje-carousel-wrap { position: relative; }
      .pasaje-carousel-track {
        cursor: grab;
        user-select: none; -webkit-user-select: none; -ms-user-select: none;
        scroll-behavior: smooth;
        touch-action: pan-x;
      }
      .pasaje-carousel-track img { -webkit-user-drag: none; user-drag: none; }
      .pasaje-carousel-track.dragging { cursor: grabbing; scroll-behavior: auto; }
      .pasaje-carousel-arrow {
        display: none;
        position: absolute; top: 50%; transform: translateY(-50%);
        z-index: 10; width: 36px; height: 36px; border-radius: 999px;
        background: #fff; border: 1px solid #e5e7eb;
        box-shadow: 0 4px 14px -2px rgba(0,0,0,.15);
        align-items: center; justify-content: center;
        color: #374151; cursor: pointer;
        transition: background .15s, transform .15s;
      }
      .pasaje-carousel-arrow:hover { background: #f9fafb; }
      .pasaje-carousel-arrow:active { transform: translateY(-50%) scale(.94); }
      .pasaje-carousel-arrow.prev { left: -12px; }
      .pasaje-carousel-arrow.next { right: -12px; }
      @media (min-width: 640px) {
        .pasaje-carousel-arrow.show { display: flex; }
      }
      .pasaje-carousel-arrow[disabled] { opacity: .35; cursor: not-allowed; }
      body.user-dark-mode .pasaje-carousel-arrow {
        background: #1e293b; border-color: #334155; color: #e5e7eb;
      }
      .store-carousel-card {
        transition: transform .18s ease, box-shadow .18s ease;
        cursor: pointer;
      }
      .store-carousel-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 24px -8px rgba(0,0,0,.18);
      }
    `;
    document.head.appendChild(s);
  }

  function injectFilterBar() {
    const track = getMount();
    if (!track) return;

    let filterBar = document.getElementById('storesFilterBar');
    if (filterBar) return;

    const parent = track.parentElement;
    if (!parent) return;

    filterBar = document.createElement('div');
    filterBar.id = 'storesFilterBar';
    filterBar.className = 'flex flex-wrap items-center justify-between gap-3 mb-4 bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 shadow-sm';

    const zonesOptions = XELA_ZONES.map(z => `<option value="${z}">${z}</option>`).join('');

    filterBar.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-bold text-slate-700 flex items-center gap-1">
          <span>📍</span> Zona Xela:
        </span>
        <select id="storeZoneFilterSelect" class="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
          <option value="todas">Todas las Zonas</option>
          ${zonesOptions}
        </select>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-bold text-slate-700 flex items-center gap-1">
          <span>🏪</span> Tipo:
        </span>
        <select id="storeTypeFilterSelect" class="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
          <option value="todos">Todos los establecimientos</option>
          <option value="fisico">📍 Solo Con Local Físico</option>
          <option value="online">🛵 Solo Venta en Línea</option>
        </select>
      </div>
    `;

    parent.insertBefore(filterBar, track);

    document.getElementById('storeZoneFilterSelect')?.addEventListener('change', (e) => {
      currentZoneFilter = e.target.value;
      applyFiltersAndRender();
    });

    document.getElementById('storeTypeFilterSelect')?.addEventListener('change', (e) => {
      currentTypeFilter = e.target.value;
      applyFiltersAndRender();
    });
  }

  function applyFiltersAndRender() {
    filteredStores = allStores.filter(s => {
      const matchZone = currentZoneFilter === 'todas' || (s.zone || 'Zona 1') === currentZoneFilter;
      
      let matchType = true;
      if (currentTypeFilter === 'fisico') matchType = s.has_physical_store !== false;
      if (currentTypeFilter === 'online') matchType = s.has_physical_store === false;

      return matchZone && matchType;
    });

    render();
  }

  function ensureCarouselUI() {
    const track = getMount();
    if (!track) return null;

    let wrap = track.parentElement;
    if (!wrap || !wrap.classList.contains('pasaje-carousel-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'pasaje-carousel-wrap mb-6';
      track.parentNode.insertBefore(wrap, track);
      wrap.appendChild(track);
    } else {
      wrap.classList.add('mb-6');
    }

    track.classList.add('pasaje-carousel-track');
    ['flex','gap-4','overflow-x-auto','no-scrollbar','pb-3'].forEach(c => {
      if (!track.classList.contains(c)) track.classList.add(c);
    });

    let prev = wrap.querySelector('.pasaje-carousel-arrow.prev');
    let next = wrap.querySelector('.pasaje-carousel-arrow.next');

    if (!prev) {
      prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'pasaje-carousel-arrow prev';
      prev.setAttribute('aria-label', 'Anterior');
      prev.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
      prev.addEventListener('click', () => scrollTrack(track, -1));
      wrap.appendChild(prev);
    }

    if (!next) {
      next = document.createElement('button');
      next.type = 'button';
      next.className = 'pasaje-carousel-arrow next';
      next.setAttribute('aria-label', 'Siguiente');
      next.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      next.addEventListener('click', () => scrollTrack(track, 1));
      wrap.appendChild(next);
    }

    attachDragScroll(track);
    updateArrowVisibility(track, prev, next);
    attachArrowVisibilityWatcher(track, prev, next);

    carouselUI = { wrap, track, prev, next };
    return carouselUI;
  }

  function scrollTrack(track, dir) {
    const amount = Math.max(280, Math.floor(track.clientWidth * 0.85));
    track.scrollBy({ left: dir * amount, behavior: 'smooth' });
  }

  function updateArrowVisibility(track, prev, next) {
    if (!track || !prev || !next) return;
    const hasOverflow = track.scrollWidth > track.clientWidth + 4;
    prev.classList.toggle('show', hasOverflow);
    next.classList.toggle('show', hasOverflow);
    const atStart = track.scrollLeft <= 2;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    prev.disabled = atStart;
    next.disabled = atEnd;
  }

  function attachArrowVisibilityWatcher(track, prev, next) {
    if (track.dataset.arrowWatcher === '1') return;
    track.dataset.arrowWatcher = '1';

    let rafId = null;
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateArrowVisibility(track, prev, next);
      });
    };
    track.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(schedule).observe(track);
    }
  }

  function attachDragScroll(track) {
    if (track.dataset.dragAttached === '1') return;
    track.dataset.dragAttached = '1';

    let isDown = false, startX = 0, startScroll = 0, dragged = false;

    track.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      dragged = false;
      startX = e.pageX;
      startScroll = track.scrollLeft;
    });

    const onMove = (e) => {
      if (!isDown) return;
      const walk = e.pageX - startX;
      if (!dragged && Math.abs(walk) > 6) {
        dragged = true;
        track.classList.add('dragging');
      }
      if (dragged) {
        e.preventDefault();
        track.scrollLeft = startScroll - walk;
      }
    };

    const onUp = () => {
      if (!isDown) return;
      isDown = false;
      track.classList.remove('dragging');
      if (dragged) setTimeout(() => { dragged = false; }, 0);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    track.addEventListener('click', (e) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }, true);
  }

  async function fetchStores() {
    if (typeof window._supabase === 'undefined') return [];

    try {
      const { data, error } = await window._supabase
        .from('stores')
        .select(`
          id, name, slug, whatsapp, logo_url, cover_url, address, address_details, zone, has_physical_store, schedule,
          description, is_suspended, deletion_requested,
          categories ( id, name, slug, icon ),
          products ( count )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[StoresRender] Fallback sin joins:', error.message);
        const fallback = await window._supabase
          .from('stores')
          .select('id, name, slug, whatsapp, logo_url, cover_url, address, address_details, zone, has_physical_store, is_suspended, deletion_requested')
          .order('created_at', { ascending: false });
        return (fallback.data || []).filter(s => s.is_suspended !== true && s.deletion_requested !== true);
      }

      return (data || []).filter(s => s.is_suspended !== true && s.deletion_requested !== true);
    } catch (e) {
      console.warn('[StoresRender] excepción:', e);
      return [];
    }
  }

  function storeCardHTML(s) {
    const ph = placeholder();
    const logo = s.logo_url || ph;
    const cover = s.cover_url || s.logo_url || null;
    const category = s.categories
      ? `${s.categories.icon || ''} ${s.categories.name || ''}`.trim()
      : '';
    const nProd = Array.isArray(s.products) && s.products[0]
      ? (s.products[0].count ?? 0) : 0;

    const coverHTML = cover
      ? `<img src="${cover}" alt="${escapeHtml(s.name)}"
              onerror="this.onerror=null;this.src='${ph}'"
              draggable="false"
              class="w-full h-full object-cover pointer-events-none">`
      : `<div class="w-full h-full bg-gradient-to-br from-blue-900 to-emerald-700"></div>`;

    const badgeHTML = renderStoreBadge(s);
    const targetUrl = s.slug ? `tienda.html?slug=${encodeURIComponent(s.slug)}` : `tienda.html?id=${encodeURIComponent(s.id)}`;

    return `
      <a href="${targetUrl}" class="store-carousel-card snap-start flex-shrink-0 w-64 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col no-underline block"
         data-store-id="${escapeHtml(s.id)}" data-store-slug="${escapeHtml(s.slug || '')}"
         aria-label="Ir a tienda ${escapeHtml(s.name)}">
        <div class="aspect-video bg-gray-100 relative overflow-hidden">
          ${coverHTML}
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
          <img src="${logo}" alt="${escapeHtml(s.name)}"
               onerror="this.onerror=null;this.src='${ph}'"
               draggable="false"
               class="absolute -bottom-5 left-3 w-14 h-14 rounded-full object-cover border-4 border-white bg-white shadow-md pointer-events-none">
        </div>
        <div class="pt-7 pb-3 px-3 flex-1 flex flex-col">
          <h3 class="text-sm font-bold text-gray-800 truncate">${escapeHtml(s.name)}</h3>
          
          <div class="mt-1 mb-2">
            ${badgeHTML}
          </div>

          ${category ? `<span class="text-[10px] uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded self-start mb-1">${escapeHtml(category)}</span>` : ''}
          ${s.address_details || s.address ? `<p class="text-[11px] text-gray-500 mt-0.5 truncate">🏢 ${escapeHtml(s.address_details || s.address)}</p>` : ''}
          <p class="text-[11px] text-gray-500 mt-0.5">📦 ${nProd} producto${nProd === 1 ? '' : 's'}</p>
          <div class="mt-auto pt-2 flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
            <span>Ver tienda</span><span>→</span>
          </div>
        </div>
      </a>
    `;
  }

  function render() {
    const track = getMount();
    if (!track) return;

    const section = track.closest('section');
    if (filteredStores.length === 0) {
      track.innerHTML = `
        <div class="w-full py-8 text-center text-xs font-semibold text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          No se encontraron tiendas en ${escapeHtml(currentZoneFilter)} con los filtros seleccionados.
        </div>`;
      if (section) section.classList.remove('hidden');
      return;
    }
    if (section) section.classList.remove('hidden');

    track.innerHTML = filteredStores.map(storeCardHTML).join('');

    if (carouselUI) {
      setTimeout(() => updateArrowVisibility(track, carouselUI.prev, carouselUI.next), 50);
    }
  }

  async function init(retryCount) {
    retryCount = retryCount || 0;
    const track = getMount();
    if (!track) {
      if (retryCount < 20) setTimeout(() => init(retryCount + 1), 150);
      return;
    }

    injectCarouselStyles();
    injectFilterBar();
    ensureCarouselUI();

    if (initialized) {
      allStores = await fetchStores();
      applyFiltersAndRender();
      return;
    }
    initialized = true;
    allStores = await fetchStores();
    applyFiltersAndRender();

    window.addEventListener('pasaje:theme-applied', () => {
      const tr = getMount();
      if (tr && carouselUI) updateArrowVisibility(tr, carouselUI.prev, carouselUI.next);
    });
  }

  window.PasajeStores = {
    init,
    refresh: async () => { allStores = await fetchStores(); applyFiltersAndRender(); },
    getAll: () => allStores
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(0));
  } else {
    init(0);
  }
})();
// =============================================================
// js/categories-render.js
// Carrusel horizontal de categorías jerárquicas con drag + flechas.
// Sincroniza con la grilla vía ?cat=slug y window.setCatalogCategory.
// =============================================================

(function () {
  'use strict';

  const EVENT_NAME = 'pasaje:category-change';

  const THEME_TO_TAG = {
    halloween:     'halloween',
    navidad:       'navidad',
    fiambre:       'fiambre',
    independencia: 'patrio',
    semana_santa:  'semana_santa',
    ano_nuevo:     'ano_nuevo',
  };

  let allCategories = [];
  let activeSlug = 'todas';
  let activeTheme = 'default';
  let initialized = false;
  let carouselUI = null;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getMount() {
    return document.getElementById('categoryFilters')
        || document.querySelector('[data-categories-render]');
  }

  function getActiveTheme() {
    if (window.PasajeTheme && typeof window.PasajeTheme.getActiveTheme === 'function') {
      try { return window.PasajeTheme.getActiveTheme(); } catch (e) {}
    }
    return document.body.dataset.theme || 'default';
  }

  function getSeasonalTagFor(theme) {
    return THEME_TO_TAG[theme] || null;
  }

  function setUrlParam(slug) {
    try {
      const url = new URL(window.location.href);
      if (!slug || slug === 'todas') url.searchParams.delete('cat');
      else url.searchParams.set('cat', slug);
      window.history.replaceState({}, '', url.toString());
    } catch (e) { /* noop */ }
  }

  function readUrlParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('cat') || null;
    } catch (e) { return null; }
  }

  function injectCarouselStyles() {
    if (document.getElementById('pasajeCategoriesCarouselStyles')) return;
    const s = document.createElement('style');
    s.id = 'pasajeCategoriesCarouselStyles';
    s.textContent = `
      .pasaje-carousel-wrap { position: relative; }
      .pasaje-carousel-track {
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        scroll-behavior: smooth;
        touch-action: pan-x;
      }
      .pasaje-carousel-track img { -webkit-user-drag: none; user-drag: none; }
      .pasaje-carousel-track.dragging {
        cursor: grabbing;
        scroll-behavior: auto;
      }
      .pasaje-carousel-arrow {
        display: none;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 4px 14px -2px rgba(0,0,0,.15);
        align-items: center;
        justify-content: center;
        color: #374151;
        cursor: pointer;
        transition: background .15s, transform .15s;
      }
      .pasaje-carousel-arrow:hover { background: #f9fafb; }
      .pasaje-carousel-arrow:active { transform: translateY(-50%) scale(.94); }
      .pasaje-carousel-arrow.prev { left: -8px; }
      .pasaje-carousel-arrow.next { right: -8px; }
      @media (min-width: 640px) {
        .pasaje-carousel-arrow.show { display: flex; }
      }
      .pasaje-carousel-arrow[disabled] { opacity: 0.35; cursor: not-allowed; }
    `;
    document.head.appendChild(s);
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
    ['flex', 'gap-2', 'overflow-x-auto', 'no-scrollbar', 'pb-2'].forEach(c => {
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

  function scrollTrack(track, direction) {
    const amount = Math.max(240, Math.floor(track.clientWidth * 0.85));
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
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
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(track);
  }

  function attachDragScroll(track) {
    if (track.dataset.dragAttached === '1') return;
    track.dataset.dragAttached = '1';

    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let dragged = false;

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

  async function fetchCategories() {
    if (typeof window._supabase === 'undefined') return [];

    try {
      const { data, error } = await window._supabase
        .from('categories')
        .select('id, name, slug, icon, sort_order, is_active, parent_id, seasonal_tag, badge_color, is_featured')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) return data;
      return [];
    } catch (e) {
      console.warn('[CategoriesRender] fetch excepción:', e);
      return [];
    }
  }

  function chipHTML(cat) {
    const isActive = cat.slug === activeSlug;
    const isSub = !!cat.parent_id;
    const seasonalForTheme = getSeasonalTagFor(activeTheme);
    const isSeasonal = seasonalForTheme && cat.seasonal_tag === seasonalForTheme;

    const base = 'whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-1.5 flex-shrink-0 snap-start';

    let extra = '';
    let style = '';

    if (isActive) {
      extra = 'text-white shadow font-bold';
      style = 'background-color: var(--color-secondary, #1e3a8a);';
    } else if (isSeasonal) {
      extra = 'border-2 font-semibold';
      style = `border-color: ${cat.badge_color || '#10B981'}; color: ${cat.badge_color || '#10B981'}; background-color: white;`;
    } else if (isSub) {
      extra = 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 text-xs';
    } else {
      extra = 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100';
    }

    const seasonalIcon = isSeasonal && !isActive ? '<span class="text-[10px]">🔥</span>' : '';
    const prefix = isSub ? '<span class="text-slate-400 font-normal">↳</span>' : '';

    return `
      <button type="button" data-cat-slug="${escapeHtml(cat.slug)}"
        class="${base} ${extra}"
        style="${style}">
        ${prefix}
        <span>${escapeHtml(cat.icon || (isSub ? '📌' : '📦'))}</span>
        <span>${escapeHtml(cat.name)}</span>
        ${seasonalIcon}
      </button>
    `;
  }

  function render() {
    const mount = getMount();
    if (!mount) return;

    const isAllActive = activeSlug === 'todas' || !activeSlug;

    const chips = [];
    chips.push(`
      <button type="button" data-cat-slug="todas"
        class="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-1.5 flex-shrink-0 snap-start ${isAllActive
          ? 'text-white shadow font-bold'
          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}"
        style="${isAllActive ? 'background-color: var(--color-secondary, #1e3a8a);' : ''}">
        <span>🛍️</span>
        <span>Todas</span>
      </button>
    `);

    // Ordenar para mostrar Padre -> Sus Hijas inmediatamente después
    const mainCats = allCategories.filter(c => !c.parent_id);
    const subMap = new Map();
    allCategories.filter(c => c.parent_id).forEach(c => {
      const pid = String(c.parent_id);
      if (!subMap.has(pid)) subMap.set(pid, []);
      subMap.get(pid).push(c);
    });

    mainCats.forEach(parent => {
      chips.push(chipHTML(parent));
      const subs = subMap.get(String(parent.id)) || [];
      subs.forEach(sub => chips.push(chipHTML(sub)));
    });

    mount.innerHTML = chips.join('');

    mount.querySelectorAll('[data-cat-slug]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const slug = btn.dataset.catSlug || 'todas';
        selectCategory(slug);
      });
    });

    if (carouselUI) {
      setTimeout(() => updateArrowVisibility(mount, carouselUI.prev, carouselUI.next), 50);
    }
  }

  function selectCategory(slug) {
    const cleanSlug = slug || 'todas';
    activeSlug = cleanSlug;

    setUrlParam(cleanSlug);
    render();

    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug: cleanSlug } }));
    } catch (e) { /* noop */ }

    if (typeof window.setCatalogCategory === 'function') {
      try { window.setCatalogCategory(cleanSlug); } catch (e) { console.warn(e); }
    }
  }

  async function init(retryCount) {
    retryCount = retryCount || 0;

    const mount = getMount();
    if (!mount) {
      if (retryCount < 20) {
        setTimeout(() => init(retryCount + 1), 150);
      }
      return;
    }

    injectCarouselStyles();
    ensureCarouselUI();

    if (initialized) {
      allCategories = await fetchCategories();
      render();
      return;
    }

    initialized = true;
    activeTheme = getActiveTheme();
    allCategories = await fetchCategories();

    const fromUrl = readUrlParam();
    if (fromUrl) {
      const exists = allCategories.some(c => c.slug === fromUrl);
      if (exists) activeSlug = fromUrl;
    }

    render();

    if (typeof window.setCatalogCategory === 'function') {
      try { window.setCatalogCategory(activeSlug); } catch (e) {}
    }

    window.addEventListener('pasaje:theme-applied', () => {
      activeTheme = getActiveTheme();
      render();
    });

    window.addEventListener('popstate', () => {
      const slug = readUrlParam() || 'todas';
      activeSlug = slug;
      render();
      if (typeof window.setCatalogCategory === 'function') {
        try { window.setCatalogCategory(activeSlug); } catch (e) {}
      }
    });
  }

  window.PasajeCategories = {
    init,
    refresh: async () => {
      allCategories = await fetchCategories();
      render();
    },
    select: selectCategory,
    getActive: () => activeSlug,
    getAll: () => allCategories
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(0));
  } else {
    init(0);
  }
})();
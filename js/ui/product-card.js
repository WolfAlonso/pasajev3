// =============================================================
// /js/ui/product-card.js
// Renderizador UI unificado:
//   · Tarjetas con insignia de tienda verificada, ofertas relámpago y estrellas
//   · Selector de variantes: swatches de color + pills de talla
//   · Modal interno de pedido (inserta en cart_orders con status='new')
//   · Compatibilidad total con window.ProductCardUI (API legacy)
// =============================================================

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // CONFIG
  // --------------------------------------------------------------------------
  const MODAL_ID = 'pasajeOrderModal';
  const TOAST_ID = 'pasajeToast';
  const STYLE_ID = 'pasajeProductCardStyles';

  const MONEY = (n) => 'Q ' + Number(n || 0).toFixed(2);

  // --------------------------------------------------------------------------
  // HELPERS BÁSICOS
  // --------------------------------------------------------------------------
  function escapeHtml(str) {
    if (window.dashEscapeHtml) return window.dashEscapeHtml(str);
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeArray(arr) {
    return Array.isArray(arr) ? arr : [];
  }

  function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(15, 23, 42, ${alpha})`;
    const h = String(hex).replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.substring(0, 2), 16) || 0;
    const g = parseInt(full.substring(2, 4), 16) || 0;
    const b = parseInt(full.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function isLight(hex) {
    if (!hex) return false;
    const h = String(hex).replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.substring(0, 2), 16) || 0;
    const g = parseInt(full.substring(2, 4), 16) || 0;
    const b = parseInt(full.substring(4, 6), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.75;
  }

  // --------------------------------------------------------------------------
  // SUPABASE CLIENT (tolerante a distintas formas)
  // --------------------------------------------------------------------------
  function getSupabase() {
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === 'function') {
      return window.supabase;
    }
    if (
      window.supabase &&
      typeof window.supabase.createClient === 'function' &&
      window.PASAJE_SUPABASE_URL &&
      window.PASAJE_SUPABASE_ANON_KEY
    ) {
      window.supabaseClient = window.supabase.createClient(
        window.PASAJE_SUPABASE_URL,
        window.PASAJE_SUPABASE_ANON_KEY
      );
      return window.supabaseClient;
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // CSS INYECTADO (una sola vez)
  // --------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ---------- Variantes en la tarjeta ---------- */
      .pasaje-variants {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
      }
      .pasaje-variants__row {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .pasaje-variants__label {
        font-size: 10.5px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: .05em;
      }
      .pasaje-variants__label span {
        color: #0f172a;
        font-weight: 600;
        text-transform: none;
        letter-spacing: 0;
      }

      /* Swatches de color */
      .pasaje-colors {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
      }
      .pasaje-swatch {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid rgba(15, 23, 42, 0.15);
        cursor: pointer;
        padding: 0;
        position: relative;
        transition: transform .15s ease, box-shadow .15s ease;
        background-clip: padding-box;
      }
      .pasaje-swatch:hover { transform: scale(1.08); }
      .pasaje-swatch.is-active {
        box-shadow: 0 0 0 2px #fff, 0 0 0 4px #4f46e5;
        transform: scale(1.05);
      }
      .pasaje-swatch.is-out {
        opacity: 0.35;
        cursor: not-allowed;
      }
      .pasaje-swatch.is-out::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(45deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%);
        border-radius: 50%;
      }
      .pasaje-swatch:disabled { cursor: not-allowed; }

      /* Pills de talla */
      .pasaje-sizes {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
      }
      .pasaje-size {
        min-width: 32px;
        height: 28px;
        padding: 0 9px;
        border-radius: 8px;
        border: 1.5px solid rgba(15, 23, 42, 0.12);
        background: rgba(255, 255, 255, 0.7);
        color: #0f172a;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all .15s ease;
      }
      .pasaje-size:hover { border-color: #4f46e5; }
      .pasaje-size.is-active {
        background: linear-gradient(135deg, #4f46e5, #2563eb);
        color: #fff;
        border-color: transparent;
        box-shadow: 0 3px 10px rgba(79, 70, 229, 0.35);
      }
      .pasaje-size.is-out {
        opacity: 0.35;
        cursor: not-allowed;
        text-decoration: line-through;
      }
      .pasaje-size:disabled { cursor: not-allowed; }

      /* ---------- Modal de pedido interno ---------- */
      .pasaje-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9998;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        pointer-events: none;
        transition: opacity .2s ease;
      }
      .pasaje-modal-backdrop.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .pasaje-modal {
        width: 100%;
        max-width: 520px;
        max-height: 92vh;
        overflow-y: auto;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 22px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35);
        transform: translateY(12px) scale(.98);
        transition: transform .25s cubic-bezier(.2, .9, .3, 1.1);
      }
      .pasaje-modal-backdrop.is-open .pasaje-modal {
        transform: translateY(0) scale(1);
      }
      .pasaje-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 20px 12px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      }
      .pasaje-modal__title {
        margin: 0;
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
      }
      .pasaje-modal__close {
        background: rgba(15, 23, 42, 0.06);
        border: none;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        font-size: 20px;
        color: #0f172a;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .15s ease;
      }
      .pasaje-modal__close:hover { background: rgba(15, 23, 42, 0.12); }

      .pasaje-modal__product {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 14px 20px;
        background: rgba(79, 70, 229, 0.04);
        border-bottom: 1px solid rgba(15, 23, 42, 0.04);
      }
      .pasaje-modal__product img {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        object-fit: cover;
        border: 1px solid rgba(15, 23, 42, 0.06);
      }
      .pasaje-modal__meta { flex: 1; min-width: 0; }
      .pasaje-modal__name {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pasaje-modal__variant {
        font-size: 12px;
        color: #64748b;
        margin-top: 2px;
      }
      .pasaje-modal__price {
        font-size: 16px;
        font-weight: 800;
        color: #4f46e5;
        margin-top: 4px;
      }

      .pasaje-modal__body { padding: 16px 20px 20px; }
      .pasaje-field { margin-bottom: 12px; }
      .pasaje-field label {
        display: block;
        font-size: 11.5px;
        font-weight: 700;
        color: #475569;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .pasaje-field input,
      .pasaje-field select,
      .pasaje-field textarea {
        width: 100%;
        padding: 11px 13px;
        border-radius: 10px;
        border: 1.5px solid rgba(15, 23, 42, 0.1);
        background: rgba(255, 255, 255, 0.9);
        font-size: 14px;
        color: #0f172a;
        font-family: inherit;
        outline: none;
        transition: border-color .15s ease, box-shadow .15s ease;
        box-sizing: border-box;
      }
      .pasaje-field input:focus,
      .pasaje-field select:focus,
      .pasaje-field textarea:focus {
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
      }
      .pasaje-field textarea { resize: vertical; min-height: 68px; }
      .pasaje-field--row { display: flex; gap: 10px; }
      .pasaje-field--row > * { flex: 1; }

      .pasaje-qty {
        display: inline-flex;
        align-items: center;
        gap: 0;
        border: 1.5px solid rgba(15, 23, 42, 0.1);
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
      }
      .pasaje-qty button {
        width: 36px;
        height: 36px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 18px;
        font-weight: 700;
        color: #4f46e5;
      }
      .pasaje-qty button:hover { background: rgba(79, 70, 229, 0.08); }
      .pasaje-qty input {
        width: 48px;
        height: 36px;
        border: none;
        text-align: center;
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        background: transparent;
        outline: none;
      }

      .pasaje-total {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        margin: 4px 0 14px;
        background: linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(37, 99, 235, 0.08));
        border-radius: 12px;
      }
      .pasaje-total__label {
        font-size: 12px;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .pasaje-total__value {
        font-size: 18px;
        font-weight: 800;
        color: #4f46e5;
      }

      .pasaje-submit {
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #4f46e5, #2563eb);
        color: #fff;
        font-size: 14.5px;
        font-weight: 800;
        cursor: pointer;
        letter-spacing: .02em;
        box-shadow: 0 10px 24px rgba(79, 70, 229, 0.4);
        transition: transform .15s ease, box-shadow .15s ease;
      }
      .pasaje-submit:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 30px rgba(79, 70, 229, 0.5);
      }
      .pasaje-submit:disabled { opacity: 0.6; cursor: wait; }

      /* Pantalla de éxito */
      .pasaje-success {
        padding: 32px 24px;
        text-align: center;
      }
      .pasaje-success__icon {
        width: 72px;
        height: 72px;
        margin: 0 auto 14px;
        border-radius: 50%;
        background: linear-gradient(135deg, #10b981, #059669);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        color: #fff;
        box-shadow: 0 12px 30px rgba(16, 185, 129, 0.4);
        animation: pasajePop .45s cubic-bezier(.2, .9, .3, 1.4);
      }
      @keyframes pasajePop {
        0%   { transform: scale(.4); opacity: 0; }
        100% { transform: scale(1);  opacity: 1; }
      }
      .pasaje-success__title {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 6px;
      }
      .pasaje-success__msg {
        font-size: 13.5px;
        color: #475569;
        margin: 0 0 18px;
        line-height: 1.5;
      }
      .pasaje-success__btn {
        background: rgba(15, 23, 42, 0.06);
        border: none;
        border-radius: 10px;
        padding: 10px 20px;
        font-size: 13.5px;
        font-weight: 700;
        color: #0f172a;
        cursor: pointer;
      }

      /* Toast */
      #${TOAST_ID} {
        position: fixed;
        bottom: 22px;
        left: 50%;
        transform: translateX(-50%) translateY(60px);
        z-index: 9999;
        background: rgba(15, 23, 42, 0.94);
        color: #fff;
        padding: 12px 20px;
        border-radius: 999px;
        font-size: 13.5px;
        font-weight: 600;
        box-shadow: 0 14px 40px rgba(15, 23, 42, 0.5);
        opacity: 0;
        pointer-events: none;
        transition: all .3s cubic-bezier(.2, .9, .3, 1.1);
      }
      #${TOAST_ID}.is-visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      #${TOAST_ID}.is-error {
        background: linear-gradient(135deg, #dc2626, #b91c1c);
      }

      @media (max-width: 480px) {
        .pasaje-modal { border-radius: 18px; }
        .pasaje-modal__product img { width: 56px; height: 56px; }
      }
    `;
    document.head.appendChild(style);
  }

  // --------------------------------------------------------------------------
  // TOAST
  // --------------------------------------------------------------------------
  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
    return toast;
  }

  function showToast(message, type) {
    const toast = ensureToast();
    toast.textContent = message;
    toast.classList.remove('is-error');
    if (type === 'error') toast.classList.add('is-error');
    toast.classList.add('is-visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2800);
  }

  // --------------------------------------------------------------------------
  // RESOLUCIÓN DE VARIANTES (color + talla → imagen / precio / stock)
  // --------------------------------------------------------------------------
  function resolveVariant(product, colorName, sizeName) {
    const colors = safeArray(product.colors);
    const sizes  = safeArray(product.sizes);
    const color  = colors.find(c => c.name === colorName) || null;
    const size   = sizes.find(s => s.name === sizeName) || null;

    let price = Number(product.price || 0);
    if (color && typeof color.price === 'number') price = Number(color.price);
    if (size && typeof size.price === 'number')   price = Number(size.price);

    let variantKey = null;
    if (colorName && sizeName) variantKey = `${colorName}-${sizeName}`;
    if (product.variants && variantKey && product.variants[variantKey]) {
      const v = product.variants[variantKey];
      if (typeof v.price === 'number') price = Number(v.price);
    }

    let image = product.image_url || (safeArray(product.images)[0] || '');
    if (color && color.image) image = color.image;
    if (product.variants && variantKey && product.variants[variantKey] && product.variants[variantKey].image) {
      image = product.variants[variantKey].image;
    }

    let stock = null;
    if (product.variants && variantKey && product.variants[variantKey] && typeof product.variants[variantKey].stock === 'number') {
      stock = product.variants[variantKey].stock;
    } else if (size && typeof size.stock === 'number') {
      stock = size.stock;
    } else if (color && typeof color.stock === 'number') {
      stock = color.stock;
    }

    return { color, size, price, image, stock, variantKey };
  }

  function isColorAvailable(product, colorName) {
    const sizes  = safeArray(product.sizes);
    const colors = safeArray(product.colors);
    const color  = colors.find(c => c.name === colorName);
    if (!color) return true;
    if (typeof color.stock === 'number') return color.stock > 0;
    if (sizes.length === 0) return true;
    if (product.variants) {
      return sizes.some(s => {
        const v = product.variants[`${colorName}-${s.name}`];
        if (v && typeof v.stock === 'number') return v.stock > 0;
        return true;
      });
    }
    return true;
  }

  function isSizeAvailable(product, colorName, sizeName) {
    if (product.variants && colorName && sizeName) {
      const v = product.variants[`${colorName}-${sizeName}`];
      if (v && typeof v.stock === 'number') return v.stock > 0;
    }
    const sizes = safeArray(product.sizes);
    const size  = sizes.find(s => s.name === sizeName);
    if (size && typeof size.stock === 'number') return size.stock > 0;
    return true;
  }

  // --------------------------------------------------------------------------
  // HELPERS LEGACY (compatibilidad con código existente)
  // --------------------------------------------------------------------------
  function buildWAUrl(p, selectedVariant = null, calculatedPrice = null) {
    const cleanPhone = window.cleanPhone || (raw => String(raw || '').replace(/\D/g, ''));
    const phone = cleanPhone(p.store_whatsapp);
    const finalPrice = calculatedPrice !== null ? calculatedPrice : parseFloat(p.price || 0);
    const priceStr = Number(finalPrice || 0).toFixed(2);

    let variantText = '';
    if (selectedVariant) {
      const pieces = [];
      if (selectedVariant.color) pieces.push(selectedVariant.color);
      if (selectedVariant.size)  pieces.push(selectedVariant.size);
      if (selectedVariant.name)  pieces.push(selectedVariant.name);
      if (pieces.length) variantText = ` (Opción: ${pieces.join(' / ')})`;
    }
    const msg = encodeURIComponent(
      `Hola, vi tu producto *${p.title}*${variantText} (Q ${priceStr}) en Pasaje de los Altos y me interesa.`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  }

  function getStockStatus(p) {
    if (!p.is_active) return { key: 'inactive', label: '⛔ Agotado', style: 'bg-slate-200 text-slate-800' };
    if (p.stock_quantity === null || p.stock_quantity === undefined) {
      return { key: 'unlimited', label: '♾️ Disponible', style: 'bg-emerald-50 text-emerald-800' };
    }
    if (p.stock_quantity === 0) {
      return { key: 'out', label: '⛔ Agotado', style: 'bg-rose-100 text-rose-800' };
    }
    if (p.stock_quantity <= 3) {
      return { key: 'low', label: `⚡ Quedan ${p.stock_quantity}`, style: 'bg-amber-100 text-amber-900' };
    }
    return { key: 'in', label: `📦 Stock: ${p.stock_quantity}`, style: 'bg-emerald-100 text-emerald-800' };
  }

  function renderStars(rating = 5) {
    const fullStars = Math.floor(rating);
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += i <= fullStars
        ? '<span class="text-amber-400">★</span>'
        : '<span class="text-slate-200">★</span>';
    }
    return `<span class="inline-flex items-center text-xs tracking-tight">${starsHtml}</span>`;
  }

  function formatExpiration(expIso) {
    if (!expIso) return '⚡ Oferta activa';
    try {
      const exp = new Date(expIso);
      const diffMs = exp - new Date();
      if (diffMs <= 0) return 'Vencida';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins  = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `Vence en ${hours}h ${mins}m`;
    } catch (e) {
      return '';
    }
  }

  // --------------------------------------------------------------------------
  // RENDER: Swatches de color + Pills de talla
  // --------------------------------------------------------------------------
  function renderColorSwatchesHTML(product, selectedColor) {
    const colors = safeArray(product.colors);
    if (colors.length === 0) return '';

    const swatches = colors.map(c => {
      const out = !isColorAvailable(product, c.name);
      const active = c.name === selectedColor;
      const bg = c.hex ? c.hex : 'linear-gradient(135deg,#e2e8f0,#cbd5e1)';
      const innerShadow = isLight(c.hex)
        ? 'style="background:' + bg + ';box-shadow:inset 0 0 0 1px rgba(15,23,42,.15);"'
        : 'style="background:' + bg + ';"';
      return `
        <button type="button"
          class="pasaje-swatch ${active ? 'is-active' : ''} ${out ? 'is-out' : ''}"
          data-color="${escapeHtml(c.name)}"
          title="${escapeHtml(c.name)}"
          aria-label="Color ${escapeHtml(c.name)}"
          ${out ? 'disabled' : ''}
          ${innerShadow}>
        </button>`;
    }).join('');

    return `
      <div class="pasaje-variants__row" data-variant-group="color">
        <div class="pasaje-variants__label">
          Color: <span data-role="color-label">${escapeHtml(selectedColor || '')}</span>
        </div>
        <div class="pasaje-colors" data-role="colors">
          ${swatches}
        </div>
      </div>`;
  }

  function renderSizePillsHTML(product, selectedColor, selectedSize) {
    const sizes = safeArray(product.sizes);
    if (sizes.length === 0) return '';

    const pills = sizes.map(s => {
      const out = !isSizeAvailable(product, selectedColor, s.name);
      const active = s.name === selectedSize;
      return `
        <button type="button"
          class="pasaje-size ${active ? 'is-active' : ''} ${out ? 'is-out' : ''}"
          data-size="${escapeHtml(s.name)}"
          title="${escapeHtml(s.name)}"
          ${out ? 'disabled' : ''}>
          ${escapeHtml(s.name)}
        </button>`;
    }).join('');

    return `
      <div class="pasaje-variants__row" data-variant-group="size">
        <div class="pasaje-variants__label">
          Talla: <span data-role="size-label">${escapeHtml(selectedSize || '')}</span>
        </div>
        <div class="pasaje-sizes" data-role="sizes">
          ${pills}
        </div>
      </div>`;
  }

  function renderVariantsSelectorHTML(product) {
    const colors = safeArray(product.colors);
    const sizes  = safeArray(product.sizes);
    if (colors.length === 0 && sizes.length === 0) return '';

    const defaultColor = colors.length
      ? (colors.find(c => isColorAvailable(product, c.name)) || colors[0]).name
      : null;
    const defaultSize = sizes.length
      ? (sizes.find(s => isSizeAvailable(product, defaultColor, s.name)) || sizes[0]).name
      : null;

    const parts = [];
    if (colors.length) parts.push(renderColorSwatchesHTML(product, defaultColor));
    if (sizes.length)  parts.push(renderSizePillsHTML(product, defaultColor, defaultSize));

    return `<div class="pasaje-variants">${parts.join('')}</div>`;
  }

  // --------------------------------------------------------------------------
  // RENDER: Tarjeta de producto
  // --------------------------------------------------------------------------
  function renderCardHTML(p, options = {}) {
    const placeholder = window.PLACEHOLDER_IMG || 'img/placeholder.png';
    const colors = safeArray(p.colors);
    const sizes  = safeArray(p.sizes);

    // Selección inicial (para precio/imagen)
    const defaultColor = colors.length
      ? (colors.find(c => isColorAvailable(p, c.name)) || colors[0]).name
      : null;
    const defaultSize = sizes.length
      ? (sizes.find(s => isSizeAvailable(p, defaultColor, s.name)) || sizes[0]).name
      : null;
    const initialVariant = resolveVariant(p, defaultColor, defaultSize);

    const img = initialVariant.image || p.image_url || (Array.isArray(p.images) && p.images[0]) || placeholder;
    const isFav = window.Favorites ? window.Favorites.has(p.id) : false;
    const initialStock = initialVariant.stock;
    const isOutOfStock = !p.is_active || p.stock_quantity === 0 || (initialStock !== null && initialStock <= 0);
    const heartSvg = window.heartSVG ? window.heartSVG(isFav) : '❤️';
    const isFeaturedView = !!options.isFeatured;
    const hasGallery = (Array.isArray(p.images) && p.images.length > 1) ||
                       (Array.isArray(p.image_urls) && p.image_urls.length > 0);
    const hasColorOptions = colors.length > 0;
    const hasSizeOptions  = sizes.length > 0;
    const hasNewVariants  = hasColorOptions || hasSizeOptions;

    // Compatibilidad con sistema viejo (variants: [{group,name,price_adjustment}])
    const hasLegacyVariants = Array.isArray(p.variants) && p.variants.length > 0;

    const isOnSale = p.is_on_sale && (!p.sale_expires_at || new Date(p.sale_expires_at) > new Date());

    let displayPrice = initialVariant.price || parseFloat(p.price || 0);
    let displayOrigPrice = null;

    if (isOnSale) {
      displayOrigPrice = p.original_price && parseFloat(p.original_price) > displayPrice
        ? parseFloat(p.original_price)
        : displayPrice * 1.25;
    } else if (p.is_on_sale && p.sale_expires_at && new Date(p.sale_expires_at) <= new Date()) {
      if (p.original_price && parseFloat(p.original_price) > displayPrice) {
        displayPrice = parseFloat(p.original_price);
      }
    }

    const discountPct = displayOrigPrice && displayOrigPrice > displayPrice
      ? Math.round(((displayOrigPrice - displayPrice) / displayOrigPrice) * 100)
      : 0;
    const expText = isOnSale ? formatExpiration(p.sale_expires_at) : '';

    const saleBadge = (isOnSale && discountPct > 0)
      ? `<span class="absolute top-2 left-2 z-10 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1">⚡ -${discountPct}% OFF</span>`
      : '';

    const expDisplay = isOnSale
      ? `<span class="block text-[10px] font-bold text-rose-600 mt-0.5 animate-pulse" data-countdown-target="${p.sale_expires_at || ''}">⏱️ ${expText}</span>`
      : '';

    const priceDisplay = isOnSale && displayOrigPrice
      ? `<div>
           <div class="flex items-baseline gap-1.5">
             <span class="text-xs font-bold text-slate-400 line-through">Q ${displayOrigPrice.toFixed(2)}</span>
             <span class="product-price text-rose-600 font-black text-sm" data-role="price-value">Q ${displayPrice.toFixed(2)}</span>
           </div>
           ${expDisplay}
         </div>`
      : `<span class="product-price text-emerald-600 font-extrabold" data-role="price-value">Q ${displayPrice.toFixed(2)}</span>`;

    const verifiedBadge = p.store_is_verified
      ? `<span class="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5" title="Tienda Verificada">✓ Verificada</span>`
      : '';

    const storeLine = p.store_slug
      ? `<a href="tienda.html?slug=${p.store_slug}" data-action="store-link" class="store-badge product-store no-click hover:underline flex items-center gap-1.5">
           <span>🏪 ${escapeHtml(p.store_name)}</span>
           ${verifiedBadge}
         </a>`
      : `<span class="store-badge product-store flex items-center gap-1.5">
           <span>🏪 ${escapeHtml(p.store_name)}</span>
           ${verifiedBadge}
         </span>`;

    const featuresBadges = `
      ${hasGallery ? `<span class="text-[9px] bg-slate-800/70 backdrop-blur text-white font-bold px-1.5 py-0.5 rounded-md">📷 Galería</span>` : ''}
      ${(hasNewVariants || hasLegacyVariants) ? `<span class="text-[9px] bg-indigo-800/70 backdrop-blur text-white font-bold px-1.5 py-0.5 rounded-md">🎨 Opciones</span>` : ''}
    `;

    const variantsHtml = hasNewVariants
      ? renderVariantsSelectorHTML(p)
      : (hasLegacyVariants ? renderVariantsHTML(p.variants) : '');

    // ---------------- Featured view (carrusel) ----------------
    if (isFeaturedView) {
      return `
        <article class="product-card glass-card-product snap-start flex-shrink-0 w-64 overflow-hidden flex flex-col border border-amber-200/80 shadow-sm ${isOutOfStock ? 'opacity-70' : ''}"
                 data-product-id="${p.id}"
                 data-store-id="${escapeHtml(p.store_id || '')}"
                 data-action="open-modal"
                 data-selected-color="${escapeHtml(defaultColor || '')}"
                 data-selected-size="${escapeHtml(defaultSize || '')}"
                 data-selected-price="${initialVariant.price}"
                 data-selected-image="${escapeHtml(initialVariant.image || '')}"
                 data-selected-stock="${initialStock === null ? '' : initialStock}">
          <div class="aspect-video bg-slate-100 overflow-hidden relative">
            <img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy"
                 onerror="this.onerror=null;this.src='${placeholder}'"
                 data-role="main-image"
                 class="w-full h-full object-cover transition duration-300">
            ${saleBadge}
            <span class="absolute top-2 right-12 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shadow-sm pointer-events-none">⭐ Destacado</span>
            <div class="absolute bottom-2 left-2 flex gap-1 pointer-events-none">
              ${featuresBadges}
            </div>
            <button type="button" data-action="toggle-fav" data-product-id="${p.id}"
              class="fav-btn no-click absolute top-2 right-2 bg-white/90 hover:bg-white w-7 h-7 rounded-full shadow flex items-center justify-center transition ${isFav ? 'fav-active' : ''}"
              style="${isFav ? 'color:#ef4444;' : ''}">
              ${heartSvg}
            </button>
          </div>
          <div class="p-3 flex-1 flex flex-col">
            <h3 class="product-title line-clamp-2">${escapeHtml(p.title)}</h3>
            <div class="mt-1">${storeLine}</div>
            ${variantsHtml}
            <div class="mt-auto pt-2 flex items-center justify-between gap-2">
              ${priceDisplay}
              ${isOutOfStock
                ? `<button disabled class="bg-slate-200 text-slate-600 text-[11px] font-bold px-2.5 py-1.5 rounded-xl cursor-not-allowed no-click">Agotado</button>`
                : `<div class="flex gap-1">
                     <button type="button" data-action="add-cart" data-product-id="${p.id}"
                       class="no-click bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1.5 rounded-xl transition hover:bg-emerald-200"
                       title="Añadir">🛒</button>
                     <button type="button" data-action="order-internal" data-product-id="${p.id}"
                        class="no-click bg-gradient-to-br from-indigo-600 to-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-sm hover:from-indigo-700 hover:to-blue-700">
                       Pedir
                     </button>
                   </div>`}
            </div>
          </div>
        </article>`;
    }

    // ---------------- Default view (grid) ----------------
    return `
      <article class="product-card glass-card-product overflow-hidden flex flex-col relative transition duration-200 hover:shadow-lg hover:-translate-y-0.5 ${isOutOfStock ? 'opacity-70' : ''}"
               data-product-id="${p.id}"
               data-store-id="${escapeHtml(p.store_id || '')}"
               data-action="open-modal"
               data-selected-color="${escapeHtml(defaultColor || '')}"
               data-selected-size="${escapeHtml(defaultSize || '')}"
               data-selected-price="${initialVariant.price}"
               data-selected-image="${escapeHtml(initialVariant.image || '')}"
               data-selected-stock="${initialStock === null ? '' : initialStock}">
        <button type="button" data-action="toggle-fav" data-product-id="${p.id}"
          class="fav-btn no-click absolute top-2 right-2 z-10 bg-white/90 hover:bg-white w-7 h-7 rounded-full shadow flex items-center justify-center transition ${isFav ? 'fav-active' : ''}"
          style="${isFav ? 'color:#ef4444;' : ''}">
          ${heartSvg}
        </button>
        <div class="aspect-square bg-slate-100 overflow-hidden relative pointer-events-none">
          <img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy"
               onerror="this.onerror=null;this.src='${placeholder}'"
               data-role="main-image"
               class="w-full h-full object-cover transition duration-300">
          ${saleBadge}
          <div class="absolute bottom-2 left-2 flex gap-1 pointer-events-none">
            ${featuresBadges}
          </div>
          ${isOutOfStock ? `<div class="absolute inset-0 bg-black/40 flex items-center justify-center"><span class="bg-white text-rose-700 font-extrabold text-xs px-3 py-1 rounded-full shadow">⛔ AGOTADO</span></div>` : ''}
        </div>
        <div class="p-3.5 flex-1 flex flex-col">
          <span class="text-[10px] uppercase font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded self-start">
            ${p.category_icon || '📦'} ${escapeHtml(p.category_name || 'General')}
          </span>

          <h3 class="product-title mt-1.5 line-clamp-2">${escapeHtml(p.title)}</h3>
          <div class="mt-1">${storeLine}</div>

          ${variantsHtml}

          <div class="mt-auto pt-3 flex items-center justify-between gap-2">
            ${priceDisplay}
            ${isOutOfStock
              ? `<button disabled class="bg-slate-200 text-slate-600 text-[11px] font-bold px-2.5 py-1.5 rounded-xl cursor-not-allowed no-click">Agotado</button>`
              : `<div class="flex gap-1">
                   <button type="button" data-action="add-cart" data-product-id="${p.id}"
                     class="no-click bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold px-2.5 py-1.5 rounded-xl transition"
                     title="Añadir al carrito">🛒</button>
                   <button type="button" data-action="order-internal" data-product-id="${p.id}"
                      class="no-click bg-gradient-to-br from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-sm">
                     Pedir
                   </button>
                 </div>`}
          </div>
        </div>
      </article>`;
  }

  // --------------------------------------------------------------------------
  // RENDER: Galería (modal de detalle)
  // --------------------------------------------------------------------------
  function renderGalleryHTML(images, title, activeIndex = 0) {
    const placeholder = window.PLACEHOLDER_IMG || 'img/placeholder.png';
    const imgs = Array.isArray(images) && images.length > 0 ? images : [placeholder];
    const safeIdx = Math.max(0, Math.min(activeIndex, imgs.length - 1));
    const mainImg = imgs[safeIdx];

    let navArrowsHtml = '';
    if (imgs.length > 1) {
      navArrowsHtml = `
        <button type="button" data-gallery-nav="prev"
          class="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center font-black text-base shadow-lg transition backdrop-blur-md"
          title="Imagen anterior (←)">‹</button>
        <button type="button" data-gallery-nav="next"
          class="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center font-black text-base shadow-lg transition backdrop-blur-md"
          title="Imagen siguiente (→)">›</button>
        <span class="absolute bottom-2 right-2 z-10 bg-black/60 text-white text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-md shadow">
          <span id="galleryCurrentIdx">${safeIdx + 1}</span> / ${imgs.length}
        </span>
      `;
    }

    let thumbsHtml = '';
    if (imgs.length > 1) {
      const thumbs = imgs.map((url, idx) => `
        <button type="button" data-gallery-thumb="${url}" data-gallery-index="${idx}"
          class="gallery-thumb snap-start flex-shrink-0 w-14 h-14 rounded-xl border-2 overflow-hidden transition ${idx === safeIdx ? 'border-rose-500 scale-95 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'}">
          <img src="${url}" alt="miniatura" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${placeholder}'">
        </button>
      `).join('');

      thumbsHtml = `<div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar snap-x">${thumbs}</div>`;
    }

    return `
      <div class="product-gallery space-y-2" data-total-images="${imgs.length}">
        <div class="aspect-square bg-slate-100 rounded-2xl overflow-hidden relative border border-slate-200/80 shadow-inner">
          <img id="mainGalleryViewer" src="${mainImg}" alt="${escapeHtml(title)}"
               onerror="this.onerror=null;this.src='${placeholder}'"
               class="w-full h-full object-cover transition duration-300">
          ${navArrowsHtml}
        </div>
        ${thumbsHtml}
      </div>`;
  }

  // --------------------------------------------------------------------------
  // RENDER: Variantes legacy (formato [{group,name,price_adjustment}])
  //   Se conserva por compatibilidad con código que aún use esta estructura.
  // --------------------------------------------------------------------------
  function renderVariantsHTML(variants) {
    if (!Array.isArray(variants) || variants.length === 0) return '';

    const groups = {};
    variants.forEach(v => {
      const gName = v.group || 'Opción';
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(v);
    });

    const groupsHtml = Object.keys(groups).map((groupName, gIdx) => {
      const items = groups[groupName];
      const itemsHtml = items.map((item, iIdx) => {
        const isSelected = iIdx === 0 && gIdx === 0;
        const adj = item.price_adjustment;
        let adjText = '';
        if (adj > 0) adjText = ` (+Q${Number(adj).toFixed(2)})`;
        else if (adj < 0) adjText = ` (-Q${Math.abs(adj).toFixed(2)})`;

        const isOut = item.stock_quantity !== null && item.stock_quantity <= 0;
        const btnStyle = isOut
          ? 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed'
          : (isSelected
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm font-bold'
              : 'bg-white text-slate-700 border-slate-200 hover:border-rose-500 hover:bg-rose-50');

        return `
          <button type="button"
            data-variant-id="${item.id}"
            data-variant-name="${escapeHtml(item.name)}"
            data-variant-adjustment="${adj}"
            data-variant-stock="${item.stock_quantity !== null ? item.stock_quantity : ''}"
            ${isOut ? 'disabled' : ''}
            class="variant-btn text-xs font-semibold px-3 py-2 rounded-xl border transition flex items-center gap-1 ${btnStyle}">
            <span>${escapeHtml(item.name)}</span>
            <span class="text-[10px] opacity-80">${adjText}</span>
          </button>`;
      }).join('');

      return `
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">${escapeHtml(groupName)} *</label>
          <div class="flex flex-wrap gap-2">
            ${itemsHtml}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="product-variants-container space-y-3 mt-4 pt-3 border-t border-slate-100">
        ${groupsHtml}
      </div>`;
  }

  // --------------------------------------------------------------------------
  // MODAL: construcción
  // --------------------------------------------------------------------------
  function ensureModal() {
    let backdrop = document.getElementById(MODAL_ID);
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = MODAL_ID;
    backdrop.className = 'pasaje-modal-backdrop';
    backdrop.innerHTML = `
      <div class="pasaje-modal" role="dialog" aria-modal="true" aria-labelledby="pasajeOrderTitle">
        <div class="pasaje-modal__header">
          <h2 class="pasaje-modal__title" id="pasajeOrderTitle">Confirmar Pedido</h2>
          <button class="pasaje-modal__close" type="button" aria-label="Cerrar">×</button>
        </div>

        <div class="pasaje-modal__product" data-role="product-summary"></div>

        <div class="pasaje-modal__body" data-role="form-wrap">
          <form data-role="order-form" novalidate>
            <div class="pasaje-field">
              <label for="pName">Nombre completo *</label>
              <input id="pName" name="customer_name" type="text" required autocomplete="name" placeholder="Tu nombre">
            </div>

            <div class="pasaje-field--row pasaje-field">
              <div>
                <label for="pPhone">WhatsApp *</label>
                <input id="pPhone" name="customer_phone" type="tel" required autocomplete="tel" placeholder="5555 5555">
              </div>
              <div>
                <label for="pEmail">Correo (opcional)</label>
                <input id="pEmail" name="customer_email" type="email" autocomplete="email" placeholder="tu@correo.com">
              </div>
            </div>

            <div class="pasaje-field">
              <label for="pDelivery">Tipo de entrega</label>
              <select id="pDelivery" name="delivery_type">
                <option value="pickup">Retiro en tienda</option>
                <option value="delivery">Envío a domicilio</option>
              </select>
            </div>

            <div class="pasaje-field" data-role="address-wrap" hidden>
              <label for="pAddress">Dirección de envío</label>
              <input id="pAddress" name="delivery_address" type="text" placeholder="Zona, calle, número, referencia">
            </div>

            <div class="pasaje-field">
              <label for="pNotes">Notas (opcional)</label>
              <textarea id="pNotes" name="notes" placeholder="Ej: entregar después de las 6pm"></textarea>
            </div>

            <div class="pasaje-field" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div>
                <label style="margin-bottom:2px;">Cantidad</label>
                <div class="pasaje-qty">
                  <button type="button" data-role="qty-minus">−</button>
                  <input type="number" name="qty" value="1" min="1" max="99" data-role="qty-input">
                  <button type="button" data-role="qty-plus">+</button>
                </div>
              </div>
            </div>

            <div class="pasaje-total">
              <span class="pasaje-total__label">Total</span>
              <span class="pasaje-total__value" data-role="total">Q 0.00</span>
            </div>

            <button class="pasaje-submit" type="submit" data-role="submit-btn">
              Enviar Pedido
            </button>
          </form>
        </div>

        <div class="pasaje-success" data-role="success-wrap" hidden>
          <div class="pasaje-success__icon">✓</div>
          <h3 class="pasaje-success__title">¡Pedido enviado!</h3>
          <p class="pasaje-success__msg">
            ✅ Mensaje enviado. La tienda te contactará pronto.
          </p>
          <button class="pasaje-success__btn" type="button" data-role="close-success">
            Seguir explorando
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeOrderModal();
    });

    backdrop.querySelector('.pasaje-modal__close').addEventListener('click', closeOrderModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('is-open')) {
        closeOrderModal();
      }
    });

    backdrop.querySelector('[data-role="close-success"]').addEventListener('click', closeOrderModal);

    const deliverySel = backdrop.querySelector('#pDelivery');
    const addressWrap = backdrop.querySelector('[data-role="address-wrap"]');
    deliverySel.addEventListener('change', () => {
      addressWrap.hidden = deliverySel.value !== 'delivery';
    });

    const qtyInput = backdrop.querySelector('[data-role="qty-input"]');
    const totalEl  = backdrop.querySelector('[data-role="total"]');

    function recalcTotal() {
      const qty = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
      qtyInput.value = qty;
      const price = Number(backdrop.dataset.unitPrice || 0);
      totalEl.textContent = MONEY(price * qty);
    }

    backdrop.querySelector('[data-role="qty-minus"]').addEventListener('click', () => {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
      recalcTotal();
    });
    backdrop.querySelector('[data-role="qty-plus"]').addEventListener('click', () => {
      qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
      recalcTotal();
    });
    qtyInput.addEventListener('input', recalcTotal);

    backdrop.querySelector('[data-role="order-form"]').addEventListener('submit', handleOrderSubmit);

    return backdrop;
  }

  let _currentOrderContext = null;

  function openOrderModal(product, selection) {
    injectStyles();
    const backdrop = ensureModal();
    const summary  = backdrop.querySelector('[data-role="product-summary"]');
    const form     = backdrop.querySelector('[data-role="order-form"]');
    const success  = backdrop.querySelector('[data-role="success-wrap"]');
    const formWrap = backdrop.querySelector('[data-role="form-wrap"]');

    _currentOrderContext = { product, selection };

    formWrap.hidden = false;
    success.hidden = true;
    form.reset();
    backdrop.querySelector('#pDelivery').value = 'pickup';
    backdrop.querySelector('[data-role="address-wrap"]').hidden = true;
    backdrop.querySelector('[data-role="qty-input"]').value = 1;

    prefillFromSession(form);

    const variantPieces = [];
    if (selection.color) variantPieces.push(selection.color);
    if (selection.size)  variantPieces.push(selection.size);

    summary.innerHTML = `
      <img src="${escapeHtml(selection.image || product.image_url || '')}" alt="">
      <div class="pasaje-modal__meta">
        <div class="pasaje-modal__name">${escapeHtml(product.title || product.name)}</div>
        ${variantPieces.length
          ? `<div class="pasaje-modal__variant">${escapeHtml(variantPieces.join(' · '))}</div>`
          : ''}
        <div class="pasaje-modal__price">${MONEY(selection.price)}</div>
      </div>
    `;

    backdrop.dataset.unitPrice = selection.price;
    backdrop.querySelector('[data-role="total"]').textContent = MONEY(selection.price);

    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      const first = backdrop.querySelector('#pName');
      if (first && !first.value) first.focus();
    }, 250);
  }

  function closeOrderModal() {
    const backdrop = document.getElementById(MODAL_ID);
    if (!backdrop) return;
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    _currentOrderContext = null;
  }

  // --------------------------------------------------------------------------
  // PREFILL desde sesión
  // --------------------------------------------------------------------------
  async function prefillFromSession(form) {
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      if (!session || !session.user) return;

      const email = session.user.email || '';
      const emailInput = form.querySelector('#pEmail');
      if (emailInput) emailInput.value = email;

      const { data: profile } = await sb
        .from('user_profiles')
        .select('full_name, phone, address')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        const nameInput    = form.querySelector('#pName');
        const phoneInput   = form.querySelector('#pPhone');
        const addressInput = form.querySelector('#pAddress');
        if (profile.full_name && nameInput && !nameInput.value) nameInput.value = profile.full_name;
        if (profile.phone && phoneInput && !phoneInput.value) phoneInput.value = profile.phone;
        if (profile.address && addressInput && !addressInput.value) addressInput.value = profile.address;
      }
    } catch (err) {
      console.warn('[ProductCard] prefill falló:', err);
    }
  }

  // --------------------------------------------------------------------------
  // SUBMIT del pedido
  // --------------------------------------------------------------------------
  async function handleOrderSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const backdrop = document.getElementById(MODAL_ID);
    const submitBtn = form.querySelector('[data-role="submit-btn"]');

    if (!_currentOrderContext) {
      showToast('No se pudo determinar el producto.', 'error');
      return;
    }

    const { product, selection } = _currentOrderContext;

    const name    = form.querySelector('#pName').value.trim();
    const phone   = form.querySelector('#pPhone').value.trim();
    const email   = form.querySelector('#pEmail').value.trim();
    const deliveryType = form.querySelector('#pDelivery').value;
    const address = form.querySelector('#pAddress').value.trim();
    const notes   = form.querySelector('#pNotes').value.trim();
    const qty     = Math.max(1, Math.min(99, parseInt(form.querySelector('[data-role="qty-input"]').value, 10) || 1));

    if (!name || name.length < 2) {
      showToast('Escribe tu nombre completo.', 'error');
      form.querySelector('#pName').focus();
      return;
    }
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      showToast('Escribe un WhatsApp válido.', 'error');
      form.querySelector('#pPhone').focus();
      return;
    }
    if (deliveryType === 'delivery' && !address) {
      showToast('Escribe la dirección de envío.', 'error');
      form.querySelector('#pAddress').focus();
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';

    const sb = getSupabase();
    if (!sb) {
      showToast('No se pudo conectar. Revisa tu conexión.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      return;
    }

    const item = {
      product_id: product.id,
      name: product.title || product.name,
      price: Number(selection.price),
      qty: qty,
      subtotal: Number(selection.price) * qty,
      image: selection.image || product.image_url || null,
      variant: {
        color: selection.color || null,
        size:  selection.size  || null
      }
    };

    const total = item.subtotal;

    let customerUserId = null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) customerUserId = session.user.id;
    } catch (_) { /* noop */ }

    const payload = {
      store_id: product.store_id || null,
      store_name_snapshot: product.store_name || null,
      customer_name: name,
      customer_phone: phone,
      customer_email: email || null,
      customer_address: deliveryType === 'delivery' ? address : null,
      customer_user_id: customerUserId,
      notes: notes || null,
      items: [item],
      total: total,
      item_count: qty,
      source_page: (typeof location !== 'undefined' ? location.pathname : null),
      status: 'new',
      status_updated_at: new Date().toISOString(),
      delivery_type: deliveryType,
      delivery_address: deliveryType === 'delivery' ? address : null,
      internal_order: true,
      merchant_viewed: false
    };

    let inserted = null;
    let insertError = null;

    try {
      const { data, error } = await sb
        .from('cart_orders')
        .insert(payload)
        .select('id, tracking_code')
        .maybeSingle();

      if (error) insertError = error;
      else inserted = data;
    } catch (err) {
      insertError = err;
    }

    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if (insertError) {
      console.error('[ProductCard] insert error:', insertError);
      showToast('No se pudo enviar el pedido. Intenta de nuevo.', 'error');
      return;
    }

    try {
      if (window.PasajeAudio && typeof window.PasajeAudio.playAlert === 'function') {
        window.PasajeAudio.playAlert('order');
      }
    } catch (_) { /* noop */ }

    const formWrap = backdrop.querySelector('[data-role="form-wrap"]');
    const success  = backdrop.querySelector('[data-role="success-wrap"]');
    formWrap.hidden = true;
    success.hidden = false;

    showToast('✅ Mensaje enviado. La tienda te contactará pronto.');

    console.info('[ProductCard] Pedido enviado:', inserted);
  }

  // --------------------------------------------------------------------------
  // BINDING de una tarjeta
  // --------------------------------------------------------------------------
  function bindCard(cardEl, product) {
    if (!cardEl || cardEl.dataset.pasajeBound === '1') return;
    cardEl.dataset.pasajeBound = '1';

    const img        = cardEl.querySelector('[data-role="main-image"]');
    const priceEl    = cardEl.querySelector('[data-role="price-value"]');
    const orderBtn   = cardEl.querySelector('[data-action="order-internal"]');
    const colorLabel = cardEl.querySelector('[data-role="color-label"]');
    const sizeLabel  = cardEl.querySelector('[data-role="size-label"]');

    function refreshVariantUI() {
      const colorName = cardEl.dataset.selectedColor || null;
      const sizeName  = cardEl.dataset.selectedSize  || null;
      const v = resolveVariant(product, colorName, sizeName);

      if (img && v.image && img.getAttribute('src') !== v.image) {
        img.style.opacity = '0.4';
        setTimeout(() => {
          img.src = v.image;
          img.style.opacity = '1';
        }, 120);
      }

      if (priceEl) {
        priceEl.textContent = MONEY(v.price);
      }

      if (colorLabel && colorName) colorLabel.textContent = colorName;
      if (sizeLabel && sizeName)   sizeLabel.textContent  = sizeName;

      const out = v.stock !== null && v.stock <= 0;
      if (orderBtn) {
        orderBtn.disabled = out;
        orderBtn.textContent = out ? 'Agotado' : 'Pedir';
      }

      cardEl.dataset.selectedPrice = v.price;
      cardEl.dataset.selectedImage = v.image;
      cardEl.dataset.selectedStock = v.stock === null ? '' : v.stock;

      const sizesEl = cardEl.querySelector('[data-role="sizes"]');
      if (sizesEl) {
        sizesEl.querySelectorAll('.pasaje-size').forEach(btn => {
          const sName = btn.dataset.size;
          const avail = isSizeAvailable(product, colorName, sName);
          btn.classList.toggle('is-out', !avail);
          btn.disabled = !avail;
        });
        const currentSize = cardEl.dataset.selectedSize;
        if (currentSize && !isSizeAvailable(product, colorName, currentSize)) {
          const firstOk = safeArray(product.sizes).find(s => isSizeAvailable(product, colorName, s.name));
          if (firstOk) {
            cardEl.dataset.selectedSize = firstOk.name;
            sizesEl.querySelectorAll('.pasaje-size').forEach(b => {
              b.classList.toggle('is-active', b.dataset.size === firstOk.name);
            });
            if (sizeLabel) sizeLabel.textContent = firstOk.name;
          }
        }
      }
    }

    const colorsEl = cardEl.querySelector('[data-role="colors"]');
    if (colorsEl) {
      colorsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.pasaje-swatch');
        if (!btn || btn.disabled) return;
        e.stopPropagation();
        colorsEl.querySelectorAll('.pasaje-swatch').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        cardEl.dataset.selectedColor = btn.dataset.color;
        refreshVariantUI();
      });
    }

    const sizesEl = cardEl.querySelector('[data-role="sizes"]');
    if (sizesEl) {
      sizesEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.pasaje-size');
        if (!btn || btn.disabled) return;
        e.stopPropagation();
        sizesEl.querySelectorAll('.pasaje-size').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        cardEl.dataset.selectedSize = btn.dataset.size;
        refreshVariantUI();
      });
    }

    if (orderBtn) {
      orderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const selection = {
          color: cardEl.dataset.selectedColor || null,
          size:  cardEl.dataset.selectedSize  || null,
          price: Number(cardEl.dataset.selectedPrice || product.price || 0),
          image: cardEl.dataset.selectedImage || product.image_url
        };
        openOrderModal(product, selection);
      });
    }
  }

  /**
   * Recorre el DOM y bindea todas las tarjetas pendientes.
   * Útil después de innerHTML = products.map(render).join('');
   */
  function bindAllCards(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const cards = scope.querySelectorAll('.product-card[data-product-id]:not([data-pasaje-bound="1"])');
    cards.forEach(cardEl => {
      const pid = cardEl.getAttribute('data-product-id');
      const product = (window.__pasajeProductsCache && window.__pasajeProductsCache[pid]) || null;
      if (product) bindCard(cardEl, product);
    });
  }

  // --------------------------------------------------------------------------
  // API PÚBLICA
  // --------------------------------------------------------------------------
  window.ProductCardUI = {
    // Legacy
    render: renderCardHTML,
    renderGalleryHTML,
    renderVariantsHTML,
    renderStars,
    escapeHtml,
    buildWAUrl,
    getStockStatus,
    formatExpiration,

    // Nuevas utilidades
    bindCard,
    bindAllCards,
    openOrderModal,
    closeOrderModal,
    showToast,
    injectStyles,
    MONEY,
    _resolveVariant: resolveVariant,
    _isColorAvailable: isColorAvailable,
    _isSizeAvailable: isSizeAvailable,
    _renderColorSwatches: renderColorSwatchesHTML,
    _renderSizePills: renderSizePillsHTML,
    _renderVariantsSelector: renderVariantsSelectorHTML
  };

  // Alias de compatibilidad con la versión previa del helper
  window.PasajeProductCard = window.ProductCardUI;

  // Auto-inyectar estilos apenas carga el script
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
  } else {
    injectStyles();
  }
})();
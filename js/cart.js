// =============================================================
// /js/cart.js
// Gestor de Carrito de Compras — FASE 22
// Flujo interno: guarda en cart_orders (status='new') sin abrir WhatsApp.
// Soporta variantes nuevas (variant.color + variant.size).
// =============================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'pasaje_cart_items';
  let cartItems = [];
  let deliveryType = 'pickup';

  // ---------------- Carga defensiva ----------------
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cartItems = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cartItems)) cartItems = [];
  } catch (e) {
    console.warn('[Cart] Error al leer localStorage, reiniciando carrito:', e);
    cartItems = [];
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.error('[Cart] Error guardando en localStorage:', e);
    }
    updateCartBadge();
  }

  function updateCartBadge() {
    const totalCount = cartItems.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 1), 0);
    document.querySelectorAll('.cart-count-badge').forEach(el => {
      el.textContent = totalCount;
      if (totalCount > 0) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  // ---------------- Variantes ----------------
  function buildVariantKey(variant) {
    if (!variant) return null;
    const parts = [];
    if (variant.color) parts.push(String(variant.color));
    if (variant.size) parts.push(String(variant.size));
    return parts.length ? parts.join('-') : null;
  }

  function variantLabel(variant) {
    if (!variant) return '';
    const parts = [];
    if (variant.color) parts.push(variant.color);
    if (variant.size) parts.push(variant.size);
    return parts.join(' / ');
  }

  // ---------------- API pública ----------------
  function addToCart(product) {
    if (!product || !product.id) return;
    const pId = String(product.id);

    // Aceptar variante en formato nuevo { color, size } o legacy string
    let variant = null;
    if (product.selectedVariant && typeof product.selectedVariant === 'object') {
      variant = {
        color: product.selectedVariant.color || null,
        size: product.selectedVariant.size || null
      };
    } else if (typeof product.selectedVariant === 'string' && product.selectedVariant.length > 0) {
      variant = { color: product.selectedVariant, size: null };
    }

    const variantKey = buildVariantKey(variant);
    const existing = cartItems.find(item =>
      String(item.id) === pId && buildVariantKey(item.variant) === variantKey
    );

    if (existing) {
      existing.quantity = (parseInt(existing.quantity, 10) || 1) + 1;
    } else {
      cartItems.push({
        id: product.id,
        title: product.title || 'Producto',
        price: parseFloat(product.price || 0),
        image_url: product.image_url || '',
        storeId: product.storeId || product.store_id || null,
        storeName: product.storeName || product.store_name || 'Tienda local',
        storeWhatsapp: product.storeWhatsapp || product.store_whatsapp || '',
        quantity: 1,
        variant: variant
      });
    }
    saveCart();
    openDrawer();
  }

  function removeFromCart(index) {
    if (index >= 0 && index < cartItems.length) {
      cartItems.splice(index, 1);
      saveCart();
      renderCartDrawer();
    }
  }

  function updateQuantity(index, delta) {
    if (index >= 0 && index < cartItems.length) {
      const newQty = (parseInt(cartItems[index].quantity, 10) || 1) + delta;
      if (newQty <= 0) cartItems.splice(index, 1);
      else cartItems[index].quantity = newQty;
      saveCart();
      renderCartDrawer();
    }
  }

  // ---------------- Drawer UI ----------------
  function buildCartUI() {
    if (document.getElementById('cartDrawerOverlay')) return;
    if (!document.body) return;

    const drawerHTML = `
      <div id="cartDrawerOverlay" class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity">
        <div id="cartDrawer" class="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col justify-between overflow-hidden transition-transform duration-200 transform translate-x-full">
          <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
            <div class="flex items-center gap-2">
              <span class="text-xl">🛒</span>
              <h2 class="font-extrabold text-base">Mi Carrito de Compras</h2>
            </div>
            <button id="closeCartDrawerBtn" type="button" class="text-slate-300 hover:text-white text-lg font-bold p-1">✕</button>
          </div>
          <div id="cartItemsContainer" class="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100"></div>
          <div class="p-4 bg-slate-50 border-t border-slate-200/80 space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">🚚 Método de Entrega *</label>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" id="deliveryTabPickup" class="delivery-type-btn text-xs font-bold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition bg-emerald-600 text-white border-emerald-600 shadow-sm"><span>🏪 Recoger (Pickup)</span></button>
                <button type="button" id="deliveryTabDelivery" class="delivery-type-btn text-xs font-bold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition bg-white text-slate-700 border-slate-200 hover:border-emerald-500"><span>🛵 Envío a domicilio</span></button>
              </div>
            </div>
            <div class="space-y-2 pt-1">
              <input type="text" id="cartCustomerName" placeholder="Tu nombre completo *" class="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white text-slate-800 outline-none font-semibold">
              <input type="tel" id="cartCustomerPhone" placeholder="Tu número de teléfono / WhatsApp *" class="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white text-slate-800 outline-none font-semibold">
              <input type="email" id="cartCustomerEmail" placeholder="Tu correo (opcional)" class="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white text-slate-800 outline-none font-semibold">
              <div id="deliveryFieldsContainer" class="hidden space-y-2">
                <input type="text" id="cartDeliveryAddress" placeholder="Dirección de entrega (Calle, No. Casa, Zona) *" class="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white text-slate-800 outline-none font-semibold">
                <input type="text" id="cartDeliveryRef" placeholder="Referencia / Municipio (opcional)" class="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white text-slate-800 outline-none font-semibold">
              </div>
              <textarea id="cartNotes" rows="2" placeholder="Notas para la tienda (opcional)" class="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white text-slate-800 outline-none font-semibold resize-none"></textarea>
            </div>
            <div class="flex items-center justify-between pt-2">
              <span class="text-xs font-bold text-slate-500 uppercase">Total a pagar:</span>
              <span id="cartTotalDisplay" class="text-xl font-black text-emerald-600">Q 0.00</span>
            </div>
            <button type="button" id="checkoutInternalBtn" class="w-full bg-gradient-to-br from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold py-3 rounded-xl text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-2">
              <span>Enviar Pedido</span>
            </button>
            <p class="text-[10px] text-slate-500 text-center">
              ✅ Tu pedido llegará directo al buzón de la tienda. Te contactarán pronto.
            </p>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', drawerHTML);

    document.getElementById('closeCartDrawerBtn')?.addEventListener('click', closeDrawer);
    document.getElementById('cartDrawerOverlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('cartDrawerOverlay')) closeDrawer();
    });

    const tabPickup = document.getElementById('deliveryTabPickup');
    const tabDelivery = document.getElementById('deliveryTabDelivery');
    const fieldsContainer = document.getElementById('deliveryFieldsContainer');

    tabPickup?.addEventListener('click', () => {
      deliveryType = 'pickup';
      tabPickup.className = 'delivery-type-btn text-xs font-bold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition bg-emerald-600 text-white border-emerald-600 shadow-sm';
      tabDelivery.className = 'delivery-type-btn text-xs font-bold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition bg-white text-slate-700 border-slate-200 hover:border-emerald-500';
      fieldsContainer?.classList.add('hidden');
    });

    tabDelivery?.addEventListener('click', () => {
      deliveryType = 'delivery';
      tabDelivery.className = 'delivery-type-btn text-xs font-bold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition bg-emerald-600 text-white border-emerald-600 shadow-sm';
      tabPickup.className = 'delivery-type-btn text-xs font-bold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition bg-white text-slate-700 border-slate-200 hover:border-emerald-500';
      fieldsContainer?.classList.remove('hidden');
    });

    document.getElementById('checkoutInternalBtn')?.addEventListener('click', handleCheckout);
  }

  function renderCartDrawer() {
    buildCartUI();
    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotalDisplay');
    const placeholder = window.PLACEHOLDER_IMG || 'img/placeholder.png';
    if (!container) return;

    if (cartItems.length === 0) {
      container.innerHTML = '<div class="py-12 text-center text-slate-400"><p class="text-4xl mb-2">🛒</p><p class="text-xs font-bold text-slate-600">Tu carrito está vacío</p></div>';
      if (totalEl) totalEl.textContent = 'Q 0.00';
      return;
    }

    let total = 0;
    container.innerHTML = cartItems.map((item, idx) => {
      const qty = parseInt(item.quantity, 10) || 1;
      const itemTotal = (parseFloat(item.price) || 0) * qty;
      total += itemTotal;
      const label = variantLabel(item.variant);
      const variantTxt = label ? ` (${label})` : '';
      return `
        <div class="pt-3 flex items-center gap-3">
          <img src="${item.image_url || placeholder}" class="w-12 h-12 rounded-xl object-cover bg-slate-100 border flex-shrink-0">
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-slate-800 truncate">${item.title}${variantTxt}</h4>
            <p class="text-[11px] text-slate-500">🏪 ${item.storeName || 'Tienda'}</p>
            <p class="text-xs font-black text-emerald-600">Q ${itemTotal.toFixed(2)}</p>
          </div>
          <div class="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
            <button type="button" data-cart-action="minus" data-index="${idx}" class="w-6 h-6 rounded bg-white font-bold text-slate-700 text-xs">-</button>
            <span class="text-xs font-extrabold px-1">${qty}</span>
            <button type="button" data-cart-action="plus" data-index="${idx}" class="w-6 h-6 rounded bg-white font-bold text-slate-700 text-xs">+</button>
          </div>
          <button type="button" data-cart-action="remove" data-index="${idx}" class="text-slate-400 hover:text-rose-500 p-1 text-xs">🗑️</button>
        </div>`;
    }).join('');

    if (totalEl) totalEl.textContent = `Q ${total.toFixed(2)}`;

    container.querySelectorAll('[data-cart-action]').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.cartAction;
        const idx = parseInt(btn.dataset.index, 10);
        if (action === 'plus') updateQuantity(idx, 1);
        if (action === 'minus') updateQuantity(idx, -1);
        if (action === 'remove') removeFromCart(idx);
      };
    });
  }

  // ---------------- Checkout interno ----------------
  async function handleCheckout() {
    if (cartItems.length === 0) { alert('Tu carrito está vacío.'); return; }

    const firstStore = cartItems[0];

    const customerName = document.getElementById('cartCustomerName')?.value.trim() || '';
    const customerPhone = document.getElementById('cartCustomerPhone')?.value.trim() || '';
    const customerEmail = document.getElementById('cartCustomerEmail')?.value.trim() || '';
    const address = document.getElementById('cartDeliveryAddress')?.value.trim() || '';
    const reference = document.getElementById('cartDeliveryRef')?.value.trim() || '';
    const notes = document.getElementById('cartNotes')?.value.trim() || '';

    if (!customerName) { alert('Por favor ingresa tu nombre completo.'); return; }
    if (!customerPhone) { alert('Por favor ingresa tu número de teléfono / WhatsApp.'); return; }
    if (deliveryType === 'delivery' && !address) { alert('Por favor ingresa la dirección para el envío.'); return; }

    const total = cartItems.reduce(
      (sum, i) => sum + ((parseFloat(i.price) || 0) * (parseInt(i.quantity, 10) || 1)),
      0
    );
    const totalItemCount = cartItems.reduce(
      (sum, i) => sum + (parseInt(i.quantity, 10) || 1),
      0
    );

    const sb = window._supabase || window.supabaseClient || window.supabase;
    if (!sb) {
      alert('No se pudo conectar con el servidor. Revisa tu conexión.');
      return;
    }

    // user_id si hay sesión
    let customerUserId = null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) customerUserId = session.user.id;
    } catch (_) { /* noop */ }

    const items = cartItems.map(i => {
      const variantObj = i.variant
        ? { color: i.variant.color || null, size: i.variant.size || null }
        : { color: null, size: null };
      const qty = parseInt(i.quantity, 10) || 1;
      const price = parseFloat(i.price) || 0;
      return {
        product_id: i.id,
        name: i.title,
        price: price,
        qty: qty,
        subtotal: price * qty,
        image: i.image_url || null,
        variant: variantObj
      };
    });

    const payload = {
      store_id: firstStore.storeId || null,
      store_name_snapshot: firstStore.storeName || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      customer_address: deliveryType === 'delivery' ? address : null,
      customer_user_id: customerUserId,
      notes: notes || reference || null,
      items: items,
      total: total,
      item_count: totalItemCount,
      source_page: window.location.pathname,
      status: 'new',
      status_updated_at: new Date().toISOString(),
      delivery_type: deliveryType,
      delivery_address: deliveryType === 'delivery' ? address : null,
      delivery_reference: reference || null,
      internal_order: true,
      merchant_viewed: false
    };

    // Bloquear botón
    const btn = document.getElementById('checkoutInternalBtn');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    let insertError = null;
    let inserted = null;
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

    if (btn) { btn.disabled = false; btn.textContent = originalLabel; }

    if (insertError) {
  console.error('[Cart] Error guardando pedido:', insertError);
  // 👇 Muestra el mensaje real del servidor
  const detail = insertError.message || insertError.details || insertError.hint || 'Error desconocido';
  alert('No se pudo enviar el pedido.\n\nDetalle: ' + detail);
  return;
}

    // Sonido opcional
    try {
      if (window.PasajeAudio && typeof window.PasajeAudio.playAlert === 'function') {
        window.PasajeAudio.playAlert('order');
      }
    } catch (_) { /* noop */ }

    // Vaciar carrito
    cartItems = [];
    saveCart();

    // Feedback visual dentro del drawer
    const container = document.getElementById('cartItemsContainer');
    if (container) {
      container.innerHTML = `
        <div class="py-12 text-center">
          <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-3xl shadow-lg">✓</div>
          <h3 class="text-base font-extrabold text-slate-800 mb-1">¡Pedido enviado!</h3>
          <p class="text-xs text-slate-500 max-w-xs mx-auto">
            ✅ Mensaje enviado. La tienda te contactará pronto.
          </p>
          ${inserted && inserted.tracking_code ? `
            <p class="text-[11px] text-slate-400 mt-3">Código: <strong>${inserted.tracking_code}</strong></p>
          ` : ''}
        </div>`;
    }

    const totalEl = document.getElementById('cartTotalDisplay');
    if (totalEl) totalEl.textContent = 'Q 0.00';

    // Cerrar después de 2.5s
    setTimeout(() => closeDrawer(), 2500);

    console.info('[Cart] Pedido enviado:', inserted);
  }

  // ---------------- Abrir / cerrar ----------------
  function openDrawer() {
    buildCartUI();
    renderCartDrawer();
    const overlay = document.getElementById('cartDrawerOverlay');
    const drawer = document.getElementById('cartDrawer');
    if (overlay && drawer) {
      overlay.classList.remove('hidden');
      setTimeout(() => drawer.classList.remove('translate-x-full'), 10);
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDrawer() {
    const overlay = document.getElementById('cartDrawerOverlay');
    const drawer = document.getElementById('cartDrawer');
    if (overlay && drawer) {
      drawer.classList.add('translate-x-full');
      setTimeout(() => {
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
      }, 200);
    }
  }

  // ---------------- Exponer API ----------------
  window.PasajeCart = {
    addToCart,
    removeFromCart,
    openDrawer,
    closeDrawer,
    getCart: () => cartItems.slice()
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCartBadge);
  } else {
    updateCartBadge();
  }
})();
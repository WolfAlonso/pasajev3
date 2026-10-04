// =============================================================
// js/delivery/delivery-feed.js
// Feed de carreras disponibles + contraofertas
// Expone: window.DeliveryFeed = { render, load, handleAccept, refresh }
// =============================================================
(function () {
  'use strict';

  function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  /**
   * Renderiza la lista de solicitudes disponibles.
   * @param {Array} list  - Filtradas previamente por el caller
   * @param {Object} ctx  - { currentDriver, isSuspended }
   * @param {HTMLElement} container
   * @param {Function} onAccept - callback(requestId, enteredFee, suggestedFee)
   */
  function render(list, ctx, container, onAccept) {
    if (!container) return;

    if (!list.length) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
          <p class="text-3xl mb-2">🛵</p>
          <p class="text-xs font-bold text-slate-500">No hay solicitudes disponibles en este momento.</p>
          <p class="text-[11px] text-slate-400 mt-1">Actívate como disponible y espera nuevas carreras.</p>
        </div>`;
      return;
    }

    const suspended = !!ctx.isSuspended;

    container.innerHTML = list.map(r => {
      const suggested = parseFloat(r.suggested_fee || r.fee || 15).toFixed(2);
      const manualBadge = (!r.order_id && !r.store_id) ? `
        <span class="text-[9px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">🎯 EXPRESS</span>
      ` : (!r.order_id ? `
        <span class="text-[9px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">🎯 DIRECTO</span>
      ` : '');

      const originName = r.stores?.name ? `🏪 ${esc(r.stores.name)}` : '🛵 Pasaje Express';
      const lockClass = suspended ? 'opacity-50 cursor-not-allowed pointer-events-none' : '';

      return `
        <article class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
          <div class="flex items-start justify-between border-b border-slate-100 pb-3 gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-black text-sm text-slate-900 truncate">${originName}</p>
                ${manualBadge}
              </div>
              <p class="text-[10px] font-mono text-slate-400 mt-0.5">#${esc(String(r.id).slice(0, 8).toUpperCase())}</p>
              <p class="text-[11px] text-slate-500 mt-1">📅 ${fmtDateTime(r.created_at)}</p>
            </div>
            <span class="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-1 rounded-full uppercase flex-shrink-0">pendiente</span>
          </div>

          <div class="space-y-1.5 text-xs">
            <p class="flex items-start gap-1.5"><span>📍</span><span class="font-semibold text-slate-700">${esc(r.origin_address || 'Tienda')}</span></p>
            <p class="flex items-start gap-1.5"><span>🎯</span><span class="font-semibold text-slate-700">${esc(r.destination_address || 'Cliente')}</span></p>
            ${r.customer_name ? `<p class="flex items-start gap-1.5"><span>👤</span><span class="text-slate-700">${esc(r.customer_name)}</span></p>` : ''}
            ${r.notes ? `<p class="flex items-start gap-1.5 text-slate-500 italic"><span>📝</span><span>${esc(r.notes)}</span></p>` : ''}
          </div>

          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
            <label class="block text-[10px] font-black text-emerald-800 uppercase">Tu tarifa de cobro (Q):</label>
            <div class="flex items-center gap-2">
              <span class="text-sm font-black text-emerald-700">Q</span>
              <input type="number" min="0" step="0.50" value="${suggested}" data-fee-input="${r.id}" ${suspended ? 'disabled' : ''}
                class="flex-1 border border-emerald-300 px-3 py-2 rounded-xl text-sm font-black text-emerald-700 bg-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50" />
            </div>
            <p class="text-[10px] text-emerald-700 leading-tight">
              💡 Sugerida: <strong>Q${suggested}</strong>. Si cambias el monto se envía como <strong>contraoferta</strong>.
            </p>
          </div>

          <button type="button" data-action="accept-request" data-id="${r.id}" data-suggested="${suggested}"
            class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm ${lockClass}">
            ${suspended ? '⛔ Suspendido' : '✅ Aceptar / Enviar'}
          </button>
        </article>`;
    }).join('');

    if (!suspended) {
      container.querySelectorAll('[data-action="accept-request"]').forEach(btn => {
        btn.onclick = () => {
          const feeInput = document.querySelector(`[data-fee-input="${btn.dataset.id}"]`);
          const entered = feeInput ? parseFloat(feeInput.value) : NaN;
          onAccept(btn.dataset.id, entered, parseFloat(btn.dataset.suggested));
        };
      });
    }
  }

  window.DeliveryFeed = { render, esc, fmtDateTime };
})();
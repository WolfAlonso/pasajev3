// =============================================================
// js/delivery/delivery-active.js
// Render de carreras activas + gestión de PIN
// Expone: window.DeliveryActive = { render, openPin, validate }
// =============================================================
(function () {
  'use strict';

  function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Renderiza la lista de carreras activas.
   * @param {Array} list
   * @param {HTMLElement} container
   * @param {Object} handlers - { onChat, onPin, onCancel }
   */
  function render(list, container, handlers) {
    if (!container) return;

    if (!list.length) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
          <p class="text-3xl mb-2">🛵</p>
          <p class="text-xs font-bold text-slate-500">No tienes carreras activas.</p>
        </div>`;
      return;
    }

    container.innerHTML = list.map(r => {
      const fee = parseFloat(r.final_fee || r.counter_fee || r.suggested_fee || 0).toFixed(2);
      const isPickupStep = r.status === 'accepted';
      const storeName = r.stores?.name ? `🏪 ${esc(r.stores.name)}` : '🛵 Pasaje Express';

      const pinBox = isPickupStep ? `
        <div class="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-1">
          <div class="flex items-center gap-2"><span class="text-lg">📌</span>
            <span class="text-[11px] font-black text-amber-900 uppercase tracking-wide">Recolección pendiente</span></div>
          <p class="text-[11px] text-amber-800 leading-snug">Al llegar al origen, <strong>pide el PIN de 4 dígitos</strong> y valídalo aquí.</p>
        </div>` : `
        <div class="bg-emerald-50 border border-emerald-300 rounded-xl p-3 space-y-1">
          <div class="flex items-center gap-2"><span class="text-lg">🔑</span>
            <span class="text-[11px] font-black text-emerald-900 uppercase tracking-wide">Entrega en curso</span></div>
          <p class="text-[11px] text-emerald-800 leading-snug">Al entregar al cliente, <strong>pide su PIN de 4 dígitos</strong> y valídalo.</p>
        </div>`;

      return `
        <article class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
          <div class="flex items-start justify-between border-b border-slate-100 pb-3">
            <div class="min-w-0">
              <p class="font-black text-sm text-slate-900 truncate">${storeName}</p>
              <p class="text-[10px] font-mono text-slate-400 mt-0.5">#${esc(String(r.id).slice(0, 8).toUpperCase())}</p>
              <span class="inline-block mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isPickupStep ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
                ${isPickupStep ? '📌 Por recoger' : '🚀 En ruta al cliente'}
              </span>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-slate-500 font-bold uppercase">Tarifa</p>
              <p class="font-black text-emerald-600 text-base">Q${fee}</p>
            </div>
          </div>

          <div class="space-y-1.5 text-xs">
            <p class="flex items-start gap-1.5"><span class="font-black text-slate-500">📍</span><span class="font-semibold text-slate-700">${esc(r.origin_address || 'Origen')}</span></p>
            <p class="flex items-start gap-1.5"><span class="font-black text-slate-500">🎯</span><span class="font-semibold text-slate-700">${esc(r.destination_address || 'Destino')}</span></p>
            ${r.customer_name ? `<p class="flex items-start gap-1.5"><span>👤</span><span class="text-slate-700">${esc(r.customer_name)}</span></p>` : ''}
          </div>

          ${pinBox}

          <div class="grid grid-cols-2 gap-2">
            <button type="button" data-action="open-chat"
              class="bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm">💬 Chat</button>
            ${isPickupStep ? `
              <button type="button" data-action="validate-pickup"
                class="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm">📌 Recoger</button>
            ` : `
              <button type="button" data-action="validate-delivery"
                class="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm">🔑 Entregar</button>
            `}
          </div>

          ${r.customer_phone ? `
            <a href="https://wa.me/${String(r.customer_phone).replace(/\D/g,'')}" target="_blank"
              class="block w-full text-center bg-[#25D366] hover:bg-[#128C7E] text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm">
              📱 WhatsApp Cliente
            </a>` : ''}

          <button type="button" data-action="cancel-trip"
            class="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold py-2 rounded-xl text-xs transition border border-rose-200">
            🚫 Cancelar Carrera
          </button>
        </article>`;
    }).join('');

    // Bind events
    container.querySelectorAll('[data-action]').forEach(el => {
      const action = el.dataset.action;
      const card = el.closest('article');
      const id = card?.querySelector('[class*="font-mono"]')?.textContent?.replace('#', '') || '';
      // Buscar por índice la request real
      const idx = Array.from(container.children).indexOf(card);
      const req = list[idx];
      if (!req) return;

      if (action === 'open-chat')         el.onclick = () => handlers.onChat(req);
      if (action === 'validate-pickup')   el.onclick = () => handlers.onPin(req, 'pickup');
      if (action === 'validate-delivery') el.onclick = () => handlers.onPin(req, 'delivery');
      if (action === 'cancel-trip')       el.onclick = () => handlers.onCancel(req);
    });
  }

  /**
   * Abre el modal de PIN
   */
  function openPin(step, req, submitHandler) {
    const modal = document.getElementById('pinValidateModal');
    if (!modal) return;

    document.getElementById('pinValidateRequestId').value = req.id;
    document.getElementById('pinValidateStep').value = step;
    document.getElementById('pinValidateInput').value = '';

    const titleEl = document.getElementById('pinValidateTitle');
    const descEl = document.getElementById('pinValidateDesc');

    if (step === 'pickup') {
      titleEl.textContent = '📌 Validar PIN de Recolección';
      descEl.textContent = 'Pídele el PIN de 4 dígitos al origen (comercio o cliente que te contrata).';
    } else {
      titleEl.textContent = '🔑 Validar PIN de Entrega';
      descEl.textContent = 'Pídele el PIN de 4 dígitos al destinatario final.';
    }

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('pinValidateInput').focus(), 80);

    // Rebind submit
    const confirmBtn = document.getElementById('btnPinConfirm');
    const cancelBtn = document.getElementById('btnPinCancel');

    cancelBtn.onclick = () => modal.classList.add('hidden');
    confirmBtn.onclick = () => {
      const entered = document.getElementById('pinValidateInput').value.trim();
      submitHandler(step, req, entered, modal);
    };
  }

  window.DeliveryActive = { render, openPin, esc };
})();
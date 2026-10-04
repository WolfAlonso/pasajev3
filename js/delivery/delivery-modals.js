// =============================================================
// js/delivery/delivery-modals.js
// Chat en vivo, cancelación con auditoría y valoraciones
// Expone: window.DeliveryModals = { openChat, openCancel, openRating }
// =============================================================
(function () {
  'use strict';

  let chatChannel = null;

  function client() {
    return window._supabase || (typeof initSupabaseClient === 'function' ? initSupabaseClient() : null);
  }

  function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // =========================================================
  // CHAT
  // =========================================================
  async function loadChatMessages(requestId) {
    const container = document.getElementById('driverChatMessages');
    if (!container) return;
    const c = client();
    if (!c) return;

    const { data } = await c.from('delivery_messages')
      .select('*').eq('request_id', requestId).order('created_at', { ascending: true });

    if (!data || data.length === 0) {
      container.innerHTML = `<p class="text-center text-slate-400 py-4 font-medium">No hay mensajes aún.</p>`;
      return;
    }

    container.innerHTML = data.map(m => {
      const isMe = m.sender_role === 'driver';
      return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
          <span class="text-[9px] text-slate-400 font-bold mb-0.5">${esc(m.sender_name || (isMe ? 'Tú' : 'Cliente'))}</span>
          <div class="${isMe ? 'bg-emerald-600 text-white' : 'bg-white text-slate-800 border border-slate-200'} px-3 py-1.5 rounded-2xl max-w-[80%] font-medium">
            ${esc(m.message)}
          </div>
        </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  function openChat(req, currentUser, currentDriver) {
    const modal = document.getElementById('driverChatModal');
    if (!modal) return;

    document.getElementById('chatRequestId').value = req.id;
    const nameEl = document.getElementById('chatStoreName');
    if (nameEl) nameEl.textContent = req.stores?.name || req.customer_name || 'Contacto';

    modal.classList.remove('hidden');
    loadChatMessages(req.id);

    // Chat realtime
    const c = client();
    if (chatChannel) { try { chatChannel.unsubscribe(); } catch (e) {} }
    if (c) {
      chatChannel = c.channel(`chat_driver:${req.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'delivery_messages',
          filter: `request_id=eq.${req.id}`
        }, () => loadChatMessages(req.id))
        .subscribe();
    }

    // Bind form
    const form = document.getElementById('driverChatForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('driverChatMessageInput');
      const msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      const cc = client();
      await cc.from('delivery_messages').insert([{
        request_id: req.id,
        sender_id: currentUser.id,
        sender_role: 'driver',
        sender_name: currentDriver?.full_name || 'Piloto',
        message: msg
      }]);
      loadChatMessages(req.id);
    };

    document.getElementById('closeDriverChatBtn').onclick = () => {
      modal.classList.add('hidden');
      if (chatChannel) { try { chatChannel.unsubscribe(); } catch (e) {} chatChannel = null; }
    };
  }

  // =========================================================
  // CANCELACIÓN
  // =========================================================
  function openCancel(req, currentUser, onDone) {
    const modal = document.getElementById('cancelTripModal');
    if (!modal) return;

    document.getElementById('cancelRequestId').value = req.id;
    document.getElementById('cancelStartedAt').value = req.updated_at || req.created_at || new Date().toISOString();
    document.getElementById('cancelReasonSelect').value = 'No puedo llegar al punto de recolección';
    document.getElementById('cancelNotesInput').value = '';
    modal.classList.remove('hidden');

    document.getElementById('btnCancelModalClose').onclick = () => modal.classList.add('hidden');

    document.getElementById('btnConfirmCancelTrip').onclick = async () => {
      const reason = document.getElementById('cancelReasonSelect').value;
      const notes = document.getElementById('cancelNotesInput').value.trim();
      if (!notes) { alert('Por favor ingresa una explicación.'); return; }

      const startIso = document.getElementById('cancelStartedAt').value;
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));

      const c = client();
      const { error } = await c.from('delivery_requests').update({
        status: 'cancelled_pending_review',
        cancelled_at: new Date().toISOString(),
        cancelled_by_role: 'driver',
        cancelled_by_user_id: currentUser.id,
        cancellation_reason: `${reason} — ${notes}`,
        time_elapsed_seconds: elapsed,
        updated_at: new Date().toISOString()
      }).eq('id', req.id);

      if (error) { alert('Error: ' + error.message); return; }

      modal.classList.add('hidden');
      alert('🚫 Carrera cancelada. Enviada a auditoría.');
      if (typeof onDone === 'function') onDone();
    };
  }

  // =========================================================
  // VALORACIÓN
  // =========================================================
  function openRating(req, onDone) {
    const modal = document.getElementById('rateDriverModal');
    // Reutilizamos el mismo modal de rating pero para uso desde vendedor/comprador.
    // Si no existe, no bloquea.
    if (!modal) return;
    if (typeof onDone === 'function') onDone();
  }

  window.DeliveryModals = {
    openChat,
    openCancel,
    openRating,
    loadChatMessages
  };
})();
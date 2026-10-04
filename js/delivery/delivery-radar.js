// =============================================================
// js/delivery/delivery-radar.js
// Radar de subasta + GPS bidireccional (Cliente <-> Piloto)
// Ubicación: /delivery/radar.html
// =============================================================

(function () {
  'use strict';

  const LAST_REQ_KEY = 'pasaje_express_last_request';
  const XELA_CENTER = { lat: 14.8347, lng: -91.5186 };

  let session = null;
  let activeRequest = null;
  let activeOffers = [];

  let requestsChannel = null;
  let offersChannel = null;
  let pollTimer = null;
  let customerWatchId = null;
  let lastCustomerPingAt = 0;

  // Leaflet
  let radarMap = null;
  let customerMarker = null;
  let driverMarker = null;
  let originMarker = null;
  let destMarker = null;
  let routeLine = null;

  // -------------------------------------------------------------
  function client() {
    return window._supabase || (typeof initSupabaseClient === 'function' ? initSupabaseClient() : null);
  }

  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function fmtMoney(n) { return `Q${parseFloat(n || 0).toFixed(2)}`; }

  function getRequestIdFromUrl() {
    const p = new URLSearchParams(window.location.search);
    return p.get('id') || '';
  }

  // -------------------------------------------------------------
  // Cargar request + ofertas
  // -------------------------------------------------------------
  async function loadRequest() {
    const c = client();
    if (!c || !activeRequest) return;

    const { data, error } = await c
      .from('delivery_requests')
      .select(`
        *,
        driver:delivery_drivers!delivery_requests_driver_id_fkey(
          id, full_name, phone, vehicle_type, license_plate, rating_avg, total_trips
        )
      `)
      .eq('id', activeRequest.id)
      .maybeSingle();

    if (error || !data) return;
    activeRequest = data;
  }

  async function loadOffers() {
    const c = client();
    if (!c || !activeRequest) return;

    const { data } = await c
      .from('delivery_offers')
      .select(`
        *,
        driver:delivery_drivers!delivery_offers_driver_id_fkey(
          id, full_name, phone, vehicle_type, license_plate, rating_avg, total_trips
        )
      `)
      .eq('request_id', activeRequest.id)
      .in('status', ['pending', 'accepted'])
      .order('proposed_fee', { ascending: true });

    activeOffers = data || [];
  }

  async function refresh() {
    await loadRequest();
    await loadOffers();
    renderAll();
    updateMap();
  }

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  function renderAll() {
    renderStatusHeader();
    renderRouteCard();
    renderOffers();
    renderDriverCard();
    renderPinCard();
    renderCancelBtn();
  }

  function renderStatusHeader() {
    const el = document.getElementById('radarStatusHeader');
    if (!el || !activeRequest) return;
    const r = activeRequest;
    const statusMap = {
      'pending':                  { label: '⏳ Buscando piloto', cls: 'bg-amber-100 text-amber-800 border-amber-300', emoji: '⏳' },
      'counter_offered':          { label: '🔥 Tienes ofertas', cls: 'bg-blue-100 text-blue-800 border-blue-300', emoji: '🔥' },
      'accepted':                 { label: '✅ Piloto asignado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', emoji: '✅' },
      'in_transit':               { label: '🛵 En tránsito', cls: 'bg-purple-100 text-purple-800 border-purple-300', emoji: '🛵' },
      'on_the_way':               { label: '🛵 En camino', cls: 'bg-purple-100 text-purple-800 border-purple-300', emoji: '🛵' },
      'delivered':                { label: '🎉 Entregado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', emoji: '🎉' },
      'completed':                { label: '🎉 Completado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', emoji: '🎉' },
      'cancelled':                { label: '❌ Cancelado', cls: 'bg-rose-100 text-rose-800 border-rose-300', emoji: '❌' },
      'cancelled_pending_review': { label: '⚠️ Cancelado (revisión)', cls: 'bg-amber-100 text-amber-900 border-amber-300', emoji: '⚠️' }
    };
    const info = statusMap[r.status] || statusMap.pending;
    el.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-3xl">${info.emoji}</span>
        <div class="min-w-0">
          <div class="inline-block px-3 py-1 rounded-full text-xs font-black border ${info.cls}">${info.label}</div>
          <p class="text-[10px] font-mono text-slate-400 mt-1">Ticket: ${esc(String(r.id).slice(0, 8).toUpperCase())}</p>
        </div>
      </div>
    `;
  }

  function renderRouteCard() {
    const el = document.getElementById('radarRouteCard');
    if (!el || !activeRequest) return;
    const r = activeRequest;
    el.innerHTML = `
      <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-xs">
        <p class="flex items-start gap-1.5"><span class="text-slate-400">📍</span><span class="text-slate-700">${esc(r.origin_address)}</span></p>
        <p class="flex items-start gap-1.5"><span class="text-slate-400">🎯</span><span class="text-slate-700">${esc(r.destination_address)}</span></p>
        <p class="flex items-center justify-between pt-1 mt-1 border-t border-slate-200">
          <span class="font-bold text-slate-500">Tu oferta</span>
          <span class="font-black text-teal-600">${fmtMoney(r.suggested_fee)}</span>
        </p>
        ${r.coupon_discount > 0 ? `<p class="flex items-center justify-between text-[11px] text-emerald-700"><span>🎟️ Cupón ${esc(r.coupon_code || '')}</span><span>-${fmtMoney(r.coupon_discount)}</span></p>` : ''}
        ${r.final_fee ? `<p class="flex items-center justify-between text-[11px] text-emerald-700"><span>Tarifa final</span><span class="font-black">${fmtMoney(r.final_fee)}</span></p>` : ''}
      </div>
    `;
  }

  function renderOffers() {
    const el = document.getElementById('radarOffers');
    if (!el || !activeRequest) return;

    const pending = activeOffers.filter(o => o.status === 'pending');
    const isPending = ['pending', 'counter_offered'].includes(activeRequest.status);

    if (!isPending || !pending.length) {
      if (isPending) {
        el.innerHTML = `
          <div class="rounded-2xl bg-teal-50 border-2 border-dashed border-teal-300 p-6 text-center">
            <div class="text-4xl mb-2 animate-pulse">📡</div>
            <p class="text-sm font-black text-teal-900">Difundiendo a los pilotos</p>
            <p class="text-[11px] text-teal-700 mt-1">Las ofertas aparecerán aquí en cuanto lleguen.</p>
          </div>
        `;
      } else {
        el.innerHTML = '';
      }
      return;
    }

    el.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black text-slate-700 uppercase tracking-wider">🔥 ${pending.length} piloto${pending.length > 1 ? 's' : ''} ofertando</p>
          <span class="text-[10px] text-slate-400">Elige al mejor</span>
        </div>
        <div class="space-y-2">
          ${pending.map((o, idx) => {
            const d = o.driver || {};
            const rating = parseFloat(d.rating_avg || 5);
            const stars = '⭐'.repeat(Math.max(1, Math.min(5, Math.round(rating))));
            const isBest = idx === 0;
            return `
              <div class="offer-card ${isBest ? 'border-amber-400' : ''}">
                ${isBest ? `<span class="inline-block text-[9px] font-black text-amber-900 bg-amber-200 px-2 py-0.5 rounded-full mb-2">💎 MEJOR OFERTA</span>` : ''}
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-black text-lg flex-shrink-0">${esc((d.full_name || 'P')[0].toUpperCase())}</div>
                  <div class="flex-1 min-w-0">
                    <p class="font-black text-slate-900 text-sm truncate">${esc(d.full_name || 'Piloto')}</p>
                    <p class="text-[10px] text-teal-700">${stars} (${rating.toFixed(1)})</p>
                    <p class="text-[10px] text-slate-500">${esc(d.vehicle_type || 'Moto')} · ${esc(d.license_plate || '—')}</p>
                    ${o.eta_minutes ? `<p class="text-[10px] text-teal-600 font-bold mt-0.5">🕒 Llega en ~${o.eta_minutes} min</p>` : ''}
                  </div>
                  <div class="text-right flex-shrink-0"><p class="text-lg font-black text-teal-700">${fmtMoney(o.proposed_fee)}</p></div>
                </div>
                <button type="button" class="accept-offer-btn w-full mt-3 bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-sm"
                  data-offer-id="${o.id}" data-driver-id="${o.driver_id}" data-fee="${o.proposed_fee}">
                  ✅ Aceptar esta oferta
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    el.querySelectorAll('.accept-offer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        acceptOffer(btn.dataset.offerId, btn.dataset.driverId, parseFloat(btn.dataset.fee));
      });
    });
  }

  function renderDriverCard() {
    const el = document.getElementById('radarDriverCard');
    if (!el) return;
    const r = activeRequest;
    if (!r || !r.driver || !['accepted','in_transit','on_the_way','delivered','completed'].includes(r.status)) {
      el.innerHTML = '';
      return;
    }
    const d = r.driver;
    const rating = parseFloat(d.rating_avg || 5);
    const stars = '⭐'.repeat(Math.max(1, Math.min(5, Math.round(rating))));

    el.innerHTML = `
      <div class="rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-300 p-4 space-y-3">
        <p class="text-[10px] font-black text-teal-900 uppercase tracking-wider">🛵 Tu Piloto Asignado</p>
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center font-black text-xl flex-shrink-0">🛵</div>
          <div class="flex-1 min-w-0">
            <p class="font-black text-slate-900 text-sm truncate">${esc(d.full_name || 'Piloto')}</p>
            <p class="text-[11px] text-teal-700 font-bold">${stars} (${rating.toFixed(1)})</p>
            <p class="text-[10px] text-slate-500">${esc(d.vehicle_type || 'Moto')} · ${esc(d.license_plate || 'Sin placa')}</p>
          </div>
        </div>
        ${d.phone ? `<a href="https://wa.me/${String(d.phone).replace(/\D/g,'')}" target="_blank"
          class="block w-full text-center bg-[#25D366] hover:bg-[#128C7E] text-white font-extrabold py-2.5 rounded-xl text-xs">📱 Contactar al piloto</a>` : ''}
      </div>
    `;
  }

  function renderPinCard() {
    const el = document.getElementById('radarPinCard');
    if (!el) return;
    const r = activeRequest;
    if (!r || !r.delivery_pin) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 text-center">
        <p class="text-[10px] font-black text-amber-900 uppercase tracking-wider mb-1">🔑 Tu PIN de Entrega</p>
        <p class="text-3xl font-black font-mono text-amber-950 tracking-[0.4em]">${esc(r.delivery_pin)}</p>
        <p class="text-[10px] text-amber-800 mt-1.5">Compártelo con el piloto al recibir o subir al vehículo</p>
      </div>
    `;
  }

  function renderCancelBtn() {
    const el = document.getElementById('radarCancelBtn');
    if (!el) return;
    const r = activeRequest;
    if (!r || ['delivered','completed','cancelled','rejected'].includes(r.status)) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `
      <button type="button" id="radarCancelBtnReal"
        class="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold py-2.5 rounded-xl text-xs border border-rose-200">
        🚫 Cancelar solicitud
      </button>
    `;
    document.getElementById('radarCancelBtnReal')?.addEventListener('click', cancelRequest);
  }

  // -------------------------------------------------------------
  // Aceptar oferta
  // -------------------------------------------------------------
  async function acceptOffer(offerId, driverId, fee) {
    if (!activeRequest) return;
    if (!confirm(`¿Aceptar la oferta de ${fmtMoney(fee)}?`)) return;

    const c = client();
    const now = new Date().toISOString();
    try {
      await c.from('delivery_offers')
        .update({ status: 'accepted', updated_at: now }).eq('id', offerId);

      await c.from('delivery_offers')
        .update({ status: 'rejected', updated_at: now })
        .eq('request_id', activeRequest.id)
        .eq('status', 'pending')
        .neq('id', offerId);

      await c.from('delivery_requests')
        .update({
          driver_id: driverId,
          final_fee: fee,
          status: 'accepted',
          counter_fee: null,
          updated_at: now
        })
        .eq('id', activeRequest.id);

      await refresh();
    } catch (err) {
      alert('Error: ' + (err.message || err));
    }
  }

  async function cancelRequest() {
    if (!activeRequest) return;
    if (!confirm('¿Cancelar la solicitud?')) return;
    const c = client();
    const now = new Date().toISOString();
    const startIso = activeRequest.updated_at || activeRequest.created_at;
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));

    try {
      await c.from('delivery_offers')
        .update({ status: 'withdrawn', updated_at: now })
        .eq('request_id', activeRequest.id)
        .eq('status', 'pending');

      await c.from('delivery_requests').update({
        status: 'cancelled_pending_review',
        cancelled_at: now,
        cancelled_by_role: 'customer',
        cancelled_by_user_id: session ? session.user.id : null,
        cancellation_reason: 'Cliente canceló desde el radar',
        time_elapsed_seconds: elapsed,
        updated_at: now
      }).eq('id', activeRequest.id);

      await refresh();
    } catch (err) {
      alert('Error: ' + (err.message || err));
    }
  }

  // -------------------------------------------------------------
  // Mapa Leaflet + GPS
  // -------------------------------------------------------------
  function initRadarMap() {
    const container = document.getElementById('radarMap');
    if (!container || radarMap) return;

    radarMap = L.map('radarMap', { zoomControl: true, attributionControl: false })
      .setView([XELA_CENTER.lat, XELA_CENTER.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(radarMap);

    setTimeout(() => radarMap.invalidateSize(), 300);
  }

  function makeIcon(color, emoji) {
    return L.divIcon({
      className: '',
      html: `<div style="width:38px;height:38px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.35)">${emoji}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
  }

  function updateMap() {
    if (!radarMap || !activeRequest) return;
    const r = activeRequest;

    // Origen fijo
    if (r.origin_lat && r.origin_lng && !originMarker) {
      originMarker = L.marker([parseFloat(r.origin_lat), parseFloat(r.origin_lng)], {
        icon: makeIcon('#0d9488', '📍')
      }).addTo(radarMap).bindPopup('Origen');
    }
    // Destino fijo
    if (r.destination_lat && r.destination_lng && !destMarker) {
      destMarker = L.marker([parseFloat(r.destination_lat), parseFloat(r.destination_lng)], {
        icon: makeIcon('#dc2626', '🎯')
      }).addTo(radarMap).bindPopup('Destino');
    }

    // Cliente (siempre disponible si compartió ubicación)
    const custLat = r.customer_lat ? parseFloat(r.customer_lat) : null;
    const custLng = r.customer_lng ? parseFloat(r.customer_lng) : null;
    if (custLat && custLng) {
      if (!customerMarker) {
        customerMarker = L.marker([custLat, custLng], { icon: makeIcon('#0891b2', '🙋') })
          .addTo(radarMap).bindPopup('Tu ubicación');
      } else {
        customerMarker.setLatLng([custLat, custLng]);
      }
    }

    // Piloto
    const drvLat = r.driver_lat ? parseFloat(r.driver_lat) : null;
    const drvLng = r.driver_lng ? parseFloat(r.driver_lng) : null;
    if (drvLat && drvLng) {
      if (!driverMarker) {
        driverMarker = L.marker([drvLat, drvLng], { icon: makeIcon('#7c3aed', '🛵') })
          .addTo(radarMap).bindPopup('Tu piloto');
      } else {
        driverMarker.setLatLng([drvLat, drvLng]);
      }
    }

    // Polyline
    if (custLat && custLng && drvLat && drvLng) {
      const pts = [[custLat, custLng], [drvLat, drvLng]];
      if (routeLine) routeLine.setLatLngs(pts);
      else {
        routeLine = L.polyline(pts, { color: '#14b8a6', weight: 4, dashArray: '10, 8', opacity: 0.85 }).addTo(radarMap);
      }
      // Distancia aprox
      const distKm = haversineKm(custLat, custLng, drvLat, drvLng);
      const distEl = document.getElementById('radarDistance');
      if (distEl) {
        distEl.textContent = distKm < 1
          ? `${Math.round(distKm * 1000)} m`
          : `${distKm.toFixed(2)} km`;
        distEl.classList.remove('hidden');
      }
    }

    // Fit bounds
    const bounds = [];
    if (custLat && custLng) bounds.push([custLat, custLng]);
    if (drvLat && drvLng) bounds.push([drvLat, drvLng]);
    if (r.origin_lat && r.origin_lng) bounds.push([parseFloat(r.origin_lat), parseFloat(r.origin_lng)]);
    if (r.destination_lat && r.destination_lng) bounds.push([parseFloat(r.destination_lat), parseFloat(r.destination_lng)]);
    if (bounds.length >= 2) {
      radarMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // -------------------------------------------------------------
  // GPS bidireccional: enviar mi ubicación al servidor
  // -------------------------------------------------------------
  function startCustomerTracking() {
    if (!('geolocation' in navigator) || !activeRequest) return;

    if (customerWatchId !== null) {
      try { navigator.geolocation.clearWatch(customerWatchId); } catch (e) {}
    }

    customerWatchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        // Throttle: cada 6 segundos o si nos movimos > 20m
        if (now - lastCustomerPingAt < 6000) return;
        lastCustomerPingAt = now;

        const c = client();
        if (!c || !activeRequest) return;
        try {
          await c.from('delivery_requests').update({
            customer_lat: pos.coords.latitude,
            customer_lng: pos.coords.longitude,
            customer_location_updated_at: new Date().toISOString()
          }).eq('id', activeRequest.id);

          // Actualizar localmente sin esperar realtime
          activeRequest.customer_lat = pos.coords.latitude;
          activeRequest.customer_lng = pos.coords.longitude;
          updateMap();
        } catch (e) { /* silencioso */ }
      },
      (err) => console.warn('[Radar] geo error:', err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 8000 }
    );
  }

  function stopCustomerTracking() {
    if (customerWatchId !== null) {
      try { navigator.geolocation.clearWatch(customerWatchId); } catch (e) {}
      customerWatchId = null;
    }
  }

  // -------------------------------------------------------------
  // Realtime
  // -------------------------------------------------------------
  function subscribeRealtime() {
    const c = client();
    if (!c || !activeRequest) return;

    if (requestsChannel) { try { c.removeChannel(requestsChannel); } catch (e) {} }
    requestsChannel = c.channel(`radar_req_${activeRequest.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'delivery_requests',
        filter: `id=eq.${activeRequest.id}`
      }, (payload) => {
        if (payload.new) {
          activeRequest = { ...activeRequest, ...payload.new };
          renderAll();
          updateMap();
        }
      })
      .subscribe();

    if (offersChannel) { try { c.removeChannel(offersChannel); } catch (e) {} }
    offersChannel = c.channel(`radar_offers_${activeRequest.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'delivery_offers',
        filter: `request_id=eq.${activeRequest.id}`
      }, () => loadOffers().then(() => { renderOffers(); }))
      .subscribe();
  }

  // -------------------------------------------------------------
  // Init
  // -------------------------------------------------------------
  async function init() {
    const c = client();
    if (!c) return;

    // Sesión
    try {
      const { data: { session: s } } = await c.auth.getSession();
      session = s;
    } catch (e) {}

    if (!session) {
      const target = `radar.html${window.location.search}`;
      window.location.href = `../login.html?redirect=${encodeURIComponent('delivery/' + target)}`;
      return;
    }

    // Request ID
    const urlId = getRequestIdFromUrl();
    let reqId = urlId;

    if (!reqId) {
      try {
        const raw = localStorage.getItem(LAST_REQ_KEY);
        if (raw) reqId = JSON.parse(raw).id;
      } catch (e) {}
    }

    if (!reqId) {
      document.getElementById('radarContent').innerHTML = `
        <div class="bg-white rounded-3xl p-8 text-center border border-slate-200">
          <div class="text-5xl mb-3">🔍</div>
          <p class="font-black text-slate-900 mb-1">No hay solicitud activa</p>
          <p class="text-xs text-slate-500 mb-4">Publica un mandadito para empezar</p>
          <a href="index.html" class="inline-block bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl">
            ➕ Crear nueva
          </a>
        </div>
      `;
      return;
    }

    // Cargar request
    const { data, error } = await c.from('delivery_requests')
      .select(`*, driver:delivery_drivers!delivery_requests_driver_id_fkey(id, full_name, phone, vehicle_type, license_plate, rating_avg, total_trips)`)
      .eq('id', reqId)
      .maybeSingle();

    if (error || !data) {
      document.getElementById('radarContent').innerHTML = `<p class="text-center text-sm text-rose-500 font-bold py-8">No se encontró la solicitud.</p>`;
      return;
    }

    activeRequest = data;

    // Mostrar
    document.getElementById('radarContent').classList.remove('hidden');

    // Init mapa
    initRadarMap();

    // Load offers + render
    await loadOffers();
    renderAll();
    updateMap();

    // Realtime
    subscribeRealtime();

    // Polling respaldo
    pollTimer = setInterval(refresh, 5000);

    // GPS del cliente
    startCustomerTracking();

    // Si cambia a delivered, detener polling
    if (['delivered','completed','cancelled','rejected'].includes(activeRequest.status)) {
      stopAll();
    }
  }

  function stopAll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    stopCustomerTracking();
    const c = client();
    if (c) {
      if (requestsChannel) { try { c.removeChannel(requestsChannel); } catch (e) {} }
      if (offersChannel) { try { c.removeChannel(offersChannel); } catch (e) {} }
    }
  }

  window.PasajeRadar = {
    init,
    refresh,
    stop: stopAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
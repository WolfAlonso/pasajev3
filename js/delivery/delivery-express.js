// =============================================================
// js/delivery/delivery-express.js
// Wizard cliente con Google Maps Picker (draggable marker)
// Ubicación en /delivery/index.html
// =============================================================

(function () {
  'use strict';

  const DRAFT_KEY    = 'pasaje_express_draft';
  const LAST_REQ_KEY = 'pasaje_express_last_request';
  const XELA_CENTER  = { lat: 14.8347, lng: -91.5186 };

  // -------------------------------------------------------------
  // Estado global
  // -------------------------------------------------------------
  let config = null;
  let session = null;
  let userProfile = null;
  let serviceCategory = 'express_delivery';
  let wizardStep = 1;

  let geoWatcher = null;
  let geoPosition = { lat: null, lng: null, accuracy: null };
  let locationPermission = 'prompt';

  // Google Maps
  let gmap = null;
  let gmapOriginMarker = null;
  let gmapDestMarker = null;
  let gmapDirectionsService = null;
  let gmapDirectionsRenderer = null;
  let gmapAutocompleteOrigin = null;
  let gmapAutocompleteDest = null;
  let activeTarget = 'origin'; // 'origin' | 'destination'

  let pickedOrigin = { lat: null, lng: null, address: '' };
  let pickedDestination = { lat: null, lng: null, address: '' };

  let draft = {
    service_category: 'express_delivery',
    origin_address: '',
    destination_address: '',
    customer_name: '',
    customer_phone: '',
    description: '',
    items: '',
    vehicle_type_requested: 'any',
    passenger_count: 1,
    suggested_fee: 0,
    coupon_code: '',
    coupon_discount: 0,
    notes: ''
  };

  // -------------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------------
  function client() {
    return window._supabase || (typeof initSupabaseClient === 'function' ? initSupabaseClient() : null);
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtMoney(n) {
    return `Q${parseFloat(n || 0).toFixed(2)}`;
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) {}
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // -------------------------------------------------------------
  // Configuración dinámica
  // -------------------------------------------------------------
  async function loadConfig() {
    const c = client();
    if (!c) return null;
    try {
      const { data } = await c
        .from('site_settings')
        .select('delivery_config')
        .eq('id', 'global')
        .maybeSingle();
      if (data && data.delivery_config) {
        config = data.delivery_config;
        config.base_fee = parseFloat(config.base_fee || 15);
        config.rain_surcharge = parseFloat(config.rain_surcharge || 0);
        config.zones = Array.isArray(config.zones) ? config.zones : [];
      }
    } catch (e) {
      console.warn('[Express] config load error:', e);
    }
    if (!config) {
      config = {
        base_fee: 15,
        rain_mode_enabled: false,
        rain_surcharge: 0,
        zones: [
          { name: 'Zona 1 - Centro Histórico', active: true },
          { name: 'Zona 3 - Las Flores', active: true },
          { name: 'Zona 7 - Minerva', active: true },
          { name: 'Zona 10 - Pradera', active: true }
        ]
      };
    }
    return config;
  }

  function computeSuggestedFee() {
    let total = parseFloat(config.base_fee || 15);
    if (config.rain_mode_enabled) total += parseFloat(config.rain_surcharge || 0);
    return parseFloat(total.toFixed(2));
  }

  function renderHeader() {
    const rainBadge = config.rain_mode_enabled
      ? `<span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-blue-300">🌧️ Modo Lluvia +${fmtMoney(config.rain_surcharge)}</span>`
      : `<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-300">☀️ Tarifa normal</span>`;
    const el = document.getElementById('expressConfigBar');
    if (el) {
      el.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black text-white/80 uppercase">Tarifa base:</span>
            <span class="text-sm font-black text-white">${fmtMoney(config.base_fee)}</span>
          </div>
          ${rainBadge}
        </div>`;
    }
  }

  // -------------------------------------------------------------
  // Sesión
  // -------------------------------------------------------------
  async function getSession() {
    const c = client();
    if (!c) return null;
    try {
      const { data: { session } } = await c.auth.getSession();
      return session || null;
    } catch (e) { return null; }
  }

  async function getUserProfile(uid) {
    const c = client();
    if (!c || !uid) return null;
    try {
      const { data } = await c.from('user_profiles')
        .select('display_name, phone').eq('user_id', uid).maybeSingle();
      return data || null;
    } catch (e) { return null; }
  }

  // -------------------------------------------------------------
  // Ubicación del usuario
  // -------------------------------------------------------------
  function updateLocationUI() {
    const icon = document.getElementById('expressLocationIcon');
    const title = document.getElementById('expressLocationTitle');
    const sub = document.getElementById('expressLocationSubtitle');
    const btn = document.getElementById('expressShareLocationBtn');
    if (!icon || !title || !sub || !btn) return;

    if (locationPermission === 'granted' && geoPosition.lat && geoPosition.lng) {
      icon.className = 'w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg flex-shrink-0';
      icon.textContent = '✅';
      title.textContent = 'Ubicación compartida';
      sub.textContent = `${geoPosition.lat.toFixed(5)}, ${geoPosition.lng.toFixed(5)} · ±${Math.round(geoPosition.accuracy || 0)}m`;
      btn.className = 'bg-emerald-100 text-emerald-800 font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 flex-shrink-0';
      btn.innerHTML = '<span>✅</span><span>Activa</span>';
      btn.disabled = true;
    } else if (locationPermission === 'denied') {
      icon.className = 'w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg flex-shrink-0';
      icon.textContent = '❌';
      title.textContent = 'Ubicación bloqueada';
      sub.textContent = 'Actívala en los ajustes del navegador';
      btn.className = 'bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 flex-shrink-0';
      btn.innerHTML = '<span>🔓</span><span>Reintentar</span>';
      btn.disabled = false;
    } else {
      icon.className = 'w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg flex-shrink-0';
      icon.textContent = '📍';
      title.textContent = 'Comparte tu ubicación';
      sub.textContent = 'Obligatorio para asignar tu piloto';
      btn.className = 'bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 flex-shrink-0';
      btn.innerHTML = '<span>📍</span><span>Activar</span>';
      btn.disabled = false;
    }
  }

  function startGeolocation() {
    if (!('geolocation' in navigator)) {
      locationPermission = 'denied';
      updateLocationUI();
      alert('Tu navegador no soporta geolocalización.');
      return;
    }
    if (geoWatcher !== null) {
      try { navigator.geolocation.clearWatch(geoWatcher); } catch (e) {}
      geoWatcher = null;
    }
    geoWatcher = navigator.geolocation.watchPosition(
      (pos) => {
        geoPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        locationPermission = 'granted';
        updateLocationUI();
        // Mover mapa si no hay origen marcado
        if (gmap && !pickedOrigin.lat) {
          gmap.setCenter({ lat: geoPosition.lat, lng: geoPosition.lng });
          gmap.setZoom(15);
        }
      },
      (err) => {
        console.warn('[Express] geo:', err);
        if (err.code === 1) locationPermission = 'denied';
        updateLocationUI();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    updateLocationUI();
  }

  async function requestLocationOnce() {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) { resolve(false); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          geoPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          locationPermission = 'granted';
          updateLocationUI();
          resolve(true);
        },
        (err) => {
          console.warn('[Express] geo once:', err);
          if (err.code === 1) locationPermission = 'denied';
          updateLocationUI();
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // -------------------------------------------------------------
  // Google Maps Picker (JS API con autocomplete + draggable)
  // -------------------------------------------------------------
  function loadGoogleMapsSDK() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) { resolve(); return; }
      const key = window.GOOGLE_MAPS_API_KEY || '';
      if (!key) { reject(new Error('Falta GOOGLE_MAPS_API_KEY')); return; }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=es&region=GT`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Error cargando Google Maps SDK'));
      document.head.appendChild(script);
    });
  }

  async function initGoogleMap() {
    const container = document.getElementById('expressGoogleMap');
    if (!container) return false;

    try {
      await loadGoogleMapsSDK();
    } catch (err) {
      console.warn('[Express] Google Maps no disponible:', err.message);
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center p-4 bg-amber-50">
          <div class="text-4xl mb-2">🗺️</div>
          <p class="text-xs font-black text-amber-900">Mapa no disponible</p>
          <p class="text-[10px] text-amber-700 mt-1">Configura GOOGLE_MAPS_API_KEY</p>
        </div>`;
      return false;
    }

    // Mapa base
    const startPos = (geoPosition.lat && geoPosition.lng)
      ? { lat: geoPosition.lat, lng: geoPosition.lng }
      : XELA_CENTER;

    gmap = new google.maps.Map(container, {
      center: startPos,
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    // Autocomplete en los inputs
    const originInput = document.getElementById('expressOriginAddress');
    const destInput = document.getElementById('expressDestAddress');

    if (originInput) {
      gmapAutocompleteOrigin = new google.maps.places.Autocomplete(originInput, {
        componentRestrictions: { country: 'gt' },
        fields: ['formatted_address', 'geometry', 'name'],
        bounds: new google.maps.LatLngBounds(
          { lat: 14.75, lng: -91.65 },
          { lat: 14.92, lng: -91.40 }
        )
      });

      gmapAutocompleteOrigin.addListener('place_changed', () => {
        const place = gmapAutocompleteOrigin.getPlace();
        if (!place.geometry) return;
        pickedOrigin = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address || place.name || originInput.value
        };
        placeOriginMarker(pickedOrigin);
        gmap.setCenter({ lat: pickedOrigin.lat, lng: pickedOrigin.lng });
        gmap.setZoom(16);
        drawRoute();
        saveDraft();
      });
    }

    if (destInput) {
      gmapAutocompleteDest = new google.maps.places.Autocomplete(destInput, {
        componentRestrictions: { country: 'gt' },
        fields: ['formatted_address', 'geometry', 'name'],
        bounds: new google.maps.LatLngBounds(
          { lat: 14.75, lng: -91.65 },
          { lat: 14.92, lng: -91.40 }
        )
      });

      gmapAutocompleteDest.addListener('place_changed', () => {
        const place = gmapAutocompleteDest.getPlace();
        if (!place.geometry) return;
        pickedDestination = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address || place.name || destInput.value
        };
        placeDestinationMarker(pickedDestination);
        gmap.setCenter({ lat: pickedDestination.lat, lng: pickedDestination.lng });
        gmap.setZoom(16);
        drawRoute();
        saveDraft();
      });
    }

    // Click en el mapa → coloca el marcador activo
    gmap.addListener('click', (e) => {
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      if (activeTarget === 'origin') {
        pickedOrigin = { lat: pos.lat, lng: pos.lng, address: '' };
        placeOriginMarker(pickedOrigin);
        reverseGeocode(pos, 'origin');
      } else {
        pickedDestination = { lat: pos.lat, lng: pos.lng, address: '' };
        placeDestinationMarker(pickedDestination);
        reverseGeocode(pos, 'destination');
      }
      drawRoute();
      saveDraft();
    });

    // Directions
    gmapDirectionsService = new google.maps.DirectionsService();
    gmapDirectionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#14b8a6',
        strokeOpacity: 0.85,
        strokeWeight: 4
      }
    });
    gmapDirectionsRenderer.setMap(gmap);

    // Si ya había pickeds del draft, restaurar
    if (pickedOrigin.lat) placeOriginMarker(pickedOrigin);
    if (pickedDestination.lat) placeDestinationMarker(pickedDestination);
    if (pickedOrigin.lat && pickedDestination.lat) drawRoute();

    return true;
  }

  function placeOriginMarker(pos) {
    if (!gmap) return;
    if (gmapOriginMarker) gmapOriginMarker.setMap(null);
    gmapOriginMarker = new google.maps.Marker({
      position: { lat: pos.lat, lng: pos.lng },
      map: gmap,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#0d9488',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3
      },
      label: { text: '📍', fontSize: '16px' },
      title: 'Origen'
    });
    gmapOriginMarker.addListener('dragend', (e) => {
      const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      pickedOrigin = { lat: p.lat, lng: p.lng, address: pickedOrigin.address };
      reverseGeocode(p, 'origin');
      drawRoute();
      saveDraft();
    });
  }

  function placeDestinationMarker(pos) {
    if (!gmap) return;
    if (gmapDestMarker) gmapDestMarker.setMap(null);
    gmapDestMarker = new google.maps.Marker({
      position: { lat: pos.lat, lng: pos.lng },
      map: gmap,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#dc2626',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3
      },
      label: { text: '🎯', fontSize: '16px' },
      title: 'Destino'
    });
    gmapDestMarker.addListener('dragend', (e) => {
      const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      pickedDestination = { lat: p.lat, lng: p.lng, address: pickedDestination.address };
      reverseGeocode(p, 'destination');
      drawRoute();
      saveDraft();
    });
  }

  function reverseGeocode(pos, target) {
    if (!gmap || !google.maps.Geocoder) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: pos }, (results, status) => {
      if (status !== 'OK' || !results[0]) return;
      const addr = results[0].formatted_address || '';
      if (target === 'origin') {
        pickedOrigin.address = addr;
        const el = document.getElementById('expressOriginAddress');
        if (el) el.value = addr;
      } else {
        pickedDestination.address = addr;
        const el = document.getElementById('expressDestAddress');
        if (el) el.value = addr;
      }
      saveDraft();
    });
  }

  function drawRoute() {
    if (!gmapDirectionsService || !gmapDirectionsRenderer) return;
    if (!pickedOrigin.lat || !pickedDestination.lat) return;

    gmapDirectionsService.route({
      origin: { lat: pickedOrigin.lat, lng: pickedOrigin.lng },
      destination: { lat: pickedDestination.lat, lng: pickedDestination.lng },
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === 'OK') {
        gmapDirectionsRenderer.setDirections(result);
        const leg = result.routes[0]?.legs[0];
        if (leg) {
          const distEl = document.getElementById('expressRouteInfo');
          if (distEl) {
            distEl.textContent = `${leg.distance.text} · ~${leg.duration.text}`;
            distEl.classList.remove('hidden');
          }
        }
      }
    });
  }

  function centerOnUser() {
    if (!geoPosition.lat || !gmap) return;
    gmap.setCenter({ lat: geoPosition.lat, lng: geoPosition.lng });
    gmap.setZoom(16);
    pickedOrigin = { lat: geoPosition.lat, lng: geoPosition.lng, address: '' };
    placeOriginMarker(pickedOrigin);
    reverseGeocode({ lat: geoPosition.lat, lng: geoPosition.lng }, 'origin');
    drawRoute();
    saveDraft();
  }

  function bindGoogleMapsControls() {
    document.getElementById('expressUseMyLocationBtn')?.addEventListener('click', async () => {
      const ok = await requestLocationOnce();
      if (ok) centerOnUser();
    });

    document.getElementById('expressPickOriginBtn')?.addEventListener('click', () => {
      activeTarget = 'origin';
      const btnO = document.getElementById('expressPickOriginBtn');
      const btnD = document.getElementById('expressPickDestBtn');
      btnO.classList.add('ring-2','ring-teal-500');
      btnD.classList.remove('ring-2','ring-rose-500');
      const status = document.getElementById('expressMapStatus');
      if (status) status.textContent = 'Haz clic en el mapa para marcar el ORIGEN';
    });

    document.getElementById('expressPickDestBtn')?.addEventListener('click', () => {
      activeTarget = 'destination';
      const btnO = document.getElementById('expressPickOriginBtn');
      const btnD = document.getElementById('expressPickDestBtn');
      btnD.classList.add('ring-2','ring-rose-500');
      btnO.classList.remove('ring-2','ring-teal-500');
      const status = document.getElementById('expressMapStatus');
      if (status) status.textContent = 'Haz clic en el mapa para marcar el DESTINO';
    });
  }

  // -------------------------------------------------------------
  // Selector de servicio
  // -------------------------------------------------------------
  function applyTabStyles(activeService) {
    document.querySelectorAll('.service-tab').forEach(tab => {
      const isActive = tab.dataset.service === activeService;
      tab.classList.toggle('active', isActive);
    });
  }

  function bindServiceSelector() {
    const heroSection = document.getElementById('expressHero');
    if (!heroSection) return;
    heroSection.addEventListener('click', (e) => {
      const tab = e.target.closest('.service-tab');
      if (!tab) return;
      e.preventDefault();
      const newService = tab.dataset.service || 'express_delivery';
      serviceCategory = newService;
      draft.service_category = newService;
      applyTabStyles(newService);
      const rideBlock = document.getElementById('expressRideBlock');
      if (rideBlock) {
        rideBlock.classList.toggle('hidden', newService !== 'passenger_ride');
      }
      saveDraft();
    });

    document.querySelectorAll('input[name="expressVehicle"]').forEach(radio => {
      radio.addEventListener('change', () => {
        draft.vehicle_type_requested = radio.value;
        saveDraft();
      });
    });

    document.querySelectorAll('.passenger-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.passenger-btn').forEach(b => {
          b.className = 'passenger-btn flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:border-slate-300';
        });
        btn.className = 'passenger-btn flex-1 py-2.5 rounded-xl border-2 border-teal-500 bg-teal-50 text-teal-700 font-black text-sm';
        draft.passenger_count = parseInt(btn.dataset.passengers, 10) || 1;
        saveDraft();
      });
    });
  }

  // -------------------------------------------------------------
  // Wizard
  // -------------------------------------------------------------
  function setWizardStep(step) {
    wizardStep = step;
    document.querySelectorAll('.express-step').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`expressStep${step}`);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('[data-wizard-dot]').forEach(dot => {
      const n = parseInt(dot.dataset.wizardDot, 10);
      if (n === step) {
        dot.className = 'w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-md scale-110';
      } else if (n < step) {
        dot.className = 'w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-black text-xs';
      } else {
        dot.className = 'w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-black text-xs';
      }
    });

    // Si entramos a Step 1 y hay mapa, invalidar tamaño
    if (step === 1 && gmap) {
      setTimeout(() => {
        google.maps.event.trigger(gmap, 'resize');
        if (pickedOrigin.lat && pickedDestination.lat) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: pickedOrigin.lat, lng: pickedOrigin.lng });
          bounds.extend({ lat: pickedDestination.lat, lng: pickedDestination.lng });
          gmap.fitBounds(bounds, 60);
        }
      }, 200);
    }
  }

  function renderStep3() {
    const baseFee = parseFloat(config.base_fee || 15);
    const rainLine = config.rain_mode_enabled
      ? `<div class="flex justify-between text-[11px] text-blue-700"><span>🌧️ Recargo por lluvia</span><span>+${fmtMoney(config.rain_surcharge)}</span></div>`
      : '';
    const couponLine = (draft.coupon_discount > 0)
      ? `<div class="flex justify-between text-[11px] text-emerald-700"><span>🎟️ Cupón ${esc(draft.coupon_code)}</span><span>-${fmtMoney(draft.coupon_discount)}</span></div>`
      : '';

    const serviceLabel = serviceCategory === 'passenger_ride' ? '🚘 Pasaje Ride' : '📦 Mandadito';
    const vehicleLabel = serviceCategory === 'passenger_ride'
      ? (draft.vehicle_type_requested === 'moto' ? '🛵 Moto' :
         draft.vehicle_type_requested === 'carro' ? '🚗 Carro' : '✨ Cualquiera')
      : '';

    const summaryEl = document.getElementById('expressSummary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="space-y-2 text-xs">
          <div class="flex justify-between"><span class="text-slate-500 font-bold">Servicio</span><span class="text-slate-900 font-semibold">${serviceLabel}</span></div>
          ${vehicleLabel ? `<div class="flex justify-between"><span class="text-slate-500 font-bold">Vehículo</span><span class="text-slate-900 font-semibold">${vehicleLabel} · ${draft.passenger_count} pasajero${draft.passenger_count > 1 ? 's' : ''}</span></div>` : ''}
          <div class="flex justify-between"><span class="text-slate-500 font-bold">📍 Origen</span><span class="text-slate-900 font-semibold text-right truncate ml-2 max-w-[60%]">${esc(draft.origin_address || '—')}</span></div>
          <div class="flex justify-between"><span class="text-slate-500 font-bold">🎯 Destino</span><span class="text-slate-900 font-semibold text-right truncate ml-2 max-w-[60%]">${esc(draft.destination_address || '—')}</span></div>
          <div class="flex justify-between"><span class="text-slate-500 font-bold">👤 Contacto</span><span class="text-slate-900 font-semibold">${esc(draft.customer_name || '—')}</span></div>
        </div>
        <div class="mt-3 pt-3 border-t border-slate-200 space-y-1">
          <div class="flex justify-between text-xs"><span class="text-slate-600 font-bold">Tarifa base</span><span class="font-bold text-slate-800">${fmtMoney(baseFee)}</span></div>
          ${rainLine}
          ${couponLine}
        </div>`;
    }

    const feeInput = document.getElementById('expressCustomFee');
    if (feeInput && !feeInput.dataset.userEdited) {
      const finalSuggested = Math.max(5, computeSuggestedFee() - (draft.coupon_discount || 0));
      feeInput.value = finalSuggested.toFixed(2);
      draft.suggested_fee = finalSuggested;
    }
  }

  // -------------------------------------------------------------
  // Cupones
  // -------------------------------------------------------------
  async function applyCoupon() {
    const input = document.getElementById('expressCouponInput');
    const feedback = document.getElementById('expressCouponFeedback');
    const code = (input.value || '').trim().toUpperCase();
    if (!code) {
      feedback.className = 'text-[11px] mt-1.5 font-bold text-rose-600';
      feedback.textContent = '⚠️ Ingresa un código.';
      feedback.classList.remove('hidden');
      return;
    }
    const c = client();
    if (!c) return;
    try {
      const { data } = await c.from('coupons')
        .select('code, discount_type, discount_value, min_purchase, is_active, expires_at, is_express_coupon')
        .ilike('code', code).eq('is_active', true).maybeSingle();

      if (!data) {
        feedback.className = 'text-[11px] mt-1.5 font-bold text-rose-600';
        feedback.textContent = '❌ Cupón no válido o inactivo.';
        feedback.classList.remove('hidden');
        draft.coupon_code = ''; draft.coupon_discount = 0;
        saveDraft(); renderStep3(); return;
      }
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        feedback.className = 'text-[11px] mt-1.5 font-bold text-rose-600';
        feedback.textContent = '❌ Cupón expirado.';
        feedback.classList.remove('hidden');
        draft.coupon_code = ''; draft.coupon_discount = 0;
        saveDraft(); renderStep3(); return;
      }
      if (data.is_express_coupon === false) {
        feedback.className = 'text-[11px] mt-1.5 font-bold text-amber-600';
        feedback.textContent = '⚠️ Este cupón es válido solo para tienda.';
        feedback.classList.remove('hidden');
        return;
      }
      const baseFee = computeSuggestedFee();
      const minPurchase = parseFloat(data.min_purchase || 0);
      if (baseFee < minPurchase) {
        feedback.className = 'text-[11px] mt-1.5 font-bold text-amber-600';
        feedback.textContent = `⚠️ Mínimo requerido: ${fmtMoney(minPurchase)}`;
        feedback.classList.remove('hidden');
        return;
      }
      let discount = (data.discount_type === 'percentage' || data.discount_type === 'percent')
        ? baseFee * (parseFloat(data.discount_value) / 100)
        : parseFloat(data.discount_value);
      discount = Math.min(discount, baseFee);
      discount = parseFloat(discount.toFixed(2));

      draft.coupon_code = data.code;
      draft.coupon_discount = discount;
      saveDraft();
      feedback.className = 'text-[11px] mt-1.5 font-bold text-emerald-600';
      feedback.textContent = `✅ Cupón aplicado: -${fmtMoney(discount)}`;
      feedback.classList.remove('hidden');

      const feeInput = document.getElementById('expressCustomFee');
      if (feeInput) {
        feeInput.dataset.userEdited = '';
        feeInput.value = Math.max(5, baseFee - discount).toFixed(2);
      }
      renderStep3();
    } catch (err) {
      console.error('[Express] coupon:', err);
    }
  }

  // -------------------------------------------------------------
  // Publicar → guarda y redirige al radar
  // -------------------------------------------------------------
  async function publishRequest() {
    session = await getSession();
    if (!session) {
      saveDraft();
      openAuthModal();
      return;
    }

    if (locationPermission !== 'granted' || !geoPosition.lat || !geoPosition.lng) {
      const ok = await requestLocationOnce();
      if (!ok || locationPermission !== 'granted') {
        alert('📍 Necesitas compartir tu ubicación para publicar tu solicitud.');
        return;
      }
    }

    // Direcciones
    draft.origin_address = document.getElementById('expressOriginAddress').value.trim();
    draft.destination_address = document.getElementById('expressDestAddress').value.trim();

    if (!draft.origin_address || !draft.destination_address) {
      alert('Completa origen y destino.');
      return;
    }

    const c = client();
    if (!c) { alert('Servicio no disponible.'); return; }

    const feeInput = document.getElementById('expressCustomFee');
    const finalFee = parseFloat(feeInput ? feeInput.value : 0) || draft.suggested_fee;
    if (finalFee < 5) { alert('La tarifa mínima es Q5.00'); return; }
    if (finalFee > 500) { alert('La tarifa máxima es Q500.00'); return; }

    const btn = document.getElementById('expressPublishBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Publicando...'; }

    try {
      const pPin = String(Math.floor(1000 + Math.random() * 9000));
      const dPin = String(Math.floor(1000 + Math.random() * 9000));
      const notesParts = [];
      if (draft.description) notesParts.push(draft.description.trim());
      if (draft.items) notesParts.push(`Items: ${draft.items.trim()}`);
      if (draft.notes) notesParts.push(draft.notes.trim());
      const notesStr = `[${serviceCategory === 'passenger_ride' ? 'RIDE' : 'EXPRESS'}] ${notesParts.join(' | ')}`;

      const payload = {
        order_id: null,
        store_id: null,
        customer_user_id: session.user.id,
        assignment_type: 'broadcast',
        status: 'pending',
        service_category: serviceCategory,
        vehicle_type_requested: draft.vehicle_type_requested || 'any',
        passenger_count: serviceCategory === 'passenger_ride' ? (draft.passenger_count || 1) : null,
        suggested_fee: finalFee,
        origin_address: draft.origin_address,
        destination_address: draft.destination_address,
        origin_lat: pickedOrigin.lat || geoPosition.lat || null,
        origin_lng: pickedOrigin.lng || geoPosition.lng || null,
        destination_lat: pickedDestination.lat || null,
        destination_lng: pickedDestination.lng || null,
        origin_address_detail: pickedOrigin.address || null,
        destination_address_detail: pickedDestination.address || null,
        customer_name: draft.customer_name.trim(),
        customer_phone: draft.customer_phone.trim(),
        customer_lat: geoPosition.lat,
        customer_lng: geoPosition.lng,
        customer_location_updated_at: new Date().toISOString(),
        notes: notesStr,
        coupon_code: draft.coupon_code || null,
        coupon_discount: draft.coupon_discount || 0,
        pickup_pin: pPin,
        delivery_pin: dPin
      };

      const { data, error } = await c.from('delivery_requests').insert([payload]).select().single();
      if (error) throw error;

      try { localStorage.setItem(LAST_REQ_KEY, JSON.stringify({ id: data.id, ts: Date.now() })); } catch (e) {}
      localStorage.removeItem(DRAFT_KEY);

      // Redirigir al radar
      window.location.href = `radar.html?id=${data.id}`;
    } catch (err) {
      console.error('[Express] publish:', err);
      alert('Error al publicar: ' + (err.message || err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Publicar'; }
    }
  }

  // -------------------------------------------------------------
  // Modal Auth
  // -------------------------------------------------------------
  function openAuthModal() {
    document.getElementById('expressAuthModal')?.classList.remove('hidden');
  }
  function closeAuthModal() {
    document.getElementById('expressAuthModal')?.classList.add('hidden');
  }

  // -------------------------------------------------------------
  // Restaurar borrador
  // -------------------------------------------------------------
  async function tryRestore() {
    const savedDraft = loadDraft();
    if (!savedDraft) return;
    Object.assign(draft, savedDraft);
    serviceCategory = draft.service_category || 'express_delivery';
    applyTabStyles(serviceCategory);

    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('expressOriginAddress', draft.origin_address);
    set('expressDestAddress', draft.destination_address);
    set('expressCustomerName', draft.customer_name);
    set('expressCustomerPhone', draft.customer_phone);
    set('expressDesc', draft.description);
    set('expressItems', draft.items);
    set('expressNotes', draft.notes);
    set('expressCouponInput', draft.coupon_code);

    if (draft.origin_lat) pickedOrigin = { lat: draft.origin_lat, lng: draft.origin_lng, address: draft.origin_address };
    if (draft.destination_lat) pickedDestination = { lat: draft.destination_lat, lng: draft.destination_lng, address: draft.destination_address };

    if (serviceCategory === 'passenger_ride') {
      document.getElementById('expressRideBlock')?.classList.remove('hidden');
    }
  }

  async function autofillFromProfile() {
    if (!session) return;
    userProfile = await getUserProfile(session.user.id);
    const banner = document.getElementById('expressAuthInfoBanner');
    if (banner) {
      banner.classList.remove('hidden');
      const emailEl = document.getElementById('expressAuthEmail');
      const initialEl = document.getElementById('expressAuthInitial');
      if (emailEl) emailEl.textContent = session.user.email || '—';
      if (initialEl) initialEl.textContent = (session.user.email || 'U').charAt(0).toUpperCase();
    }
    const nameInput = document.getElementById('expressCustomerName');
    const phoneInput = document.getElementById('expressCustomerPhone');
    if (nameInput && !nameInput.value) {
      nameInput.value = userProfile?.display_name || (session.user.email || '').split('@')[0] || '';
      draft.customer_name = nameInput.value;
    }
    if (phoneInput && !phoneInput.value) {
      phoneInput.value = userProfile?.phone || '';
      draft.customer_phone = phoneInput.value;
    }
    saveDraft();
  }

  // -------------------------------------------------------------
  // Bind wizard
  // -------------------------------------------------------------
  function bindWizard() {
    document.getElementById('expressStep1Next')?.addEventListener('click', () => {
      draft.origin_address = document.getElementById('expressOriginAddress').value.trim();
      draft.destination_address = document.getElementById('expressDestAddress').value.trim();
      if (!draft.origin_address) { alert('Ingresa el origen.'); return; }
      if (!draft.destination_address) { alert('Ingresa el destino.'); return; }
      saveDraft();
      setWizardStep(2);
    });

    document.getElementById('expressStep2Back')?.addEventListener('click', () => setWizardStep(1));

    document.getElementById('expressStep2Next')?.addEventListener('click', () => {
      draft.customer_name = document.getElementById('expressCustomerName').value.trim();
      draft.customer_phone = document.getElementById('expressCustomerPhone').value.trim();
      draft.description = document.getElementById('expressDesc').value.trim();
      draft.items = document.getElementById('expressItems').value;
      draft.notes = document.getElementById('expressNotes').value;
      if (!draft.customer_name) { alert('Ingresa tu nombre.'); return; }
      if (String(draft.customer_phone).replace(/\D/g,'').length < 8) { alert('Ingresa un teléfono válido.'); return; }
      if (!draft.description) { alert('Describe qué necesitas.'); return; }
      saveDraft();
      setWizardStep(3);
      renderStep3();
      setTimeout(() => {
        if (gmap) google.maps.event.trigger(gmap, 'resize');
      }, 150);
    });

    document.getElementById('expressStep3Back')?.addEventListener('click', () => setWizardStep(2));
    document.getElementById('expressPublishBtn')?.addEventListener('click', publishRequest);
    document.getElementById('expressCouponApplyBtn')?.addEventListener('click', applyCoupon);
    document.getElementById('expressCouponInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); }
    });
    document.getElementById('expressCustomFee')?.addEventListener('input', (e) => {
      e.target.dataset.userEdited = '1';
      draft.suggested_fee = parseFloat(e.target.value) || 0;
      saveDraft();
    });
    document.getElementById('expressShareLocationBtn')?.addEventListener('click', () => startGeolocation());
    document.getElementById('expressAuthModalClose')?.addEventListener('click', closeAuthModal);
  }

  // -------------------------------------------------------------
  // Init
  // -------------------------------------------------------------
  async function init() {
    const c = client();
    if (!c) { console.warn('[Express] Supabase no disponible'); return; }

    await loadConfig();
    renderHeader();
    setWizardStep(1);
    bindServiceSelector();
    bindWizard();
    bindGoogleMapsControls();

    session = await getSession();
    if (session) await autofillFromProfile();

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        locationPermission = perm.state;
      } catch (e) {}
    }
    updateLocationUI();

    await tryRestore();
    await initGoogleMap();

    if (session) await autofillFromProfile();
  }

  window.PasajeExpress = {
    init,
    refresh: init,
    getConfig: () => config,
    shareLocation: startGeolocation
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
// =============================================================
// /js/tiendas/tienda-auth-guard.js
// Guard de autenticación para /tiendas/dashboard/*.html
//
// Lógica:
//   1) Verifica sesión activa de Supabase Auth.
//      · Sin sesión → ../../login.html?redirect=<url-actual>
//   2) Obtiene user_profiles.account_type (robusto: user_id → id → RPC).
//      · Si no es 'merchant' ni 'admin' → alert + ../../registro.html?role=merchant
//   3) Devuelve contexto listo para initMerchantNav():
//      { client, session, user, accountType, stores, store }
//
// Uso desde una página de /tiendas/dashboard/:
//   const ctx = await window.tiendaRequireMerchant();
//   if (!ctx) return; // guard ya redirigió
// =============================================================

(function () {
  'use strict';

  const LOGIN_PATH     = '../../login.html';
  const REGISTER_PATH  = '../../registro.html?role=merchant';
  const ALLOWED_TYPES  = ['merchant', 'admin'];
  const ACTIVE_STORE_KEY = 'activeStoreId';

  function getClient() {
    return window._supabase ||
      (typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null);
  }

  function buildLoginRedirect() {
    try {
      const current = window.location.pathname + window.location.search;
      const url = new URL(LOGIN_PATH, window.location.href);
      url.searchParams.set('redirect', current);
      return url.toString();
    } catch (e) {
      return LOGIN_PATH;
    }
  }

  async function getAccountType(client, userId) {
    if (!client || !userId) return null;

    // 1) user_profiles WHERE user_id = auth.uid()
    try {
      const { data } = await client
        .from('user_profiles')
        .select('account_type')
        .eq('user_id', userId)
        .maybeSingle();
      if (data && data.account_type) return data.account_type;
    } catch (e) { /* noop */ }

    // 2) Fallback: user_profiles WHERE id = auth.uid()
    try {
      const { data } = await client
        .from('user_profiles')
        .select('account_type')
        .eq('id', userId)
        .maybeSingle();
      if (data && data.account_type) return data.account_type;
    } catch (e) { /* noop */ }

    // 3) Fallback: función RPC
    try {
      const { data } = await client.rpc('get_my_account_type');
      if (data) return data;
    } catch (e) { /* noop */ }

    return null;
  }

  async function getMyStores(client, userId) {
    if (!client || !userId) return [];
    try {
      const { data, error } = await client
        .from('stores')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) return [];
      return data || [];
    } catch (e) {
      return [];
    }
  }

  function pickActiveStore(stores) {
    if (!stores || stores.length === 0) return null;
    let storedId = null;
    try { storedId = localStorage.getItem(ACTIVE_STORE_KEY); } catch (e) {}
    let active = stores.find(s => String(s.id) === String(storedId));
    if (!active) {
      active = stores[0];
      try { localStorage.setItem(ACTIVE_STORE_KEY, String(active.id)); } catch (e) {}
    }
    return active;
  }

  async function guard() {
    const client = getClient();

    if (!client) {
      console.warn('[TiendaAuthGuard] Supabase no disponible. Redirigiendo a login.');
      window.location.replace(buildLoginRedirect());
      return null;
    }

    // 1) Sesión
    let session = null;
    try {
      const { data } = await client.auth.getSession();
      session = (data && data.session) || null;
    } catch (e) {
      console.warn('[TiendaAuthGuard] getSession error:', e);
    }

    if (!session) {
      window.location.replace(buildLoginRedirect());
      return null;
    }

    // 2) Tipo de cuenta
    const accountType = await getAccountType(client, session.user.id);

    if (!accountType || ALLOWED_TYPES.indexOf(accountType) === -1) {
      try {
        alert('🔒 Esta sección es exclusiva para cuentas de Comercio.\n\nTe llevaremos a activar tu perfil de comerciante.');
      } catch (e) { /* noop */ }
      window.location.replace(REGISTER_PATH);
      return null;
    }

    // 3) Tiendas del usuario
    const stores = await getMyStores(client, session.user.id);
    const store  = pickActiveStore(stores);

    return {
      client,
      session,
      user: session.user,
      accountType,
      stores,
      store
    };
  }

  // Auto-ejecución: exponemos una promesa reutilizable
  window.__pasajeTiendaAuthPromise = guard();

  window.tiendaRequireMerchant = function () {
    return window.__pasajeTiendaAuthPromise;
  };

  window.tiendaAuthGuard = guard;

  // Helpers de tienda activa para reuso
  window.setActiveStore = function (id) {
    try { if (id) localStorage.setItem(ACTIVE_STORE_KEY, String(id)); } catch (e) {}
  };
  window.clearActiveStore = function () {
    try { localStorage.removeItem(ACTIVE_STORE_KEY); } catch (e) {}
  };
})();
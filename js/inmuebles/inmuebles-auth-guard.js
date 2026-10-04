// =============================================================
// js/inmuebles/inmuebles-auth-guard.js
// Guard de autenticación + rol para las páginas de /inmuebles/dashboard/
// =============================================================

(function () {
  'use strict';

  function client() {
    return window._supabase || (typeof initSupabaseClient === 'function' ? initSupabaseClient() : null);
  }

  function currentPath() {
    return (window.location.pathname || '').toLowerCase();
  }

  function isInInmueblesFolder() {
    return currentPath().includes('/inmuebles/');
  }

  function loginUrl() {
    return isInInmueblesFolder() ? '../../login.html' : '../login.html';
  }

  function dashboardUrl(role) {
    const base = isInInmueblesFolder() ? '../../dashboard/' : '../dashboard/';
    switch (role) {
      case 'delivery':    return base + 'dashboard-delivery.html';
      case 'merchant':    return base + 'dashboard-productos.html';
      case 'real_estate': return base + 'dashboard-inmuebles.html';
      case 'admin':       return (isInInmueblesFolder() ? '../../admin/' : '../admin/') + 'admin-usuarios.html';
      default:            return isInInmueblesFolder() ? '../../index.html' : '../index.html';
    }
  }

  async function fetchRoles(userId) {
    const c = client();
    if (!c || !userId) return null;
    try {
      const { data } = await c
        .from('user_roles')
        .select('is_admin, is_merchant, is_delivery, is_real_estate')
        .eq('user_id', userId)
        .maybeSingle();
      return data || null;
    } catch (e) {
      console.warn('[InmueblesGuard] roles error:', e);
      return null;
    }
  }

  /**
   * Guard para páginas del agente inmobiliario
   * @param {Object} options
   *   options.requiredRole: 'real_estate' (default)
   *   options.allowAdmin: boolean (default true)
   *   options.redirectOnMissingRole: boolean (default true)
   */
  async function guardInmueblesPage(options = {}) {
    const c = client();
    if (!c) return null;

    const requiredRole = options.requiredRole || 'real_estate';
    const allowAdmin = options.allowAdmin !== false;
    const redirectOnMissingRole = options.redirectOnMissingRole !== false;

    // 1) Sesión
    let session = null;
    try {
      const { data: { session: s } } = await c.auth.getSession();
      session = s;
    } catch (e) {
      console.warn('[InmueblesGuard] session error:', e);
    }

    if (!session) {
      const here = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`${loginUrl()}?redirect=${here}`);
      return null;
    }

    // 2) Roles
    const roles = await fetchRoles(session.user.id);
    const hasRole = roles && roles[`is_${requiredRole}`] === true;
    const isAdmin = roles && roles.is_admin === true;

    if (!hasRole && !(allowAdmin && isAdmin)) {
      if (redirectOnMissingRole) {
        const fallback = dashboardUrl('merchant');
        const target = `../../registro.html?role=${requiredRole}&redirect=${encodeURIComponent('inmuebles/dashboard/index.html')}`;
        const hasAnyRole = roles && (roles.is_merchant || roles.is_delivery || roles.is_real_estate || roles.is_admin);
        window.location.replace(hasAnyRole ? fallback : target);
      }
      return { session, user: session.user, roles, hasRole: false, isAdmin };
    }

    return { session, user: session.user, roles, hasRole: true, isAdmin };
  }

  window.PasajeInmueblesGuard = {
    guard: guardInmueblesPage,
    fetchRoles,
    dashboardUrl,
    loginUrl
  };
})();

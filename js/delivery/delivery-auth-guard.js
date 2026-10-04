// =============================================================
// js/delivery/delivery-auth-guard.js
// Guard de autenticación + rol para las páginas de /delivery/dashboard/
// =============================================================

(function () {
  'use strict';

  function client() {
    return window._supabase || (typeof initSupabaseClient === 'function' ? initSupabaseClient() : null);
  }

  function currentPath() {
    return (window.location.pathname || '').toLowerCase();
  }

  function isInDeliveryFolder() {
    return currentPath().includes('/delivery/');
  }

  function loginUrl() {
    return isInDeliveryFolder() ? '../../login.html' : '../login.html';
  }

  function registroUrl(role) {
    return (isInDeliveryFolder() ? '../../registro.html' : '../registro.html') + '?role=' + encodeURIComponent(role);
  }

  function dashboardUrl(role) {
    // Mapea rol → dashboard por defecto
    const base = isInDeliveryFolder() ? '../../dashboard/' : '../dashboard/';
    switch (role) {
      case 'delivery':    return base + 'dashboard-delivery.html';
      case 'merchant':    return base + 'dashboard-productos.html';
      case 'real_estate': return base + 'dashboard-inmuebles.html';
      case 'admin':       return (isInDeliveryFolder() ? '../../admin/' : '../admin/') + 'admin-usuarios.html';
      default:            return isInDeliveryFolder() ? '../../index.html' : '../index.html';
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
      console.warn('[DeliveryGuard] roles error:', e);
      return null;
    }
  }

  /**
   * Guard para páginas del piloto de delivery
   * @param {Object} options
   *   options.requiredRole: 'delivery' (default)
   *   options.allowAdmin: boolean (default true)
   *   options.redirectOnMissingRole: boolean (default true)
   * @returns {Object|null} { session, user, roles }
   */
  async function guardDeliveryPage(options = {}) {
    const c = client();
    if (!c) return null;

    const requiredRole = options.requiredRole || 'delivery';
    const allowAdmin = options.allowAdmin !== false;
    const redirectOnMissingRole = options.redirectOnMissingRole !== false;

    // 1) Sesión
    let session = null;
    try {
      const { data: { session: s } } = await c.auth.getSession();
      session = s;
    } catch (e) {
      console.warn('[DeliveryGuard] session error:', e);
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
        // Si tiene otro rol, ofrecer activarlo; si no, mandarlo a registro
        const fallback = dashboardUrl('merchant');
        const target = `../../registro.html?role=${requiredRole}&redirect=${encodeURIComponent('delivery/dashboard/index.html')}`;
        // Si el usuario claramente no tiene roles, mandarlo a registro
        const hasAnyRole = roles && (roles.is_merchant || roles.is_delivery || roles.is_real_estate || roles.is_admin);
        window.location.replace(hasAnyRole ? fallback : target);
      }
      return { session, user: session.user, roles, hasRole: false, isAdmin };
    }

    return { session, user: session.user, roles, hasRole: true, isAdmin };
  }

  window.PasajeDeliveryGuard = {
    guard: guardDeliveryPage,
    fetchRoles,
    dashboardUrl,
    loginUrl,
    registroUrl
  };
})();
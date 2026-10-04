// =============================================================
// js/admin-utils.js
// Helpers compartidos entre las páginas de /admin/
// =============================================================

(function () {
  'use strict';

  window.adminEscapeHtml = function (str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  window.adminGenerateSlug = function (str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  window.adminFormatDate = function (dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  };

  window.adminReasonLabel = function (reason) {
    const map = {
      'spam': '🚫 Spam / Publicidad engañosa',
      'ofensivo': '⚠️ Contenido ofensivo',
      'inexistente': '🔍 Producto inexistente / Agotado',
      'otro': '💬 Otro',
    };
    return map[reason] || ('💬 ' + (reason || 'Sin motivo'));
  };

  window.adminReportStatus = function (r) {
    if (r.status === 'resolved')  return { key: 'resolved',  label: '✅ Resuelto',           cls: 'bg-emerald-100 text-emerald-700' };
    if (r.status === 'dismissed') return { key: 'dismissed', label: '🗑️ Descartado',         cls: 'bg-gray-200 text-gray-700' };
    if (r.vendor_response)        return { key: 'answered',  label: '💬 Aclaración enviada', cls: 'bg-blue-100 text-blue-700' };
    return { key: 'pending', label: '⏳ Pendiente', cls: 'bg-amber-100 text-amber-800' };
  };

  window.adminOrderStatus = function (status) {
    const map = {
      'sent':      { key: 'sent',      label: '⏳ Nuevo',       cls: 'bg-amber-100 text-amber-800' },
      'contacted': { key: 'contacted', label: '💬 Contactado',  cls: 'bg-blue-100 text-blue-700' },
      'completed': { key: 'completed', label: '✅ Completado',  cls: 'bg-emerald-100 text-emerald-700' },
      'cancelled': { key: 'cancelled', label: '🗑️ Cancelado',  cls: 'bg-gray-200 text-gray-700' },
    };
    return map[status] || { key: status, label: status, cls: 'bg-gray-100 text-gray-600' };
  };

  window.adminInjectStyles = function () {
    if (document.getElementById('adminSharedStyles')) return;
    const s = document.createElement('style');
    s.id = 'adminSharedStyles';
    s.textContent = [
      '.tab-active { border-bottom-color: #f59e0b !important; color: #111827 !important; }',
      '.report-chip { transition: all .15s; cursor: pointer; border: 0; }',
      '.no-scrollbar::-webkit-scrollbar { display: none; }',
      '.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }',
      '.chip { white-space: nowrap; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px; transition: all .15s; cursor: pointer; border: 0; }',
      '.chip-active { background: #1e3a8a; color: white; }',
      '.chip-idle { background: white; color: #374151; border: 1px solid #d1d5db; }',
      '.chip-idle:hover { background: #f3f4f6; }'
    ].join('\n');
    document.head.appendChild(s);
  };

  window.adminGuardPage = async function () {
    const session = await requireAuth();
    if (!session) return null;
    if (!(await isAdmin())) {
      alert('No tienes permisos de administrador.');
      window.location.replace('admin.html');
      return null;
    }
    return session;
  };
})();
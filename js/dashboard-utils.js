// =============================================================
// js/dashboard-utils.js
// Helpers compartidos entre todas las páginas del dashboard
// =============================================================

(function () {
  'use strict';

  window.dashEscapeHtml = function (str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  window.dashFormatDateTime = function (dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  };

  window.dashFormatCycleDate = function (dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  };

  window.dashRelativeDate = function (dateStr) {
    if (!dateStr) return '—';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days <= 0) return 'hoy';
    if (days === 1) return 'ayer';
    if (days < 30) return `hace ${days} días`;
    if (days < 60) return `hace ${Math.floor(days / 7)} sem`;
    if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
    return 'hace más de un año';
  };

  window.dashDaysSince = function (dateStr) {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  };

  window.dashCombinePhone = function (prefix, localNumber) {
    const clean = (typeof window.cleanPhone === 'function')
      ? window.cleanPhone(localNumber)
      : String(localNumber || '').replace(/\D/g, '');
    if (!clean) return null;
    if (clean.startsWith(prefix)) return clean;
    return prefix + clean;
  };

  window.dashSplitPhone = function (fullPhone, defaultPrefix = '502') {
    if (!fullPhone) return { prefix: defaultPrefix, local: '' };
    const clean = (typeof window.cleanPhone === 'function')
      ? window.cleanPhone(fullPhone)
      : String(fullPhone).replace(/\D/g, '');
    const known = ['502', '503', '504', '505', '506', '507', '52', '1'];
    const sorted = [...known].sort((a, b) => b.length - a.length);
    for (const p of sorted) {
      if (clean.startsWith(p) && clean.length > p.length) {
        return { prefix: p, local: clean.slice(p.length) };
      }
    }
    return { prefix: defaultPrefix, local: clean };
  };

  window.dashReasonLabel = function (reason) {
    const map = {
      'spam': '🚫 Spam / Publicidad engañosa',
      'ofensivo': '⚠️ Contenido ofensivo',
      'inexistente': '🔍 Producto inexistente / Agotado',
      'otro': '💬 Otro',
    };
    return map[reason] || ('💬 ' + (reason || 'Sin motivo'));
  };

  window.dashSupportStatus = function (r) {
    if (!r) return { key: 'pending', label: '⏳ Pendiente', cls: 'bg-amber-100 text-amber-800' };
    if (r.status === 'resolved')  return { key: 'resolved',  label: '✅ Resuelto',           cls: 'bg-emerald-100 text-emerald-700' };
    if (r.status === 'dismissed') return { key: 'dismissed', label: '🗑️ Descartado',         cls: 'bg-gray-200 text-gray-700' };
    if (r.vendor_response)        return { key: 'answered',  label: '💬 Aclaración enviada', cls: 'bg-blue-100 text-blue-700' };
    return { key: 'pending', label: '⏳ Pendiente', cls: 'bg-amber-100 text-amber-800' };
  };

  window.dashOrderStatus = function (status) {
    const map = {
      'sent':      { key: 'sent',      label: '⏳ Nuevo',       cls: 'bg-amber-100 text-amber-800' },
      'pending':   { key: 'pending',   label: '⏳ Pendiente',   cls: 'bg-amber-100 text-amber-800' },
      'contacted': { key: 'contacted', label: '💬 Contactado',  cls: 'bg-blue-100 text-blue-700' },
      'completed': { key: 'completed', label: '✅ Completado',  cls: 'bg-emerald-100 text-emerald-700' },
      'cancelled': { key: 'cancelled', label: '🗑️ Cancelado',  cls: 'bg-gray-200 text-gray-700' },
    };
    return map[status] || { key: status, label: status || 'Pendiente', cls: 'bg-gray-100 text-gray-600' };
  };

  window.dashInjectFilterStyles = function () {
    if (document.getElementById('dashFilterStyles')) return;
    const s = document.createElement('style');
    s.id = 'dashFilterStyles';
    s.textContent = [
      '.filter-chip { white-space: nowrap; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px; transition: all .15s; cursor: pointer; border: 0; }',
      '.filter-chip-active { background: #1e3a8a; color: white; }',
      '.filter-chip-idle { background: white; color: #374151; border: 1px solid #d1d5db; }',
      '.filter-chip-idle:hover { background: #f3f4f6; }',
      '.dropzone-active { border-color: #10b981 !important; background-color: #ecfdf5 !important; }',
      '.tag-chip { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 3px; }',
      '.no-scrollbar::-webkit-scrollbar { display: none; }',
      '.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }'
    ].join('\n');
    document.head.appendChild(s);
  };

  window.dashSetupDropzone = function ({ dropId, inputId, previewId, imgId, placeholderId, removeId, onFile, initialUrl }) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const img = document.getElementById(imgId);
    const placeholder = document.getElementById(placeholderId);
    const removeBtn = removeId ? document.getElementById(removeId) : null;

    if (!drop || !input || !preview || !img || !placeholder) return null;

    function showPreview(url) {
      img.src = url;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    }
    function clearPreview() {
      input.value = '';
      img.src = '';
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
    }

    drop.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      input.click();
    });

    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('dropzone-active');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('dropzone-active'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('dropzone-active');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });

    function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Selecciona una imagen válida.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => showPreview(ev.target.result);
      reader.readAsDataURL(file);
      if (typeof onFile === 'function') onFile(file);
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPreview();
        if (typeof onFile === 'function') onFile(null);
      });
    }

    if (initialUrl) showPreview(initialUrl);

    return { clearPreview, showPreview };
  };
})();
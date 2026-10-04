// =============================================================
// js/footer.js
// Footer reutilizable para Pasaje de los Altos
// Uso: <div id="pasajeFooter"></div> + <script src="js/footer.js"></script>
// FASE 24-A: Enlaces al marketplace apuntan a /tiendas/*
// =============================================================

(function () {
  'use strict';

  // Detecta si estamos dentro de una subcarpeta (/admin/, /dashboard/, /tiendas/)
  function getRootPrefix() {
    const path = window.location.pathname;
    if (path.includes('/admin/') || path.includes('/dashboard/')) return '../';
    if (path.includes('/tiendas/')) return '../';
    if (path.includes('/delivery/')) return '../';
    if (path.includes('/inmuebles/')) return '../';
    return '';
  }

  // Año actual
  function currentYear() {
    return new Date().getFullYear();
  }

  // ---------------------------------------------------------
  // Render del footer
  // ---------------------------------------------------------
  function renderFooter() {
    const R = getRootPrefix();
    const year = currentYear();

    return `
      <footer class="bg-gray-900 text-gray-300 mt-12">
        <div class="max-w-6xl mx-auto px-4 py-10">

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

            <!-- Marca -->
            <div class="space-y-3">
              <h3 class="text-white text-lg font-extrabold">
                Pasaje de los <span class="text-emerald-400">Altos</span>
              </h3>
              <p class="text-xs text-gray-400 leading-relaxed">
                Directorio comercial y marketplace local para Quetzaltenango.
                Apoya a los emprendedores de tu comunidad.
              </p>
              <div class="flex items-center gap-2 pt-1">
                <span class="text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-900/40 px-2 py-1 rounded-full">
                  Hecho en Xela 🇬🇹
                </span>
              </div>
            </div>

            <!-- Explorar -->
            <div>
              <h4 class="text-white text-sm font-bold uppercase tracking-wider mb-3">Explorar</h4>
              <ul class="space-y-2 text-sm">
                <li><a href="${R}tiendas/productos.html" class="hover:text-emerald-400 transition">🛍️ Catálogo</a></li>
                <li><a href="${R}delivery.html" class="hover:text-emerald-400 transition">🛵 Pasaje Express</a></li>
                <li><a href="${R}tiendas/favoritos.html" class="hover:text-emerald-400 transition">❤️ Mis favoritos</a></li>
                <li><a href="${R}tiendas/productos.html?openCategories=true" class="hover:text-emerald-400 transition">🏷️ Categorías</a></li>
                <li><a href="${R}registro.html" class="hover:text-emerald-400 transition">➕ Vender aquí</a></li>
              </ul>
            </div>

            <!-- Módulos -->
            <div>
              <h4 class="text-white text-sm font-bold uppercase tracking-wider mb-3">Módulos</h4>
              <ul class="space-y-2 text-sm">
                <li><a href="${R}tiendas/productos.html" class="hover:text-emerald-400 transition">🛍️ Marketplace</a></li>
                <li><a href="${R}delivery.html" class="hover:text-emerald-400 transition">🛵 Delivery Xela</a></li>
                <li><a href="${R}inmuebles.html" class="hover:text-emerald-400 transition">🏢 Inmuebles</a></li>
                <li><a href="${R}tiendas/rastreo.html" class="hover:text-emerald-400 transition">📍 Rastreo de pedido</a></li>
              </ul>
            </div>

            <!-- Información -->
            <div>
              <h4 class="text-white text-sm font-bold uppercase tracking-wider mb-3">Información</h4>
              <ul class="space-y-2 text-sm">
                <li><a href="${R}nosotros.html" class="hover:text-emerald-400 transition">👥 Nosotros</a></li>
                <li><a href="${R}terminos.html" class="hover:text-emerald-400 transition">📄 Términos de uso</a></li>
                <li><a href="${R}contacto.html" class="hover:text-emerald-400 transition">✉️ Contacto</a></li>
                <li><a href="${R}login.html" class="hover:text-emerald-400 transition">🔐 Iniciar sesión</a></li>
                <li><a href="${R}dashboard/dashboard.html" class="hover:text-emerald-400 transition">📊 Panel del vendedor</a></li>
              </ul>

              <div class="mt-4 pt-4 border-t border-gray-800">
                <p class="text-[11px] text-gray-500">
                  ¿Problemas con un pedido?
                </p>
                <a href="${R}contacto.html"
                   class="inline-block mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg transition">
                  🆘 Soporte
                </a>
              </div>
            </div>
          </div>

          <!-- Divisor -->
          <div class="border-t border-gray-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p class="text-xs text-gray-500 text-center sm:text-left">
              © ${year} Pasaje de los Altos · Hecho con cariño para emprendedores locales.
            </p>
            <div class="flex items-center gap-3 text-xs text-gray-500">
              <span>Hecho en Quetzaltenango, Guatemala</span>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  // ---------------------------------------------------------
  // Inyectar
  // ---------------------------------------------------------
  function injectFooter() {
    const mount = document.getElementById('pasajeFooter');
    if (!mount) return;
    mount.innerHTML = renderFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
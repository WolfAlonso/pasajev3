// =============================================================
// /js/services/products-service.js
// Servicio de consulta de productos, verificación de tiendas,
// ofertas relámpago, banners y variantes (color / talla / matriz).
// FASE 22: soporte para colors, sizes y variant_matrix (jsonb).
// =============================================================

(function () {
  'use strict';

  const PAGE_SIZE = 12;

  // --------------------------------------------------------------------------
  // Selects reutilizables (evita duplicar strings largos)
  // --------------------------------------------------------------------------
  const BASE_SELECT = `
    id, title, description, price, original_price, is_on_sale, sale_expires_at,
    image_url, image_urls, is_featured, is_active,
    stock_quantity, badge_tag, prep_time, min_order_qty, favorites_count,
    store_id, category_id, created_at,
    colors, sizes, variant_matrix,
    stores!inner ( id, name, whatsapp, slug, address, logo_url, is_active, is_suspended, is_verified ),
    categories ( id, name, slug, icon ),
    product_images ( id, image_url, sort_order ),
    product_variants ( id, variant_group, name, price_adjustment, stock_quantity )
  `;

  const BASE_SELECT_INNER_CATEGORY = `
    id, title, description, price, original_price, is_on_sale, sale_expires_at,
    image_url, image_urls, is_featured, is_active,
    stock_quantity, badge_tag, prep_time, min_order_qty, favorites_count,
    store_id, category_id, created_at,
    colors, sizes, variant_matrix,
    stores!inner ( id, name, whatsapp, slug, address, logo_url, is_active, is_suspended, is_verified ),
    categories!inner ( id, name, slug, icon ),
    product_images ( id, image_url, sort_order ),
    product_variants ( id, variant_group, name, price_adjustment, stock_quantity )
  `;

  // --------------------------------------------------------------------------
  // Normalización de producto
  // --------------------------------------------------------------------------
  function normalizeProduct(p) {
    if (!p) return null;
    const s = p.stores || {};
    const c = p.categories || {};

    // ---------- Imágenes ----------
    const rawMainImg = p.image_url || null;
    const allImages = [];

    if (rawMainImg) allImages.push(rawMainImg);

    let secondaryImgs = [];
    if (Array.isArray(p.image_urls)) {
      secondaryImgs = p.image_urls.filter(Boolean);
    } else if (typeof p.image_urls === 'string') {
      try {
        const parsed = JSON.parse(p.image_urls);
        if (Array.isArray(parsed)) secondaryImgs = parsed.filter(Boolean);
      } catch (e) { /* noop */ }
    }

    if (Array.isArray(p.product_images) && p.product_images.length > 0) {
      const relImgs = p.product_images
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(img => img.image_url)
        .filter(Boolean);
      relImgs.forEach(u => { if (!secondaryImgs.includes(u)) secondaryImgs.push(u); });
    }

    secondaryImgs.forEach(url => {
      if (url && !allImages.includes(url)) allImages.push(url);
    });

    const mainImg = allImages.length > 0 ? allImages[0] : null;
    const gallerySecondary = allImages.length > 1 ? allImages.slice(1) : [];

    // ---------- Variantes NUEVAS (jsonb en products) ----------
    const colorsRaw = Array.isArray(p.colors) ? p.colors : [];
    const sizesRaw  = Array.isArray(p.sizes)  ? p.sizes  : [];
    const matrixRaw = (p.variant_matrix && typeof p.variant_matrix === 'object' && !Array.isArray(p.variant_matrix))
      ? p.variant_matrix
      : {};

    const colors = colorsRaw
      .filter(x => x && x.name)
      .map(x => ({
        name: String(x.name),
        hex: x.hex || null,
        image: x.image || null,
        price: (x.price !== undefined && x.price !== null && x.price !== '') ? parseFloat(x.price) : null,
        stock: (x.stock !== undefined && x.stock !== null && x.stock !== '') ? parseInt(x.stock, 10) : null
      }));

    const sizes = sizesRaw
      .filter(x => x && x.name)
      .map(x => ({
        name: String(x.name),
        price: (x.price !== undefined && x.price !== null && x.price !== '') ? parseFloat(x.price) : null,
        stock: (x.stock !== undefined && x.stock !== null && x.stock !== '') ? parseInt(x.stock, 10) : null
      }));

    const variants = {};
    Object.keys(matrixRaw).forEach(key => {
      const v = matrixRaw[key] || {};
      variants[key] = {
        price: (v.price !== undefined && v.price !== null && v.price !== '') ? parseFloat(v.price) : null,
        stock: (v.stock !== undefined && v.stock !== null && v.stock !== '') ? parseInt(v.stock, 10) : null,
        sku: v.sku || null,
        image: v.image || null
      };
    });

    // ---------- Variantes LEGACY (tabla product_variants) ----------
    // Se mantienen en `legacy_variants` para cualquier código viejo que aún las consuma.
    let legacyVariants = [];
    if (Array.isArray(p.product_variants)) {
      legacyVariants = p.product_variants.map(v => ({
        id: v.id,
        group: v.variant_group || 'Opción',
        name: v.name || '',
        price_adjustment: parseFloat(v.price_adjustment || 0),
        stock_quantity: (v.stock_quantity === null || v.stock_quantity === undefined)
          ? null
          : parseInt(v.stock_quantity, 10)
      }));
    }

    // Fallback: si NO hay colors/sizes nuevos pero sí product_variants,
    // derivamos colors/sizes del grupo para que la tarjeta nueva pueda pintarlos.
    if (colors.length === 0 && sizes.length === 0 && legacyVariants.length > 0) {
      legacyVariants.forEach(v => {
        const group = String(v.group || '').toLowerCase();
        const name = String(v.name || '').trim();
        if (!name) return;

        if (group.includes('color') || group.includes('colour') || group.includes('tono')) {
          colors.push({
            name,
            hex: null,
            image: null,
            price: v.price_adjustment || null,
            stock: v.stock_quantity
          });
        } else {
          sizes.push({
            name,
            price: v.price_adjustment || null,
            stock: v.stock_quantity
          });
        }
      });
    }

    // ---------- Ofertas ----------
    let effectivePrice = parseFloat(p.price || 0);
    let effectiveOriginalPrice = (p.original_price !== null && p.original_price !== undefined)
      ? parseFloat(p.original_price)
      : null;
    let effectiveIsOnSale = !!p.is_on_sale;

    if (effectiveIsOnSale && p.sale_expires_at) {
      const expDate = new Date(p.sale_expires_at);
      if (expDate <= new Date()) {
        effectiveIsOnSale = false;
        if (effectiveOriginalPrice && effectiveOriginalPrice > effectivePrice) {
          effectivePrice = effectiveOriginalPrice;
          effectiveOriginalPrice = null;
        }
        if (p.id && typeof window._supabase !== 'undefined') {
          window._supabase.from('products').update({
            is_on_sale: false,
            price: effectivePrice,
            original_price: null
          }).eq('id', p.id).then(() => {}).catch(() => {});
        }
      }
    }

    // ---------- Devolución ----------
    return {
      id: p.id,
      title: p.title || '',
      description: p.description || '',
      price: effectivePrice,
      original_price: effectiveOriginalPrice,
      is_on_sale: effectiveIsOnSale,
      sale_expires_at: p.sale_expires_at || null,
      image_url: mainImg,
      image_urls: gallerySecondary,
      images: allImages.length > 0 ? allImages : (mainImg ? [mainImg] : []),

      // ---- NUEVAS variantes ----
      colors: colors,
      sizes: sizes,
      variants: variants,                // matriz { "Negro-M": { price, stock, sku, image } }

      // ---- LEGACY (compat) ----
      legacy_variants: legacyVariants,   // array viejo

      is_featured: !!p.is_featured,
      is_active: p.is_active !== false,
      stock_quantity: (p.stock_quantity === null || p.stock_quantity === undefined)
        ? null
        : parseInt(p.stock_quantity, 10),
      badge_tag: p.badge_tag || null,
      prep_time: p.prep_time || null,
      min_order_qty: p.min_order_qty || 1,
      favorites_count: p.favorites_count || 0,

      store_id: s.id || p.store_id || null,
      store_name: s.name || 'Tienda local',
      store_slug: s.slug || null,
      store_whatsapp: s.whatsapp || '',
      store_address: s.address || null,
      store_logo: s.logo_url || null,
      store_is_active: s.is_active !== false,
      store_is_suspended: !!s.is_suspended,
      store_is_verified: !!s.is_verified,

      category_id: c.id || p.category_id || null,
      category_name: c.name || 'General',
      category_slug: c.slug || 'otros',
      category_icon: c.icon || '📦',

      created_at: p.created_at
    };
  }

  // --------------------------------------------------------------------------
  // fetchProducts
  // --------------------------------------------------------------------------
  async function fetchProducts({
    page = 0,
    limit = PAGE_SIZE,
    categorySlug = 'todas',
    searchTerm = '',
    sortBy = 'recent',
    minPrice = null,
    maxPrice = null
  } = {}) {
    if (typeof window._supabase === 'undefined') {
      throw new Error('Supabase no está inicializado.');
    }

    const from = page * limit;
    const to = from + limit - 1;

    const selectQuery = (categorySlug && categorySlug !== 'todas')
      ? BASE_SELECT_INNER_CATEGORY
      : BASE_SELECT;

    let query = window._supabase
      .from('products')
      .select(selectQuery, { count: 'exact' })
      .eq('is_active', true)
      .eq('stores.is_active', true)
      .eq('stores.is_suspended', false);

    if (categorySlug && categorySlug !== 'todas') {
      query = query.eq('categories.slug', categorySlug);
    }

    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.trim();
      query = query.ilike('title', `%${term}%`);
    }

    if (minPrice !== null && minPrice !== undefined && minPrice !== '' && !isNaN(minPrice)) {
      query = query.gte('price', parseFloat(minPrice));
    }

    if (maxPrice !== null && maxPrice !== undefined && maxPrice !== '' && !isNaN(maxPrice)) {
      query = query.lte('price', parseFloat(maxPrice));
    }

    switch (sortBy) {
      case 'popular':
        query = query.order('favorites_count', { ascending: false })
                     .order('created_at', { ascending: false });
        break;
      case 'price-asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price-desc':
        query = query.order('price', { ascending: false });
        break;
      case 'recent':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[ProductsService] Error en consulta de catálogo:', error);
      throw error;
    }

    const products = (data || [])
      .map(normalizeProduct)
      .filter(p => p && p.store_is_active && !p.store_is_suspended);

    const totalCount = count || 0;
    const hasMore = (from + products.length) < totalCount;

    return { products, hasMore, totalCount, page, limit };
  }

  // --------------------------------------------------------------------------
  // fetchFlashSales
  // --------------------------------------------------------------------------
  async function fetchFlashSales(limit = 10) {
    if (typeof window._supabase === 'undefined') return [];

    const nowIso = new Date().toISOString();

    const { data, error } = await window._supabase
      .from('products')
      .select(BASE_SELECT)
      .eq('is_active', true)
      .eq('is_on_sale', true)
      .eq('stores.is_active', true)
      .eq('stores.is_suspended', false)
      .or(`sale_expires_at.gt.${nowIso},sale_expires_at.is.null`)
      .order('sale_expires_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[ProductsService] Error al obtener Ofertas Relámpago:', error);
      return [];
    }

    return (data || []).map(normalizeProduct).filter(p => p && p.is_on_sale);
  }

  // --------------------------------------------------------------------------
  // fetchSaleProducts (FASE 16)
  // --------------------------------------------------------------------------
  async function fetchSaleProducts({
    page = 0,
    limit = PAGE_SIZE,
    categorySlug = 'todas',
    searchTerm = '',
    sortBy = 'recent'
  } = {}) {
    if (typeof window._supabase === 'undefined') {
      throw new Error('Supabase no está inicializado.');
    }

    const nowIso = new Date().toISOString();
    const from = page * limit;
    const to = from + limit - 1;

    const selectQuery = (categorySlug && categorySlug !== 'todas')
      ? BASE_SELECT_INNER_CATEGORY
      : BASE_SELECT;

    let query = window._supabase
      .from('products')
      .select(selectQuery, { count: 'exact' })
      .eq('is_active', true)
      .eq('is_on_sale', true)
      .eq('stores.is_active', true)
      .eq('stores.is_suspended', false)
      .or(`sale_expires_at.gt.${nowIso},sale_expires_at.is.null`);

    if (categorySlug && categorySlug !== 'todas') {
      query = query.eq('categories.slug', categorySlug);
    }

    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.trim();
      query = query.ilike('title', `%${term}%`);
    }

    switch (sortBy) {
      case 'popular':
        query = query.order('favorites_count', { ascending: false })
                     .order('created_at', { ascending: false });
        break;
      case 'expires':
        query = query.order('sale_expires_at', { ascending: true, nullsFirst: false });
        break;
      case 'price-asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price-desc':
        query = query.order('price', { ascending: false });
        break;
      case 'recent':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[ProductsService] Error en consulta de ofertas:', error);
      throw error;
    }

    const products = (data || [])
      .map(normalizeProduct)
      .filter(p => p && p.is_on_sale && p.store_is_active && !p.store_is_suspended);

    const totalCount = count || 0;
    const hasMore = (from + products.length) < totalCount;

    return { products, hasMore, totalCount, page, limit };
  }

  // --------------------------------------------------------------------------
  // fetchSaleCategories (FASE 16)
  // --------------------------------------------------------------------------
  async function fetchSaleCategories() {
    if (typeof window._supabase === 'undefined') return { categories: [], counts: {} };

    const nowIso = new Date().toISOString();

    const { data, error } = await window._supabase
      .from('products')
      .select(`
        id, category_id,
        categories!inner ( id, name, slug, icon, sort_order ),
        stores!inner ( is_active, is_suspended )
      `)
      .eq('is_active', true)
      .eq('is_on_sale', true)
      .eq('stores.is_active', true)
      .eq('stores.is_suspended', false)
      .or(`sale_expires_at.gt.${nowIso},sale_expires_at.is.null`);

    if (error) {
      console.error('[ProductsService] Error al obtener categorías con oferta:', error);
      return { categories: [], counts: {} };
    }

    const counts = {};
    const catMap = new Map();
    let totalSaleProducts = 0;

    (data || []).forEach(p => {
      totalSaleProducts++;
      if (p.categories) {
        const cat = p.categories;
        const key = String(cat.id);
        counts[key] = (counts[key] || 0) + 1;
        if (!catMap.has(key)) {
          catMap.set(key, cat);
        }
      }
    });

    counts['todas'] = totalSaleProducts;
    const categories = Array.from(catMap.values())
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return { categories, counts };
  }

  // --------------------------------------------------------------------------
  // searchPredictive
  // --------------------------------------------------------------------------
  async function searchPredictive(term, limit = 6) {
    if (typeof window._supabase === 'undefined') return [];
    if (!term || term.trim().length < 2) return [];

    const cleanTerm = term.trim();

    const { data, error } = await window._supabase
      .from('products')
      .select(BASE_SELECT)
      .eq('is_active', true)
      .eq('stores.is_active', true)
      .eq('stores.is_suspended', false)
      .ilike('title', `%${cleanTerm}%`)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ProductsService] Error en búsqueda predictiva:', error);
      return [];
    }

    return (data || [])
      .map(normalizeProduct)
      .filter(p => p && p.store_is_active && !p.store_is_suspended);
  }

  // --------------------------------------------------------------------------
  // fetchFeaturedProducts
  // --------------------------------------------------------------------------
  async function fetchFeaturedProducts(limit = 10) {
    if (typeof window._supabase === 'undefined') return [];

    const { data, error } = await window._supabase
      .from('products')
      .select(BASE_SELECT)
      .eq('is_active', true)
      .eq('is_featured', true)
      .eq('stores.is_active', true)
      .eq('stores.is_suspended', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ProductsService] Error al obtener destacados:', error);
      return [];
    }

    return (data || []).map(normalizeProduct);
  }

  // --------------------------------------------------------------------------
  // Reviews
  // --------------------------------------------------------------------------
  async function fetchProductReviews(productId) {
    if (typeof window._supabase === 'undefined' || !productId) return [];
    const { data, error } = await window._supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  }

  async function fetchStoreReviews(storeId) {
    if (typeof window._supabase === 'undefined' || !storeId) return [];
    const { data, error } = await window._supabase
      .from('reviews')
      .select(`*, products ( id, title )`)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  }

  async function addReview({ storeId, productId, rating, comment, customerName }) {
    if (typeof window._supabase === 'undefined') throw new Error('Supabase no disponible');
    const { data, error } = await window._supabase
      .from('reviews')
      .insert([{
        store_id: storeId,
        product_id: productId,
        rating: parseInt(rating, 10),
        comment: comment ? comment.trim() : null,
        customer_name: customerName ? customerName.trim() : 'Cliente Anónimo'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // --------------------------------------------------------------------------
  // Banners
  // --------------------------------------------------------------------------
  async function fetchActiveBanners() {
    if (typeof window._supabase === 'undefined') return [];
    try {
      const { data, error } = await window._supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[ProductsService] Error al obtener banners activos:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('[ProductsService] Excepción al obtener banners:', err);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // API PÚBLICA
  // --------------------------------------------------------------------------
  window.ProductsService = {
    PAGE_SIZE,
    getProducts: fetchProducts,
    getFlashSales: fetchFlashSales,
    getSaleProducts: fetchSaleProducts,
    getSaleCategories: fetchSaleCategories,
    searchPredictive,
    getFeaturedProducts: fetchFeaturedProducts,
    fetchProductReviews,
    fetchStoreReviews,
    addReview,
    fetchActiveBanners,
    normalizeProduct
  };
})();
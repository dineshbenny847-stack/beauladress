// ── app.js – Store Frontend Logic ──────────────────────────────

let currentFilter = 'all';
let modalProduct = null;
let selectedSize = null;

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderNavUser();
  renderCollections();
  renderFilterBtns();
  renderProducts();
  renderCart();
});

// ── Nav user area ────────────────────────────────────────────────
function renderNavUser() {
  const area = document.getElementById('navUserArea');
  if (!area) return;
  const u = getCurrentUser();
  if (u) {
    area.innerHTML = `
      <a href="dashboard.html" style="display:inline-flex;align-items:center;gap:6px;font-size:.85rem;font-weight:700;color:#0d0d0d;text-decoration:none;padding:7px 14px;border:2px solid #e5e5e5;border-radius:50px;">
        <span style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#e8b4b8,#c9848a);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:.8rem;font-weight:800;">${u.name.charAt(0).toUpperCase()}</span>
        ${u.name.split(' ')[0]}
      </a>`;
  } else {
    area.innerHTML = `<a href="login.html" class="btn btn-outline" style="font-size:.82rem;padding:7px 16px;">Sign In</a>`;
  }
}

// ── Collections ─────────────────────────────────────────────────
function renderCollections() {
  const grid = document.getElementById('collectionsGrid');
  const cols = getCollections();
  grid.innerHTML = cols.map(col => {
    const count = getProducts(col.id).filter(p => p.stock > 0).length;
    return `
    <div class="collection-card">
      <img src="${col.image}" alt="${col.name}" loading="lazy"/>
      <div class="collection-info">
        <h3>${col.name}</h3>
        <p>${col.description}</p>
        <p style="font-size:.8rem;color:#888;margin-bottom:12px;">${count} items available</p>
        <button class="btn btn-outline" onclick="filterByCollection('${col.id}'); document.getElementById('shop').scrollIntoView({behavior:'smooth'})">
          Shop Collection →
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── Filter ──────────────────────────────────────────────────────
function renderFilterBtns() {
  const wrap = document.getElementById('filterBtns');
  const cols = getCollections();
  let html = `<button class="btn ${currentFilter === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="filterByCollection('all')">All</button>`;
  html += cols.map(c => `<button class="btn ${currentFilter === c.id ? 'btn-primary' : 'btn-outline'}" onclick="filterByCollection('${c.id}')">${c.name}</button>`).join('');
  wrap.innerHTML = html;
}

function filterByCollection(id) {
  currentFilter = id;
  renderFilterBtns();
  renderProducts();
}

// ── Products ────────────────────────────────────────────────────
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const products = currentFilter === 'all' ? getProducts() : getProducts(currentFilter);
  if (!products.length) { grid.innerHTML = '<p style="color:#888;grid-column:1/-1;">No products found.</p>'; return; }
  grid.innerHTML = products.map(p => {
    const col = getCollectionById(p.collectionId);
    const oos = p.stock === 0;
    const wished = isWishlisted(p.id);
    return `
    <div class="product-card" onclick="openModal('${p.id}')">
      <div class="img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy"/>
        ${oos ? '<span class="out-of-stock-ribbon">Out of Stock</span>' : ''}
        <button onclick="event.stopPropagation();wishlistToggle('${p.id}')" id="wish_${p.id}"
          style="position:absolute;top:10px;right:10px;background:#fff;border:none;border-radius:50%;width:34px;height:34px;font-size:1.1rem;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;transition:transform .15s;">
          ${wished ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="product-info">
        <p class="collection-tag">${col ? col.name : ''}</p>
        <h3>${p.name}</h3>
        <p class="price">${formatPrice(p.price)}</p>
        <button class="btn btn-pink add-to-cart" onclick="event.stopPropagation();quickAdd('${p.id}')" ${oos ? 'disabled' : ''}>
          ${oos ? '✕ Out of Stock' : '+ Add to Bag'}
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── Wishlist toggle ──────────────────────────────────────────────
function wishlistToggle(productId) {
  const u = getCurrentUser();
  if (!u) { window.location.href = 'login.html?redirect=index.html'; return; }
  const added = toggleWishlist(productId);
  const btn = document.getElementById('wish_' + productId);
  if (btn) btn.textContent = added ? '❤️' : '🤍';
  showToast(added ? '❤️ Added to wishlist!' : 'Removed from wishlist');
}

// ── Quick Add (no size selection – picks first available size) ──
function quickAdd(productId) {
  const p = getProductById(productId);
  if (!p || p.stock === 0) return;
  addToCart(productId, p.sizes[0]);
  renderCart();
  updateCartCount();
  showToast(`"${p.name}" added to bag!`);
}

// ── Product Modal ───────────────────────────────────────────────
function openModal(productId) {
  const p = getProductById(productId);
  if (!p) return;
  modalProduct = p;
  selectedSize = null;
  const col = getCollectionById(p.collectionId);
  document.getElementById('modalImg').src = p.image;
  document.getElementById('modalImg').alt = p.name;
  document.getElementById('modalCollection').textContent = col ? col.name : '';
  document.getElementById('modalName').textContent = p.name;
  document.getElementById('modalPrice').textContent = formatPrice(p.price);
  document.getElementById('modalDesc').textContent = p.description;
  const sizesDiv = document.getElementById('modalSizes');
  sizesDiv.innerHTML = p.sizes.map(s => `<button class="size-btn" onclick="selectSize('${s}',this)">${s}</button>`).join('');
  const addBtn = document.getElementById('modalAddBtn');
  if (p.stock === 0) {
    addBtn.textContent = '✕ Out of Stock';
    addBtn.disabled = true;
  } else {
    addBtn.textContent = '+ Add to Bag';
    addBtn.disabled = false;
  }
  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function selectSize(size, btn) {
  selectedSize = size;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function modalAddToCart() {
  if (!modalProduct) return;
  const size = selectedSize || modalProduct.sizes[0];
  addToCart(modalProduct.id, size);
  renderCart();
  updateCartCount();
  showToast(`"${modalProduct.name}" (${size}) added to bag!`);
  closeModal();
}

function closeModal() {
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Cart ────────────────────────────────────────────────────────
function openCart() {
  renderCart();
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCart() {
  const cart = getCart();
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  updateCartCount();
  if (!cart.length) {
    body.innerHTML = '<div class="cart-empty"><p style="font-size:2rem;">🛍️</p><p style="margin-top:8px;">Your bag is empty.</p></div>';
    footer.style.display = 'none';
    return;
  }
  body.innerHTML = cart.map(item => {
    const p = getProductById(item.productId);
    if (!p) return '';
    return `
    <div class="cart-item">
      <img src="${p.image}" alt="${p.name}"/>
      <div>
        <p class="cart-item-name">${p.name}</p>
        <p class="cart-item-meta">Size: ${item.size} &nbsp;·&nbsp; Qty: ${item.qty}</p>
        <button style="font-size:.75rem;color:#c00;text-decoration:underline;background:none;border:none;cursor:pointer;margin-top:4px;" onclick="removeItem('${item.productId}','${item.size}')">Remove</button>
      </div>
      <p class="cart-item-price">${formatPrice(p.price * item.qty)}</p>
    </div>`;
  }).join('');
  document.getElementById('cartTotal').textContent = formatPrice(getCartTotal());
  footer.style.display = 'block';
}

function removeItem(productId, size) {
  removeFromCart(productId, size);
  renderCart();
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = count;
}

function goCheckout() {
  window.location.href = 'checkout.html';
}

// ── Toast ────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

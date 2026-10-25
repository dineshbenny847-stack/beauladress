// ── admin.js – Admin Portal Logic ──────────────────────────────

// ── Auth ────────────────────────────────────────────────────────
function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const db = getDB();
  if (user === 'admin' && pass === db.adminPassword) {
    sessionStorage.setItem('ba_admin', '1');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').classList.add('visible');
    initAdmin();
  } else {
    document.getElementById('loginErr').style.display = 'block';
  }
}

function doLogout() {
  sessionStorage.removeItem('ba_admin');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminLayout').classList.remove('visible');
}

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('ba_admin')) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').classList.add('visible');
    initAdmin();
  }
});

function initAdmin() {
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  renderDashboard();
  renderCollectionsAdmin();
  renderProductsTable();
  renderStockManager();
  renderOrdersTable();
  populateCollectionFilter();
}

// ── Panel Navigation ─────────────────────────────────────────────
function switchPanel(name, el) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  el.classList.add('active');
  // Refresh data on switch
  if (name === 'dashboard') renderDashboard();
  if (name === 'collections') renderCollectionsAdmin();
  if (name === 'products') { populateCollectionFilter(); renderProductsTable(); }
  if (name === 'stock') renderStockManager();
  if (name === 'orders') renderOrdersTable();
}

// ── Dashboard ────────────────────────────────────────────────────
function renderDashboard() {
  const db = getDB();
  const totalProducts = db.products.length;
  const inStock = db.products.filter(p => p.stock > 0).length;
  const outOfStock = db.products.filter(p => p.stock === 0).length;
  const totalOrders = db.orders.length;
  const revenue = db.orders.reduce((s, o) => s + (o.total || 0), 0);

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon pink">👗</div>
      <div><div class="stat-value">${totalProducts}</div><div class="stat-label">Total Products</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">✅</div>
      <div><div class="stat-value">${inStock}</div><div class="stat-label">In Stock</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon red">❌</div>
      <div><div class="stat-value">${outOfStock}</div><div class="stat-label">Out of Stock</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange">🧾</div>
      <div><div class="stat-value">${totalOrders}</div><div class="stat-label">Total Orders</div></div>
    </div>
  `;

  // Recent orders
  const recent = [...db.orders].reverse().slice(0, 5);
  const recentDiv = document.getElementById('recentOrdersList');
  if (!recent.length) {
    recentDiv.innerHTML = '<p style="color:#888;font-size:.88rem;padding:8px 0;">No orders yet.</p>';
  } else {
    recentDiv.innerHTML = `<table><thead><tr><th>ID</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${recent.map(o => `<tr>
        <td><code style="font-size:.75rem;">${o.id.slice(-8)}</code></td>
        <td>${o.customer?.name || '—'}</td>
        <td>${formatPrice(o.total)}</td>
        <td><span class="badge badge-green">${o.status}</span></td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  // Low stock
  const low = db.products.filter(p => p.stock >= 0 && p.stock <= 3).sort((a, b) => a.stock - b.stock);
  const lowDiv = document.getElementById('lowStockList');
  if (!low.length) {
    lowDiv.innerHTML = '<p style="color:#16a34a;font-size:.88rem;padding:8px 0;">✅ All products have healthy stock levels.</p>';
  } else {
    lowDiv.innerHTML = `<table><thead><tr><th>Product</th><th>Stock</th><th>Status</th></tr></thead><tbody>
      ${low.map(p => `<tr>
        <td>${p.name}</td>
        <td>${p.stock}</td>
        <td><span class="badge ${p.stock === 0 ? 'badge-red' : 'badge-orange'}">${p.stock === 0 ? 'Out of Stock' : 'Low Stock'}</span></td>
      </tr>`).join('')}
    </tbody></table>`;
  }
}

// ── Collections ──────────────────────────────────────────────────
function renderCollectionsAdmin() {
  const cols = getCollections();
  const grid = document.getElementById('collectionsAdminGrid');
  if (!cols.length) { grid.innerHTML = '<p style="color:#888;">No collections yet. Add your first!</p>'; return; }
  grid.innerHTML = cols.map(c => {
    const count = getProducts(c.id).length;
    return `
    <div class="col-card">
      <img src="${c.image}" alt="${c.name}" onerror="this.src='https://via.placeholder.com/300x140?text=No+Image'"/>
      <div class="col-card-body">
        <h4>${c.name}</h4>
        <p>${c.description}</p>
        <p style="font-size:.75rem;color:#888;margin-bottom:10px;">${count} product${count !== 1 ? 's' : ''}</p>
        <div class="col-card-actions">
          <button class="btn btn-sm btn-success" onclick="openEditCollectionModal('${c.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteCollection('${c.id}')">🗑 Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openAddCollectionModal() {
  document.getElementById('colModalTitle').textContent = 'New Collection';
  document.getElementById('colId').value = '';
  document.getElementById('colName').value = '';
  document.getElementById('colDesc').value = '';
  document.getElementById('colImg').value = '';
  document.getElementById('colImgPreview').style.display = 'none';
  openModal('collectionModal');
}

function openEditCollectionModal(id) {
  const c = getCollectionById(id);
  if (!c) return;
  document.getElementById('colModalTitle').textContent = 'Edit Collection';
  document.getElementById('colId').value = c.id;
  document.getElementById('colName').value = c.name;
  document.getElementById('colDesc').value = c.description;
  document.getElementById('colImg').value = c.image;
  const prev = document.getElementById('colImgPreview');
  document.getElementById('colImgPreviewImg').src = c.image;
  prev.style.display = 'block';
  openModal('collectionModal');
}

document.addEventListener('input', function(e) {
  if (e.target.id === 'colImg') {
    const url = e.target.value.trim();
    const prev = document.getElementById('colImgPreview');
    if (url) { document.getElementById('colImgPreviewImg').src = url; prev.style.display = 'block'; }
    else { prev.style.display = 'none'; }
  }
});

function saveCollection() {
  const id = document.getElementById('colId').value;
  const name = document.getElementById('colName').value.trim();
  const desc = document.getElementById('colDesc').value.trim();
  const img = document.getElementById('colImg').value.trim();
  if (!name || !desc || !img) { showAdminToast('❌ Please fill in all fields.', true); return; }
  updateDB(db => {
    if (id) {
      const c = db.collections.find(x => x.id === id);
      if (c) { c.name = name; c.description = desc; c.image = img; }
    } else {
      db.collections.push({ id: generateId('col'), name, description: desc, image: img, createdAt: Date.now() });
    }
  });
  closeModal('collectionModal');
  renderCollectionsAdmin();
  populateCollectionFilter();
  renderDashboard();
  showAdminToast(id ? '✅ Collection updated!' : '✅ Collection added!');
}

function confirmDeleteCollection(id) {
  const c = getCollectionById(id);
  const pCount = getProducts(id).length;
  showConfirm(
    'Delete Collection',
    `Delete "${c.name}"? This will also remove its ${pCount} product(s). This cannot be undone.`,
    () => {
      updateDB(db => {
        db.collections = db.collections.filter(x => x.id !== id);
        db.products = db.products.filter(p => p.collectionId !== id);
      });
      renderCollectionsAdmin();
      renderProductsTable();
      renderStockManager();
      renderDashboard();
      showAdminToast('🗑 Collection deleted.');
    }
  );
}

// ── Products ─────────────────────────────────────────────────────
function populateCollectionFilter() {
  const sel = document.getElementById('productFilterCol');
  if (!sel) return;
  const cols = getCollections();
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Collections</option>' +
    cols.map(c => `<option value="${c.id}" ${current === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

  const prodColSel = document.getElementById('prodCollection');
  if (prodColSel) {
    prodColSel.innerHTML = cols.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}

function renderProductsTable() {
  const filterCol = document.getElementById('productFilterCol')?.value || 'all';
  const search = (document.getElementById('productSearch')?.value || '').toLowerCase();
  let products = getProducts();
  if (filterCol !== 'all') products = products.filter(p => p.collectionId === filterCol);
  if (search) products = products.filter(p => p.name.toLowerCase().includes(search));

  const body = document.getElementById('productsTableBody');
  if (!products.length) { body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:20px;">No products found.</td></tr>'; return; }
  body.innerHTML = products.map(p => {
    const col = getCollectionById(p.collectionId);
    const statusBadge = p.stock === 0 ? '<span class="badge badge-red">Out of Stock</span>'
      : p.stock <= 3 ? '<span class="badge badge-orange">Low Stock</span>'
      : '<span class="badge badge-green">In Stock</span>';
    return `
    <tr>
      <td><img class="product-thumb" src="${p.image}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/44?text=No+Img'"/></td>
      <td><strong>${p.name}</strong></td>
      <td>${col ? col.name : '—'}</td>
      <td>${formatPrice(p.price)}</td>
      <td>${p.stock}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-sm btn-success btn-icon" title="Edit" onclick="openEditProductModal('${p.id}')">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" title="Delete" onclick="confirmDeleteProduct('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function openAddProductModal() {
  populateCollectionFilter();
  document.getElementById('prodModalTitle').textContent = 'Add Product';
  document.getElementById('prodId').value = '';
  ['prodName','prodDesc','prodImg','prodSizes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodStock').value = '';
  document.getElementById('prodImgPreview').style.display = 'none';
  openModal('productModal');
}

function openEditProductModal(id) {
  const p = getProductById(id);
  if (!p) return;
  populateCollectionFilter();
  document.getElementById('prodModalTitle').textContent = 'Edit Product';
  document.getElementById('prodId').value = p.id;
  document.getElementById('prodName').value = p.name;
  document.getElementById('prodDesc').value = p.description || '';
  document.getElementById('prodPrice').value = p.price / 100;
  document.getElementById('prodStock').value = p.stock;
  document.getElementById('prodImg').value = p.image;
  document.getElementById('prodSizes').value = (p.sizes || []).join(',');
  document.getElementById('prodCollection').value = p.collectionId;
  const prev = document.getElementById('prodImgPreview');
  document.getElementById('prodImgPreviewImg').src = p.image;
  prev.style.display = 'block';
  openModal('productModal');
}

function previewProdImg() {
  const url = document.getElementById('prodImg').value.trim();
  const prev = document.getElementById('prodImgPreview');
  if (url) { document.getElementById('prodImgPreviewImg').src = url; prev.style.display = 'block'; }
  else { prev.style.display = 'none'; }
}

function saveProduct() {
  const id = document.getElementById('prodId').value;
  const name = document.getElementById('prodName').value.trim();
  const desc = document.getElementById('prodDesc').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value, 10);
  const img = document.getElementById('prodImg').value.trim();
  const sizesRaw = document.getElementById('prodSizes').value;
  const collectionId = document.getElementById('prodCollection').value;
  const sizes = sizesRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (!name || isNaN(price) || isNaN(stock) || !img || !collectionId) {
    showAdminToast('❌ Please fill in all required fields.', true); return;
  }
  updateDB(db => {
    if (id) {
      const p = db.products.find(x => x.id === id);
      if (p) { p.name = name; p.description = desc; p.price = Math.round(price * 100); p.stock = stock; p.image = img; p.sizes = sizes.length ? sizes : ['S','M','L']; p.collectionId = collectionId; }
    } else {
      db.products.push({ id: generateId('p'), name, description: desc, price: Math.round(price * 100), stock, image: img, sizes: sizes.length ? sizes : ['S','M','L'], collectionId });
    }
  });
  closeModal('productModal');
  renderProductsTable();
  renderStockManager();
  renderDashboard();
  showAdminToast(id ? '✅ Product updated!' : '✅ Product added!');
}

function confirmDeleteProduct(id) {
  const p = getProductById(id);
  showConfirm('Delete Product', `Delete "${p.name}" permanently?`, () => {
    updateDB(db => { db.products = db.products.filter(x => x.id !== id); });
    renderProductsTable();
    renderStockManager();
    renderDashboard();
    showAdminToast('🗑 Product deleted.');
  });
}

// ── Stock Manager ────────────────────────────────────────────────
function renderStockManager() {
  const db = getDB();
  const oos = db.products.filter(p => p.stock === 0);
  const oosBody = document.getElementById('oosTableBody');
  if (!oos.length) {
    oosBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#16a34a;padding:20px;">✅ No out-of-stock items!</td></tr>';
  } else {
    oosBody.innerHTML = oos.map(p => {
      const col = getCollectionById(p.collectionId);
      return `
      <tr>
        <td><img class="product-thumb" src="${p.image}" alt="${p.name}"/></td>
        <td><strong>${p.name}</strong></td>
        <td>${col ? col.name : '—'}</td>
        <td>${formatPrice(p.price)}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteProduct('${p.id}')">🗑 Remove</button>
          <button class="btn btn-sm btn-success" style="margin-left:6px;" onclick="quickRestockPrompt('${p.id}')">📦 Restock</button>
        </td>
      </tr>`;
    }).join('');
  }

  // All stock levels
  const stockBody = document.getElementById('stockTableBody');
  stockBody.innerHTML = db.products.map(p => {
    const col = getCollectionById(p.collectionId);
    const pct = Math.min(100, (p.stock / 20) * 100);
    const fillColor = p.stock === 0 ? '#dc2626' : p.stock <= 3 ? '#d97706' : '#16a34a';
    const statusBadge = p.stock === 0 ? '<span class="badge badge-red">Out of Stock</span>'
      : p.stock <= 3 ? '<span class="badge badge-orange">Low</span>'
      : '<span class="badge badge-green">OK</span>';
    return `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td style="color:#888;font-size:.83rem;">${col ? col.name : '—'}</td>
      <td>
        <span style="font-weight:700;">${p.stock}</span>
        <div class="stock-bar" style="margin-top:4px;"><div class="stock-fill" style="width:${pct}%;background:${fillColor};"></div></div>
      </td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <input type="number" min="0" value="${p.stock}" id="stock_${p.id}" style="width:64px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:.85rem;"/>
          <button class="btn btn-sm btn-primary" onclick="updateStock('${p.id}')">Update</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateStock(productId) {
  const input = document.getElementById('stock_' + productId);
  const qty = parseInt(input.value, 10);
  if (isNaN(qty) || qty < 0) { showAdminToast('❌ Enter a valid stock quantity.', true); return; }
  updateDB(db => {
    const p = db.products.find(x => x.id === productId);
    if (p) p.stock = qty;
  });
  renderStockManager();
  renderDashboard();
  showAdminToast('✅ Stock updated!');
}

function quickRestockPrompt(productId) {
  const p = getProductById(productId);
  const qty = parseInt(prompt(`Restock "${p.name}". Enter new stock quantity:`), 10);
  if (!isNaN(qty) && qty >= 0) {
    updateDB(db => { const x = db.products.find(pr => pr.id === productId); if (x) x.stock = qty; });
    renderStockManager();
    renderDashboard();
    showAdminToast(`✅ ${p.name} restocked to ${qty}.`);
  }
}

function removeAllOutOfStock() {
  const oos = getDB().products.filter(p => p.stock === 0);
  if (!oos.length) { showAdminToast('No out-of-stock items to remove.'); return; }
  showConfirm('Remove All Out-of-Stock', `Remove ${oos.length} out-of-stock item(s) permanently?`, () => {
    updateDB(db => { db.products = db.products.filter(p => p.stock > 0); });
    renderStockManager();
    renderProductsTable();
    renderDashboard();
    showAdminToast(`🗑 ${oos.length} item(s) removed.`);
  });
}

// ── Orders ───────────────────────────────────────────────────────
function renderOrdersTable() {
  const db = getDB();
  const body = document.getElementById('ordersTableBody');
  if (!db.orders.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">No orders yet. Share the store link!</td></tr>';
    return;
  }
  body.innerHTML = [...db.orders].reverse().map(o => `
    <tr>
      <td><code style="font-size:.78rem;">${o.id}</code></td>
      <td>${o.customer?.name || '—'}<br/><span style="font-size:.75rem;color:#888;">${o.customer?.email || ''}</span></td>
      <td style="font-size:.82rem;">${new Date(o.date).toLocaleDateString('en-IN')}</td>
      <td>${o.items?.length || 0} item(s)</td>
      <td><strong>${formatPrice(o.total)}</strong></td>
      <td><span class="badge badge-green order-badge">${o.status}</span></td>
    </tr>`).join('');
}

// ── Modal Helpers ────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }

function showConfirm(title, msg, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  const btn = document.getElementById('confirmActionBtn');
  btn.onclick = () => { onConfirm(); closeModal('confirmModal'); };
  openModal('confirmModal');
}

// ── Toast ────────────────────────────────────────────────────────
function showAdminToast(msg, isError) {
  const t = document.getElementById('adminToast');
  t.textContent = msg;
  t.style.background = isError ? '#dc2626' : '#0d0d0d';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

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
  if (name === 'analytics') renderAnalytics();
  if (name === 'collections') renderCollectionsAdmin();
  if (name === 'products') { populateCollectionFilter(); renderProductsTable(); }
  if (name === 'stock') renderStockManager();
  if (name === 'orders') renderOrdersTable();
  if (name === 'customers') renderCustomers();
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
const ORDER_STATUSES = ['Confirmed','Processing','Shipped','Delivered','Cancelled'];
const STATUS_COLORS  = { Confirmed:'badge-blue', Processing:'badge-orange', Shipped:'badge-green', Delivered:'badge-green', Cancelled:'badge-red' };
const STATUS_ICONS   = { Confirmed:'📋', Processing:'⚙️', Shipped:'🚚', Delivered:'✅', Cancelled:'❌' };

function renderOrdersTable() {
  const db = getDB();
  const filterVal = document.getElementById('orderStatusFilter')?.value || 'all';
  let orders = [...db.orders].reverse();
  if (filterVal !== 'all') orders = orders.filter(o => o.status === filterVal);

  // Status summary cards
  const cardWrap = document.getElementById('orderStatusCards');
  if (cardWrap) {
    const counts = {};
    ORDER_STATUSES.forEach(s => counts[s] = db.orders.filter(o => o.status === s).length);
    cardWrap.innerHTML = ORDER_STATUSES.map(s => `
      <div style="background:var(--surface);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow);text-align:center;cursor:pointer;border:2px solid ${filterVal===s?'#0d0d0d':'transparent'};" onclick="document.getElementById('orderStatusFilter').value='${s}';renderOrdersTable()">
        <div style="font-size:1.4rem;">${STATUS_ICONS[s]}</div>
        <div style="font-size:1.3rem;font-weight:800;margin:4px 0;">${counts[s]}</div>
        <div style="font-size:.75rem;color:var(--muted);">${s}</div>
      </div>`).join('');
  }

  const countEl = document.getElementById('orderCount');
  if (countEl) countEl.textContent = orders.length + ' order(s)';

  const body = document.getElementById('ordersTableBody');
  if (!orders.length) {
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#888;padding:20px;">${filterVal==='all'?'No orders yet. Share the store link!':'No orders with status: '+filterVal}</td></tr>`;
    return;
  }
  body.innerHTML = orders.map(o => {
    const payLabel = { upi:'📱 UPI', cod:'💵 COD', net:'💳 Card', card:'💳 Card' };
    const statusOpts = ORDER_STATUSES.map(s =>
      `<option value="${s}" ${o.status===s?'selected':''}>${STATUS_ICONS[s]} ${s}</option>`).join('');
    return `
    <tr>
      <td><code style="font-size:.75rem;cursor:pointer;color:#2563eb;text-decoration:underline;" onclick="openOrderDetail('${o.id}')">${o.id.slice(-10)}</code></td>
      <td><strong>${o.customer?.name||'—'}</strong><br/><span style="font-size:.74rem;color:#888;">${o.customer?.phone||''}</span></td>
      <td style="font-size:.8rem;">${new Date(o.date).toLocaleDateString('en-IN')}</td>
      <td style="font-size:.83rem;">${o.items?.length||0} item(s)</td>
      <td style="font-size:.82rem;">${payLabel[o.customer?.payment||o.customer?.paymentMethod]||'—'}</td>
      <td><strong>${formatPrice(o.total)}</strong></td>
      <td><span class="badge ${STATUS_COLORS[o.status]||'badge-blue'}">${STATUS_ICONS[o.status]||''} ${o.status}</span></td>
      <td style="display:flex;gap:6px;align-items:center;">
        <select onchange="updateOrderStatus('${o.id}',this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:.8rem;cursor:pointer;">
          ${statusOpts}
        </select>
        <button class="btn btn-sm btn-success" onclick="openOrderDetail('${o.id}')" title="View full details">👁</button>
      </td>
    </tr>`;
  }).join('');
}

function updateOrderStatus(orderId, newStatus) {
  updateDB(db => {
    const o = db.orders.find(x => x.id === orderId);
    if (o) o.status = newStatus;
  });
  renderOrdersTable();
  renderDashboard();
  showAdminToast('✅ Order status updated to: ' + newStatus);
}

let _currentDetailOrderId = null;

function openOrderDetail(orderId) {
  const db = getDB();
  const o = db.orders.find(x => x.id === orderId);
  if (!o) return;
  _currentDetailOrderId = orderId;

  const c = o.customer || {};
  const payLabel = { upi:'📱 UPI / QR', cod:'💵 Cash on Delivery', net:'💳 Card / Net Banking', card:'💳 Card / Net Banking' };
  const payMethod = payLabel[c.paymentMethod || c.payment] || c.paymentMethod || c.payment || '—';

  // Build items table
  let itemRows = (o.items||[]).map(item => {
    const p = db.products.find(x => x.id === item.productId);
    return `<tr>
      <td style="padding:8px 10px;">${p ? `<img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:8px;"/>${p.name}` : 'Deleted product'}</td>
      <td style="padding:8px 10px;">${item.size||'—'}</td>
      <td style="padding:8px 10px;text-align:center;">${item.qty}</td>
      <td style="padding:8px 10px;text-align:right;">${p ? formatPrice(p.price * item.qty) : '—'}</td>
    </tr>`;
  }).join('');

  document.getElementById('orderDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">

      <!-- Customer Info -->
      <div style="background:var(--bg);border-radius:10px;padding:16px;">
        <p style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">👤 Customer Details</p>
        <table style="width:100%;font-size:.87rem;border-collapse:collapse;">
          <tr><td style="padding:5px 0;color:var(--muted);width:40%;">Name</td><td style="padding:5px 0;font-weight:600;">${c.name||'—'}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">Mobile</td><td style="padding:5px 0;font-weight:600;">${c.phone||'—'}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">Email</td><td style="padding:5px 0;">${c.email||'—'}</td></tr>
        </table>
      </div>

      <!-- Delivery Address -->
      <div style="background:var(--bg);border-radius:10px;padding:16px;">
        <p style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📍 Delivery Address</p>
        <table style="width:100%;font-size:.87rem;border-collapse:collapse;">
          <tr><td style="padding:5px 0;color:var(--muted);width:40%;">Address</td><td style="padding:5px 0;font-weight:600;">${c.address||'—'}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">City</td><td style="padding:5px 0;">${c.city||'—'}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">PIN Code</td><td style="padding:5px 0;">${c.pin||'—'}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">State</td><td style="padding:5px 0;">${c.state||'—'}</td></tr>
        </table>
      </div>

      <!-- Payment Info -->
      <div style="background:var(--bg);border-radius:10px;padding:16px;">
        <p style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">💳 Payment Details</p>
        <table style="width:100%;font-size:.87rem;border-collapse:collapse;">
          <tr><td style="padding:5px 0;color:var(--muted);width:40%;">Method</td><td style="padding:5px 0;font-weight:600;">${payMethod}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">UPI Txn ID</td><td style="padding:5px 0;font-family:monospace;">${c.upiTxnId||'—'}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">Total</td><td style="padding:5px 0;font-weight:800;font-size:1rem;">${formatPrice(o.total)}</td></tr>
        </table>
      </div>

      <!-- Order Info -->
      <div style="background:var(--bg);border-radius:10px;padding:16px;">
        <p style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">🧾 Order Info</p>
        <table style="width:100%;font-size:.87rem;border-collapse:collapse;">
          <tr><td style="padding:5px 0;color:var(--muted);width:40%;">Order ID</td><td style="padding:5px 0;font-family:monospace;font-size:.78rem;">${o.id}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">Date</td><td style="padding:5px 0;">${new Date(o.date).toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding:5px 0;color:var(--muted);">Status</td><td style="padding:5px 0;"><span class="badge ${STATUS_COLORS[o.status]||'badge-blue'}">${STATUS_ICONS[o.status]} ${o.status}</span></td></tr>
        </table>
      </div>
    </div>

    <!-- Items ordered -->
    <div style="background:var(--bg);border-radius:10px;padding:16px;">
      <p style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🛍️ Items Ordered</p>
      <table style="width:100%;border-collapse:collapse;font-size:.87rem;">
        <thead><tr style="border-bottom:2px solid var(--border);">
          <th style="padding:8px 10px;text-align:left;">Product</th>
          <th style="padding:8px 10px;text-align:left;">Size</th>
          <th style="padding:8px 10px;text-align:center;">Qty</th>
          <th style="padding:8px 10px;text-align:right;">Amount</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
        <tfoot><tr style="border-top:2px solid var(--border);">
          <td colspan="3" style="padding:10px;font-weight:700;text-align:right;">Total</td>
          <td style="padding:10px;font-weight:800;font-size:1rem;text-align:right;">${formatPrice(o.total)}</td>
        </tr></tfoot>
      </table>
    </div>
  `;

  // Populate status selector in modal footer
  const sel = document.getElementById('orderDetailStatusSel');
  sel.innerHTML = ORDER_STATUSES.map(s =>
    `<option value="${s}" ${o.status===s?'selected':''}>${STATUS_ICONS[s]} ${s}</option>`).join('');

  openModal('orderDetailModal');
}

function applyOrderDetailStatus() {
  if (!_currentDetailOrderId) return;
  const newStatus = document.getElementById('orderDetailStatusSel').value;
  updateOrderStatus(_currentDetailOrderId, newStatus);
  // Update the status badge inside the open modal without closing it
  openOrderDetail(_currentDetailOrderId);
}

// ── Analytics ────────────────────────────────────────────────────
function renderAnalytics() {
  const db = getDB();
  const orders = db.orders;
  const totalRevenue = orders.reduce((s,o) => s + (o.total||0), 0);
  const totalOrders = orders.length;
  const avgOrder = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
  const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;

  // Stats
  document.getElementById('analyticsStats').innerHTML = `
    <div class="stat-card"><div class="stat-icon green">💰</div>
      <div><div class="stat-value">${formatPrice(totalRevenue)}</div><div class="stat-label">Total Revenue</div></div></div>
    <div class="stat-card"><div class="stat-icon pink">🧾</div>
      <div><div class="stat-value">${totalOrders}</div><div class="stat-label">Total Orders</div></div></div>
    <div class="stat-card"><div class="stat-icon orange">📦</div>
      <div><div class="stat-value">${formatPrice(avgOrder)}</div><div class="stat-label">Avg Order Value</div></div></div>
    <div class="stat-card"><div class="stat-icon green">✅</div>
      <div><div class="stat-value">${deliveredOrders}</div><div class="stat-label">Delivered</div></div></div>
  `;

  // Revenue by collection bar chart (SVG)
  const cols = getCollections();
  const colRevenue = {};
  cols.forEach(c => colRevenue[c.id] = 0);
  orders.forEach(o => {
    (o.items||[]).forEach(item => {
      const p = db.products.find(x => x.id === item.productId);
      if (p) colRevenue[p.collectionId] = (colRevenue[p.collectionId]||0) + (p.price * item.qty);
    });
  });
  const maxRev = Math.max(...Object.values(colRevenue), 1);
  const barColors = ['#c9848a','#7c5cd8','#2563eb','#16a34a','#d97706'];
  let barHtml = '<div style="display:flex;flex-direction:column;gap:12px;">';
  cols.forEach((c, i) => {
    const rev = colRevenue[c.id] || 0;
    const pct = Math.round((rev / maxRev) * 100);
    barHtml += `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px;">
          <span style="font-weight:600;">${c.name}</span>
          <span style="color:var(--muted);">${formatPrice(rev)}</span>
        </div>
        <div style="background:#f0f0f0;border-radius:6px;height:22px;overflow:hidden;">
          <div style="width:${pct}%;background:${barColors[i%barColors.length]};height:100%;border-radius:6px;transition:width .4s;display:flex;align-items:center;padding-left:8px;">
            ${pct > 15 ? `<span style="font-size:.7rem;color:#fff;font-weight:700;">${pct}%</span>` : ''}
          </div>
        </div>
      </div>`;
  });
  if (!cols.length) barHtml += '<p style="color:#888;font-size:.88rem;">No collections yet.</p>';
  barHtml += '</div>';
  document.getElementById('revenueChart').innerHTML = barHtml;

  // Payment method breakdown
  const payCount = {};
  orders.forEach(o => {
    const pm = o.customer?.paymentMethod || o.customer?.payment || 'Unknown';
    const label = { upi:'UPI / QR', cod:'Cash on Delivery', net:'Card / Net Banking', card:'Card / Net Banking' }[pm] || pm;
    payCount[label] = (payCount[label]||0) + 1;
  });
  const payColors = { 'UPI / QR':'#7c5cd8', 'Cash on Delivery':'#16a34a', 'Card / Net Banking':'#2563eb', 'Unknown':'#888' };
  const totalPay = Object.values(payCount).reduce((s,v) => s+v, 0) || 1;
  let payHtml = '';
  Object.entries(payCount).forEach(([label, count]) => {
    const pct = Math.round((count/totalPay)*100);
    payHtml += `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px;">
          <span style="font-weight:600;">${label}</span>
          <span style="color:var(--muted);">${count} orders (${pct}%)</span>
        </div>
        <div style="background:#f0f0f0;border-radius:6px;height:18px;overflow:hidden;">
          <div style="width:${pct}%;background:${payColors[label]||'#888'};height:100%;border-radius:6px;"></div>
        </div>
      </div>`;
  });
  if (!Object.keys(payCount).length) payHtml = '<p style="color:#888;font-size:.88rem;">No orders yet.</p>';
  document.getElementById('paymentChart').innerHTML = payHtml;

  // Top products
  const productSales = {};
  orders.forEach(o => {
    (o.items||[]).forEach(item => {
      if (!productSales[item.productId]) productSales[item.productId] = { units:0, revenue:0 };
      productSales[item.productId].units += item.qty;
      const p = db.products.find(x => x.id === item.productId);
      if (p) productSales[item.productId].revenue += p.price * item.qty;
    });
  });
  const sorted = Object.entries(productSales).sort((a,b) => b[1].units - a[1].units).slice(0, 10);
  const medals = ['🥇','🥈','🥉'];
  const topBody = document.getElementById('topProductsBody');
  if (!sorted.length) {
    topBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">No sales data yet.</td></tr>';
    return;
  }
  topBody.innerHTML = sorted.map(([pid, data], i) => {
    const p = db.products.find(x => x.id === pid);
    const col = p ? getCollectionById(p.collectionId) : null;
    return `<tr>
      <td><img class="product-thumb" src="${p?.image||''}" alt="" onerror="this.style.display='none'"/></td>
      <td><strong>${p?.name||'Deleted product'}</strong></td>
      <td style="font-size:.82rem;color:#888;">${col?.name||'—'}</td>
      <td><strong>${data.units}</strong> units</td>
      <td>${formatPrice(data.revenue)}</td>
      <td style="font-size:1.2rem;">${medals[i]||'#'+(i+1)}</td>
    </tr>`;
  }).join('');
}

// ── Customers ────────────────────────────────────────────────────
function renderCustomers() {
  const db = getDB();
  const search = (document.getElementById('customerSearch')?.value||'').toLowerCase();

  // Build unique customer map from orders
  const custMap = {};
  db.orders.forEach(o => {
    const email = o.customer?.email || o.customer?.phone || 'unknown';
    if (!custMap[email]) {
      custMap[email] = {
        name: o.customer?.name || '—',
        email: o.customer?.email || '—',
        phone: o.customer?.phone || '—',
        city: o.customer?.city || '—',
        orders: 0, totalSpent: 0, lastOrder: o.date
      };
    }
    custMap[email].orders++;
    custMap[email].totalSpent += o.total || 0;
    if (new Date(o.date) > new Date(custMap[email].lastOrder)) custMap[email].lastOrder = o.date;
  });

  let customers = Object.values(custMap);
  if (search) customers = customers.filter(c =>
    c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search) || c.phone.includes(search));

  // Stats cards
  const totalCusts = Object.keys(custMap).length;
  const totalSpentAll = Object.values(custMap).reduce((s,c) => s + c.totalSpent, 0);
  const repeatCusts = Object.values(custMap).filter(c => c.orders > 1).length;
  document.getElementById('customerStats').innerHTML = `
    <div class="stat-card"><div class="stat-icon pink">👥</div>
      <div><div class="stat-value">${totalCusts}</div><div class="stat-label">Total Customers</div></div></div>
    <div class="stat-card"><div class="stat-icon green">🔁</div>
      <div><div class="stat-value">${repeatCusts}</div><div class="stat-label">Repeat Customers</div></div></div>
    <div class="stat-card"><div class="stat-icon orange">💰</div>
      <div><div class="stat-value">${formatPrice(totalSpentAll)}</div><div class="stat-label">Total Customer Spend</div></div></div>
  `;

  const body = document.getElementById('customersTableBody');
  if (!customers.length) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#888;padding:20px;">${search?'No customers match your search.':'No customers yet.'}</td></tr>`;
    return;
  }
  body.innerHTML = customers.sort((a,b) => b.totalSpent - a.totalSpent).map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td style="font-size:.83rem;">${c.email}</td>
      <td style="font-size:.83rem;">${c.phone}</td>
      <td style="font-size:.83rem;">${c.city}</td>
      <td><span class="badge badge-blue">${c.orders}</span></td>
      <td><strong>${formatPrice(c.totalSpent)}</strong></td>
      <td style="font-size:.8rem;color:#888;">${new Date(c.lastOrder).toLocaleDateString('en-IN')}</td>
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

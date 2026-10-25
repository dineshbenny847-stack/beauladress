// ── admin.js – Admin Portal Logic v2 ────────────────────────────

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
  updateOrderNotifBadge();
  initTopbar();
  startOrderPolling();
  renderNotifDropdown();
  renderStoreStatusToggle();
}

// ── Topbar ───────────────────────────────────────────────────────
function initTopbar() {
  // Live clock
  function tick() {
    const el = document.getElementById('topbarClock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
  // Time-based greeting
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const el = document.getElementById('topbarGreeting');
  if (el) el.textContent = greet + ', Admin 👋';
}

// ── Store open/close toggle ──────────────────────────────────────
function renderStoreStatusToggle() {
  const db = getDB();
  const isOpen = db.settings?.storeOpen !== false;
  const toggle = document.getElementById('storeOpenToggle');
  const chip   = document.getElementById('storeStatusChip');
  if (toggle) toggle.checked = isOpen;
  if (chip)   { chip.textContent = isOpen ? 'Open' : 'Closed'; chip.className = 'store-status-chip ' + (isOpen ? 'open' : 'closed'); }
}

function toggleStoreStatus(isOpen) {
  updateDB(db => { if (!db.settings) db.settings = {}; db.settings.storeOpen = isOpen; });
  renderStoreStatusToggle();
  pushNotification({ type: 'system', icon: isOpen ? '🟢' : '🔴', title: 'Store status changed', body: isOpen ? 'Store is now OPEN for orders.' : 'Store is now CLOSED — orders paused.', time: new Date().toISOString() });
  showAdminToast(isOpen ? '🟢 Store is now Open' : '🔴 Store is now Closed');
}

// ── Notification System ──────────────────────────────────────────
const NOTIF_KEY = 'ba_admin_notifications';

function getNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}

function saveNotifications(list) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list));
}

function pushNotification(notif) {
  const list = getNotifications();
  notif.id = 'n' + Date.now();
  notif.read = false;
  list.unshift(notif);
  // Keep max 100
  saveNotifications(list.slice(0, 100));
  updateBellDot();
  renderNotifDropdown();
}

function updateBellDot() {
  const list = getNotifications();
  const unread = list.filter(n => !n.read).length;
  const dot = document.getElementById('bellDot');
  if (dot) { dot.className = 'bell-dot' + (unread > 0 ? ' active' : ''); }
  // Also update sidebar order badge
  updateOrderNotifBadge();
}

function renderNotifDropdown() {
  const body = document.getElementById('notifDdBody');
  if (!body) return;
  const list = getNotifications().slice(0, 20);
  if (!list.length) {
    body.innerHTML = '<div class="notif-dd-empty">🎉 No notifications yet.<br/>New orders will appear here.</div>';
    return;
  }
  body.innerHTML = list.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}');${n.type==='order'?`openOrderDetail('${n.orderId}');closeNotifDropdown()`:''}" >
      <div class="notif-icon">${n.icon || '🔔'}</div>
      <div class="notif-content">
        <p>${n.title}</p>
        <span>${n.body} &nbsp;·&nbsp; ${timeAgo(n.time)}</span>
      </div>
    </div>`).join('');
}

function markNotifRead(id) {
  const list = getNotifications();
  const n = list.find(x => x.id === id);
  if (n) { n.read = true; saveNotifications(list); }
  updateBellDot();
  renderNotifDropdown();
}

function markAllNotifRead() {
  const list = getNotifications();
  list.forEach(n => n.read = true);
  saveNotifications(list);
  updateBellDot();
  renderNotifDropdown();
  renderNotificationsPanel('all');
  showAdminToast('✅ All notifications marked as read.');
}

function clearAllNotif() {
  saveNotifications([]);
  updateBellDot();
  renderNotifDropdown();
  renderNotificationsPanel('all');
  showAdminToast('🗑 Notifications cleared.');
}

function toggleNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) renderNotifDropdown();
}

function closeNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (dd) dd.classList.remove('open');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const bell = document.getElementById('bellBtn');
  const dd   = document.getElementById('notifDropdown');
  if (dd && dd.classList.contains('open') && !dd.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
    dd.classList.remove('open');
  }
});

// ── Notifications panel ──────────────────────────────────────────
function renderNotificationsPanel(filter, btnEl) {
  if (!filter) filter = 'all';
  // Update tab buttons
  document.querySelectorAll('#notifFilterTabs button').forEach(b => {
    b.className = (b.dataset.filter === filter) ? 'btn btn-primary btn-sm' : 'btn btn-sm';
    b.style.background = (b.dataset.filter === filter) ? '' : 'var(--surface)';
  });
  const body = document.getElementById('notifPanelBody');
  if (!body) return;
  let list = getNotifications();
  if (filter !== 'all') list = list.filter(n => n.type === filter);
  if (!list.length) {
    body.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--muted);font-size:.92rem;">No notifications in this category.</div>';
    return;
  }
  body.innerHTML = list.map(n => `
    <div class="card" style="margin-bottom:10px;border-left:4px solid ${n.read?'var(--border)':n.type==='order'?'var(--blue)':n.type==='stock'?'var(--orange)':'var(--green)'};">
      <div class="card-body" style="padding:14px 18px;display:flex;align-items:flex-start;gap:14px;">
        <div style="font-size:1.5rem;flex-shrink:0;">${n.icon||'🔔'}</div>
        <div style="flex:1;">
          <div style="font-size:.9rem;font-weight:${n.read?'500':'700'};margin-bottom:3px;">${n.title}</div>
          <div style="font-size:.83rem;color:var(--muted);">${n.body}</div>
          <div style="font-size:.76rem;color:var(--muted);margin-top:4px;">🕐 ${new Date(n.time).toLocaleString('en-IN')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          ${!n.read ? `<button onclick="markNotifRead('${n.id}');renderNotificationsPanel('${filter}')" class="btn btn-sm btn-success" style="font-size:.75rem;">Mark Read</button>` : ''}
          ${n.type==='order'&&n.orderId ? `<button onclick="openOrderDetail('${n.orderId}')" class="btn btn-sm" style="background:#dbeafe;color:#1d4ed8;font-size:.75rem;">View Order</button>` : ''}
        </div>
      </div>
    </div>`).join('');
}

// ── Order polling for real-time new order detection ──────────────
let _lastKnownOrderCount = -1;
let _lastPopupOrderId = null;

function startOrderPolling() {
  const db = getDB();
  _lastKnownOrderCount = db.orders.length;
  setInterval(checkForNewOrders, 10000); // check every 10s
}

function checkForNewOrders() {
  const db = getDB();
  const current = db.orders.length;
  if (_lastKnownOrderCount >= 0 && current > _lastKnownOrderCount) {
    const newOrders = [...db.orders].reverse().slice(0, current - _lastKnownOrderCount);
    newOrders.forEach(o => {
      pushNotification({
        type: 'order', icon: '🛍️',
        title: '🛍️ New Order Received!',
        body: `${o.customer?.name||'Guest'} placed an order for ${formatPrice(o.total)}`,
        time: o.date,
        orderId: o.id,
        read: false
      });
      showOrderPopup(o);
    });
  }
  _lastKnownOrderCount = current;
  updateOrderNotifBadge();
}

// ── New order popup ──────────────────────────────────────────────
let _popupTimer = null;

function showOrderPopup(order) {
  const popup = document.getElementById('orderPopup');
  const title = document.getElementById('orderPopupTitle');
  const sub   = document.getElementById('orderPopupSub');
  const viewBtn = document.getElementById('orderPopupViewBtn');
  if (!popup) return;
  if (title) title.textContent = '🛍️ New Order from ' + (order.customer?.name || 'Customer') + '!';
  if (sub) sub.textContent = formatPrice(order.total) + ' · ' + (order.items?.length || 0) + ' item(s)';
  if (viewBtn) viewBtn.onclick = () => {
    openOrderDetail(order.id);
    dismissOrderPopup();
    switchPanel('orders', document.querySelector('[data-panel=orders]'));
  };
  popup.classList.add('show');
  clearTimeout(_popupTimer);
  _popupTimer = setTimeout(dismissOrderPopup, 8000);
}

function dismissOrderPopup() {
  const popup = document.getElementById('orderPopup');
  if (popup) popup.classList.remove('show');
  clearTimeout(_popupTimer);
}

// ── Time ago helper ──────────────────────────────────────────────
function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// ── Order notification badge ─────────────────────────────────────
function updateOrderNotifBadge() {
  const db = getDB();
  const lastSeen = parseInt(localStorage.getItem('ba_admin_last_seen_orders') || '0', 10);
  const newCount = db.orders.filter(o => new Date(o.date).getTime() > lastSeen).length;
  const badge = document.getElementById('orderNotifBadge');
  if (!badge) return;
  if (newCount > 0) {
    badge.textContent = newCount > 9 ? '9+' : newCount;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function markOrdersAsSeen() {
  localStorage.setItem('ba_admin_last_seen_orders', Date.now().toString());
  const badge = document.getElementById('orderNotifBadge');
  if (badge) badge.style.display = 'none';
}

// ── Panel Navigation ─────────────────────────────────────────────
function switchPanel(name, el) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  if (el) el.classList.add('active');
  // Refresh data on switch
  if (name === 'dashboard') renderDashboard();
  if (name === 'analytics') renderAnalytics();
  if (name === 'collections') renderCollectionsAdmin();
  if (name === 'products') { populateCollectionFilter(); renderProductsTable(); }
  if (name === 'stock') renderStockManager();
  if (name === 'orders') { markOrdersAsSeen(); renderOrdersTable(); }
  if (name === 'customers') renderCustomers();
  if (name === 'coupons')  renderCoupons();
  if (name === 'notifications') renderNotificationsPanel('all');
  if (name === 'settings') renderSettings();
}

// ── Dashboard ────────────────────────────────────────────────────
function renderDashboard() {
  const db = getDB();
  const totalProducts = db.products.length;
  const inStock = db.products.filter(p => p.stock > 0).length;
  const outOfStock = db.products.filter(p => p.stock === 0).length;
  const totalOrders = db.orders.length;
  const revenue = db.orders.reduce((s, o) => s + (o.total || 0), 0);

  // Today vs yesterday
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate()-1);
  const todayOrders = db.orders.filter(o => new Date(o.date) >= todayStart);
  const yestOrders  = db.orders.filter(o => new Date(o.date) >= yesterdayStart && new Date(o.date) < todayStart);
  const todayRev  = todayOrders.reduce((s,o) => s + (o.total||0), 0);
  const yestRev   = yestOrders.reduce((s,o) => s + (o.total||0), 0);

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

  // Revenue sparkline (last 7 days)
  renderRevSparkline(db);

  // Today vs yesterday comparison
  const tvyEl = document.getElementById('todayVsYesterday');
  if (tvyEl) {
    const diff = todayRev - yestRev;
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '→';
    const color = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#888';
    tvyEl.innerHTML = `Today: <strong>${formatPrice(todayRev)}</strong> &nbsp;
      <span style="color:${color};font-weight:700;">${arrow} ${diff >= 0 ? '+' : ''}${formatPrice(Math.abs(diff))}</span>
      <span style="color:#aaa;font-size:.76rem;"> vs yesterday (${formatPrice(yestRev)})</span>`;
  }

  // Recent orders
  const recent = [...db.orders].reverse().slice(0, 5);
  const recentDiv = document.getElementById('recentOrdersList');
  if (!recent.length) {
    recentDiv.innerHTML = '<p style="color:#888;font-size:.88rem;padding:8px 0;">No orders yet.</p>';
  } else {
    recentDiv.innerHTML = `<table><thead><tr><th>ID</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
      ${recent.map(o => `<tr>
        <td><code style="font-size:.75rem;">${o.id.slice(-8)}</code></td>
        <td>${o.customer?.name || '—'}</td>
        <td>${formatPrice(o.total)}</td>
        <td><span class="badge ${STATUS_COLORS[o.status]||'badge-blue'}">${o.status}</span></td>
        <td><button onclick="openOrderDetail('${o.id}')" style="font-size:.75rem;color:#2563eb;text-decoration:underline;background:none;border:none;cursor:pointer;">View</button></td>
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

  // Low stock banner on dashboard
  renderLowStockBanner('dashLowStockBanner', db);

  // Push low-stock notifications if needed (once per session)
  if (!sessionStorage.getItem('ba_stock_notif_pushed')) {
    const oos = db.products.filter(p => p.stock === 0);
    const low = db.products.filter(p => p.stock > 0 && p.stock <= 3);
    if (oos.length) pushNotification({ type:'stock', icon:'🔴', title:`${oos.length} product(s) out of stock`, body: oos.map(p=>p.name).join(', '), time: new Date().toISOString() });
    if (low.length) pushNotification({ type:'stock', icon:'🟡', title:`${low.length} product(s) running low`, body: low.map(p=>`${p.name} (${p.stock} left)`).join(', '), time: new Date().toISOString() });
    sessionStorage.setItem('ba_stock_notif_pushed', '1');
  }
}

// ── Revenue Sparkline (7 days) ────────────────────────────────────
function renderRevSparkline(db) {
  const el = document.getElementById('revSparkline');
  if (!el) return;
  const days = [];
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
    const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);
    const dayRev = db.orders.filter(o => { const t = new Date(o.date); return t >= d && t < nextD; })
                            .reduce((s,o) => s + (o.total||0), 0);
    days.push(dayRev);
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));
  }
  const max = Math.max(...days, 1);
  const barHtml = days.map((rev, i) => {
    const pct = Math.round((rev / max) * 100);
    const isToday = i === 6;
    const tip = `${labels[i]}: ${formatPrice(rev)}`;
    return `<div class="bar${isToday?' today':''}" style="height:${Math.max(4, pct)}%;" title="${tip}"></div>`;
  }).join('');

  const totalWeek = days.reduce((s,v) => s+v, 0);
  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:20px;">
      <div class="sparkline-bar" style="flex:1;">${barHtml}</div>
      <div style="text-align:right;min-width:120px;">
        <div style="font-size:1.3rem;font-weight:800;">${formatPrice(totalWeek)}</div>
        <div style="font-size:.78rem;color:var(--muted);">This week's revenue</div>
      </div>
    </div>
    <div style="display:flex;gap:0;margin-top:4px;">
      ${labels.map((l,i) => `<div style="flex:1;font-size:.62rem;color:var(--muted);text-align:center;overflow:hidden;white-space:nowrap;${i===6?'font-weight:700;color:var(--text);':''}">${l}</div>`).join('')}
    </div>`;
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

// ── Image tab helpers ────────────────────────────────────────────
function setImgTab(tab) {
  const urlArea    = document.getElementById('imgUrlArea');
  const uploadArea = document.getElementById('imgUploadArea');
  const btnUrl     = document.getElementById('imgTabUrl');
  const btnUp      = document.getElementById('imgTabUpload');
  if (tab === 'url') {
    urlArea.style.display = ''; uploadArea.style.display = 'none';
    btnUrl.style.background = 'var(--black)'; btnUrl.style.color = '#fff';
    btnUp.style.background = '#ede9fe'; btnUp.style.color = '#5b21b6';
  } else {
    urlArea.style.display = 'none'; uploadArea.style.display = '';
    btnUp.style.background = '#5b21b6'; btnUp.style.color = '#fff';
    btnUrl.style.background = ''; btnUrl.style.color = '';
  }
}

function handleImgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('prodImg').value = e.target.result;
    document.getElementById('prodImgPreviewImg').src = e.target.result;
    document.getElementById('prodImgPreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function setColImgTab(tab) {
  const urlArea    = document.getElementById('colImgUrlArea');
  const uploadArea = document.getElementById('colImgUploadArea');
  const btnUrl     = document.getElementById('colImgTabUrl');
  const btnUp      = document.getElementById('colImgTabUpload');
  if (tab === 'url') {
    urlArea.style.display = ''; uploadArea.style.display = 'none';
    btnUrl.style.background = 'var(--black)'; btnUrl.style.color = '#fff';
    btnUp.style.background = '#ede9fe'; btnUp.style.color = '#5b21b6';
  } else {
    urlArea.style.display = 'none'; uploadArea.style.display = '';
    btnUp.style.background = '#5b21b6'; btnUp.style.color = '#fff';
    btnUrl.style.background = ''; btnUrl.style.color = '';
  }
}

function handleColImgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('colImg').value = e.target.result;
    document.getElementById('colImgPreviewImg').src = e.target.result;
    document.getElementById('colImgPreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

// ── Collections ──────────────────────────────────────────────────
function openAddCollectionModal() {
  document.getElementById('colModalTitle').textContent = 'New Collection';
  document.getElementById('colId').value = '';
  document.getElementById('colName').value = '';
  document.getElementById('colDesc').value = '';
  document.getElementById('colImg').value = '';
  document.getElementById('colImgPreview').style.display = 'none';
  setColImgTab('url');
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
  setColImgTab('url');
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
  if (!products.length) { body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:20px;">No products found.</td></tr>'; return; }
  body.innerHTML = products.map(p => {
    const col = getCollectionById(p.collectionId);
    const statusBadge = p.stock === 0 ? '<span class="badge badge-red">Out of Stock</span>'
      : p.stock <= 3 ? '<span class="badge badge-orange">Low Stock</span>'
      : '<span class="badge badge-green">In Stock</span>';
    const featuredBtn = `<button onclick="toggleFeatured('${p.id}')" title="${p.featured ? 'Remove from featured' : 'Mark as featured'}" style="font-size:1.2rem;background:none;border:none;cursor:pointer;opacity:${p.featured ? '1' : '0.25'};">⭐</button>`;
    return `
    <tr>
      <td><img class="product-thumb" src="${p.image}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/44?text=No+Img'"/></td>
      <td><strong>${p.name}</strong></td>
      <td>${col ? col.name : '—'}</td>
      <td>${formatPrice(p.price)}</td>
      <td>${p.stock}</td>
      <td>${statusBadge}</td>
      <td style="text-align:center;">${featuredBtn}</td>
      <td>
        <button class="btn btn-sm btn-success btn-icon" title="Edit" onclick="openEditProductModal('${p.id}')">✏️</button>
        <button class="btn btn-sm btn-danger btn-icon" title="Delete" onclick="confirmDeleteProduct('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function toggleFeatured(productId) {
  updateDB(db => {
    const p = db.products.find(x => x.id === productId);
    if (p) p.featured = !p.featured;
  });
  renderProductsTable();
  showAdminToast(getProductById(productId)?.featured ? '⭐ Product marked as Featured!' : 'Product removed from Featured.');
}

function openAddProductModal() {
  populateCollectionFilter();
  document.getElementById('prodModalTitle').textContent = 'Add Product';
  document.getElementById('prodId').value = '';
  ['prodName','prodDesc','prodImg','prodSizes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodStock').value = '';
  document.getElementById('prodFeatured').checked = false;
  document.getElementById('prodImgPreview').style.display = 'none';
  setImgTab('url');
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
  document.getElementById('prodFeatured').checked = !!p.featured;
  const prev = document.getElementById('prodImgPreview');
  document.getElementById('prodImgPreviewImg').src = p.image;
  prev.style.display = 'block';
  setImgTab('url');
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
  const featured = document.getElementById('prodFeatured').checked;
  const sizes = sizesRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (!name || isNaN(price) || isNaN(stock) || !img || !collectionId) {
    showAdminToast('❌ Please fill in all required fields.', true); return;
  }
  updateDB(db => {
    if (id) {
      const p = db.products.find(x => x.id === id);
      if (p) { p.name = name; p.description = desc; p.price = Math.round(price * 100); p.stock = stock; p.image = img; p.sizes = sizes.length ? sizes : ['S','M','L']; p.collectionId = collectionId; p.featured = featured; }
    } else {
      db.products.push({ id: generateId('p'), name, description: desc, price: Math.round(price * 100), stock, image: img, sizes: sizes.length ? sizes : ['S','M','L'], collectionId, featured, createdAt: Date.now() });
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
  const searchVal = (document.getElementById('orderSearch')?.value || '').toLowerCase().trim();
  let orders = [...db.orders].reverse();
  if (filterVal !== 'all') orders = orders.filter(o => o.status === filterVal);
  if (searchVal) orders = orders.filter(o =>
    o.id.toLowerCase().includes(searchVal) ||
    (o.customer?.name||'').toLowerCase().includes(searchVal) ||
    (o.customer?.phone||'').includes(searchVal) ||
    (o.customer?.email||'').toLowerCase().includes(searchVal)
  );

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

  // Uncheck select-all
  const selectAll = document.getElementById('selectAllOrders');
  if (selectAll) selectAll.checked = false;
  _selectedOrders = [];
  updateBulkBar();

  const body = document.getElementById('ordersTableBody');
  if (!orders.length) {
    body.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#888;padding:20px;">${filterVal==='all'?'No orders yet. Share the store link!':'No orders with status: '+filterVal}</td></tr>`;
    return;
  }
  body.innerHTML = orders.map(o => {
    const payLabel = { upi:'📱 UPI', cod:'💵 COD', net:'💳 Card', card:'💳 Card' };
    const statusOpts = ORDER_STATUSES.map(s =>
      `<option value="${s}" ${o.status===s?'selected':''}>${STATUS_ICONS[s]} ${s}</option>`).join('');
    const hasNote = o.adminNote ? '📝' : '';
    return `
    <tr id="orow_${o.id}">
      <td><input type="checkbox" class="order-cb" value="${o.id}" onchange="onOrderCheckbox(this)" style="accent-color:#0d0d0d;"/></td>
      <td><code style="font-size:.75rem;cursor:pointer;color:#2563eb;text-decoration:underline;" onclick="openOrderDetail('${o.id}')">${o.id.slice(-10)}</code></td>
      <td><strong>${o.customer?.name||'—'}</strong><br/><span style="font-size:.74rem;color:#888;">${o.customer?.phone||''}</span></td>
      <td style="font-size:.8rem;">${new Date(o.date).toLocaleDateString('en-IN')}</td>
      <td style="font-size:.83rem;">${o.items?.length||0} item(s)</td>
      <td style="font-size:.82rem;">${payLabel[o.customer?.payment||o.customer?.paymentMethod]||'—'}</td>
      <td><strong>${formatPrice(o.total)}</strong>${hasNote?` <span title="Has admin note" style="font-size:.8rem;">📝</span>`:''}</td>
      <td><span class="badge ${STATUS_COLORS[o.status]||'badge-blue'}">${STATUS_ICONS[o.status]||''} ${o.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;">
          <select onchange="updateOrderStatus('${o.id}',this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:.8rem;cursor:pointer;">
            ${statusOpts}
          </select>
          <button style="padding:6px 10px;background:#dcfce7;color:#16a34a;border:none;border-radius:7px;font-size:.85rem;cursor:pointer;font-weight:700;white-space:nowrap;" onclick="openOrderDetail('${o.id}')" title="View full details">👁 View</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Bulk order management ────────────────────────────────────────
let _selectedOrders = [];

function onOrderCheckbox(cb) {
  const id = cb.value;
  if (cb.checked) { if (!_selectedOrders.includes(id)) _selectedOrders.push(id); }
  else { _selectedOrders = _selectedOrders.filter(x => x !== id); }
  updateBulkBar();
}

function toggleSelectAllOrders(checked) {
  _selectedOrders = [];
  document.querySelectorAll('.order-cb').forEach(cb => {
    cb.checked = checked;
    if (checked) _selectedOrders.push(cb.value);
  });
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  const lbl = document.getElementById('bulkCountLabel');
  if (!bar) return;
  if (_selectedOrders.length > 0) {
    bar.classList.add('show');
    if (lbl) lbl.textContent = _selectedOrders.length + ' order(s) selected';
  } else {
    bar.classList.remove('show');
  }
}

function applyBulkStatus() {
  const sel = document.getElementById('bulkStatusSel');
  const status = sel ? sel.value : '';
  if (!status) { showAdminToast('❌ Select a status first.', true); return; }
  if (!_selectedOrders.length) { showAdminToast('❌ No orders selected.', true); return; }
  updateDB(db => {
    _selectedOrders.forEach(id => {
      const o = db.orders.find(x => x.id === id);
      if (o) o.status = status;
    });
  });
  showAdminToast(`✅ ${_selectedOrders.length} order(s) updated to: ${status}`);
  clearBulkSelection();
  renderOrdersTable();
  renderDashboard();
}

function clearBulkSelection() {
  _selectedOrders = [];
  document.querySelectorAll('.order-cb').forEach(cb => cb.checked = false);
  const sel = document.getElementById('selectAllOrders');
  if (sel) sel.checked = false;
  updateBulkBar();
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

    <!-- Admin Notes -->
    <div class="order-notes-area no-print">
      <label>🗒️ Admin Notes (internal, not visible to customer)</label>
      <textarea id="orderNoteInput" placeholder="Add a private note about this order…">${o.adminNote||''}</textarea>
      <button class="save-note-btn" onclick="saveOrderNote('${o.id}')">💾 Save Note</button>
    </div>
  `;

  // Populate status selector in modal footer
  const sel = document.getElementById('orderDetailStatusSel');
  sel.innerHTML = ORDER_STATUSES.map(s =>
    `<option value="${s}" ${o.status===s?'selected':''}>${STATUS_ICONS[s]} ${s}</option>`).join('');

  openModal('orderDetailModal');
}

function saveOrderNote(orderId) {
  const note = document.getElementById('orderNoteInput')?.value.trim() || '';
  updateDB(db => {
    const o = db.orders.find(x => x.id === orderId);
    if (o) o.adminNote = note;
  });
  renderOrdersTable();
  showAdminToast(note ? '📝 Note saved!' : '📝 Note cleared.');
}

function printInvoice() {
  window.print();
}

function applyOrderDetailStatus() {
  if (!_currentDetailOrderId) return;
  const newStatus = document.getElementById('orderDetailStatusSel').value;
  updateOrderStatus(_currentDetailOrderId, newStatus);
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

// ── Low Stock Banner ─────────────────────────────────────────────
function renderLowStockBanner(elId, db) {
  const el = document.getElementById(elId);
  if (!el) return;
  const oos = db.products.filter(p => p.stock === 0).length;
  const low = db.products.filter(p => p.stock > 0 && p.stock <= 3).length;
  if (!oos && !low) { el.innerHTML = ''; return; }
  let msgs = [];
  if (oos) msgs.push(`<strong>${oos} item(s) are out of stock</strong>`);
  if (low) msgs.push(`<strong>${low} item(s) are running low (≤3 units)</strong>`);
  el.innerHTML = `
    <div style="background:#fef3c7;border:2px solid #fde047;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.3rem;">⚠️</span>
        <span style="font-size:.9rem;color:#92400e;">${msgs.join(' · ')} — <a href="#" onclick="switchPanel('stock',document.querySelector('[data-panel=stock]'));return false;" style="color:#92400e;font-weight:700;text-decoration:underline;">Go to Stock Manager →</a></span>
      </div>
    </div>`;
}

// ── Settings ─────────────────────────────────────────────────────
function renderSettings() {
  const db = getDB();
  const s = db.settings || {};

  const storeName = s.storeName  || "Beaula Dresses";
  const tagline   = s.tagline    || 'Curated fashion for the modern woman';
  const email     = s.email      || 'hello@beauladresses.com';
  const phone     = s.phone      || '';
  const city      = s.city       || 'Mumbai, India';
  const upiId     = s.upiId      || '6281807448-2@ibl';
  const upiName   = s.upiName    || 'Beaula Dresses';

  // Fill in form fields
  document.getElementById('setStoreName').value = storeName;
  document.getElementById('setTagline').value   = tagline;
  document.getElementById('setEmail').value     = email;
  document.getElementById('setPhone').value     = phone;
  document.getElementById('setCity').value      = city;
  document.getElementById('setUpiId').value     = upiId;
  document.getElementById('setUpiName').value   = upiName;

  // Populate live preview bar
  document.getElementById('previewStoreName').textContent  = storeName;
  document.getElementById('previewTagline').textContent    = tagline;
  document.getElementById('settingsUpiDisplay').textContent = upiId;
  document.getElementById('previewPhone').textContent      = phone || '—';
  document.getElementById('currentUpiChip').textContent    = upiId;

  // QR preview
  updateSettingsQR(upiId, upiName);

  // Password strength meter wire-up
  const pwdNewEl = document.getElementById('setPwdNew');
  if (pwdNewEl) pwdNewEl.oninput = function() { checkPwdStrength(this.value); };

  // Low stock banner in settings
  renderLowStockBanner('settingsLowStockBanner', db);
}

function livePreviewStore() {
  const name = document.getElementById('setStoreName')?.value || '—';
  const tag  = document.getElementById('setTagline')?.value   || '';
  document.getElementById('previewStoreName').textContent = name;
  document.getElementById('previewTagline').textContent   = tag;
}

function checkPwdStrength(val) {
  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const pct   = (score / 5) * 100;
  const color = score <= 1 ? '#ef4444' : score <= 3 ? '#f59e0b' : '#16a34a';
  const label = score <= 1 ? 'Weak' : score <= 3 ? 'Medium' : 'Strong';
  const fill  = document.getElementById('pwdStrengthFill');
  const lbl   = document.getElementById('pwdStrengthLabel');
  if (fill) { fill.style.width = pct + '%'; fill.style.background = color; }
  if (lbl)  { lbl.textContent = val ? 'Strength: ' + label : ''; lbl.style.color = color; }
}

function updateSettingsQR(upiId, name) {
  const qr = document.getElementById('settingsQR');
  if (!qr || !upiId.trim()) return;
  qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=' +
    encodeURIComponent('upi://pay?pa=' + upiId.trim() + '&pn=' + (name||'Store') + '&cu=INR');
}

function saveStoreSettings() {
  const name  = document.getElementById('setStoreName').value.trim();
  const tag   = document.getElementById('setTagline').value.trim();
  const email = document.getElementById('setEmail').value.trim();
  const phone = document.getElementById('setPhone').value.trim();
  const city  = document.getElementById('setCity').value.trim();
  if (!name) { showAdminToast('❌ Store name cannot be empty.', true); return; }
  updateDB(db => {
    if (!db.settings) db.settings = {};
    db.settings.storeName = name;
    db.settings.tagline   = tag;
    db.settings.email     = email;
    db.settings.phone     = phone;
    db.settings.city      = city;
  });
  // Refresh the live preview bar to show what's now saved
  document.getElementById('previewStoreName').textContent = name;
  document.getElementById('previewTagline').textContent   = tag;
  document.getElementById('previewPhone').textContent     = phone || '—';
  showSettingsSavedBadge('storeInfoSavedBadge');
  showAdminToast('✅ Store information saved!');
}

function savePaymentSettings() {
  const upiId   = document.getElementById('setUpiId').value.trim();
  const upiName = document.getElementById('setUpiName').value.trim();
  if (!upiId) { showAdminToast('❌ UPI ID cannot be empty.', true); return; }
  updateDB(db => {
    if (!db.settings) db.settings = {};
    db.settings.upiId   = upiId;
    db.settings.upiName = upiName;
  });
  updateSettingsQR(upiId, upiName);
  // Update all displays to confirm what was saved
  document.getElementById('settingsUpiDisplay').textContent = upiId;
  document.getElementById('currentUpiChip').textContent     = upiId;
  document.getElementById('setUpiId').value                 = upiId; // clear back to show saved value
  showSettingsSavedBadge('paymentSavedBadge');
  showAdminToast('✅ UPI ID updated to: ' + upiId);
}

function showSettingsSavedBadge(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.display = 'inline-flex';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function changePassword() {
  const current = document.getElementById('setPwdCurrent').value;
  const newPwd  = document.getElementById('setPwdNew').value;
  const confirm = document.getElementById('setPwdConfirm').value;
  const db = getDB();
  const errEl = document.getElementById('pwdErrMsg');
  const okEl  = document.getElementById('pwdOkMsg');
  const showErr = (msg) => { errEl.textContent = '❌ ' + msg; errEl.style.display='block'; okEl.style.display='none'; };
  const showOk  = ()    => { okEl.style.display='block'; errEl.style.display='none'; };

  if (!current)             { showErr('Enter your current password.'); return; }
  if (current !== db.adminPassword) { showErr('Current password is incorrect.'); return; }
  if (newPwd.length < 6)    { showErr('New password must be at least 6 characters.'); return; }
  if (newPwd !== confirm)   { showErr('Passwords do not match.'); return; }

  updateDB(d => { d.adminPassword = newPwd; });
  document.getElementById('setPwdCurrent').value = '';
  document.getElementById('setPwdNew').value = '';
  document.getElementById('setPwdConfirm').value = '';
  checkPwdStrength('');
  showOk();
  showAdminToast('✅ Password changed successfully!');
  setTimeout(() => { if(okEl) okEl.style.display='none'; }, 4000);
}

function confirmClearOrders() {
  showConfirm('Clear All Orders', 'This will permanently delete ALL orders. Are you sure?', () => {
    updateDB(db => { db.orders = []; });
    _lastKnownOrderCount = 0;
    renderDashboard();
    showAdminToast('🗑 All orders cleared.');
  });
}

function confirmClearNotifications() {
  showConfirm('Clear All Notifications', 'Delete all notification history?', () => {
    clearAllNotif();
    showAdminToast('🗑 Notifications cleared.');
  });
}

function confirmResetStore() {
  showConfirm('Reset Entire Store', 'This will DELETE all products, collections, orders and reset to factory defaults. This CANNOT be undone!', () => {
    localStorage.removeItem('beauladresses_db');
    showAdminToast('⚡ Store reset. Reloading…');
    setTimeout(() => location.reload(), 1500);
  });
}

// ── Export Orders CSV ─────────────────────────────────────────────
function exportOrdersCSV() {
  const db = getDB();
  if (!db.orders.length) { showAdminToast('No orders to export.', true); return; }

  const headers = ['Order ID','Date','Status','Customer Name','Email','Phone','Address','City','PIN','State','Payment Method','UPI Txn ID','Items','Total (₹)'];
  const rows = db.orders.map(o => {
    const c = o.customer || {};
    const items = (o.items||[]).map(i => {
      const p = db.products.find(x => x.id === i.productId);
      return `${p ? p.name : 'Unknown'} (${i.size}) x${i.qty}`;
    }).join(' | ');
    return [
      o.id,
      new Date(o.date).toLocaleString('en-IN'),
      o.status,
      c.name   || '',
      c.email  || '',
      c.phone  || '',
      c.address|| '',
      c.city   || '',
      c.pin    || '',
      c.state  || '',
      c.paymentMethod || c.payment || '',
      c.upiTxnId || '',
      items,
      ((o.total||0)/100).toFixed(2)
    ].map(v => '"' + String(v).replace(/"/g,'""') + '"');
  });

  const csv = [headers.map(h => '"'+h+'"').join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'beauladresses_orders_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showAdminToast('✅ Orders exported to CSV!');
}

// ── Coupons Admin ─────────────────────────────────────────────────
function renderCoupons() {
  const coupons = getCoupons();
  const search = (document.getElementById('couponSearch')?.value||'').toLowerCase();
  const filtered = search ? coupons.filter(c => c.code.toLowerCase().includes(search) || (c.description||'').toLowerCase().includes(search)) : coupons;

  // Stats
  const active   = coupons.filter(c => c.active).length;
  const inactive = coupons.filter(c => !c.active).length;
  const totalUsed = coupons.reduce((s,c) => s + (c.usedCount||0), 0);
  const expired  = coupons.filter(c => c.expiry && new Date(c.expiry) < new Date()).length;
  const statsEl = document.getElementById('couponStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-icon green">🎟️</div><div><div class="stat-value">${coupons.length}</div><div class="stat-label">Total Coupons</div></div></div>
    <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${active}</div><div class="stat-label">Active</div></div></div>
    <div class="stat-card"><div class="stat-icon orange">📊</div><div><div class="stat-value">${totalUsed}</div><div class="stat-label">Times Used</div></div></div>
    <div class="stat-card"><div class="stat-icon red">⏰</div><div><div class="stat-value">${expired}</div><div class="stat-label">Expired</div></div></div>
  `;

  const body = document.getElementById('couponsTableBody');
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:20px;">No coupons found.</td></tr>'; return;
  }
  const today = new Date();
  body.innerHTML = filtered.map(c => {
    const isExpired = c.expiry && new Date(c.expiry) < today;
    const statusBadge = !c.active ? '<span class="badge badge-red">Inactive</span>'
      : isExpired ? '<span class="badge badge-orange">Expired</span>'
      : '<span class="badge badge-green">Active</span>';
    const usageBar = c.maxUses > 0
      ? `<div style="font-size:.78rem;">${c.usedCount||0} / ${c.maxUses}<br/><div style="background:#f0f0f0;border-radius:3px;height:5px;margin-top:3px;"><div style="width:${Math.min(100,Math.round(((c.usedCount||0)/c.maxUses)*100))}%;background:#c9848a;height:100%;border-radius:3px;"></div></div></div>`
      : `<span style="font-size:.82rem;">${c.usedCount||0} / ∞</span>`;
    return `<tr>
      <td><code style="font-size:.9rem;font-weight:800;background:#f0f0f0;padding:3px 8px;border-radius:6px;">${c.code}</code></td>
      <td style="font-size:.83rem;">${c.type === 'percent' ? '% Off' : '₹ Flat'}</td>
      <td style="font-weight:700;">${c.type === 'percent' ? c.value+'%' : '₹'+c.value}</td>
      <td style="font-size:.82rem;">${c.minOrder > 0 ? '₹'+c.minOrder : '—'}</td>
      <td>${usageBar}</td>
      <td style="font-size:.8rem;color:${isExpired?'#dc2626':'#555'};">${c.expiry || '—'}</td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button style="padding:5px 10px;background:#dcfce7;color:#16a34a;border:none;border-radius:7px;font-size:.78rem;font-weight:700;cursor:pointer;" onclick="openEditCoupon('${c.id}')">✏️ Edit</button>
          <button style="padding:5px 10px;background:${c.active?'#fee2e2':'#dcfce7'};color:${c.active?'#dc2626':'#16a34a'};border:none;border-radius:7px;font-size:.78rem;font-weight:700;cursor:pointer;" onclick="toggleCouponActive('${c.id}')">${c.active?'🔴 Deactivate':'🟢 Activate'}</button>
          <button style="padding:5px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:7px;font-size:.78rem;font-weight:700;cursor:pointer;" onclick="confirmDeleteCoupon('${c.id}')">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openCouponModal() {
  document.getElementById('couponModalTitle').textContent = 'New Coupon';
  document.getElementById('cpnId').value = '';
  document.getElementById('cpnCode').value = '';
  document.getElementById('cpnType').value = 'percent';
  document.getElementById('cpnValue').value = '';
  document.getElementById('cpnMaxDiscount').value = '';
  document.getElementById('cpnMinOrder').value = '0';
  document.getElementById('cpnMaxUses').value = '0';
  document.getElementById('cpnExpiry').value = '';
  document.getElementById('cpnDesc').value = '';
  document.getElementById('cpnActive').checked = true;
  document.getElementById('couponPreview').style.display = 'none';
  updateCouponPreview();
  openModal('couponModal');
}

function openEditCoupon(id) {
  const c = getCoupons().find(x => x.id === id);
  if (!c) return;
  document.getElementById('couponModalTitle').textContent = 'Edit Coupon';
  document.getElementById('cpnId').value = c.id;
  document.getElementById('cpnCode').value = c.code;
  document.getElementById('cpnType').value = c.type;
  document.getElementById('cpnValue').value = c.value;
  document.getElementById('cpnMaxDiscount').value = c.maxDiscount || '';
  document.getElementById('cpnMinOrder').value = c.minOrder || 0;
  document.getElementById('cpnMaxUses').value = c.maxUses || 0;
  document.getElementById('cpnExpiry').value = c.expiry || '';
  document.getElementById('cpnDesc').value = c.description || '';
  document.getElementById('cpnActive').checked = !!c.active;
  updateCouponPreview();
  openModal('couponModal');
}

function updateCouponPreview() {
  const type  = document.getElementById('cpnType')?.value;
  const value = parseFloat(document.getElementById('cpnValue')?.value);
  const label = document.getElementById('cpnValueLabel');
  if (label) label.textContent = type === 'percent' ? 'Discount Value (%) *' : 'Discount Amount (₹) *';
  const prev = document.getElementById('couponPreview');
  const txt  = document.getElementById('couponPreviewText');
  if (!value || isNaN(value)) { if(prev) prev.style.display='none'; return; }
  const msg = type === 'percent' ? `${value}% discount applied to cart total` : `₹${value} flat discount applied`;
  if (txt) txt.textContent = msg;
  if (prev) prev.style.display = 'block';
}

function saveCouponAdmin() {
  const id     = document.getElementById('cpnId').value;
  const code   = document.getElementById('cpnCode').value.trim().toUpperCase();
  const type   = document.getElementById('cpnType').value;
  const value  = parseFloat(document.getElementById('cpnValue').value);
  const maxDis = parseFloat(document.getElementById('cpnMaxDiscount').value) || 0;
  const minOrd = parseFloat(document.getElementById('cpnMinOrder').value) || 0;
  const maxUse = parseInt(document.getElementById('cpnMaxUses').value) || 0;
  const expiry = document.getElementById('cpnExpiry').value;
  const desc   = document.getElementById('cpnDesc').value.trim();
  const active = document.getElementById('cpnActive').checked;

  if (!code)          { showAdminToast('❌ Coupon code is required.', true); return; }
  if (isNaN(value) || value <= 0) { showAdminToast('❌ Enter a valid discount value.', true); return; }
  if (type === 'percent' && value > 100) { showAdminToast('❌ Percentage cannot exceed 100%.', true); return; }
  if (!desc)          { showAdminToast('❌ Description is required.', true); return; }

  // Check duplicate code (ignore current if editing)
  const existing = getCouponByCode(code);
  if (existing && existing.id !== id) { showAdminToast('❌ A coupon with this code already exists.', true); return; }

  const coupon = {
    id: id || generateId('CPN'),
    code, type, value,
    maxDiscount: maxDis || null,
    minOrder: minOrd,
    maxUses: maxUse,
    usedCount: id ? (getCoupons().find(c=>c.id===id)?.usedCount||0) : 0,
    expiry: expiry || null,
    description: desc,
    active
  };
  saveCoupon(coupon);
  closeModal('couponModal');
  renderCoupons();
  showAdminToast(id ? '✅ Coupon updated!' : '✅ Coupon created!');
}

function toggleCouponActive(id) {
  updateDB(db => {
    const c = (db.coupons||[]).find(x => x.id === id);
    if (c) c.active = !c.active;
  });
  renderCoupons();
  showAdminToast('✅ Coupon status updated.');
}

function confirmDeleteCoupon(id) {
  const c = getCoupons().find(x => x.id === id);
  showConfirm('Delete Coupon', `Delete coupon "${c?.code}"? This cannot be undone.`, () => {
    deleteCoupon(id);
    renderCoupons();
    showAdminToast('🗑 Coupon deleted.');
  });
}

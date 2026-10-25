// Shared data layer – persists to localStorage
const DB_KEY = 'beauladresses_db';

const defaultData = {
  collections: [
    {
      id: 'col_1',
      name: 'Summer Breeze',
      description: 'Light and airy pieces for the warm season.',
      image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&q=80',
      createdAt: Date.now()
    },
    {
      id: 'col_2',
      name: 'Evening Elegance',
      description: 'Sophisticated looks for your nights out.',
      image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80',
      createdAt: Date.now()
    }
  ],
  products: [
    { id: 'p1', collectionId: 'col_1', name: 'Floral Sundress',       price: 4999,  stock: 12, image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', sizes: ['XS','S','M','L'], description: 'A breezy floral sundress perfect for summer days.' },
    { id: 'p2', collectionId: 'col_1', name: 'Linen Co-ord Set',      price: 6499,  stock: 8,  image: 'https://images.unsplash.com/photo-1583496661160-fb5218afa9a7?w=400&q=80', sizes: ['S','M','L','XL'], description: 'Matching linen top and trouser set.' },
    { id: 'p3', collectionId: 'col_1', name: 'Stripe Wrap Top',       price: 2999,  stock: 0,  image: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?w=400&q=80', sizes: ['XS','S','M'], description: 'Classic stripe wrap top in cotton.' },
    { id: 'p4', collectionId: 'col_2', name: 'Velvet Slip Dress',     price: 8999,  stock: 5,  image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&q=80', sizes: ['XS','S','M','L'], description: 'Luxurious velvet slip dress for evenings.' },
    { id: 'p5', collectionId: 'col_2', name: 'Sequin Blazer',         price: 11999, stock: 3,  image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80', sizes: ['S','M','L'], description: 'Statement sequin blazer for nights out.' },
    { id: 'p6', collectionId: 'col_2', name: 'Satin Wide-Leg Pants',  price: 7499,  stock: 0,  image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4f3a?w=400&q=80', sizes: ['XS','S','M','L','XL'], description: 'Flowing satin wide-leg trousers.' }
  ],
  orders: [],
  cart: [],
  users: [],
  wishlist: [],
  adminPassword: 'admin123'
};

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      saveDB(defaultData);
      return JSON.parse(JSON.stringify(defaultData));
    }
    return JSON.parse(raw);
  } catch(e) {
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function saveDB(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

function getDB() { return loadDB(); }

function updateDB(fn) {
  const db = loadDB();
  fn(db);
  saveDB(db);
}

// Products
function getProducts(collectionId) {
  const db = getDB();
  return collectionId ? db.products.filter(p => p.collectionId === collectionId) : db.products;
}

function getInStockProducts() {
  return getDB().products.filter(p => p.stock > 0);
}

function getProductById(id) {
  return getDB().products.find(p => p.id === id);
}

// Collections
function getCollections() { return getDB().collections; }
function getCollectionById(id) { return getDB().collections.find(c => c.id === id); }

// Cart
function getCart() { return getDB().cart || []; }

function addToCart(productId, size, qty = 1) {
  updateDB(db => {
    const existing = db.cart.find(i => i.productId === productId && i.size === size);
    if (existing) { existing.qty += qty; }
    else { db.cart.push({ productId, size, qty }); }
  });
}

function removeFromCart(productId, size) {
  updateDB(db => { db.cart = db.cart.filter(i => !(i.productId === productId && i.size === size)); });
}

function clearCart() { updateDB(db => { db.cart = []; }); }

function getCartTotal() {
  const db = getDB();
  return db.cart.reduce((sum, item) => {
    const p = db.products.find(x => x.id === item.productId);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

// Orders
function placeOrder(customerInfo) {
  const db = getDB();
  const currentUser = getCurrentUser();
  const order = {
    id: 'ORD' + Date.now(),
    items: db.cart.map(i => ({ ...i })),
    total: getCartTotal(),
    customer: customerInfo,
    userId: currentUser ? currentUser.id : null,
    status: 'Confirmed',
    date: new Date().toISOString()
  };
  updateDB(d => {
    // deduct stock
    order.items.forEach(item => {
      const p = d.products.find(x => x.id === item.productId);
      if (p) p.stock = Math.max(0, p.stock - item.qty);
    });
    d.orders.push(order);
    d.cart = [];
  });
  return order;
}

// Formatters
function formatPrice(paise) {
  return '₹' + (paise / 100).toFixed(2);
}

function generateId(prefix) {
  return prefix + '_' + Math.random().toString(36).substr(2, 9);
}

// ── User Auth ────────────────────────────────────────────────────
const USER_SESSION_KEY = 'ba_user_session';

function registerUser(name, email, password, phone) {
  const db = getDB();
  if (!db.users) db.users = [];
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: 'An account with this email already exists.' };
  }
  const user = {
    id: generateId('usr'),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: password,
    phone: phone || '',
    createdAt: new Date().toISOString(),
    addresses: [],
    wishlist: []
  };
  updateDB(d => { if (!d.users) d.users = []; d.users.push(user); });
  sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email }));
  return { user };
}

function loginUser(email, password) {
  const db = getDB();
  if (!db.users) return { error: 'No account found.' };
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) return { error: 'Incorrect email or password.' };
  sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email }));
  return { user };
}

function logoutUser() {
  sessionStorage.removeItem(USER_SESSION_KEY);
}

function getCurrentUser() {
  try {
    const s = sessionStorage.getItem(USER_SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch(e) { return null; }
}

function getFullUser(id) {
  return getDB().users.find(u => u.id === id);
}

function updateUserProfile(id, data) {
  updateDB(db => {
    const u = db.users.find(x => x.id === id);
    if (u) Object.assign(u, data);
  });
  const sess = getCurrentUser();
  if (sess) {
    const updated = getFullUser(id);
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify({ id: updated.id, name: updated.name, email: updated.email }));
  }
}

function getUserOrders(userId) {
  const db = getDB();
  return db.orders.filter(o => o.userId === userId).reverse();
}

// ── Wishlist ────────────────────────────────────────────────────
function getWishlist() {
  const u = getCurrentUser();
  if (!u) return [];
  const full = getFullUser(u.id);
  return full ? (full.wishlist || []) : [];
}

function toggleWishlist(productId) {
  const u = getCurrentUser();
  if (!u) return false;
  let added = false;
  updateDB(db => {
    const user = db.users.find(x => x.id === u.id);
    if (!user) return;
    if (!user.wishlist) user.wishlist = [];
    const idx = user.wishlist.indexOf(productId);
    if (idx > -1) { user.wishlist.splice(idx, 1); added = false; }
    else { user.wishlist.push(productId); added = true; }
  });
  return added;
}

function isWishlisted(productId) {
  return getWishlist().includes(productId);
}

const API_BASE = "/api";

let currentStoreId = null;
let currentStoreName = "";
let cart = {}; // { productId: { name, price, quantity } }

const DELIVERY_FEE = 30;
const FREE_DELIVERY_THRESHOLD = 499;

function getDeliveryFee(subtotal) {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}

document.addEventListener("DOMContentLoaded", () => {
  initializeStoreContext();
  setupEventListeners();
});

// ── 1. EXTRACT QR SLUG AND RESOLVE STORE ─────────────────────────────────────
function initializeStoreContext() {
  const urlParams = new URLSearchParams(window.location.search);
  const storeSlug = urlParams.get('store');

  if (!storeSlug) {
    document.getElementById("store-name").innerText = "No QR Scan Detected";
    document.getElementById("store-location").innerText = "Please scan a physical store QR code.";
    return;
  }

  fetch(`${API_BASE}/stores/scan/${storeSlug}`)
    .then(res => {
      if (!res.ok) throw new Error("Store mapping failed");
      return res.json();
    })
    .then(data => {
      if (data.success) {
        currentStoreId = data.store.id;
        currentStoreName = data.store.name;
        document.getElementById("store-name").innerText = data.store.name;
        document.getElementById("store-location").innerText = `${data.store.address}, ${data.store.city}`;
        document.getElementById("welcome-banner").classList.remove("hidden");
        document.getElementById("my-orders-btn").classList.remove("hidden");
        fetchStoreProducts(currentStoreId);
      }
    })
    .catch(err => {
      document.getElementById("store-name").innerText = "Error Loading Store";
      console.error(err);
    });
}

// ── 2. FETCH AND RENDER PRODUCTS ──────────────────────────────────────────────
function fetchStoreProducts(storeId) {
  const grid = document.getElementById("products-grid");

  fetch(`${API_BASE}/products?storeId=${storeId}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success || data.products.length === 0) {
        grid.innerHTML = `<div class="loading-shimmer">No products in stock right now at this counter.</div>`;
        return;
      }

      grid.innerHTML = "";
      data.products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.dataset.name = product.name.toLowerCase();
        card.dataset.desc = (product.description || '').toLowerCase();
        card.innerHTML = `
          <div class="product-img-wrap">
            ${product.imageUrl
              ? `<img src="${product.imageUrl}" alt="${product.name}" class="product-img" loading="lazy" />`
              : `<div class="product-img-placeholder"><span class="material-symbols-outlined">image_not_supported</span></div>`
            }
          </div>
          <div>
            <div class="product-name">${product.name}</div>
            <div class="product-desc">${product.description || 'Fresh local supply.'}</div>
          </div>
          <div class="product-meta">
            <div class="product-price">₹${parseFloat(product.price).toFixed(2)}</div>
            <div id="action-cell-${product.id}">
              <button class="add-to-cart-btn" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">
                <span class="material-symbols-outlined" style="font-size:16px">add</span> Add
              </button>
            </div>
          </div>`;
        grid.appendChild(card);
      });

      setupSearch();
    })
    .catch(err => {
      grid.innerHTML = `<div class="loading-shimmer">Failed to load local catalogue.</div>`;
      console.error(err);
    });
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
function setupSearch() {
  const input     = document.getElementById("product-search");
  const clearBtn  = document.getElementById("clear-search");
  const emptyMsg  = document.getElementById("search-empty");

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const cards = document.querySelectorAll(".product-card");
    let visible = 0;

    cards.forEach(card => {
      const matches = card.dataset.name.includes(query) || card.dataset.desc.includes(query);
      card.style.display = matches ? "" : "none";
      if (matches) visible++;
    });

    clearBtn.classList.toggle("hidden", query === "");
    emptyMsg.classList.toggle("hidden", visible > 0 || query === "");
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.focus();
  });
}

// ── 3. CART ACTIONS ───────────────────────────────────────────────────────────
window.addToCart = function(id, name, price) {
  cart[id] = { name, price, quantity: 1 };
  updateCartUI();
  renderQuantityController(id);
};

window.changeQuantity = function(id, delta) {
  if (!cart[id]) return;
  cart[id].quantity += delta;

  if (cart[id].quantity <= 0) {
    const { name, price } = cart[id];
    delete cart[id];
    document.getElementById(`action-cell-${id}`).innerHTML = `
      <button class="add-to-cart-btn" onclick="addToCart(${id}, '${name}', ${price})">
        <span class="material-symbols-outlined" style="font-size:16px">add</span> Add
      </button>`;
  } else {
    document.getElementById(`qty-${id}`).innerText = cart[id].quantity;
  }

  updateCartUI();
};

function renderQuantityController(id) {
  document.getElementById(`action-cell-${id}`).innerHTML = `
    <div class="quantity-controller">
      <button onclick="changeQuantity(${id}, -1)">-</button>
      <span id="qty-${id}">1</span>
      <button onclick="changeQuantity(${id}, 1)">+</button>
    </div>`;
}

function updateCartUI() {
  let totalItems = 0;
  let totalPrice = 0;

  for (let id in cart) {
    totalItems += cart[id].quantity;
    totalPrice += cart[id].quantity * cart[id].price;
  }

  const cartBar = document.getElementById("cart-bar");
  if (totalItems > 0) {
    cartBar.classList.remove("hidden");
    document.getElementById("cart-count").innerText = `${totalItems} Item${totalItems > 1 ? 's' : ''}`;
    document.getElementById("cart-total").innerText = `₹${totalPrice.toFixed(2)}`;
  } else {
    cartBar.classList.add("hidden");
  }
}

// ── 4. MODAL & CHECKOUT ───────────────────────────────────────────────────────
function setupEventListeners() {
  const modal = document.getElementById("checkout-modal");

  document.getElementById("checkout-btn").addEventListener("click", () => {
    let subtotal = 0;
    for (let id in cart) subtotal += cart[id].quantity * cart[id].price;
    const fee = getDeliveryFee(subtotal);
    const total = subtotal + fee;

    document.getElementById("modal-subtotal").innerText = `₹${subtotal.toFixed(2)}`;

    const feeEl = document.getElementById("modal-delivery-fee");
    if (fee === 0) {
      feeEl.innerHTML = `<span class="free-badge">FREE</span>`;
    } else {
      feeEl.innerHTML = `<span>₹${fee.toFixed(2)}</span>
        <small class="delivery-hint">Add ₹${(FREE_DELIVERY_THRESHOLD - subtotal).toFixed(0)} more for free delivery</small>`;
    }

    document.getElementById("modal-total").innerText = `₹${total.toFixed(2)}`;
    modal.classList.remove("hidden");
  });

  document.getElementById("close-modal").addEventListener("click", () => {
    modal.classList.add("hidden");
    // Reset back to form step
    document.getElementById("order-form").classList.remove("hidden");
    document.getElementById("order-review").classList.add("hidden");
    document.querySelector(".modal-header h2").textContent = "Confirm Delivery Details";
  });

  // ── MY ORDERS MODAL ──────────────────────────────────────────────────────
  const myOrdersModal = document.getElementById("my-orders-modal");

  document.getElementById("my-orders-btn").addEventListener("click", () => {
    myOrdersModal.classList.remove("hidden");
    // Pre-fill & load if phone already entered in checkout form
    const existingPhone = document.getElementById("cust-phone").value.trim();
    if (existingPhone.length === 10) {
      document.getElementById("orders-phone-input").value = existingPhone;
      loadCustomerOrders(existingPhone);
    }
  });

  document.getElementById("close-my-orders").addEventListener("click", () => {
    myOrdersModal.classList.add("hidden");
  });

  document.getElementById("my-orders-overlay").addEventListener("click", () => {
    myOrdersModal.classList.add("hidden");
  });

  document.getElementById("orders-phone-btn").addEventListener("click", () => {
    const phone = document.getElementById("orders-phone-input").value.trim();
    if (phone.length !== 10) { alert("Please enter a valid 10-digit phone number."); return; }
    loadCustomerOrders(phone);
  });

  document.getElementById("orders-phone-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("orders-phone-btn").click();
  });

  // Update button label when payment method changes
  document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const btn = document.getElementById("submit-order-btn");
      btn.textContent = radio.value === "cod" ? "Place COD Order" : "Confirm & Pay";
    });
  });

  document.getElementById("order-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const method = document.querySelector('input[name="payment-method"]:checked').value;
    showOrderReview(method);
  });

  // Review screen — back button
  document.getElementById("review-back-btn").addEventListener("click", () => {
    document.getElementById("order-review").classList.add("hidden");
    document.getElementById("order-form").classList.remove("hidden");
    document.querySelector(".modal-header h2").textContent = "Confirm Delivery Details";
  });

  // Review screen — confirm button actually places the order
  document.getElementById("review-confirm-btn").addEventListener("click", () => {
    const method = document.querySelector('input[name="payment-method"]:checked').value;
    if (method === "online") handleOnlinePayment();
    else handleCODOrder();
  });
}

// ── 5. ORDER REVIEW SCREEN ────────────────────────────────────────────────────
function showOrderReview(method) {
  // Populate items
  const itemsEl = document.getElementById("review-items");
  itemsEl.innerHTML = "";
  let subtotal = 0;
  for (let id in cart) {
    const item = cart[id];
    const lineTotal = item.quantity * item.price;
    subtotal += lineTotal;
    const row = document.createElement("div");
    row.className = "review-item-row";
    row.innerHTML = `
      <span class="review-item-name">${item.name} <span class="review-item-qty">× ${item.quantity}</span></span>
      <span class="review-item-price">₹${lineTotal.toFixed(2)}</span>`;
    itemsEl.appendChild(row);
  }

  const fee = getDeliveryFee(subtotal);
  const total = subtotal + fee;

  // Add delivery fee row
  const feeRow = document.createElement("div");
  feeRow.className = "review-item-row";
  feeRow.innerHTML = fee === 0
    ? `<span class="review-item-name">Delivery</span><span class="review-item-price free-badge">FREE</span>`
    : `<span class="review-item-name">Delivery</span><span class="review-item-price">₹${fee.toFixed(2)}</span>`;
  itemsEl.appendChild(feeRow);

  document.getElementById("review-name").textContent    = document.getElementById("cust-name").value;
  document.getElementById("review-phone").textContent   = document.getElementById("cust-phone").value;
  document.getElementById("review-address").textContent = document.getElementById("cust-address").value;
  document.getElementById("review-total").textContent   = `₹${total.toFixed(2)}`;

  const tag = document.getElementById("review-payment-tag");
  tag.textContent = method === "cod" ? "💵 Cash on Delivery" : "💳 Online Payment";
  tag.className = `review-payment-tag ${method}`;

  const confirmLabel = document.getElementById("review-confirm-label");
  confirmLabel.textContent = method === "cod" ? "Confirm & Place Order" : "Confirm & Pay";

  // Switch view
  document.getElementById("order-form").classList.add("hidden");
  document.getElementById("order-review").classList.remove("hidden");
  document.querySelector(".modal-header h2").textContent = "Review Your Order";
}

// ── 6. ONLINE PAYMENT via Razorpay ────────────────────────────────────────────
function handleOnlinePayment() {
  let subtotal = 0;
  for (let id in cart) subtotal += cart[id].quantity * cart[id].price;
  const totalPrice = subtotal + getDeliveryFee(subtotal);

  const btn = document.getElementById("submit-order-btn");
  btn.disabled = true;
  btn.textContent = "Initiating payment...";

  // Step 1: Create a Razorpay order on backend
  fetch(`${API_BASE}/orders/create-razorpay-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ totalAmount: totalPrice })
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error(data.message);

      const phone = document.getElementById("cust-phone").value;
      const name  = document.getElementById("cust-name").value;

      // Step 2: Open Razorpay checkout popup
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: currentStoreName,
        description: "Grocery Order",
        order_id: data.razorpayOrderId,
        prefill: { name, contact: phone },
        theme: { color: "#10b981" },

        handler: function(response) {
          // Step 3: Verify payment on backend and save order
          const orderPayload = {
            phone,
            customerName: name,
            storeId: currentStoreId,
            totalAmount: totalPrice,
            cart,
            deliveryAddress: document.getElementById("cust-address").value,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          };

          fetch(`${API_BASE}/orders/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderPayload)
          })
            .then(r => r.json())
            .then(result => {
              if (result.success) {
                showOrderSuccess(result.orderId, "ONLINE");
              } else {
                alert(`Payment verification failed: ${result.message}`);
              }
            })
            .catch(() => alert("Error saving order after payment."));
        },

        modal: {
          ondismiss: function() {
            btn.disabled = false;
            btn.textContent = "Confirm & Pay";
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function(response) {
        alert(`Payment failed: ${response.error.description}`);
        btn.disabled = false;
        btn.textContent = "Confirm & Pay";
      });
      rzp.open();
    })
    .catch(err => {
      console.error(err);
      alert("Could not initiate payment. Is the server running?");
      btn.disabled = false;
      btn.textContent = "Confirm & Pay";
    });
}

// ── 6. CASH ON DELIVERY ───────────────────────────────────────────────────────
function handleCODOrder() {
  let subtotal = 0;
  for (let id in cart) subtotal += cart[id].quantity * cart[id].price;
  const totalPrice = subtotal + getDeliveryFee(subtotal);

  const btn = document.getElementById("submit-order-btn");
  btn.disabled = true;
  btn.textContent = "Placing order...";

  const orderPayload = {
    phone: document.getElementById("cust-phone").value,
    customerName: document.getElementById("cust-name").value,
    storeId: currentStoreId,
    totalAmount: totalPrice,
    cart,
    deliveryAddress: document.getElementById("cust-address").value
  };

  fetch(`${API_BASE}/orders/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload)
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showOrderSuccess(data.orderId, "COD");
      } else {
        alert(`Error: ${data.message}`);
        btn.disabled = false;
        btn.textContent = "Place COD Order";
      }
    })
    .catch(err => {
      console.error(err);
      alert("Backend dispatch error. Is your server running?");
      btn.disabled = false;
      btn.textContent = "Place COD Order";
    });
}

// ── 7. SUCCESS HANDLER ────────────────────────────────────────────────────────
function showOrderSuccess(orderId, method) {
  const modal = document.getElementById("checkout-modal");
  const note = method === "COD" ? "Pay cash when your order arrives." : "Payment confirmed ✓";

  alert(`🛒 Order Placed!\nOrder ID: #${orderId}\n${note}`);
  cart = {};
  updateCartUI();
  modal.classList.add("hidden");

  // Auto-open My Orders so customer sees their new order immediately
  const phone = document.getElementById("cust-phone").value.trim();
  if (phone.length === 10) {
    document.getElementById("orders-phone-input").value = phone;
    document.getElementById("my-orders-modal").classList.remove("hidden");
    loadCustomerOrders(phone);
  } else {
    location.reload();
  }
}

// ── 8. CUSTOMER ORDER HISTORY ─────────────────────────────────────────────────
function loadCustomerOrders(phone) {
  const list = document.getElementById("my-orders-list");

  list.innerHTML = `<div class="orders-loading">Loading your orders...</div>`;

  fetch(`${API_BASE}/orders/customer/${encodeURIComponent(phone)}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success || data.orders.length === 0) {
        list.innerHTML = `<div class="orders-loading">No orders yet.</div>`;
        return;
      }

      list.innerHTML = "";
      data.orders.forEach(order => {
        const itemsHtml = order.items.map(i =>
          `<div class="cust-order-item">
            <span>${i.name} × ${i.quantity}</span>
            <span>₹${(parseFloat(i.price) * i.quantity).toFixed(2)}</span>
          </div>`
        ).join('');

        const card = document.createElement("div");
        card.className = "cust-order-card";
        card.innerHTML = `
          <div class="cust-order-header">
            <div>
              <span class="cust-order-id">Order #${order.id}</span>
              <span class="cust-order-store">${order.store?.name || ''}</span>
            </div>
            <span class="cust-status-badge cust-status-${order.status.toLowerCase()}">${formatOrderStatus(order.status)}</span>
          </div>
          <div class="cust-order-items">${itemsHtml}</div>
          <div class="cust-order-footer">
            <span class="cust-order-total">Total: ₹${parseFloat(order.totalAmount).toFixed(2)}</span>
            <span class="cust-payment-tag">${order.paymentMethod}</span>
          </div>`;
        list.appendChild(card);
      });
    })
    .catch(() => {
      list.innerHTML = `<div class="orders-loading">Could not load orders.</div>`;
    });
}

function formatOrderStatus(s) {
  return {
    PENDING: '🕐 Pending',
    PREPARING: '👨‍🍳 Preparing',
    OUT_FOR_DELIVERY: '🚴 Out for Delivery',
    DELIVERED: '✅ Delivered',
    CANCELLED: '❌ Cancelled'
  }[s] || s;
}

// ── PWA: SERVICE WORKER + INSTALL BANNER ─────────────────────────────────────
let deferredInstallPrompt = null;

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// Capture the browser's install prompt before it fires (Android Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('pwa-dismissed')) {
    setTimeout(() => showInstallBanner(), 3000);
  }
});

function showInstallBanner() {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.classList.remove('hidden');
}

// Show iOS instructions banner if on iOS Safari, not already installed, not dismissed
function checkIOSBanner() {
  if (isIOS && !isInStandaloneMode && !localStorage.getItem('ios-banner-dismissed')) {
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    const banner = document.getElementById('ios-banner');
    if (!banner) return;
    if (isSafari) {
      // Full Safari — show "how to install" instructions after 3s
      setTimeout(() => banner.classList.remove('hidden'), 3000);
    } else {
      // In-app browser (Google app, Chrome in-app) — tell them to open in Safari
      banner.querySelector('p').innerHTML =
        'Tap <strong>⋯</strong> or <strong>Share</strong> → <strong>"Open in Safari"</strong>, then use Safari\'s Share button → <strong>"Add to Home Screen"</strong>';
      setTimeout(() => banner.classList.remove('hidden'), 3000);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const installBtn  = document.getElementById('pwa-install-btn');
  const dismissBtn  = document.getElementById('pwa-dismiss-btn');
  const iosDismiss  = document.getElementById('ios-dismiss-btn');

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      document.getElementById('pwa-banner').classList.add('hidden');
      if (outcome === 'accepted') localStorage.setItem('pwa-dismissed', '1');
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      document.getElementById('pwa-banner').classList.add('hidden');
      localStorage.setItem('pwa-dismissed', '1');
    });
  }

  if (iosDismiss) {
    iosDismiss.addEventListener('click', () => {
      document.getElementById('ios-banner').classList.add('hidden');
      localStorage.setItem('ios-banner-dismissed', '1');
    });
  }

  checkIOSBanner();
});

// Hide banner if app is already installed
window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.classList.add('hidden');
  deferredInstallPrompt = null;
});

const API_BASE = "http://localhost:5000/api";

let currentStoreId = null;
let currentStoreName = "";
let cart = {}; // { productId: { name, price, quantity } }

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
        card.innerHTML = `
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
    })
    .catch(err => {
      grid.innerHTML = `<div class="loading-shimmer">Failed to load local catalogue.</div>`;
      console.error(err);
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
    let totalPrice = 0;
    for (let id in cart) totalPrice += cart[id].quantity * cart[id].price;
    document.getElementById("modal-subtotal").innerText = `₹${totalPrice.toFixed(2)}`;
    document.getElementById("modal-total").innerText = `₹${totalPrice.toFixed(2)}`;
    modal.classList.remove("hidden");
  });

  document.getElementById("close-modal").addEventListener("click", () => {
    modal.classList.add("hidden");
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

    if (method === "online") {
      handleOnlinePayment();
    } else {
      handleCODOrder();
    }
  });
}

// ── 5. ONLINE PAYMENT via Razorpay ────────────────────────────────────────────
function handleOnlinePayment() {
  let totalPrice = 0;
  for (let id in cart) totalPrice += cart[id].quantity * cart[id].price;

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
  let totalPrice = 0;
  for (let id in cart) totalPrice += cart[id].quantity * cart[id].price;

  const btn = document.getElementById("submit-order-btn");
  btn.disabled = true;
  btn.textContent = "Placing order...";

  const orderPayload = {
    phone: document.getElementById("cust-phone").value,
    customerName: document.getElementById("cust-name").value,
    storeId: currentStoreId,
    totalAmount: totalPrice,
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
  const note = method === "COD"
    ? "Pay cash when your order arrives."
    : "Payment confirmed ✓";

  alert(`🛒 Order Placed!\nOrder ID: #${orderId}\n${note}`);
  cart = {};
  updateCartUI();
  modal.classList.add("hidden");
  location.reload();
}

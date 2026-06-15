const API_BASE = "http://localhost:5000/api";

let currentStore = null; // Full store object after login

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupLoginFlow();
  setupTabNav();
  setupInventoryPanel();
  setupEditModal();
  setupLogout();
});

// ── 1. LOGIN ──────────────────────────────────────────────────────────────────
function setupLoginFlow() {
  document.getElementById("login-btn").addEventListener("click", attemptLogin);
  document.getElementById("login-slug").addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
  });
  document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
  });
}

function attemptLogin() {
  const slug = document.getElementById("login-slug").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");

  if (!slug || !password) return;

  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  btn.textContent = "Logging in...";

  fetch(`${API_BASE}/stores/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        currentStore = data.store;
        showDashboard();
      } else {
        errEl.textContent = data.message || "Invalid slug or password.";
        errEl.classList.remove("hidden");
      }
    })
    .catch(() => errEl.classList.remove("hidden"))
    .finally(() => {
      btn.disabled = false;
      btn.textContent = "Login";
    });
}

function showDashboard() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");

  document.getElementById("dash-store-name").innerText = currentStore.name;
  document.getElementById("dash-store-location").innerText =
    `${currentStore.address}, ${currentStore.city}`;

  loadOrders();
  loadInventory();
  loadQR();
}

// ── 2. TAB NAVIGATION ─────────────────────────────────────────────────────────
function setupTabNav() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => {
        t.classList.remove("active");
        t.classList.add("hidden");
      });
      item.classList.add("active");
      const tabEl = document.getElementById(`tab-${item.dataset.tab}`);
      tabEl.classList.remove("hidden");
      tabEl.classList.add("active");
    });
  });

  document.getElementById("refresh-orders-btn").addEventListener("click", loadOrders);
}

// ── 3. ORDERS ─────────────────────────────────────────────────────────────────
function loadOrders() {
  const list = document.getElementById("orders-list");
  list.innerHTML = `<div class="empty-state">Loading orders...</div>`;

  fetch(`${API_BASE}/orders/store/${currentStore.id}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success || data.orders.length === 0) {
        list.innerHTML = `<div class="empty-state">No orders yet. Share your QR code to get started!</div>`;
        return;
      }

      list.innerHTML = "";
      data.orders.forEach(order => {
        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = `
          <div class="order-card-header">
            <div>
              <div class="order-id">Order #${order.id}</div>
              <div class="order-time">${formatDate(order.createdAt)}</div>
            </div>
            <span class="status-badge status-${order.status}">${formatStatus(order.status)}</span>
          </div>
          <div class="order-details">
            <strong>Customer:</strong> ${order.user?.name || "Guest"} &nbsp;|&nbsp;
            <strong>Phone:</strong> ${order.user?.phone || "—"}<br>
            <strong>Deliver to:</strong> ${order.deliveryAddress}<br>
            <strong>Payment:</strong>
            <span class="payment-badge payment-${order.paymentMethod?.toLowerCase()}">${order.paymentMethod || 'COD'}</span>
            &nbsp;
            <span class="payment-badge payment-status-${order.paymentStatus?.toLowerCase()}">${order.paymentStatus || 'PENDING'}</span>
          </div>
          <div class="order-card-footer">
            <div class="order-amount">₹${parseFloat(order.totalAmount).toFixed(2)}</div>
            <select class="status-select" data-order-id="${order.id}" onchange="updateOrderStatus(${order.id}, this.value)">
              ${statusOptions(order.status)}
            </select>
          </div>`;
        list.appendChild(card);
      });
    })
    .catch(() => {
      list.innerHTML = `<div class="empty-state">Failed to load orders.</div>`;
    });
}

window.updateOrderStatus = function(orderId, newStatus) {
  fetch(`${API_BASE}/orders/status/${orderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Update badge inline without full reload
        const card = document.querySelector(`[data-order-id="${orderId}"]`).closest(".order-card");
        const badge = card.querySelector(".status-badge");
        badge.className = `status-badge status-${newStatus}`;
        badge.innerText = formatStatus(newStatus);
      } else {
        alert("Failed to update status.");
      }
    })
    .catch(() => alert("Error updating order status."));
};

function statusOptions(current) {
  const all = ['PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  return all.map(s =>
    `<option value="${s}" ${s === current ? 'selected' : ''}>${formatStatus(s)}</option>`
  ).join('');
}

function formatStatus(s) {
  return { PENDING: 'Pending', PREPARING: 'Preparing', OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }[s] || s;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── 4. INVENTORY ──────────────────────────────────────────────────────────────
function loadInventory() {
  const list = document.getElementById("inventory-list");
  list.innerHTML = `<div class="empty-state">Loading inventory...</div>`;

  fetch(`${API_BASE}/products/all?storeId=${currentStore.id}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success || data.products.length === 0) {
        list.innerHTML = `<div class="empty-state">No products yet. Add your first item above.</div>`;
        return;
      }

      list.innerHTML = "";
      data.products.forEach(p => renderInventoryItem(p, list));
    })
    .catch(() => {
      list.innerHTML = `<div class="empty-state">Failed to load inventory.</div>`;
    });
}

function renderInventoryItem(p, container) {
  const item = document.createElement("div");
  item.className = "inventory-item";
  item.id = `inv-item-${p.id}`;
  item.innerHTML = `
    <div class="item-info">
      <div class="item-name">${p.name}</div>
      <div class="item-desc">${p.description || '—'}</div>
    </div>
    <div class="item-meta">
      <div class="item-price">₹${parseFloat(p.price).toFixed(2)}</div>
      <div class="item-stock ${p.stock <= 5 ? 'low' : ''}">${p.stock} in stock</div>
    </div>
    <button class="edit-btn" onclick="openEditModal(${p.id}, ${p.price}, ${p.stock}, '${(p.description || '').replace(/'/g, "\\'")}')">
      <span class="material-symbols-outlined" style="font-size:16px">edit</span> Edit
    </button>`;
  container.appendChild(item);
}

function setupInventoryPanel() {
  document.getElementById("show-add-product-btn").addEventListener("click", () => {
    document.getElementById("add-product-form").classList.toggle("hidden");
  });

  document.getElementById("cancel-add-product").addEventListener("click", () => {
    document.getElementById("add-product-form").classList.add("hidden");
    clearAddForm();
  });

  document.getElementById("submit-add-product").addEventListener("click", () => {
    const name  = document.getElementById("prod-name").value.trim();
    const price = document.getElementById("prod-price").value;
    const stock = document.getElementById("prod-stock").value;
    const desc  = document.getElementById("prod-desc").value.trim();

    if (!name || !price) return alert("Name and Price are required.");

    fetch(`${API_BASE}/products/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: currentStore.id, name, price, stock, description: desc })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          clearAddForm();
          document.getElementById("add-product-form").classList.add("hidden");
          // Append new item to list without full reload
          const list = document.getElementById("inventory-list");
          if (list.querySelector(".empty-state")) list.innerHTML = "";
          renderInventoryItem(data.product, list);
        } else {
          alert(data.message);
        }
      })
      .catch(() => alert("Failed to add product."));
  });
}

function clearAddForm() {
  ["prod-name", "prod-price", "prod-stock", "prod-desc"].forEach(id => {
    document.getElementById(id).value = "";
  });
}

// ── 5. EDIT MODAL ─────────────────────────────────────────────────────────────
function setupEditModal() {
  document.getElementById("close-edit-modal").addEventListener("click", () => {
    document.getElementById("edit-modal").classList.add("hidden");
  });

  document.getElementById("submit-edit-product").addEventListener("click", () => {
    const id    = document.getElementById("edit-product-id").value;
    const price = document.getElementById("edit-price").value;
    const stock = document.getElementById("edit-stock").value;
    const desc  = document.getElementById("edit-desc").value.trim();

    fetch(`${API_BASE}/products/update/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price, stock, description: desc })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          document.getElementById("edit-modal").classList.add("hidden");
          loadInventory(); // Refresh list
        } else {
          alert(data.message);
        }
      })
      .catch(() => alert("Failed to update product."));
  });
}

window.openEditModal = function(id, price, stock, desc) {
  document.getElementById("edit-product-id").value = id;
  document.getElementById("edit-price").value = price;
  document.getElementById("edit-stock").value = stock;
  document.getElementById("edit-desc").value = desc;
  document.getElementById("edit-modal").classList.remove("hidden");
};

// ── 6. QR CODE ────────────────────────────────────────────────────────────────
function loadQR() {
  const wrapper = document.getElementById("qr-image-wrapper");
  wrapper.innerHTML = `<div class="empty-state">Generating QR...</div>`;

  fetch(`${API_BASE}/stores/qr/${currentStore.slug}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        wrapper.innerHTML = `<img src="${data.qrCodeDataUrl}" alt="Store QR Code" />`;
        document.getElementById("qr-url").innerText = `Scans to: ${data.targetUrl}`;

        // Replace button to remove any previously stacked event listeners
        const oldBtn = document.getElementById("download-qr-btn");
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        newBtn.addEventListener("click", () => {
          const a = document.createElement("a");
          a.href = data.qrCodeDataUrl;
          a.download = `${currentStore.slug}-qr.png`;
          a.click();
        });
      } else {
        wrapper.innerHTML = `<div class="empty-state">Failed to generate QR.</div>`;
      }
    })
    .catch(() => {
      wrapper.innerHTML = `<div class="empty-state">Failed to generate QR.</div>`;
    });
}

// ── 7. LOGOUT ─────────────────────────────────────────────────────────────────
function setupLogout() {
  document.getElementById("logout-btn").addEventListener("click", () => {
    currentStore = null;
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("login-slug").value = "";
    document.getElementById("login-password").value = "";
  });
}

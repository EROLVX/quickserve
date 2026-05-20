let allProducts = [];
let adminProductsCache = [];
let adminCategoriesCache = [];

document.addEventListener("DOMContentLoaded", () => {
  // Theme
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const html = document.documentElement;
      const next =
        html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("qs_theme", next);
    });
  }
  const savedTheme = localStorage.getItem("qs_theme");
  if (savedTheme)
    document.documentElement.setAttribute("data-theme", savedTheme);

  // Kiosk
  if (document.getElementById("productsGrid")) {
    loadProducts();
    setupCategoryBar();
    setupSearch();
    setupCartUI();
    updateCartBadge();
    setupCheckoutLink();
  }

  // Admin
  if (document.querySelector(".admin-layout")) {
    checkSession();
    loadDashboard();
    setInterval(() => {
      const active = document.querySelector(".tab-content.active");
      if (!active) return;
      if (active.id === "dashboardTab") loadDashboard();
      if (active.id === "ordersTab") loadAdminOrders();
    }, 10000);
  }
});

function showToast(message, icon = "fa-info-circle") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

/* ---------- KIOSK ---------- */
async function loadProducts() {
  try {
    const data = await apiGet("products");
    if (data.success) {
      allProducts = data.products;
      renderProducts();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  const term =
    document.getElementById("searchInput")?.value.toLowerCase() || "";

  const filtered = allProducts.filter((p) => {
    const matchCat =
      currentCategory === "all" || p.category_name === currentCategory;
    const matchSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      (p.description && p.description.toLowerCase().includes(term));
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No items found</p>
            </div>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (p) => `
        <div class="card food-card card-hover animate-fade-in">
            <div class="food-image">
                ${
                  p.image_url
                    ? `<img src="${p.image_url}" alt="${escapeHtml(p.name)}">`
                    : `<div class="food-image-placeholder"><i class="fas fa-utensils"></i></div>`
                }
            </div>
            <div class="food-info">
                <h3>${escapeHtml(p.name)}</h3>
                <p>${escapeHtml(p.description || "")}</p>
                <div class="food-footer">
                    <span class="price">₱${parseFloat(p.price).toFixed(2)}</span>
                    <button class="btn btn-primary" onclick="handleAddToCart(${p.id})">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}

function setupCategoryBar() {
  const bar = document.getElementById("categoryBar");
  if (!bar) return;
  const cats = ["All", "Rice Meals", "Noodles", "Snacks", "Drinks"];
  const icons = {
    All: "fa-th-large",
    "Rice Meals": "fa-bowl-rice",
    Noodles: "fa-bowl-food",
    Snacks: "fa-cookie-bite",
    Drinks: "fa-glass-water",
  };

  bar.innerHTML = cats
    .map(
      (c) => `
        <button class="category-pill ${c === "All" ? "active" : ""}" onclick="setCategory('${c}')">
            <i class="fas ${icons[c]}"></i> ${c}
        </button>
    `,
    )
    .join("");
}

let currentCategory = "all";
function setCategory(cat) {
  currentCategory = cat === "All" ? "all" : cat;
  document.querySelectorAll(".category-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent.trim() === cat);
  });
  renderProducts();
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  if (input) input.addEventListener("input", renderProducts);
}

function setupCartUI() {
  const toggle = document.getElementById("cartToggle");
  const close = document.getElementById("cartClose");
  const overlay = document.getElementById("cartOverlay");
  if (toggle)
    toggle.addEventListener("click", () => {
      document.getElementById("cartSidebar").classList.add("open");
      overlay.classList.add("open");
      renderCartItems();
    });
  if (close) close.addEventListener("click", closeCart);
  if (overlay) overlay.addEventListener("click", closeCart);
}

function closeCart() {
  document.getElementById("cartSidebar")?.classList.remove("open");
  document.getElementById("cartOverlay")?.classList.remove("open");
}

function renderCartItems() {
  const container = document.getElementById("cartItems");
  if (!container) return;
  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-basket"></i>
                <p>Your cart is empty</p>
                <a href="#" onclick="closeCart()" class="btn btn-ghost btn-sm" style="margin-top:1rem;">Browse Menu</a>
            </div>`;
  } else {
    container.innerHTML = cart
      .map(
        (item) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${escapeHtml(item.name)}</h4>
                    <span>₱${parseFloat(item.price).toFixed(2)} each</span>
                </div>
                <div class="cart-item-controls">
                    <button class="btn-icon" onclick="updateQtyAndRender(${item.id}, -1)"><i class="fas fa-minus"></i></button>
                    <span style="min-width:24px;text-align:center;font-weight:700;">${item.quantity}</span>
                    <button class="btn-icon" onclick="updateQtyAndRender(${item.id}, 1)"><i class="fas fa-plus"></i></button>
                </div>
            </div>
        `,
      )
      .join("");
  }
  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.textContent = "₱" + getCartTotal().toFixed(2);
}

function updateQtyAndRender(id, delta) {
  updateQuantity(id, delta);
  renderCartItems();
}

function handleAddToCart(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (product) {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
    showToast(`Added ${product.name} to cart`, "fa-check-circle");
  }
}

function setupCheckoutLink() {
  const link = document.getElementById("checkoutLink");
  if (!link) return;
  link.addEventListener("click", (e) => {
    if (getCartCount() === 0) {
      e.preventDefault();
      showToast(
        "Please add items to your cart first!",
        "fa-exclamation-circle",
      );
    }
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ---------- ADMIN ---------- */
window.showTab = function (tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById(tabName + "Tab")?.classList.add("active");

  const map = { dashboard: 0, orders: 1, products: 2, analytics: 3, accounts: 4 };
  const btns = document.querySelectorAll(".nav-item");
  if (btns[map[tabName]]) btns[map[tabName]].classList.add("active");

  if (tabName === "orders") loadAdminOrders();
  if (tabName === "products") loadAdminProducts();
  if (tabName === "analytics") loadAnalytics();
  if (tabName === "dashboard") loadDashboard();
  if (tabName === "accounts" && typeof loadUsers === "function") loadUsers();
};

async function loadDashboard() {
  try {
    const [oRes, qRes] = await Promise.all([apiGet("orders"), apiGet("queue")]);
    if (oRes.success) {
      const today = new Date().toISOString().split("T")[0];
      const todayOrders = oRes.orders.filter((o) =>
        o.created_at?.startsWith(today),
      );
      const rev = todayOrders.reduce(
        (s, o) => s + parseFloat(o.total_amount || 0),
        0,
      );

      updateStat("statTodayOrders", todayOrders.length);
      updateStat("statRevenue", "₱" + rev.toFixed(2));

      const tbody = document.getElementById("recentOrdersTable");
      if (tbody) {
        const recent = oRes.orders.slice(0, 6);
        tbody.innerHTML = recent.length
          ? recent
              .map(
                (o) => `
                    <tr>
                        <td><strong>${o.order_number}</strong></td>
                        <td>${o.order_type === "dine_in" ? '<i class="fas fa-utensils"></i> Dine In' : '<i class="fas fa-shopping-bag"></i> Take Out'}</td>
                        <td>₱${parseFloat(o.total_amount).toFixed(2)}</td>
                        <td><span class="badge badge-${o.status}">${o.status}</span></td>
                        <td>${new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                `,
              )
              .join("")
          : '<tr><td colspan="5" class="text-center">No orders yet</td></tr>';
      }
    }
    if (qRes.success) {
      updateStat("statPending", qRes.queue.pending.length);
      updateStat("statReady", qRes.queue.ready.length);
    }
  } catch (e) {}
}

function updateStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* Admin Products */
async function loadAdminProducts() {
  try {
    const [pRes, cRes] = await Promise.all([
      apiGet("products"),
      apiGet("categories"),
    ]);
    if (pRes.success) {
      adminProductsCache = pRes.products;
      renderAdminProducts(pRes.products);
    }
    if (cRes.success) {
      adminCategoriesCache = cRes.categories;
      const sel = document.getElementById("productCategory");
      if (sel)
        sel.innerHTML =
          '<option value="">Select Category</option>' +
          cRes.categories
            .map(
              (c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`,
            )
            .join("");
    }
  } catch (e) {}
}

function renderAdminProducts(products) {
  const grid = document.getElementById("adminProductsGrid");
  if (!grid) return;
  if (products.length === 0) {
    grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>No products found</p>
            </div>`;
    return;
  }
  grid.innerHTML = products
    .map(
      (p) => `
        <div class="product-card-admin">
            <div class="image-wrap">
                ${
                  p.image_url
                    ? `<img src="${p.image_url}" alt="">`
                    : `<div class="placeholder"><i class="fas fa-image"></i></div>`
                }
            </div>
            <div class="info">
                <div class="cat">${escapeHtml(p.category_name || "Uncategorized")}</div>
                <h4>${escapeHtml(p.name)}</h4>
                <div class="price">₱${parseFloat(p.price).toFixed(2)}</div>
            </div>
            <div class="actions">
                <button class="btn btn-sm btn-ghost" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `,
    )
    .join("");
}

window.openProductModal = function () {
  document.getElementById("productForm")?.reset();
  document.getElementById("productId").value = "";
  document.getElementById("existingImage").value = "";
  document.getElementById("imagePreview").innerHTML =
    '<i class="fas fa-cloud-upload-alt"></i>';
  document.getElementById("imagePreview").classList.remove("has-image");
  document.getElementById("productModalTitle").textContent = "Add Product";
  document.getElementById("productModal").classList.add("open");
};

window.closeProductModal = function () {
  document.getElementById("productModal")?.classList.remove("open");
};

window.editProduct = function (id) {
  const p = adminProductsCache.find((x) => x.id === id);
  if (!p) return;
  document.getElementById("productId").value = p.id;
  document.getElementById("productName").value = p.name;
  document.getElementById("productCategory").value = p.category_id || "";
  document.getElementById("productDesc").value = p.description || "";
  document.getElementById("productPrice").value = p.price;
  document.getElementById("productStatus").value = p.status;
  document.getElementById("existingImage").value = p.image_url || "";

  const preview = document.getElementById("imagePreview");
  if (p.image_url) {
    preview.innerHTML = `<img src="${p.image_url}" alt="">`;
    preview.classList.add("has-image");
  } else {
    preview.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
    preview.classList.remove("has-image");
  }

  document.getElementById("productModalTitle").textContent = "Edit Product";
  document.getElementById("productModal").classList.add("open");
};

window.saveProduct = async function (e) {
  e.preventDefault();
  const form = document.getElementById("productForm");
  const formData = new FormData(form);

  const id = document.getElementById("productId").value;
  if (id) formData.append("id", id);

  const existing = document.getElementById("existingImage").value;
  if (existing) formData.append("existing_image", existing);

  try {
    const res = await apiPostForm("products", formData);
    if (res.success) {
      closeProductModal();
      loadAdminProducts();
      showToast("Product saved successfully", "fa-check-circle");
    } else {
      alert(res.message || "Failed to save product");
    }
  } catch (err) {
    alert("Error saving product");
  }
};

window.deleteProduct = async function (id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  try {
    const res = await apiDelete("products", id);
    if (res.success) {
      loadAdminProducts();
      showToast("Product deleted", "fa-trash");
    } else {
      alert("Failed to delete");
    }
  } catch (e) {
    alert("Error deleting product");
  }
};

// Image preview handler
document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("productImage");
  if (imageInput) {
    imageInput.addEventListener("change", function () {
      const preview = document.getElementById("imagePreview");
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          preview.innerHTML = `<img src="${e.target.result}" alt="">`;
          preview.classList.add("has-image");
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }
});
function openSidebar() {
  document.getElementById("adminSidebar").classList.add("open");
  const ov = document.getElementById("sidebarOverlay");
  if (ov) ov.classList.add("open");
}

function closeSidebar() {
  document.getElementById("adminSidebar").classList.remove("open");
  const ov = document.getElementById("sidebarOverlay");
  if (ov) ov.classList.remove("open");
}

function autoCloseSidebar() {
  if (window.innerWidth <= 1024) {
    closeSidebar();
  }
}
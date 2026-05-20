/* ============================================
   QUICKSERVE ORDERS.JS
   Checkout + Admin Order Management
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("checkoutItems")) {
    renderCheckoutItems();
    const btn = document.getElementById("placeOrderBtn");
    if (btn) btn.addEventListener("click", placeOrder);
  }
  if (document.getElementById("ordersTable")) {
    loadAdminOrders();
  }
});

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ---------- ORDER TYPE HANDLING ---------- */

window.handleOrderTypeChange = function () {
  const type = document.querySelector('input[name="orderType"]:checked')?.value;
  const resFields = document.getElementById("reservationFields");
  const total = getCartTotal();

  if (type === "reservation") {
    resFields.style.display = "block";
    const minDp = total * 0.3;
    document.getElementById("downpaymentAmount").textContent =
      "₱" + minDp.toFixed(2);
    document.getElementById("minDownpayment").textContent =
      "₱" + minDp.toFixed(2);
    document.getElementById("downpaymentValue").value = minDp;
  } else {
    resFields.style.display = "none";
  }
};

/* ---------- CHECKOUT ---------- */

function renderCheckoutItems() {
  const container = document.getElementById("checkoutItems");
  const totalEl = document.getElementById("checkoutTotal");
  const cart = getCart();

  if (!container) return;

  if (!cart || cart.length === 0) {
    container.innerHTML =
      '<tr><td colspan="4" class="text-center text-light">Your cart is empty. <a href="index.html">Browse menu</a></td></tr>';
    if (totalEl) totalEl.textContent = "₱0.00";
    updateCheckoutButton(false);
    return;
  }

  container.innerHTML = cart
    .map(
      (item) => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>₱${parseFloat(item.price).toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>₱${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
    `,
    )
    .join("");

  if (totalEl) totalEl.textContent = "₱" + getCartTotal().toFixed(2);
  updateCheckoutButton(true);
  handleOrderTypeChange();
}

function updateCheckoutButton(hasItems) {
  const btn = document.getElementById("placeOrderBtn");
  const error = document.getElementById("checkoutError");
  if (!btn) return;

  if (hasItems) {
    btn.disabled = false;
    btn.classList.remove("btn-disabled");
    const type = document.querySelector(
      'input[name="orderType"]:checked',
    )?.value;
    btn.innerHTML =
      type === "reservation"
        ? '<i class="fas fa-calendar-check"></i> Submit Reservation'
        : '<i class="fas fa-check-circle"></i> Place Order';
    if (error) error.classList.remove("show");
  } else {
    btn.disabled = true;
    btn.classList.add("btn-disabled");
    btn.innerHTML = '<i class="fas fa-lock"></i> Cart is Empty';
    if (error) error.classList.add("show");
  }
}

async function placeOrder() {
  const cart = getCart();
  if (!cart || cart.length === 0) {
    showToast("Your cart is empty.", "fa-exclamation-circle");
    return;
  }

  const orderType =
    document.querySelector('input[name="orderType"]:checked')?.value ||
    "dine_in";
  const customerName =
    document.getElementById("customerName")?.value.trim() || "Guest";
  const btn = document.getElementById("placeOrderBtn");
  const originalText = btn.innerHTML;

  let reservationDate = null;
  let reservationTime = null;
  let downpayment = 0;

  if (orderType === "reservation") {
    reservationDate = document.getElementById("reservationDate")?.value;
    reservationTime = document.getElementById("reservationTime")?.value;
    downpayment = parseFloat(
      document.getElementById("downpaymentValue")?.value || 0,
    );

    if (!reservationDate || !reservationTime) {
      showToast(
        "Please select reservation date and time.",
        "fa-exclamation-circle",
      );
      return;
    }
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

  try {
    const payload = {
      cart: cart,
      order_type: orderType,
      customer_name: customerName,
    };

    if (orderType === "reservation") {
      payload.reservation_date = reservationDate;
      payload.reservation_time = reservationTime;
      payload.downpayment_amount = downpayment;
    }

    const res = await apiPost("orders", payload);

    if (res.success) {
      const _orderTotal = getCartTotal(); // MUST capture before clearCart
      clearCart();
      showToast("Order placed successfully!", "fa-check-circle");
      (window.showReceipt || showReceipt)(res.order_number, orderType, {
        reservationDate,
        reservationTime,
        downpayment,
        status: res.status,
        requiresApproval: res.requires_approval,
        total_amount: _orderTotal,
        order_id: res.order_id || null,
      });
    } else {
      showToast(
        res.message || "Failed to place order",
        "fa-exclamation-circle",
      );
      updateCheckoutButton(getCart().length > 0);
    }
  } catch (e) {
    showToast("Network error. Please try again.", "fa-exclamation-circle");
    updateCheckoutButton(getCart().length > 0);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

function showReceipt(orderNumber, orderType, extra = {}) {
  const modal = document.getElementById("receiptModal");
  const numEl = document.getElementById("receiptOrderNumber");
  const typeEl = document.getElementById("receiptType");
  const titleEl = document.getElementById("receiptTitle");
  const resBadge = document.getElementById("reservationStatus");
  const resDateRow = document.getElementById("receiptResDateRow");
  const resDateEl = document.getElementById("receiptResDate");
  const dpRow = document.getElementById("receiptDownpaymentRow");
  const dpEl = document.getElementById("receiptDownpayment");
  const footerMsg = document.getElementById("receiptFooterMsg");
  const footerSub = document.getElementById("receiptFooterSub");
  const dateEl = document.getElementById("receiptDate");
  const timeEl = document.getElementById("receiptTime");

  const now = new Date();

  if (numEl) numEl.textContent = orderNumber;
  if (typeEl)
    typeEl.textContent =
      orderType === "dine_in"
        ? "Dine In"
        : orderType === "take_out"
          ? "Take Out"
          : "Reservation";
  if (dateEl) dateEl.textContent = now.toLocaleDateString();
  if (timeEl)
    timeEl.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (orderType === "reservation") {
    if (titleEl) titleEl.textContent = "Reservation Submitted!";
    if (resBadge) {
      resBadge.style.display = "flex";
      resBadge.innerHTML =
        '<i class="fas fa-clock"></i> Pending Admin Approval';
    }
    if (resDateRow && extra.reservationDate) {
      resDateRow.style.display = "flex";
      resDateEl.textContent =
        new Date(extra.reservationDate).toLocaleDateString() +
        (extra.reservationTime ? " at " + extra.reservationTime : "");
    }
    if (dpRow && extra.downpayment) {
      dpRow.style.display = "flex";
      dpEl.textContent = "₱" + parseFloat(extra.downpayment).toFixed(2);
    }
    if (footerMsg)
      footerMsg.textContent = "Reservation submitted successfully!";
    if (footerSub)
      footerSub.textContent = "You will receive confirmation once approved.";
  } else {
    if (titleEl) titleEl.textContent = "Order Placed!";
    if (resBadge) resBadge.style.display = "none";
    if (resDateRow) resDateRow.style.display = "none";
    if (dpRow) dpRow.style.display = "none";
    if (footerMsg) footerMsg.textContent = "Thank you for your order!";
    if (footerSub)
      footerSub.textContent = "Please watch the display screen for updates.";
    fetchQueuePosition(orderNumber, document.getElementById("queuePosition"));
  }

  if (modal) modal.classList.add("open");
}

/* ---------- SAVE RECEIPT ---------- */

function saveReceiptImage() {
  const captureEl = document.getElementById("receiptCapture");
  const btn = event.currentTarget;

  if (!captureEl) {
    showToast("Receipt not found", "fa-exclamation-circle");
    return;
  }

  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  setTimeout(async () => {
    try {
      if (typeof html2canvas === "undefined") {
        throw new Error("Screenshot library not loaded");
      }

      await document.fonts.ready;

      const canvas = await html2canvas(captureEl, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      const orderNum =
        document.getElementById("receiptOrderNumber")?.textContent || "order";
      const filename = `QuickServe_${orderNum}.png`;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        const dataUrl = canvas.toDataURL("image/png");
        const newWindow = window.open("", "_blank");

        if (!newWindow || newWindow.closed) {
          showImageModal(dataUrl, filename);
        } else {
          newWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>QuickServe Receipt</title>
                            <style>
                                body { margin:0; padding:20px; background:#f8fafc; text-align:center; font-family:sans-serif; }
                                img { max-width:100%; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.15); }
                                .hint { margin-top:20px; color:#64748b; font-size:14px; line-height:1.6; }
                                .btn { display:inline-block; margin-top:15px; padding:12px 24px; background:#4f46e5; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; }
                            </style>
                        </head>
                        <body>
                            <img src="${dataUrl}" alt="Receipt">
                            <div class="hint">
                                <b>iPhone:</b> Long press image → Save to Photos<br>
                                <b>Android:</b> Long press image → Download image
                            </div>
                            <a href="${dataUrl}" download="${filename}" class="btn">Download</a>
                        </body>
                        </html>
                    `);
          newWindow.document.close();
        }
        showToast("Receipt opened! Long press to save", "fa-mobile-alt");
      } else {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          showToast("Receipt downloaded!", "fa-check-circle");
        }, "image/png");
      }
    } catch (error) {
      console.error(error);
      showToast(
        "Save failed. Please use Print instead.",
        "fa-exclamation-circle",
      );
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }, 100);
}

function showImageModal(dataUrl, filename) {
  const existing = document.getElementById("imageSaveModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "imageSaveModal";
  modal.className = "modal open";
  modal.style.zIndex = "500";
  modal.innerHTML = `
        <div class="modal-content card text-center" style="max-width:90vw;">
            <h3><i class="fas fa-image"></i> Your Receipt</h3>
            <img src="${dataUrl}" style="max-width:100%; border-radius:8px; margin:1rem 0; border:1px solid var(--border);">
            <p class="text-light" style="font-size:0.875rem;">
                <b>iPhone:</b> Long press image → Save to Photos<br>
                <b>Android:</b> Long press image → Download image
            </p>
            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                <a href="${dataUrl}" download="${filename}" class="btn btn-primary" style="flex:1;">
                    <i class="fas fa-download"></i> Download
                </a>
                <button class="btn btn-ghost" onclick="document.getElementById('imageSaveModal').remove()" style="flex:1;">
                    Close
                </button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
}

function printReceipt() {
  const actions = document.querySelector(".receipt-actions");
  if (actions) actions.style.display = "none";
  window.print();
  setTimeout(() => {
    if (actions) actions.style.display = "";
  }, 100);
}

function closeReceipt() {
  document.getElementById("receiptModal")?.classList.remove("open");
  window.location.href = "index.html";
}

/* ---------- QUEUE POSITION ---------- */

async function fetchQueuePosition(orderNumber, element) {
  if (!element) return;
  try {
    const data = await apiGet("queue");
    if (!data.success) {
      element.innerHTML =
        '<i class="fas fa-info-circle"></i> Watch display for updates.';
      return;
    }
    const allActive = [
      ...data.queue.pending,
      ...data.queue.preparing,
      ...data.queue.ready,
    ];
    allActive.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let position = 0;
    for (let i = 0; i < allActive.length; i++) {
      if (allActive[i].order_number === orderNumber) {
        position = i + 1;
        break;
      }
    }

    if (position > 0 && position <= 5) {
      element.innerHTML = `<i class="fas fa-list-ol"></i> Queue position: <strong>#${position}</strong>`;
    } else {
      element.innerHTML =
        '<i class="fas fa-clock"></i> Order received! Watch display for updates.';
    }
  } catch (e) {
    element.innerHTML =
      '<i class="fas fa-info-circle"></i> Watch display for updates.';
  }
}

/* ---------- ADMIN ORDERS ---------- */

async function loadAdminOrders() {
  try {
    const status = document.getElementById("orderFilter")?.value || "";
    const data = await apiGet("orders", status ? { status: status } : {});
    if (data.success) {
      currentOrdersCache = data.orders;
      renderOrdersTable(data.orders);
    }
  } catch (e) {
    console.error("Failed to load orders:", e);
    showToast("Failed to load orders", "fa-exclamation-circle");
  }
}

let currentOrdersCache = [];

// function renderOrdersTable(orders) {
//   const tbody = document.getElementById("ordersTable");
//   if (!tbody) return;

//   if (!orders || orders.length === 0) {
//     tbody.innerHTML =
//       '<tr><td colspan="8" class="text-center text-light">No orders found</td></tr>';
//     return;
//   }

//   tbody.innerHTML = orders
//     .map(
//       (o) => `
//         <tr>
//             <td><strong>${o.order_number}</strong></td>
//             <td>${escapeHtml(o.customer_name)}</td>
//             <td>${getOrderTypeIcon(o.order_type)} ${o.order_type}</td>
//             <td>₱${parseFloat(o.total_amount).toFixed(2)}</td>
//             <td>${getStatusBadge(o.status)}</td>
//             <td>${new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
//             <td>
//                 ${o.reservation_date ? `<small class="text-light">${o.reservation_date}</small>` : "-"}
//             </td>
//             <td>
//                 <button class="btn btn-sm btn-ghost" onclick="viewOrderDetail(${o.id})"><i class="fas fa-eye"></i></button>
//                 ${getAdminActions(o)}
//             </td>
//         </tr>
//     `,
//     )
//     .join("");
// }
function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTable');
    if (!tbody) return;

    // Render bulk-action toolbar above table
    const toolbar = document.getElementById('ordersBulkToolbar');
    if (toolbar) {
        toolbar.innerHTML = `
          <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.75rem">
            <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.85rem">
              <input type="checkbox" id="selectAllOrders" onchange="toggleSelectAllOrders(this.checked)" />
              Select All
            </label>
            <button class="btn btn-sm btn-danger" id="deleteSelectedBtn" onclick="deleteSelectedOrders()" style="display:none">
              <i class="fas fa-trash"></i> Delete Selected
            </button>
          </div>`;
    }

    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-light">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td><input type="checkbox" class="order-select-cb" data-id="${o.id}" onchange="onOrderCheckboxChange()"></td>
            <td><strong>${o.order_number}</strong></td>
            <td>${escapeHtml(o.customer_name)}</td>
            <td>${getOrderTypeIcon(o.order_type)} ${formatOrderType(o.order_type)}</td>
            <td>₱${parseFloat(o.total_amount).toFixed(2)}</td>
            <td>${getStatusBadge(o.status)}</td>
            <td>${new Date(o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
            <td>${o.reservation_date ? `<small class="text-light">${formatDate(o.reservation_date)}</small>` : '-'}</td>
            <td>
                <button class="btn btn-sm btn-ghost" onclick="viewOrderDetail(${o.id})" title="View"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteSingleOrder(${o.id})" title="Delete" style="margin-left:0.2rem"><i class="fas fa-trash"></i></button>
                ${getAdminActions(o)}
            </td>
        </tr>
    `).join('');
}

/* ── Bulk Delete ─────────────────────────────────────── */
function toggleSelectAllOrders(checked) {
    document.querySelectorAll('.order-select-cb').forEach(cb => cb.checked = checked);
    onOrderCheckboxChange();
}
function onOrderCheckboxChange() {
    const anyChecked = document.querySelectorAll('.order-select-cb:checked').length > 0;
    const btn = document.getElementById('deleteSelectedBtn');
    if (btn) btn.style.display = anyChecked ? 'inline-flex' : 'none';
}
async function deleteSingleOrder(id) {
    showConfirmModal('Delete this order permanently?', async () => {
        try {
            const res = await apiDelete('orders', id);
            if (res.success) { showToast('Order deleted', 'fa-trash'); loadAdminOrders(); }
            else showToast(res.message || 'Failed to delete', 'fa-exclamation-circle');
        } catch(e) { showToast('Network error', 'fa-exclamation-circle'); }
    });
}
async function deleteSelectedOrders() {
    const ids = [...document.querySelectorAll('.order-select-cb:checked')].map(cb => parseInt(cb.dataset.id));
    if (!ids.length) return;
    showConfirmModal(`Delete ${ids.length} selected order(s) permanently?`, async () => {
        let failed = 0;
        for (const id of ids) {
            try {
                const res = await apiDelete('orders', id);
                if (!res.success) failed++;
            } catch(e) { failed++; }
        }
        if (failed === 0) showToast(`Deleted ${ids.length} order(s)`, 'fa-trash');
        else showToast(`${ids.length - failed} deleted, ${failed} failed`, 'fa-exclamation-circle');
        loadAdminOrders();
    });
}
/* BUG FIX #1: Proper icon mapping */
function getOrderTypeIcon(type) {
    const icons = {
        'dine_in': '<i class="fas fa-utensils"></i>',
        'take_out': '<i class="fas fa-shopping-bag"></i>',
        'reservation': '<i class="fas fa-calendar-check"></i>'
    };
    return icons[type] || '<i class="fas fa-question-circle"></i>';
}

/* BUG FIX #2: Format order type for display */
function formatOrderType(type) {
    const labels = {
        'dine_in': 'Dine In',
        'take_out': 'Take Out',
        'reservation': 'Reservation'
    };
    return labels[type] || type;
}

/* BUG FIX #3: Proper status badge with colors */
function getStatusBadge(status) {
    const badgeClasses = {
        'pending': 'badge-pending',
        'preparing': 'badge-preparing',
        'ready': 'badge-ready',
        'completed': 'badge-completed',
        'cancelled': 'badge-cancelled',
        'reserved': 'badge-reserved',
        'approved': 'badge-approved',
        'rejected': 'badge-rejected'
    };
    const badgeClass = badgeClasses[status] || 'badge-pending';
    return `<span class="badge ${badgeClass}">${status}</span>`;
}

function getAdminActions(order) {
  // Terminal states: STATUS column already shows badge — no action needed
  if (order.status === "cancelled" || order.status === "completed" || order.status === "rejected") {
    return `<span style="color:var(--text-secondary);font-size:0.85rem">—</span>`;
  }
  if (order.status === "reserved") {
    return `
      <select class="form-select" onchange="handleReservationAction(${order.id}, this.value)" style="min-width:130px;display:inline-block;width:auto;">
        <option value="">Action...</option>
        <option value="approved">✓ Approve</option>
        <option value="rejected">✗ Reject</option>
      </select>`;
  }
  if (order.status === "approved") {
    return `<span class="badge badge-approved"><i class="fas fa-check"></i> Approved</span>`;
  }
  // Active orders: pending → preparing → ready
  const statuses = [
    { v: "pending",   l: "Pending" },
    { v: "preparing", l: "Preparing" },
    { v: "ready",     l: "Ready" },
    { v: "completed", l: "Complete" },
    { v: "cancelled", l: "Cancel" },
  ];
  return `
    <select class="form-select" onchange="updateOrderStatus(${order.id}, this.value)" style="min-width:130px;display:inline-block;width:auto;">
      ${statuses.map(s => `<option value="${s.v}" ${order.status === s.v ? "selected" : ""}>${s.l}</option>`).join("")}
    </select>`;
}

/* ---------- CONFIRMATION MODAL ---------- */

function showConfirmModal(message, onConfirm, onCancel) {
  // Remove existing modal
  const existing = document.getElementById("confirmModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "confirmModal";
  modal.className = "modal open";
  modal.style.zIndex = "600";
  modal.innerHTML = `
        <div class="modal-content card text-center" style="max-width: 400px;">
            <div style="font-size: 3rem; color: var(--primary); margin-bottom: 1rem;">
                <i class="fas fa-question-circle"></i>
            </div>
            <h3>Confirm Action</h3>
            <p style="margin: 1rem 0; color: var(--text-secondary);">${message}</p>
            <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                <button class="btn btn-ghost" id="confirmCancel" style="flex: 1;">
                    <i class="fas fa-times"></i> Cancel
                </button>
                <button class="btn btn-primary" id="confirmOk" style="flex: 1;">
                    <i class="fas fa-check"></i> Confirm
                </button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  document.getElementById("confirmOk").addEventListener("click", () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });

  document.getElementById("confirmCancel").addEventListener("click", () => {
    modal.remove();
    if (onCancel) onCancel();
  });

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onCancel) onCancel();
    }
  });
}

/* ---------- RESERVATION ACTIONS ---------- */

window.handleReservationAction = async function (id, action) {
  if (!action) return;

  if (action === "approved") {
    try {
      const res = await apiPut("orders", { id: id, status: "approved" });
      if (res.success) { showToast("Reservation approved", "fa-check-circle"); loadAdminOrders(); }
      else { showToast(res.message || "Failed to approve", "fa-exclamation-circle"); loadAdminOrders(); }
    } catch (e) { showToast("Network error", "fa-exclamation-circle"); loadAdminOrders(); }
    return;
  }

  if (action === "rejected") {
    // Inline modal — avoids browser prompt() which is blocked on mobile WebViews
    const old = document.getElementById("rejectReasonModal");
    if (old) old.remove();
    const modal = document.createElement("div");
    modal.id = "rejectReasonModal";
    modal.className = "modal open";
    modal.style.zIndex = "600";
    modal.innerHTML = `
      <div class="modal-content card" style="max-width:420px">
        <h3 style="margin-bottom:1rem"><i class="fas fa-times-circle" style="color:var(--danger)"></i> Reject Reservation</h3>
        <p style="color:var(--text-secondary);margin-bottom:1rem;font-size:0.9rem">Optionally provide a reason for the customer.</p>
        <textarea id="rejectReasonInput" class="form-input" rows="3" placeholder="Reason (optional)..." style="width:100%;margin-bottom:1rem;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:0.5rem">
          <button class="btn btn-ghost" id="rejectCancelBtn" style="flex:1"><i class="fas fa-arrow-left"></i> Back</button>
          <button class="btn btn-danger" id="rejectConfirmBtn" style="flex:1"><i class="fas fa-times"></i> Reject</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById("rejectCancelBtn").addEventListener("click", () => { modal.remove(); loadAdminOrders(); });
    document.getElementById("rejectConfirmBtn").addEventListener("click", async () => {
      const notes = document.getElementById("rejectReasonInput").value.trim();
      modal.remove();
      try {
        const payload = { id: id, status: "rejected" };
        if (notes) payload.admin_notes = notes;
        const res = await apiPut("orders", payload);
        if (res.success) { showToast("Reservation rejected", "fa-check-circle"); loadAdminOrders(); }
        else { showToast(res.message || "Failed", "fa-exclamation-circle"); loadAdminOrders(); }
      } catch (e) { showToast("Network error", "fa-exclamation-circle"); loadAdminOrders(); }
    });
    modal.addEventListener("click", e => { if (e.target === modal) { modal.remove(); loadAdminOrders(); } });
  }
};

window.viewOrderDetail = function (id) {
  const order = currentOrdersCache.find((o) => o.id === id);
  if (!order) {
    apiGet("orders").then((res) => {
      if (res.success) {
        currentOrdersCache = res.orders;
        const found = res.orders.find((o) => o.id === id);
        if (found) displayOrderDetail(found);
        else showToast("Order not found", "fa-exclamation-circle");
      }
    });
    return;
  }
  displayOrderDetail(order);
};

function displayOrderDetail(order) {
  const modal = document.getElementById("orderDetailModal");
  if (!modal) return;

  document.getElementById("detailOrderNum").textContent = order.order_number;
  document.getElementById("detailCustomer").textContent = escapeHtml(
    order.customer_name,
  );
  document.getElementById("detailType").innerHTML =
    getOrderTypeIcon(order.order_type) + " " + order.order_type;
  document.getElementById("detailStatus").innerHTML = getStatusBadge(
    order.status,
  );
  document.getElementById("detailTotal").textContent =
    "₱" + parseFloat(order.total_amount).toFixed(2);
  document.getElementById("detailTime").textContent = new Date(
    order.created_at,
  ).toLocaleString();

  const resInfo = document.getElementById("detailReservationInfo");
  if (resInfo) {
    if (order.order_type === "reservation") {
      resInfo.style.display = "block";
      document.getElementById("detailResDate").textContent =
        order.reservation_date || "-";
      document.getElementById("detailResTime").textContent =
        order.reservation_time || "-";
      document.getElementById("detailDownpayment").textContent =
        "₱" + parseFloat(order.downpayment_paid || 0).toFixed(2);
      document.getElementById("detailBalance").textContent =
        "₱" +
        (
          parseFloat(order.total_amount) -
          parseFloat(order.downpayment_paid || 0)
        ).toFixed(2);
      document.getElementById("detailAdminNotes").textContent =
        order.admin_notes || "-";
    } else {
      resInfo.style.display = "none";
    }
  }

  const itemsContainer = document.getElementById("detailItems");
  if (order.items && order.items.length > 0) {
    itemsContainer.innerHTML = order.items
      .map(
        (item) => `
            <div class="order-item-row">
                <div>
                    <div class="item-name">${escapeHtml(item.product_name)}</div>
                    <div class="item-qty">₱${parseFloat(item.price).toFixed(2)} x ${item.quantity}</div>
                </div>
                <div class="item-total">₱${parseFloat(item.subtotal).toFixed(2)}</div>
            </div>
        `,
      )
      .join("");
  } else {
    itemsContainer.innerHTML = '<p class="text-light text-center">No items</p>';
  }

  modal.classList.add("open");
}

window.closeOrderDetail = function () {
  document.getElementById("orderDetailModal")?.classList.remove("open");
};

async function updateOrderStatus(id, status) {
  showConfirmModal(
    `Change order status to "${status}"?`,
    async () => {
      try {
        const res = await apiPut("orders", { id: id, status: status });
        if (res.success) {
          showToast(`Order updated to ${status}`, "fa-check-circle");
          loadAdminOrders();
        } else {
          showToast("Failed to update status", "fa-exclamation-circle");
          loadAdminOrders();
        }
      } catch (e) {
        showToast("Error updating order", "fa-exclamation-circle");
        loadAdminOrders();
      }
    },
    () => {
      loadAdminOrders(); // Reset dropdown
    },
  );
}
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString();
}

// Expose for user.html receipt intercept
window._showReceiptImpl = showReceipt;
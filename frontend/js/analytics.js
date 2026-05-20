let charts = {};

// loadAnalytics() is called by showTab('analytics') in app.js when the tab is clicked.
// Do NOT auto-load on DOMContentLoaded — analytics.php requires admin session and
// running it at page load causes Unauthorized errors before session is confirmed.

async function loadAnalytics() {
  try {
    const data = await apiGet("analytics");
    if (data.success) {
      renderDailySalesChart(data.daily_sales);
      renderWeeklyChart(data.weekly_revenue);
      renderPopularChart(data.popular_products);
      renderHourlyChart(data.hourly_today);
      renderStatusSummary(data.status_summary);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderDailySalesChart(sales) {
  const ctx = document.getElementById("dailySalesChart");
  if (!ctx) return;

  if (charts.daily) charts.daily.destroy();

  const labels = sales.map((s) =>
    new Date(s.date).toLocaleDateString(undefined, { weekday: "short" }),
  );
  const values = sales.map((s) => parseFloat(s.total));

  charts.daily = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.length ? labels : ["No Data"],
      datasets: [
        {
          label: "Revenue (₱)",
          data: values.length ? values : [0],
          backgroundColor: "rgba(79, 70, 229, 0.8)",
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderWeeklyChart(weeks) {
  const ctx = document.getElementById("weeklyRevenueChart");
  if (!ctx) return;
  if (charts.weekly) charts.weekly.destroy();

  charts.weekly = new Chart(ctx, {
    type: "line",
    data: {
      labels: weeks.map((w) => w.label),
      datasets: [
        {
          label: "Weekly Revenue",
          data: weeks.map((w) => parseFloat(w.total)),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#10b981",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderPopularChart(products) {
  const ctx = document.getElementById("popularProductsChart");
  if (!ctx) return;
  if (charts.popular) charts.popular.destroy();

  charts.popular = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: products.map((p) => p.name),
      datasets: [
        {
          data: products.map((p) => parseInt(p.total_qty)),
          backgroundColor: [
            "#4f46e5",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#3b82f6",
            "#8b5cf6",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { usePointStyle: true, padding: 16 },
        },
      },
      cutout: "65%",
    },
  });
}

function renderHourlyChart(hours) {
  const ctx = document.getElementById("hourlyChart");
  if (!ctx) return;
  if (charts.hourly) charts.hourly.destroy();

  const allHours = Array.from({ length: 12 }, (_, i) => i + 8); // 8AM to 7PM
  const hourMap = {};
  hours.forEach((h) => (hourMap[parseInt(h.hour)] = parseInt(h.count)));
  const data = allHours.map((h) => hourMap[h] || 0);
  const labels = allHours.map(
    (h) => `${h > 12 ? h - 12 : h}${h >= 12 ? "PM" : "AM"}`,
  );

  charts.hourly = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Orders",
          data: data,
          backgroundColor: "rgba(245, 158, 11, 0.8)",
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderStatusSummary(summary) {
  const container = document.getElementById("statusSummary");
  if (!container) return;
  container.innerHTML = summary
    .map(
      (s) => `
        <div class="stat-card ${s.status === "pending" ? "warning" : s.status === "ready" ? "secondary" : s.status === "completed" ? "info" : "primary"}">
            <div class="stat-icon"><i class="fas fa-${s.status === "pending" ? "clock" : s.status === "preparing" ? "fire" : s.status === "ready" ? "check" : s.status === "completed" ? "flag-checkered" : "ban"}"></i></div>
            <div class="stat-value">${s.count}</div>
            <div class="stat-label">${s.status}</div>
        </div>
    `,
    )
    .join("");
}
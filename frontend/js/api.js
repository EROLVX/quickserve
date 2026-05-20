const API_BASE = "../backend/api";

async function apiGet(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(
    `${API_BASE}/${endpoint}.php${query ? "?" + query : ""}`,
  );
  return res.json();
}

async function apiPost(endpoint, data) {
  const res = await fetch(`${API_BASE}/${endpoint}.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function apiPostForm(endpoint, formData) {
  const res = await fetch(`${API_BASE}/${endpoint}.php`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

async function apiPut(endpoint, data) {
  const res = await fetch(`${API_BASE}/${endpoint}.php`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function apiDelete(endpoint, id) {
  const res = await fetch(`${API_BASE}/${endpoint}.php?id=${id}`, {
    method: "DELETE",
  });
  return res.json();
}

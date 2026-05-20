// document.addEventListener('DOMContentLoaded', () => {
//     if (document.getElementById('loginForm')) {
//         document.getElementById('loginForm').addEventListener('submit', handleLogin);
//     }
//     checkSession();
// });

// async function handleLogin(e) {
//     e.preventDefault();
//     const username = document.getElementById('username').value;
//     const password = document.getElementById('password').value;
//     const err = document.getElementById('loginError');

//     try {
//         const res = await apiPost('login', { username, password });
//         if (res.success) {
//             localStorage.setItem('qs_user', JSON.stringify(res.user));
//             window.location.href = 'admin.html';
//         } else {
//             if (err) err.textContent = res.message || 'Invalid credentials';
//         }
//     } catch (e) {
//         if (err) err.textContent = 'Network error. Please try again.';
//     }
// }

// async function checkSession() {
//     try {
//         const res = await apiGet('login');
//         if (res.success) {
//             localStorage.setItem('qs_user', JSON.stringify(res.user));
//             const display = document.getElementById('userDisplay');
//             if (display) display.textContent = res.user.username;
//         } else {
//             localStorage.removeItem('qs_user');
//             if (document.body.classList.contains('admin-page')) {
//                 window.location.href = 'login.html';
//             }
//         }
//     } catch (e) {
//         localStorage.removeItem('qs_user');
//         if (document.body.classList.contains('admin-page')) {
//             window.location.href = 'login.html';
//         }
//     }
// }

// function logout() {
//     localStorage.removeItem('qs_user');
//     fetch('../backend/api/logout.php').then(() => {
//         window.location.href = 'login.html';
//     }).catch(() => {
//         window.location.href = 'login.html';
//     });
// }
// ============================================================
// auth.js — QuickServe Authentication (Frontend)
// Handles login form submission, session checking, and logout
// Loaded on: login.html, admin.html, user.html
// Dependencies: api.js (for apiGet, apiPost)
// ============================================================

/**
 * DOMContentLoaded listener
 * Runs when page HTML is fully loaded
 * Attaches login form handler if on login page
 * Always verifies current session status
 */
document.addEventListener('DOMContentLoaded', () => {
    // Only attach login handler if login form exists (login.html)
    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
    }
    // Always check session — redirects to login if admin page and not logged in
    checkSession();
});

/**
 * handleLogin(e)
 * Processes login form submission
 * Sends credentials to login.php via POST
 * On success: stores user in localStorage, redirects based on role
 * On failure: displays error message
 * @param {Event} e — Form submit event (preventDefault stops page reload)
 */
async function handleLogin(e) {
    e.preventDefault(); // Prevent default form submission

    // Disable button to prevent double-submit
    const btn = document.getElementById('loginBtn');
    const origText = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...'; }

    // Show error — works with both showAlert() (login.html) and #loginError fallback
    function showLoginError(msg) {
        if (typeof showAlert === 'function') {
            showAlert(msg, 'error');
        } else {
            const err = document.getElementById('loginError');
            if (err) { err.textContent = msg; err.style.display = 'block'; }
        }
    }

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showLoginError('Please enter your username and password.');
        if (btn) { btn.disabled = false; btn.innerHTML = origText; }
        return;
    }

    try {
        const res = await apiPost('login', { username, password });

        if (res.success) {
            localStorage.setItem('qs_user', JSON.stringify(res.user));
            // Redirect based on role
            if (res.user.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'user.html';
            }
        } else {
            showLoginError(res.message || 'Invalid username or password');
            if (btn) { btn.disabled = false; btn.innerHTML = origText; }
        }
    } catch (err) {
        showLoginError('Network error. Check your connection and try again.');
        if (btn) { btn.disabled = false; btn.innerHTML = origText; }
    }
}

/**
 * checkSession()
 * Validates current PHP session by calling login.php via GET
 * On valid session: refreshes localStorage user data, updates header display
 * On invalid session: clears localStorage, forces redirect if on admin page
 * Called on every page load to maintain auth state
 */
async function checkSession() {
    try {
        // GET request to check if PHP session is active
        const res = await apiGet('login');

        if (res.success) {
            // Session valid — update stored user data
            localStorage.setItem('qs_user', JSON.stringify(res.user));

            // Update username display in admin header if element exists
            const display = document.getElementById('userDisplay');
            if (display) display.textContent = res.user.full_name || res.user.username;

            // Guard: only admins may use admin.html — redirect customers away
            if (document.body.classList.contains('admin-page') && res.user.role !== 'admin') {
                window.location.href = 'user.html';
            }
        } else {
            // Session expired or invalid
            localStorage.removeItem('qs_user');

            // Force redirect to login if on admin page (protected route)
            if (document.body.classList.contains('admin-page')) {
                window.location.href = 'login.html';
            }
        }
    } catch (e) {
        // Network error — treat as logged out
        localStorage.removeItem('qs_user');
        if (document.body.classList.contains('admin-page')) {
            window.location.href = 'login.html';
        }
    }
}

/**
 * logout()
 * Destroys user session and redirects to login page
 * Steps: clear localStorage → call logout.php → redirect to login
 * Called by: Logout button in admin.html and user.html headers
 */
function logout() {
    localStorage.removeItem('qs_user');
    // Use API_BASE so path is correct regardless of which page calls logout
    fetch(API_BASE + '/auth.php?action=logout')
        .then(() => { window.location.href = 'login.html'; })
        .catch(() => { window.location.href = 'login.html'; });
}
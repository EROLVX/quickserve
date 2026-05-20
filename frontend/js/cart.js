const CART_KEY = 'qs_cart';

function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
}
function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function addToCart(product) {
    const cart = getCart();
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
        existing.quantity += product.quantity || 1;
    } else {
        cart.push({ ...product, quantity: product.quantity || 1 });
    }
    saveCart(cart);
    updateCartBadge();
}
function removeFromCart(id) {
    const cart = getCart().filter(i => i.id !== id);
    saveCart(cart);
    updateCartBadge();
}
function updateQuantity(id, delta) {
    const cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
        removeFromCart(id);
        return;
    }
    saveCart(cart);
    updateCartBadge();
}
function clearCart() {
    localStorage.removeItem(CART_KEY);
    updateCartBadge();
}
function getCartTotal() {
    return getCart().reduce((sum, i) => sum + (i.price * i.quantity), 0);
}
function getCartCount() {
    return getCart().reduce((sum, i) => sum + i.quantity, 0);
}
function updateCartBadge() {
    const badges = document.querySelectorAll('.cart-count');
    const count = getCartCount();
    badges.forEach(b => {
        b.textContent = count;
        b.style.display = count > 0 ? 'flex' : 'none';
    });
}
let previousReady = new Set();

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('queueContainer')) {
        loadQueue();
        setInterval(loadQueue, 5000);
    }
});

async function loadQueue() {
    try {
        const data = await apiGet('queue');
        if (data.success) renderQueue(data.queue);
    } catch (e) { console.error(e); }
}

function renderQueue(queue) {
    const pCol = document.getElementById('pendingCol');
    const prCol = document.getElementById('preparingCol');
    const rCol = document.getElementById('readyCol');
    
    if (pCol) pCol.innerHTML = queue.pending.map(o => createQueueCard(o, 'pending')).join('');
    if (prCol) prCol.innerHTML = queue.preparing.map(o => createQueueCard(o, 'preparing')).join('');
    
    const currentReady = new Set(queue.ready.map(o => o.id));
    const newReady = queue.ready.filter(o => !previousReady.has(o.id));
    
    if (newReady.length > 0 && previousReady.size > 0) {
        playNotificationSound();
        announceOrder(newReady[0].order_number);
    }
    previousReady = currentReady;
    
    if (rCol) rCol.innerHTML = queue.ready.map(o => createQueueCard(o, 'ready')).join('');
}

function createQueueCard(order, type) {
    const typeIcon = order.order_type === 'dine_in' ? 'fa-utensils' : 'fa-shopping-bag';
    return `
        <div class="queue-card ${type} animate-fade-in">
            <div class="q-num">${order.order_number}</div>
            <div class="q-type"><i class="fas ${typeIcon}"></i> ${order.order_type === 'dine_in' ? 'Dine In' : 'Take Out'}</div>
            <div class="q-time"><i class="far fa-clock"></i> ${new Date(order.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
    `;
}

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
}

function announceOrder(orderNumber) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(
            `Calling attention to Order Number ${orderNumber}. Please claim your order at the counter.`
        );
        msg.rate = 0.9; msg.pitch = 1;
        window.speechSynthesis.speak(msg);
    }
}
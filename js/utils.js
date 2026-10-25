// ==========================================================================
// GATE-WAY Helper Utilities & SVG Icons
// ==========================================================================

// Haversine formula for distance calculation
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toMillis(value) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') return new Date(value).getTime();
    if (typeof value.toMillis === 'function') return value.toMillis();
    return new Date(value).getTime();
}

// Smart Priority Scoring Engine
export function calculatePriorityScore(listing, ngoLocation, ngoCapacity) {
    const listLat = listing?.location?.lat ?? listing?.latitude ?? 0;
    const listLng = listing?.location?.lng ?? listing?.longitude ?? 0;
    const ngoLat = ngoLocation?.lat ?? ngoLocation?.latitude ?? 0;
    const ngoLng = ngoLocation?.lng ?? ngoLocation?.longitude ?? 0;
    const distance = calculateDistance(listLat, listLng, ngoLat, ngoLng);
    
    const now = Date.now();
    const expiryTime = toMillis(listing?.expiryTime);
    const hoursRemaining = Math.max(0, (expiryTime - now) / (1000 * 60 * 60));
    
    // Scoring weights
    const distanceScore = Math.max(0, 100 - (distance * 10)); // Closer = higher
    const urgencyScore = Math.max(0, 100 - (hoursRemaining * 25)); // Less time = higher
    const quantityScore = Math.min(100, ((Number(listing?.quantity) || 0) / (ngoCapacity || 50)) * 100); // Match capacity
    const recurringBonus = listing?.isRecurring ? 20 : 0;
    
    // Weighted formula
    const totalScore = (
        distanceScore * 0.35 +
        urgencyScore * 0.40 +
        quantityScore * 0.25 +
        recurringBonus
    );
    
    return {
        score: Math.round(totalScore),
        distance: distance.toFixed(1),
        hoursRemaining: hoursRemaining.toFixed(1)
    };
}

// Countdown timer
export function getTimeRemaining(expiryTimestamp) {
    const now = Date.now();
    const expiry = toMillis(expiryTimestamp);
    const diff = expiry - now;
    
    if (diff <= 0) return { expired: true, text: 'EXPIRED', urgent: true };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
        expired: false,
        text: `${hours}h ${minutes}m`,
        urgent: hours < 2
    };
}

// Impact calculations
export function calculateImpact(kg) {
    return {
        meals: kg * 2,
        co2: (kg * 2.5).toFixed(1)
    };
}

// Format timestamp
export function formatDate(timestamp) {
    return new Date(toMillis(timestamp)).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==========================================================================
// TOAST NOTIFICATION SYSTEM
// ==========================================================================

export function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = getIcon('info');
    if (type === 'success') iconSvg = getIcon('check');
    if (type === 'error') iconSvg = getIcon('x');
    if (type === 'warning') iconSvg = getIcon('alertCircle');

    toast.innerHTML = `
        <div style="color: currentColor;">${iconSvg}</div>
        <div style="flex: 1; font-size: 0.9rem; font-weight: 500;">${message}</div>
        <button style="background:none; border:none; color:var(--text-muted); cursor:pointer;" onclick="this.parentElement.remove()">
            ${getIcon('x', '', 14)}
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

// Global alert override helper
if (typeof window !== 'undefined') {
    window.showToast = showToast;
}

// ==========================================================================
// THEME MANAGEMENT (DARK MODE)
// ==========================================================================

export function initTheme() {
    if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;
    const savedTheme = localStorage.getItem('gateway_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcons(savedTheme);
}

export function toggleTheme() {
    if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('gateway_theme', nextTheme);
    updateThemeToggleIcons(nextTheme);
}

function updateThemeToggleIcons(theme) {
    if (typeof document === 'undefined') return;
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
        btn.innerHTML = theme === 'dark' ? getIcon('sun', '', 18) : getIcon('moon', '', 18);
        btn.setAttribute('title', `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`);
    });
}

if (typeof window !== 'undefined') {
    window.toggleTheme = toggleTheme;
}

// ==========================================================================
// MODAL HELPERS
// ==========================================================================

export function openModal(modalId) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    modal.classList.remove('hidden');
}

export function closeModal(modalId) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    modal.classList.add('hidden');
}

if (typeof window !== 'undefined') {
    window.openModal = openModal;
    window.closeModal = closeModal;
}

// Setup modal backdrop clicks
if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
            e.target.classList.add('hidden');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => {
                m.classList.remove('active');
                m.classList.add('hidden');
            });
        }
    });
}

// ==========================================================================
// VECTOR SVG ICON SYSTEM (Lightweight Lucide Equivalents)
// ==========================================================================

export function getIcon(name, extraClass = '', size = 20) {
    const icons = {
        utensils: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M12 2v20"/><path d="M18 11v11"/><path d="M6 2v20"/></svg>`,
        handshake: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4l-3-3"/><path d="m14 14 2.5 2.5"/><path d="M22 22 17.5 17.5"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3"/><path d="M11 7 8.5 4.5a1 1 0 0 0-1.4 0L2.8 8.8a1 1 0 0 0 0 1.4l4.3 4.3a1 1 0 0 0 1.4 0L11 12.5"/></svg>`,
        bike: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`,
        leaf: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M11 20A60.4 60.4 0 0 1 2 2a60.4 60.4 0 0 1 18 9 17.6 17.6 0 0 1-9 9z"/><path d="M2 2l18 18"/></svg>`,
        shield: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
        clock: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        box: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
        mapPin: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
        search: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        filter: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
        check: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><polyline points="20 6 9 17 4 12"/></svg>`,
        x: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        upload: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
        download: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        fileText: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
        user: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        logout: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
        sun: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
        moon: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
        alertCircle: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        info: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        building: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
        phone: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${extraClass}"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
    };
    return icons[name] || icons.info;
}

// ==========================================================================
// RENDER HELPERS: SKELETONS & EMPTY STATES
// ==========================================================================

export function renderSkeletonListings(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = Array(count).fill(0).map(() => `
        <div class="card" style="margin-bottom: 16px;">
            <div class="skeleton" style="height: 24px; width: 60%; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 16px; width: 40%; margin-bottom: 8px;"></div>
            <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 16px;"></div>
            <div class="skeleton" style="height: 36px; width: 100%;"></div>
        </div>
    `).join('');
}

export function renderEmptyState(containerId, iconName, title, desc, actionHtml = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">${getIcon(iconName, '', 28)}</div>
            <h4 class="empty-state-title">${title}</h4>
            <p class="empty-state-desc">${desc}</p>
            ${actionHtml}
        </div>
    `;
}

export function animateCounter(element, target, duration = 1000) {
    if (!element) return;
    const start = 0;
    const end = parseFloat(target) || 0;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = start + (end - start) * progress;
        element.textContent = end % 1 === 0 ? Math.round(current) : current.toFixed(1);
        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

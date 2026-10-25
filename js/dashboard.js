import { getImpactStats, getRecentCompleted, getCityStats } from './api.js';
import { animateCounter, initTheme, toggleTheme, getIcon, renderEmptyState } from './utils.js';

// Initialize Theme
initTheme();
window.toggleTheme = toggleTheme;

async function initDashboard() {
    await loadImpactStats();
    await loadRecentActivity();
    await loadCityStats();
}

async function loadImpactStats() {
    try {
        const data = await getImpactStats();
        const totalKgEl = document.getElementById('totalKg');
        const totalMealsEl = document.getElementById('totalMeals');
        const totalCO2El = document.getElementById('totalCO2');
        const carbonMsg = document.getElementById('carbonMessage');

        const kgSaved = data.totalKgSaved || 0;
        const mealsServed = data.totalMeals || 0;
        const co2Prevented = data.totalCO2Prevented || 0;

        if (totalKgEl) animateCounter(totalKgEl, kgSaved, 1200);
        if (totalMealsEl) animateCounter(totalMealsEl, mealsServed, 1200);
        if (totalCO2El) animateCounter(totalCO2El, co2Prevented, 1200);

        if (carbonMsg) {
            carbonMsg.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    ${getIcon('leaf', '', 24)}
                    <span>By redistributing <strong>${kgSaved} kg</strong> of surplus food, our network has diverted <strong>${Number(co2Prevented).toFixed(1)} kg</strong> of CO₂ emissions from landfills!</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading impact stats:', error);
    }
}

async function loadRecentActivity() {
    try {
        const listings = await getRecentCompleted();
        const container = document.getElementById('recentActivity');
        if (!container) return;

        if (!listings || listings.length === 0) {
            renderEmptyState('recentActivity', 'check', 'No Completed Pickups Yet', 'Completed food redistributions will appear here in real-time.');
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${listings.map((data) => `
                    <div style="padding: 14px 18px; background: var(--bg-subtle); border-radius: var(--radius-md); border-left: 4px solid var(--primary-600); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 38px; height: 38px; background: var(--primary-50); color: var(--primary-600); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                ${getIcon('check', '', 18)}
                            </div>
                            <div>
                                <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${data.foodType || 'Surplus Food'}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                                    <span>🏢 Donor: <strong>${data.donorName || 'Donor'}</strong></span>
                                    <span>•</span>
                                    <span>🤝 Recipient: <strong>${data.acceptedBy || 'NGO/Volunteer'}</strong></span>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="badge badge-available" style="font-size: 0.8rem;">📦 ${Number(data.quantity || 0)} kg</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${data.completedAt ? new Date(data.completedAt).toLocaleDateString() : 'Recently'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

async function loadCityStats() {
    try {
        const cities = await getCityStats();
        const cityStats = document.getElementById('cityStats');
        if (!cityStats) return;

        if (!cities || cities.length === 0) {
            renderEmptyState('cityStats', 'mapPin', 'No City Data Yet', 'City redistribution metrics update as food is saved.');
            return;
        }

        const maxKg = Math.max(...cities.map(c => c.kg || 1));

        cityStats.innerHTML = `
            <div class="city-bar-chart">
                ${cities.map((city) => {
                    const percentage = Math.min(100, Math.round((city.kg / maxKg) * 100));
                    return `
                        <div class="city-bar-item">
                            <div class="city-bar-header">
                                <span style="display:flex; align-items:center; gap:6px; color:var(--text-main); font-weight:600;">
                                    ${getIcon('mapPin', '', 14)} ${city.city}
                                </span>
                                <span style="color:var(--primary-600); font-weight:700;">${city.kg} kg (${city.count} listings)</span>
                            </div>
                            <div class="city-bar-track">
                                <div class="city-bar-fill" style="width: ${percentage}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading city statistics:', error);
    }
}

initDashboard();

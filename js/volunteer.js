import { 
    getCurrentUser, 
    getVolunteerListings, 
    acceptListing, 
    completeListing, 
    getVolunteerAcceptedListings, 
    getVolunteerImpact, 
    clearToken 
} from './api.js';
import { getTimeRemaining, showToast, initTheme, toggleTheme, openModal, closeModal, renderEmptyState } from './utils.js';

initTheme();
window.toggleTheme = toggleTheme;

let userData = null;
let rawAcceptedListings = [];
let currentPodListing = null;

async function initVolunteer() {
    try {
        const { user } = await getCurrentUser();
        if (user.role !== 'volunteer') {
            return window.location.href = 'index.html';
        }

        userData = user;
        updateUserUI();
        setupSidebarAndMobileNav();
        
        await loadAvailableListings();
        await loadAcceptedListings();
        await loadVolunteerImpact();
    } catch (error) {
        window.location.href = 'index.html';
    }
}

function updateUserUI() {
    if (!userData) return;
    const nameStr = userData.name || 'Hero';
    document.getElementById('userNameHeader').textContent = nameStr;
    document.getElementById('sidebarUserName').textContent = nameStr;
    document.getElementById('avatarInitial').textContent = nameStr.charAt(0).toUpperCase();
}

function setupSidebarAndMobileNav() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('appSidebar');

    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
    });

    const logoutBtns = [document.getElementById('logoutBtn'), document.getElementById('logoutBtnNav')];
    logoutBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                clearToken();
                showToast('Logged out successfully', 'info');
                setTimeout(() => window.location.href = 'index.html', 400);
            });
        }
    });

    window.openProfileModal = () => {
        const body = document.getElementById('profileModalBody');
        if (body && userData) {
            body.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.9rem;">
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Volunteer Name:</strong> ${userData.name}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Email:</strong> ${userData.email}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Phone:</strong> ${userData.phone}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Address:</strong> ${userData.location.address}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Account Status:</strong> <span class="badge badge-priority">Active Volunteer</span>
                    </div>
                </div>
            `;
        }
        openModal('profileModal');
    };

    window.closeProfileModal = () => closeModal('profileModal');
}

async function loadAvailableListings() {
    try {
        const listings = await getVolunteerListings();
        const container = document.getElementById('availableListings');
        if (!container) return;

        document.getElementById('availableCount').textContent = listings.length;

        if (!listings.length) {
            renderEmptyState('availableListings', 'bike', 'No Volunteer Pickups Available Right Now', 'Listings become eligible for volunteer pickup after being listed for 30+ minutes without NGO acceptance.');
            return;
        }

        container.innerHTML = listings.map((data) => {
            const timeInfo = getTimeRemaining(data.expiryTime);
            return `
                <div class="listing-card ${timeInfo.urgent ? 'urgent' : ''}">
                    <div class="listing-card-header">
                        <div class="listing-food-title">${data.foodType}</div>
                        <span class="badge badge-available">ELIGIBLE VOLUNTEER</span>
                    </div>

                    <div class="listing-details-list">
                        <div class="detail-pill">📦 ${data.quantity} kg</div>
                        <div class="detail-pill countdown-box ${timeInfo.urgent ? '' : 'safe'}">⏰ ${timeInfo.text}</div>
                        <div class="detail-pill">🏢 ${data.donorName}</div>
                    </div>

                    <div style="font-size: 0.85rem; color: var(--text-muted);">📍 ${data.location.address}</div>

                    <div style="margin-top: 8px;">
                        <button type="button" class="btn btn-primary" style="width: 100%;" onclick="window.acceptListingAction('${data.id}')">
                            Accept Food Pickup
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading volunteer listings:', error);
    }
}

window.acceptListingAction = async (listingId) => {
    try {
        await acceptListing(listingId);
        showToast('Pickup accepted! Thank you for your service.', 'success');
        await loadAvailableListings();
        await loadAcceptedListings();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
};

async function loadAcceptedListings() {
    try {
        const listings = await getVolunteerAcceptedListings();
        rawAcceptedListings = listings;
        const container = document.getElementById('acceptedListings');
        if (!container) return;

        if (!listings.length) {
            renderEmptyState('acceptedListings', 'check', 'No Accepted Pickups', 'Food listings you accept for transport will be listed here.');
            return;
        }

        container.innerHTML = listings.map((data) => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 12px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;">
                <div>
                    <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${data.foodType}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 12px;">
                        <span>📦 ${data.quantity} kg</span>
                        <span>🏢 ${data.donorName}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">📍 ${data.location.address}</div>
                </div>

                <div>
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.completeListingAction('${data.id}')">
                        ✓ Complete Delivery & PoD
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading accepted listings:', error);
    }
}

window.completeListingAction = (listingId) => {
    const listing = rawAcceptedListings.find(l => String(l.id) === String(listingId));
    if (!listing) return;
    currentPodListing = listing;

    const titleEl = document.getElementById('podFoodTitle');
    const metaEl = document.getElementById('podFoodMeta');
    const benInput = document.getElementById('podBeneficiariesInput');
    const notesInput = document.getElementById('podNotesInput');
    const codeDisplay = document.getElementById('podProofCodeDisplay');
    const errEl = document.getElementById('podErrorMsg');

    if (titleEl) titleEl.textContent = listing.foodType;
    if (metaEl) metaEl.textContent = `🏢 ${listing.donorName || 'Donor'} • 📦 ${listing.quantity} kg • 📍 ${listing.address || listing.location?.address || 'Designated Pickup'}`;
    const defaultMeals = Math.round(Number(listing.quantity || 0) * 2);
    if (benInput) benInput.value = defaultMeals || 25;
    if (notesInput) notesInput.value = '';
    const generatedCode = `POD-${listing.id}-${Date.now().toString(36).toUpperCase()}`;
    if (codeDisplay) codeDisplay.textContent = generatedCode;
    if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
    }

    openModal('podModal');
};

window.closePodModal = () => {
    closeModal('podModal');
    currentPodListing = null;
};

window.submitPodCompletion = async () => {
    if (!currentPodListing) return;
    const confirmBtn = document.getElementById('confirmPodBtn');
    const benInput = document.getElementById('podBeneficiariesInput');
    const notesInput = document.getElementById('podNotesInput');
    const codeDisplay = document.getElementById('podProofCodeDisplay');
    const errEl = document.getElementById('podErrorMsg');

    const beneficiariesServed = Number(benInput?.value) || 0;
    const deliveryNotes = notesInput?.value.trim() || 'Food verified and delivered safely to shelter.';
    const proofCode = codeDisplay?.textContent.trim();

    try {
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Settling Delivery...';
        }

        await completeListing(currentPodListing.id, {
            deliveryNotes,
            beneficiariesServed,
            proofCode
        });

        showToast(`Delivery settled! PoD Code: ${proofCode}`, 'success');
        window.closePodModal();
        await loadAcceptedListings();
        await loadVolunteerImpact();
    } catch (error) {
        if (errEl) {
            errEl.textContent = 'Settlement error: ' + error.message;
            errEl.classList.remove('hidden');
        }
        showToast('Error: ' + error.message, 'error');
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '✓ Settle & Complete Delivery';
        }
    }
};

async function loadVolunteerImpact() {
    try {
        const impact = await getVolunteerImpact();
        document.getElementById('volunteerKg').textContent = impact.totalKg || 0;
        document.getElementById('volunteerMeals').textContent = impact.meals || 0;
        document.getElementById('volunteerPickups').textContent = impact.pickups || 0;
    } catch (error) {
        console.error('Error loading volunteer impact:', error);
    }
}

initVolunteer();

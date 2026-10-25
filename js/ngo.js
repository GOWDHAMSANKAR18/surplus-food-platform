import { 
    getCurrentUser, 
    getNGOAvailableListings, 
    submitPickupRequest, 
    acceptListing, 
    getNGOAcceptedListings, 
    getNGOImpact, 
    completeListing, 
    clearToken,
    getListingFiles,
    verifyFileIntegrity
} from './api.js';
import { calculatePriorityScore, getTimeRemaining, showToast, initTheme, toggleTheme, getIcon, openModal, closeModal, renderEmptyState } from './utils.js';

initTheme();
window.toggleTheme = toggleTheme;

let userData = null;
let currentRequestListingId = null;
let rawNGOListings = [];
let rawAcceptedListings = [];
let currentPodListing = null;

async function initNGO() {
    try {
        const { user } = await getCurrentUser();
        if (user.role !== 'ngo') {
            return window.location.href = 'index.html';
        }

        userData = user;
        updateUserUI();
        setupSidebarAndMobileNav();
        setupFilterListeners();
        
        await loadAvailableListings();
        await loadAcceptedListings();
        await loadNGOImpact();
    } catch (error) {
        window.location.href = 'index.html';
    }
}

function updateUserUI() {
    if (!userData) return;
    const nameStr = userData.name || 'NGO Partner';
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
                        <strong style="color: var(--text-main);">NGO Name:</strong> ${userData.name}
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
                        <strong style="color: var(--text-main);">Pickup Capacity:</strong> ${userData.capacity || 50} kg per batch
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">NGO Status:</strong> <span class="badge badge-approved">Verified NGO Partner</span>
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
        const rows = await getNGOAvailableListings();
        
        let listings = rows.map((row) => ({
            ...row,
            ...calculatePriorityScore(row, userData.location, userData.capacity)
        }));

        const listingsWithFiles = await Promise.all(
            listings.map(async (l) => {
                let files = [];
                try {
                    files = await getListingFiles(l.id);
                } catch (e) {
                    files = [];
                }
                return { ...l, files };
            })
        );

        rawNGOListings = listingsWithFiles;
        document.getElementById('availableCount').textContent = rawNGOListings.length;
        renderFilteredListings();
    } catch (error) {
        console.error('Error loading available listings:', error);
    }
}

function setupFilterListeners() {
    const searchInput = document.getElementById('searchFood');
    const distSelect = document.getElementById('filterDistance');
    const urgencySelect = document.getElementById('filterUrgency');
    const recurringCheck = document.getElementById('showRecurring');
    const sortSelect = document.getElementById('sortFood');

    [searchInput, distSelect, urgencySelect, recurringCheck, sortSelect].forEach(el => {
        if (el) el.addEventListener('input', renderFilteredListings);
    });
}

window.resetNgoFilters = () => {
    const searchInput = document.getElementById('searchFood');
    const distSelect = document.getElementById('filterDistance');
    const urgencySelect = document.getElementById('filterUrgency');
    const recurringCheck = document.getElementById('showRecurring');
    const sortSelect = document.getElementById('sortFood');

    if (searchInput) searchInput.value = '';
    if (distSelect) distSelect.value = 'all';
    if (urgencySelect) urgencySelect.value = 'all';
    if (recurringCheck) recurringCheck.checked = false;
    if (sortSelect) sortSelect.value = 'priority';

    renderFilteredListings();
};

function renderFilteredListings() {
    const container = document.getElementById('availableListings');
    if (!container) return;

    const queryStr = document.getElementById('searchFood')?.value.toLowerCase().trim() || '';
    const distLimit = document.getElementById('filterDistance')?.value || 'all';
    const urgencyFilter = document.getElementById('filterUrgency')?.value || 'all';
    const showRecurringOnly = document.getElementById('showRecurring')?.checked || false;
    const sortVal = document.getElementById('sortFood')?.value || 'priority';

    let filtered = rawNGOListings.filter(l => {
        const matchSearch = l.foodType.toLowerCase().includes(queryStr) || (l.donorName && l.donorName.toLowerCase().includes(queryStr));
        if (!matchSearch) return false;

        if (distLimit !== 'all') {
            const maxDist = parseFloat(distLimit);
            if (parseFloat(l.distance) > maxDist) return false;
        }

        const timeInfo = getTimeRemaining(l.expiryTime);
        if (urgencyFilter === 'urgent' && (!timeInfo.urgent || timeInfo.expired)) {
            return false;
        }

        if (showRecurringOnly && !l.isRecurring) return false;

        return true;
    });

    const badge = document.getElementById('matchCountBadge');
    if (badge) {
        badge.textContent = `${filtered.length} of ${rawNGOListings.length} Available`;
    }

    if (sortVal === 'priority') {
        filtered.sort((a, b) => b.score - a.score);
    } else if (sortVal === 'nearest') {
        filtered.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    } else if (sortVal === 'expiring') {
        filtered.sort((a, b) => new Date(a.expiryTime) - new Date(b.expiryTime));
    } else if (sortVal === 'quantity') {
        filtered.sort((a, b) => b.quantity - a.quantity);
    }

    if (!filtered.length) {
        renderEmptyState(
            'availableListings',
            'box',
            'No Matching Food Listings',
            'No donations match your active search, radius, or urgency criteria.',
            '<button type="button" class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="window.resetNgoFilters()">Reset All Filters</button>'
        );
        return;
    }

    container.innerHTML = filtered.map((listing) => {
        const timeInfo = getTimeRemaining(listing.expiryTime);
        const fileHtml = listing.files.length ? listing.files.map(f => `
            <div class="s3-file-chip">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="s3-file-name">📄 ${f.originalFilename} (${(f.fileSize / 1024).toFixed(1)} KB)</span>
                    <span class="badge badge-available" style="font-size:0.65rem;">SSE-S3</span>
                </div>
                <div class="s3-actions">
                    <a href="${f.downloadUrl}" target="_blank" class="btn btn-outline btn-sm">📥 View Presigned File</a>
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.verifyIntegrity('${f.id}')">🛡️ SHA-256 Check</button>
                </div>
            </div>
        `).join('') : '';

        return `
            <div class="listing-card ${timeInfo.urgent ? 'urgent' : ''}">
                <div class="listing-card-header">
                    <div class="listing-food-title">${listing.foodType}</div>
                    <span class="badge badge-priority">Priority Score: ${listing.score}</span>
                </div>

                <div class="listing-details-list">
                    <div class="detail-pill">📦 ${listing.quantity} kg</div>
                    <div class="detail-pill">📍 ${listing.distance} km away</div>
                    <div class="detail-pill countdown-box ${timeInfo.urgent ? '' : 'safe'}">⏰ ${timeInfo.text}</div>
                    <div class="detail-pill">🏢 ${listing.donorName}</div>
                </div>

                <div style="font-size: 0.72rem; color: var(--primary-600); margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <span>⚡ Urgency: +${Math.round(Math.max(0, 100 - (parseFloat(listing.hoursRemaining || 4) * 25)) * 0.4)} pts</span>
                    <span>📍 Proximity: +${Math.round(Math.max(0, 100 - (parseFloat(listing.distance) * 10)) * 0.35)} pts</span>
                    <span>⚖️ Capacity: +${Math.round(Math.min(100, (listing.quantity / (userData?.capacity || 50)) * 100) * 0.25)} pts</span>
                </div>

                ${listing.isRecurring ? '<div style="font-size:0.8rem; color:var(--primary-600); font-weight:600;">🔄 Daily Surplus Schedule</div>' : ''}
                <div style="font-size: 0.85rem; color: var(--text-muted);">📍 ${listing.location.address}</div>

                ${fileHtml}

                <div style="margin-top: 8px;">
                    <button type="button" class="btn btn-primary" style="width: 100%;" onclick="window.openRequestModalAction('${listing.id}')">
                        Request Food Pickup
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.verifyIntegrity = async (fileId) => {
    openModal('integrityModal');
    const details = document.getElementById('integrityDetails');
    details.innerHTML = '<p style="color:var(--text-muted);">⏳ Fetching S3 file and verifying SHA-256 checksum...</p>';

    try {
        const result = await verifyFileIntegrity(fileId);
        details.innerHTML = `
            <div style="background: var(--primary-50); border: 1px solid var(--primary-200); color: var(--primary-800); padding: 14px; border-radius: var(--radius-md); font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                ${getIcon('check', '', 20)}
                <span>INTEGRITY VERIFIED: ${result.integrity.toUpperCase()}</span>
            </div>
            <p><strong>File Name:</strong> ${result.filename}</p>
            <p><strong>Hash Algorithm:</strong> ${result.algorithm}</p>
            <p style="margin-top: 6px;"><strong>MySQL Stored Checksum:</strong></p>
            <div style="background: var(--bg-subtle); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 0.78rem; word-break: break-all;">${result.storedChecksum}</div>
            <p style="margin-top: 6px;"><strong>Recalculated S3 Checksum:</strong></p>
            <div style="background: var(--bg-subtle); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 0.78rem; word-break: break-all;">${result.recalculatedChecksum}</div>
            <div style="color: var(--primary-600); font-weight: 600; margin-top: 10px;">✓ authentic S3 proof file.</div>
        `;
    } catch (err) {
        details.innerHTML = `<div style="background: var(--danger-50); color: var(--danger-600); padding: 12px; border-radius: var(--radius-md);">❌ Error: ${err.message}</div>`;
    }
};

window.closeIntegrityModal = () => closeModal('integrityModal');

window.openRequestModalAction = (listingId) => {
    currentRequestListingId = listingId;
    const targetListing = rawNGOListings.find(l => l.id === listingId);
    
    const summary = document.getElementById('requestListingSummary');
    if (summary && targetListing) {
        summary.innerHTML = `
            <strong style="color: var(--primary-700);">${targetListing.foodType}</strong> (${targetListing.quantity} kg)
            <br><span style="color: var(--text-muted); font-size: 0.8rem;">Donor: ${targetListing.donorName} • Location: ${targetListing.location.address}</span>
        `;
    }

    const nameInput = document.getElementById('requestNgoName');
    const contactInput = document.getElementById('requestContact');
    if (nameInput) nameInput.value = userData.name;
    if (contactInput && userData.phone) contactInput.value = userData.phone;

    openModal('requestModal');
};

window.closeRequestModal = () => {
    closeModal('requestModal');
    document.getElementById('requestForm')?.reset();
    currentRequestListingId = null;
};

document.getElementById('requestForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitRequestBtn');
    const contact = document.getElementById('requestContact').value.trim();
    const pickupTime = document.getElementById('requestPickupTime').value;
    const message = document.getElementById('requestMessage').value.trim();

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting Request...';
        }

        await submitPickupRequest(currentRequestListingId, {
            contact,
            pickupTime,
            message
        });

        showToast('Pickup request submitted to donor successfully!', 'success');
        closeRequestModal();
        await loadAvailableListings();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Pickup Request';
        }
    }
});

async function loadAcceptedListings() {
    try {
        const listings = await getNGOAcceptedListings();
        rawAcceptedListings = listings;
        const container = document.getElementById('acceptedListings');
        if (!container) return;

        if (!listings.length) {
            renderEmptyState('acceptedListings', 'handshake', 'No Accepted Pickups Yet', 'Approved food pickup assignments will appear here.');
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
                        ✓ Complete Pickup & PoD
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
    const deliveryNotes = notesInput?.value.trim() || 'Food verified and received safely at distribution center.';
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
        await loadNGOImpact();
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

async function loadNGOImpact() {
    try {
        const impact = await getNGOImpact();
        document.getElementById('ngoKg').textContent = impact.totalKg || 0;
        document.getElementById('ngoMeals').textContent = impact.meals || 0;
        document.getElementById('ngoPickups').textContent = impact.pickups || 0;
    } catch (error) {
        console.error('Error loading NGO impact:', error);
    }
}

initNGO();

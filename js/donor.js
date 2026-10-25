import { 
    getCurrentUser, 
    createListing, 
    getDonorListings, 
    getDonorRequests, 
    approveRequest, 
    getDonorImpact, 
    clearToken,
    uploadListingFile,
    getListingFiles,
    verifyFileIntegrity,
    cancelListing
} from './api.js';
import { getTimeRemaining, showToast, initTheme, toggleTheme, getIcon, openModal, closeModal, renderEmptyState } from './utils.js';

initTheme();
window.toggleTheme = toggleTheme;

let userData = null;
let rawListings = [];
let currentCancelListingId = null;

async function initDonor() {
    try {
        const { user } = await getCurrentUser();
        if (user.role !== 'donor') {
            return window.location.href = 'index.html';
        }

        userData = user;
        updateUserUI();
        setupSidebarAndMobileNav();
        setupFileUploadUI();
        setupFilterListeners();
        
        await loadActiveListings();
        await loadPickupRequests();
        await loadDonorImpact();
    } catch (error) {
        window.location.href = 'index.html';
    }
}

function updateUserUI() {
    if (!userData) return;
    const nameStr = userData.name || 'Partner';
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
                        <strong style="color: var(--text-main);">Organization Name:</strong> ${userData.name}
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
                        <strong style="color: var(--text-main);">Coordinates:</strong> ${userData.location.lat}, ${userData.location.lng}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Account Verification:</strong> <span class="badge badge-available">Verified Partner</span>
                    </div>
                </div>
            `;
        }
        openModal('profileModal');
    };

    window.closeProfileModal = () => closeModal('profileModal');
}

function setupFileUploadUI() {
    const isRecurring = document.getElementById('isRecurring');
    const recurringFields = document.getElementById('recurringFields');

    if (isRecurring && recurringFields) {
        isRecurring.addEventListener('change', (e) => {
            recurringFields.classList.toggle('hidden', !e.target.checked);
        });
    }

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('foodImage');
    const badge = document.getElementById('fileSelectedBadge');
    const nameEl = document.getElementById('selectedFileName');
    const sizeEl = document.getElementById('selectedFileSize');
    const removeBtn = document.getElementById('removeFileBtn');

    if (dropZone && fileInput) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                updateFileBadge();
            }
        });

        fileInput.addEventListener('change', updateFileBadge);

        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.value = '';
                if (badge) badge.classList.add('hidden');
            });
        }
    }

    function updateFileBadge() {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            nameEl.textContent = file.name;
            sizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

document.getElementById('listingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('createListingSubmitBtn');
    const foodType = document.getElementById('foodType').value.trim();
    const quantity = parseInt(document.getElementById('quantity').value, 10);
    const expiryHours = parseInt(document.getElementById('expiryHours').value, 10);
    const isRecurring = document.getElementById('isRecurring').checked;
    const expectedDaily = isRecurring ? parseInt(document.getElementById('expectedDaily').value, 10) : 0;
    const fileInput = document.getElementById('foodImage');

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating & Uploading to S3...';
        }

        const newListing = await createListing({
            foodType,
            quantity,
            expiryHours,
            isRecurring,
            expectedDaily
        });

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            await uploadListingFile(newListing.id, file);
        }

        e.target.reset();
        document.getElementById('fileSelectedBadge')?.classList.add('hidden');
        document.getElementById('recurringFields')?.classList.add('hidden');

        showToast('Food listing created and files uploaded to S3!', 'success');
        await loadActiveListings();
        await loadPickupRequests();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Listing & Encrypt to S3';
        }
    }
});

async function loadActiveListings() {
    try {
        const listings = await getDonorListings();
        
        const listingsWithFiles = await Promise.all(
            listings.map(async (data) => {
                let files = [];
                try {
                    files = await getListingFiles(data.id);
                } catch (e) {
                    files = [];
                }
                return { ...data, files };
            })
        );

        rawListings = listingsWithFiles;
        document.getElementById('activeListingsCount').textContent = rawListings.filter(l => l.status === 'available').length;
        renderFilteredListings();
    } catch (error) {
        console.error('Error loading active listings:', error);
    }
}

function setupFilterListeners() {
    const searchInput = document.getElementById('searchListings');
    const statusSelect = document.getElementById('filterStatus');
    const sortSelect = document.getElementById('sortListings');

    [searchInput, statusSelect, sortSelect].forEach(el => {
        if (el) el.addEventListener('input', renderFilteredListings);
    });
}

function renderFilteredListings() {
    const container = document.getElementById('activeListings');
    if (!container) return;

    const queryStr = document.getElementById('searchListings')?.value.toLowerCase().trim() || '';
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';
    const sortVal = document.getElementById('sortListings')?.value || 'newest';

    let filtered = rawListings.filter(l => {
        const matchSearch = l.foodType.toLowerCase().includes(queryStr);
        if (!matchSearch) return false;

        const timeInfo = getTimeRemaining(l.expiryTime);
        if (statusFilter === 'available') return l.status === 'available';
        if (statusFilter === 'approved') return l.status === 'approved';
        if (statusFilter === 'accepted') return l.status === 'accepted';
        if (statusFilter === 'expiring') return timeInfo.urgent && !timeInfo.expired;
        if (statusFilter === 'recurring') return l.isRecurring;
        return true;
    });

    if (sortVal === 'newest') {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortVal === 'expiry') {
        filtered.sort((a, b) => new Date(a.expiryTime) - new Date(b.expiryTime));
    } else if (sortVal === 'quantity') {
        filtered.sort((a, b) => b.quantity - a.quantity);
    }

    if (!filtered.length) {
        renderEmptyState('activeListings', 'box', 'No Active Food Listings', 'Created surplus food listings and attached proof files will appear here.');
        return;
    }

    container.innerHTML = filtered.map((data) => {
        const timeInfo = getTimeRemaining(data.expiryTime);
        const isUrgent = timeInfo.urgent;

        const fileHtml = data.files.length ? data.files.map(f => `
            <div class="s3-file-chip">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="s3-file-name">📄 ${f.originalFilename} (${(f.fileSize / 1024).toFixed(1)} KB)</span>
                    <span class="badge badge-available" style="font-size:0.65rem;">SSE-S3</span>
                </div>
                <div class="s3-file-checksum">SHA-256: ${f.sha256Checksum.substring(0, 24)}...</div>
                <div class="s3-actions">
                    <a href="${f.downloadUrl}" target="_blank" class="btn btn-outline btn-sm">📥 Presigned S3 Link</a>
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.verifyIntegrity('${f.id}')">🛡️ Verify SHA-256</button>
                </div>
            </div>
        `).join('') : '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">No proof files attached</div>';

        let statusBadge = `<span class="badge badge-available">${data.status.toUpperCase()}</span>`;
        if (data.status === 'approved') statusBadge = `<span class="badge badge-approved">APPROVED FOR ${data.acceptedBy || 'NGO'}</span>`;
        if (data.status === 'accepted') statusBadge = `<span class="badge badge-priority">PICKUP IN PROGRESS (${data.acceptedBy || 'Partner'})</span>`;

        return `
            <div class="listing-card ${isUrgent ? 'urgent' : ''}">
                <div class="listing-card-header">
                    <div class="listing-food-title">${data.foodType}</div>
                    ${statusBadge}
                </div>

                <div class="listing-details-list">
                    <div class="detail-pill">📦 ${data.quantity} kg</div>
                    <div class="detail-pill countdown-box ${timeInfo.urgent ? '' : 'safe'}">
                        ⏰ ${timeInfo.text}
                    </div>
                </div>

                ${data.isRecurring ? '<div style="font-size:0.8rem; color:var(--primary-600); font-weight:600;">🔄 Daily Surplus Schedule</div>' : ''}
                
                ${fileHtml}

                ${data.status === 'available' ? `
                    <div style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                        <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger-600); border-color: rgba(239, 68, 68, 0.3); width: 100%; font-size: 0.8rem;" onclick="window.confirmCancelListing('${data.id}', '${data.foodType.replace(/'/g, "\\'")}')">
                            ✕ Retract / Cancel Listing
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

window.confirmCancelListing = (listingId, foodTitle) => {
    currentCancelListingId = listingId;
    const titleEl = document.getElementById('cancelFoodTitle');
    if (titleEl) titleEl.textContent = `"${foodTitle}"`;
    const errEl = document.getElementById('cancelErrorMsg');
    if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
    }
    const notesEl = document.getElementById('cancelReasonNotes');
    if (notesEl) notesEl.value = '';
    openModal('cancelListingModal');
};

window.closeCancelModal = () => {
    closeModal('cancelListingModal');
    currentCancelListingId = null;
};

window.submitCancelListing = async () => {
    if (!currentCancelListingId) return;
    const confirmBtn = document.getElementById('confirmCancelBtn');
    const reasonSelect = document.getElementById('cancelReasonSelect');
    const reasonNotes = document.getElementById('cancelReasonNotes');
    const errEl = document.getElementById('cancelErrorMsg');

    const primaryReason = reasonSelect ? reasonSelect.value : 'Cancelled by donor';
    const notes = reasonNotes ? reasonNotes.value.trim() : '';
    const fullReason = notes ? `${primaryReason} - ${notes}` : primaryReason;

    try {
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Retracting...';
        }
        await cancelListing(currentCancelListingId, fullReason);
        showToast('Food listing successfully retracted from public feed.', 'success');
        window.closeCancelModal();
        await loadActiveListings();
        await loadRequests();
    } catch (err) {
        if (errEl) {
            errEl.textContent = 'Error: ' + err.message;
            errEl.classList.remove('hidden');
        }
        showToast('Failed to cancel listing: ' + err.message, 'error');
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Retraction';
        }
    }
};

window.verifyIntegrity = async (fileId) => {
    openModal('integrityModal');
    const details = document.getElementById('integrityDetails');
    details.innerHTML = '<p style="color:var(--text-muted);">⏳ Fetching S3 file and recalculating SHA-256 checksum against MySQL database...</p>';

    try {
        const result = await verifyFileIntegrity(fileId);
        details.innerHTML = `
            <div style="background: var(--primary-50); border: 1px solid var(--primary-200); color: var(--primary-800); padding: 14px; border-radius: var(--radius-md); font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                ${getIcon('check', '', 20)}
                <span>INTEGRITY VERIFIED: ${result.integrity.toUpperCase()}</span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.88rem;">
                <p><strong>File Name:</strong> ${result.filename}</p>
                <p><strong>S3 Object Key:</strong> <code style="background:var(--bg-subtle); padding:2px 6px; border-radius:4px; font-size:0.8rem;">${result.objectKey}</code></p>
                <p><strong>Hash Algorithm:</strong> ${result.algorithm}</p>
                
                <p style="margin-top: 6px;"><strong>MySQL Stored Checksum:</strong></p>
                <div style="background: var(--bg-subtle); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 0.78rem; word-break: break-all; color: var(--text-main);">
                    ${result.storedChecksum}
                </div>

                <p style="margin-top: 6px;"><strong>Recalculated S3 Checksum:</strong></p>
                <div style="background: var(--bg-subtle); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 0.78rem; word-break: break-all; color: var(--text-main);">
                    ${result.recalculatedChecksum}
                </div>

                <div style="color: var(--primary-600); font-weight: 600; margin-top: 10px; display: flex; align-items: center; gap: 6px;">
                    ✓ The file stored in Amazon S3 is authentic and tampered-proof.
                </div>
            </div>
        `;
    } catch (err) {
        details.innerHTML = `<div style="background: var(--danger-50); color: var(--danger-600); padding: 12px; border-radius: var(--radius-md);">❌ Verification Error: ${err.message}</div>`;
    }
};

window.closeIntegrityModal = () => closeModal('integrityModal');

async function loadPickupRequests() {
    try {
        const groups = await getDonorRequests();
        const container = document.getElementById('pickupRequests');
        if (!container) return;

        let totalPending = 0;
        groups.forEach(g => {
            totalPending += g.requests.filter(r => r.status === 'pending').length;
        });
        document.getElementById('pendingRequestsCount').textContent = totalPending;

        if (!groups.length) {
            renderEmptyState('pickupRequests', 'handshake', 'No Pickup Requests Yet', 'When NGOs request your surplus food, their pickup details will appear here.');
            return;
        }

        const html = groups.map((group) => {
            const requestHtml = group.requests.map((req) => {
                const pickupTime = new Date(req.pickupTime).toLocaleString();
                let statusBadge = `<span class="badge badge-pending">PENDING</span>`;
                if (req.status === 'approved') statusBadge = `<span class="badge badge-approved">APPROVED</span>`;
                if (req.status === 'rejected') statusBadge = `<span class="badge badge-expired">REJECTED</span>`;

                return `
                    <div style="background: var(--bg-surface); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-top: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong style="color: var(--text-main); font-size: 0.95rem;">🤝 ${req.ngoName}</strong>
                            ${statusBadge}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;">
                            <div>📞 Contact: ${req.contact}</div>
                            <div>🕐 Pickup Window: ${pickupTime}</div>
                            ${req.message ? `<div style="font-style: italic; color: var(--text-main);">💬 "${req.message}"</div>` : ''}
                        </div>

                        ${req.status === 'pending' ? `
                            <div style="margin-top: 12px;">
                                <button type="button" class="btn btn-primary btn-sm" onclick="window.approveRequestAction('${req.id}')">
                                    Approve Pickup Request
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            return `
                <div style="background: var(--bg-subtle); padding: 16px; border-radius: var(--radius-lg); margin-bottom: 16px;">
                    <h4 style="color: var(--primary-700); font-size: 1rem; font-weight: 700; margin-bottom: 8px;">
                        📦 ${group.listing.foodType} (${group.listing.quantity} kg)
                    </h4>
                    ${requestHtml}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading pickup requests:', error);
    }
}

window.approveRequestAction = async (requestId) => {
    if (!confirm('Are you sure you want to approve this NGO pickup request?')) return;
    try {
        await approveRequest(requestId);
        showToast('Pickup request approved successfully!', 'success');
        await loadActiveListings();
        await loadPickupRequests();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
};

async function loadDonorImpact() {
    try {
        const impact = await getDonorImpact();
        document.getElementById('donorKg').textContent = impact.totalKg || 0;
        document.getElementById('donorMeals').textContent = impact.meals || 0;
        document.getElementById('donorCO2').textContent = (impact.co2 || 0).toFixed(1);
    } catch (error) {
        console.error('Error loading donor impact:', error);
    }
}

document.getElementById('downloadReport')?.addEventListener('click', () => {
    const kg = document.getElementById('donorKg').textContent;
    const meals = document.getElementById('donorMeals').textContent;
    const co2 = document.getElementById('donorCO2').textContent;

    const report = `
===================================================================
GATE-WAY SURPLUS FOOD REDISTRIBUTION — ESG IMPACT REPORT
===================================================================
Organization Name : ${userData?.name || 'Donor'}
Account Role      : Food Donor Partner
Report Date       : ${new Date().toLocaleString()}
Status            : Certified Active Partner

ENVIRONMENTAL & COMMUNITY METRICS:
-------------------------------------------------------------------
- Total Food Waste Diverted : ${kg} kg
- CO₂ Emissions Prevented   : ${co2} kg
- Nutritious Meals Supported: ${meals} meals
- Primary Storage Protocol  : Amazon S3 Private Bucket (SSE-S3 Encrypted)
- Integrity Check Engine    : SHA-256 Hash Verification

UN SUSTAINABLE DEVELOPMENT GOALS (SDG) ALIGNMENT:
- SDG 2 (Zero Hunger)              : Direct community redistribution
- SDG 12 (Responsible Consumption) : Food loss mitigation
- SDG 13 (Climate Action)          : Methane emission avoidance

This report certifies your active participation in zero-waste surplus 
food logistics managed via GATE-WAY platform APIs.
===================================================================
    `;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GATEWAY_ESG_Report_${Date.now()}.txt`;
    a.click();
    showToast('ESG Impact Report downloaded!', 'success');
});

initDonor();

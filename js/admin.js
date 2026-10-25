import { 
    getCurrentUser, 
    getHealthStatus, 
    getAuditLogs, 
    getAdminUsers, 
    getAdminOverview, 
    clearToken 
} from './api.js';
import { showToast, initTheme, toggleTheme, openModal, closeModal, formatDate, animateCounter } from './utils.js';

initTheme();
window.toggleTheme = toggleTheme;

let userData = null;
let rawAuditLogs = [];
let rawUsers = [];

async function initAdmin() {
    try {
        const { user } = await getCurrentUser();
        if (user.role !== 'admin') {
            return window.location.href = 'index.html';
        }

        userData = user;
        updateUserUI();
        setupSidebarAndNav();
        setupFilterListeners();

        await loadOverviewMetrics();
        await loadSystemHealth();
        await loadAuditLogs();
        await loadUserDirectory();
    } catch (error) {
        window.location.href = 'index.html';
    }
}

function updateUserUI() {
    if (!userData) return;
    const nameStr = userData.name || 'Admin';
    document.getElementById('userNameHeader').textContent = nameStr;
    document.getElementById('sidebarUserName').textContent = nameStr;
    document.getElementById('avatarInitial').textContent = nameStr.charAt(0).toUpperCase();
}

function setupSidebarAndNav() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('appSidebar');

    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Active link highlighting & auto-close on mobile
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

    document.getElementById('refreshHealthBtn')?.addEventListener('click', async () => {
        showToast('Refreshing health diagnostics...', 'info', 1500);
        await loadSystemHealth();
    });

    window.openProfileModal = () => {
        const body = document.getElementById('profileModalBody');
        if (body && userData) {
            body.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.9rem;">
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Administrator:</strong> ${userData.name}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Email:</strong> ${userData.email}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Phone:</strong> ${userData.phone}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Location:</strong> ${userData.location.address}
                    </div>
                    <div style="padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                        <strong style="color: var(--text-main);">Role Level:</strong> <span class="badge" style="background:#e0e7ff; color:#3730a3;">Platform Superadmin</span>
                    </div>
                </div>
            `;
        }
        openModal('profileModal');
    };

    window.closeProfileModal = () => closeModal('profileModal');
}

async function loadOverviewMetrics() {
    try {
        const data = await getAdminOverview();
        
        const totalUsers = (data.usersByRole || []).reduce((acc, u) => acc + Number(u.count || 0), 0);
        const activeListings = (data.listingsByStatus || [])
            .filter(l => l.status === 'available')
            .reduce((acc, l) => acc + Number(l.count || 0), 0);
        const totalKgSaved = Number(data.impact?.total_kg_saved || 0);
        const auditEvents = Number(data.totalAuditEvents || 0);
        const filesCount = Number(data.filesCount || 0);

        animateCounter(document.getElementById('kpiTotalUsers'), totalUsers, 800);
        animateCounter(document.getElementById('kpiActiveListings'), activeListings, 800);
        animateCounter(document.getElementById('kpiKgSaved'), totalKgSaved, 800);
        animateCounter(document.getElementById('kpiAuditEvents'), auditEvents, 800);
        animateCounter(document.getElementById('kpiFilesUploaded'), filesCount, 800);
    } catch (error) {
        console.error('Failed to load admin overview metrics:', error);
    }
}

async function loadSystemHealth() {
    try {
        const health = await getHealthStatus();

        // Server
        document.getElementById('healthServerBadge').textContent = (health.status === 'ok') ? 'ONLINE (200)' : 'DEGRADED';
        document.getElementById('healthServerDetails').textContent = `${health.server} • ${new Date(health.timestamp).toLocaleTimeString()}`;

        // DB
        const dbBadge = document.getElementById('healthDbBadge');
        if (health.database?.status === 'connected') {
            dbBadge.textContent = 'CONNECTED';
            dbBadge.className = 'badge badge-available';
            document.getElementById('healthDbDetails').textContent = `${health.database.engine} (${health.database.database})`;
        } else {
            dbBadge.textContent = 'MOCK FALLBACK ACTIVE';
            dbBadge.className = 'badge badge-pending';
            document.getElementById('healthDbDetails').textContent = `${health.database.engine} (${health.database.error || 'Development Engine'})`;
        }

        // Storage
        const storageBadge = document.getElementById('healthStorageBadge');
        if (health.storage?.configured) {
            storageBadge.textContent = 'S3 SSE ACTIVE';
            storageBadge.className = 'badge badge-available';
            document.getElementById('healthStorageDetails').textContent = `Bucket: ${health.storage.bucket} (${health.storage.region})`;
        } else {
            storageBadge.textContent = 'LOCAL STORAGE';
            storageBadge.className = 'badge badge-approved';
            document.getElementById('healthStorageDetails').textContent = `Local Fallback active (SHA-256 Engine Verified)`;
        }
    } catch (error) {
        console.error('Failed to load health status:', error);
    }
}

async function loadAuditLogs() {
    try {
        const logs = await getAuditLogs();
        rawAuditLogs = logs || [];
        renderFilteredAuditLogs();
    } catch (error) {
        const tbody = document.getElementById('auditTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:24px; text-align:center; color:var(--danger-500);">Failed to load audit logs: ${error.message}</td></tr>`;
        }
    }
}

async function loadUserDirectory() {
    try {
        const users = await getAdminUsers();
        rawUsers = users || [];
        renderFilteredUsers();
    } catch (error) {
        const tbody = document.getElementById('userTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding:24px; text-align:center; color:var(--danger-500);">Failed to load users: ${error.message}</td></tr>`;
        }
    }
}

function setupFilterListeners() {
    const searchAudit = document.getElementById('searchAuditLogs');
    const filterAction = document.getElementById('filterAuditAction');
    if (searchAudit) searchAudit.addEventListener('input', renderFilteredAuditLogs);
    if (filterAction) filterAction.addEventListener('change', renderFilteredAuditLogs);

    const searchUsers = document.getElementById('searchUsers');
    const filterRole = document.getElementById('filterUserRole');
    if (searchUsers) searchUsers.addEventListener('input', renderFilteredUsers);
    if (filterRole) filterRole.addEventListener('change', renderFilteredUsers);
}

function renderFilteredAuditLogs() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    const queryStr = document.getElementById('searchAuditLogs')?.value.toLowerCase().trim() || '';
    const actionFilter = document.getElementById('filterAuditAction')?.value || 'all';

    let filtered = rawAuditLogs.filter(log => {
        const matchSearch = (log.user_name && log.user_name.toLowerCase().includes(queryStr)) ||
                            (log.action && log.action.toLowerCase().includes(queryStr)) ||
                            (log.ip_address && log.ip_address.includes(queryStr));
        if (!matchSearch) return false;

        if (actionFilter !== 'all' && log.action !== actionFilter) return false;
        return true;
    });

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 32px; text-align: center; color: var(--text-muted);">
                    No audit records match the selected filter.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(log => {
        let badgeClass = 'badge badge-available';
        if (log.action === 'SIGNUP') badgeClass = 'badge badge-approved';
        if (log.action === 'LOGIN') badgeClass = 'badge badge-pending';
        if (log.action === 'FILE_UPLOAD') badgeClass = 'badge badge-priority';

        return `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-subtle)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 12px 16px; font-weight:600; color:var(--text-main);">#${log.id}</td>
                <td style="padding: 12px 16px; color:var(--text-muted); font-size:0.8rem;">${formatDate(log.created_at)}</td>
                <td style="padding: 12px 16px;"><span class="${badgeClass}">${log.action}</span></td>
                <td style="padding: 12px 16px;">
                    <div style="font-weight:600; color:var(--text-main);">${log.user_name || 'System'}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${log.user_email || ''}</div>
                </td>
                <td style="padding: 12px 16px; color:var(--text-muted); font-family:monospace; font-size:0.8rem;">${log.entity_type} #${log.entity_id || '-'}</td>
                <td style="padding: 12px 16px; color:var(--text-muted); font-family:monospace; font-size:0.8rem;">${log.ip_address || '127.0.0.1'}</td>
            </tr>
        `;
    }).join('');
}

function renderFilteredUsers() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    const queryStr = document.getElementById('searchUsers')?.value.toLowerCase().trim() || '';
    const roleFilter = document.getElementById('filterUserRole')?.value || 'all';

    let filtered = rawUsers.filter(u => {
        const matchSearch = (u.name && u.name.toLowerCase().includes(queryStr)) ||
                            (u.email && u.email.toLowerCase().includes(queryStr));
        if (!matchSearch) return false;

        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        return true;
    });

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="padding: 32px; text-align: center; color: var(--text-muted);">
                    No registered users match the search criteria.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        let roleBadge = `<span class="badge badge-available">DONOR</span>`;
        if (u.role === 'ngo') roleBadge = `<span class="badge badge-approved">NGO (${u.capacity || 50}kg)</span>`;
        if (u.role === 'volunteer') roleBadge = `<span class="badge badge-priority">VOLUNTEER</span>`;
        if (u.role === 'admin') roleBadge = `<span class="badge" style="background:#e0e7ff; color:#3730a3;">ADMIN</span>`;

        const verifiedBadge = u.verified 
            ? `<span style="color:var(--primary-600); font-weight:700;">✓ Verified</span>` 
            : `<span style="color:var(--text-muted);">Standard</span>`;

        return `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-subtle)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 12px 16px; font-weight:600; color:var(--text-main);">#${u.id}</td>
                <td style="padding: 12px 16px; font-weight:600; color:var(--text-main);">${u.name}</td>
                <td style="padding: 12px 16px; color:var(--text-muted);">${u.email}</td>
                <td style="padding: 12px 16px;">${roleBadge}</td>
                <td style="padding: 12px 16px; color:var(--text-muted); font-size:0.85rem;">${u.phone}</td>
                <td style="padding: 12px 16px; color:var(--text-muted); font-size:0.85rem; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${u.location.address}">${u.location.address}</td>
                <td style="padding: 12px 16px; font-size:0.85rem;">${verifiedBadge}</td>
            </tr>
        `;
    }).join('');
}

initAdmin();

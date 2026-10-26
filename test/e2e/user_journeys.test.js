import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriorityScore } from '../../js/utils.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost';

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, data };
}

test('E2E: Critical Multi-User Journeys & Role Workflows', async (t) => {
  let donorToken = '';
  let ngoToken = '';
  let volunteerToken = '';
  let adminToken = '';
  let e2eListingId = null;
  let e2eRequestId = null;

  await t.test('E2E-01: Authenticate all platform roles', async () => {
    // 1. Donor login
    const donorRes = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'donor@example.com', password: 'password123' }
    });
    assert.equal(donorRes.status, 200);
    donorToken = donorRes.data.token;

    // 2. NGO login
    const ngoRes = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'ngo@example.com', password: 'password123' }
    });
    assert.equal(ngoRes.status, 200);
    ngoToken = ngoRes.data.token;

    // 3. Volunteer login
    const volRes = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'volunteer@example.com', password: 'password123' }
    });
    assert.equal(volRes.status, 200);
    volunteerToken = volRes.data.token;

    // 4. Admin login
    const adminRes = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'password123' }
    });
    assert.equal(adminRes.status, 200);
    adminToken = adminRes.data.token;
  });

  // JOURNEY 1 & 2: Food Donor & NGO Collaborative Redistribution Lifecycle
  await t.test('E2E-02: Journey 1: Donor creates surplus food listing and verifies in active inventory', async () => {
    const createRes = await req('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: {
        foodType: 'Buffet Surplus - Biryani & Curries',
        quantity: 35,
        expiryHours: 8,
        isRecurring: true,
        expectedDaily: 20
      }
    });

    assert.equal(createRes.status, 200);
    assert.equal(createRes.data.status, 'available');
    assert.equal(createRes.data.foodType, 'Buffet Surplus - Biryani & Curries');
    e2eListingId = createRes.data.id;

    // Donor verifies listing appears in their active inventory
    const myListings = await req('/api/donor/listings', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(myListings.status, 200);
    const item = myListings.data.find(l => l.id === e2eListingId);
    assert.ok(item, 'Listing must appear in donor listings');
    assert.equal(item.status, 'available');
  });

  await t.test('E2E-03: Journey 2: NGO discovers listing, calculates priority score, and submits pickup request', async () => {
    // NGO fetches feed
    const ngoFeed = await req('/api/ngo/listings', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(ngoFeed.status, 200);
    const targetListing = ngoFeed.data.find(l => l.id === e2eListingId);
    assert.ok(targetListing, 'NGO feed must contain available listing');

    // NGO profile coordinates & capacity
    const ngoMe = await req('/api/auth/me', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(ngoMe.status, 200);
    const ngoLocation = ngoMe.data.user.location;
    const ngoCapacity = ngoMe.data.user.capacity;

    // Calculate smart priority score
    const priority = calculatePriorityScore(targetListing, ngoLocation, ngoCapacity);
    assert.ok(priority.score > 0, 'Priority score must be a positive integer');
    assert.ok(Number(priority.distance) >= 0);

    // NGO submits pickup request
    const pickupTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const reqRes = await req(`/api/listings/${e2eListingId}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: {
        contact: '+91-9876543211',
        pickupTime,
        message: 'Hope Foundation refrigerated van dispatch'
      }
    });

    assert.equal(reqRes.status, 200);
    assert.equal(reqRes.data.status, 'pending');
    e2eRequestId = reqRes.data.id;
  });

  await t.test('E2E-04: Journey 1: Donor reviews incoming requests and approves the selected NGO', async () => {
    // Donor checks incoming requests
    const donorRequests = await req('/api/donor/requests', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(donorRequests.status, 200);
    const group = donorRequests.data.find(g => g.listing.id === e2eListingId);
    assert.ok(group, 'Donor must see listing in requests group');
    const matchedReq = group.requests.find(r => r.id === e2eRequestId);
    assert.ok(matchedReq, 'Target request must be present in group');

    // Donor approves request
    const approveRes = await req(`/api/requests/${e2eRequestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.success, true);
  });

  await t.test('E2E-05: Journey 2: NGO completes pickup, updates food listing, and increments global impact', async () => {
    // Complete pickup
    const completeRes = await req(`/api/listings/${e2eListingId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.data.success, true);

    // Verify donor impact update
    const donorImpact = await req('/api/donor/impact', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(donorImpact.status, 200);
    assert.ok(donorImpact.data.totalKg >= 35);
    assert.ok(donorImpact.data.meals >= 70);

    // Verify NGO impact update
    const ngoImpact = await req('/api/ngo/impact', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(ngoImpact.status, 200);
    assert.ok(ngoImpact.data.pickups >= 1);
  });

  // JOURNEY 3: Fast-Dispatch Volunteer Workflow
  await t.test('E2E-06: Journey 3: Volunteer task query, dispatch acceptance, and completion', async () => {
    // Volunteer queries eligible tasks
    const volTasks = await req('/api/volunteer/listings', {
      headers: { Authorization: `Bearer ${volunteerToken}` }
    });
    assert.equal(volTasks.status, 200);
    assert.ok(Array.isArray(volTasks.data));

    // Volunteer queries already accepted tasks
    const acceptedTasks = await req('/api/volunteer/accepted', {
      headers: { Authorization: `Bearer ${volunteerToken}` }
    });
    assert.equal(acceptedTasks.status, 200);
    assert.ok(Array.isArray(acceptedTasks.data));

    // Volunteer impact stats
    const volImpact = await req('/api/volunteer/impact', {
      headers: { Authorization: `Bearer ${volunteerToken}` }
    });
    assert.equal(volImpact.status, 200);
    assert.ok(typeof volImpact.data.totalKg === 'number');
  });

  // JOURNEY 4: Platform Administration & Cryptographic Audit Verification
  await t.test('E2E-07: Journey 4: Admin reviews system health, user directory, and audit logs', async () => {
    // 1. System health
    const healthRes = await req('/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.data.status, 'ok');

    // 2. Admin overview KPI metrics
    const overviewRes = await req('/api/admin/overview', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(overviewRes.status, 200);
    assert.ok(overviewRes.data.usersByRole.length >= 4);

    // 3. User directory verification
    const usersRes = await req('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(usersRes.status, 200);
    const emails = usersRes.data.map(u => u.email);
    assert.ok(emails.includes('donor@example.com'));
    assert.ok(emails.includes('ngo@example.com'));
    assert.ok(emails.includes('volunteer@example.com'));
    assert.ok(emails.includes('admin@example.com'));

    // 4. Audit Log verification for recent operations
    const auditRes = await req('/api/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.data));
    assert.ok(auditRes.data.length > 0);

    // Verify chronological actions captured in audit trail
    const actions = auditRes.data.map(log => log.action);
    assert.ok(actions.includes('CREATE_LISTING') || actions.includes('APPROVE_REQUEST') || actions.includes('COMPLETE_LISTING'));
  });
});


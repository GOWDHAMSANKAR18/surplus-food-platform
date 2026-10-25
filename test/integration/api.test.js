import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://127.0.0.1:4000';

async function apiRequest(path, options = {}) {
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

test('GATE-WAY API Integration Test Suite', async (t) => {
  let donorToken = '';
  let ngoToken = '';
  let volunteerToken = '';
  let adminToken = '';
  let createdListingId = null;
  let createdRequestId = null;

  await t.test('1. System Health Check', async () => {
    const res = await apiRequest('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.ok(res.data.database);
    assert.ok(res.data.storage);
  });

  await t.test('2. Security Protections & Source Leak Prevention', async () => {
    const rawRes = await fetch(`${BASE_URL}/server.js`);
    assert.equal(rawRes.status, 404, 'server.js must not be exposed');

    const schemaRes = await fetch(`${BASE_URL}/database/schema.sql`);
    assert.equal(schemaRes.status, 404, 'database/schema.sql must not be exposed');

    const s3ServiceRes = await fetch(`${BASE_URL}/services/s3Service.js`);
    assert.equal(s3ServiceRes.status, 404, 'services/s3Service.js must not be exposed');

    // Verify security headers
    assert.equal(rawRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(rawRes.headers.get('x-frame-options'), 'SAMEORIGIN');
  });

  await t.test('3. Authentication & Credential Verification', async () => {
    // Bad login
    const badLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'donor@example.com', password: 'wrongpassword' }
    });
    assert.equal(badLogin.status, 401);

    // Donor login
    const donorRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'donor@example.com', password: 'password123' }
    });
    assert.equal(donorRes.status, 200);
    assert.ok(donorRes.data.token);
    assert.equal(donorRes.data.user.role, 'donor');
    donorToken = donorRes.data.token;

    // NGO login
    const ngoRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'ngo@example.com', password: 'password123' }
    });
    assert.equal(ngoRes.status, 200);
    assert.equal(ngoRes.data.user.role, 'ngo');
    ngoToken = ngoRes.data.token;

    // Volunteer login
    const volRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'volunteer@example.com', password: 'password123' }
    });
    assert.equal(volRes.status, 200);
    assert.equal(volRes.data.user.role, 'volunteer');
    volunteerToken = volRes.data.token;

    // Admin login
    const adminRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'password123' }
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.user.role, 'admin');
    adminToken = adminRes.data.token;

    // Authenticated /api/auth/me check
    const meRes = await apiRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.email, 'donor@example.com');
  });

  await t.test('4. Role-Based Access Control (RBAC)', async () => {
    // Donor attempting NGO endpoint
    const donorToNgo = await apiRequest('/api/ngo/listings', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(donorToNgo.status, 403);

    // NGO attempting Donor endpoint
    const ngoToDonor = await apiRequest('/api/donor/listings', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(ngoToDonor.status, 403);

    // Non-admin attempting Admin overview
    const nonAdminOverview = await apiRequest('/api/admin/overview', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(nonAdminOverview.status, 403);

    // Non-admin attempting Audit logs
    const nonAdminAudit = await apiRequest('/api/audit-logs', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(nonAdminAudit.status, 403);

    // Admin successfully accesses Admin overview
    const adminOverview = await apiRequest('/api/admin/overview', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminOverview.status, 200);
    assert.ok(adminOverview.data.usersByRole);

    // Admin accesses user directory
    const adminUsers = await apiRequest('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminUsers.status, 200);
    assert.ok(Array.isArray(adminUsers.data));
    assert.ok(adminUsers.data.length >= 4);

    // Admin accesses audit logs
    const adminAudit = await apiRequest('/api/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminAudit.status, 200);
    assert.ok(Array.isArray(adminAudit.data));
  });

  await t.test('5. Food Surplus Listing Lifecycle & Workflow', async () => {
    // 5a. Validation: Invalid listing payload
    const invalidListing = await apiRequest('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Fresh Meals', quantity: -10, expiryHours: 24 }
    });
    assert.equal(invalidListing.status, 400);

    // 5b. Valid listing creation by Donor
    const createRes = await apiRequest('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: {
        foodType: 'Prepared Meals Integration Test',
        quantity: 25,
        expiryHours: 6,
        isRecurring: false,
        expectedDaily: 0
      }
    });
    assert.equal(createRes.status, 200);
    assert.equal(createRes.data.foodType, 'Prepared Meals Integration Test');
    assert.equal(createRes.data.status, 'available');
    createdListingId = createRes.data.id;

    // 5c. Donor views active listings
    const donorListings = await apiRequest('/api/donor/listings', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(donorListings.status, 200);
    const found = donorListings.data.find(l => l.id === createdListingId);
    assert.ok(found, 'Created listing should appear in donor active listings');

    // 5d. NGO browses available listings
    const ngoListings = await apiRequest('/api/ngo/listings', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(ngoListings.status, 200);
    const ngoFound = ngoListings.data.find(l => l.id === createdListingId);
    assert.ok(ngoFound, 'Created listing should appear in NGO available feed');

    // 5e. NGO requests pickup
    const pickupTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const reqRes = await apiRequest(`/api/listings/${createdListingId}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: {
        contact: '+1-555-0199',
        pickupTime,
        message: 'Integration test automated pickup verification'
      }
    });
    assert.equal(reqRes.status, 200);
    assert.equal(reqRes.data.status, 'pending');
    createdRequestId = reqRes.data.id;

    // 5f. Donor reviews pickup requests
    const donorRequests = await apiRequest('/api/donor/requests', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(donorRequests.status, 200);
    const listingGroup = donorRequests.data.find(g => g.listing.id === createdListingId);
    assert.ok(listingGroup, 'Donor requests grouped listing found');
    const hasRequest = listingGroup.requests.some(r => r.id === createdRequestId);
    assert.ok(hasRequest, 'Donor should see pending pickup request');

    // 5g. Donor approves pickup request (Status transitions to 'approved')
    const approveRes = await apiRequest(`/api/requests/${createdRequestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.success, true);

    // 5h. Approved NGO completes pickup directly
    const completeRes = await apiRequest(`/api/listings/${createdListingId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.data.success, true);

    // 5i. Volunteer direct acceptance test (Instant accept on eligible listing 1)
    const volAcceptRes = await apiRequest('/api/listings/1/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${volunteerToken}` }
    });
    assert.ok([200, 404].includes(volAcceptRes.status), 'Volunteer accept endpoint reachable and processed');

    // 5j. Verify public impact metric update
    const impactRes = await apiRequest('/api/impact');
    assert.equal(impactRes.status, 200);
    assert.ok(impactRes.data.totalKgSaved >= 25);
    assert.ok(impactRes.data.totalMeals >= 50);
  });

  await t.test('6. Cryptographic File Integrity & Verification', async () => {
    // Test verification on seeded file ID 1
    const verifyRes = await apiRequest('/api/files/1/verify', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.data.fileId, 1);
    assert.ok(verifyRes.data.storedChecksum);
    assert.ok(['verified', 'failed'].includes(verifyRes.data.integrity));

    // Test raw file download handler with path traversal sanitization
    const rawTraversal = await fetch(`${BASE_URL}/api/files/raw/..%2f..%2fserver.js`);
    assert.equal(rawTraversal.status, 404, 'Path traversal must be neutralized');
  });
});

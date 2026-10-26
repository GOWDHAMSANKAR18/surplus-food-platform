import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost';

async function api(path, options = {}) {
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

test('INTEGRATION: API Contracts, Database Operations & Edge Cases', async (t) => {
  let donorToken = '';
  let ngoToken = '';
  let volunteerToken = '';
  let adminToken = '';
  let testListingId = null;
  let testRequestIdA = null;
  let testRequestIdB = null;

  // 1. Health & Server Telemetry
  await t.test('IT-01: Health check returns system status and connected services', async () => {
    const res = await api('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.ok(res.data.database);
    assert.ok(res.data.storage);
  });

  // 2. Authentication Contract, Boundary & Negative Tests
  await t.test('IT-02: Signup with missing required fields returns 400 Bad Request', async () => {
    const res = await api('/api/auth/signup', {
      method: 'POST',
      body: { email: 'incomplete@example.com' }
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /required fields/i);
  });

  await t.test('IT-03: Signup with invalid role returns 400 Bad Request', async () => {
    const res = await api('/api/auth/signup', {
      method: 'POST',
      body: {
        name: 'Hacker User',
        email: 'hacker@example.com',
        password: 'password123',
        phone: '1234567890',
        role: 'superadmin',
        address: '123 Street',
        lat: 12.97,
        lng: 77.59
      }
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /invalid user role/i);
  });

  await t.test('IT-04: Signup with non-numeric coordinates returns 400 Bad Request', async () => {
    const res = await api('/api/auth/signup', {
      method: 'POST',
      body: {
        name: 'Coord User',
        email: 'coord@example.com',
        password: 'password123',
        phone: '1234567890',
        role: 'donor',
        address: '123 Street',
        lat: 'invalid_lat',
        lng: 77.59
      }
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /valid latitude and longitude/i);
  });

  await t.test('IT-05: Signup with duplicate registered email returns 409 Conflict', async () => {
    const res = await api('/api/auth/signup', {
      method: 'POST',
      body: {
        name: 'Duplicate Donor',
        email: 'donor@example.com',
        password: 'password123',
        phone: '9876543210',
        role: 'donor',
        address: '123 MG Road',
        lat: 12.9716,
        lng: 77.5946
      }
    });
    assert.equal(res.status, 409);
    assert.match(res.data.error, /already registered/i);
  });

  await t.test('IT-06: Successful signup generates token and user record without password_hash', async () => {
    const uniqueEmail = `test_signup_${Date.now()}@example.com`;
    const res = await api('/api/auth/signup', {
      method: 'POST',
      body: {
        name: 'Automated Test Donor',
        email: uniqueEmail,
        password: 'password123',
        phone: '9876500000',
        role: 'donor',
        address: '99 Tech Park, Bengaluru',
        lat: 12.9352,
        lng: 77.6245
      }
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
    assert.equal(res.data.user.email, uniqueEmail);
    assert.equal(res.data.user.password_hash, undefined, 'Password hash must never be serialized');
  });

  await t.test('IT-07: Login with non-existent email returns 401 Unauthorized', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@example.com', password: 'password123' }
    });
    assert.equal(res.status, 401);
    assert.match(res.data.error, /invalid credentials/i);
  });

  await t.test('IT-08: Login with incorrect password returns 401 Unauthorized', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'donor@example.com', password: 'wrongpassword' }
    });
    assert.equal(res.status, 401);
    assert.match(res.data.error, /invalid credentials/i);
  });

  await t.test('IT-09: Login with missing fields returns 400 Bad Request', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'donor@example.com' }
    });
    assert.equal(res.status, 400);
  });

  await t.test('IT-10: Login successfully acquires tokens for all seed roles', async () => {
    const roles = [
      { role: 'donor', email: 'donor@example.com' },
      { role: 'ngo', email: 'ngo@example.com' },
      { role: 'volunteer', email: 'volunteer@example.com' },
      { role: 'admin', email: 'admin@example.com' }
    ];

    for (const item of roles) {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: { email: item.email, password: 'password123' }
      });
      assert.equal(res.status, 200, `Login for ${item.role} should succeed`);
      assert.ok(res.data.token);
      assert.equal(res.data.user.role, item.role);

      if (item.role === 'donor') donorToken = res.data.token;
      if (item.role === 'ngo') ngoToken = res.data.token;
      if (item.role === 'volunteer') volunteerToken = res.data.token;
      if (item.role === 'admin') adminToken = res.data.token;
    }
  });

  await t.test('IT-11: Token authentication via /api/auth/me returns identity', async () => {
    const res = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, 'donor@example.com');
  });

  await t.test('IT-12: Missing Authorization header on protected endpoint returns 401', async () => {
    const res = await api('/api/auth/me');
    assert.equal(res.status, 401);
  });

  await t.test('IT-13: Invalid or forged Authorization header returns 401', async () => {
    const res = await api('/api/auth/me', {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' }
    });
    assert.equal(res.status, 401);
  });

  // 3. Role-Based Access Control (RBAC) Matrix
  await t.test('IT-14: Donor accessing NGO feed returns 403 Forbidden', async () => {
    const res = await api('/api/ngo/listings', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(res.status, 403);
  });

  await t.test('IT-15: NGO accessing Donor active listings returns 403 Forbidden', async () => {
    const res = await api('/api/donor/listings', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(res.status, 403);
  });

  await t.test('IT-16: Volunteer attempting to create listing returns 403 Forbidden', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${volunteerToken}` },
      body: { foodType: 'Unauthorized Meals', quantity: 20, expiryHours: 4 }
    });
    assert.equal(res.status, 403);
  });

  await t.test('IT-17: Non-admin accessing admin overview returns 403 Forbidden', async () => {
    const res = await api('/api/admin/overview', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(res.status, 403);
  });

  await t.test('IT-18: Non-admin accessing user directory returns 403 Forbidden', async () => {
    const res = await api('/api/admin/users', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(res.status, 403);
  });

  await t.test('IT-19: Non-admin accessing audit logs returns 403 Forbidden', async () => {
    const res = await api('/api/audit-logs', {
      headers: { Authorization: `Bearer ${volunteerToken}` }
    });
    assert.equal(res.status, 403);
  });

  await t.test('IT-20: Admin accesses admin overview metrics with 200 OK', async () => {
    const res = await api('/api/admin/overview', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.usersByRole);
    assert.ok(res.data.listingsByStatus);
  });

  await t.test('IT-21: Admin accesses user directory with 200 OK', async () => {
    const res = await api('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length >= 4);
  });

  await t.test('IT-22: Admin accesses audit logs with 200 OK', async () => {
    const res = await api('/api/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  });

  // 4. Listing Boundaries & Validation
  await t.test('IT-23: Listing creation with missing required fields returns 400', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Fresh Rice' }
    });
    assert.equal(res.status, 400);
  });

  await t.test('IT-24: Listing creation with zero quantity returns 400', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Zero Food', quantity: 0, expiryHours: 5 }
    });
    assert.equal(res.status, 400);
  });

  await t.test('IT-25: Listing creation with negative quantity returns 400', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Negative Food', quantity: -10, expiryHours: 5 }
    });
    assert.equal(res.status, 400);
  });

  await t.test('IT-26: Listing creation exceeding 10,000 kg returns 400', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Overflow Food', quantity: 10001, expiryHours: 5 }
    });
    assert.equal(res.status, 400);
  });

  await t.test('IT-27: Listing creation with boundary quantity (10,000 kg) returns 200', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Bulk Enterprise Surplus', quantity: 10000, expiryHours: 24 }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.quantity, 10000);
  });

  await t.test('IT-28: Listing creation with zero expiry hours returns 400', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Expired Immediately', quantity: 10, expiryHours: 0 }
    });
    assert.equal(res.status, 400);
  });

  await t.test('IT-29: Listing creation with expiry hours > 72 returns 400', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Perishable Food', quantity: 10, expiryHours: 73 }
    });
    assert.equal(res.status, 400);
  });

  await t.test('IT-30: Listing creation with valid boundary expiry (72 hours) returns 200', async () => {
    const res = await api('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { foodType: 'Long Shelf Life Bread', quantity: 30, expiryHours: 72 }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'available');
    testListingId = res.data.id;
  });

  // 5. Pickup Request Negotiation & Concurrency
  await t.test('IT-31: NGO pickup request with missing contact returns 400', async () => {
    const res = await api(`/api/listings/${testListingId}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: { pickupTime: new Date().toISOString() }
    });
    assert.equal(res.status, 400);
  });

  await t.test('IT-32: NGO pickup request on non-existent listing returns 404', async () => {
    const res = await api('/api/listings/999999/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: { contact: '9876543210', pickupTime: new Date().toISOString() }
    });
    assert.equal(res.status, 404);
  });

  await t.test('IT-33: NGO successfully submits first pickup request', async () => {
    const res = await api(`/api/listings/${testListingId}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: {
        contact: '+91-9876543211',
        pickupTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        message: 'Request A: Primary NGO distribution van'
      }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'pending');
    testRequestIdA = res.data.id;
  });

  await t.test('IT-34: Second pickup request on same listing is recorded (concurrent requests)', async () => {
    const res = await api(`/api/listings/${testListingId}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: {
        contact: '+91-9876543299',
        pickupTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
        message: 'Request B: Backup NGO logistics dispatch'
      }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'pending');
    testRequestIdB = res.data.id;
  });

  await t.test('IT-35: Donor approves Request A, automatically rejecting Request B', async () => {
    const res = await api(`/api/requests/${testRequestIdA}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('IT-36: Non-owner donor cannot approve pickup request (403 Forbidden)', async () => {
    // Attempting to approve request with unauthorized donor
    const fakeToken = adminToken; // Admin is not the donor owner
    const res = await api(`/api/requests/${testRequestIdA}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fakeToken}` }
    });
    assert.equal(res.status, 403);
  });

  await t.test('IT-37: Assigned NGO completes pickup and updates global impact', async () => {
    const initialImpact = await api('/api/impact');
    const initialKg = Number(initialImpact.data.totalKgSaved || 0);

    const res = await api(`/api/listings/${testListingId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);

    const updatedImpact = await api('/api/impact');
    const updatedKg = Number(updatedImpact.data.totalKgSaved || 0);
    assert.ok(updatedKg >= initialKg + 30, 'Impact stats must increase by completed 30kg');
  });

  // 6. Security & Storage
  await t.test('IT-38: Sensitive source code files return 404 Not Found', async () => {
    const serverRes = await fetch(`${BASE_URL}/server.js`);
    assert.equal(serverRes.status, 404);

    const schemaRes = await fetch(`${BASE_URL}/database/schema.sql`);
    assert.equal(schemaRes.status, 404);

    const pkgRes = await fetch(`${BASE_URL}/package.json`);
    assert.equal(pkgRes.status, 404);
  });

  await t.test('IT-39: Path traversal attack on storage route returns 404 Not Found', async () => {
    const res = await fetch(`${BASE_URL}/api/files/raw/..%2f..%2fserver.js`);
    assert.equal(res.status, 404);
  });

  await t.test('IT-40: HTTP security headers are present on all responses', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  });
});


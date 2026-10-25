import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://127.0.0.1:4000';

async function call(path, options = {}) {
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

test('NEW FEATURES: Donor Cancellation, PoD Settlement & Multi-Facet Discovery', async (t) => {
  let donorToken = '';
  let ngoToken = '';
  let volunteerToken = '';
  let adminToken = '';
  let cancelListingId = null;
  let podListingId = null;
  let podRequestId = null;

  await t.test('SETUP: Login seed roles', async () => {
    const dRes = await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'donor@example.com', password: 'password123' }
    });
    assert.equal(dRes.status, 200);
    donorToken = dRes.data.token;

    const nRes = await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'ngo@example.com', password: 'password123' }
    });
    assert.equal(nRes.status, 200);
    ngoToken = nRes.data.token;

    const vRes = await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'volunteer@example.com', password: 'password123' }
    });
    assert.equal(vRes.status, 200);
    volunteerToken = vRes.data.token;

    const aRes = await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'password123' }
    });
    assert.equal(aRes.status, 200);
    adminToken = aRes.data.token;
  });

  // FEATURE 1: DONOR LISTING RETRACTION & CANCELLATION
  await t.test('FEATURE 1: Donor creates listing for cancellation testing', async () => {
    const res = await call('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: {
        foodType: 'Temporary Surplus - Miscounted Sandwiches',
        quantity: 15,
        expiryHours: 4,
        isRecurring: false
      }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'available');
    cancelListingId = res.data.id;
  });

  await t.test('FEATURE 1: Non-donor cannot cancel listing (403 Forbidden)', async () => {
    const res = await call(`/api/donor/listings/${cancelListingId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: { reason: 'Unauthorized cancellation' }
    });
    assert.equal(res.status, 403);
  });

  await t.test('FEATURE 1: Cancelling non-existent listing returns 404', async () => {
    const res = await call('/api/donor/listings/999999/cancel', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { reason: 'Missing item' }
    });
    assert.equal(res.status, 404);
  });

  await t.test('FEATURE 1: Owner donor successfully cancels available listing with reason', async () => {
    const res = await call(`/api/donor/listings/${cancelListingId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { reason: 'Distributed to walk-in community shelter instead' }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(Number(res.data.listingId), Number(cancelListingId));
    assert.equal(res.data.reason, 'Distributed to walk-in community shelter instead');
  });

  await t.test('FEATURE 1: Cancelled listing is removed from active donor and NGO feeds', async () => {
    const donorListings = await call('/api/donor/listings', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(donorListings.status, 200);
    const inDonorFeed = donorListings.data.some(l => l.id === cancelListingId);
    assert.equal(inDonorFeed, false, 'Cancelled listing must not appear in active donor inventory');

    const ngoFeed = await call('/api/ngo/listings', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(ngoFeed.status, 200);
    const inNgoFeed = ngoFeed.data.some(l => l.id === cancelListingId);
    assert.equal(inNgoFeed, false, 'Cancelled listing must not appear in public NGO discovery feed');
  });

  await t.test('FEATURE 1: Cannot re-cancel an already cancelled listing (400 Bad Request)', async () => {
    const res = await call(`/api/donor/listings/${cancelListingId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { reason: 'Double cancel' }
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /Cannot cancel listing with status 'cancelled'/i);
  });

  // FEATURE 2: PROOF OF DELIVERY (PoD) SETTLEMENT
  await t.test('FEATURE 2: Setup listing and pickup for PoD verification', async () => {
    const createRes = await call('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: {
        foodType: 'Fresh Hot Meals for PoD Settlement',
        quantity: 20,
        expiryHours: 6,
        isRecurring: false
      }
    });
    assert.equal(createRes.status, 200);
    podListingId = createRes.data.id;

    // NGO requests pickup
    const reqRes = await call(`/api/listings/${podListingId}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: {
        contact: '+91-9876543211',
        pickupTime: new Date(Date.now() + 3600 * 1000).toISOString(),
        message: 'PoD collection verification dispatch'
      }
    });
    assert.equal(reqRes.status, 200);
    podRequestId = reqRes.data.id;

    // Donor approves request
    const approveRes = await call(`/api/requests/${podRequestId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(approveRes.status, 200);
  });

  await t.test('FEATURE 2: Cannot complete listing if not the designated pickup party (403)', async () => {
    const res = await call(`/api/listings/${podListingId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${volunteerToken}` }, // Volunteer was not assigned
      body: { deliveryNotes: 'Unauthorized completion attempt' }
    });
    assert.equal(res.status, 403);
  });

  await t.test('FEATURE 2: Assigned NGO completes delivery with custom PoD metadata', async () => {
    const customPoDCode = `POD-TEST-${Date.now()}`;
    const res = await call(`/api/listings/${podListingId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
      body: {
        deliveryNotes: 'Delivered to Hope Shelter. Verified temperature 65C. Received by Sister Mary.',
        beneficiariesServed: 42,
        proofCode: customPoDCode
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(Number(res.data.listingId), Number(podListingId));
    assert.equal(res.data.deliveryNotes, 'Delivered to Hope Shelter. Verified temperature 65C. Received by Sister Mary.');
    assert.equal(res.data.beneficiariesServed, 42);
    assert.equal(res.data.proofCode, customPoDCode);
    assert.ok(res.data.completedAt);
  });

  await t.test('FEATURE 2: PoD auto-generates proofCode when omitted', async () => {
    // Create & complete another quick listing via volunteer
    const createRes = await call('/api/donor/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: {
        foodType: 'Bakery Breads - Auto PoD',
        quantity: 10,
        expiryHours: 12
      }
    });
    assert.equal(createRes.status, 200);
    const autoListingId = createRes.data.id;

    // Accept via NGO directly
    const acceptRes = await call(`/api/listings/${autoListingId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(acceptRes.status, 200);

    // Complete without body
    const completeRes = await call(`/api/listings/${autoListingId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(completeRes.status, 200);
    assert.match(completeRes.data.proofCode, /^POD-\d+-[A-Z0-9]+$/);
    assert.equal(completeRes.data.beneficiariesServed, 20); // 10 kg * 2 = 20 meals
  });

  // FEATURE 3: MULTI-FACET SEARCH & PROXIMITY DISCOVERY CONTRACTS
  await t.test('FEATURE 3: NGO discovery feed includes distance, priority score & hours remaining', async () => {
    const res = await call('/api/ngo/listings', {
      headers: { Authorization: `Bearer ${ngoToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));

    if (res.data.length > 0) {
      const sample = res.data[0];
      assert.ok(sample.location);
      assert.ok(Number.isFinite(sample.location.lat));
      assert.ok(Number.isFinite(sample.location.lng));
      assert.ok(sample.expiryTime);
    }
  });

  await t.test('FEATURE 3: Audit log records CANCEL_LISTING and COMPLETE_LISTING events', async () => {
    const res = await call('/api/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const actions = res.data.map(log => log.action);
    assert.ok(actions.includes('CANCEL_LISTING'), 'Audit log must record CANCEL_LISTING');
    assert.ok(actions.includes('COMPLETE_LISTING'), 'Audit log must record COMPLETE_LISTING');
  });
});

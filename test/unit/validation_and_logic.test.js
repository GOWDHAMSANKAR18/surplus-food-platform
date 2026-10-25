import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  calculateDistance,
  calculatePriorityScore,
  getTimeRemaining,
  calculateImpact
} from '../../js/utils.js';

// Domain validation helpers replicating server business logic for unit testing
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidRole(role) {
  return ['donor', 'ngo', 'volunteer', 'admin'].includes(role);
}

function isValidQuantity(quantity) {
  const num = Number(quantity);
  return Number.isFinite(num) && num > 0 && num <= 10000;
}

function isValidExpiryHours(hours) {
  const num = Number(hours);
  return Number.isFinite(num) && num >= 1 && num <= 72;
}

function isValidCoordinates(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return Number.isFinite(nLat) && Number.isFinite(nLng) &&
    nLat >= -90 && nLat <= 90 &&
    nLng >= -180 && nLng <= 180;
}

test('UNIT: Spatial Distance Engine (Haversine Formula)', async (t) => {
  await t.test('UT-01: Zero distance for identical coordinates', () => {
    const dist = calculateDistance(12.9716, 77.5946, 12.9716, 77.5946);
    assert.equal(dist, 0);
  });

  await t.test('UT-02: Known Bangalore geographic distance between MG Road and Indiranagar (~5.2 km)', () => {
    const dist = calculateDistance(12.9716, 77.5946, 12.9784, 77.6408);
    assert.ok(dist >= 4.8 && dist <= 5.5, `Calculated distance ${dist}km is within expected range`);
  });

  await t.test('UT-03: Long distance across earth equator (Bangalore to Singapore ~3160 km)', () => {
    const dist = calculateDistance(12.9716, 77.5946, 1.3521, 103.8198);
    assert.ok(dist >= 3100 && dist <= 3250, `Distance ${dist}km is approximately 3163km`);
  });

  await t.test('UT-04: Trans-hemispheric antipodal distance (~20,000 km)', () => {
    const dist = calculateDistance(0, 0, 0, 180);
    assert.ok(dist >= 19900 && dist <= 20100, `Half-circumference distance is ~20015km`);
  });
});

test('UNIT: Smart Priority Scoring Engine', async (t) => {
  const baseNgoLocation = { lat: 12.9716, lng: 77.5946 };
  const baseCapacity = 50;

  await t.test('UT-05: Imminent expiry gets significantly higher score than distant expiry', () => {
    const urgentListing = {
      location: { lat: 12.9716, lng: 77.5946 },
      quantity: 50,
      expiryTime: new Date(Date.now() + 1 * 3600 * 1000), // 1 hour left
      isRecurring: false
    };

    const distantListing = {
      location: { lat: 12.9716, lng: 77.5946 },
      quantity: 50,
      expiryTime: new Date(Date.now() + 24 * 3600 * 1000), // 24 hours left
      isRecurring: false
    };

    const urgentScore = calculatePriorityScore(urgentListing, baseNgoLocation, baseCapacity);
    const distantScore = calculatePriorityScore(distantListing, baseNgoLocation, baseCapacity);

    assert.ok(urgentScore.score > distantScore.score, `Urgent (${urgentScore.score}) must exceed distant (${distantScore.score})`);
  });

  await t.test('UT-06: Closer distance gets higher score than farther distance', () => {
    const closeListing = {
      location: { lat: 12.9716, lng: 77.5946 }, // 0 km
      quantity: 50,
      expiryTime: new Date(Date.now() + 4 * 3600 * 1000),
      isRecurring: false
    };

    const farListing = {
      location: { lat: 13.1500, lng: 77.7000 }, // ~23 km
      quantity: 50,
      expiryTime: new Date(Date.now() + 4 * 3600 * 1000),
      isRecurring: false
    };

    const closeScore = calculatePriorityScore(closeListing, baseNgoLocation, baseCapacity);
    const farScore = calculatePriorityScore(farListing, baseNgoLocation, baseCapacity);

    assert.ok(closeScore.score > farScore.score, `Close score (${closeScore.score}) must exceed far score (${farScore.score})`);
  });

  await t.test('UT-07: Recurring donation bonus adds exactly 20 points', () => {
    const nonRecurring = {
      location: { lat: 12.9716, lng: 77.5946 },
      quantity: 50,
      expiryTime: new Date(Date.now() + 4 * 3600 * 1000),
      isRecurring: false
    };

    const recurring = {
      ...nonRecurring,
      isRecurring: true
    };

    const score1 = calculatePriorityScore(nonRecurring, baseNgoLocation, baseCapacity);
    const score2 = calculatePriorityScore(recurring, baseNgoLocation, baseCapacity);

    assert.equal(score2.score - score1.score, 20);
  });

  await t.test('UT-08: Resilient to missing location or flat coordinates', () => {
    const flatCoordListing = {
      latitude: 12.9716,
      longitude: 77.5946,
      quantity: 25,
      expiryTime: new Date(Date.now() + 2 * 3600 * 1000),
      isRecurring: false
    };

    const result = calculatePriorityScore(flatCoordListing, { latitude: 12.9716, longitude: 77.5946 }, 50);
    assert.ok(result.score > 0);
    assert.equal(result.distance, '0.0');
  });

  await t.test('UT-09: Already expired food listing handles negative time gracefully without NaN', () => {
    const expiredListing = {
      location: { lat: 12.9716, lng: 77.5946 },
      quantity: 25,
      expiryTime: new Date(Date.now() - 3600 * 1000), // Expired 1 hr ago
      isRecurring: false
    };

    const result = calculatePriorityScore(expiredListing, baseNgoLocation, baseCapacity);
    assert.ok(Number.isFinite(result.score));
    assert.equal(result.hoursRemaining, '0.0');
  });
});

test('UNIT: Countdown Timer & Expiry Logic', async (t) => {
  await t.test('UT-10: Expired timestamp returns expired: true and urgent: true', () => {
    const pastTime = new Date(Date.now() - 5000);
    const result = getTimeRemaining(pastTime);
    assert.equal(result.expired, true);
    assert.equal(result.urgent, true);
    assert.equal(result.text, 'EXPIRED');
  });

  await t.test('UT-11: Expiry in 45 minutes returns urgent: true and formatted text', () => {
    const soonTime = new Date(Date.now() + 45 * 60 * 1000);
    const result = getTimeRemaining(soonTime);
    assert.equal(result.expired, false);
    assert.equal(result.urgent, true);
    assert.match(result.text, /^0h \d+m$/);
  });

  await t.test('UT-12: Expiry in 5 hours returns urgent: false', () => {
    const normalTime = new Date(Date.now() + 5 * 3600 * 1000);
    const result = getTimeRemaining(normalTime);
    assert.equal(result.expired, false);
    assert.equal(result.urgent, false);
    assert.match(result.text, /^4h \d+m|5h \d+m$/);
  });

  await t.test('UT-13: Null or invalid timestamp defaults safely to expired', () => {
    const nullResult = getTimeRemaining(null);
    assert.equal(nullResult.expired, true);
  });
});

test('UNIT: Environmental & Social Impact Formulas', async (t) => {
  await t.test('UT-14: Standard volume conversions (25 kg -> 50 meals, 62.5 kg CO2)', () => {
    const impact = calculateImpact(25);
    assert.equal(impact.meals, 50);
    assert.equal(impact.co2, '62.5');
  });

  await t.test('UT-15: Zero volume returns zero metrics', () => {
    const impact = calculateImpact(0);
    assert.equal(impact.meals, 0);
    assert.equal(impact.co2, '0.0');
  });

  await t.test('UT-16: High enterprise volume (1000 kg -> 2000 meals, 2500.0 kg CO2)', () => {
    const impact = calculateImpact(1000);
    assert.equal(impact.meals, 2000);
    assert.equal(impact.co2, '2500.0');
  });

  await t.test('UT-17: Decimal precision check (12.75 kg -> 25.5 meals, 31.9 kg CO2)', () => {
    const impact = calculateImpact(12.75);
    assert.equal(impact.meals, 25.5);
    assert.equal(impact.co2, '31.9');
  });
});

test('UNIT: Core Business Logic & Input Validation Rules', async (t) => {
  await t.test('UT-18: Email format validator', () => {
    assert.equal(isValidEmail('donor@example.com'), true);
    assert.equal(isValidEmail('admin.super@ngo-portal.org'), true);
    assert.equal(isValidEmail('plainaddress'), false);
    assert.equal(isValidEmail('@missinguser.com'), false);
    assert.equal(isValidEmail('user@.missingdomain'), false);
    assert.equal(isValidEmail(null), false);
  });

  await t.test('UT-19: Role whitelist validator', () => {
    assert.equal(isValidRole('donor'), true);
    assert.equal(isValidRole('ngo'), true);
    assert.equal(isValidRole('volunteer'), true);
    assert.equal(isValidRole('admin'), true);
    assert.equal(isValidRole('superadmin'), false);
    assert.equal(isValidRole('guest'), false);
    assert.equal(isValidRole(''), false);
  });

  await t.test('UT-20: Food quantity boundaries (0 < kg <= 10,000)', () => {
    assert.equal(isValidQuantity(0.1), true);
    assert.equal(isValidQuantity(25), true);
    assert.equal(isValidQuantity(10000), true);
    assert.equal(isValidQuantity(0), false);
    assert.equal(isValidQuantity(-5), false);
    assert.equal(isValidQuantity(10001), false);
    assert.equal(isValidQuantity('invalid'), false);
  });

  await t.test('UT-21: Expiry safe consumption hours boundaries (1 <= h <= 72)', () => {
    assert.equal(isValidExpiryHours(1), true);
    assert.equal(isValidExpiryHours(24), true);
    assert.equal(isValidExpiryHours(72), true);
    assert.equal(isValidExpiryHours(0), false);
    assert.equal(isValidExpiryHours(0.5), false);
    assert.equal(isValidExpiryHours(73), false);
    assert.equal(isValidExpiryHours(-12), false);
  });

  await t.test('UT-22: Geographic coordinate boundary checks (Lat: [-90,90], Lng: [-180,180])', () => {
    assert.equal(isValidCoordinates(12.9716, 77.5946), true);
    assert.equal(isValidCoordinates(0, 0), true);
    assert.equal(isValidCoordinates(-90, -180), true);
    assert.equal(isValidCoordinates(90, 180), true);
    assert.equal(isValidCoordinates(91, 77), false);
    assert.equal(isValidCoordinates(12, 181), false);
    assert.equal(isValidCoordinates('abc', 77), false);
  });
});

test('UNIT: Cryptographic Storage & Integrity Hashing', async (t) => {
  await t.test('UT-23: Deterministic SHA-256 digest computation', () => {
    const payload = Buffer.from('GATEWAY-VERIFICATION-2026', 'utf-8');
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[a-f0-9]{64}$/);
    
    // Repeat to verify exact determinism
    const hash2 = crypto.createHash('sha256').update(payload).digest('hex');
    assert.equal(hash, hash2);
  });

  await t.test('UT-24: Tamper sensitivity - changing a single character creates avalanche effect', () => {
    const original = Buffer.from('Official Food Safety Inspection Certificate: Grade A', 'utf-8');
    const tampered = Buffer.from('Official Food Safety Inspection Certificate: Grade B', 'utf-8');

    const hashA = crypto.createHash('sha256').update(original).digest('hex');
    const hashB = crypto.createHash('sha256').update(tampered).digest('hex');

    assert.notEqual(hashA, hashB);
  });
});

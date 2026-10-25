import test from 'node:test';
import assert from 'node:assert/strict';

import { 
  calculateDistance, 
  calculatePriorityScore, 
  getTimeRemaining, 
  calculateImpact 
} from '../../js/utils.js';
import { calculateSHA256 } from '../../services/s3Service.js';

test('Utility: Haversine distance calculation', () => {
  // Distance between MG Road and Indiranagar Bengaluru (~4-5 km)
  const d = calculateDistance(12.9715987, 77.5945627, 12.9783692, 77.6408356);
  assert.ok(d > 4 && d < 6, `Expected distance ~5km, got ${d}`);

  // Same coordinates should be 0 km
  const same = calculateDistance(12.97, 77.59, 12.97, 77.59);
  assert.equal(Math.round(same), 0);
});

test('Utility: Smart Priority Algorithm scoring weights', () => {
  const listing = {
    location: { lat: 12.9715987, lng: 77.5945627 },
    expiryTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // 2 hours remaining
    quantity: 30,
    isRecurring: false
  };
  const ngoLocation = { lat: 12.9783692, lng: 77.6408356 };
  const ngoCapacity = 50;

  const result = calculatePriorityScore(listing, ngoLocation, ngoCapacity);
  assert.ok(result.score > 0, 'Score should be positive');
  assert.ok(result.score <= 120, 'Score should be bounded');
  assert.equal(typeof result.distance, 'string');
  assert.equal(typeof result.hoursRemaining, 'string');

  // Recurring listing gets +20 bonus
  const recurringListing = { ...listing, isRecurring: true };
  const recurringResult = calculatePriorityScore(recurringListing, ngoLocation, ngoCapacity);
  assert.equal(recurringResult.score, result.score + 20, 'Recurring listing must include +20 bonus');
});

test('Utility: Countdown timer calculations', () => {
  // Urgent: 1 hour remaining
  const oneHour = new Date(Date.now() + 3600 * 1000);
  const urgent = getTimeRemaining(oneHour);
  assert.equal(urgent.expired, false);
  assert.equal(urgent.urgent, true);

  // Safe: 5 hours remaining
  const fiveHours = new Date(Date.now() + 5 * 3600 * 1000);
  const safe = getTimeRemaining(fiveHours);
  assert.equal(safe.expired, false);
  assert.equal(safe.urgent, false);

  // Expired: past
  const past = new Date(Date.now() - 3600 * 1000);
  const expired = getTimeRemaining(past);
  assert.equal(expired.expired, true);
  assert.equal(expired.text, 'EXPIRED');
});

test('Utility: Environmental impact formula', () => {
  const impact = calculateImpact(100);
  assert.equal(impact.meals, 200, '100 kg should provide 200 meals');
  assert.equal(impact.co2, '250.0', '100 kg should prevent 250 kg of CO2');
});

test('Security & Storage: SHA-256 cryptographic digest calculation', () => {
  const buffer = Buffer.from('GATE-WAY Surplus Food Platform Test Buffer');
  const hash = calculateSHA256(buffer);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64, 'SHA-256 hex string must be exactly 64 characters');
  
  // Consistency check
  const hash2 = calculateSHA256(buffer);
  assert.equal(hash, hash2, 'SHA-256 must be deterministic');
});

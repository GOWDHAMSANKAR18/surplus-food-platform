import { query } from '../database/db.js';

export async function expireListings() {
  const result = await query(
    `UPDATE food_listings
     SET status = 'expired'
     WHERE status IN ('available', 'requested')
       AND expiry_time <= NOW()`
  );
  const processed = Number(result?.affectedRows || 0);
  if (processed > 0) console.log(`[Expiration] Marked ${processed} listing(s) as expired`);
  return processed;
}

export function startExpirationScheduler() {
  const intervalMs = 5 * 60 * 1000;
  const run = () => expireListings().catch((error) => {
    console.error('[Expiration] Failed to process expired listings:', error.message);
  });
  run();
  return setInterval(run, intervalMs);
}

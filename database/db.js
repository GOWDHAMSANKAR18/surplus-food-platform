import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306', 10);
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'food_donation';

let pool = null;
let isConnected = false;
let mockDb = null;

// Initialize MySQL Connection Pool
try {
  pool = mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
    dateStrings: true
  });
} catch (err) {
  console.warn('[Database Warning] Failed to instantiate MySQL pool:', err.message);
}

// In-Memory SQLite/Mock Fallback Engine for Development without live MySQL
class InMemMockDb {
  constructor() {
    this.users = [];
    this.listings = [];
    this.requests = [];
    this.files = [];
    this.impact = [{ id: 1, total_kg_saved: 40.0, total_meals: 80, total_co2_prevented: 100.0 }];
    this.audit = [];
    this.seedDefaults();
  }

  seedDefaults() {
    this.users = [
      {
        id: 1,
        name: 'Green Palace Hotel',
        email: 'donor@example.com',
        password_hash: '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6',
        phone: '9876543210',
        role: 'donor',
        address: '123 MG Road, Bengaluru',
        latitude: 12.9715987,
        longitude: 77.5945627,
        capacity: null,
        verified: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Hope Foundation NGO',
        email: 'ngo@example.com',
        password_hash: '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6',
        phone: '9876543211',
        role: 'ngo',
        address: '45 Indiranagar, Bengaluru',
        latitude: 12.9783692,
        longitude: 77.6408356,
        capacity: 50,
        verified: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        name: 'Alex Volunteer',
        email: 'volunteer@example.com',
        password_hash: '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6',
        phone: '9876543212',
        role: 'volunteer',
        address: '78 Koramangala, Bengaluru',
        latitude: 12.9352422,
        longitude: 77.6244806,
        capacity: null,
        verified: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 4,
        name: 'Platform Admin',
        email: 'admin@example.com',
        password_hash: '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6',
        phone: '9876543213',
        role: 'admin',
        address: 'Headquarters, Bengaluru',
        latitude: 12.9715987,
        longitude: 77.5945627,
        capacity: null,
        verified: 1,
        created_at: new Date().toISOString()
      }
    ];

    const fourHoursLater = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    const sixHoursLater = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    this.listings = [
      {
        id: 1,
        donor_id: 1,
        food_type: 'Cooked Rice & Dal (50 portions)',
        quantity_kg: 25.0,
        expiry_time: fourHoursLater,
        address: '123 MG Road, Bengaluru',
        latitude: 12.9715987,
        longitude: 77.5945627,
        status: 'available',
        approved_ngo_id: null,
        accepted_by: null,
        accepted_by_id: null,
        accepted_at: null,
        completed_at: null,
        is_recurring: 0,
        expected_daily_surplus: 0.0,
        volunteer_eligible_at: thirtyMinsAgo,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        donor_id: 1,
        food_type: 'Fresh Bread & Pastries',
        quantity_kg: 15.0,
        expiry_time: sixHoursLater,
        address: '123 MG Road, Bengaluru',
        latitude: 12.9715987,
        longitude: 77.5945627,
        status: 'available',
        approved_ngo_id: null,
        accepted_by: null,
        accepted_by_id: null,
        accepted_at: null,
        completed_at: null,
        is_recurring: 1,
        expected_daily_surplus: 15.0,
        volunteer_eligible_at: thirtyMinsAgo,
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        donor_id: 1,
        food_type: 'Vegetable Curry & Chapati',
        quantity_kg: 40.0,
        expiry_time: oneHourAgo,
        address: '123 MG Road, Bengaluru',
        latitude: 12.9715987,
        longitude: 77.5945627,
        status: 'completed',
        approved_ngo_id: 2,
        accepted_by: 'Hope Foundation NGO',
        accepted_by_id: 2,
        accepted_at: twoHoursAgo,
        completed_at: oneHourAgo,
        is_recurring: 0,
        expected_daily_surplus: 0.0,
        volunteer_eligible_at: twoHoursAgo,
        created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
      }
    ];

    this.requests = [
      {
        id: 1,
        listing_id: 3,
        ngo_id: 2,
        contact: '9876543211',
        pickup_time: twoHoursAgo,
        message: 'We can collect immediately using our van.',
        status: 'approved',
        requested_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
      }
    ];

    this.files = [
      {
        id: 1,
        listing_id: 3,
        uploaded_by: 1,
        original_filename: 'sample_food_proof.jpg',
        object_key: 'listings/3/sample-food-proof.jpg',
        content_type: 'image/jpeg',
        file_size: 245820,
        sha256_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        upload_status: 'uploaded',
        uploaded_at: new Date().toISOString()
      }
    ];

    this.audit = [
      {
        id: 1,
        user_id: 1,
        action: 'CREATE_LISTING',
        entity_type: 'food_listings',
        entity_id: 1,
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        user_id: 2,
        action: 'PICKUP_REQUEST',
        entity_type: 'pickup_requests',
        entity_id: 1,
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString()
      }
    ];
  }
}

mockDb = new InMemMockDb();

/**
 * Execute parameterized SQL Query against MySQL.
 * Falls back to in-memory store if MySQL is not running locally.
 */
export async function query(sql, params = []) {
  if (pool) {
    try {
      const [rows] = await pool.query(sql, params);
      isConnected = true;
      return rows;
    } catch (error) {
      if (!isConnected) {
        console.warn(`[MySQL Connection Notice] Could not connect to MySQL server at ${MYSQL_HOST}:${MYSQL_PORT} (${error.code || error.message}). Using development database engine.`);
      } else {
        throw error;
      }
    }
  }

  // Local fallback processing if MySQL server is offline during dev execution
  return handleMockQuery(sql, params);
}

function handleMockQuery(sql, params) {
  const normalizedSql = sql.trim().replace(/\s+/g, ' ');

  // Helper to attach donor_name to listing
  const attachDonorName = (l) => {
    const donor = mockDb.users.find(u => u.id === l.donor_id);
    return { ...l, donor_name: donor ? donor.name : 'Donor' };
  };

  // 1. SELECT users by email
  if (normalizedSql.match(/SELECT \* FROM users WHERE email = \?/i)) {
    const user = mockDb.users.find(u => u.email === params[0]);
    return user ? [user] : [];
  }

  // 2. SELECT user by id
  if (normalizedSql.match(/SELECT \* FROM users WHERE id = \?/i)) {
    const user = mockDb.users.find(u => u.id === Number(params[0]));
    return user ? [user] : [];
  }

  // 3. SELECT all users (for backup or admin list)
  if (normalizedSql.match(/SELECT .* FROM users( ORDER BY|$)/i)) {
    return mockDb.users;
  }

  // 4. INSERT INTO users
  if (normalizedSql.match(/INSERT INTO users/i)) {
    const newId = mockDb.users.length ? Math.max(...mockDb.users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: newId,
      name: params[0],
      email: params[1],
      password_hash: params[2],
      phone: params[3],
      role: params[4],
      address: params[5],
      latitude: Number(params[6]),
      longitude: Number(params[7]),
      capacity: params[8] != null ? Number(params[8]) : null,
      verified: params[4] === 'ngo' ? 1 : 0,
      created_at: new Date().toISOString()
    };
    mockDb.users.push(newUser);
    return { insertId: newId, affectedRows: 1 };
  }

  // 5. SELECT impact_stats
  if (normalizedSql.match(/SELECT \* FROM impact_stats/i)) {
    return mockDb.impact;
  }

  // 6. SELECT recent completed listings
  if (normalizedSql.match(/FROM food_listings.*WHERE.*status = 'completed'/i)) {
    if (normalizedSql.match(/quantity_kg FROM/i)) {
      if (normalizedSql.match(/donor_id = \?/i)) {
        return mockDb.listings.filter(l => l.donor_id === Number(params[0]) && l.status === 'completed').map(l => ({ quantity_kg: l.quantity_kg }));
      }
      if (normalizedSql.match(/approved_ngo_id = \?/i)) {
        return mockDb.listings.filter(l => l.approved_ngo_id === Number(params[0]) && l.status === 'completed').map(l => ({ quantity_kg: l.quantity_kg }));
      }
      if (normalizedSql.match(/accepted_by_id = \?/i)) {
        return mockDb.listings.filter(l => l.accepted_by_id === Number(params[0]) && l.status === 'completed').map(l => ({ quantity_kg: l.quantity_kg }));
      }
      return mockDb.listings.filter(l => l.status === 'completed').map(l => ({ address: l.address, quantity_kg: l.quantity_kg }));
    }
    return mockDb.listings.filter(l => l.status === 'completed').map(attachDonorName);
  }

  // 7. SELECT donor listings
  if (normalizedSql.match(/FROM food_listings.*WHERE.*donor_id = \?/i)) {
    return mockDb.listings.filter(l => l.donor_id === Number(params[0]) && ['available', 'approved', 'accepted'].includes(l.status)).map(attachDonorName);
  }

  // 8. SELECT accepted listings for NGO
  if (normalizedSql.match(/FROM food_listings.*WHERE.*approved_ngo_id = \? AND l\.status = 'accepted'/i)) {
    return mockDb.listings.filter(l => l.approved_ngo_id === Number(params[0]) && l.status === 'accepted').map(attachDonorName);
  }

  // 9. SELECT accepted listings for Volunteer
  if (normalizedSql.match(/FROM food_listings.*WHERE.*accepted_by_id = \? AND l\.status = 'accepted'/i)) {
    return mockDb.listings.filter(l => l.accepted_by_id === Number(params[0]) && l.status === 'accepted').map(attachDonorName);
  }

  // 10. SELECT available listings (NGO / Volunteer)
  if (normalizedSql.match(/FROM food_listings.*WHERE.*status = 'available'/i)) {
    const requestedId = normalizedSql.match(/id = \?/i) ? Number(params[0]) : null;
    if (normalizedSql.match(/volunteer_eligible_at/i)) {
      return mockDb.listings
        .filter(l => l.status === 'available' && (requestedId == null || l.id === requestedId) && new Date(l.volunteer_eligible_at) <= new Date())
        .map(attachDonorName);
    }
    return mockDb.listings
      .filter(l => l.status === 'available' && (requestedId == null || l.id === requestedId))
      .map(attachDonorName);
  }

  // 11. SELECT single food_listing by id
  if (normalizedSql.match(/FROM food_listings.*WHERE.*(l\.id|id) = \?/i)) {
    const l = mockDb.listings.find(item => item.id === Number(params[0]));
    return l ? [attachDonorName(l)] : [];
  }

  // 12. SELECT all food_listings
  if (normalizedSql.match(/SELECT \* FROM food_listings/i)) {
    return mockDb.listings;
  }

  // 13. INSERT INTO food_listings
  if (normalizedSql.match(/INSERT INTO food_listings/i)) {
    const newId = mockDb.listings.length ? Math.max(...mockDb.listings.map(l => l.id)) + 1 : 1;
    const newListing = {
      id: newId,
      donor_id: Number(params[0]),
      food_type: params[1],
      quantity_kg: Number(params[2]),
      expiry_time: params[3],
      address: params[4],
      latitude: Number(params[5]),
      longitude: Number(params[6]),
      status: 'available',
      approved_ngo_id: null,
      accepted_by: null,
      accepted_by_id: null,
      accepted_at: null,
      completed_at: null,
      is_recurring: params[7] ? 1 : 0,
      expected_daily_surplus: Number(params[8] || 0),
      volunteer_eligible_at: params[9],
      created_at: new Date().toISOString()
    };
    mockDb.listings.push(newListing);
    return { insertId: newId, affectedRows: 1 };
  }

  // 14. SELECT pickup_requests with join for donor
  if (normalizedSql.match(/FROM pickup_requests.*WHERE.*listing_id IN/i)) {
    const listingIds = params.map(Number);
    return mockDb.requests.filter(r => listingIds.includes(r.listing_id)).map(r => {
      const ngo = mockDb.users.find(u => u.id === r.ngo_id);
      return { ...r, ngo_name: ngo ? ngo.name : 'NGO' };
    });
  }

  // 15. SELECT single pickup_request by id
  if (normalizedSql.match(/FROM pickup_requests.*WHERE.*(r\.id|id) = \?/i)) {
    const req = mockDb.requests.find(r => r.id === Number(params[0]));
    if (!req) return [];
    const ngo = mockDb.users.find(u => u.id === req.ngo_id);
    return [{ ...req, ngo_name: ngo ? ngo.name : 'NGO' }];
  }

  // 16. SELECT all pickup_requests
  if (normalizedSql.match(/SELECT \* FROM pickup_requests/i)) {
    return mockDb.requests;
  }

  // 17. INSERT INTO pickup_requests
  if (normalizedSql.match(/INSERT INTO pickup_requests/i)) {
    const newId = mockDb.requests.length ? Math.max(...mockDb.requests.map(r => r.id)) + 1 : 1;
    const req = {
      id: newId,
      listing_id: Number(params[0]),
      ngo_id: Number(params[1]),
      contact: params[2],
      pickup_time: params[3],
      message: params[4] || '',
      status: 'pending',
      requested_at: new Date().toISOString()
    };
    mockDb.requests.push(req);
    return { insertId: newId, affectedRows: 1 };
  }

  // 18. UPDATE pickup_requests
  if (normalizedSql.match(/UPDATE pickup_requests SET status =/i)) {
    if (sql.includes('approved_at')) {
      const req = mockDb.requests.find(r => r.id === Number(params[1]));
      if (req) {
        req.status = 'approved';
        req.approved_at = params[0];
      }
    } else if (sql.includes('rejected')) {
      const listingId = Number(params[0]);
      if (params.length > 1) {
        const reqId = Number(params[1]);
        mockDb.requests.forEach(r => {
          if (r.listing_id === listingId && r.id !== reqId) r.status = 'rejected';
        });
      } else {
        mockDb.requests.forEach(r => {
          if (r.listing_id === listingId && r.status === 'pending') r.status = 'rejected';
        });
      }
    } else if (sql.includes('completed')) {
      const listingId = Number(params[0]);
      mockDb.requests.forEach(r => {
        if (r.listing_id === listingId && r.status === 'approved') r.status = 'completed';
      });
    }
    return { affectedRows: 1 };
  }

  // 19. UPDATE food_listings status
  if (normalizedSql.match(/UPDATE food_listings SET/i)) {
    const l = mockDb.listings.find(item => item.id === Number(params[params.length - 1]));
    if (sql.includes("status = 'accepted'") && (!l || l.status !== 'available')) {
      return { affectedRows: 0 };
    }
    if (sql.includes("status = 'completed'") && (!l || !['accepted', 'approved'].includes(l.status))) {
      return { affectedRows: 0 };
    }
    if (l) {
      if (sql.includes('approved')) {
        l.status = 'approved';
        l.approved_ngo_id = Number(params[0]);
        l.accepted_by = params[1];
        l.accepted_by_id = Number(params[2]);
        l.accepted_at = params[3];
      } else if (sql.includes('accepted')) {
        l.status = 'accepted';
        l.accepted_by = params[0];
        l.accepted_by_id = Number(params[1]);
        l.accepted_at = params[2];
        if (params[3]) l.approved_ngo_id = Number(params[3]);
      } else if (sql.includes('completed')) {
        l.status = 'completed';
        l.completed_at = params[0];
      } else if (sql.includes('cancelled')) {
        l.status = 'cancelled';
      }
    }
    return { affectedRows: 1 };
  }

  // 20. UPDATE impact_stats
  if (normalizedSql.match(/UPDATE impact_stats/i)) {
    if (mockDb.impact[0]) {
      mockDb.impact[0].total_kg_saved += Number(params[0] || 0);
      mockDb.impact[0].total_meals += Number(params[1] || 0);
      mockDb.impact[0].total_co2_prevented += Number(params[2] || 0);
    }
    return { affectedRows: 1 };
  }

  // 21. INSERT INTO file_uploads
  if (normalizedSql.match(/INSERT INTO file_uploads/i)) {
    const newId = mockDb.files.length ? Math.max(...mockDb.files.map(f => f.id)) + 1 : 1;
    const newFile = {
      id: newId,
      listing_id: params[0] != null ? Number(params[0]) : null,
      uploaded_by: Number(params[1]),
      original_filename: params[2],
      object_key: params[3],
      content_type: params[4],
      file_size: Number(params[5]),
      sha256_checksum: params[6],
      storage_backend: params[7] || 'local',
      upload_status: 'uploaded',
      uploaded_at: new Date().toISOString()
    };
    mockDb.files.push(newFile);
    return { insertId: newId, affectedRows: 1 };
  }

  // 22. SELECT file_uploads by listing_id
  if (normalizedSql.match(/SELECT \* FROM file_uploads WHERE listing_id = \?/i)) {
    return mockDb.files.filter(f => f.listing_id === Number(params[0]));
  }

  // 23. SELECT file_uploads by id
  if (normalizedSql.match(/SELECT \* FROM file_uploads WHERE id = \?/i)) {
    const file = mockDb.files.find(f => f.id === Number(params[0]));
    return file ? [file] : [];
  }

  // 24. SELECT file_uploads by object_key
  if (normalizedSql.match(/SELECT \* FROM file_uploads WHERE object_key = \?/i)) {
    const file = mockDb.files.find(f => f.object_key === params[0]);
    return file ? [file] : [];
  }

  // 25. SELECT all file_uploads
  if (normalizedSql.match(/SELECT \* FROM file_uploads/i)) {
    return mockDb.files;
  }

  // 26. INSERT INTO audit_logs
  if (normalizedSql.match(/INSERT INTO audit_logs/i)) {
    let action, entity_type, entity_id, ip_address;
    const literalMatch = normalizedSql.match(/VALUES\s*\(\s*\?,\s*'([^']+)',\s*'([^']+)',\s*\?,\s*\?\s*\)/i);
    if (literalMatch) {
      action = literalMatch[1];
      entity_type = literalMatch[2];
      entity_id = params[1];
      ip_address = params[2];
    } else if (params.length >= 5) {
      action = params[1];
      entity_type = params[2];
      entity_id = params[3];
      ip_address = params[4];
    } else {
      action = params[1] || 'UNKNOWN';
      entity_type = params[2] || 'unknown';
      entity_id = params[1] || null;
      ip_address = params[2] || null;
    }
    mockDb.audit.push({
      id: mockDb.audit.length + 1,
      user_id: params[0],
      action,
      entity_type,
      entity_id,
      ip_address,
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  // 27. SELECT audit_logs
  if (normalizedSql.match(/FROM audit_logs/i)) {
    return mockDb.audit.map(a => {
      const u = mockDb.users.find(user => user.id === a.user_id);
      return { ...a, user_name: u ? u.name : 'System', user_email: u ? u.email : 'system@example.com' };
    });
  }

  // 28. Aggregates for Admin overview
  if (normalizedSql.match(/SELECT role, COUNT\(\*\)/i)) {
    const counts = {};
    mockDb.users.forEach(u => counts[u.role] = (counts[u.role] || 0) + 1);
    return Object.entries(counts).map(([role, count]) => ({ role, count }));
  }
  if (normalizedSql.match(/SELECT status, COUNT\(\*\)/i)) {
    const counts = {};
    mockDb.listings.forEach(l => {
      if (!counts[l.status]) counts[l.status] = { status: l.status, count: 0, total_kg: 0 };
      counts[l.status].count += 1;
      counts[l.status].total_kg += Number(l.quantity_kg || 0);
    });
    return Object.values(counts);
  }
  if (normalizedSql.match(/SELECT COUNT\(\*\) as count.*FROM file_uploads/i)) {
    const totalBytes = mockDb.files.reduce((s, f) => s + Number(f.file_size || 0), 0);
    return [{ count: mockDb.files.length, total_bytes: totalBytes }];
  }
  if (normalizedSql.match(/SELECT COUNT\(\*\) as count FROM audit_logs/i)) {
    return [{ count: mockDb.audit.length }];
  }

  return [];
}

/**
 * Check health status of database connection
 */
export async function getDbHealth() {
  if (pool) {
    try {
      await pool.query('SELECT 1');
      return { status: 'connected', engine: 'MySQL', host: MYSQL_HOST, database: MYSQL_DATABASE };
    } catch (err) {
      return { status: 'degraded', engine: 'MySQL (Unavailable - Dev Engine Active)', error: err.message };
    }

  }
  return { status: 'connected', engine: 'Development Database Engine' };
}

export async function withTransaction(work) {
  if (!pool || !isConnected) return work({ query });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const transaction = {
      query: async (sql, params = []) => {
        const [rows] = await connection.query(sql, params);
        return rows;
      }
    };
    const result = await work(transaction);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

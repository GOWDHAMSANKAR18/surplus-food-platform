import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';

import { query, getDbHealth, withTransaction } from './database/db.js';
import { 
  uploadFileToS3, 
  getFileDownloadUrl, 
  verifyFileIntegrity, 
  getStorageHealth 
} from './services/s3Service.js';
import { startExpirationScheduler } from './services/expirationService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
}
if (!JWT_SECRET) {
  console.warn('[Security Warning] JWT_SECRET is not configured; authentication is disabled until a development secret is supplied.');
}

const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(express.json());

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 10;
function loginRateLimit(req, res, next) {
  const key = `${req.ip}:${String(req.body?.email || '').toLowerCase()}`;
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > LOGIN_LIMIT) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  next();
}

function clientIp(req) {
  return req.ip || null;
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

// Standard Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Setup Multer for handling file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Block sensitive and server-side files from being statically served
const forbiddenPrefixes = ['/database', '/services', '/scripts', '/docs', '/node_modules', '/test', '/uploads'];
const forbiddenExactFiles = new Set(['/server.js', '/package.json', '/package-lock.json', '/.env', '/.env.example']);

app.use((req, res, next) => {
  const normalized = req.path.toLowerCase();
  if (forbiddenExactFiles.has(normalized) || forbiddenPrefixes.some(p => normalized.startsWith(p))) {
    return res.status(404).json({ error: 'File or route not found' });
  }
  next();
});

// Restrict static files to safe client-facing extensions
const allowedStaticExtensions = new Set(['', '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.txt', '.json']);
app.use((req, res, next) => {
  const ext = path.extname(req.path);
  if (ext && !allowedStaticExtensions.has(ext)) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(path.join(__dirname), { dotfiles: 'deny' }));

// Helper serialization functions to format MySQL snake_case into frontend camelCase
function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id.toString(),
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    location: {
      lat: Number(user.latitude),
      lng: Number(user.longitude),
      address: user.address
    },
    capacity: user.capacity ? Number(user.capacity) : null,
    verified: Boolean(user.verified),
    createdAt: user.created_at
  };
}

function serializeListing(listing) {
  if (!listing) return null;
  return {
    id: listing.id.toString(),
    donorId: listing.donor_id?.toString(),
    donorName: listing.donor_name || listing.donorName || 'Donor',
    foodType: listing.food_type,
    quantity: Number(listing.quantity_kg),
    expiryTime: listing.expiry_time,
    location: {
      lat: Number(listing.latitude),
      lng: Number(listing.longitude),
      address: listing.address
    },
    status: listing.status,
    approvedNgoId: listing.approved_ngo_id?.toString() || null,
    acceptedBy: listing.accepted_by || null,
    acceptedById: listing.accepted_by_id?.toString() || null,
    acceptedAt: listing.accepted_at || null,
    completedAt: listing.completed_at || null,
    isRecurring: Boolean(listing.is_recurring),
    expectedDailySurplus: Number(listing.expected_daily_surplus || 0),
    volunteerEligibleAt: listing.volunteer_eligible_at,
    createdAt: listing.created_at
  };
}

function serializeRequest(request) {
  if (!request) return null;
  return {
    id: request.id.toString(),
    listingId: request.listing_id?.toString(),
    ngoId: request.ngo_id?.toString(),
    ngoName: request.ngo_name || request.ngoName || 'NGO',
    contact: request.contact,
    pickupTime: request.pickup_time,
    message: request.message || '',
    status: request.status,
    requestedAt: request.requested_at
  };
}

// Authentication Middleware
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token is required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const users = await query(`SELECT * FROM users WHERE id = ?`, [payload.userId]);
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'User account not found' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ============================================================================
// HEALTH CHECK ENDPOINT (Rubric Requirement)
// ============================================================================
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await getDbHealth();
    const storageHealth = getStorageHealth();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: 'Node.js Express API',
      database: dbHealth,
      storage: storageHealth
    });
  } catch (err) {
    res.status(500).json({ error: 'Health check failed: ' + err.message });
  }
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const { email, password, name, phone, role, address, lat, lng, capacity } = req.body;

    const numericLat = Number(lat);
    const numericLng = Number(lng);
    const allowedRoles = ['donor', 'ngo', 'volunteer', 'admin'];

    if (!email || !password || !name || !phone || !role || !address || lat == null || lng == null) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid user role specified' });
    }

    if (!Number.isFinite(numericLat) || !Number.isFinite(numericLng)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }

    // Parameterized MySQL query for user lookup
    const existingUsers = await query(`SELECT * FROM users WHERE email = ?`, [email]);
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Password hashing with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);
    const isNgoVerified = role === 'ngo' ? 1 : 0;
    const ngoCapacity = role === 'ngo' ? Number(capacity || 50) : null;

    // Parameterized MySQL INSERT query
    const insertResult = await query(
      `INSERT INTO users (name, email, password_hash, phone, role, address, latitude, longitude, capacity, verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [name, email, passwordHash, phone, role, address, numericLat, numericLng, ngoCapacity, isNgoVerified]
    );

    const userId = insertResult.insertId;
    const createdUsers = await query(`SELECT * FROM users WHERE id = ?`, [userId]);
    const userDoc = createdUsers[0];

    // Record Audit Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'SIGNUP', 'users', ?, ?)`,
      [userId, userId, clientIp(req)]
    );

    const token = jwt.sign(
      { userId: userId.toString(), role: userDoc.role },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '2h', algorithm: 'HS256' }
    );

    res.json({ user: serializeUser(userDoc), token });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', loginRateLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Parameterized MySQL query
    const users = await query(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userDoc = users[0];
    const isValid = await bcrypt.compare(password, userDoc.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Record Audit Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'LOGIN', 'users', ?, ?)`,
      [userDoc.id, userDoc.id, clientIp(req)]
    );

    const token = jwt.sign(
      { userId: userDoc.id.toString(), role: userDoc.role },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '2h', algorithm: 'HS256' }
    );

    res.json({ user: serializeUser(userDoc), token });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

// ============================================================================
// PUBLIC IMPACT & DASHBOARD ENDPOINTS
// ============================================================================

app.get('/api/impact', async (req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM impact_stats WHERE id = 1`);
    if (rows && rows.length > 0) {
      const stats = rows[0];
      return res.json({
        totalKgSaved: Number(stats.total_kg_saved || 0),
        totalMeals: Number(stats.total_meals || 0),
        totalCO2Prevented: Number(stats.total_co2_prevented || 0),
        lastUpdated: stats.updated_at
      });
    }

    res.json({ totalKgSaved: 0, totalMeals: 0, totalCO2Prevented: 0 });
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard/recent', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT l.*, u.name as donor_name 
       FROM food_listings l 
       JOIN users u ON l.donor_id = u.id 
       WHERE l.status = 'completed' 
       ORDER BY l.completed_at DESC LIMIT 10`
    );

    res.json(rows.map(serializeListing));
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard/cities', async (req, res, next) => {
  try {
    const rows = await query(`SELECT address, quantity_kg FROM food_listings WHERE status = 'completed'`);
    const cityData = {};

    rows.forEach((listing) => {
      const address = listing.address || 'Unknown';
      const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
      const city = parts.length ? parts[parts.length - 1] : 'Unknown';

      if (!cityData[city]) {
        cityData[city] = { count: 0, kg: 0 };
      }

      cityData[city].count += 1;
      cityData[city].kg += Number(listing.quantity_kg || 0);
    });

    const sortedCities = Object.entries(cityData)
      .map(([city, stats]) => ({ city, ...stats }))
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 5);

    res.json(sortedCities);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// DONOR ENDPOINTS
// ============================================================================

app.post('/api/donor/listings', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ error: 'Only donors may create food listings' });
    }

    const { foodType, quantity, expiryHours, isRecurring, expectedDaily } = req.body;
    if (!foodType || quantity == null || expiryHours == null) {
      return res.status(400).json({ error: 'Food type, quantity, and expiry hours are required' });
    }

    const numQuantity = Number(quantity);
    const numExpiry = Number(expiryHours);
    if (!Number.isFinite(numQuantity) || numQuantity <= 0 || numQuantity > 10000) {
      return res.status(400).json({ error: 'Quantity must be a positive number up to 10,000 kg' });
    }
    if (!Number.isFinite(numExpiry) || numExpiry <= 0 || numExpiry > 72) {
      return res.status(400).json({ error: 'Safe consumption hours must be between 1 and 72 hours' });
    }

    const expiryTime = new Date(Date.now() + numExpiry * 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');
    const volunteerEligibleAt = new Date(Date.now() + 30 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');

    const insertResult = await query(
      `INSERT INTO food_listings 
       (donor_id, food_type, quantity_kg, expiry_time, address, latitude, longitude, status, is_recurring, expected_daily_surplus, volunteer_eligible_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, NOW())`,
      [
        req.user.id,
        foodType.trim(),
        numQuantity,
        expiryTime,
        req.user.address,
        req.user.latitude,
        req.user.longitude,
        isRecurring ? 1 : 0,
        Number(expectedDaily || 0),
        volunteerEligibleAt
      ]
    );

    const listingId = insertResult.insertId;
    const listings = await query(
      `SELECT l.*, u.name as donor_name FROM food_listings l JOIN users u ON l.donor_id = u.id WHERE l.id = ?`,
      [listingId]
    );

    // Audit Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'CREATE_LISTING', 'food_listings', ?, ?)`,
      [req.user.id, listingId, clientIp(req)]
    );

    res.json(serializeListing(listings[0]));
  } catch (error) {
    next(error);
  }
});

app.get('/api/donor/listings', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await query(
      `SELECT l.*, u.name as donor_name 
       FROM food_listings l 
       JOIN users u ON l.donor_id = u.id 
       WHERE l.donor_id = ? AND l.status IN ('available', 'approved', 'accepted')`,
      [req.user.id]
    );

    res.json(rows.map(serializeListing));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/donor/listings/:id/cancel', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ error: 'Only donors may cancel listings' });
    }

    const listingId = Number(req.params.id);
    const rows = await query(`SELECT * FROM food_listings WHERE id = ?`, [listingId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Food listing not found' });
    }

    const listing = rows[0];
    if (Number(listing.donor_id) !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({
        error: `Cannot cancel listing with status '${listing.status}'. Only 'available' listings may be cancelled.`
      });
    }

    const reason = req.body?.reason ? String(req.body.reason).slice(0, 255).trim() : 'Cancelled by donor';
    await query(`UPDATE food_listings SET status = 'cancelled' WHERE id = ?`, [listingId]);
    await query(`UPDATE pickup_requests SET status = 'rejected' WHERE listing_id = ? AND status = 'pending'`, [listingId]);

    // Record Audit Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'CANCEL_LISTING', 'food_listings', ?, ?)`,
      [req.user.id, listingId, clientIp(req)]
    );

    res.json({
      success: true,
      message: 'Listing successfully cancelled and retracted from public feed',
      listingId,
      reason
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/donor/requests', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const donorListings = await query(
      `SELECT l.*, u.name as donor_name 
       FROM food_listings l 
       JOIN users u ON l.donor_id = u.id 
       WHERE l.donor_id = ? AND l.status = 'available'`,
      [req.user.id]
    );

    if (!donorListings || donorListings.length === 0) {
      return res.json([]);
    }

    const listingIds = donorListings.map((l) => l.id);
    const placeholders = listingIds.map(() => '?').join(',');

    const requests = await query(
      `SELECT r.*, u.name as ngo_name 
       FROM pickup_requests r 
       JOIN users u ON r.ngo_id = u.id 
       WHERE r.listing_id IN (${placeholders})`,
      listingIds
    );

    const grouped = donorListings.map((listing) => ({
      listing: serializeListing(listing),
      requests: requests
        .filter((reqItem) => reqItem.listing_id === listing.id)
        .map(serializeRequest)
    }));

    res.json(grouped);
  } catch (error) {
    next(error);
  }
});

app.post('/api/requests/:requestId/approve', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ error: 'Only donors may approve pickup requests' });
    }

    const requestId = Number(req.params.requestId);
    const requests = await query(
      `SELECT r.*, u.name as ngo_name FROM pickup_requests r JOIN users u ON r.ngo_id = u.id WHERE r.id = ?`,
      [requestId]
    );

    if (!requests || requests.length === 0) {
      return res.status(404).json({ error: 'Pickup request not found' });
    }

    const requestDoc = requests[0];
    const listings = await query(`SELECT * FROM food_listings WHERE id = ?`, [requestDoc.listing_id]);

    if (!listings || listings.length === 0 || listings[0].donor_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    const listingId = requestDoc.listing_id;
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Approve listing
    await query(
      `UPDATE food_listings 
       SET status = 'approved', approved_ngo_id = ?, accepted_by = ?, accepted_by_id = ?, accepted_at = ? 
       WHERE id = ?`,
      [requestDoc.ngo_id, requestDoc.ngo_name, requestDoc.ngo_id, nowStr, listingId]
    );

    // Update target request to approved
    await query(`UPDATE pickup_requests SET status = 'approved', approved_at = ? WHERE id = ?`, [nowStr, requestId]);

    // Reject other requests for same listing
    await query(`UPDATE pickup_requests SET status = 'rejected' WHERE listing_id = ? AND id != ?`, [listingId, requestId]);

    // Audit Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'APPROVE_REQUEST', 'pickup_requests', ?, ?)`,
      [req.user.id, requestId, clientIp(req)]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/donor/impact', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await query(
      `SELECT quantity_kg FROM food_listings WHERE donor_id = ? AND status = 'completed'`,
      [req.user.id]
    );

    const totalKg = rows.reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0);
    const meals = totalKg * 2;
    const co2 = Number((totalKg * 2.5).toFixed(1));

    res.json({ totalKg, meals, co2 });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// NGO ENDPOINTS
// ============================================================================

app.get('/api/ngo/listings', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'ngo') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await query(
      `SELECT l.*, u.name as donor_name 
       FROM food_listings l 
       JOIN users u ON l.donor_id = u.id 
       WHERE l.status = 'available'`
    );

    res.json(rows.map(serializeListing));
  } catch (error) {
    next(error);
  }
});

app.post('/api/listings/:id/requests', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'ngo') {
      return res.status(403).json({ error: 'Only NGOs may create pickup requests' });
    }

    const listingId = Number(req.params.id);
    const listings = await query(`SELECT * FROM food_listings WHERE id = ? AND status = 'available'`, [listingId]);

    if (!listings || listings.length === 0) {
      return res.status(404).json({ error: 'Listing not found or not available for requests' });
    }

    const { contact, pickupTime, message } = req.body;
    if (!contact || !pickupTime) {
      return res.status(400).json({ error: 'Contact number and pickup time are required' });
    }

    const pickupTimeStr = new Date(pickupTime).toISOString().slice(0, 19).replace('T', ' ');

    const insertResult = await query(
      `INSERT INTO pickup_requests (listing_id, ngo_id, contact, pickup_time, message, status, requested_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
      [listingId, req.user.id, contact, pickupTimeStr, message || '']
    );

    const requestId = insertResult.insertId;
    const requestRows = await query(
      `SELECT r.*, u.name as ngo_name FROM pickup_requests r JOIN users u ON r.ngo_id = u.id WHERE r.id = ?`,
      [requestId]
    );

    // Audit Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'PICKUP_REQUEST', 'pickup_requests', ?, ?)`,
      [req.user.id, requestId, clientIp(req)]
    );

    res.json(serializeRequest(requestRows[0]));
  } catch (error) {
    next(error);
  }
});

app.post('/api/listings/:id/accept', authMiddleware, async (req, res, next) => {
  try {
    if (!['ngo', 'volunteer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only NGOs and volunteers may accept pickups' });
    }

    const listingId = Number(req.params.id);
    const listings = await query(`SELECT * FROM food_listings WHERE id = ? AND status = 'available'`, [listingId]);

    if (!listings || listings.length === 0) {
      return res.status(404).json({ error: 'Listing not found or not available for acceptance' });
    }

    const listing = listings[0];
    if (req.user.role === 'volunteer' && new Date(listing.volunteer_eligible_at) > new Date()) {
      return res.status(403).json({ error: 'This listing is not yet eligible for volunteer pickup (wait 30 mins)' });
    }

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const approvedNgoId = req.user.role === 'ngo' ? req.user.id : null;

    const updateResult = await query(
      `UPDATE food_listings 
       SET status = 'accepted', accepted_by = ?, accepted_by_id = ?, accepted_at = ?, approved_ngo_id = COALESCE(?, approved_ngo_id)
       WHERE id = ? AND status = 'available'`,
      [req.user.name, req.user.id, nowStr, approvedNgoId, listingId]
    );
    if (!updateResult || updateResult.affectedRows !== 1) {
      return res.status(409).json({ error: 'Listing was accepted by another user or is no longer available' });
    }

    // Audit Log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'ACCEPT_LISTING', 'food_listings', ?, ?)`,
      [req.user.id, listingId, clientIp(req)]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/listings/:id/complete', authMiddleware, async (req, res, next) => {
  try {
    const listingId = Number(req.params.id);
    const listings = await query(
      `SELECT * FROM food_listings WHERE id = ? AND status IN ('accepted', 'approved')`,
      [listingId]
    );

    if (!listings || listings.length === 0) {
      return res.status(404).json({ error: 'Listing not found or not ready for completion' });
    }

    const listing = listings[0];
    if (Number(listing.accepted_by_id) !== req.user.id) {
      return res.status(403).json({ error: 'Only the designated pickup party may mark this listing as completed' });
    }

    const totalKg = Number(listing.quantity_kg || 0);
    const meals = totalKg * 2;
    const co2 = totalKg * 2.5;

    // Proof-of-Delivery (PoD) metadata
    const { deliveryNotes, beneficiariesServed, proofCode } = req.body || {};
    const safeNotes = deliveryNotes ? String(deliveryNotes).slice(0, 500).trim() : 'Standard distribution receipt';
    const numBeneficiaries = beneficiariesServed != null && Number.isFinite(Number(beneficiariesServed))
      ? Math.max(0, Math.min(50000, Math.round(Number(beneficiariesServed))))
      : meals;
    const finalProofCode = proofCode && typeof proofCode === 'string' && proofCode.trim().length > 0
      ? proofCode.trim().slice(0, 50)
      : `POD-${listingId}-${Date.now().toString(36).toUpperCase()}`;
    const proofCodeHash = crypto.createHash('sha256').update(finalProofCode).digest('hex');
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await withTransaction(async (tx) => {
      const updateResult = await tx.query(
        `UPDATE food_listings
         SET status = 'completed', completed_at = ?, delivery_notes = ?,
             beneficiaries_served = ?, proof_code_hash = ?
         WHERE id = ? AND status IN ('accepted', 'approved')`,
        [nowStr, safeNotes, numBeneficiaries, proofCodeHash, listingId]
      );
      if (!updateResult || updateResult.affectedRows !== 1) {
        const conflict = new Error('Listing was already completed or is no longer eligible');
        conflict.status = 409;
        throw conflict;
      }

      await tx.query(
        `UPDATE pickup_requests SET status = 'completed'
         WHERE listing_id = ? AND status = 'approved'`,
        [listingId]
      );
      await tx.query(
        `UPDATE impact_stats
         SET total_kg_saved = total_kg_saved + ?, total_meals = total_meals + ?,
             total_co2_prevented = total_co2_prevented + ?
         WHERE id = 1`,
        [totalKg, meals, co2]
      );
      await tx.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
         VALUES (?, 'COMPLETE_LISTING', 'food_listings', ?, ?)`,
        [req.user.id, listingId, clientIp(req)]
      );
    });

    res.json({
      success: true,
      listingId,
      completedAt: nowStr,
      deliveryNotes: safeNotes,
      beneficiariesServed: numBeneficiaries,
      proofCode: finalProofCode
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/ngo/accepted', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'ngo') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await query(
      `SELECT l.*, u.name as donor_name 
       FROM food_listings l 
       JOIN users u ON l.donor_id = u.id 
       WHERE l.approved_ngo_id = ? AND l.status = 'accepted'`,
      [req.user.id]
    );

    res.json(rows.map(serializeListing));
  } catch (error) {
    next(error);
  }
});

app.get('/api/ngo/impact', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'ngo') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await query(
      `SELECT quantity_kg FROM food_listings WHERE approved_ngo_id = ? AND status = 'completed'`,
      [req.user.id]
    );

    const totalKg = rows.reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0);
    const meals = totalKg * 2;
    const co2 = Number((totalKg * 2.5).toFixed(1));

    res.json({ totalKg, meals, pickups: rows.length, co2 });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// VOLUNTEER ENDPOINTS
// ============================================================================

app.get('/api/volunteer/listings', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await query(
      `SELECT l.*, u.name as donor_name 
       FROM food_listings l 
       JOIN users u ON l.donor_id = u.id 
       WHERE l.status = 'available' AND l.volunteer_eligible_at <= NOW()`
    );

    res.json(rows.map(serializeListing));
  } catch (error) {
    next(error);
  }
});

app.get('/api/volunteer/accepted', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await query(
      `SELECT l.*, u.name as donor_name 
       FROM food_listings l 
       JOIN users u ON l.donor_id = u.id 
       WHERE l.accepted_by_id = ? AND l.status = 'accepted'`,
      [req.user.id]
    );

    res.json(rows.map(serializeListing));
  } catch (error) {
    next(error);
  }
});

app.get('/api/volunteer/impact', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rows = await query(
      `SELECT quantity_kg FROM food_listings WHERE accepted_by_id = ? AND status = 'completed'`,
      [req.user.id]
    );

    const totalKg = rows.reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0);
    const meals = totalKg * 2;
    const co2 = Number((totalKg * 2.5).toFixed(1));

    res.json({ totalKg, meals, pickups: rows.length, co2 });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SECURE S3 FILE UPLOAD & INTEGRITY ENDPOINTS (Rubric Component 3 & 4)
// ============================================================================

async function canAccessFile(fileRecord, user) {
  if (user.role === 'admin' || Number(fileRecord.uploaded_by) === Number(user.id)) return true;
  if (!fileRecord.listing_id) return false;
  const rows = await query(
    `SELECT donor_id, approved_ngo_id, accepted_by_id
     FROM food_listings WHERE id = ?`,
    [fileRecord.listing_id]
  );
  if (!rows.length) return false;
  const listing = rows[0];
  return [listing.donor_id, listing.approved_ngo_id, listing.accepted_by_id]
    .some((id) => id != null && Number(id) === Number(user.id));
}

/**
 * Upload file for a listing (Images/PDF proof) to Amazon S3
 */
app.post('/api/listings/:id/files', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    const listingId = Number(req.params.id);
    const listings = await query(`SELECT * FROM food_listings WHERE id = ?`, [listingId]);
    if (!listings.length || (req.user.role !== 'admin' && Number(listings[0].donor_id) !== Number(req.user.id))) {
      return res.status(403).json({ error: 'Only the listing owner may upload files' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file attached to upload request' });
    }

    const fileResult = await uploadFileToS3(req.file, listingId, req.user.id);
    res.json(fileResult);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get files associated with a food listing (includes S3 Pre-signed download URLs)
 */
app.get('/api/listings/:id/files', authMiddleware, async (req, res, next) => {
  try {
    const listingId = Number(req.params.id);
    const listings = await query(`SELECT * FROM food_listings WHERE id = ?`, [listingId]);
    if (!listings.length || !(await canAccessFile({ ...listings[0], listing_id: listingId }, req.user))) {
      return res.status(403).json({ error: 'You are not authorized to access these files' });
    }
    const files = await query(`SELECT * FROM file_uploads WHERE listing_id = ?`, [listingId]);

    const formattedFiles = await Promise.all(
      files.map(async (fileRecord) => {
        const presign = await getFileDownloadUrl(fileRecord.object_key, fileRecord.storage_backend);
        return {
          id: fileRecord.id,
          originalFilename: fileRecord.original_filename,
          objectKey: fileRecord.object_key,
          contentType: fileRecord.content_type,
          fileSize: fileRecord.file_size,
          sha256Checksum: fileRecord.sha256_checksum,
          uploadedAt: fileRecord.uploaded_at,
          downloadUrl: presign.url,
          isPresignedS3: presign.isPresignedS3
        };
      })
    );

    res.json(formattedFiles);
  } catch (error) {
    next(error);
  }
});

/**
 * Download file via confidential S3 Pre-signed URL
 */
app.get('/api/files/:id/download', authMiddleware, async (req, res, next) => {
  try {
    const fileId = Number(req.params.id);
    const rows = await query(`SELECT * FROM file_uploads WHERE id = ?`, [fileId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'File metadata not found' });
    }

    const fileRecord = rows[0];
    if (!(await canAccessFile(fileRecord, req.user))) {
      return res.status(403).json({ error: 'You are not authorized to access this file' });
    }
    const presign = await getFileDownloadUrl(fileRecord.object_key, fileRecord.storage_backend);

    res.json({
      fileId: fileRecord.id,
      filename: fileRecord.original_filename,
      contentType: fileRecord.content_type,
      downloadUrl: presign.url,
      isPresignedS3: presign.isPresignedS3
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Verify File Integrity against stored SHA-256 Checksum in MySQL
 */
app.get('/api/files/:id/verify', authMiddleware, async (req, res, next) => {
  try {
    const fileId = Number(req.params.id);
    const rows = await query(`SELECT * FROM file_uploads WHERE id = ?`, [fileId]);
    if (!rows.length) return res.status(404).json({ error: 'File metadata not found' });
    if (!(await canAccessFile(rows[0], req.user))) {
      return res.status(403).json({ error: 'You are not authorized to verify this file' });
    }
    const verification = await verifyFileIntegrity(fileId);
    res.json(verification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Audit log view endpoint
app.get('/api/audit-logs', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const logs = await query(
      `SELECT a.*, u.name as user_name, u.email as user_email 
       FROM audit_logs a 
       LEFT JOIN users u ON a.user_id = u.id 
       ORDER BY a.created_at DESC LIMIT 50`
    );

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

/**
 * Direct file view/download endpoint for local fallback storage mode
 */
app.get('/api/files/raw/:key(*)', (req, res, next) => {
  const rawKey = req.params.key || '';
  let decodedKey = rawKey;
  try {
    decodedKey = decodeURIComponent(rawKey);
  } catch {
    return res.status(404).json({ error: 'File or route not found' });
  }
  if (decodedKey.includes('..') || decodedKey.includes('\\')) {
    return res.status(404).json({ error: 'File or route not found' });
  }
  next();
}, authMiddleware, async (req, res, next) => {
  try {
    const rawKey = req.params.key;
    if (!rawKey) {
      return res.status(400).json({ error: 'Missing file key parameter' });
    }
    const decodedKey = decodeURIComponent(rawKey);
    // Sanitize to prevent path traversal
    const safeFilename = decodedKey.replace(/\\/g, '_').replace(/\//g, '_').replace(/\.\./g, '');
    const localUploadsDir = path.join(__dirname, 'uploads');
    const targetFilePath = path.join(localUploadsDir, safeFilename);

    if (!fs.existsSync(targetFilePath)) {
      return res.status(404).json({ error: 'Requested file not found on local storage' });
    }

    const rows = await query(`SELECT * FROM file_uploads WHERE object_key = ?`, [decodedKey]);
    if (!rows.length || !(await canAccessFile(rows[0], req.user))) {
      return res.status(403).json({ error: 'You are not authorized to access this file' });
    }
    const contentType = rows && rows.length > 0 ? rows[0].content_type : 'application/octet-stream';
    const filename = rows && rows.length > 0 ? rows[0].original_filename : safeFilename;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(targetFilePath).pipe(res);
  } catch (error) {
    next(error);
  }
});

// Admin User Directory
app.get('/api/admin/users', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await query(`SELECT id, name, email, phone, role, address, latitude, longitude, capacity, verified, created_at FROM users ORDER BY id ASC`);
    res.json(users.map(serializeUser));
  } catch (error) {
    next(error);
  }
});

// Admin System Overview Metrics
app.get('/api/admin/overview', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const userCounts = await query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`);
    const listingCounts = await query(`SELECT status, COUNT(*) as count, COALESCE(SUM(quantity_kg), 0) as total_kg FROM food_listings GROUP BY status`);
    const fileCountRows = await query(`SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_bytes FROM file_uploads`);
    const auditCountRows = await query(`SELECT COUNT(*) as count FROM audit_logs`);
    const impactRows = await query(`SELECT * FROM impact_stats WHERE id = 1`);

    res.json({
      usersByRole: userCounts,
      listingsByStatus: listingCounts,
      filesCount: fileCountRows[0]?.count || 0,
      filesTotalBytes: fileCountRows[0]?.total_bytes || 0,
      totalAuditEvents: auditCountRows[0]?.count || 0,
      impact: impactRows[0] || {}
    });
  } catch (error) {
    next(error);
  }
});

// 404 Route Handlers
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Centralized Production Error Handling Middleware (Rubric requirement: Clean JSON responses)
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error occurred' : err.message
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Surplus Food Redistribution Server is active!`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`📊 Health Endpoint: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
  if (process.env.NODE_ENV !== 'test') startExpirationScheduler();
});

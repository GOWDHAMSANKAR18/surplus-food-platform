import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { query } from '../database/db.js';

dotenv.config();

const BACKUP_DIR = path.join(process.cwd(), 'database');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_FILE = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);

async function performDatabaseBackup() {
  console.log('=======================================================');
  console.log('📦 Starting MySQL Database Backup Procedure...');
  console.log('=======================================================');

  try {
    const users = await query(`SELECT * FROM users`);
    const listings = await query(`SELECT * FROM food_listings`);
    const requests = await query(`SELECT * FROM pickup_requests`);
    const files = await query(`SELECT * FROM file_uploads`);
    const impact = await query(`SELECT * FROM impact_stats`);
    const audit = await query(`SELECT * FROM audit_logs`);

    let dumpContent = `-- MySQL Database Backup Snapshot\n`;
    dumpContent += `-- Generated: ${new Date().toISOString()}\n`;
    dumpContent += `USE food_donation;\n\n`;

    dumpContent += `-- Table: users (${users.length} rows)\n`;
    users.forEach(u => {
      dumpContent += `INSERT INTO users (id, name, email, password_hash, phone, role, address, latitude, longitude, capacity, verified, created_at) VALUES (${u.id}, '${escapeSql(u.name)}', '${escapeSql(u.email)}', '${escapeSql(u.password_hash)}', '${escapeSql(u.phone)}', '${u.role}', '${escapeSql(u.address)}', ${u.latitude}, ${u.longitude}, ${u.capacity || 'NULL'}, ${u.verified ? 1 : 0}, '${u.created_at}') ON DUPLICATE KEY UPDATE name=VALUES(name);\n`;
    });

    dumpContent += `\n-- Table: food_listings (${listings.length} rows)\n`;
    listings.forEach(l => {
      dumpContent += `INSERT INTO food_listings (id, donor_id, food_type, quantity_kg, expiry_time, address, latitude, longitude, status, is_recurring, expected_daily_surplus, volunteer_eligible_at, created_at) VALUES (${l.id}, ${l.donor_id}, '${escapeSql(l.food_type)}', ${l.quantity_kg}, '${l.expiry_time}', '${escapeSql(l.address)}', ${l.latitude}, ${l.longitude}, '${l.status}', ${l.is_recurring ? 1 : 0}, ${l.expected_daily_surplus || 0}, '${l.volunteer_eligible_at}', '${l.created_at}') ON DUPLICATE KEY UPDATE status=VALUES(status);\n`;
    });

    dumpContent += `\n-- Table: pickup_requests (${requests.length} rows)\n`;
    requests.forEach(r => {
      dumpContent += `INSERT INTO pickup_requests (id, listing_id, ngo_id, contact, pickup_time, message, status, requested_at) VALUES (${r.id}, ${r.listing_id}, ${r.ngo_id}, '${escapeSql(r.contact)}', '${r.pickup_time}', '${escapeSql(r.message || '')}', '${r.status}', '${r.requested_at}') ON DUPLICATE KEY UPDATE status=VALUES(status);\n`;
    });

    dumpContent += `\n-- Table: file_uploads (${files.length} rows)\n`;
    files.forEach(f => {
      dumpContent += `INSERT INTO file_uploads (id, listing_id, uploaded_by, original_filename, object_key, content_type, file_size, sha256_checksum, upload_status, uploaded_at) VALUES (${f.id}, ${f.listing_id || 'NULL'}, ${f.uploaded_by}, '${escapeSql(f.original_filename)}', '${escapeSql(f.object_key)}', '${escapeSql(f.content_type)}', ${f.file_size}, '${f.sha256_checksum}', '${f.upload_status}', '${f.uploaded_at}') ON DUPLICATE KEY UPDATE upload_status=VALUES(upload_status);\n`;
    });

    fs.writeFileSync(BACKUP_FILE, dumpContent);
    console.log(`✅ Backup successfully saved to: ${BACKUP_FILE}`);
    console.log(`📊 Backup Summary: ${users.length} Users, ${listings.length} Listings, ${requests.length} Requests, ${files.length} Files`);
    console.log('=======================================================');
  } catch (err) {
    console.error('❌ Backup Failed:', err.message);
    process.exitCode = 1;
  }
}

function escapeSql(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "''");
}

performDatabaseBackup();

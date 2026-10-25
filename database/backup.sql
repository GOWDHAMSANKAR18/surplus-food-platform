-- MySQL Database Backup Snapshot
-- Generated: 2026-10-13T04:46:53.448Z
USE food_donation;

-- Table: users (4 rows)
INSERT INTO users (id, name, email, password_hash, phone, role, address, latitude, longitude, capacity, verified, created_at) VALUES (1, 'Green Palace Hotel', 'donor@example.com', '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6', '9876543210', 'donor', '123 MG Road, Bengaluru', 12.97159870, 77.59456270, NULL, 0, '2026-10-13 10:13:35') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO users (id, name, email, password_hash, phone, role, address, latitude, longitude, capacity, verified, created_at) VALUES (2, 'Hope Foundation NGO', 'ngo@example.com', '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6', '9876543211', 'ngo', '45 Indiranagar, Bengaluru', 12.97836920, 77.64083560, 50, 1, '2026-10-13 10:13:35') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO users (id, name, email, password_hash, phone, role, address, latitude, longitude, capacity, verified, created_at) VALUES (3, 'Alex Volunteer', 'volunteer@example.com', '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6', '9876543212', 'volunteer', '78 Koramangala, Bengaluru', 12.93524220, 77.62448060, NULL, 1, '2026-10-13 10:13:35') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO users (id, name, email, password_hash, phone, role, address, latitude, longitude, capacity, verified, created_at) VALUES (4, 'Platform Admin', 'admin@example.com', '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6', '9876543213', 'admin', 'Headquarters, Bengaluru', 12.97159870, 77.59456270, NULL, 1, '2026-10-13 10:13:35') ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Table: food_listings (3 rows)
INSERT INTO food_listings (id, donor_id, food_type, quantity_kg, expiry_time, address, latitude, longitude, status, is_recurring, expected_daily_surplus, volunteer_eligible_at, created_at) VALUES (1, 1, 'Cooked Rice & Dal (50 portions)', 25.00, '2026-10-13 14:13:35', '123 MG Road, Bengaluru', 12.97159870, 77.59456270, 'available', 0, 0.00, '2026-10-13 10:03:35', '2026-10-13 10:13:35') ON DUPLICATE KEY UPDATE status=VALUES(status);
INSERT INTO food_listings (id, donor_id, food_type, quantity_kg, expiry_time, address, latitude, longitude, status, is_recurring, expected_daily_surplus, volunteer_eligible_at, created_at) VALUES (2, 1, 'Fresh Bread & Pastries', 15.00, '2026-10-13 16:13:35', '123 MG Road, Bengaluru', 12.97159870, 77.59456270, 'available', 1, 15.00, '2026-10-13 09:28:35', '2026-10-13 10:13:35') ON DUPLICATE KEY UPDATE status=VALUES(status);
INSERT INTO food_listings (id, donor_id, food_type, quantity_kg, expiry_time, address, latitude, longitude, status, is_recurring, expected_daily_surplus, volunteer_eligible_at, created_at) VALUES (3, 1, 'Vegetable Curry & Chapati', 40.00, '2026-10-13 09:13:35', '123 MG Road, Bengaluru', 12.97159870, 77.59456270, 'completed', 0, 0.00, '2026-10-13 07:13:35', '2026-10-13 06:13:35') ON DUPLICATE KEY UPDATE status=VALUES(status);

-- Table: pickup_requests (1 rows)
INSERT INTO pickup_requests (id, listing_id, ngo_id, contact, pickup_time, message, status, requested_at) VALUES (1, 3, 2, '9876543211', '2026-10-13 08:13:35', 'We can collect immediately using our van.', 'approved', '2026-10-13 07:13:35') ON DUPLICATE KEY UPDATE status=VALUES(status);

-- Table: file_uploads (1 rows)
INSERT INTO file_uploads (id, listing_id, uploaded_by, original_filename, object_key, content_type, file_size, sha256_checksum, upload_status, uploaded_at) VALUES (1, 3, 1, 'food_proof_listing3.jpg', 'listings/3/sample-food-proof.jpg', 'image/jpeg', 245820, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'uploaded', '2026-10-13 06:13:35') ON DUPLICATE KEY UPDATE upload_status=VALUES(upload_status);

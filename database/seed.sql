-- ============================================================================
-- CLOUD-BASED SURPLUS FOOD REDISTRIBUTION PLATFORM
-- Seed Data for MySQL Database
-- Default password for all seed users: password123
-- (bcrypt hash: $2b$10$Y1456gR6r7yV7qG4J6J.EO5E4d5s3P9K.wYnF4fS.d5P2W)
-- ============================================================================

USE food_donation;

-- Clear existing data
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE file_uploads;
TRUNCATE TABLE pickup_requests;
TRUNCATE TABLE food_listings;
TRUNCATE TABLE impact_stats;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Insert Users
-- Password for all: password123
INSERT INTO users (id, name, email, password_hash, phone, role, address, latitude, longitude, capacity, verified, created_at) VALUES
(1, 'Green Palace Hotel', 'donor@example.com', '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6', '9876543210', 'donor', '123 MG Road, Bengaluru', 12.97159870, 77.59456270, NULL, FALSE, NOW()),
(2, 'Hope Foundation NGO', 'ngo@example.com', '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6', '9876543211', 'ngo', '45 Indiranagar, Bengaluru', 12.97836920, 77.64083560, 50, TRUE, NOW()),
(3, 'Alex Volunteer', 'volunteer@example.com', '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6', '9876543212', 'volunteer', '78 Koramangala, Bengaluru', 12.93524220, 77.62448060, NULL, TRUE, NOW()),
(4, 'Platform Admin', 'admin@example.com', '$2b$10$Zbr4JtPQ4R4wueQ9K4Y3mu81voMOujaDGAf.2BWhlaxJUFmPzps/6', '9876543213', 'admin', 'Headquarters, Bengaluru', 12.97159870, 77.59456270, NULL, TRUE, NOW());

-- 2. Insert Food Listings
INSERT INTO food_listings 
(id, donor_id, food_type, quantity_kg, expiry_time, address, latitude, longitude, status, approved_ngo_id, accepted_by, accepted_by_id, accepted_at, completed_at, is_recurring, expected_daily_surplus, volunteer_eligible_at, created_at) 
VALUES
(1, 1, 'Cooked Rice & Dal (50 portions)', 25.00, DATE_ADD(NOW(), INTERVAL 4 HOUR), '123 MG Road, Bengaluru', 12.97159870, 77.59456270, 'available', NULL, NULL, NULL, NULL, NULL, FALSE, 0.00, DATE_SUB(NOW(), INTERVAL 10 MINUTE), NOW()),
(2, 1, 'Fresh Bread & Pastries', 15.00, DATE_ADD(NOW(), INTERVAL 6 HOUR), '123 MG Road, Bengaluru', 12.97159870, 77.59456270, 'available', NULL, NULL, NULL, NULL, NULL, TRUE, 15.00, DATE_SUB(NOW(), INTERVAL 45 MINUTE), NOW()),
(3, 1, 'Vegetable Curry & Chapati', 40.00, DATE_SUB(NOW(), INTERVAL 1 HOUR), '123 MG Road, Bengaluru', 12.97159870, 77.59456270, 'completed', 2, 'Hope Foundation NGO', 2, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR), FALSE, 0.00, DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 4 HOUR));

-- 3. Insert Pickup Requests
INSERT INTO pickup_requests (id, listing_id, ngo_id, contact, pickup_time, message, status, requested_at, approved_at) VALUES
(1, 3, 2, '9876543211', DATE_SUB(NOW(), INTERVAL 2 HOUR), 'We can collect immediately using our van.', 'approved', DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR));

-- 4. Insert Global Impact Stats
INSERT INTO impact_stats (id, total_kg_saved, total_meals, total_co2_prevented, updated_at) VALUES
(1, 40.00, 80, 100.00, NOW())
ON DUPLICATE KEY UPDATE 
total_kg_saved = 40.00,
total_meals = 80,
total_co2_prevented = 100.00;

-- 5. Insert Sample File Metadata (Demonstrating S3 Confidentiality & Integrity)
INSERT INTO file_uploads 
(id, listing_id, uploaded_by, original_filename, object_key, content_type, file_size, sha256_checksum, upload_status, uploaded_at) 
VALUES
(1, 3, 1, 'food_proof_listing3.jpg', 'listings/3/sample-food-proof.jpg', 'image/jpeg', 245820, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'uploaded', DATE_SUB(NOW(), INTERVAL 4 HOUR));

-- 6. Insert Audit Logs
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, created_at) VALUES
(1, 'CREATE_LISTING', 'food_listings', 1, '127.0.0.1', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(1, 'CREATE_LISTING', 'food_listings', 2, '127.0.0.1', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(2, 'PICKUP_REQUEST', 'pickup_requests', 1, '127.0.0.1', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(1, 'APPROVE_REQUEST', 'pickup_requests', 1, '127.0.0.1', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(2, 'COMPLETE_LISTING', 'food_listings', 3, '127.0.0.1', DATE_SUB(NOW(), INTERVAL 1 HOUR));

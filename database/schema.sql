-- ============================================================================
-- CLOUD-BASED SURPLUS FOOD REDISTRIBUTION PLATFORM
-- MySQL Database Schema
-- Database Name: food_donation
-- ============================================================================

CREATE DATABASE IF NOT EXISTS food_donation;
USE food_donation;

-- Disable foreign key checks for safe dropping of existing tables
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS file_uploads;
DROP TABLE IF EXISTS pickup_requests;
DROP TABLE IF EXISTS food_listings;
DROP TABLE IF EXISTS impact_stats;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. USERS TABLE
-- Roles: donor, ngo, volunteer, admin
-- ============================================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    role ENUM('donor', 'ngo', 'volunteer', 'admin') NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    capacity INT DEFAULT 50,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. FOOD_LISTINGS TABLE
-- Statuses: available, requested, approved, accepted, completed, expired, cancelled
-- ============================================================================
CREATE TABLE food_listings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    food_type VARCHAR(255) NOT NULL,
    quantity_kg DECIMAL(10, 2) NOT NULL,
    expiry_time TIMESTAMP NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    status ENUM('available', 'requested', 'approved', 'accepted', 'completed', 'expired', 'cancelled') DEFAULT 'available',
    approved_ngo_id INT DEFAULT NULL,
    accepted_by VARCHAR(255) DEFAULT NULL,
    accepted_by_id INT DEFAULT NULL,
    accepted_at TIMESTAMP NULL DEFAULT NULL,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    expected_daily_surplus DECIMAL(10, 2) DEFAULT 0.00,
    volunteer_eligible_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_ngo_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (accepted_by_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_listings_status (status),
    INDEX idx_listings_donor (donor_id),
    INDEX idx_listings_accepted_by (accepted_by_id),
    INDEX idx_listings_expiry (expiry_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. PICKUP_REQUESTS TABLE
-- Statuses: pending, approved, rejected, completed, cancelled
-- ============================================================================
CREATE TABLE pickup_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    listing_id INT NOT NULL,
    ngo_id INT NOT NULL,
    contact VARCHAR(50) NOT NULL,
    pickup_time TIMESTAMP NOT NULL,
    message TEXT,
    status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (listing_id) REFERENCES food_listings(id) ON DELETE CASCADE,
    FOREIGN KEY (ngo_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_requests_listing (listing_id),
    INDEX idx_requests_ngo (ngo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. FILE_UPLOADS TABLE
-- Stores S3 metadata, object key, SHA-256 integrity checksum
-- ============================================================================
CREATE TABLE file_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    listing_id INT DEFAULT NULL,
    uploaded_by INT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    object_key VARCHAR(512) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    storage_backend ENUM('local', 's3') NOT NULL DEFAULT 'local',
    upload_status ENUM('pending', 'uploaded', 'failed') DEFAULT 'uploaded',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES food_listings(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_files_listing (listing_id),
    INDEX idx_files_uploader (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Delivery proof metadata is kept with the listing so completion is auditable.
ALTER TABLE food_listings
    ADD COLUMN delivery_notes VARCHAR(500) DEFAULT NULL,
    ADD COLUMN beneficiaries_served INT DEFAULT NULL,
    ADD COLUMN proof_code_hash VARCHAR(128) DEFAULT NULL;

-- ============================================================================
-- 5. IMPACT_STATS TABLE
-- Aggregated global impact metrics
-- ============================================================================
CREATE TABLE impact_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    total_kg_saved DECIMAL(12, 2) DEFAULT 0.00,
    total_meals BIGINT DEFAULT 0,
    total_co2_prevented DECIMAL(12, 2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize single row for global impact stats
INSERT INTO impact_stats (id, total_kg_saved, total_meals, total_co2_prevented)
VALUES (1, 0, 0, 0)
ON DUPLICATE KEY UPDATE id=id;

-- ============================================================================
-- 6. AUDIT_LOGS TABLE
-- Records critical security actions (logins, listings, requests, file uploads)
-- ============================================================================
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

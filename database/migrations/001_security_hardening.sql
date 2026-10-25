USE food_donation;

ALTER TABLE file_uploads
  ADD COLUMN IF NOT EXISTS storage_backend ENUM('local', 's3') NOT NULL DEFAULT 'local';

ALTER TABLE food_listings
  ADD COLUMN IF NOT EXISTS delivery_notes VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS beneficiaries_served INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proof_code_hash VARCHAR(128) DEFAULT NULL;

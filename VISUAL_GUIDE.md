# 🎨 Visual Architecture & Diagram Guide

This guide provides visual diagrams illustrating the system architecture, database relationships, S3 file confidentiality, SHA-256 integrity verification, and deployment pipelines.

---

## 🏗️ 1. End-to-End System Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                                   USER LAYER                                      |
|                                                                                   |
|  [ Donor Portal ]             [ NGO Portal ]            [ Volunteer Portal ]      |
|  - Create Listing             - View Nearby Food        - Accept Unassigned       |
|  - Upload Food Photo (S3)     - Priority Matching       - Complete Delivery       |
|  - Approve Pickup Request     - Request Pickup          - View Impact Stats       |
+-------------------------------------+---------------------------------------------+
                                      |
                                      | HTTPS (JWT Bearer Token)
                                      v
+-----------------------------------------------------------------------------------+
|                                HOSTING & ROUTING LAYER                            |
|                                                                                   |
|     Public PaaS (Render / Railway)      OR       Amazon EC2 (Ubuntu 22.04)        |
|     Auto SSL + Node Runtime                      Nginx Proxy + PM2 Manager        |
+-------------------------------------+---------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
|                                BACKEND SERVICE LAYER                              |
|                                                                                   |
|                             Node.js + Express.js API                              |
|   - Authentication (bcrypt + JWT)               - Priority Engine (Haversine)    |
|   - S3 Upload Controller                         - Centralized Error Handler      |
|   - SHA-256 Integrity Engine                     - Health Check (/api/health)     |
+-------------------+-----------------------------------+---------------------------+
                    |                                   |
                    v                                   v
+-----------------------------------+   +-------------------------------------------+
|          DATABASE LAYER           |   |               STORAGE LAYER               |
|                                   |   |                                           |
|         MySQL Database            |   |                 Amazon S3                 |
|   - users                         |   |    Private Bucket (Block Public Access)   |
|   - food_listings                 |   |    Server-Side Encryption (SSE-S3)       |
|   - pickup_requests               |   |    Key: listings/{listingId}/{uuid}.jpg   |
|   - file_uploads (SHA-256 Hash)   |   |    Access via 1-Hour Pre-Signed URLs     |
|   - impact_stats & audit_logs     |   |                                           |
+-----------------------------------+   +-------------------------------------------+
```

---

## 🗄️ 2. MySQL Relational Entity Relationship Diagram (ERD)

```text
+------------------+         +--------------------------+
|      users       |         |      food_listings       |
+------------------+         +--------------------------+
| PK id            |1       *| PK id                    |
|    name          +---------+ FK donor_id              |
|    email (UNIQUE)|         |    food_type             |
|    password_hash |         |    quantity_kg           |
|    role          |         |    expiry_time           |
|    address       |         |    status                |
|    latitude      |         | FK approved_ngo_id       |
|    longitude     |         | FK accepted_by_id        |
|    capacity      |         +------------+-------------+
+--------+---------+                      |
         |                                | 1
         | 1                              |
         |                                | *
         | *                         +----+---------------------+
         |                           |     pickup_requests      |
         |                           +--------------------------+
         |                           | PK id                    |
         |                           | FK listing_id            |
         |                           | FK ngo_id                |
         |                           |    contact, pickup_time  |
         |                           |    status                |
         |                           +--------------------------+
         |
         | 1
         |
         | *
+--------v------------------+
|       file_uploads        |
+---------------------------+
| PK id                     |
| FK listing_id             |
| FK uploaded_by            |
|    original_filename      |
|    object_key             |
|    content_type, file_size|
|    sha256_checksum        |
+---------------------------+
```

---

## 🛡️ 3. S3 Confidentiality & SHA-256 Integrity Flow

```text
[ Donor Browser ]
       |
       | 1. Upload File (POST /api/listings/:id/files)
       v
[ Express Server ]
       |
       |-- 2. Compute SHA-256 Hash using Node 'crypto'
       |-- 3. Upload to S3 with SSE-S3 (ServerSideEncryption: 'AES256')
       |-- 4. Save metadata & SHA-256 hash to MySQL 'file_uploads'
       |
       +---> [ Amazon S3 Private Bucket ] (Block Public Access)
       |
       v
[ NGO / Donor Browser ]
       |
       | 5. Request View/Verify (GET /api/files/:id/verify)
       v
[ Express Server ]
       |
       |-- 6. Fetch S3 Object & Recalculate SHA-256
       |-- 7. Compare with MySQL Stored Checksum
       |-- 8. Generate 1-Hour Pre-Signed URL for Download
       v
[ Integrity Verified Modal ]
```

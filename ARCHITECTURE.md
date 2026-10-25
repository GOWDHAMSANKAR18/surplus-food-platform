# 🏗️ Cloud-Based Surplus Food Redistribution Platform - System Architecture

This document provides a detailed overview of the system architecture, cloud components, database schema design, Amazon S3 storage security, and deployment pipelines for the Cloud-Based Food Donation & Redistribution Platform.

---

## 🌐 1. High-Level Architecture Diagram

```text
                                  +-----------------------+
                                  |     USERS / CLIENTS   |
                                  | (Browsers / Mobile)   |
                                  +-----------+-----------+
                                              |
                                              v
                              +-------------------------------+
                              |    Nginx Reverse Proxy /      |
                              |   Public PaaS Router (SSL)    |
                              +---------------+---------------+
                                              |
                                              v
                              +-------------------------------+
                              |   Node.js + Express REST API  |
                              |   (JWT Auth & Middleware)     |
                              +-------+---------------+-------+
                                      |               |
               +----------------------+               +----------------------+
               |                                                             |
               v                                                             v
+-------------------------------+                             +-------------------------------+
|       MySQL Database          |                             |          Amazon S3            |
|   (Relational Data Store)     |                             |   (Private Encrypted Bucket)  |
| - Users                       |                             | - Food Proof Images           |
| - Food Listings               |                             | - Document Uploads            |
| - Pickup Requests             |                             | - SSE-S3 AES-256 Encryption   |
| - File Metadata & SHA-256     |                             | - Pre-Signed URL Access       |
| - Impact Stats & Audit Logs   |                             +-------------------------------+
+---------------+---------------+                                             ^
                |                                                             |
                v                                                             |
+-------------------------------+                                             |
|     Periodic MySQL Dump       |=============================================+
|    (database/backup.sql)      |          (Optional Upload Backup)
+-------------------------------+
```

---

## 📦 2. Technology Stack Overview

| Layer | Component | Technology | Rationale |
|---|---|---|---|
| **Frontend** | User Interface | HTML5, Vanilla CSS3, JavaScript (ES6 Modules) | Fast client-side performance, responsive design system, zero unnecessary build tool dependencies. |
| **Backend** | API Engine | Node.js (v22+), Express.js framework | Non-blocking I/O, lightweight RESTful routing, centralized error handling. |
| **Authentication** | Access Control | JSON Web Tokens (JWT), `bcrypt` | Stateless bearer authentication, password hashing with 10 salt rounds, role-based authorization (Donor, NGO, Volunteer, Admin). |
| **Primary Database** | Relational DB | **MySQL 8.0+** (`mysql2` pool) | Transactional consistency, strict foreign keys, parameterized query security against SQL injection. |
| **Cloud Storage** | Object Store | **Amazon S3** (`@aws-sdk/client-s3`) | High durability file storage, SSE-S3 encryption, Block Public Access, Pre-Signed URL downloads. |
| **PaaS Deployment** | Public PaaS | **Render / Railway** | Zero-downtime containerized Node.js web service deployment with automated SSL. |
| **EC2 Deployment** | IaaS Cloud | **Amazon EC2 (Ubuntu 22.04 LTS)** | Dedicated compute instance, PM2 process management, Nginx reverse proxy, AWS Security Groups. |

---

## 🗄️ 3. Primary Relational Database Architecture (MySQL)

MongoDB has been completely removed from this application. The primary persistent store is **MySQL**.

### Entity-Relationship (ER) Overview

```text
     +-------------------+
     |       users       |
     +---------+---------+
               |
        1      |     *
     +---------v---------+
     |   food_listings   |<--------------------+
     +----+---------+----+                     |
          |         |                          |
        1 |       1 |                          | 1
          |         |                          |
        * |       * |                        * |
+---------v----+  +-v-----------------+  +-----+------------+
|pickup_requests|  |   file_uploads    |  |   audit_logs     |
+---------------+  +-------------------+  +------------------+
```

### Table Definitions

1. **`users`**: Stores user authentication credentials, role (`donor`, `ngo`, `volunteer`, `admin`), phone, address, and geographic coordinates.
2. **`food_listings`**: Stores surplus food details (quantity in kg, expiry time, status, location, recurring flag, volunteer eligibility timestamp).
3. **`pickup_requests`**: Stores NGO pickup requests, proposed pickup times, contact numbers, and approval status.
4. **`file_uploads`**: Stores file metadata for uploaded images/documents (S3 object key, original filename, content type, file size, upload status, and **SHA-256 checksum**).
5. **`impact_stats`**: Maintains global aggregated environmental statistics (`total_kg_saved`, `total_meals`, `total_co2_prevented`).
6. **`audit_logs`**: Tracks critical actions (`SIGNUP`, `LOGIN`, `CREATE_LISTING`, `PICKUP_REQUEST`, `APPROVE_REQUEST`, `COMPLETE_LISTING`, `FILE_UPLOAD`).

---

## 🔐 4. Amazon S3 Security & Storage Architecture

### S3 Configuration Standards
- **Bucket Visibility:** **Block All Public Access** enabled.
- **Server-Side Encryption:** SSE-S3 (`AES256`).
- **Object Key Naming Scheme:**
  `listings/{listingId}/{uuid}.jpg` (UUID prevents key enumeration attacks).

### Confidentiality Workflow
```text
Client Browser ---> Express API (/api/files/:id/download) 
               ---> Auth Check 
               ---> AWS SDK S3 Presigner (@aws-sdk/s3-request-presigner)
               ---> Returns 1-Hour Pre-Signed S3 URL
Client Browser ---> Direct Private Download from Amazon S3
```

### Integrity Verification Workflow
```text
1. User uploads file via Express API (/api/listings/:id/files)
2. Express calculates SHA-256 hash using Node crypto:
   sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
3. File is uploaded to private S3 bucket with SSE-S3 encryption.
4. SHA-256 checksum & S3 object key are stored in MySQL table 'file_uploads'.
5. Examiner clicks "Verify File Integrity" button in UI.
6. Endpoint /api/files/:id/verify recalculates S3 object SHA-256 and compares with stored MySQL hash.
```

---

## 🚀 5. Cloud Deployment Architectures

### A. Public PaaS Architecture (Render / Railway)
```text
GitHub / Source Repository
      |
      v
Public PaaS (Render / Railway)
      |
      +---> Build: npm install
      +---> Start: npm start (node server.js)
      +---> Env Vars: PORT, JWT_SECRET, MYSQL_*, AWS_*
      |
      +---> Connects to Managed MySQL Database
      +---> Connects to Amazon S3 Bucket
```

### B. Amazon EC2 Infrastructure Architecture
```text
Internet
   |
   +--- Port 80 / 443 ---> AWS EC2 Security Group
                              |
                              v
                           Nginx Reverse Proxy
                              |
                              v
                           Node.js Express App (PM2)
                              |
                              +---> MySQL Database
                              +---> Amazon S3 Private Bucket
```

---

## 🛡️ 6. Security Checklist Enforcement

- [x] MongoDB & Firebase completely removed
- [x] MySQL parameterized SQL queries everywhere (`?`)
- [x] Passwords hashed with `bcrypt` (10 rounds)
- [x] JWT bearer token authentication
- [x] S3 Block Public Access enabled
- [x] S3 Server-side encryption (SSE-S3 AES-256)
- [x] S3 Pre-signed URLs for confidential file access
- [x] SHA-256 integrity checksum verification
- [x] File MIME validation (JPEG, PNG, PDF only)
- [x] File size limit enforced (5 MB max)
- [x] Centralized error handling without stack trace leaks

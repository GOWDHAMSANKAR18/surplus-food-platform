# 🖥️ University Project Presentation & Viva Slides Outline

**Project Title:** Cloud-Based Surplus Food Redistribution Platform  
**Subject:** Virtualization and Cloud Computing (40 Marks Rubric)  
**Target Time:** 10–12 Minutes Presentation + 5 Minutes Examiner Q&A  

---

### Slide 1: Title & Team Introduction
- **Project Name:** Cloud-Based Surplus Food Redistribution Platform
- **Problem Domain:** Cloud Computing, Web Architecture, Cryptographic Data Integrity
- **Team Members / Roll Numbers:** [Insert Name & University Roll Number]
- **Supervisor / Guide:** [Insert Professor / Department Name]
- **Key Cloud Technologies:** Public PaaS (Render), Amazon EC2 (Ubuntu 22.04 LTS), Amazon S3 (SSE-S3), MySQL 8.0 Relational Engine

---

### Slide 2: Problem Statement & Motivation
- **Global Food Crisis:** Over 1.3 billion tons of edible food wasted annually, while millions suffer malnutrition.
- **Urban Food Waste:** Hotels, caterers, and college hostels discard large volumes of safe, cooked food due to lack of immediate redistribution channels.
- **System Objective:** Provide a low-latency, cloud-native digital bridge connecting donors with verified NGOs and volunteer fleets before food expires.

---

### Slide 3: 3-Tier System Architecture
```text
+-----------------------------------------------------------+
|               CLIENT LAYER (Responsive Web UI)             |
|   Donor Portal  |  NGO Claiming  |  Volunteer Dispatch    |
+-----------------------------+-----------------------------+
                              | HTTPS / Port 80
                              v
+-----------------------------------------------------------+
|               COMPUTE & REVERSE PROXY LAYER               |
|      Public PaaS (Render)   OR   Amazon EC2 (Nginx + PM2) |
+-----------------------------+-----------------------------+
                              | Internal REST API / JWT Auth
                              v
+-----------------------------------------------------------+
|               STORAGE & SECURITY LAYER                     |
|   MySQL 8.0 Relational Database  |  Amazon S3 (Encrypted) |
|   - Parameterized Queries        |  - SSE-S3 AES-256      |
|   - SHA-256 Stored Checksums     |  - Pre-Signed URLs     |
+-----------------------------------------------------------+
```

---

### Slide 4: Component 1 — Public PaaS Deployment (8 Marks)
- **Platform Choice:** Render / Railway (12-factor cloud application)
- **Deployment Mechanics:**
  - Automated deployment triggers from Git repository.
  - Build command: `npm install`, Start command: `npm start`.
  - Port binding via dynamic environment variable `process.env.PORT`.
- **Health Verification:** Public health endpoint `GET /api/health` providing real-time uptime status, database engine connectivity, and storage mode.

---

### Slide 5: Component 2 — Amazon EC2 Virtualization (8 Marks)
- **Instance Specification:** Amazon EC2 `t2.micro` running Ubuntu Server 22.04 LTS (HVM).
- **Process Management:** PM2 daemon (`pm2 start server.js --name surplus-food-api`) with systemd startup hooks for automatic reboot recovery.
- **Reverse Proxy:** Nginx configured on Port 80/443 proxying requests to Express backend on localhost:4000.
- **Security Group Hardening (`food-donation-sg`):**
  - Inbound Port 22: Restricted SSH administrative access.
  - Inbound Port 80: HTTP public traffic.
  - Inbound Port 443: HTTPS encrypted web traffic.

---

### Slide 6: Component 3 — Amazon S3 Bucket Architecture (8 Marks)
- **Private S3 Storage:** Dedicated bucket storing food proof photographs and organization verification documents.
- **Block Public Access:** All 4 public access blocks enabled to prevent unauthenticated web scraping.
- **Object Key Organization:** Non-colliding hierarchical namespaces:
  `listings/{listingId}/{uuid}.jpg`
- **SDK Implementation:** AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`) using least-privilege IAM roles.

---

### Slide 7: Component 4 — Security: Confidentiality & Integrity (8 Marks)
- **Confidentiality at Rest:** SSE-S3 AES-256 automatic server-side encryption applied to every uploaded object.
- **Confidentiality in Transit:** Objects are private; client browsers access files strictly via temporary, 15-minute Pre-Signed URLs generated using `@aws-sdk/s3-request-presigner`.
- **Cryptographic File Integrity (SHA-256):**
  1. File received via Multer memory stream; SHA-256 computed immediately.
  2. 64-character hash stored in MySQL `file_uploads.sha256_checksum`.
  3. Real-time verification endpoint (`GET /api/files/:id/verify`) streams object bytes, recomputes hash, and confirms byte-for-byte authenticity.
- **Tamper Detection:** Even a 1-bit alteration creates an avalanche effect (>50% digest divergence), instantly flagging corrupted files.

---

### Slide 8: Smart Business Logic & Environmental Analytics
- **Haversine Distance Engine:** Calculates great-circle distance between donor GPS and NGO location in real-time.
- **Smart Priority Scoring:** Dynamically ranks food claims by safe consumption window urgency, NGO capacity, and recurring donation history.
- **Social & Environmental Metrics:**
  - Meals served: `Total kg * 2`
  - CO₂ emissions prevented: `Total kg * 2.5 kg CO₂e`

---

### Slide 9: Automated Testing & Quality Assurance
- **Test Framework:** Node.js native test runner (`node --test`).
- **Results:** 119/119 Tests Passed (100% pass rate).
- **Coverage Areas:**
  - Unit: Haversine distance, scoring math, countdown expiry, validation limits.
  - Security: SHA-256 determinism, tamper avalanche, brute-force rate limiting, source code leak prevention.
  - Integration: Full donor-to-NGO claim lifecycle, Proof-of-Delivery settlement, role-based authorization.

---

### Slide 10: Conclusion & Examiner Q&A
- **Summary of Deliverables:**
  - ✅ Working Public PaaS deployment configuration.
  - ✅ Production-ready EC2 setup with PM2 and Nginx.
  - ✅ Private, encrypted Amazon S3 bucket architecture.
  - ✅ Mathematically verified SHA-256 file integrity engine.
  - ✅ Relational MySQL database schema with zero MongoDB/NoSQL legacy dependencies.
  - ✅ 100% test pass rate across 119 automated test cases.
- **Thank you! Ready for Demonstration and Questions.**

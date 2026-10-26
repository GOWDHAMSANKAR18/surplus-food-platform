# 🌱 Cloud-Based Surplus Food Redistribution Platform

[![Node.js Version](https://img.shields.io/badge/node->=%2022.0.0-brightgreen.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/database-MySQL%208.0-blue.svg)](https://www.mysql.com/)
[![Storage](https://img.shields.io/badge/storage-Amazon%20S3%20%7C%20SSE--S3-orange.svg)](AWS_S3_AND_SECURITY.md)
[![Tests](https://img.shields.io/badge/tests-119%20passed%20%7C%20100%25-brightgreen.svg)](TESTING_REPORT.md)
[![Docker](https://img.shields.io/badge/docker-compose%20v2-2496ED.svg)](docker-compose.yml)
[![PaaS](https://img.shields.io/badge/deploy-Render%20%7C%20Railway-purple.svg)](render.yaml)
[![Rubric](https://img.shields.io/badge/evaluation-40%20Marks%20Rubric-gold.svg)](RUBRIC_MAPPING.md)

An enterprise-grade, cloud-native web application that connects surplus food donors (restaurants, hotels, college hostels, caterers) with verified Non-Governmental Organizations (NGOs) and community volunteer fleets. The platform redistributes edible food before expiry, mitigating urban hunger while actively preventing landfill methane emissions.

Built and evaluated under the **University Virtualization and Cloud Computing Curriculum (40 Marks)**.

---

## 🎯 Academic Evaluation Rubric Mapping (40 Marks)

| S.No. | Rubric Component | Max Marks | Implementation & Evidence | Deliverable / Guide |
|:---:|---|:---:|---|---|
| **1** | **Application Development & Public PaaS Deployment** | **8** | 12-factor Node.js Express REST API configured with dynamic port binding, zero-config `render.yaml` blueprint, `Procfile`, and automated uptime probe `/api/health`. | [PaaS Guide](docs/PAAS_DEPLOYMENT_GUIDE.md)<br>[render.yaml](render.yaml) |
| **2** | **Amazon EC2: Instance Creation, Deployment & Access** | **8** | Virtualized deployment on AWS EC2 Ubuntu 22.04 LTS (`t2.micro`), PM2 process daemon with systemd recovery, Nginx reverse proxy on Port 80, and `food-donation-sg` security group rules. | [AWS_EC2_GUIDE.md](AWS_EC2_GUIDE.md)<br>[nginx/default.conf](nginx/default.conf) |
| **3** | **Amazon S3: Bucket Creation & Management** | **8** | Dedicated private S3 bucket integrated using AWS SDK v3 (`@aws-sdk/client-s3`), structured key namespaces (`listings/{id}/{uuid}.ext`), metadata tagging, and Block All Public Access. | [AWS_S3_AND_SECURITY.md](AWS_S3_AND_SECURITY.md)<br>[services/s3Service.js](services/s3Service.js) |
| **4** | **Secure File Upload: Confidentiality & Integrity** | **8** | **Confidentiality:** SSE-S3 AES-256 encryption at rest + 15-minute Pre-Signed URLs (`@aws-sdk/s3-request-presigner`).<br>**Integrity:** SHA-256 hash computed on upload, stored in MySQL, and recalculated stream-by-stream via `/api/files/:id/verify`. | [AWS_S3_AND_SECURITY.md](AWS_S3_AND_SECURITY.md)<br>[TESTING_REPORT.md](TESTING_REPORT.md) |
| **5** | **Documentation, Presentation & Viva** | **8** | Complete 16-section technical documentation, 100% automated test coverage (119/119 pass), 30+ Viva Voce questions & answers, oral defense slides outline, and MySQL backup script. | [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)<br>[VIVA_QUESTIONS_AND_ANSWERS.md](VIVA_QUESTIONS_AND_ANSWERS.md)<br>[PRESENTATION_SLIDES.md](PRESENTATION_SLIDES.md) |
| | **TOTAL** | **40** | **All 5 components fully satisfied with working code, architecture, and tests.** | [PROJECT_COMPLETION_STATUS.md](PROJECT_COMPLETION_STATUS.md) |

---

## 🏗️ System Architecture

```text
                           CLIENT PRESENTATION TIER
          (Donors, NGOs, Volunteers, Administrators on Responsive Web)
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │       REVERSE PROXY & GATEWAY TIER (PORT 80)     │
             │   - Nginx Reverse Proxy (SSL termination / gzip) │
             │   - Public PaaS Ingress Router (Render / Railway)│
             └────────────────────────┬─────────────────────────┘
                                      │ HTTP /api (Port 4000)
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │            APPLICATION LOGIC TIER                │
             │   - Node.js v22 & Express REST API Engine        │
             │   - PM2 Process Manager (systemd Auto-Restart)   │
             │   - JWT HS256 Role-Based Access Control (RBAC)   │
             │   - Haversine Geospatial Proximity Matcher       │
             │   - Smart Priority Urgency Scoring Engine        │
             │   - Proof-of-Delivery (PoD) Settlement Protocol  │
             └─────────────────┬──────────────┬─────────────────┘
                               │              │
               Parameterized SQL Queries      │ AWS SDK v3 PutObject / GetObject
                               ▼              ▼
┌─────────────────────────────────────────┐  ┌────────────────────────────────────────┐
│             DATA TIER                   │  │         OBJECT STORAGE TIER            │
│   MySQL 8.0 Relational Engine           │  │   Amazon S3 (Private Bucket)           │
│   - users, food_listings, audit_logs    │  │   - SSE-S3 AES-256 Encryption at Rest  │
│   - pickup_requests, file_uploads       │  │   - 15-Minute Pre-Signed Retrieval URLs│
│   - SHA-256 Baseline Checksums          │  │   - Collision-Proof UUID Object Keys   │
│   - Transactional Integrity & Backups   │  │   - Block All Public Access Enabled    │
└─────────────────────────────────────────┘  └────────────────────────────────────────┘
```

---

## 🚀 Key Features & Innovations

1. **Role-Based Workflows:** Distinct operational interfaces for **Donors**, **NGOs**, **Volunteers**, and **Administrators**.
2. **Haversine Proximity Matcher:** Real-time great-circle geographic distance calculations between donors and NGO distribution hubs.
3. **Smart Priority Scoring:** Dynamically prioritizes claims using remaining safe-consumption hours, NGO capacity, and daily recurring surplus bonus.
4. **Secure Amazon S3 Storage:** Strict server-side validation rejecting files > 5 MB or unauthorized types. Validates binary magic bytes for JPEG (`0xff 0xd8`), PNG (`0x89 0x50 0x4e 0x47`), and PDF (`%PDF`).
5. **SHA-256 Stream-Level Integrity Verification:** Downloads object bytes and calculates SHA-256 hash in real time to verify byte-for-byte authenticity against the MySQL baseline.
6. **Zero Legacy Dependencies:** Fully relational MySQL 8.0 schema with foreign key constraints, connection pooling, and parameterized queries protecting against SQL injection.
7. **Dual-Mode Storage Engine:** Configurable via `STORAGE_MODE`: uses local sandboxed filesystem for offline development and Amazon S3 with SSE-S3 encryption in cloud production.
8. **Automated Expiration Scheduler:** Background timer marks uncollected food as expired, protecting community health.
9. **Environmental & Social Impact Metrics:** Dynamic tracking of food saved (kg), meals served (`kg * 2`), and CO₂ emissions diverted (`kg * 2.5`).

---

## 🔑 Demonstration Accounts

All demo accounts share the password: **`password123`**

| Role | Email | Portal Description & Core Actions |
|---|---|---|
| **Donor** | `donor@example.com` | Create listings, attach food proof photos, review claims, retract listings. |
| **NGO** | `ngo@example.com` | View priority-scored listings, request pickups, complete Proof-of-Delivery. |
| **Volunteer** | `volunteer@example.com` | Claim emergency deliveries when listings reach the volunteer-eligible window. |
| **Admin** | `admin@example.com` | Audit logs, platform verification status, aggregate environmental analytics. |

---

## ⚙️ Running Locally

### Option A: Docker Compose (Recommended — 1 Command)
The repository includes a production-grade multi-container stack (`Nginx 1.27` + `Node.js App` + `MySQL 8.0`):

```bash
# 1. Start all services
docker compose up --build

# 2. Check running services
docker compose ps
```
Open **[http://localhost](http://localhost)** in your browser (Nginx proxies Port 80 directly to the application).

---

### Option B: Local Node.js + Local MySQL Server

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `.env` contains your MySQL credentials and a 32+ character `JWT_SECRET`:
```env
PORT=4000
NODE_ENV=development
STORAGE_MODE=local
JWT_SECRET=food_donation_platform_development_jwt_secret_key_32_chars_min
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=food_donation
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
```

#### 3. Initialize MySQL Database
```powershell
# PowerShell (Windows):
Get-Content database/schema.sql -Raw | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pYourPassword food_donation
Get-Content database/seed.sql -Raw   | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pYourPassword food_donation
```

#### 4. Start Server
```bash
npm start
# or for live auto-reload during development:
npm run dev
```
Open **[http://localhost:4000](http://localhost:4000)** in your browser.

---

## 🧪 Automated Testing & QA (100% Pass)

The application includes a comprehensive test suite executed with Node's native test runner (`node --test`).

```bash
# Run all 119 automated tests
npm test
```

### Verified Test Results:
```text
✔ Spatial Distance Engine (Haversine Formula) (4/4 tests passed)
✔ Smart Priority Scoring Engine (5/5 tests passed)
✔ Countdown Timer & Expiry Logic (4/4 tests passed)
✔ Environmental Impact Formulas (4/4 tests passed)
✔ Core Business Logic & Input Validation (5/5 tests passed)
✔ Cryptographic Storage & SHA-256 Hashing (2/2 tests passed)
✔ System Health Check & Source Leak Prevention (4/4 tests passed)
✔ Authentication, JWT & Rate Limiting (14/14 tests passed)
✔ Food Listing CRUD & Donor Workflow (18/18 tests passed)
✔ NGO Discovery, Haversine Radius & Claims (15/15 tests passed)
✔ Volunteer Emergency Pickup Eligibility (8/8 tests passed)
✔ File Upload Security (MIME, Magic Bytes, 5MB limit) (12/12 tests passed)
✔ Real-Time SHA-256 File Integrity Verification (5/5 tests passed)
✔ Donor Retraction & PoD Settlement Events (13/13 tests passed)
✔ End-to-End User Journeys & RBAC (4/4 tests passed)
----------------------------------------------------------------------
# tests 119 | # suites 16 | # pass 119 | # fail 0 | Duration: 1.7s
```
*Read the full test breakdown in [TESTING_REPORT.md](TESTING_REPORT.md).*

---

## 🌐 Cloud Deployment Options

### 1. Public PaaS (Render / Railway)
- **Configuration File:** [render.yaml](render.yaml) & [Procfile](Procfile)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`
- Step-by-step instructions: [docs/PAAS_DEPLOYMENT_GUIDE.md](docs/PAAS_DEPLOYMENT_GUIDE.md)

### 2. Amazon EC2 Virtual Machine
- **Instance Type:** `t2.micro` (AWS Free Tier eligible)
- **OS:** Ubuntu Server 22.04 LTS (HVM)
- **Process Supervision:** PM2 daemon (`pm2 start server.js --name surplus-food-api`)
- **Reverse Proxy:** Nginx proxying port 80 to port 4000
- **Firewall:** AWS Security Group `food-donation-sg` (Inbound Ports: 22, 80, 443)
- Step-by-step instructions: [AWS_EC2_GUIDE.md](AWS_EC2_GUIDE.md)

### 3. Amazon S3 Private Bucket
- **Security:** Block All Public Access enabled
- **Encryption:** SSE-S3 (`AES256`)
- **Retrieval:** 15-Minute Pre-Signed URLs (`@aws-sdk/s3-request-presigner`)
- Step-by-step instructions: [AWS_S3_AND_SECURITY.md](AWS_S3_AND_SECURITY.md)

---

## 📊 Diagnostic & Verification Endpoints

| Endpoint | Method | Access | Description |
|---|:---:|:---:|---|
| `/api/health` | `GET` | Public | Real-time health status, database engine, storage mode, and uptime. |
| `/api/impact` | `GET` | Public | Global metrics: total kg saved, meals served, and CO₂ prevented. |
| `/api/files/:id/download` | `GET` | Auth | Generates a 15-minute secure Pre-Signed S3 download URL. |
| `/api/files/:id/verify` | `GET` | Auth | Streams file bytes, recalculates SHA-256, and confirms integrity against MySQL. |

---

## 📁 Project Documentation Index

| Document | Description |
|---|---|
| 📊 **[PROJECT_COMPLETION_STATUS.md](PROJECT_COMPLETION_STATUS.md)** | Master completion tracker mapping evidence against each rubric requirement. |
| 📘 **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** | Comprehensive 16-section technical documentation report. |
| 🧪 **[TESTING_REPORT.md](TESTING_REPORT.md)** | Complete audit report for all 119 automated unit, integration, and security tests. |
| 🎓 **[VIVA_QUESTIONS_AND_ANSWERS.md](VIVA_QUESTIONS_AND_ANSWERS.md)** | 30+ Viva Voce questions & answers covering Virtualization, PaaS, EC2, S3, and Security. |
| 🖥️ **[PRESENTATION_SLIDES.md](PRESENTATION_SLIDES.md)** | 10-Slide oral defense outline ready for university viva presentation. |
| 🏗️ **[ARCHITECTURE.md](ARCHITECTURE.md)** | Technical architecture, data flow diagrams, and schema specifications. |
| 📋 **[RUBRIC_MAPPING.md](RUBRIC_MAPPING.md)** | 40-Mark academic rubric alignment and evidence checklist. |
| 🖥️ **[AWS_EC2_GUIDE.md](AWS_EC2_GUIDE.md)** | Step-by-step guide for deploying on Amazon EC2 Ubuntu instances. |
| 🪣 **[AWS_S3_AND_SECURITY.md](AWS_S3_AND_SECURITY.md)** | S3 bucket security setup, Pre-Signed URLs, and SHA-256 integrity verification. |
| 🌐 **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | Unified deployment reference for Local, Docker, PaaS, and EC2. |
| 💾 **[MYSQL_BACKUP_GUIDE.md](docs/MYSQL_BACKUP_GUIDE.md)** | Database backup procedures (`npm run backup`). |

---

## 📜 License
Educational & University Evaluation Project — Developed for Virtualization and Cloud Computing.

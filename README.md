# 🌱 Cloud-Based Surplus Food Redistribution Platform

[![Node.js Version](https://img.shields.io/badge/node->=%2022.0.0-brightgreen.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/database-MySQL%208.0-blue.svg)](https://www.mysql.com/)
[![Storage](https://img.shields.io/badge/storage-Amazon%20S3-orange.svg)](https://aws.amazon.com/s3/)
[![Security](https://img.shields.io/badge/security-SHA--256%20Integrity%20%7C%20SSE--S3-red.svg)](RUBRIC_MAPPING.md)

An enterprise-grade, cloud-based web application designed to connect food donors (restaurants, hotels, hostels) with NGOs and volunteers to redistribute surplus edible food before expiry, reducing hunger and preventing greenhouse gas emissions.

---

## 🎯 Academic Evaluation Rubric Mapping (40 Marks)

| Rubric Component | Marks | Implementation & Evidence |
|---|:---:|---|
| **1. Application Development & Deployment using Public PaaS** | **8** | Node.js Express REST API deployed on Public PaaS (Render/Railway) with health endpoint `/api/health`. |
| **2. Amazon EC2: Instance Creation, Deployment & Access** | **8** | Application deployed on Ubuntu EC2 instance with PM2 process manager and Nginx reverse proxy. Guide in `docs/EC2_DEPLOYMENT_GUIDE.md`. |
| **3. Amazon S3: Bucket Creation & Management** | **8** | Private S3 bucket storing food proof images & verification documents using `@aws-sdk/client-s3`. Guide in `docs/S3_SETUP_GUIDE.md`. |
| **4. Secure File Upload to S3 – Confidentiality & Integrity** | **8** | **Confidentiality:** Block Public Access + SSE-S3 encryption + 1-hour Pre-Signed URLs (`@aws-sdk/s3-request-presigner`).<br>**Integrity:** SHA-256 hash calculated on upload, saved in MySQL, verified via `/api/files/:id/verify`. |
| **5. Project Documentation, Presentation & Viva** | **8** | Full documentation (`PROJECT_DOCUMENTATION.md`), Architecture (`ARCHITECTURE.md`), Rubric (`RUBRIC_MAPPING.md`), 30+ Viva Q&A (`VIVA_QA.md`), and MySQL backup script (`npm run backup`). |
| **TOTAL** | **40** | **All 5 components fully satisfied.** |

---

## 🏗️ System Architecture

```text
                 USERS / CLIENTS
                        |
                        v
         Public PaaS / Amazon EC2 (Nginx)
                        |
                        v
             Node.js + Express REST API
                /               \
               /                 \
              v                   v
      MySQL Database          Amazon S3
   - Users                 - Private Bucket
   - Food Listings         - SSE-S3 Encrypted
   - Pickup Requests       - Pre-Signed URLs
   - SHA-256 Checksums     - SHA-256 Integrity
   - Impact Stats          
   - Audit Logs            
```

---

## 🚀 Key Features

1. **Role-Based Workflows:** Tailored portals for **Donors**, **NGOs**, **Volunteers**, and **Admins**.
2. **Smart Priority Algorithm:** Calculates priority scores based on Haversine distance, safe consumption window urgency, NGO capacity, and daily recurring surplus bonus.
3. **Secure Amazon S3 Storage:** Confidential upload of food proof images and documents with MIME validation (JPEG, PNG, PDF only), 5 MB size limit, and UUID key generation.
4. **SHA-256 Cryptographic File Integrity:** Stores 64-character hash in MySQL and verifies file authenticity in real-time via `/api/files/:id/verify`.
5. **MySQL Relational Database:** Zero legacy MongoDB/Firebase dependencies. Fully relational schema with parameterized queries protecting against SQL injection.
6. **Environmental Impact Analytics:** Dynamic calculation of food saved (kg), meals served, and CO₂ emissions prevented.
7. **Automated Database Backup:** Script (`npm run backup`) exports database records using environment-provided credentials.
8. **Explicit storage modes:** `STORAGE_MODE=local` is intentional for development; `STORAGE_MODE=s3` requires a configured private bucket and never silently falls back.
9. **Tamper detection:** Local and S3 verification streams actual object bytes and compares them with the stored SHA-256 baseline.

---

## 🔑 Demo Credentials

All test accounts use password: `password123`

- **Donor:** `donor@example.com`
- **NGO:** `ngo@example.com`
- **Volunteer:** `volunteer@example.com`
- **Admin:** `admin@example.com`

---

## ⚙️ Quick Start (Local Setup)

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd surplus-food-platform
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure local credentials. Never commit `.env`:
```bash
cp .env.example .env
```

Use `STORAGE_MODE=local` for a local-only demonstration. For AWS, set `STORAGE_MODE=s3`, configure a private bucket, and use an IAM role or AWS CLI profile.

### 3. Initialize MySQL Database
Run the MySQL schema and seed data scripts:
```bash
mysql -u root -p food_donation < database/schema.sql
mysql -u root -p food_donation < database/seed.sql
```

### 4. Start Application
```bash
npm start
```
Open `http://localhost:4000` in your browser.

### Docker

Set `JWT_SECRET`, `MYSQL_PASSWORD`, and `MYSQL_ROOT_PASSWORD` in `.env`, then run `docker compose up --build`. Nginx listens on port 80 and the application container is not exposed directly.

---

## 📊 Diagnostic & Verification Endpoints

- **Health Check:** `GET /api/health`
- **File Download (Pre-Signed S3 URL):** `GET /api/files/:id/download`
- **File Integrity Verification:** `GET /api/files/:id/verify`
- **Global Impact Stats:** `GET /api/impact`

---

## 📁 Documentation Index

- 📘 **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** - Full 16-section technical documentation report.
- 🏗️ **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture & database schema diagrams.
- 📋 **[RUBRIC_MAPPING.md](RUBRIC_MAPPING.md)** - 40-Mark evaluation rubric mapping & evidence.
- 🎓 **[VIVA_QA.md](VIVA_QA.md)** - 30+ Viva questions & simple answers.
- 🖥️ **[EC2 Deployment Guide](docs/EC2_DEPLOYMENT_GUIDE.md)** - Amazon EC2 installation steps.
- 🚀 **[PaaS Deployment Guide](docs/PAAS_DEPLOYMENT_GUIDE.md)** - Render / Railway deployment guide.
- 🪣 **[S3 Setup Guide](docs/S3_SETUP_GUIDE.md)** - Amazon S3 bucket security setup.
- 💾 **[MySQL Backup Guide](docs/MYSQL_BACKUP_GUIDE.md)** - Database backup strategy & scripts.
- 🧪 **[Testing Instructions](docs/TESTING_INSTRUCTIONS.md)** - Testing & demo walkthrough.

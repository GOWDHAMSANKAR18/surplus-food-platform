# 🚀 START HERE: Quick Setup Guide

Welcome to the **Cloud-Based Surplus Food Redistribution Platform**.

---

## ⏱️ Quick Setup (5 Minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### Step 3: Run Database Scripts (MySQL)
```bash
mysql -u root -p food_donation < database/schema.sql
mysql -u root -p food_donation < database/seed.sql
```

### Step 4: Start Application
```bash
npm start
```
Open `http://localhost:4000` in your browser.

---

## 🔑 Pre-Seeded Test Credentials
All test passwords: `password123`

- **Donor Account:** `donor@example.com`
- **NGO Account:** `ngo@example.com`
- **Volunteer Account:** `volunteer@example.com`
- **Admin Account:** `admin@example.com`

---

## 📚 Key Documentation Links

- 📘 **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** - Full technical report (16 sections).
- 📋 **[RUBRIC_MAPPING.md](RUBRIC_MAPPING.md)** - 40-Mark academic rubric mapping & evidence.
- 🎓 **[VIVA_QA.md](VIVA_QA.md)** - 30+ Viva questions & simple answers.
- 🖥️ **[EC2 Deployment Guide](docs/EC2_DEPLOYMENT_GUIDE.md)** - Amazon EC2 deployment instructions.
- 🚀 **[PaaS Deployment Guide](docs/PAAS_DEPLOYMENT_GUIDE.md)** - Render / Railway PaaS deployment guide.
- 🪣 **[S3 Setup Guide](docs/S3_SETUP_GUIDE.md)** - Amazon S3 bucket security setup.
- 💾 **[MySQL Backup Guide](docs/MYSQL_BACKUP_GUIDE.md)** - Database backup procedures.
- 🧪 **[Testing Instructions](docs/TESTING_INSTRUCTIONS.md)** - Testing & demonstration guide.

# ⏱️ Quick Deployment & Demonstration Guide

This guide is designed for quick deployment, testing, and live presentation of the **Cloud-Based Food Redistribution Platform**.

---

## ⚡ 1. Rapid Local Setup (2 Minutes)

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run database schema & seed scripts
mysql -u root -p food_donation < database/schema.sql
mysql -u root -p food_donation < database/seed.sql

# Start Express server
npm start
```

---

## 🎬 2. Live Demo Checklist for Examiners

- [ ] Open `http://localhost:4000/api/health` to prove Express + MySQL + S3 status.
- [ ] Login as **Donor** (`donor@example.com` / `password123`).
- [ ] Create a food listing and attach a photo file.
- [ ] Show the uploaded file details and click **View File (S3 Presigned URL)**.
- [ ] Click **🛡️ Verify Integrity** button to demonstrate real-time SHA-256 hash comparison against MySQL.
- [ ] Login as **NGO** (`ngo@example.com` / `password123`).
- [ ] View available food listings sorted by Smart Priority Score.
- [ ] Request pickup -> Donor approves -> NGO completes pickup.
- [ ] Open `dashboard.html` to show global impact stats update in real-time.
- [ ] Show EC2 deployment guide (`docs/EC2_DEPLOYMENT_GUIDE.md`) and PaaS guide (`docs/PAAS_DEPLOYMENT_GUIDE.md`).
- [ ] Run `npm run backup` to show database snapshot creation (`database/backup.sql`).

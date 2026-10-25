# 🧪 Testing & Verification Instructions

This document provides clear step-by-step instructions for testing and verifying all application features, cloud endpoints, S3 uploads, file integrity verification, and database persistence.

---

## 🚀 1. Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start server
npm start
```

Server starts on: `http://localhost:4000`

---

## 📊 2. Health Endpoint Verification

Visit: `http://localhost:4000/api/health`

Expected JSON response:
```json
{
  "status": "ok",
  "server": "Node.js Express API",
  "database": { "status": "connected" },
  "storage": { "storageType": "Amazon S3 or Local Fallback" }
}
```

---

## 🔑 3. Demonstration Credentials

The database comes pre-seeded with sample accounts (all passwords are `password123`):

| Role | Email | Password |
|---|---|---|
| **Donor** | `donor@example.com` | `password123` |
| **NGO** | `ngo@example.com` | `password123` |
| **Volunteer** | `volunteer@example.com` | `password123` |
| **Admin** | `admin@example.com` | `password123` |

---

## 🎬 4. Complete Step-by-Step Demonstration Workflow

### Step 1: Donor Login & Listing Creation
1. Open `http://localhost:4000/index.html`.
2. Login with `donor@example.com` / `password123`.
3. In Donor Dashboard, fill in:
   - Food: `Fresh Cooked Rice & Curry`
   - Quantity: `20 kg`
   - Expiry: `4 hours`
   - Attach a food proof image file (JPG / PNG / PDF).
4. Click **Create Listing & Upload to S3**.

### Step 2: S3 Upload & Metadata Verification
1. Under **Your Active Listings**, view the attached file.
2. Note the file size, content type, and SHA-256 checksum preview.
3. Click **View File (S3 Presigned URL)** to test confidential S3 file access.

### Step 3: SHA-256 Integrity Verification (Rubric Item 4)
1. Click the **🛡️ Verify Integrity** button on the file card.
2. The system queries `/api/files/:id/verify`.
3. Modal displays:
   - Status: `VERIFIED`
   - Stored MySQL SHA-256 checksum matches recalculated S3 object checksum 100%.

### Step 4: NGO Pickup Request & Priority Score
1. Log out and login as NGO (`ngo@example.com` / `password123`).
2. NGO Dashboard displays available listings within 10 km sorted by **Smart Priority Score**.
3. Click **Request Pickup**, enter pickup time, and submit.

### Step 5: Donor Approval & NGO Pickup Completion
1. Log back in as Donor (`donor@example.com`).
2. Under **Pickup Requests**, click **Approve**.
3. Log in as NGO (`ngo@example.com`), navigate to **Your Accepted Pickups**, and click **Mark Completed**.
4. Check **Your Impact** metrics and **Global Impact Dashboard** (`dashboard.html`) to verify that total kg saved, meals served, and CO₂ emissions update in real-time in MySQL!

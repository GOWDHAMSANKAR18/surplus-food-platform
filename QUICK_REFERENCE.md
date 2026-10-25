# ⚡ Quick Reference Sheet

---

## 🏃 CLI Commands Quick Reference

| Action | Command |
|---|---|
| **Install Dependencies** | `npm install` |
| **Start Local Server** | `npm start` |
| **Run Database Backup** | `npm run backup` |
| **Import MySQL Schema** | `mysql -u root -p food_donation < database/schema.sql` |
| **Import Seed Data** | `mysql -u root -p food_donation < database/seed.sql` |

---

## 🔑 Demo Login Accounts

Password for all: `password123`

- **Donor:** `donor@example.com`
- **NGO:** `ngo@example.com`
- **Volunteer:** `volunteer@example.com`
- **Admin:** `admin@example.com`

---

## 🌐 API Endpoint Cheat Sheet

- `GET /api/health` - Diagnostic health check
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login & JWT generation
- `GET /api/donor/listings` - Donor listings
- `POST /api/donor/listings` - Create listing
- `GET /api/ngo/listings` - Available listings for NGO
- `POST /api/listings/:id/requests` - Submit pickup request
- `POST /api/requests/:id/approve` - Approve request
- `POST /api/listings/:id/accept` - Accept pickup
- `POST /api/listings/:id/complete` - Complete pickup
- `POST /api/listings/:id/files` - Upload S3 file
- `GET /api/listings/:id/files` - List S3 files with Pre-Signed URLs
- `GET /api/files/:id/verify` - Verify SHA-256 integrity

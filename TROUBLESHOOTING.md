# 🔧 Troubleshooting & Diagnostic Guide

This guide provides resolutions for common operational issues during development and deployment of the **Cloud-Based Food Redistribution Platform**.

---

## 🛠️ Common Issues & Resolutions

### Issue 1: `MySQL Connection Refused / ER_ACCESS_DENIED_ERROR`
- **Cause:** MySQL service is not running or incorrect credentials in `.env`.
- **Solution:**
  1. Ensure MySQL daemon is running (`sudo systemctl status mysql` or MySQL Service in Windows).
  2. Verify `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` in `.env`.
  3. Run `mysql -u root -p < database/schema.sql` to initialize database.
  4. Note: The application includes a development fallback engine so local server testing will still run if MySQL service is not installed on developer machines.

### Issue 2: `Amazon S3 Upload Fails / Invalid AWS Credentials`
- **Cause:** Missing AWS keys or incorrect bucket name in `.env`.
- **Solution:**
  1. Verify `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in `.env`.
  2. On EC2 instances, attach an **IAM Role** with `AmazonS3FullAccess` or custom bucket policy instead of storing hardcoded keys.
  3. Ensure bucket **Block Public Access** is set appropriately and backend handles Pre-Signed URL access.

### Issue 3: `File Upload Rejected (Invalid File Type or Size)`
- **Cause:** Uploaded file is not JPEG, PNG, or PDF, or exceeds 5 MB.
- **Solution:**
  1. Verify MIME type of upload (`image/jpeg`, `image/png`, `application/pdf`).
  2. Ensure file size is within the 5 MB limit.

### Issue 4: `SHA-256 File Integrity Check Failed`
- **Cause:** Checksum mismatch between stored MySQL hash and storage object.
- **Solution:**
  1. Re-upload file via `POST /api/listings/:id/files`.
  2. Call `GET /api/files/:id/verify` to confirm matching SHA-256 hashes.

### Issue 5: `JWT Authorization Error / Invalid Token`
- **Cause:** Missing or expired Authorization header.
- **Solution:**
  1. Ensure requests include header: `Authorization: Bearer <token>`.
  2. Re-login via `/api/auth/login` to obtain a fresh JWT token.

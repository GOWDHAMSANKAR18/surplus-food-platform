# 🪣 Amazon S3 & Security Architecture (Components 3 & 4 — 16 Marks)

This guide details the **Amazon S3** configuration, confidential object storage workflow, and real-time **SHA-256 cryptographic integrity verification** implemented in the Surplus Food Redistribution Platform.

---

## 🔒 1. S3 Bucket Security Setup

### Creation & Configuration in AWS Console:
1. Log into **AWS Management Console** -> Navigate to **Amazon S3**.
2. Click **Create bucket**.
3. **Bucket Name:** `surplus-food-platform-<your-unique-suffix>` (Must be globally unique, e.g., `surplus-food-platform-gowdham`).
4. **AWS Region:** `us-east-1` (US East, N. Virginia).
5. **Block Public Access settings for this bucket:**
   - ✅ **Check "Block all public access"**.
   - Acknowledge that the bucket and objects will not be public.
6. **Default encryption:**
   - Select **Server-side encryption with Amazon S3 managed keys (SSE-S3)**.
   - Bucket Key: **Enable**.
7. Click **Create bucket**.

---

## 🏗️ 2. Object Key Hierarchy & Organization

To avoid filename collisions and prevent path enumeration attacks, all objects are organized by UUID:

```text
surplus-food-platform/
   └── listings/
         └── {listingId}/
               └── {crypto.randomUUID()}.jpg
```

---

## 🛡️ 3. Confidentiality Workflow (Pre-Signed URLs)

Because public access is completely blocked:
1. Client applications **never** access S3 objects via raw public URLs.
2. When an authorized user requests to view a donation proof, the Express API backend calls `@aws-sdk/s3-request-presigner`:
   ```javascript
   import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
   import { GetObjectCommand } from '@aws-sdk/client-s3';

   const presignedUrl = await getSignedUrl(
     s3Client,
     new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: objectKey }),
     { expiresIn: 900 } // Valid for 15 minutes only
   );
   ```
3. The generated URL contains temporary AWS authentication signatures. Once expired, access is automatically revoked.

---

## 🔍 4. Cryptographic File Integrity (SHA-256)

### How It Works:
```text
[Donor Uploads File]
        │
        ├─► Server computes SHA-256 hash from memory buffer
        │     const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
        │
        ├─► File uploaded to S3 with SSE-S3 encryption
        │     PutObjectCommand({ ServerSideEncryption: 'AES256', Metadata: { 'sha256-checksum': checksum } })
        │
        └─► Checksum stored permanently in MySQL table:
              INSERT INTO file_uploads (sha256_checksum, ...) VALUES ('e3b0c442...', ...)

[Examiner Clicks "Verify File Integrity"]
        │
        ├─► Server fetches stored SHA-256 hash from MySQL
        │
        ├─► Server streams file bytes directly from S3 (or local storage)
        │     const stream = (await s3Client.send(new GetObjectCommand(...))).Body;
        │
        ├─► Server recalculates SHA-256 hash dynamically across stream chunks
        │
        └─► Hash Comparison:
              storedChecksum === recalculatedChecksum ? "verified" : "failed"
```

### Verification API Endpoint:
- **Route:** `GET /api/files/:id/verify`
- **Response Output:**
  ```json
  {
    "integrity": "verified",
    "algorithm": "SHA-256",
    "fileId": 1,
    "filename": "food_proof.jpg",
    "storedChecksum": "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    "calculatedChecksum": "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    "verifiedAt": "2026-10-25T10:14:22.000Z"
  }
  ```

---

## 🧪 5. Automated Security Tests

Verified in unit and integration test suites:
- **UT-23:** Deterministic SHA-256 digest computation matches baseline.
- **UT-24:** Tamper sensitivity test verifies that modifying 1 character in a file produces an avalanche effect (>50% digest divergence).
- **MIME & Magic Bytes:** Rejects disguised executables or unsupported file types. Only JPEG (`0xff 0xd8`), PNG (`0x89 0x50 0x4e 0x47`), and PDF (`%PDF`) are permitted.
- **Size Boundary:** Files larger than 5 MB are rejected with HTTP 400.

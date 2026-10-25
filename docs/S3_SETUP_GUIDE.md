# 🪣 Amazon S3 Setup & Security Configuration Guide

This guide explains how to create, configure, and secure an Amazon S3 bucket for confidential document storage and cryptographic integrity verification in the Cloud-Based Food Redistribution Platform.

---

## 🏗️ 1. Create S3 Bucket

1. Log in to the **AWS Management Console** and navigate to **Amazon S3**.
2. Click **Create bucket**.
3. **Bucket Name:** `food-donation-platform-s3-bucket` (must be globally unique).
4. **AWS Region:** Select `us-east-1` (or your preferred region).

---

## 🔒 2. Block Public Access (Confidentiality Requirement)

1. Under **Block Public Access settings for this bucket**:
   - Check **Block *all* public access**.
   - Acknowledge that the bucket and objects will not be publicly accessible.

> **Rationale:** By blocking all public access, direct unauthorized downloads or web indexing of food verification photos and organization documents are completely prevented.

---

## 🔐 3. Server-Side Encryption (SSE)

1. Under **Default encryption**:
   - Select **Server-side encryption with Amazon S3 managed keys (SSE-S3)** or **AWS Key Management Service (SSE-KMS)**.
   - Bucket Key: **Enable**.

> **Rationale:** All uploaded files are automatically encrypted at rest before being written to disk in AWS datacenters.

---

## 📁 4. Object Organization Hierarchy

Files are stored according to a structured key hierarchy:

```text
food-donation-platform-s3-bucket/
    listings/
        {listingId}/
            {uuid}.jpg
            {uuid}.png
    documents/
        {userId}/
            {uuid}.pdf
```

Using UUIDs (e.g., ` listings/1/8f2c3d4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a.jpg`) guarantees zero key collisions and prevents path enumeration attacks.

---

## 🔑 5. Pre-Signed URLs Access Workflow

Because public access is blocked, client applications request private file access via Express backend endpoints:
1. `GET /api/listings/:id/files`
2. `GET /api/files/:id/download`

The backend uses `@aws-sdk/s3-request-presigner` to generate a temporary, signed URL valid for 3600 seconds (1 hour):

```javascript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const command = new GetObjectCommand({ Bucket: 'my-bucket', Key: objectKey });
const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
```

---

## 🛡️ 6. SHA-256 Integrity Verification

1. When a file is uploaded via `POST /api/listings/:id/files`, the server calculates the SHA-256 checksum:
   ```javascript
   const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
   ```
2. The 64-character hash is saved in the MySQL table `file_uploads.sha256_checksum`.
3. When the user clicks **"Verify File Integrity"**, `GET /api/files/:id/verify` downloads or reads the file, recalculates the SHA-256 hash, and compares it against MySQL.

Returns:
```json
{
  "integrity": "verified",
  "algorithm": "SHA-256",
  "storedChecksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "recalculatedChecksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

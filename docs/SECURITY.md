# Security

## Authentication and authorization

The API uses short-lived HS256 JWT access tokens. `JWT_SECRET` is required in production and tokens are verified with an explicit algorithm allowlist. Route handlers enforce the donor, NGO, volunteer, and administrator roles, and file access additionally checks listing ownership or participation.

Login attempts are limited per client IP and email for 15 minutes. Behind Nginx, set `TRUST_PROXY=true` only when the proxy is controlled and configured to overwrite forwarding headers.

## File security and integrity

Uploads are limited to JPEG, PNG, and PDF files, checked against their magic bytes, capped at 5 MB, and stored under server-generated keys. SHA-256 is calculated from the uploaded bytes and stored as the trusted baseline. Verification streams the actual local file or S3 object and reports `verified`, `failed`, `missing`, or `unavailable`; retrieval failures are never treated as verified.

S3 objects are private and use SSE-S3. Production uses `STORAGE_MODE=s3` explicitly and does not silently fall back to local storage. Local mode is intentional for development only.

## Known limitations

SHA-256 detects accidental or unauthorized content changes but is not a digital signature. An attacker who can modify both the object and database checksum can bypass this control; protect the database, S3 bucket, IAM role, and audit logs separately.

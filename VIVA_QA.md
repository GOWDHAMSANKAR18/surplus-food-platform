# 🎓 Viva Voice Question & Answer Guide (30+ Questions)

This guide prepares you to answer examiner questions confidently during the project viva and demonstration.

---

## 🌐 Section 1: Cloud Computing & PaaS (Questions 1–6)

### Q1: What is cloud computing?
**Answer:** Cloud computing is the on-demand delivery of IT resources (compute, storage, databases, networking) over the internet with pay-as-you-go pricing.

### Q2: Why did you use cloud computing for this food donation platform?
**Answer:** Cloud computing provides high availability, global scalability, dynamic compute power for peak donation hours, and secure file storage (Amazon S3) without requiring physical server infrastructure.

### Q3: What is Platform as a Service (PaaS)?
**Answer:** PaaS is a cloud computing model where a third-party provider delivers hardware and software tools—usually those needed for application development—to users over the internet.

### Q4: Why deploy the application on a Public PaaS (like Render/Railway)?
**Answer:** Public PaaS automates infrastructure management, container builds, SSL certificate provisioning, and environment variable configuration, allowing instant public access for examiners.

### Q5: What is Amazon EC2?
**Answer:** Amazon EC2 (Elastic Compute Cloud) is an Infrastructure as a Service (IaaS) offering that provides scalable virtual servers (compute instances) in the cloud.

### Q6: What is the difference between EC2 (IaaS) and PaaS?
**Answer:** In EC2 (IaaS), we have full control over the operating system, security groups, web servers (Nginx), and process managers (PM2). In PaaS, server administration is managed by the PaaS vendor while we only provide application code and environment variables.

---

## ☁️ Section 2: Amazon Web Services & S3 (Questions 7–12)

### Q7: What is Amazon S3?
**Answer:** Amazon S3 (Simple Storage Service) is an object storage service offering industry-leading scalability, data availability, security, and performance for unstructured files like images and documents.

### Q8: Why use S3 instead of storing files inside MySQL or local disk?
**Answer:** Storing binary files in MySQL bloats database backups and degrades query performance. Local disk storage is ephemeral on cloud instances. S3 provides 99.999999999% (11 9's) of durability and decoupled storage.

### Q9: What is an S3 Bucket and Object?
**Answer:** An S3 Bucket is a top-level container for stored data. An Object is the fundamental file entity stored in S3, comprising the file data, key (unique name identifier), and metadata.

### Q10: What is an AWS IAM Role?
**Answer:** An IAM Role is an AWS identity with permissions policies that determine what the identity can and cannot do in AWS. For EC2, assigning an IAM Role allows the server to access S3 securely without hardcoding credentials in `.env`.

### Q11: What is an S3 Pre-Signed URL?
**Answer:** A Pre-Signed URL grants temporary read or write access to a specific private S3 object using the credentials of the user who generated it. It expires automatically after a designated timeframe (e.g. 1 hour).

### Q12: How is directory listing prevented in S3?
**Answer:** By enabling "Block all public access" and omitting `s3:ListBucket` permissions from public policies, users cannot list bucket contents. Access is restricted strictly via authorized backend endpoints.

---

## 🔒 Section 3: File Confidentiality & Integrity Security (Questions 13–19)

### Q13: How is confidentiality achieved for uploaded files?
**Answer:** Confidentiality is enforced by keeping the S3 bucket 100% private (Block Public Access), enabling Server-Side Encryption (SSE-S3 AES-256), and granting access only via time-limited Pre-Signed URLs generated after backend JWT authentication.

### Q14: How is file integrity achieved in your platform?
**Answer:** During file upload, the Express backend computes a 256-bit cryptographic hash (SHA-256) of the file buffer using Node's `crypto` module and stores it in the MySQL `file_uploads` table. The `/api/files/:id/verify` endpoint recalculates the hash and compares it against MySQL.

### Q15: Why use SHA-256 for integrity verification?
**Answer:** SHA-256 is a deterministic, one-way cryptographic hash function. Even a single bit change in the file produces a completely different hash string, guaranteeing detection of file tampering or corruption.

### Q16: Why use HTTPS and pre-signed URLs together?
**Answer:** HTTPS encrypts data in transit between browser and server, preventing eavesdropping. Pre-signed URLs ensure only authenticated users with valid permissions can request private S3 objects.

### Q17: Why enable "Block Public Access" on the S3 bucket?
**Answer:** It prevents accidental public exposure of sensitive food verification images or organization documents, protecting data privacy and preventing unauthorized data scraping.

### Q18: Why validate MIME types and file sizes on the server?
**Answer:** Validating MIME types (allowing only JPEG, PNG, PDF) prevents malicious executable file uploads (.exe, .sh, .js). Setting a 5 MB file size limit prevents Denial of Service (DoS) attacks via memory exhaustion.

### Q19: Why generate UUID object keys instead of using raw filenames?
**Answer:** Using UUIDs (e.g., `listings/1/3f8a9b2c...jpg`) prevents filename collision, avoids path traversal attacks (`../../`), and obscures sensitive original file naming patterns.

---

## 🗄️ Section 4: Database Architecture & MySQL (Questions 20–25)

### Q20: Why did you replace MongoDB with MySQL?
**Answer:** MySQL provides strict schema definitions, relational integrity, ACID compliance, foreign key constraints (`ON DELETE CASCADE`), and standardized SQL querying suitable for transactional food donation workflows.

### Q21: What are foreign keys and why are they important?
**Answer:** A foreign key is a column that creates a relationship between tables by referencing the primary key of another table (e.g. `food_listings.donor_id -> users.id`). It ensures referential integrity across the system.

### Q22: What database indexes did you create and why?
**Answer:** Indexes were created on `users.email`, `users.role`, `food_listings.status`, `food_listings.donor_id`, `food_listings.expiry_time`, and `pickup_requests.listing_id`. Indexes accelerate lookup performance on frequently queried columns.

### Q23: What is SQL Injection and how did you prevent it?
**Answer:** SQL Injection occurs when attacker input is concatenated directly into SQL query strings. We prevented it by using **parameterized SQL queries** (`?` placeholders) with the `mysql2` driver everywhere.

### Q24: How is password security handled in the database?
**Answer:** Passwords are never stored in plain text. They are hashed using `bcrypt` with 10 salt rounds before saving to MySQL. During login, `bcrypt.compare` validates credentials securely.

### Q25: What is your database backup strategy?
**Answer:** We execute periodic dumps using `mysqldump` or the automated script `npm run backup` (exporting to `database/backup.sql`), which can be encrypted and archived to S3.

---

## 🚀 Section 5: Application Logic & Workflow (Questions 26–30+)

### Q26: Explain the complete donor to NGO pickup workflow.
**Answer:**
1. Donor logs in and submits food listing + optional photo.
2. File is uploaded to S3; SHA-256 hash is saved to MySQL `file_uploads`.
3. NGO views available listings sorted by priority score (distance, urgency, capacity).
4. NGO submits a pickup request.
5. Donor receives notification and approves request.
6. NGO accepts and collects food, marking status as 'completed'.
7. Impact stats (`impact_stats`) automatically update in MySQL.

### Q27: How does your Smart Priority Scoring Algorithm work?
**Answer:** The priority score combines four factors:
$$\text{Score} = (\text{DistanceScore} \times 0.35) + (\text{UrgencyScore} \times 0.40) + (\text{CapacityScore} \times 0.25) + \text{RecurringBonus}$$
where Haversine calculates distance in km, urgency measures remaining safe consumption hours, capacity checks NGO capability, and daily recurring surplus awards a bonus.

### Q28: How does the application handle volunteer pickup eligibility?
**Answer:** Listings have a `volunteer_eligible_at` timestamp set to 30 minutes after creation. If no NGO accepts the listing within 30 minutes, volunteers can view and accept the pickup.

### Q29: How does the application calculate environmental impact?
**Answer:**
- 1 kg food = 2 meals served
- 1 kg food waste saved = 2.5 kg CO₂ equivalent prevented from landfill methane emissions.

### Q30: What is the purpose of the health endpoint (`GET /api/health`)?
**Answer:** The health endpoint provides real-time diagnostic status of the Express server, MySQL database connection, and Amazon S3 storage configuration without exposing sensitive secrets.

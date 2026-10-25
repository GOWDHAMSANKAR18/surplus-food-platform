# 🎓 Viva Voce Questions & Answers (Component 5 — 8 Marks)

**Course:** Virtualization and Cloud Computing  
**Project:** Cloud-Based Surplus Food Redistribution Platform  

---

### Q1: What is Cloud Computing?
**Answer:** Cloud Computing is the on-demand delivery of IT resources (compute power, database storage, applications, and network infrastructure) over the Internet with pay-as-you-go pricing. Instead of buying and maintaining physical servers, organizations rent access from cloud providers such as AWS or Google Cloud.

---

### Q2: What is Virtualization?
**Answer:** Virtualization is the foundational technology that enables cloud computing. It uses software called a **Hypervisor** (such as KVM, Xen, or VMware ESXi) to separate physical hardware from the operating system, allowing a single physical server to run multiple isolated **Virtual Machines (VMs)** simultaneously, maximizing hardware utilization.

---

### Q3: What is the difference between IaaS and PaaS?
**Answer:**
- **IaaS (Infrastructure as a Service):** The cloud provider provides raw virtualized hardware (VMs, storage, networking). The user is responsible for managing the OS, runtime, web server, and application. Example: **Amazon EC2**.
- **PaaS (Platform as a Service):** The cloud provider manages the underlying infrastructure, operating system, and runtime environment. The developer only deploys the application source code and configures environment variables. Example: **Render, Railway, AWS Elastic Beanstalk**.

---

### Q4: Why did this project use both Public PaaS and Amazon EC2?
**Answer:** To satisfy the dual deployment requirements of the university evaluation rubric (Components 1 & 2) and to demonstrate understanding of both deployment paradigms:
1. **PaaS (Render):** Demonstrates rapid, zero-ops continuous deployment with automated Git webhooks.
2. **EC2 (IaaS):** Demonstrates lower-level system engineering, configuring an Ubuntu Linux VM, reverse proxying with Nginx, process supervision with PM2, and custom AWS Security Group ingress rules.

---

### Q5: What is Amazon EC2?
**Answer:** Amazon Elastic Compute Cloud (Amazon EC2) is an IaaS web service that provides resizable, secure compute capacity in the cloud. It allows users to launch virtual server instances running various operating systems (such as Ubuntu 22.04 LTS), attach elastic block storage (EBS), and scale compute capacity up or down on demand.

---

### Q6: What is Amazon S3?
**Answer:** Amazon Simple Storage Service (Amazon S3) is an object storage service offering high scalability, 99.999999999% (11 9's) data durability, and fine-grained security. Unlike block storage (EBS) or file storage (EFS), S3 stores data as **objects** containing data, metadata, and a globally unique key inside **buckets**.

---

### Q7: What is an IAM Role?
**Answer:** An AWS Identity and Access Management (IAM) Role is an identity with specific permission policies that can be assumed by AWS services (like an EC2 instance) or users. Unlike static IAM user access keys, IAM roles issue temporary, automatically rotating credentials, eliminating the risk of hardcoding secret keys in source code.

---

### Q8: What is an AWS Security Group?
**Answer:** An AWS Security Group acts as a **stateful virtual firewall** for EC2 instances to control inbound and outbound network traffic. In our project, security group `food-donation-sg` allows:
- Port 22 (SSH) for administrative remote access.
- Port 80 (HTTP) for incoming public web traffic.
- Port 443 (HTTPS) for encrypted web traffic.

---

### Q9: What is Confidentiality in the context of this project?
**Answer:** Confidentiality ensures that sensitive information is accessible only to authorized entities. In our platform, food donation proof photos and organization verification documents are protected by:
1. Enabling S3 **Block All Public Access** (preventing direct unauthorized web downloads).
2. Applying **Server-Side Encryption (SSE-S3 AES-256)** at rest.
3. Generating time-limited, signed **Pre-Signed URLs** (valid for 15 minutes) for authenticated downloads.

---

### Q10: What is Data Integrity, and what algorithm is used?
**Answer:** Data Integrity ensures that data has not been altered, corrupted, or tampered with during transit or storage. Our platform uses the **SHA-256 (Secure Hash Algorithm 256-bit)** cryptographic hashing algorithm. A 64-character hexadecimal digest is computed upon upload, stored in MySQL, and recalculated byte-for-byte upon request via `GET /api/files/:id/verify`.

---

### Q11: What is the difference between Encryption and Hashing?
**Answer:**
- **Encryption is a two-way function:** Data is transformed into unreadable ciphertext using an encryption key, and can be decrypted back to plaintext using the corresponding key (e.g., AES-256).
- **Hashing is a one-way mathematical function:** Plaintext is converted into a fixed-length digest (e.g., 256 bits). It cannot be reversed. Even a 1-bit alteration in the input completely alters the output (the Avalanche Effect).

---

### Q12: How is the uploaded file protected against malicious file uploads?
**Answer:** Multi-layer defense in `services/s3Service.js`:
1. **MIME Type Allowlist:** Only `image/jpeg`, `image/png`, and `application/pdf` are accepted.
2. **Magic Byte Signature Inspection:** Directly inspects the first 4–8 binary bytes of the uploaded buffer to verify genuine file headers (`0xff 0xd8` for JPEG, `0x89 0x50 0x4e 0x47` for PNG, `%PDF` for PDF), preventing disguised executables.
3. **File Size Boundary:** Enforces a strict 5 MB limit (`MAX_FILE_SIZE_BYTES = 5242880`).
4. **Collision-Proof Key Generation:** Generates server-side UUID keys (`listings/{id}/{uuid}.jpg`), preventing directory traversal (`../`) and path enumeration attacks.

---

### Q13: How did you test the system?
**Answer:** Using the native Node.js test runner (`node --test`), covering 16 test suites across 119 automated tests (100% pass rate):
- **Unit Tests:** Verified Haversine distance calculations, countdown timers, and SHA-256 avalanche sensitivity.
- **Security Tests:** Verified brute-force rate limiting (HTTP 429), source code leak prevention (HTTP 404 on `.js` and `.sql` paths), and invalid file rejection.
- **Integration Tests:** Verified the complete food redistribution workflow from donor posting to NGO pickup and Proof-of-Delivery (PoD) settlement.

---

### Q14: What are the known limitations of your implementation?
**Answer:**
1. **S3 Checksum vs. Database Security:** SHA-256 guarantees integrity against accidental file corruption or tampering in storage, but does not prevent an attacker with full MySQL write privileges from changing both the stored hash and the file. Protecting database access with parameterized queries and least-privilege accounts is essential.
2. **Dynamic CDN Caching:** For massive global distribution, adding Amazon CloudFront with origin access control (OAC) would further reduce S3 latency.

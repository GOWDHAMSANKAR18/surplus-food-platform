# 📄 Project Executive Summary

## Cloud-Based Surplus Food Redistribution Platform

---

## 🎯 Executive Overview
The **Cloud-Based Surplus Food Redistribution Platform** is a web-based solution designed to connect food donors (restaurants, hotels, caterers) with Non-Governmental Organizations (NGOs) and community volunteers to redistribute surplus edible food before expiry.

The application has been built to satisfy academic cloud computing evaluation standards, focusing on **MySQL** relational database management, **Amazon S3** confidential object storage, **SHA-256 cryptographic file integrity**, and dual cloud deployment on **Public PaaS (Render/Railway)** and **Amazon EC2 (Ubuntu 22.04 LTS)**.

---

## 📊 Evaluation Rubric Breakdown (40 Marks)

1. **Application Development & Deployment using Public PaaS (8 Marks):** Deployed on Public PaaS with health check endpoint (`GET /api/health`).
2. **Amazon EC2 Deployment (8 Marks):** Configured on Ubuntu EC2 instance with PM2 process manager and Nginx reverse proxy.
3. **Amazon S3 Bucket Creation & Management (8 Marks):** Structured private S3 bucket storage with Block Public Access and SSE-S3 encryption.
4. **Secure File Upload to S3 – Confidentiality & Integrity (8 Marks):** Confidential Pre-Signed S3 URLs + SHA-256 integrity verification API (`GET /api/files/:id/verify`).
5. **Project Documentation & Viva (8 Marks):** Comprehensive documentation report, architecture diagrams, backup scripts, and 30+ Viva Voce Q&A.

---

## 🛠️ Architecture Summary

```text
Frontend:  HTML5 + Vanilla CSS3 + ES6 JavaScript
Backend:   Node.js (v22+) + Express.js REST API
Auth:      JWT + bcrypt (10 rounds)
Database:  MySQL 8.0+ (mysql2 connection pool)
Storage:   Amazon S3 (Block Public Access + SSE-S3 + Pre-Signed URLs + SHA-256 Checksums)
Hosting:   Public PaaS (Render/Railway) & Amazon EC2 (PM2 + Nginx)
```

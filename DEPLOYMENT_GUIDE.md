# 🌐 Complete Deployment Guide

This document provides unified instructions for deploying the **Cloud-Based Surplus Food Redistribution Platform** across all supported environments.

---

## 📋 Table of Contents
1. [Local Development Setup](#1-local-development-setup)
2. [Public PaaS Deployment (Render / Railway)](#2-public-paas-deployment)
3. [Amazon EC2 Deployment (Ubuntu 22.04 LTS)](#3-amazon-ec2-deployment)
4. [Docker Compose Deployment](#4-docker-compose-deployment)
5. [Environment Variables Reference](#5-environment-variables-reference)

---

## 1. Local Development Setup

### Prerequisites
- Node.js v22.x or later (`node -v`)
- MySQL Server 8.0 running locally

### Steps
1. Install dependencies:
   ```bash
   npm install
   ```
2. Initialize MySQL Database:
   ```powershell
   Get-Content database/schema.sql -Raw | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pYourPassword food_donation
   Get-Content database/seed.sql -Raw   | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pYourPassword food_donation
   ```
3. Configure `.env`:
   ```env
   PORT=4000
   NODE_ENV=development
   STORAGE_MODE=local
   JWT_SECRET=your_secret_at_least_32_characters
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_DATABASE=food_donation
   MYSQL_USER=root
   MYSQL_PASSWORD=YourPassword
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Verify health:
   Navigate to `http://localhost:4000/api/health`.

---

## 2. Public PaaS Deployment (Render / Railway)

### Using Render (Recommended)
1. Push this repository to GitHub or GitLab.
2. Sign in to [Render Console](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Select your repository.
4. Render will automatically detect `render.yaml` or you can manually configure:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Configure Environment Variables in the Render dashboard:
   - `NODE_ENV`: `production`
   - `STORAGE_MODE`: `local` (or `s3` once S3 bucket is created)
   - `JWT_SECRET`: Generate a random 32+ character string
   - `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`: Point to your cloud MySQL instance (e.g. Aiven, Railway, or Render PostgreSQL with MySQL adapter).
6. Click **Create Web Service**.
7. Test the deployment: `https://<your-subdomain>.onrender.com/api/health`.

---

## 3. Amazon EC2 Deployment

Refer to the complete step-by-step guide in [AWS_EC2_GUIDE.md](AWS_EC2_GUIDE.md).

### Quick Summary:
- Launch Ubuntu 22.04 LTS `t2.micro` in `us-east-1`.
- Open Inbound Ports 22 (SSH), 80 (HTTP), 443 (HTTPS) in Security Group.
- Install Node.js 22, Nginx, and PM2.
- Configure Nginx reverse proxy from port 80 to port 4000.
- Start application with PM2: `pm2 start server.js --name surplus-food-api && pm2 startup && pm2 save`.

---

## 4. Docker Compose Deployment

If you have Docker Desktop installed:
1. Ensure `.env` has both `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` set.
2. Run:
   ```bash
   docker compose up --build
   ```
3. Docker starts:
   - `db`: MySQL 8.0 container on port 3306
   - `app`: Node.js Express container on port 4000
   - `nginx`: Nginx reverse proxy container on port 80
4. Visit `http://localhost`.

---

## 5. Environment Variables Reference

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Application HTTP port |
| `NODE_ENV` | `development` | Environment mode (`development` / `production`) |
| `STORAGE_MODE` | `local` | Storage driver: `local` (disk) or `s3` (Amazon S3) |
| `JWT_SECRET` | — | Secret key for signing HS256 JWT access tokens |
| `MYSQL_HOST` | `127.0.0.1` | MySQL hostname |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_DATABASE` | `food_donation` | MySQL database name |
| `MYSQL_USER` | `root` | Database username |
| `MYSQL_PASSWORD` | — | Database user password |
| `MYSQL_ROOT_PASSWORD` | — | Root database password (required for Docker) |
| `AWS_REGION` | `us-east-1` | AWS S3 region |
| `AWS_S3_BUCKET` | — | Target private Amazon S3 bucket name |

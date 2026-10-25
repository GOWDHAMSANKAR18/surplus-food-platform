# 🚀 Public PaaS Deployment Guide (Render / Railway)

This document provides instructions for deploying the **Cloud-Based Food Redistribution Platform** to a public Platform-as-a-Service (PaaS) platform such as **Render** or **Railway**.

---

## 🛠️ Deployment Configuration Overview

- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Node Version:** `22.x` (specified in `package.json` engines or env)
- **Health Check Endpoint:** `/api/health`

---

## 🌐 Deploying on Render (Recommended PaaS)

1. Sign in to [Render Console](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub / GitLab repository containing this codebase.
4. Configure service settings:
   - **Name:** `surplus-food-platform`
   - **Environment:** `Node`
   - **Region:** Choose nearest (e.g. `Singapore` or `Oregon`)
   - **Branch:** `main`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add Environment Variables under **Advanced / Environment Variables**:

| Variable Name | Example Value |
|---|---|
| `PORT` | `10000` (Render sets automatically) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `secure_production_jwt_secret_key` |
| `MYSQL_HOST` | `your_remote_mysql_host` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_DATABASE` | `food_donation` |
| `MYSQL_USER` | `your_db_username` |
| `MYSQL_PASSWORD` | `your_db_password` |
| `AWS_REGION` | `us-east-1` |
| `AWS_S3_BUCKET` | `your-food-donation-platform-s3-bucket` |
| `AWS_ACCESS_KEY_ID` | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |

6. Click **Create Web Service**.
7. Once deployed, Render will provide a public URL like:
   `https://surplus-food-platform.onrender.com`
8. Verify deployment by visiting:
   `https://surplus-food-platform.onrender.com/api/health`

---

## 🚂 Deploying on Railway

1. Log in to [Railway.app](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your repository.
4. Add environment variables matching `.env.example`.
5. Railway will automatically detect Node.js, run `npm install`, and execute `npm start`.
6. Generate a public domain under **Settings -> Networking -> Generate Domain**.

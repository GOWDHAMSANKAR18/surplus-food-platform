# 🖥️ Amazon EC2 Deployment Guide (8 Marks Evidence)

This guide details the step-by-step procedure to deploy the **Cloud-Based Food Redistribution Platform** on an **Amazon EC2 Ubuntu 22.04 LTS** virtual machine.

---

## 🏗️ 1. Architecture Overview

```text
Internet (Port 80/443)
       |
       v
AWS Security Group (Inbound: 22, 80, 443)
       |
       v
Nginx Reverse Proxy
       |
       v
PM2 Process Manager (Node.js Express App on Port 4000)
       |
       +---> MySQL Database
       +---> Amazon S3 Private Bucket
```

---

## 📋 2. Step 1: Launch EC2 Instance

1. Log in to the **AWS Management Console** and navigate to **EC2 Dashboard**.
2. Click **Launch Instance**.
3. **Name:** `food-donation-ec2-instance`
4. **AMI:** `Ubuntu Server 22.04 LTS (HVM), SSD Volume Type`
5. **Instance Type:** `t2.micro` (Free Tier Eligible) or `t3.micro`
6. **Key Pair:** Create or select an existing `.pem` SSH key pair (e.g., `food-donation-key.pem`).
7. **Network Settings / Security Group:**
   - Create Security Group: `food-donation-sg`
   - Inbound Rules:
     - SSH (Port 22) -> Custom IP / Any
     - HTTP (Port 80) -> Anywhere (0.0.0.0/0)
     - HTTPS (Port 443) -> Anywhere (0.0.0.0/0)
8. Click **Launch Instance**.

---

## 🔑 3. Step 2: Connect via SSH

Open your local terminal / PowerShell and run:

```bash
chmod 400 food-donation-key.pem
ssh -i "food-donation-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

---

## 🛠️ 4. Step 3: Install Node.js, Git, Nginx & PM2

Run the following commands on your EC2 instance:

```bash
# Update Ubuntu package lists
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 LTS & npm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Verify installations
node -v
npm -v
nginx -v

# Install PM2 globally
sudo npm install -g pm2
```

---

## 📥 5. Step 4: Clone & Configure Project

```bash
# Navigate to home directory and clone repository
cd ~
git clone <YOUR_GIT_REPOSITORY_URL> surplus-food-platform
cd surplus-food-platform

# Install production dependencies
npm install --production

# Create environment configuration
cp .env.example .env
nano .env
```

Configure `.env` with your actual MySQL database credentials and AWS S3 parameters:

```env
PORT=4000
NODE_ENV=production
JWT_SECRET=production_jwt_secret_key_change_me

MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_DATABASE=food_donation
MYSQL_USER=your_db_user
MYSQL_PASSWORD=your_db_password

AWS_REGION=us-east-1
AWS_S3_BUCKET=your-food-donation-platform-s3-bucket
# Note: On EC2, IAM Roles can be attached to avoid hardcoding AWS keys!
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## 🗄️ 6. Step 5: Database Schema Initialization

If connecting to a clean MySQL database, run:

```bash
mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p food_donation < database/schema.sql
mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p food_donation < database/seed.sql
```

---

## 🚀 7. Step 6: Start Server with PM2 Process Manager

```bash
# Start Node.js application under PM2 manager
pm2 start server.js --name surplus-food-api

# Save PM2 state for automatic reboot persistence
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Check process status
pm2 status
pm2 logs surplus-food-api --lines 20
```

---

## 🌐 8. Step 7: Configure Nginx Reverse Proxy

Create Nginx site configuration:

```bash
sudo nano /etc/nginx/sites-available/food-donation
```

Add the following Nginx proxy block:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/food-donation /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🧪 9. Step 8: Verify Deployment

Open your web browser and navigate to:

`http://<YOUR_EC2_PUBLIC_IP>/api/health`

Expected response:
```json
{
  "status": "ok",
  "server": "Node.js Express API",
  "database": { "status": "connected", "engine": "MySQL" },
  "storage": { "storageType": "Amazon S3", "configured": true }
}
```

Congratulations! Your application is fully operational on Amazon EC2!

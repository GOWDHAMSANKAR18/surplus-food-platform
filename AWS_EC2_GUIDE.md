# 🖥️ Amazon EC2 Deployment Guide (Component 2 — 8 Marks)

This guide provides exhaustive, beginner-friendly instructions to launch, configure, and verify the **Surplus Food Redistribution Platform** on an **Amazon EC2** virtual machine.

---

## 🎯 Architecture Overview
```text
Internet Traffic (Port 80 / 443)
       |
       v
AWS Security Group [food-donation-sg] (Ports 22, 80, 443)
       |
       v
Nginx Reverse Proxy (Port 80 -> 127.0.0.1:4000)
       |
       v
PM2 Daemon (Node.js Express App on Port 4000)
       |
       +---> MySQL 8.0 Database
       +---> Amazon S3 Private Bucket
```

---

## 📋 Step-by-Step Deployment Procedure

### Step 1: Launch EC2 Instance in AWS Console
1. Log in to [AWS Management Console](https://console.aws.amazon.com/).
2. Select AWS Region: **US East (N. Virginia) `us-east-1`** (top right).
3. Open **EC2** service -> Click **Launch Instance**.
4. Configure instance parameters:
   - **Name:** `food-donation-ec2-server`
   - **Application and OS Images:** `Ubuntu Server 22.04 LTS (HVM), SSD Volume Type`
   - **Architecture:** `64-bit (x86)`
   - **Instance Type:** `t2.micro` (Free Tier eligible)
   - **Key Pair:** Select **Create new key pair**:
     * Key pair name: `food-donation-key`
     * Key pair type: `RSA`
     * Private key file format: `.pem` (for OpenSSH)
     * Click **Create key pair** and save the downloaded file safely.

### Step 2: Configure Network & Security Group
In the **Network settings** panel:
- Check **Allow SSH traffic from Anywhere (0.0.0.0/0)** (or your IP).
- Check **Allow HTTP traffic from the internet (0.0.0.0/0)**.
- Check **Allow HTTPS traffic from the internet (0.0.0.0/0)**.
- Click **Launch Instance**.

---

### Step 3: Connect via SSH
Open PowerShell or Terminal in the folder containing `food-donation-key.pem`:

```bash
# On Linux/macOS:
chmod 400 food-donation-key.pem
ssh -i "food-donation-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>

# On Windows PowerShell:
ssh -i .\food-donation-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

---

### Step 4: Install Required Runtimes & Dependencies on EC2
Run inside the EC2 SSH terminal:

```bash
# Update Ubuntu package repository
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 LTS, npm, git, and Nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Install PM2 Process Manager globally
sudo npm install -g pm2

# Verify versions
node -v
npm -v
nginx -v
pm2 -v
```

---

### Step 5: Clone & Configure Application
```bash
# Clone the repository
cd ~
git clone <YOUR_GITHUB_REPO_URL> surplus-food-platform
cd surplus-food-platform

# Install production dependencies
npm install --production

# Create .env configuration
cp .env.example .env
nano .env
```

Configure `.env` with production parameters:
```env
PORT=4000
NODE_ENV=production
STORAGE_MODE=local
TRUST_PROXY=true
JWT_SECRET=production_random_secret_at_least_32_characters_long
```

---

### Step 6: Start Server with PM2 Process Manager
```bash
# Start Express application under PM2
pm2 start server.js --name surplus-food-api

# Save PM2 state for automatic system reboot recovery
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Check status
pm2 status
```

---

### Step 7: Configure Nginx Reverse Proxy
Create site configuration:
```bash
sudo nano /etc/nginx/sites-available/food-donation
```

Paste the following configuration:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
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

Enable site and restart Nginx:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/food-donation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Step 8: Verify Deployment (Evidence Collection)
Open your web browser and navigate to:
```text
http://<YOUR_EC2_PUBLIC_IP>/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "server": "Node.js Express API"
}
```

### 📸 Screenshots to Capture for Your Final Report:
1. **AWS EC2 Console:** Showing instance `food-donation-ec2-server`, status `Running`, and Public IPv4.
2. **Security Group Inbound Rules:** Showing Ports 22, 80, and 443 open.
3. **SSH Terminal:** Showing `pm2 status` with `surplus-food-api` online.
4. **Browser:** Visiting `http://<EC2_PUBLIC_IP>` displaying the platform home page.

# 💾 MySQL Backup & Recovery Strategy Guide

This guide details the database backup procedures, automated backup scripts, and disaster recovery strategies for the MySQL relational database in the Cloud-Based Food Redistribution Platform.

---

## 🏗️ Backup Architecture Overview

```text
+-----------------------+
|  MySQL Live Database  |
|    (food_donation)    |
+-----------+-----------+
            |
            +---> 1. Automated Script (npm run backup) -> database/backup.sql
            +---> 2. System Command (mysqldump) -> backup_<timestamp>.sql
            +---> 3. Amazon S3 Encrypted Backup Archive
```

---

## 📜 1. Automated Application Backup Script

The project includes an automated backup script `scripts/backup-db.js`.

To generate a full database snapshot at any time:

```bash
npm run backup
```

This exports all tables (`users`, `food_listings`, `pickup_requests`, `file_uploads`, `impact_stats`, `audit_logs`) into `database/backup.sql`.

---

## 🛠️ 2. Native MySQL Backup (`mysqldump`)

To perform a native MySQL dump on EC2 or local terminal:

```bash
# Export full database schema and data
mysqldump -u root -p --routines --triggers food_donation > database/backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🔄 3. Database Restoration Procedure

To restore the database from a backup file:

```bash
# 1. Execute Schema Script
mysql -u root -p food_donation < database/schema.sql

# 2. Restore Backup Data
mysql -u root -p food_donation < database/backup.sql
```

---

## ☁️ 4. Optional S3 Database Backup Archiving

For production high availability, set up a daily Linux cron job on EC2 to compress backups and upload them to an Amazon S3 backup bucket:

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="/tmp/db_backup_${TIMESTAMP}.sql.gz"

mysqldump -u root -p'YOUR_PASSWORD' food_donation | gzip > $BACKUP_PATH
aws s3 cp $BACKUP_PATH s3://your-food-donation-platform-s3-bucket/db-backups/
rm $BACKUP_PATH
```

# Deployment

## Local Docker stack

Copy `.env.example` to `.env`, set `JWT_SECRET`, `MYSQL_PASSWORD`, and `MYSQL_ROOT_PASSWORD`, then run:

```bash
docker compose up --build
```

The application is available through Nginx at `http://localhost`. Logs use `docker compose logs -f app`. Stop the stack with `docker compose down`; named volumes preserve MySQL and local uploads.

## S3 mode

Set `STORAGE_MODE=s3`, `AWS_REGION`, and `AWS_S3_BUCKET`. On EC2, use an instance profile with only the required bucket `GetObject`, `PutObject`, and (if needed) `HeadObject` permissions. Do not put long-lived keys in the image or repository.

## EC2 and HTTPS

Install Docker, copy the application configuration through a protected secret mechanism, and allow only HTTP/HTTPS plus restricted administrative access in the security group. Do not expose MySQL publicly. Put Nginx behind a domain and configure either Certbot/Let's Encrypt or an AWS Application Load Balancer with ACM for TLS. Set `TRUST_PROXY=true` only behind the configured proxy.

## Backups

Run `npm run backup` with database credentials supplied through the environment. Store timestamped backups in private, encrypted storage and periodically restore one into an isolated database before relying on it.

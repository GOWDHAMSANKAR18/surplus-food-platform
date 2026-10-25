# Architecture

The browser serves the existing static frontend and calls the Express REST API. Express authenticates users with JWTs, applies role and ownership checks, and persists application state in MySQL. Files use either the explicit local filesystem mode or a private S3 bucket.

Listing acceptance uses a conditional `UPDATE ... WHERE status = 'available'`, so concurrent requests cannot accept the same listing. Completion updates the listing, approved pickup request, impact totals, proof metadata, and audit event in one transaction when MySQL is available.

For deployment, Nginx terminates HTTP/HTTPS and proxies to the Node.js container. Docker Compose provides the application, persistent MySQL volume, and reverse proxy for local demonstrations. EC2 should use an IAM instance role, private S3 objects, restricted security groups, and a managed database or private MySQL host.

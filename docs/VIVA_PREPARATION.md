# Viva preparation

- **Problem:** GATE-WAY V connects surplus-food donors with NGOs and volunteers before food expires.
- **Cloud:** S3 provides private durable file storage and EC2 runs the API without depending on a personal computer.
- **Docker:** Containers make the application and its dependencies reproducible.
- **VM versus container:** A VM includes a full guest operating system; a container shares the host kernel and packages the application process.
- **EC2 and S3:** EC2 is compute; S3 is private object storage.
- **IAM:** An instance role grants temporary, least-privilege AWS permissions without embedding keys.
- **JWT:** The server signs a short-lived token after login and verifies its signature and expiry on each protected request.
- **Authentication versus authorization:** Authentication identifies the user; authorization decides whether that user may perform an operation.
- **SHA-256:** It produces a fixed-length digest of bytes. Recalculating it detects file tampering.
- **Why the database checksum matters:** The original checksum is the trusted baseline; verification must never replace it with a newly calculated value.
- **Transactions:** Related completion writes commit together or roll back together.
- **Race conditions:** Two requests can read the same available row; a conditional update lets only one change it.
- **Nginx:** It is the public reverse proxy and later TLS termination point.
- **CI/CD:** GitHub Actions installs, tests, audits, and builds the application on changes.
- **Limitations:** SHA-256 is not a digital signature, AWS resources are not provisioned by this repository, and production deployment still requires operator-managed secrets and infrastructure.

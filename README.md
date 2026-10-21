# Suvarna Mitra Finance: Website + Customer/Admin/Agent Portal

Stack: **React (Vite)** front end, **Node.js (Express)** API, **MySQL 8** database.

```
suvarna-mitra/
  backend/    Express API, MySQL schema (sql/schema.sql), file uploads, Excel reports
  frontend/   React app (public site, customer portal, admin panel, agent portal)
  deploy-nginx.conf
```

## What is included
- Public 3-page website (Home, About Us, Services), edit the text in `frontend/src/pages/Public.jsx`
- Customer registration/login, step-by-step application: personal + Aadhaar/PAN numbers, loan details, live camera photo, document upload, processing-fee UPI QR + payment reference, final submit
- Customer dashboard: personal details with verification tags, loan details, documents, signed-agreement download, notifications
- Admin/Employee panel: dashboard graphs (registrations, fees, Hot/Warm/Cold/Lost/Won, loans disbursed monthly/quarterly/annual/custom range), lead listing, full customer detail editing, CIBIL entry, verification tags, loan status/ROI, fee confirmation, signed agreement/NOC upload, rejection history, reports with **Excel download** (fees, customers, leads)
- Agent portal: register leads and see their status; leads appear in the admin panel
- Admin only: create employees/agents/admins, enable/disable, reset passwords, change roles, set processing fee and UPI ID
- Auto customer IDs (`SM-000001`), lead automation (Warm on signup, Hot on document upload, Won when fee marked paid, Cold after 30 days of no activity by a nightly job, Lost on rejection)
- Aadhaar/PAN numbers are encrypted (AES-256-GCM) in the database; reports show them masked

## What is NOT included (needs paid third-party accounts)
- OTP / SMS (as requested): mobile and email "verified" tags are set by staff
- Automatic Aadhaar/PAN verification: staff tick "verified" after checking documents. Auto-verification needs an authorised provider (e.g. DigiLocker / licensed KYC API)
- Payment gateway: customers pay via UPI QR and enter the UTR; staff confirm in the customer's page
- E-signature API: staff upload the signed agreement; the customer downloads it
- WhatsApp payment links / SMS notifications: notifications are in-app only

The code is structured so these can be added later as extra routes in `backend/src/routes`.

## Install on an Ubuntu VPS

### 1. Install requirements
```bash
sudo apt update && sudo apt install -y nginx mysql-server certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Create the database
```bash
cd backend
sudo mysql < sql/schema.sql
sudo mysql -e "CREATE USER 'suvarna'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD'; GRANT ALL ON suvarna_mitra.* TO 'suvarna'@'localhost'; FLUSH PRIVILEGES;"
```
If importing fails with error 1419 (trigger / binary logging), run `sudo mysql -e "SET GLOBAL log_bin_trust_function_creators=1;"` and import again.

### 3. Start the API
```bash
cd backend
cp .env.example .env
nano .env        # fill DB_PASSWORD, JWT_SECRET, ENC_KEY (commands are in the file), admin login details
npm install --omit=dev
npm run seed     # creates the first admin account
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```
**Back up `ENC_KEY`.** If it is lost, stored Aadhaar/PAN numbers cannot be read.

### 4. Build the website
```bash
cd frontend
npm install
npm run build
sudo mkdir -p /var/www/suvarna-mitra && sudo cp -r dist/* /var/www/suvarna-mitra/
```

### 5. Nginx + HTTPS
Use `deploy-nginx.conf` (replace `yourdomain.com`), then run certbot as described in the file. HTTPS is required for the live-camera photo step.

### 6. Log in
Open your domain, log in with the admin email/password from `.env`, then go to **Settings** and set the processing fee and UPI ID. Add employees and agents under **Users & Roles**.

## Local development
```bash
cd backend && npm install && npm run dev          # API on :4000
cd frontend && npm install && npm run dev         # site on :5173 (proxies /api to :4000)
```

## Maintenance
- Back up the MySQL database **and** `backend/uploads/` (customer documents) regularly, e.g. `mysqldump suvarna_mitra > backup.sql`.
- Change the seeded admin password after first login (or create a new admin and disable the seeded one).
- This code has not been load-tested or security-audited. Because it holds KYC data, have it reviewed before going live and keep the server patched.

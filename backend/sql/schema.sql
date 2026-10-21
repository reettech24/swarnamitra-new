-- Suvarna Mitra Finance: MySQL 8.0.16+ schema (Phase 1 + Phase 2)
-- Run: mysql -u <user> -p < schema_mysql.sql

CREATE DATABASE IF NOT EXISTS suvarna_mitra
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE suvarna_mitra;

-- ---------- Roles & users ----------
CREATE TABLE roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(30) UNIQUE NOT NULL,       -- admin, employee, agent, customer
  permissions JSON NULL
) ENGINE=InnoDB;

INSERT INTO roles (name, permissions) VALUES
  ('admin', JSON_ARRAY()), ('employee', JSON_ARRAY()),
  ('agent', JSON_ARRAY()), ('customer', JSON_ARRAY());

-- Counter table for customer IDs (MySQL has no sequences)
CREATE TABLE id_counters (
  name  VARCHAR(30) PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB;
INSERT INTO id_counters (name, value) VALUES ('customer', 0);

CREATE TABLE users (
  id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  role_id         INT NOT NULL,
  customer_code   VARCHAR(20) UNIQUE NULL,       -- SM-000001 (set by trigger, customers only)
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(160) UNIQUE NOT NULL,
  mobile          VARCHAR(15)  UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE otp_codes (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    CHAR(36) NULL,
  target     VARCHAR(160) NOT NULL,              -- mobile or email
  purpose    VARCHAR(20) NOT NULL,               -- mobile, email, aadhaar
  code_hash  TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Customer profile & KYC ----------
CREATE TABLE customer_profiles (
  user_id          CHAR(36) PRIMARY KEY,
  contact_no       VARCHAR(15),
  current_address  TEXT,
  city             VARCHAR(80),
  state            VARCHAR(80),
  pincode          VARCHAR(10),
  aadhaar_no       VARCHAR(255),                 -- store encrypted, never plain
  aadhaar_name     VARCHAR(120),                 -- name as per Aadhaar
  pan_no           VARCHAR(255),                 -- store encrypted
  photo_url        TEXT,
  cibil_score      INT NULL,                     -- admin entry only
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_cibil CHECK (cibil_score IS NULL OR cibil_score BETWEEN 300 AND 900),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE kyc_verifications (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      CHAR(36) NOT NULL,
  step         VARCHAR(20) NOT NULL,             -- aadhaar, pan, selfie
  status       VARCHAR(15) NOT NULL DEFAULT 'pending',  -- pending, verified, failed
  provider_ref VARCHAR(120),
  verified_at  DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE documents (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     CHAR(36) NOT NULL,
  doc_type    VARCHAR(30) NOT NULL,              -- aadhaar, pan, cibil_report, loan_receipt, noc, other
  file_url    TEXT NOT NULL,
  mime_type   VARCHAR(50),
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Loans ----------
CREATE TABLE loans (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id            CHAR(36) NOT NULL,
  -- existing loan
  old_bank           VARCHAR(100),
  old_loan_amount    DECIMAL(14,2),
  old_roi            DECIMAL(5,2),
  loan_start_date    DATE,
  loan_closure_date  DATE,
  closure_amount     DECIMAL(14,2),
  noc_url            TEXT,
  -- proposed / new loan
  new_bank           VARCHAR(100),
  amount_required    DECIMAL(14,2),
  new_loan_amount    DECIMAL(14,2),
  new_roi            DECIMAL(5,2),
  transfer_date      DATE,
  loan_status        VARCHAR(15) NOT NULL DEFAULT 'in_process', -- in_process, sanctioned, rejected
  disbursed_on       DATE,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE loan_rejections (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  loan_id          BIGINT NOT NULL,
  bank_name        VARCHAR(100) NOT NULL,
  processing_date  DATE,
  loan_amount      DECIMAL(14,2),
  concerned_person VARCHAR(120),
  reason           TEXT,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Leads ----------
CREATE TABLE leads (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id    CHAR(36) NULL,                  -- set once lead becomes a customer
  agent_id       CHAR(36) NULL,                  -- agent who registered the lead
  assigned_to    CHAR(36) NULL,                  -- employee handling it
  name           VARCHAR(120) NOT NULL,
  contact        VARCHAR(15) NOT NULL,
  loan_required  DECIMAL(14,2),
  current_bank   VARCHAR(100),
  status         VARCHAR(10) NOT NULL DEFAULT 'warm',
  last_activity  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_lead_status CHECK (status IN ('hot','warm','cold','lost','won')),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (agent_id)    REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE lead_status_history (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  lead_id    BIGINT NOT NULL,
  old_status VARCHAR(10),
  new_status VARCHAR(10) NOT NULL,
  reason     VARCHAR(200),                       -- e.g. 'documents uploaded', 'fee paid'
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Payments & e-sign ----------
CREATE TABLE payments (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      CHAR(36) NOT NULL,
  loan_id      BIGINT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  purpose      VARCHAR(30) NOT NULL DEFAULT 'processing_fee',
  status       VARCHAR(10) NOT NULL DEFAULT 'pending',   -- pending, paid, failed
  gateway_ref  VARCHAR(120),
  payment_link TEXT,
  paid_at      DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (loan_id) REFERENCES loans(id)
) ENGINE=InnoDB;

CREATE TABLE esign_documents (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      CHAR(36) NOT NULL,
  provider_ref VARCHAR(120),
  status       VARCHAR(10) NOT NULL DEFAULT 'sent',      -- sent, signed
  signed_url   TEXT,
  signed_at    DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ---------- Notifications ----------
CREATE TABLE notifications (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    CHAR(36) NOT NULL,
  channel    VARCHAR(10) NOT NULL DEFAULT 'app',         -- app, sms, whatsapp
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Indexes ----------
CREATE INDEX idx_leads_status  ON leads(status);
CREATE INDEX idx_leads_agent   ON leads(agent_id);
CREATE INDEX idx_payments_user ON payments(user_id, status);
CREATE INDEX idx_loans_user    ON loans(user_id);
CREATE INDEX idx_docs_user     ON documents(user_id);

-- ---------- Triggers ----------
DELIMITER $$

-- Auto customer ID (SM-000001) for users with the customer role
CREATE TRIGGER trg_user_customer_code
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role_id = (SELECT id FROM roles WHERE name = 'customer') THEN
    UPDATE id_counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'customer';
    SET NEW.customer_code = CONCAT('SM-', LPAD(LAST_INSERT_ID(), 6, '0'));
  END IF;
END$$

-- Lead automatically becomes Won when processing fee is paid
CREATE TRIGGER trg_payment_won
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
  IF NEW.status = 'paid' AND NEW.purpose = 'processing_fee' AND OLD.status <> 'paid' THEN
    INSERT INTO lead_status_history (lead_id, old_status, new_status, reason)
      SELECT id, status, 'won', 'processing fee paid'
      FROM leads WHERE customer_id = NEW.user_id AND status <> 'won';

    UPDATE leads SET status = 'won', last_activity = NOW()
      WHERE customer_id = NEW.user_id AND status <> 'won';
  END IF;
END$$

DELIMITER ;

-- ---------- Additions used by the application ----------
ALTER TABLE kyc_verifications ADD UNIQUE KEY uq_kyc (user_id, step);
ALTER TABLE loans ADD COLUMN submitted_at DATETIME NULL;

CREATE TABLE settings (
  k VARCHAR(50) PRIMARY KEY,
  v TEXT
) ENGINE=InnoDB;
INSERT INTO settings (k, v) VALUES
  ('processing_fee', '5000'),
  ('upi_id', ''),
  ('payee_name', 'Suvarna Mitra Finance');

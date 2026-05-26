-- Brand Applications Table
-- Stores submissions from the brand onboarding form

CREATE TABLE IF NOT EXISTS brand_applications (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  ref_id                VARCHAR(30)  NOT NULL UNIQUE COMMENT 'e.g. ITH-APP-2026-9938',

  -- Brand Identity
  brand_name            VARCHAR(255) NOT NULL,
  website               VARCHAR(500) NOT NULL,
  product_type          VARCHAR(50)  NOT NULL DEFAULT 'fashion',
  address               TEXT         NOT NULL,

  -- Collaboration
  interests             JSON         NOT NULL COMMENT 'Array of selected collaboration interests',
  partnership_type      JSON         DEFAULT NULL COMMENT 'supply_to_ithyaraa / sell_with_ithyaraa',

  -- Dropshipping
  dropship_status       VARCHAR(20)  DEFAULT 'no' COMMENT 'yes | no | maybe',
  monthly_order_volume  VARCHAR(100) DEFAULT NULL,

  -- Brand Narrative
  goals                 TEXT         DEFAULT NULL,
  lookbook_name         VARCHAR(500) DEFAULT NULL,
  lookbook_url          TEXT         DEFAULT NULL,

  -- Contact
  contact_name          VARCHAR(255) NOT NULL,
  contact_position      VARCHAR(255) DEFAULT NULL,
  contact_email         VARCHAR(255) NOT NULL,
  contact_phone         VARCHAR(50)  NOT NULL,
  consent               TINYINT(1)   NOT NULL DEFAULT 0,

  -- Status tracking
  status                ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  brand_uid             VARCHAR(100) DEFAULT NULL COMMENT 'Populated when approved and brand account is created',
  submitted_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at           DATETIME     DEFAULT NULL,
  reviewed_by           VARCHAR(100) DEFAULT NULL,
  notes                 TEXT         DEFAULT NULL COMMENT 'Admin rejection/approval notes'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for common admin queries
CREATE INDEX idx_brand_applications_status        ON brand_applications (status);
CREATE INDEX idx_brand_applications_contact_email ON brand_applications (contact_email);
CREATE INDEX idx_brand_applications_submitted_at  ON brand_applications (submitted_at DESC);

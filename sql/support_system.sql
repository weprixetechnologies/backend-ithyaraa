-- Hierarchical support topics (tree structure, unlimited depth)
CREATE TABLE IF NOT EXISTS support_topics (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id       BIGINT UNSIGNED NULL REFERENCES support_topics(id) ON DELETE CASCADE,
  panel           ENUM('user', 'brand', 'both') NOT NULL DEFAULT 'both',
  label           VARCHAR(120) NOT NULL,
  slug            VARCHAR(120) NOT NULL,
  description     TEXT NULL,
  input_type      ENUM('branch', 'leaf') NOT NULL DEFAULT 'branch',
  -- branch = shows children, leaf = shows comment box
  prefilled_text  TEXT NULL,          -- autofills textarea if leaf
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id),
  INDEX idx_panel  (panel),
  INDEX idx_active (is_active)
);

-- Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_no       VARCHAR(20) NOT NULL UNIQUE,   -- e.g. TKT-20240001
  raised_by_type  ENUM('user', 'brand') NOT NULL,
  raised_by_id    VARCHAR(255) NOT NULL,         -- username/uid
  topic_path      JSON NOT NULL,                 -- [{id, label}, ...] breadcrumb trail
  leaf_topic_id   BIGINT UNSIGNED NOT NULL REFERENCES support_topics(id),
  comment         TEXT NOT NULL,
  status          ENUM('open', 'in_progress', 'closed') NOT NULL DEFAULT 'open',
  priority        ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  assigned_to     VARCHAR(255) NULL,             -- admin username
  first_response_at TIMESTAMP NULL,
  closed_at       TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_raised_by  (raised_by_type, raised_by_id),
  INDEX idx_status     (status),
  INDEX idx_leaf_topic (leaf_topic_id),
  INDEX idx_created    (created_at)
);

-- Ticket replies (admin ↔ user/brand thread)
CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id       BIGINT UNSIGNED NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type     ENUM('user', 'brand', 'admin') NOT NULL,
  sender_id       VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  is_internal     BOOLEAN NOT NULL DEFAULT FALSE,   -- internal admin notes
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket (ticket_id),
  INDEX idx_sender (sender_type, sender_id)
);

-- Add unread badge counts to users (optional denormalization for performance)
-- Note: Brands are also in the users table in this project.
ALTER TABLE users ADD COLUMN IF NOT EXISTS unread_ticket_replies SMALLINT UNSIGNED DEFAULT 0;

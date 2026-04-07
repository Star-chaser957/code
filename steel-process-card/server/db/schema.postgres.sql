CREATE TABLE IF NOT EXISTS process_cards (
  id TEXT PRIMARY KEY,
  card_no TEXT NOT NULL DEFAULT '',
  plan_number TEXT NOT NULL DEFAULT '',
  customer_code TEXT NOT NULL DEFAULT '',
  order_date TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  specification TEXT NOT NULL DEFAULT '',
  quantity TEXT NOT NULL DEFAULT '',
  delivery_date TEXT NOT NULL DEFAULT '',
  delivery_status TEXT NOT NULL DEFAULT '',
  standard TEXT NOT NULL DEFAULT '',
  technical_requirements TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  prepared_by TEXT NOT NULL DEFAULT '',
  prepared_date TEXT NOT NULL DEFAULT '',
  confirmed_by TEXT NOT NULL DEFAULT '',
  confirmed_date TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT NOT NULL DEFAULT '',
  reviewed_date TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  approved_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  current_step TEXT NOT NULL DEFAULT 'prepare',
  current_handler_user_id TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL DEFAULT '',
  confirmed_user_id TEXT NOT NULL DEFAULT '',
  reviewed_user_id TEXT NOT NULL DEFAULT '',
  approved_user_id TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT '',
  locked_at TEXT NOT NULL DEFAULT '',
  version_no INTEGER NOT NULL DEFAULT 1,
  source_card_id TEXT NOT NULL DEFAULT '',
  last_return_comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_definitions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_order INTEGER NOT NULL,
  detail_mode TEXT NOT NULL,
  allows_multiple_details INTEGER NOT NULL DEFAULT 0,
  detail_label TEXT NOT NULL DEFAULT '',
  field_config_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS operation_option_definitions (
  operation_code TEXT NOT NULL,
  option_code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (operation_code, option_code),
  FOREIGN KEY (operation_code) REFERENCES operation_definitions (code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS card_operations (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  operation_code TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  department TEXT NOT NULL DEFAULT '',
  special_characteristic TEXT NOT NULL DEFAULT '',
  delivery_time TEXT NOT NULL DEFAULT '',
  other_requirements TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (card_id) REFERENCES process_cards (id) ON DELETE CASCADE,
  FOREIGN KEY (operation_code) REFERENCES operation_definitions (code),
  UNIQUE (card_id, operation_code)
);

CREATE TABLE IF NOT EXISTS card_operation_selected_options (
  id TEXT PRIMARY KEY,
  card_operation_id TEXT NOT NULL,
  option_code TEXT NOT NULL,
  FOREIGN KEY (card_operation_id) REFERENCES card_operations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS operation_details (
  id TEXT PRIMARY KEY,
  card_operation_id TEXT NOT NULL,
  detail_seq INTEGER NOT NULL DEFAULT 1,
  detail_type TEXT NOT NULL DEFAULT '',
  display_text TEXT NOT NULL DEFAULT '',
  params_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (card_operation_id) REFERENCES card_operations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS department_options (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, role_code),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS process_card_approval_logs (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (card_id) REFERENCES process_cards (id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users (id),
  FOREIGN KEY (target_user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  actor_user_id TEXT NOT NULL DEFAULT '',
  actor_display_name TEXT NOT NULL DEFAULT '',
  target_user_id TEXT NOT NULL DEFAULT '',
  target_display_name TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  detail_text TEXT NOT NULL DEFAULT '',
  changes_json TEXT NOT NULL DEFAULT '[]',
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_process_cards_plan_number ON process_cards (plan_number);
CREATE INDEX IF NOT EXISTS idx_process_cards_customer_code ON process_cards (customer_code);
CREATE INDEX IF NOT EXISTS idx_process_cards_product_name ON process_cards (product_name);
CREATE INDEX IF NOT EXISTS idx_process_cards_material ON process_cards (material);
CREATE INDEX IF NOT EXISTS idx_process_cards_delivery_date ON process_cards (delivery_date);
CREATE INDEX IF NOT EXISTS idx_card_operations_card_id ON card_operations (card_id);
CREATE INDEX IF NOT EXISTS idx_card_operations_operation_code ON card_operations (operation_code);
CREATE INDEX IF NOT EXISTS idx_operation_details_type ON operation_details (detail_type);
CREATE INDEX IF NOT EXISTS idx_department_options_sort_order ON department_options (sort_order);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_approval_logs_card_id ON process_card_approval_logs (card_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_created_at ON process_card_approval_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs (category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);

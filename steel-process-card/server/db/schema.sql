PRAGMA foreign_keys = ON;

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

CREATE INDEX IF NOT EXISTS idx_process_cards_plan_number ON process_cards (plan_number);
CREATE INDEX IF NOT EXISTS idx_process_cards_customer_code ON process_cards (customer_code);
CREATE INDEX IF NOT EXISTS idx_process_cards_product_name ON process_cards (product_name);
CREATE INDEX IF NOT EXISTS idx_process_cards_material ON process_cards (material);
CREATE INDEX IF NOT EXISTS idx_process_cards_delivery_date ON process_cards (delivery_date);
CREATE INDEX IF NOT EXISTS idx_card_operations_card_id ON card_operations (card_id);
CREATE INDEX IF NOT EXISTS idx_card_operations_operation_code ON card_operations (operation_code);
CREATE INDEX IF NOT EXISTS idx_operation_details_type ON operation_details (detail_type);

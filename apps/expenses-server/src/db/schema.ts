import { getDb } from "./index";

/**
 * Create all database tables
 * Note: SQLite doesn't support AUTO_INCREMENT - use INTEGER PRIMARY KEY for autoincrement
 * SQLite doesn't have VARCHAR - TEXT is used instead
 * SQLite doesn't have BOOLEAN - INTEGER 0/1 is used
 * SQLite doesn't have JSON type - TEXT is used and parsed in application
 */
export function createTables(): void {
  const db = getDb();

  // Users table (synced from auth provider or stored locally)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      department TEXT,
      manager_id TEXT,
      lr_user_id TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (manager_id) REFERENCES users(user_id)
    )
  `);

  // Create index on manager_id for team queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_manager 
    ON users(manager_id)
  `);

  // Create index on department
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_department 
    ON users(department)
  `);

  // Create index on LoginRadius user ID
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_lr_user_id
    ON users(lr_user_id)
  `);

  // Expense categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT UNIQUE NOT NULL,
      description TEXT,
      requires_receipt INTEGER DEFAULT 0,
      max_amount REAL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Expenses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      expense_id TEXT PRIMARY KEY,
      submitter_id TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      description TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      receipt_url TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
      submitted_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (submitter_id) REFERENCES users(user_id),
      FOREIGN KEY (category_id) REFERENCES expense_categories(category_id)
    )
  `);

  // Create indexes for expenses
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_expenses_submitter_status 
    ON expenses(submitter_id, status)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_expenses_status_date 
    ON expenses(status, expense_date)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date 
    ON expenses(expense_date)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_expenses_category 
    ON expenses(category_id)
  `);

  // Expense approvals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_approvals (
      approval_id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id TEXT NOT NULL,
      approver_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
      notes TEXT,
      approved_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE,
      FOREIGN KEY (approver_id) REFERENCES users(user_id)
    )
  `);

  // Create indexes for approvals
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_approvals_expense 
    ON expense_approvals(expense_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_approvals_approver 
    ON expense_approvals(approver_id)
  `);

  // Audit log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
  `);

  // Create indexes for audit log
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_user_action 
    ON audit_log(user_id, action)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp 
    ON audit_log(timestamp)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_resource 
    ON audit_log(resource_type, resource_id)
  `);

  console.log("✅ Database tables created successfully");
}

/**
 * Drop all tables (use with caution!)
 */
export function dropTables(): void {
  const db = getDb();

  db.exec("DROP TABLE IF EXISTS audit_log");
  db.exec("DROP TABLE IF EXISTS expense_approvals");
  db.exec("DROP TABLE IF EXISTS expenses");
  db.exec("DROP TABLE IF EXISTS expense_categories");
  db.exec("DROP TABLE IF EXISTS users");

  console.log("✅ All tables dropped");
}

/**
 * Reset database - drop and recreate tables
 */
export function resetDatabase(): void {
  dropTables();
  createTables();
}

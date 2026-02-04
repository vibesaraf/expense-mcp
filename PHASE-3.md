# Phase 2: Database Design and SQLite Setup

## Overview
This phase sets up SQLite database using better-sqlite3, creates all tables based on the architecture plan, and implements the seed data functionality.

## Prerequisites
- Phase 0 and Phase 1 completed
- better-sqlite3 installed (already in package.json)

---

## Step 1: Create Database Connection Module

Create `apps/expense-server/src/db/index.ts`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// Ensure data directory exists
const dataDir = path.dirname(config.DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new Database(config.DATABASE_PATH, {
  verbose: config.NODE_ENV === 'development' ? console.log : undefined,
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

/**
 * Get the database instance
 */
export function getDb(): Database.Database {
  return db;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  db.close();
}

/**
 * Execute a transaction
 */
export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}

/**
 * Check if database is initialized (tables exist)
 */
export function isDatabaseInitialized(): boolean {
  const result = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='users'
  `).get();
  return !!result;
}

// Handle process exit
process.on('exit', () => {
  db.close();
});

export { db };
```

---

## Step 2: Create Database Schema

Create `apps/expense-server/src/db/schema.ts`:

```typescript
import { getDb } from './index';

/**
 * Create all database tables
 * Note: SQLite doesn't support AUTO_INCREMENT - use INTEGER PRIMARY KEY for autoincrement
 * SQLite doesn't have VARCHAR - TEXT is used instead
 * SQLite doesn't have BOOLEAN - INTEGER 0/1 is used
 * SQLite doesn't have JSON type - TEXT is used and parsed in application
 */
export function createTables(): void {
  const db = getDb();

  // Users table (synced from Descope or stored locally)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'finance_admin')),
      department TEXT,
      manager_id TEXT,
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

  console.log('✅ Database tables created successfully');
}

/**
 * Drop all tables (use with caution!)
 */
export function dropTables(): void {
  const db = getDb();

  db.exec('DROP TABLE IF EXISTS audit_log');
  db.exec('DROP TABLE IF EXISTS expense_approvals');
  db.exec('DROP TABLE IF EXISTS expenses');
  db.exec('DROP TABLE IF EXISTS expense_categories');
  db.exec('DROP TABLE IF EXISTS users');

  console.log('✅ All tables dropped');
}

/**
 * Reset database - drop and recreate tables
 */
export function resetDatabase(): void {
  dropTables();
  createTables();
}
```

---

## Step 3: Create Seed Data

Create `apps/expense-server/src/db/seed.ts`:

```typescript
import 'dotenv/config';
import { getDb, closeDb, isDatabaseInitialized } from './index';
import { createTables } from './schema';
import { generateUUID } from '../utils/uuid';
import { DEFAULT_CATEGORIES } from '../config/constants';

/**
 * Seed expense categories
 */
function seedCategories(): void {
  const db = getDb();
  
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO expense_categories 
    (category_name, description, requires_receipt, max_amount)
    VALUES (?, ?, ?, ?)
  `);

  for (const category of DEFAULT_CATEGORIES) {
    insertCategory.run(
      category.name,
      category.description,
      category.requiresReceipt ? 1 : 0,
      category.maxAmount
    );
  }

  console.log(`✅ Seeded ${DEFAULT_CATEGORIES.length} expense categories`);
}

/**
 * Seed test users
 * In production, users would be synced from Descope
 */
function seedTestUsers(): void {
  const db = getDb();
  
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users 
    (user_id, email, full_name, role, department, manager_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Test users structure:
  // - Finance Admin (Carol) - no manager
  // - Engineering Manager (Bob) - reports to Carol
  // - Engineering Employees (Alice, Dave) - report to Bob
  // - Sales Manager (Eve) - reports to Carol
  // - Sales Employee (Frank) - reports to Eve

  const testUsers = [
    // Finance Admin
    {
      userId: 'user_carol_finance',
      email: 'carol@company.com',
      fullName: 'Carol Finance',
      role: 'finance_admin',
      department: 'Finance',
      managerId: null,
    },
    // Engineering Manager
    {
      userId: 'user_bob_manager',
      email: 'bob@company.com',
      fullName: 'Bob Manager',
      role: 'manager',
      department: 'Engineering',
      managerId: 'user_carol_finance',
    },
    // Engineering Employees
    {
      userId: 'user_alice_employee',
      email: 'alice@company.com',
      fullName: 'Alice Employee',
      role: 'employee',
      department: 'Engineering',
      managerId: 'user_bob_manager',
    },
    {
      userId: 'user_dave_employee',
      email: 'dave@company.com',
      fullName: 'Dave Developer',
      role: 'employee',
      department: 'Engineering',
      managerId: 'user_bob_manager',
    },
    // Sales Manager
    {
      userId: 'user_eve_manager',
      email: 'eve@company.com',
      fullName: 'Eve Sales Manager',
      role: 'manager',
      department: 'Sales',
      managerId: 'user_carol_finance',
    },
    // Sales Employee
    {
      userId: 'user_frank_employee',
      email: 'frank@company.com',
      fullName: 'Frank Salesman',
      role: 'employee',
      department: 'Sales',
      managerId: 'user_eve_manager',
    },
  ];

  for (const user of testUsers) {
    insertUser.run(
      user.userId,
      user.email,
      user.fullName,
      user.role,
      user.department,
      user.managerId
    );
  }

  console.log(`✅ Seeded ${testUsers.length} test users`);
}

/**
 * Seed sample expenses for testing
 */
function seedSampleExpenses(): void {
  const db = getDb();
  
  const insertExpense = db.prepare(`
    INSERT OR IGNORE INTO expenses 
    (expense_id, submitter_id, category_id, amount, currency, description, expense_date, receipt_url, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const sampleExpenses = [
    // Alice's expenses (Engineering employee)
    {
      expenseId: generateUUID(),
      submitterId: 'user_alice_employee',
      categoryId: 1, // Meals
      amount: 45.50,
      currency: 'USD',
      description: 'Team lunch with client from Acme Corp',
      expenseDate: '2026-01-28',
      receiptUrl: 'https://storage.example.com/receipts/alice_lunch_01.pdf',
      status: 'pending',
      submittedOffset: '-5 days',
    },
    {
      expenseId: generateUUID(),
      submitterId: 'user_alice_employee',
      categoryId: 4, // Software
      amount: 299.00,
      currency: 'USD',
      description: 'Annual IDE license - WebStorm',
      expenseDate: '2026-01-15',
      receiptUrl: null,
      status: 'approved',
      submittedOffset: '-18 days',
    },
    {
      expenseId: generateUUID(),
      submitterId: 'user_alice_employee',
      categoryId: 2, // Travel
      amount: 850.00,
      currency: 'USD',
      description: 'Flight to SF for tech conference',
      expenseDate: '2026-01-20',
      receiptUrl: 'https://storage.example.com/receipts/alice_flight.pdf',
      status: 'approved',
      submittedOffset: '-12 days',
    },
    
    // Dave's expenses (Engineering employee)
    {
      expenseId: generateUUID(),
      submitterId: 'user_dave_employee',
      categoryId: 3, // Office Supplies
      amount: 125.00,
      currency: 'USD',
      description: 'Mechanical keyboard for home office',
      expenseDate: '2026-01-25',
      receiptUrl: null,
      status: 'pending',
      submittedOffset: '-8 days',
    },
    {
      expenseId: generateUUID(),
      submitterId: 'user_dave_employee',
      categoryId: 5, // Training
      amount: 1500.00,
      currency: 'USD',
      description: 'AWS Solutions Architect certification course',
      expenseDate: '2026-01-10',
      receiptUrl: 'https://storage.example.com/receipts/dave_aws_cert.pdf',
      status: 'rejected',
      submittedOffset: '-23 days',
    },

    // Frank's expenses (Sales employee)
    {
      expenseId: generateUUID(),
      submitterId: 'user_frank_employee',
      categoryId: 1, // Meals
      amount: 175.00,
      currency: 'USD',
      description: 'Client dinner at Nobu',
      expenseDate: '2026-01-30',
      receiptUrl: 'https://storage.example.com/receipts/frank_dinner.pdf',
      status: 'pending',
      submittedOffset: '-3 days',
    },
    {
      expenseId: generateUUID(),
      submitterId: 'user_frank_employee',
      categoryId: 2, // Travel
      amount: 2100.00,
      currency: 'USD',
      description: 'Sales trip to NYC - flight and hotel',
      expenseDate: '2026-01-18',
      receiptUrl: 'https://storage.example.com/receipts/frank_nyc_trip.pdf',
      status: 'approved',
      submittedOffset: '-15 days',
    },

    // Bob's expenses (Engineering Manager)
    {
      expenseId: generateUUID(),
      submitterId: 'user_bob_manager',
      categoryId: 1, // Meals
      amount: 320.00,
      currency: 'USD',
      description: 'Team building dinner for engineering',
      expenseDate: '2026-01-22',
      receiptUrl: 'https://storage.example.com/receipts/bob_team_dinner.pdf',
      status: 'approved',
      submittedOffset: '-11 days',
    },
  ];

  for (const expense of sampleExpenses) {
    insertExpense.run(
      expense.expenseId,
      expense.submitterId,
      expense.categoryId,
      expense.amount,
      expense.currency,
      expense.description,
      expense.expenseDate,
      expense.receiptUrl,
      expense.status,
      expense.submittedOffset
    );
  }

  console.log(`✅ Seeded ${sampleExpenses.length} sample expenses`);
}

/**
 * Seed approval records for approved/rejected expenses
 */
function seedApprovals(): void {
  const db = getDb();
  
  // Get approved expenses
  const approvedExpenses = db.prepare(`
    SELECT expense_id, submitter_id FROM expenses 
    WHERE status IN ('approved', 'rejected')
  `).all() as Array<{ expense_id: string; submitter_id: string }>;

  const insertApproval = db.prepare(`
    INSERT INTO expense_approvals 
    (expense_id, approver_id, action, notes)
    VALUES (?, ?, ?, ?)
  `);

  for (const expense of approvedExpenses) {
    // Determine approver based on submitter's manager
    const submitter = db.prepare(`
      SELECT manager_id FROM users WHERE user_id = ?
    `).get(expense.submitter_id) as { manager_id: string } | undefined;

    const approverId = submitter?.manager_id || 'user_carol_finance';
    
    const expenseStatus = db.prepare(`
      SELECT status FROM expenses WHERE expense_id = ?
    `).get(expense.expense_id) as { status: string };

    const action = expenseStatus.status === 'approved' ? 'approved' : 'rejected';
    const notes = action === 'approved' 
      ? 'Approved - valid business expense'
      : 'Rejected - requires additional documentation';

    insertApproval.run(expense.expense_id, approverId, action, notes);
  }

  console.log(`✅ Seeded ${approvedExpenses.length} approval records`);
}

/**
 * Main seed function
 */
async function seed(): Promise<void> {
  console.log('\n🌱 Starting database seed...\n');

  // Create tables if they don't exist
  if (!isDatabaseInitialized()) {
    console.log('📦 Creating database tables...');
    createTables();
  } else {
    console.log('📦 Database tables already exist');
  }

  // Seed data
  seedCategories();
  seedTestUsers();
  seedSampleExpenses();
  seedApprovals();

  console.log('\n✅ Database seed completed!\n');

  // Print summary
  const db = getDb();
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const categoryCount = (db.prepare('SELECT COUNT(*) as count FROM expense_categories').get() as { count: number }).count;
  const expenseCount = (db.prepare('SELECT COUNT(*) as count FROM expenses').get() as { count: number }).count;
  const approvalCount = (db.prepare('SELECT COUNT(*) as count FROM expense_approvals').get() as { count: number }).count;

  console.log('📊 Database Summary:');
  console.log(`   Users:      ${userCount}`);
  console.log(`   Categories: ${categoryCount}`);
  console.log(`   Expenses:   ${expenseCount}`);
  console.log(`   Approvals:  ${approvalCount}`);
  console.log('');

  closeDb();
}

// Run seed if this file is executed directly
seed().catch(console.error);

export { seed, seedCategories, seedTestUsers, seedSampleExpenses, seedApprovals };
```

---

## Step 4: Create Database Type Definitions

Create `apps/expense-server/src/db/types.ts`:

```typescript
/**
 * Raw database row types (as returned by SQLite)
 * These match the column names in the database
 */

export interface UserRow {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategoryRow {
  category_id: number;
  category_name: string;
  description: string | null;
  requires_receipt: number; // SQLite boolean (0 or 1)
  max_amount: number | null;
  created_at: string;
}

export interface ExpenseRow {
  expense_id: string;
  submitter_id: string;
  category_id: number;
  amount: number;
  currency: string;
  description: string;
  expense_date: string;
  receipt_url: string | null;
  status: string;
  submitted_at: string;
  updated_at: string;
}

export interface ExpenseWithCategoryRow extends ExpenseRow {
  category_name: string;
}

export interface ExpenseWithSubmitterRow extends ExpenseWithCategoryRow {
  submitter_full_name: string;
  submitter_email: string;
  submitter_department: string | null;
}

export interface ExpenseApprovalRow {
  approval_id: number;
  expense_id: string;
  approver_id: string;
  action: string;
  notes: string | null;
  approved_at: string;
}

export interface ExpenseApprovalWithApproverRow extends ExpenseApprovalRow {
  approver_full_name: string;
  approver_email: string;
}

export interface AuditLogRow {
  log_id: number;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null; // JSON string
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

/**
 * Query result types for aggregations
 */

export interface ExpenseSummaryRow {
  total_count: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
  approved_count: number;
  approved_amount: number;
  rejected_count: number;
  rejected_amount: number;
  paid_count: number;
  paid_amount: number;
}

export interface CategorySummaryRow {
  category_name: string;
  total_amount: number;
  expense_count: number;
}

export interface DepartmentSummaryRow {
  department: string;
  total_amount: number;
  expense_count: number;
}

export interface StatusSummaryRow {
  status: string;
  total_amount: number;
  expense_count: number;
}
```

---

## Step 5: Update Main Entry Point to Initialize Database

Update `apps/expense-server/src/index.ts` to include database initialization:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import { createMcpRouter } from './mcp';
import { apiRouter } from './api';
import { errorHandler, notFoundHandler } from './middleware';
import { isDatabaseInitialized, getDb } from './db';
import { createTables } from './db/schema';

// Initialize database
if (!isDatabaseInitialized()) {
  console.log('📦 Initializing database...');
  createTables();
  console.log('💡 Run `bun run db:seed` to populate with sample data');
} else {
  // Verify database connection
  const db = getDb();
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  console.log(`📦 Database connected (${userCount} users)`);
}

// Create Express app
const app = express();

// ===================
// Security Middleware
// ===================
app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production',
}));

// ===================
// CORS Configuration
// ===================
app.use(cors({
  origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ===================
// Request Parsing
// ===================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===================
// Request Logging
// ===================
if (config.NODE_ENV !== 'test') {
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ===================
// Health Check (before auth)
// ===================
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// ===================
// MCP Server Endpoint
// ===================
app.use(createMcpRouter());

// ===================
// REST API Endpoints
// ===================
app.use('/api', apiRouter);

// ===================
// Error Handling
// ===================
app.use(notFoundHandler);
app.use(errorHandler);

// ===================
// Start Server
// ===================
const PORT = config.PORT;

app.listen(PORT, () => {
  console.log('\n🚀 Expense Management Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Environment:     ${config.NODE_ENV}`);
  console.log(`   Server URL:      ${config.SERVER_URL}`);
  console.log(`   Database:        ${config.DATABASE_PATH}`);
  console.log(`   Health Check:    ${config.SERVER_URL}/health`);
  console.log('');
  console.log('   📡 MCP Endpoint:');
  console.log(`      POST ${config.SERVER_URL}/mcp`);
  console.log('');
  console.log('   🌐 REST API:');
  console.log(`      ${config.SERVER_URL}/api`);
  console.log('');
  console.log('   🔐 OAuth Metadata:');
  console.log(`      ${config.SERVER_URL}/.well-known/oauth-protected-resource`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

export { app };
```

---

## Step 6: Verification

After completing Phase 2:

1. Seed the database:
   ```bash
   cd apps/expense-server
   bun run db:seed
   ```

   Expected output:
   ```
   🌱 Starting database seed...

   📦 Creating database tables...
   ✅ Database tables created successfully
   ✅ Seeded 5 expense categories
   ✅ Seeded 6 test users
   ✅ Seeded 8 sample expenses
   ✅ Seeded 4 approval records

   ✅ Database seed completed!

   📊 Database Summary:
      Users:      6
      Categories: 5
      Expenses:   8
      Approvals:  4
   ```

2. Verify the database file was created:
   ```bash
   ls -la data/
   ```

3. Start the server:
   ```bash
   bun run dev
   ```

4. Verify database is loaded in server output:
   ```
   📦 Database connected (6 users)
   ```

5. (Optional) Inspect database with SQLite CLI:
   ```bash
   sqlite3 data/expense.db ".tables"
   sqlite3 data/expense.db "SELECT * FROM users;"
   sqlite3 data/expense.db "SELECT * FROM expense_categories;"
   ```

---

## Files Created/Modified in This Phase

1. `apps/expense-server/src/db/index.ts`
2. `apps/expense-server/src/db/schema.ts`
3. `apps/expense-server/src/db/seed.ts`
4. `apps/expense-server/src/db/types.ts`
5. `apps/expense-server/src/index.ts` (updated)

---

## Database Schema Summary

| Table | Description | Key Indexes |
|-------|-------------|-------------|
| `users` | User accounts (synced from Descope) | `manager_id`, `department` |
| `expense_categories` | Expense category definitions | (primary key only) |
| `expenses` | Individual expense records | `submitter_id+status`, `status+expense_date`, `expense_date`, `category_id` |
| `expense_approvals` | Approval/rejection records | `expense_id`, `approver_id` |
| `audit_log` | Action audit trail | `user_id+action`, `timestamp`, `resource_type+resource_id` |

---

## Test Users Summary

| User | Role | Department | Manager |
|------|------|------------|---------|
| Carol Finance | finance_admin | Finance | - |
| Bob Manager | manager | Engineering | Carol |
| Alice Employee | employee | Engineering | Bob |
| Dave Developer | employee | Engineering | Bob |
| Eve Sales Manager | manager | Sales | Carol |
| Frank Salesman | employee | Sales | Eve |
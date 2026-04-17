import "dotenv/config";
import { getDb, closeDb, isDatabaseInitialized } from "./index.js";
import { createTables } from "./schema.js";
import { generateUUID } from "../utils/uuid.js";
import { DEFAULT_CATEGORIES } from "../config/constants.js";

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
      category.maxAmount,
    );
  }

  console.log(`✅ Seeded ${DEFAULT_CATEGORIES.length} expense categories`);
}

/**
 * Seed test users
 * In production, users would be synced from the auth provider
 */
function seedTestUsers(): void {
  const db = getDb();

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users 
    (user_id, email, full_name, department, manager_id, lr_user_id)
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
      userId: "user_finance",
      email: "finance@yopmail.com",
      fullName: "Finance Guy",
      department: "Finance",
      managerId: null,
    },
    // Engineering Manager
    {
      userId: "engineer_manager",
      email: "manager-engineer@yopmail.com",
      fullName: "Engineer Manager Guy",
      department: "Engineering",
      managerId: "user_finance",
    },
    // Engineering Employees
    {
      userId: "engineer_employee",
      email: "employee-engineer@yopmail.com",
      fullName: "Engineer Employee Guy",
      department: "Engineering",
      managerId: "engineer_manager",
    },
    {
      userId: "engineer_employee_2",
      email: "employee-engineer-2@company.com",
      fullName: "Engineer Employee 2 Guy",
      department: "Engineering",
      managerId: "engineer_manager",
    },
    // Sales Manager
    {
      userId: "sales_manager",
      email: "manager-sales@yopmail.com",
      fullName: "Sales Manager Guy",
      department: "Sales",
      managerId: "user_finance",
    },
    // Sales Employee
    {
      userId: "sales_employee",
      email: "sales_employee@yopmail.com",
      fullName: "Sales Employee Guy",
      department: "Sales",
      managerId: "sales_manager",
    },
  ];

  for (const user of testUsers) {
    insertUser.run(
      user.userId,
      user.email,
      user.fullName,
      user.department,
      user.managerId,
      null,
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
      submitterId: "engineer_employee",
      categoryId: 1, // Meals
      amount: 45.5,
      currency: "USD",
      description: "Team lunch with client from Acme Corp",
      expenseDate: "2026-01-28",
      receiptUrl: "https://storage.example.com/receipts/alice_lunch_01.pdf",
      status: "pending",
      submittedOffset: "-5 days",
    },
    {
      expenseId: generateUUID(),
      submitterId: "engineer_employee",
      categoryId: 4, // Software
      amount: 299.0,
      currency: "USD",
      description: "Annual IDE license - WebStorm",
      expenseDate: "2026-01-15",
      receiptUrl: null,
      status: "approved",
      submittedOffset: "-18 days",
    },
    {
      expenseId: generateUUID(),
      submitterId: "engineer_employee",
      categoryId: 2, // Travel
      amount: 850.0,
      currency: "USD",
      description: "Flight to SF for tech conference",
      expenseDate: "2026-01-20",
      receiptUrl: "https://storage.example.com/receipts/alice_flight.pdf",
      status: "approved",
      submittedOffset: "-12 days",
    },

    // Dave's expenses (Engineering employee)
    {
      expenseId: generateUUID(),
      submitterId: "engineer_employee_2",
      categoryId: 3, // Office supplies
      amount: 125.0,
      currency: "USD",
      description: "Mechanical keyboard for home office",
      expenseDate: "2026-01-25",
      receiptUrl: null,
      status: "pending",
      submittedOffset: "-8 days",
    },
    {
      expenseId: generateUUID(),
      submitterId: "engineer_employee_2",
      categoryId: 5, // Training
      amount: 1500.0,
      currency: "USD",
      description: "AWS Solutions Architect certification course",
      expenseDate: "2026-01-10",
      receiptUrl: "https://storage.example.com/receipts/dave_aws_cert.pdf",
      status: "rejected",
      submittedOffset: "-23 days",
    },

    // Frank's expenses (Sales employee)
    {
      expenseId: generateUUID(),
      submitterId: "sales_employee",
      categoryId: 1, // Meals
      amount: 175.0,
      currency: "USD",
      description: "Client dinner at Nobu",
      expenseDate: "2026-01-30",
      receiptUrl: "https://storage.example.com/receipts/frank_dinner.pdf",
      status: "pending",
      submittedOffset: "-3 days",
    },
    {
      expenseId: generateUUID(),
      submitterId: "sales_employee",
      categoryId: 2, // Travel
      amount: 2100.0,
      currency: "USD",
      description: "Sales trip to NYC - flight and hotel",
      expenseDate: "2026-01-18",
      receiptUrl: "https://storage.example.com/receipts/frank_nyc_trip.pdf",
      status: "approved",
      submittedOffset: "-15 days",
    },

    // Bob's expenses (Engineering Manager)
    {
      expenseId: generateUUID(),
      submitterId: "engineer_manager",
      categoryId: 1, // Meals
      amount: 320.0,
      currency: "USD",
      description: "Team building dinner for engineering",
      expenseDate: "2026-01-22",
      receiptUrl: "https://storage.example.com/receipts/bob_team_dinner.pdf",
      status: "approved",
      submittedOffset: "-11 days",
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
      expense.submittedOffset,
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
  const approvedExpenses = db
    .prepare(
      `
    SELECT expense_id, submitter_id FROM expenses 
    WHERE status IN ('approved', 'rejected')
  `,
    )
    .all() as Array<{ expense_id: string; submitter_id: string }>;

  const insertApproval = db.prepare(`
    INSERT INTO expense_approvals 
    (expense_id, approver_id, action, notes)
    VALUES (?, ?, ?, ?)
  `);

  for (const expense of approvedExpenses) {
    // Determine approver based on submitter's manager
    const submitter = db
      .prepare(
        `
      SELECT manager_id FROM users WHERE user_id = ?
    `,
      )
      .get(expense.submitter_id) as { manager_id: string } | undefined;

    const approverId = submitter?.manager_id || "user_finance";

    const expenseStatus = db
      .prepare(
        `
      SELECT status FROM expenses WHERE expense_id = ?
    `,
      )
      .get(expense.expense_id) as { status: string };

    const action =
      expenseStatus.status === "approved" ? "approved" : "rejected";
    const notes =
      action === "approved"
        ? "Approved - valid business expense"
        : "Rejected - requires additional documentation";

    insertApproval.run(expense.expense_id, approverId, action, notes);
  }

  console.log(`✅ Seeded ${approvedExpenses.length} approval records`);
}

/**
 * Main seed function
 */
async function seed(): Promise<void> {
  console.log("\n🌱 Starting database seed...\n");

  // Create tables if they don't exist
  if (!isDatabaseInitialized()) {
    console.log("📦 Creating database tables...");
    createTables();
  } else {
    console.log("📦 Database tables already exist");
  }

  // Seed data
  seedCategories();
  seedTestUsers();
  seedSampleExpenses();
  seedApprovals();

  console.log("\n✅ Database seed completed!\n");

  // Print summary
  const db = getDb();
  const userCount = (
    db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }
  ).count;
  const categoryCount = (
    db.prepare("SELECT COUNT(*) as count FROM expense_categories").get() as {
      count: number;
    }
  ).count;
  const expenseCount = (
    db.prepare("SELECT COUNT(*) as count FROM expenses").get() as {
      count: number;
    }
  ).count;
  const approvalCount = (
    db.prepare("SELECT COUNT(*) as count FROM expense_approvals").get() as {
      count: number;
    }
  ).count;

  console.log("📊 Database Summary:");
  console.log(`   Users:      ${userCount}`);
  console.log(`   Categories: ${categoryCount}`);
  console.log(`   Expenses:   ${expenseCount}`);
  console.log(`   Approvals:  ${approvalCount}`);
  console.log("");

  closeDb();
}

// Run seed if this file is executed directly
seed().catch(console.error);

export {
  seed,
  seedCategories,
  seedTestUsers,
  seedSampleExpenses,
  seedApprovals,
};

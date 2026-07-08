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
  // - Finance Admin (finance_1) - no manager
  // - Engineering Manager (manager_1) - reports to finance_1
  // - Engineering Employees (employee_1, employee_2) - report to manager_1
  // - Sales Manager (manager_2) - reports to finance_1
  // - Sales Employee (employee_3) - reports to manager_2

  const testUsers = [
    // Finance Admin
    {
      userId: "finance_1",
      email: "finance-1@loginradius.com",
      fullName: "Finance 1",
      department: "Finance",
      managerId: null,
      lrUserId: "a60099ee324442afa3d531b178a6cbca",
    },
    // Engineering Manager
    {
      userId: "manager_1",
      email: "manager-1@loginradius.com",
      fullName: "Manager 1",
      department: "Engineering",
      managerId: "finance_1",
      lrUserId: "fcf38651524c4ec39b520d9da66b2935",
    },
    // Engineering Employees
    {
      userId: "employee_1",
      email: "employee-1@loginradius.com",
      fullName: "Employee 1",
      department: "Engineering",
      managerId: "manager_1",
      lrUserId: "0d0c6e2d572d486697ce80b3876e5fc4",
    },
    {
      userId: "employee_2",
      email: "employee-2@loginradius.com",
      fullName: "Employee 2",
      department: "Engineering",
      managerId: "manager_1",
      lrUserId: "d047683b04a04bcd932d239bcbd3dd22",
    },
    // Sales Manager
    {
      userId: "manager_2",
      email: "manager-2@loginradius.com",
      fullName: "Manager 2",
      department: "Sales",
      managerId: "finance_1",
      lrUserId: "9bbcda81c2b64b05b7c546fef8bf907c",
    },
    // Sales Employee
    {
      userId: "employee_3",
      email: "employee-3@loginradius.com",
      fullName: "Employee 3",
      department: "Sales",
      managerId: "manager_2",
      lrUserId: "0a4ed8542b154ba3b4776977384254a1",
    },
  ];

  for (const user of testUsers) {
    insertUser.run(
      user.userId,
      user.email,
      user.fullName,
      user.department,
      user.managerId,
      user.lrUserId,
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
    // employee_1's expenses (Engineering employee)
    {
      expenseId: generateUUID(),
      submitterId: "employee_1",
      categoryId: 1, // Meals
      amount: 45.5,
      currency: "USD",
      description: "Team lunch with client from Acme Corp",
      expenseDate: "2026-01-28",
      receiptUrl: "https://storage.example.com/receipts/employee1_lunch_01.pdf",
      status: "pending",
      submittedOffset: "-5 days",
    },
    {
      expenseId: generateUUID(),
      submitterId: "employee_1",
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
      submitterId: "employee_1",
      categoryId: 2, // Travel
      amount: 850.0,
      currency: "USD",
      description: "Flight to SF for tech conference",
      expenseDate: "2026-01-20",
      receiptUrl: "https://storage.example.com/receipts/employee1_flight.pdf",
      status: "approved",
      submittedOffset: "-12 days",
    },

    // employee_2's expenses (Engineering employee)
    {
      expenseId: generateUUID(),
      submitterId: "employee_2",
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
      submitterId: "employee_2",
      categoryId: 5, // Training
      amount: 1500.0,
      currency: "USD",
      description: "AWS Solutions Architect certification course",
      expenseDate: "2026-01-10",
      receiptUrl: "https://storage.example.com/receipts/employee2_aws_cert.pdf",
      status: "rejected",
      submittedOffset: "-23 days",
    },

    // employee_3's expenses (Sales employee)
    {
      expenseId: generateUUID(),
      submitterId: "employee_3",
      categoryId: 1, // Meals
      amount: 175.0,
      currency: "USD",
      description: "Client dinner at Nobu",
      expenseDate: "2026-01-30",
      receiptUrl: "https://storage.example.com/receipts/employee3_dinner.pdf",
      status: "pending",
      submittedOffset: "-3 days",
    },
    {
      expenseId: generateUUID(),
      submitterId: "employee_3",
      categoryId: 2, // Travel
      amount: 2100.0,
      currency: "USD",
      description: "Sales trip to NYC - flight and hotel",
      expenseDate: "2026-01-18",
      receiptUrl: "https://storage.example.com/receipts/employee3_nyc_trip.pdf",
      status: "approved",
      submittedOffset: "-15 days",
    },

    // manager_1's expenses (Engineering Manager)
    {
      expenseId: generateUUID(),
      submitterId: "manager_1",
      categoryId: 1, // Meals
      amount: 320.0,
      currency: "USD",
      description: "Team building dinner for engineering",
      expenseDate: "2026-01-22",
      receiptUrl:
        "https://storage.example.com/receipts/manager1_team_dinner.pdf",
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

    const approverId = submitter?.manager_id || "finance_1";

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

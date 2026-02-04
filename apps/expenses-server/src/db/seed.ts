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
            categoryId: 3, // Office supplies
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

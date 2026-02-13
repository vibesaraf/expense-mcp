import { BaseRepository } from "./base";
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
} from "../../types/user.types";
import type { UserRow } from "../types";
import type { UserRole } from "../../config/constants";

export class UserRepository extends BaseRepository {
  /**
   * Convert database row to User object
   */
  private rowToUser(row: UserRow): User {
    return {
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role as UserRole,
      department: row.department || undefined,
      managerId: row.manager_id || undefined,
      lrUserId: row.lr_user_id || undefined,
      scopes: row.scopes || "",
      createdAt: this.toDate(row.created_at),
      updatedAt: this.toDate(row.updated_at),
    };
  }

  /**
   * Find user by ID
   */
  findById(userId: string): User | null {
    const row = this.db
      .prepare(
        `
      SELECT * FROM users WHERE user_id = ?
    `,
      )
      .get(userId) as UserRow | undefined;

    return row ? this.rowToUser(row) : null;
  }

  /**
   * Find user by email
   */
  findByEmail(email: string): User | null {
    const row = this.db
      .prepare(
        `
      SELECT * FROM users WHERE email = ?
    `,
      )
      .get(email) as UserRow | undefined;

    return row ? this.rowToUser(row) : null;
  }

  /**
   * Find user by LoginRadius user ID
   */
  findByLrUserId(lrUserId: string): User | null {
    const row = this.db
      .prepare(
        `
      SELECT * FROM users WHERE lr_user_id = ?
    `,
      )
      .get(lrUserId) as UserRow | undefined;

    return row ? this.rowToUser(row) : null;
  }

  /**
   * Find user by LoginRadius user ID or email
   */
  findByLrUserIdOrEmail(lrUserId?: string, email?: string): User | null {
    if (lrUserId) {
      const user = this.findByLrUserId(lrUserId);
      if (user) return user;
    }

    if (email) {
      return this.findByEmail(email);
    }

    return null;
  }

  /**
   * Get all users
   */
  findAll(): User[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM users ORDER BY full_name
    `,
      )
      .all() as UserRow[];

    return rows.map((row) => this.rowToUser(row));
  }

  /**
   * Get users by department
   */
  findByDepartment(department: string): User[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM users WHERE department = ? ORDER BY full_name
    `,
      )
      .all(department) as UserRow[];

    return rows.map((row) => this.rowToUser(row));
  }

  /**
   * Get users managed by a specific manager
   */
  findByManager(managerId: string): User[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM users WHERE manager_id = ? ORDER BY full_name
    `,
      )
      .all(managerId) as UserRow[];

    return rows.map((row) => this.rowToUser(row));
  }

  /**
   * Get all team members (direct reports) for a manager
   */
  getTeamMembers(managerId: string): User[] {
    return this.findByManager(managerId);
  }

  /**
   * Check if a user is a team member of a manager
   */
  isTeamMember(userId: string, managerId: string): boolean {
    const result = this.db
      .prepare(
        `
      SELECT 1 FROM users WHERE user_id = ? AND manager_id = ?
    `,
      )
      .get(userId, managerId);

    return !!result;
  }

  /**
   * Create a new user
   */
  create(input: CreateUserInput): User {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO users (user_id, email, full_name, role, department, manager_id, lr_user_id, scopes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        input.userId,
        input.email,
        input.fullName,
        input.role,
        input.department || null,
        input.managerId || null,
        input.lrUserId || null,
        input.scopes || "",
        now,
        now,
      );

    return this.findById(input.userId)!;
  }

  /**
   * Update a user
   */
  update(userId: string, input: UpdateUserInput): User | null {
    const user = this.findById(userId);
    if (!user) return null;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.email !== undefined) {
      updates.push("email = ?");
      values.push(input.email);
    }
    if (input.fullName !== undefined) {
      updates.push("full_name = ?");
      values.push(input.fullName);
    }
    if (input.role !== undefined) {
      updates.push("role = ?");
      values.push(input.role);
    }
    if (input.department !== undefined) {
      updates.push("department = ?");
      values.push(input.department);
    }
    if (input.managerId !== undefined) {
      updates.push("manager_id = ?");
      values.push(input.managerId);
    }
    if (input.lrUserId !== undefined) {
      updates.push("lr_user_id = ?");
      values.push(input.lrUserId);
    }
    if (input.scopes !== undefined) {
      updates.push("scopes = ?");
      values.push(input.scopes);
    }

    if (updates.length === 0) return user;

    updates.push("updated_at = datetime('now')");
    values.push(userId);

    this.db
      .prepare(
        `
      UPDATE users SET ${updates.join(", ")} WHERE user_id = ?
    `,
      )
      .run(...values);

    return this.findById(userId);
  }

  /**
   * Upsert user (create or update)
   * Useful for syncing users from auth provider
   */
  upsert(input: CreateUserInput): User {
    const existing = this.findById(input.userId);

    if (existing) {
      return this.update(input.userId, {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        department: input.department,
        managerId: input.managerId,
        lrUserId: input.lrUserId,
        scopes: input.scopes,
      })!;
    }

    return this.create(input);
  }

  /**
   * Delete a user
   */
  delete(userId: string): boolean {
    const result = this.db
      .prepare(
        `
      DELETE FROM users WHERE user_id = ?
    `,
      )
      .run(userId);

    return result.changes > 0;
  }

  /**
   * Update LoginRadius user ID
   */
  updateLrUserId(userId: string, lrUserId: string): User | null {
    return this.update(userId, { lrUserId });
  }

  /**
   * Get user's manager
   */
  getManager(userId: string): User | null {
    const user = this.findById(userId);
    if (!user || !user.managerId) return null;
    return this.findById(user.managerId);
  }

  /**
   * Get all departments
   */
  getDepartments(): string[] {
    const rows = this.db
      .prepare(
        `
      SELECT DISTINCT department FROM users 
      WHERE department IS NOT NULL 
      ORDER BY department
    `,
      )
      .all() as Array<{ department: string }>;

    return rows.map((row) => row.department);
  }
}

// Export singleton instance
export const userRepository = new UserRepository();

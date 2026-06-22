import { v4 as uuidv4 } from "uuid";
import { BaseRepository } from "./base.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../config/constants.js";

export interface AuditLogRow {
  id: string;
  userId: string;
  actorType: "user" | "agent";
  actorClientId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  scopeUsed: string | null;
  statusCode: number;
  createdAt: string;
}

export interface CreateAuditLogInput {
  userId: string;
  actorType: "user" | "agent";
  actorClientId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  scopeUsed?: string;
  statusCode: number;
}

export interface AuditLogFilters {
  actorType?: "user" | "agent";
  action?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

interface AuditListResult {
  logs: AuditLogRow[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

interface DbAuditLogRow {
  id: string;
  user_id: string;
  actor_type: "user" | "agent";
  actor_client_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  scope_used: string | null;
  status_code: number;
  created_at: string;
}

export class AuditRepository extends BaseRepository {
  private rowToAuditLog(row: DbAuditLogRow): AuditLogRow {
    return {
      id: row.id,
      userId: row.user_id,
      actorType: row.actor_type,
      actorClientId: row.actor_client_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      scopeUsed: row.scope_used,
      statusCode: row.status_code,
      createdAt: row.created_at,
    };
  }

  private buildFilterConditions(
    filters: AuditLogFilters,
  ): { conditions: string[]; values: unknown[] } {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.actorType) {
      conditions.push("actor_type = ?");
      values.push(filters.actorType);
    }
    if (filters.action) {
      conditions.push("action = ?");
      values.push(filters.action);
    }
    if (filters.fromDate) {
      conditions.push("created_at >= ?");
      values.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push("created_at <= ?");
      values.push(filters.toDate);
    }

    return { conditions, values };
  }

  insert(input: CreateAuditLogInput): void {
    this.db
      .prepare(
        `INSERT INTO audit_log
        (id, user_id, actor_type, actor_client_id, action, resource_type, resource_id, scope_used, status_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv4(),
        input.userId,
        input.actorType,
        input.actorClientId ?? null,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        input.scopeUsed ?? null,
        input.statusCode,
      );
  }

  findForUser(
    userId: string,
    filters: AuditLogFilters = {},
  ): AuditListResult {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE));
    const { conditions, values } = this.buildFilterConditions(filters);

    const where = this.buildWhereClause(conditions, "user_id = ?");
    const baseValues = [userId, ...values];

    const { count } = this.db
      .prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`)
      .get(...baseValues) as { count: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM audit_log ${where} ORDER BY created_at DESC ${this.buildPaginationClause(page, limit)}`,
      )
      .all(...baseValues) as DbAuditLogRow[];

    return {
      logs: rows.map((r) => this.rowToAuditLog(r)),
      pagination: this.calculatePagination(count, page, limit),
    };
  }

  findForTeam(
    managerId: string,
    filters: AuditLogFilters = {},
  ): AuditListResult {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE));
    const { conditions, values } = this.buildFilterConditions(filters);

    const teamSubquery =
      "user_id IN (SELECT user_id FROM users WHERE user_id = ? OR manager_id = ?)";
    const where = this.buildWhereClause(conditions, teamSubquery);
    const baseValues = [managerId, managerId, ...values];

    const { count } = this.db
      .prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`)
      .get(...baseValues) as { count: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM audit_log ${where} ORDER BY created_at DESC ${this.buildPaginationClause(page, limit)}`,
      )
      .all(...baseValues) as DbAuditLogRow[];

    return {
      logs: rows.map((r) => this.rowToAuditLog(r)),
      pagination: this.calculatePagination(count, page, limit),
    };
  }

  findAll(
    filters: AuditLogFilters = {},
  ): AuditListResult {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE));
    const { conditions, values } = this.buildFilterConditions(filters);

    const where = this.buildWhereClause(conditions);

    const { count } = this.db
      .prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`)
      .get(...values) as { count: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM audit_log ${where} ORDER BY created_at DESC ${this.buildPaginationClause(page, limit)}`,
      )
      .all(...values) as DbAuditLogRow[];

    return {
      logs: rows.map((r) => this.rowToAuditLog(r)),
      pagination: this.calculatePagination(count, page, limit),
    };
  }
}

export const auditRepository = new AuditRepository();

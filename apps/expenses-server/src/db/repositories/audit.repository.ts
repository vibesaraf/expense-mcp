import { BaseRepository } from './base';
import type { AuditLog } from '../../types/expense.types';
import type { AuditLogRow } from '../types';

export interface CreateAuditLogInput {
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

export interface AuditLogFilters {
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
}

export class AuditRepository extends BaseRepository {
    /**
     * Convert database row to AuditLog object
     */
    private rowToAuditLog(row: AuditLogRow): AuditLog {
        return {
            logId: row.log_id,
            userId: row.user_id,
            action: row.action,
            resourceType: row.resource_type,
            resourceId: row.resource_id || undefined,
            details: row.details ? JSON.parse(row.details) : undefined,
            ipAddress: row.ip_address || undefined,
            userAgent: row.user_agent || undefined,
            timestamp: this.toDate(row.timestamp),
        };
    }

    /**
     * Create a new audit log entry
     */
    create(input: CreateAuditLogInput): AuditLog {
        const result = this.db.prepare(`
      INSERT INTO audit_log 
      (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
            input.userId,
            input.action,
            input.resourceType,
            input.resourceId || null,
            input.details ? JSON.stringify(input.details) : null,
            input.ipAddress || null,
            input.userAgent || null
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    /**
     * Find audit log by ID
     */
    findById(logId: number): AuditLog | null {
        const row = this.db.prepare(`
      SELECT * FROM audit_log WHERE log_id = ?
    `).get(logId) as AuditLogRow | undefined;

        return row ? this.rowToAuditLog(row) : null;
    }

    /**
     * Search audit logs with filters
     */
    search(filters: AuditLogFilters = {}): { logs: AuditLog[]; total: number } {
        const page = Math.max(1, filters.page || 1);
        const limit = Math.min(100, Math.max(1, filters.limit || 20));

        const conditions: string[] = [];
        const values: unknown[] = [];

        if (filters.userId) {
            conditions.push('user_id = ?');
            values.push(filters.userId);
        }
        if (filters.action) {
            conditions.push('action = ?');
            values.push(filters.action);
        }
        if (filters.resourceType) {
            conditions.push('resource_type = ?');
            values.push(filters.resourceType);
        }
        if (filters.resourceId) {
            conditions.push('resource_id = ?');
            values.push(filters.resourceId);
        }
        if (filters.fromDate) {
            conditions.push('timestamp >= ?');
            values.push(filters.fromDate);
        }
        if (filters.toDate) {
            conditions.push('timestamp <= ?');
            values.push(filters.toDate);
        }

        const whereClause = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        // Get total count
        const countRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM audit_log ${whereClause}
    `).get(...values) as { count: number };

        // Get paginated results
        const offset = (page - 1) * limit;
        const rows = this.db.prepare(`
      SELECT * FROM audit_log 
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset) as AuditLogRow[];

        return {
            logs: rows.map(row => this.rowToAuditLog(row)),
            total: countRow.count,
        };
    }

    /**
     * Get audit logs for a specific resource
     */
    getByResource(resourceType: string, resourceId: string): AuditLog[] {
        const rows = this.db.prepare(`
      SELECT * FROM audit_log 
      WHERE resource_type = ? AND resource_id = ?
      ORDER BY timestamp DESC
    `).all(resourceType, resourceId) as AuditLogRow[];

        return rows.map(row => this.rowToAuditLog(row));
    }

    /**
     * Get recent audit logs for a user
     */
    getRecentByUser(userId: string, limit = 50): AuditLog[] {
        const rows = this.db.prepare(`
      SELECT * FROM audit_log 
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(userId, limit) as AuditLogRow[];

        return rows.map(row => this.rowToAuditLog(row));
    }

    /**
     * Delete old audit logs (for maintenance)
     */
    deleteOlderThan(days: number): number {
        const result = this.db.prepare(`
      DELETE FROM audit_log 
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `).run(days);

        return result.changes;
    }
}

// Export singleton instance
export const auditRepository = new AuditRepository();

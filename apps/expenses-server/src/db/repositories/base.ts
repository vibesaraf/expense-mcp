import type Database from 'better-sqlite3';
import { getDb } from '../index';

/**
 * Base repository with common database utilities
 */
export abstract class BaseRepository {
    protected get db(): Database.Database {
        return getDb();
    }

    /**
     * Convert SQLite datetime string to Date object
     */
    protected toDate(sqliteDate: string): Date {
        return new Date(sqliteDate + 'Z'); // Append Z to treat as UTC
    }

    /**
     * Convert Date to SQLite datetime string
     */
    protected toSqliteDate(date: Date): string {
        return date.toISOString().replace('T', ' ').replace('Z', '');
    }

    /**
     * Build WHERE clause from filters
     */
    protected buildWhereClause(
        conditions: string[],
        baseWhere = ''
    ): string {
        const allConditions = baseWhere ? [baseWhere, ...conditions] : conditions;
        if (allConditions.length === 0) return '';
        return 'WHERE ' + allConditions.join(' AND ');
    }

    /**
     * Build pagination clause
     */
    protected buildPaginationClause(page: number, limit: number): string {
        const offset = (page - 1) * limit;
        return `LIMIT ${limit} OFFSET ${offset}`;
    }

    /**
     * Calculate pagination info
     */
    protected calculatePagination(
        totalItems: number,
        page: number,
        limit: number
    ): { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } {
        return {
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
            itemsPerPage: limit,
        };
    }
}

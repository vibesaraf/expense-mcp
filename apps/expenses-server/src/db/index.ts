import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "../config/index.js";

// Singleton instance
let dbInstance: Database.Database | null = null;

/**
 * Get the database instance (Lazy Initialization)
 */
export function getDb(): Database.Database {
  if (!dbInstance) {
    // Ensure data directory exists
    const dataDir = path.dirname(config.DATABASE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create database connection
    dbInstance = new Database(config.DATABASE_PATH);

    // Enable global settings
    dbInstance.pragma("foreign_keys = ON");
    dbInstance.pragma("journal_mode = WAL");
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Execute a transaction
 */
export function transaction<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}

/**
 * Check if database is initialized (tables exist)
 */
export function isDatabaseInitialized(): boolean {
  const db = getDb();
  const result = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='users'
  `,
    )
    .get();
  return !!result;
}

// Handle process exit
process.on("exit", () => {
  closeDb();
});

import path from 'path';
import Database from 'better-sqlite3';

// Define the path for the SQLite database file in the project's root directory.
// The better-sqlite3 constructor will create the file if it doesn't exist.
const dbPath = path.join(process.cwd(), 'labnexus.db');

/**
 * Creates and configures a singleton SQLite database connection.
 * - WAL mode is enabled for high concurrency (readers don't block writers, and vice-versa).
 * - Busy timeout is set to 5000ms to handle write locks gracefully by queueing.
 */
const db = new Database(dbPath);

// 1. Enable WAL (Write-Ahead Logging) mode.
// This is crucial for concurrency as it allows read operations to proceed
// while a write operation is in progress.
db.pragma('journal_mode = WAL');

// 2. Set a busy timeout.
// If a write operation is attempted while the database is locked, SQLite will
// wait for this duration (in milliseconds) before throwing a SQLITE_BUSY error.
// This effectively creates a queue for write operations.
db.pragma('busy_timeout = 5000');

console.log('SQLite database connected successfully with WAL mode and busy timeout.');

// Gracefully close the database connection when the Node.js process terminates.
process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

export default db;

import db from './db';

export function initializeDatabase() {
    // ── cases ──────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            workOrderId TEXT,
            productName TEXT,
            status TEXT,
            department TEXT,
            creator TEXT,
            labManager TEXT,
            estimatedCompletionDate TEXT,
            actualCompletionDate TEXT,
            priority TEXT,
            createdAt TEXT,
            partNo TEXT,
            testItemsCount INTEGER,
            completedItemsCount INTEGER,
            passCount INTEGER,
            failCount INTEGER,
            naCount INTEGER,
            rejectionCount INTEGER,
            cost TEXT,
            auditTime TEXT,
            projectId TEXT,
            submissionOrder INTEGER,
            testDetails TEXT
        )
    `);

    // ── equipment ──────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS equipment (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            remark TEXT,
            logo TEXT,
            status TEXT,
            calibrationDate TEXT,
            isMultiChannel BOOLEAN
        )
    `);

    // ── schedules ──────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS schedules (
            id TEXT PRIMARY KEY,
            bookingId TEXT,
            date TEXT NOT NULL,
            equipmentId TEXT NOT NULL,
            equipmentName TEXT,
            workOrder TEXT,
            productName TEXT,
            tester TEXT,
            client TEXT,
            notes TEXT,
            updatedAt TEXT,
            FOREIGN KEY (equipmentId) REFERENCES equipment(id)
        )
    `);

    // ── engineers ──────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS engineers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT DEFAULT '測試者'
        )
    `);

    // ── notes (project notes) ──────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            workOrderId TEXT NOT NULL,
            note TEXT,
            author TEXT,
            createdAt TEXT
        )
    `);

    // ── maintenance ────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS maintenance (
            id TEXT PRIMARY KEY,
            equipmentName TEXT,
            equipmentId TEXT,
            estimatedCompletionDate TEXT,
            engineerName TEXT,
            status TEXT
        )
    `);

    // ── routine_work ───────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS routine_work (
            id TEXT PRIMARY KEY,
            yearMonth TEXT NOT NULL,
            taskCategory TEXT NOT NULL,
            engineerName TEXT NOT NULL,
            engineerId TEXT
        )
    `);

    // ── routine_work_tasks ─────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS routine_work_tasks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            "order" INTEGER NOT NULL DEFAULT 0
        )
    `);

    // ── Indices ────────────────────────────────────────
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cases_estimated_date ON cases(estimatedCompletionDate)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cases_labManager ON cases(labManager)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_schedules_equipmentId ON schedules(equipmentId)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_schedules_tester ON schedules(tester)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_workOrderId ON notes(workOrderId)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_routine_work_yearMonth ON routine_work(yearMonth)`);
    
    // ── Migrations ────────────────────────────────────
    try {
        const tableInfo = db.prepare(`PRAGMA table_info(engineers)`).all() as any[];
        const hasRole = tableInfo.some(col => col.name === 'role');
        if (!hasRole) {
            db.exec(`ALTER TABLE engineers ADD COLUMN role TEXT DEFAULT '測試者'`);
            console.log('Migrated engineers table: added role column');
        }
    } catch (e) {
        console.error('Migration failed for engineers table:', e);
    }

    try {
        const tableInfo = db.prepare(`PRAGMA table_info(routine_work)`).all() as any[];
        const hasEngineerId = tableInfo.some(col => col.name === 'engineerId');
        if (!hasEngineerId) {
            db.exec(`ALTER TABLE routine_work ADD COLUMN engineerId TEXT`);
            console.log('Migrated routine_work table: added engineerId column');
        }
    } catch (e) {
        console.error('Migration failed for routine_work table:', e);
    }

    console.log('SQLite schema initialized successfully.');
}

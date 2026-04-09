import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const { readFile, utils } = XLSX;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'plm_data', 'project_list.xlsx');
const TEMP_FILE = path.join(ROOT_DIR, 'tmp', 'plm_sync_temp.xlsx');
const DB_PATH = path.join(ROOT_DIR, 'labnexus.db');
const REPORT_PATH = path.join(ROOT_DIR, 'public', 'plm-sync-report.json');

const HEADER_MAPPING = {
    '工單編號': 'workOrderId',
    '工服單號': 'workOrderId',
    '品名': 'productName',
    '狀態': 'status',
    '送樣單位': 'department',
    '建立者': 'creator',
    '檢測者': 'labManager',
    '負責人': 'labManager',
    '預計測試完成日期': 'estimatedCompletionDate',
    '預計完成日': 'estimatedCompletionDate',
    '完成日期': 'actualCompletionDate',
    '優先級': 'priority',
    '機台編號 / 料號': 'partNo',
    '設備編號': 'partNo',
    '專案編號': 'projectId',
    '送件順序': 'submissionOrder',
    '應測項目數': 'testItemsCount',
    '完成項目數': 'completedItemsCount',
    '合格': 'passCount',
    '不合格': 'failCount',
    '不判定': 'naCount',
    '完成審核時間': 'auditTime',
    '費用': 'cost',
    '測1_尺寸測量': 'dimensions',
    '測2_力量測試': 'force',
    '測3_電性測試': 'electrical',
    '測4_材料測試': 'material',
    '測5_環境測試': 'environment',
    '測試其他項目': 'other',
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function shadowCopy(source, dest, retries = 5, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            // Check if file exists and has content
            if (!fs.existsSync(source)) {
                throw new Error('Source file does not exist');
            }
            const stats = fs.statSync(source);
            if (stats.size === 0) {
                throw new Error('File is 0KB (being written?)');
            }

            // Attempt to copy
            fs.copyFileSync(source, dest);
            console.log(`[Shadow Copy] Success: ${source} -> ${dest}`);
            return true;
        } catch (err) {
            console.warn(`[Shadow Copy] Attempt ${i + 1} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
            if (i < retries - 1) await sleep(delay);
        }
    }
    return false;
}

function syncToDatabase(data) {
    const db = new Database(DB_PATH);
    const report = {
        timestamp: new Date().toISOString(),
        totalRows: data.length,
        added: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        errors: []
    };

    const upsertStmt = db.prepare(`
        INSERT INTO cases (
            id, workOrderId, productName, status, department, creator, labManager,
            estimatedCompletionDate, actualCompletionDate, priority, createdAt, partNo,
            testItemsCount, completedItemsCount, passCount, failCount, naCount, 
            cost, auditTime, projectId, submissionOrder, testDetails
        ) VALUES (
            @id, @workOrderId, @productName, @status, @department, @creator, @labManager,
            @estimatedCompletionDate, @actualCompletionDate, @priority, @createdAt, @partNo,
            @testItemsCount, @completedItemsCount, @passCount, @failCount, @naCount,
            @cost, @auditTime, @projectId, @submissionOrder, @testDetails
        )
        ON CONFLICT(id) DO UPDATE SET
            workOrderId = excluded.workOrderId,
            productName = excluded.productName,
            status = excluded.status,
            department = excluded.department,
            creator = excluded.creator,
            labManager = excluded.labManager,
            estimatedCompletionDate = excluded.estimatedCompletionDate,
            actualCompletionDate = excluded.actualCompletionDate,
            priority = excluded.priority,
            partNo = excluded.partNo,
            testItemsCount = excluded.testItemsCount,
            completedItemsCount = excluded.completedItemsCount,
            passCount = excluded.passCount,
            failCount = excluded.failCount,
            naCount = excluded.naCount,
            cost = excluded.cost,
            auditTime = excluded.auditTime,
            projectId = excluded.projectId,
            submissionOrder = excluded.submissionOrder,
            testDetails = excluded.testDetails
    `);

    try {
        const syncTx = db.transaction((rows) => {
            const currentIds = [];
            for (const row of rows) {
                const normalized = normalizeRow(row);
                if (!normalized.workOrderId) {
                    report.skipped++;
                    continue;
                }
                currentIds.push(normalized.id);

                const result = upsertStmt.run(normalized);
                if (result.changes > 0) {
                    report.updated++; 
                }
            }

            // FULL RECONCILIATION: Delete records that are NOT in the Excel file
            if (currentIds.length > 0) {
                // We use placeholder approach for better-sqlite3 with many IDs
                // For simplicity here, we'll use a NOT IN (IDs) approach
                // If the file is huge (> 10,000 rows), this might need chunking
                const placeholders = currentIds.map(() => '?').join(',');
                const deleteResult = db.prepare(`DELETE FROM cases WHERE id NOT IN (${placeholders})`).run(...currentIds);
                report.deleted = deleteResult.changes;
                if (report.deleted > 0) {
                    console.log(`[Database Sync] Full Reconciliation: Deleted ${report.deleted} records not present in Excel.`);
                }
            }
        });

        syncTx(data);
        console.log(`[Database Sync] Transaction complete. Processed ${data.length} rows.`);
    } catch (err) {
        console.error('[Database Sync] Transaction failed:', err);
        report.errors.push(err.message);
    } finally {
        db.close();
    }

    // Write report
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    return report;
}

function normalizeRow(row) {
    const newRow = {
        id: '',
        workOrderId: '',
        productName: '',
        status: 'Assigned',
        department: '',
        creator: 'PLM Sync',
        labManager: '',
        estimatedCompletionDate: '',
        actualCompletionDate: '',
        priority: 'MEDIUM',
        createdAt: new Date().toISOString(),
        partNo: '',
        testItemsCount: 0,
        completedItemsCount: 0,
        passCount: 0,
        failCount: 0,
        naCount: 0,
        cost: '',
        auditTime: '',
        projectId: '',
        submissionOrder: 0,
        testDetails: '{}'
    };

    const testDetails = {};

    for (const key in row) {
        const trimmedKey = key.trim();
        const mappedKey = HEADER_MAPPING[trimmedKey];
        if (mappedKey) {
            if (['dimensions', 'force', 'electrical', 'material', 'environment', 'other'].includes(mappedKey)) {
                testDetails[mappedKey] = String(row[key]);
            } else {
                newRow[mappedKey] = row[key];
            }
        }
    }

    if (!newRow.workOrderId) {
        newRow.workOrderId = row['工單號碼'] || row['工服單號'];
    }

    if (newRow.workOrderId) {
        newRow.id = String(newRow.workOrderId);
        newRow.workOrderId = String(newRow.workOrderId);
    }

    newRow.testDetails = JSON.stringify(testDetails);
    
    // Ensure numeric fields
    const numericFields = ['testItemsCount', 'completedItemsCount', 'passCount', 'failCount', 'naCount', 'submissionOrder'];
    numericFields.forEach(f => newRow[f] = Number(newRow[f]) || 0);

    // Ensure strings
    const stringFields = ['productName', 'status', 'department', 'creator', 'labManager', 'estimatedCompletionDate', 'actualCompletionDate', 'priority', 'partNo', 'cost', 'auditTime', 'projectId'];
    stringFields.forEach(f => newRow[f] = newRow[f] ? String(newRow[f]) : '');

    return newRow;
}

async function runSync() {
    console.log(`[Sync] Triggered at ${new Date().toISOString()}`);
    
    const copied = await shadowCopy(SOURCE_FILE, TEMP_FILE);
    if (!copied) {
        console.error('[Sync] Shadow copy failed after retries. Aborting.');
        return;
    }

    try {
        const workbook = readFile(TEMP_FILE);
        const sheetName = workbook.SheetNames[0];
        const data = utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        const report = syncToDatabase(data);
        console.log(`[Sync] Finished. Report saved to ${REPORT_PATH}`);
    } catch (err) {
        console.error('[Sync] Error processing Excel:', err);
    }
}

// Ensure plm_data folder exists
if (!fs.existsSync(path.join(ROOT_DIR, 'plm_data'))) {
    fs.mkdirSync(path.join(ROOT_DIR, 'plm_data'));
}
if (!fs.existsSync(path.join(ROOT_DIR, 'tmp'))) {
    fs.mkdirSync(path.join(ROOT_DIR, 'tmp'));
}

console.log(`[Watcher] Monitoring ${SOURCE_FILE}...`);

// Initial sync if file exists
if (fs.existsSync(SOURCE_FILE)) {
    runSync();
}

let watchTimer = null;
fs.watch(path.dirname(SOURCE_FILE), (eventType, filename) => {
    if (filename === path.basename(SOURCE_FILE)) {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => {
            runSync();
        }, 1000); // 1s debounce
    }
});

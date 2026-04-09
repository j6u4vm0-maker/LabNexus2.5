'use server';

import db from './db';
import { initializeDatabase } from './sqlite-schema';
import type { Case, Equipment, Engineer, MaintenanceRecord, RoutineWork, RoutineWorkTask, ProjectNote } from './types';
import type { MachineSchedule, ProjectData, TestDetails } from './schedule-types';
import { format, isSameMonth, isSameYear, isWithinInterval, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isValid, startOfDay, endOfDay } from 'date-fns';
import { isWorkingDay, isProjectDelayed, safeParseDate } from './date-utils-server';
import { STATUS_CSS_VARS } from './constants';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// Ensure tables exist on every cold start
initializeDatabase();

// ============================================================
// Helpers
// ============================================================

function mapPriorityLabel(priority: string): string {
    switch (priority) {
        case 'CRITICAL': return '特急件';
        case 'HIGH': return '急件';
        default: return '一般件';
    }
}

function mapStatus(status: string): string {
    const mapping: Record<string, string> = {
        '進行中': '實驗中', '審核中': '實驗中', '已核准': '實驗中',
        '實驗中': '實驗中', '檢測中': '實驗中', '確認中': '實驗中', '計畫中': '實驗中',
        '已完成': '已完成', '已結案': '已完成', '待處置': '已完成', '已指派': '已完成',
        '已取消': '已取消',
    };
    return mapping[status] || status;
}

function safeDateStr(dateStr: string | undefined | null): string {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-CA').replace(/-/g, '/');
    } catch { return dateStr; }
}
function getLabManagerNameSync(): string {
    try {
        const manager = db.prepare(`SELECT name FROM engineers WHERE role = '實驗室主管' LIMIT 1`).get() as any;
        return manager ? manager.name : '實驗室主管';
    } catch {
        return '實驗室主管';
    }
}

function formatManagerDisplayName(name: string | undefined | null, primaryManager: string): string {
    if (!name || name.trim() === '' || name === '黃慧敏' || name === '實驗室主管' || name === '黃慧敏主管') {
        return primaryManager;
    }
    return name;
}

function rowToProjectData(row: any, managerName: string): ProjectData {
    let testDetails: TestDetails = {};
    try { testDetails = JSON.parse(row.testDetails || '{}'); } catch { }
    
    let status = mapStatus(row.status || '');
    const endDate = safeDateStr(row.actualCompletionDate);
    
    // Global Logic: If completion date exists, force "已完成" (unless it's "已取消")
    if (status !== '已取消' && endDate && endDate.trim() !== '') {
        status = '已完成';
    }

    return {
        id: row.id,
        bookingId: row.id,
        workOrderId: row.workOrderId || '',
        productName: row.productName || '',
        tester: formatManagerDisplayName(row.labManager, managerName),
        status,
        estimatedDate: safeDateStr(row.estimatedCompletionDate) || new Date().toLocaleDateString('en-CA').replace(/-/g, '/'),
        endDate,
        priority: mapPriorityLabel(row.priority || ''),
        creator: row.creator || '',
        department: row.department || '',
        partNo: row.partNo || '',
        testItemsCount: row.testItemsCount || 0,
        completedItemsCount: row.completedItemsCount || 0,
        passCount: row.passCount || 0,
        failCount: row.failCount || 0,
        naCount: row.naCount || 0,
        rejectionCount: row.rejectionCount || 0,
        cost: row.cost || '',
        auditTime: safeDateStr(row.auditTime),
        projectId: row.projectId || '',
        submissionOrder: row.submissionOrder || 0,
        testDetails,
        result: '',
        type: 'E01',
        name: row.productName || '',
    };
}

function rowToEquipment(row: any): Equipment {
    return {
        id: row.id,
        name: row.name || '',
        type: row.type || '',
        remark: row.remark || '',
        logo: row.logo || '',
        status: row.status || '正常',
        calibrationDate: row.calibrationDate || '',
        isMultiChannel: !!row.isMultiChannel,
    };
}

function rowToSchedule(row: any, managerName: string): MachineSchedule {
    return {
        id: row.id,
        bookingId: row.bookingId || '',
        date: row.date || '',
        equipmentId: row.equipmentId || '',
        equipmentName: row.equipmentName || '',
        workOrder: row.workOrder || '',
        productName: row.productName || '',
        client: row.client || '',
        notes: row.notes || '',
        tester: formatManagerDisplayName(row.tester, managerName),
        updatedAt: row.updatedAt || '',
    };
}

// Helper to remove a row from the source Excel file
function removeFromExcel(workOrderId: string) {
    if (!workOrderId) return;
    try {
        const filePath = path.join(process.cwd(), 'plm_data', 'project_list.xlsx');
        if (!fs.existsSync(filePath)) return;

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON to easily find and remove the record
        // We use { header: 1 } to keep everything including headers
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (rows.length < 1) return;

        const headers = rows[0];
        // Find columns that might hold the workOrderId
        const woColIndices = headers.map((h, i) => 
            (String(h).includes('工單') || String(h).includes('工服') || String(h).includes('單號')) ? i : -1
        ).filter(i => i !== -1);

        if (woColIndices.length === 0) {
            console.warn('[Excel Clean] Could not find work order column in Excel headers');
            return;
        }

        const initialCount = rows.length;
        const filteredRows = rows.filter((row, rowIndex) => {
            if (rowIndex === 0) return true; // Keep headers
            // Check if any of the identified WO columns match the ID
            return !woColIndices.some(idx => String(row[idx] || '').trim() === workOrderId.trim());
        });

        if (filteredRows.length < initialCount) {
            const newSheet = XLSX.utils.aoa_to_sheet(filteredRows);
            workbook.Sheets[sheetName] = newSheet;
            XLSX.writeFile(workbook, filePath);
            console.log(`[Excel Clean] Successfully removed ${workOrderId} from Excel. Rows: ${initialCount} -> ${filteredRows.length}`);
        }
    } catch (err) {
        console.error('[Excel Clean] Error modifying Excel:', err);
    }
}

// ============================================================
// 1. Migration: Firebase -> SQLite (ALL collections)
// ============================================================

export async function migrateToSQLiteAction(
    cases: Partial<Case>[],
    schedules: Partial<MachineSchedule>[],
    equipment: Equipment[],
    engineers: Engineer[] = [],
    notes: ProjectNote[] = [],
    maintenance: MaintenanceRecord[] = [],
    routineWork: RoutineWork[] = [],
    routineWorkTasks: RoutineWorkTask[] = [],
) {
    try {
        const insertCase = db.prepare(`
      INSERT OR REPLACE INTO cases (
        id, workOrderId, productName, status, department, creator, labManager,
        estimatedCompletionDate, actualCompletionDate, priority, createdAt, partNo,
        testItemsCount, completedItemsCount, passCount, failCount, naCount, rejectionCount,
        cost, auditTime, projectId, submissionOrder, testDetails
      ) VALUES (
        @id, @workOrderId, @productName, @status, @department, @creator, @labManager,
        @estimatedCompletionDate, @actualCompletionDate, @priority, @createdAt, @partNo,
        @testItemsCount, @completedItemsCount, @passCount, @failCount, @naCount, @rejectionCount,
        @cost, @auditTime, @projectId, @submissionOrder, @testDetails
      )`);

        const insertEquipment = db.prepare(`
      INSERT OR REPLACE INTO equipment (id, name, type, remark, logo, status, calibrationDate, isMultiChannel)
      VALUES (@id, @name, @type, @remark, @logo, @status, @calibrationDate, @isMultiChannel)`);

        const insertSchedule = db.prepare(`
      INSERT OR REPLACE INTO schedules (id, bookingId, date, equipmentId, equipmentName, workOrder, productName, tester, client, notes, updatedAt)
      VALUES (@id, @bookingId, @date, @equipmentId, @equipmentName, @workOrder, @productName, @tester, @client, @notes, @updatedAt)`);

        const insertEngineer = db.prepare(`
      INSERT OR REPLACE INTO engineers (id, name, role) VALUES (@id, @name, @role)`);

        const insertNote = db.prepare(`
      INSERT OR REPLACE INTO notes (id, workOrderId, note, author, createdAt)
      VALUES (@id, @workOrderId, @note, @author, @createdAt)`);

        const insertMaintenance = db.prepare(`
      INSERT OR REPLACE INTO maintenance (id, equipmentName, equipmentId, estimatedCompletionDate, engineerName, status)
      VALUES (@id, @equipmentName, @equipmentId, @estimatedCompletionDate, @engineerName, @status)`);

        const insertRoutineWork = db.prepare(`
      INSERT OR REPLACE INTO routine_work (id, yearMonth, taskCategory, engineerName)
      VALUES (@id, @yearMonth, @taskCategory, @engineerName)`);

        const insertRoutineWorkTask = db.prepare(`
      INSERT OR REPLACE INTO routine_work_tasks (id, name, "order")
      VALUES (@id, @name, @order)`);

        const migrateTx = db.transaction(() => {
            for (const eq of equipment) {
                insertEquipment.run({ id: eq.id, name: eq.name, type: eq.type || '', remark: eq.remark || '', logo: eq.logo || '', status: eq.status || '正常', calibrationDate: eq.calibrationDate || '', isMultiChannel: eq.isMultiChannel ? 1 : 0 });
            }
            for (const c of cases) {
                insertCase.run({
                    id: c.id, workOrderId: c.workOrderId || '', productName: c.productName || '', status: c.status || '',
                    department: c.department || '', creator: c.creator || '', labManager: c.labManager || '',
                    estimatedCompletionDate: c.estimatedCompletionDate || '', actualCompletionDate: c.actualCompletionDate || '',
                    priority: c.priority || 'MEDIUM', createdAt: c.createdAt || '', partNo: c.partNo || '',
                    testItemsCount: c.testItemsCount || 0, completedItemsCount: c.completedItemsCount || 0,
                    passCount: c.passCount || 0, failCount: c.failCount || 0, naCount: c.naCount || 0, rejectionCount: c.rejectionCount || 0,
                    cost: c.cost || '', auditTime: c.auditTime || '', projectId: c.projectId || '', submissionOrder: c.submissionOrder || 0,
                    testDetails: c.testDetails ? JSON.stringify(c.testDetails) : '{}',
                });
            }
            for (const s of schedules) {
                insertSchedule.run({ id: s.id, bookingId: s.bookingId || '', date: s.date || '', equipmentId: s.equipmentId || '', equipmentName: s.equipmentName || '', workOrder: s.workOrder || '', productName: s.productName || '', tester: s.tester || '', client: s.client || '', notes: s.notes || '', updatedAt: s.updatedAt || '' });
            }
            for (const e of engineers) {
                insertEngineer.run({ id: e.id, name: e.name, role: e.role || '測試者' });
            }
            for (const n of notes) {
                insertNote.run({ id: n.id, workOrderId: n.workOrderId, note: n.note || '', author: n.author || '', createdAt: n.createdAt || '' });
            }
            for (const m of maintenance) {
                insertMaintenance.run({ id: m.id, equipmentName: m.equipmentName, equipmentId: m.equipmentId, estimatedCompletionDate: m.estimatedCompletionDate, engineerName: m.engineerName, status: m.status });
            }
            for (const rw of routineWork) {
                insertRoutineWork.run({ id: rw.id, yearMonth: rw.yearMonth, taskCategory: rw.taskCategory, engineerName: rw.engineerName, engineerId: rw.engineerId || null });
            }
            for (const rwt of routineWorkTasks) {
                insertRoutineWorkTask.run({ id: rwt.id, name: rwt.name, order: rwt.order });
            }
        });

        migrateTx();

        const caseCount = (db.prepare(`SELECT COUNT(*) as count FROM cases`).get() as any).count;
        const scheduleCount = (db.prepare(`SELECT COUNT(*) as count FROM schedules`).get() as any).count;
        const engineerCount = (db.prepare(`SELECT COUNT(*) as count FROM engineers`).get() as any).count;
        revalidatePath('/');
        return { success: true, count: caseCount, scheduleCount, engineerCount };
    } catch (err: any) {
        console.error('Migration failed:', err);
        return { success: false, error: err.message };
    }
}

// ============================================================
// 1.1 Write Actions (Landing: Real-time Writes to SQLite)
// ============================================================

export async function saveCaseAction(c: Partial<Case>, isNew: boolean) {
    try {
        const id = c.id || `CASE-${Date.now()}`;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO cases (
                id, workOrderId, productName, status, department, creator, labManager,
                estimatedCompletionDate, actualCompletionDate, priority, createdAt, partNo,
                testItemsCount, completedItemsCount, passCount, failCount, naCount, rejectionCount,
                cost, auditTime, projectId, submissionOrder, testDetails
            ) VALUES (
                @id, @workOrderId, @productName, @status, @department, @creator, @labManager,
                @estimatedCompletionDate, @actualCompletionDate, @priority, @createdAt, @partNo,
                @testItemsCount, @completedItemsCount, @passCount, @failCount, @naCount, @rejectionCount,
                @cost, @auditTime, @projectId, @submissionOrder, @testDetails
            )`);

        stmt.run({
            id,
            workOrderId: c.workOrderId || '',
            productName: c.productName || '',
            status: c.status || '',
            department: c.department || '',
            creator: c.creator || '',
            labManager: c.labManager || '',
            estimatedCompletionDate: c.estimatedCompletionDate || '',
            actualCompletionDate: c.actualCompletionDate || '',
            priority: c.priority || 'MEDIUM',
            createdAt: c.createdAt || new Date().toISOString(),
            partNo: c.partNo || '',
            testItemsCount: c.testItemsCount || 0,
            completedItemsCount: c.completedItemsCount || 0,
            passCount: c.passCount || 0,
            failCount: c.failCount || 0,
            naCount: c.naCount || 0,
            rejectionCount: c.rejectionCount || 0,
            cost: c.cost || '',
            auditTime: c.auditTime || '',
            projectId: c.projectId || '',
            submissionOrder: c.submissionOrder || 0,
            testDetails: c.testDetails ? JSON.stringify(c.testDetails) : '{}',
        });

        revalidatePath('/');
        return { success: true, id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function importCasesAction(cases: Partial<Case>[]) {
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO cases (
                id, workOrderId, productName, status, department, creator, labManager,
                estimatedCompletionDate, actualCompletionDate, priority, createdAt, partNo,
                testItemsCount, completedItemsCount, passCount, failCount, naCount, rejectionCount,
                cost, auditTime, projectId, submissionOrder, testDetails
            ) VALUES (
                @id, @workOrderId, @productName, @status, @department, @creator, @labManager,
                @estimatedCompletionDate, @actualCompletionDate, @priority, @createdAt, @partNo,
                @testItemsCount, @completedItemsCount, @passCount, @failCount, @naCount, @rejectionCount,
                @cost, @auditTime, @projectId, @submissionOrder, @testDetails
            )`);

        const tx = db.transaction(() => {
            for (const c of cases) {
                if (!c.id) continue;
                stmt.run({
                    id: c.id,
                    workOrderId: c.workOrderId || '',
                    productName: c.productName || '',
                    status: c.status || '',
                    department: c.department || '',
                    creator: c.creator || '',
                    labManager: c.labManager || '',
                    estimatedCompletionDate: c.estimatedCompletionDate || '',
                    actualCompletionDate: c.actualCompletionDate || '',
                    priority: c.priority || 'MEDIUM',
                    createdAt: c.createdAt || new Date().toISOString(),
                    partNo: c.partNo || '',
                    testItemsCount: c.testItemsCount || 0,
                    completedItemsCount: c.completedItemsCount || 0,
                    passCount: c.passCount || 0,
                    failCount: c.failCount || 0,
                    naCount: c.naCount || 0,
                    rejectionCount: c.rejectionCount || 0,
                    cost: c.cost || '',
                    auditTime: c.auditTime || '',
                    projectId: c.projectId || '',
                    submissionOrder: c.submissionOrder || 0,
                    testDetails: c.testDetails ? JSON.stringify(c.testDetails) : '{}',
                });
            }
        });
        tx();
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function clearAllCasesAction(pageType: 'project' | 'maintenance') {
    try {
        if (pageType === 'maintenance') {
            db.prepare(`DELETE FROM maintenance`).run();
        } else {
            // Delete only non-maintenance cases from 'cases' table
            db.prepare(`DELETE FROM cases WHERE status NOT IN ('設備保養', '設備保養完成')`).run();
        }
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteCaseAction(id: string) {
    try {
        // Find the case first to get its workOrderId for Excel removal
        const row = db.prepare(`SELECT workOrderId FROM cases WHERE id = ?`).get(id) as any;
        if (row && row.workOrderId) {
            removeFromExcel(row.workOrderId);
        }

        db.prepare(`DELETE FROM cases WHERE id = ?`).run(id);
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function saveEquipmentAction(eq: Partial<Equipment>) {
    try {
        const id = eq.id || `EQ-${Date.now()}`;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO equipment (id, name, type, remark, logo, status, calibrationDate, isMultiChannel)
            VALUES (@id, @name, @type, @remark, @logo, @status, @calibrationDate, @isMultiChannel)`);

        stmt.run({
            id,
            name: eq.name || '',
            type: eq.type || '',
            remark: eq.remark || '',
            logo: eq.logo || '',
            status: eq.status || '正常',
            calibrationDate: eq.calibrationDate || '',
            isMultiChannel: eq.isMultiChannel ? 1 : 0
        });

        revalidatePath('/');
        return { success: true, id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function importEquipmentAction(equipments: Equipment[]) {
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO equipment (id, name, type, remark, logo, status, calibrationDate, isMultiChannel)
            VALUES (@id, @name, @type, @remark, @logo, @status, @calibrationDate, @isMultiChannel)`);

        const tx = db.transaction(() => {
            for (const eq of equipments) {
                stmt.run({
                    id: eq.id,
                    name: eq.name || '',
                    type: eq.type || '',
                    remark: eq.remark || '',
                    logo: eq.logo || '',
                    status: eq.status || '正常',
                    calibrationDate: eq.calibrationDate || '',
                    isMultiChannel: eq.isMultiChannel ? 1 : 0
                });
            }
        });
        tx();

        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteEquipmentAction(id: string) {
    try {
        db.prepare(`DELETE FROM equipment WHERE id = ?`).run(id);
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function saveMachineScheduleAction(s: Partial<MachineSchedule>, isNew: boolean) {
    try {
        const id = s.id || `SCHED-${Date.now()}`;
        const bookingId = s.bookingId || id;
        const updatedAt = new Date().toISOString();

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO schedules (id, bookingId, date, equipmentId, equipmentName, workOrder, productName, tester, client, notes, updatedAt)
            VALUES (@id, @bookingId, @date, @equipmentId, @equipmentName, @workOrder, @productName, @tester, @client, @notes, @updatedAt)`);

        stmt.run({
            id,
            bookingId,
            date: s.date || '',
            equipmentId: s.equipmentId || '',
            equipmentName: s.equipmentName || '',
            workOrder: s.workOrder || '',
            productName: s.productName || '',
            tester: s.tester || '',
            client: s.client || '',
            notes: s.notes || '',
            updatedAt
        });

        revalidatePath('/');
        return { success: true, id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteScheduleAction(id: string, isBookingId: boolean = false) {
    try {
        // Get workOrders associated with these schedules
        const woRows = isBookingId 
            ? db.prepare(`SELECT DISTINCT workOrder FROM schedules WHERE bookingId = ? OR id = ?`).all(id, id) as any[]
            : db.prepare(`SELECT DISTINCT workOrder FROM schedules WHERE id = ?`).all(id) as any[];

        if (isBookingId) {
            db.prepare(`DELETE FROM schedules WHERE bookingId = ? OR id = ?`).run(id, id);
        } else {
            db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id);
        }

        // IMPORTANT: The user said they want "complete deletion". 
        // If a schedule is deleted, we should also consider if the linked PROJECT row in Excel should be gone.
        // For now, if the item reappears, it's because the Case is re-imported.
        for (const r of woRows) {
            if (r.workOrder) {
                removeFromExcel(r.workOrder);
            }
        }

        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function saveEngineerAction(e: Partial<Engineer>) {
    try {
        const id = e.id || `ENG-${Date.now()}`;
        const stmt = db.prepare(`INSERT OR REPLACE INTO engineers (id, name, role) VALUES (@id, @name, @role)`);
        stmt.run({ id, name: e.name || '', role: e.role || '測試者' });
        revalidatePath('/');
        return { success: true, id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteEngineerAction(id: string) {
    try {
        db.prepare(`DELETE FROM engineers WHERE id = ?`).run(id);
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function overwriteEngineersAction(names: string[]) {
    try {
        const deleteStmt = db.prepare(`DELETE FROM engineers`);
        const insertStmt = db.prepare(`INSERT INTO engineers (id, name, role) VALUES (?, ?, ?)`);

        const tx = db.transaction(() => {
            deleteStmt.run();
            for (const name of names) {
                if (name && name.trim()) {
                    const role = name.includes('黃慧敏') ? '實驗室主管' : '測試者';
                    insertStmt.run(`ENG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, name.trim(), role);
                }
            }
        });
        tx();

        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function saveProjectNoteAction(n: Partial<ProjectNote>, isNew: boolean) {
    try {
        const id = n.id || `NOTE-${Date.now()}`;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO notes (id, workOrderId, note, author, createdAt)
            VALUES (@id, @workOrderId, @note, @author, @createdAt)`);
        stmt.run({
            id,
            workOrderId: n.workOrderId || '',
            note: n.note || '',
            author: n.author || '',
            createdAt: n.createdAt || new Date().toISOString()
        });
        revalidatePath('/');
        return { success: true, id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function importProjectNotesAction(notes: Partial<ProjectNote>[], defaultAuthor: string) {
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO notes (id, workOrderId, note, author, createdAt)
            VALUES (@id, @workOrderId, @note, @author, @createdAt)`);

        const tx = db.transaction(() => {
            for (const n of notes) {
                if (!n.workOrderId || !n.note) continue;
                const id = n.id || `NOTE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                stmt.run({
                    id,
                    workOrderId: n.workOrderId,
                    note: n.note,
                    author: n.author || defaultAuthor,
                    createdAt: n.createdAt || new Date().toISOString()
                });
            }
        });
        tx();

        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function saveMaintenanceRecordAction(m: Partial<MaintenanceRecord>, isNew: boolean) {
    try {
        const id = m.id || `MAINT-${Date.now()}`;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO maintenance (id, equipmentName, equipmentId, estimatedCompletionDate, engineerName, status)
            VALUES (@id, @equipmentName, @equipmentId, @estimatedCompletionDate, @engineerName, @status)`);

        stmt.run({
            id,
            equipmentName: m.equipmentName || '',
            equipmentId: m.equipmentId || '',
            estimatedCompletionDate: m.estimatedCompletionDate || '',
            engineerName: m.engineerName || '',
            status: m.status || '設備保養'
        });

        revalidatePath('/');
        return { success: true, id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteMaintenanceRecordAction(id: string) {
    try {
        db.prepare(`DELETE FROM maintenance WHERE id = ?`).run(id);
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function updateMaintenanceStatusAction(id: string, newStatus: string) {
    try {
        db.prepare(`UPDATE maintenance SET status = ? WHERE id = ?`).run(newStatus, id);
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function importMaintenanceRecordsAction(records: Partial<MaintenanceRecord>[]) {
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO maintenance (id, equipmentName, equipmentId, estimatedCompletionDate, engineerName, status)
            VALUES (@id, @equipmentName, @equipmentId, @estimatedCompletionDate, @engineerName, @status)`);

        const tx = db.transaction(() => {
            for (const m of records) {
                if (!m.equipmentName || !m.equipmentId) continue;
                const id = m.id || `MAINT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                stmt.run({
                    id,
                    equipmentName: m.equipmentName,
                    equipmentId: m.equipmentId,
                    estimatedCompletionDate: m.estimatedCompletionDate || '',
                    engineerName: m.engineerName || '',
                    status: m.status || '設備保養'
                });
            }
        });
        tx();

        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function importMachineSchedulesAction(records: Partial<MachineSchedule>[]) {
    try {
        const updatedAt = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO schedules (id, bookingId, date, equipmentId, equipmentName, workOrder, productName, tester, client, notes, updatedAt)
            VALUES (@id, @bookingId, @date, @equipmentId, @equipmentName, @workOrder, @productName, @tester, @client, @notes, @updatedAt)`);

        const tx = db.transaction(() => {
            for (const s of records) {
                if (!s.date || !s.equipmentId) continue;
                const id = s.id || `SCHED-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                const bookingId = s.bookingId || id;
                stmt.run({
                    id,
                    bookingId,
                    date: s.date,
                    equipmentId: s.equipmentId,
                    equipmentName: s.equipmentName || '',
                    workOrder: s.workOrder || '',
                    productName: s.productName || '',
                    tester: s.tester || '',
                    client: s.client || '',
                    notes: s.notes || '',
                    updatedAt
                });
            }
        });
        tx();

        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function batchSaveSchedulesAction(schedules: Omit<MachineSchedule, 'id' | 'bookingId'>[]) {
    try {
        const bookingId = `BOOK-${Date.now()}`;
        const updatedAt = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO schedules (id, bookingId, date, equipmentId, equipmentName, workOrder, productName, tester, client, notes, updatedAt)
            VALUES (@id, @bookingId, @date, @equipmentId, @equipmentName, @workOrder, @productName, @tester, @client, @notes, @updatedAt)`);

        const tx = db.transaction(() => {
            for (const s of schedules) {
                const id = `SCHED-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                stmt.run({
                    id,
                    bookingId,
                    date: s.date,
                    equipmentId: s.equipmentId,
                    equipmentName: s.equipmentName || '',
                    workOrder: s.workOrder || '',
                    productName: s.productName || '',
                    tester: s.tester || '',
                    client: s.client || '',
                    notes: s.notes || '',
                    updatedAt
                });
            }
        });
        tx();
        revalidatePath('/');
        return { success: true, bookingId };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function updateScheduleGroupAction(ids: string[], data: { workOrder: string; tester: string; notes: string }) {
    try {
        const stmt = db.prepare(`UPDATE schedules SET workOrder = ?, tester = ?, notes = ?, updatedAt = ? WHERE id = ?`);
        const updatedAt = new Date().toISOString();
        const tx = db.transaction(() => {
            for (const id of ids) {
                stmt.run(data.workOrder, data.tester, data.notes, updatedAt, id);
            }
        });
        tx();
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteSchedulesAction(ids: string[]) {
    try {
        const stmt = db.prepare(`DELETE FROM schedules WHERE id = ?`);
        const tx = db.transaction(() => {
            for (const id of ids) {
                stmt.run(id);
            }
        });
        tx();
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteProjectNoteAction(id: string) {
    try {
        db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function setRoutineWorkAction(yearMonth: string, taskCategory: string, engineerName: string | null, engineerId: string | null = null) {
    try {
        if (!engineerName && !engineerId) {
            db.prepare(`DELETE FROM routine_work WHERE yearMonth = ? AND taskCategory = ?`).run(yearMonth, taskCategory);
        } else {
            db.prepare(`INSERT OR REPLACE INTO routine_work (id, yearMonth, taskCategory, engineerName, engineerId) VALUES (?, ?, ?, ?, ?)`)
              .run(`${yearMonth}_${taskCategory}`, yearMonth, taskCategory, engineerName || '', engineerId);
        }
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function addRoutineWorkTaskAction(name: string, order: number) {
    try {
        const id = `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const stmt = db.prepare(`INSERT INTO routine_work_tasks (id, name, "order") VALUES (@id, @name, @order)`);
        stmt.run({ id, name, order });
        revalidatePath('/');
        return { success: true, id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteRoutineWorkTaskAction(id: string, name: string) {
    try {
        // Delete the task definition
        db.prepare(`DELETE FROM routine_work_tasks WHERE id = ?`).run(id);
        // Also delete assignments for this task category
        db.prepare(`DELETE FROM routine_work WHERE taskCategory = ?`).run(name);

        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function overwriteRoutineWorkTasksAction(tasks: { name: string, order: number }[]) {
    try {
        db.prepare(`DELETE FROM routine_work_tasks`).run();
        const stmt = db.prepare(`INSERT INTO routine_work_tasks (name, "order") VALUES (?, ?)`);
        const tx = db.transaction(() => {
            for (const t of tasks) {
                stmt.run(t.name, t.order);
            }
        });
        tx();
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function overwriteRoutineWorkForYearsAction(schedules: Omit<RoutineWork, 'id'>[], years: number[]) {
    try {
        const deleteStmt = db.prepare(`DELETE FROM routine_work WHERE yearMonth LIKE ?`);
        const insertStmt = db.prepare(`INSERT INTO routine_work (id, yearMonth, taskCategory, engineerName, engineerId) VALUES (?, ?, ?, ?, ?)`);

        const tx = db.transaction(() => {
            for (const year of years) {
                deleteStmt.run(`${year}-%`);
            }
            for (const s of schedules) {
                const id = `${s.yearMonth}_${s.taskCategory}`;
                insertStmt.run(id, s.yearMonth, s.taskCategory, s.engineerName, s.engineerId || null);
            }
        });
        tx();
        revalidatePath('/');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ============================================================
// 2. Dashboard
// ============================================================

export type DashboardStats = {
    currentYear: number; currentMonthLabel: string;
    yearlyTotal: number; yearlyDone: number;
    monthlyTotal: number; monthlyDone: number;
    weeklyTotal: number;
    urgentAndCriticalProjects: ProjectData[];
    delayedProjects: ProjectData[];
    dueThisWeekProjects: ProjectData[];
    upcomingMachineCases: { equipmentName: string; equipmentId: string; schedules: { workOrder: string; productName: string; partNo: string; client: string; tester: string; startDate: string; endDate: string }[] }[];
    statusGroups: { statuses: string[]; stats: { name: string; value: number; color: string; foregroundColor: string }[] }[];
    testerStats: { name: string; count: number }[];
    analysisMonthProjects: ProjectData[];
    topCategoriesNextWeek: { name: string; rate: number }[];
};

export async function getFullDashboardData(analysisDateStr: string): Promise<DashboardStats> {
    const analysisDate = new Date(analysisDateStr);
    const now = isValid(analysisDate) ? analysisDate : new Date();
    const TERMINAL_STATUSES = ['已完成', '已結案', '已取消', '設備保養', '設備保養完成'];
    const OPERATIONAL_EXCLUDE = ['設備保養', '設備保養完成'];
    const managerName = getLabManagerNameSync();

    const allRows = db.prepare(`SELECT * FROM cases`).all() as any[];
    const allProjects = allRows.map(row => rowToProjectData(row, managerName));
    const operationalProjects = allProjects.filter(p => !OPERATIONAL_EXCLUDE.includes(p.status));

    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const yearlyTotal = operationalProjects.filter(p => { const d = safeParseDate(p.estimatedDate); return d && isSameYear(d, now); }).length;
    const yearlyDone = operationalProjects.filter(p => { const d = safeParseDate(p.endDate); return d && isSameYear(d, now); }).length;
    const monthlyTotal = operationalProjects.filter(p => { const d = safeParseDate(p.estimatedDate); return d && isSameMonth(d, now); }).length;
    const monthlyDone = operationalProjects.filter(p => { const d = safeParseDate(p.endDate); return d && isSameMonth(d, now); }).length;
    const weeklyTotal = operationalProjects.filter(p => { const d = safeParseDate(p.estimatedDate); return d && isWithinInterval(d, { start: weekStart, end: weekEnd }); }).length;

    const unfinishedProjects = operationalProjects.filter(p => !TERMINAL_STATUSES.includes(p.status));
    const delayedProjects = unfinishedProjects.filter(p => isProjectDelayed(p, now));
    const urgentAndCriticalProjects = unfinishedProjects.filter(p => p.priority === '特急件' || p.priority === '急件');
    const dueThisWeekProjects = unfinishedProjects.filter(p => { const d = safeParseDate(p.estimatedDate); return d ? isWithinInterval(d, { start: weekStart, end: weekEnd }) : false; });

    // 計算未來 3 個工作天內的預計投入案件
    function addWorkingDays(fromDate: Date, days: number): Date {
        let result = new Date(fromDate);
        let added = 0;
        while (added < days) {
            result = addDays(result, 1);
            const day = result.getDay();
            if (day !== 0 && day !== 6) added++;
        }
        return result;
    }
    // 找出「期間第一天」落在未來 3 個工作天內的機台排程（代表將起開始测試）
    const wdDeadline3 = addWorkingDays(now, 3);
    const upcomingScheduleRows = db.prepare(`
        SELECT s.equipmentId, s.equipmentName, s.workOrder, s.productName, s.client, s.tester,
               MIN(s.date) AS startDate,
               MAX(s.date) AS endDate,
               c.partNo
        FROM schedules s
        LEFT JOIN cases c ON c.workOrderId = s.workOrder
        WHERE s.date >= ? AND s.date <= ?
        AND NOT EXISTS (
            SELECT 1 FROM schedules s2 
            WHERE s2.equipmentId = s.equipmentId 
            AND s2.workOrder = s.workOrder 
            AND s2.productName = s.productName 
            AND s2.date = ? -- No record on the current 'today'
        )
        GROUP BY s.equipmentId, s.workOrder, s.productName
        ORDER BY s.equipmentId, startDate
    `).all(format(now, 'yyyy-MM-dd'), format(wdDeadline3, 'yyyy-MM-dd'), format(now, 'yyyy-MM-dd')) as any[];

    // Group by equipment
    const equipmentMap = new Map<string, { equipmentName: string; equipmentId: string; schedules: any[] }>();
    for (const row of upcomingScheduleRows) {
        if (!equipmentMap.has(row.equipmentId)) {
            equipmentMap.set(row.equipmentId, { equipmentId: row.equipmentId, equipmentName: row.equipmentName, schedules: [] });
        }
        equipmentMap.get(row.equipmentId)!.schedules.push({
            workOrder: row.workOrder,
            productName: row.productName,
            partNo: row.partNo || '',
            client: row.client,
            tester: row.tester,
            startDate: row.startDate,
            endDate: row.endDate,
        });
    }
    const upcomingMachineCases = Array.from(equipmentMap.values());

    // 混合計算邏輯：
    // - 實驗中/延遲中（進行中）：年度累積，全部計入
    // - 已完成：僅計「所選月份」完成的案件
    // - 已取消：僅計「所選月份」取消的案件
    const analysisMonthProjects = operationalProjects.filter(p => {
        if (p.status === '已完成') {
            const d = safeParseDate(p.endDate || '');
            return d && isSameMonth(d, now);
        }
        if (p.status === '已取消') {
            const d = safeParseDate(p.endDate || '');
            return d && isSameMonth(d, now);
        }
        // 實驗中/延遲中：所有尚未完成的案件全部累積計入（不限日期）
        return true;
    });
    const projectsWithComputedStatus = analysisMonthProjects.map(p => {
        if (TERMINAL_STATUSES.includes(p.status)) return p;
        if (isProjectDelayed(p, now)) return { ...p, status: '延遲中' };
        return p;
    });
    const statusCounts = projectsWithComputedStatus.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    const statusGroups = [{ statuses: ['已取消'] }, { statuses: ['實驗中'] }, { statuses: ['延遲中'] }, { statuses: ['已完成'] }].map(group => ({
        ...group,
        stats: group.statuses.map(statusName => {
            const cssVar = STATUS_CSS_VARS[statusName as keyof typeof STATUS_CSS_VARS];
            return { name: statusName, value: statusCounts[statusName] || 0, color: cssVar ? `hsl(var(${cssVar}))` : 'hsl(var(--muted))', foregroundColor: cssVar ? `hsl(var(${cssVar}-foreground))` : 'hsl(var(--muted-foreground))' };
        }),
    }));
    const testerStats = Array.from(new Set(unfinishedProjects.map(p => p.tester).filter(t => t && t !== '未指派'))).map(t => ({ name: t, count: unfinishedProjects.filter(p => p.tester === t).length })).sort((a, b) => b.count - a.count);

    const today = new Date();
    const weekEnd7 = addDays(today, 6);
    const equipmentRows = db.prepare(`SELECT id, name, type, status, calibrationDate FROM equipment`).all() as any[];
    const scheduleRows = db.prepare(`SELECT equipmentId, date FROM schedules WHERE date >= ? AND date <= ?`).all(format(today, 'yyyy-MM-dd'), format(weekEnd7, 'yyyy-MM-dd')) as any[];
    const scheduledSet = new Set(scheduleRows.map((s: any) => `${s.equipmentId}::${s.date}`));
    const intervalDays = eachDayOfInterval({ start: today, end: weekEnd7 });
    const workingDaysCount = intervalDays.filter(d => isWorkingDay(d)).length;
    let topCategoriesNextWeek: { name: string; rate: number }[] = [];
    if (workingDaysCount > 0 && equipmentRows.length > 0) {
        const categoryData = new Map<string, { totalRate: number; count: number }>();
        for (const eq of equipmentRows) {
            let usedDays = 0;
            for (const day of intervalDays) {
                if (isWorkingDay(day)) {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    if (scheduledSet.has(`${eq.id}::${dayStr}`) || eq.status === '維修' || eq.status === '校正' || eq.calibrationDate === dayStr) usedDays++;
                }
            }
            const rate = Math.min(100, (usedDays / workingDaysCount) * 100);
            const cat = eq.type || '未分類';
            const existing = categoryData.get(cat) || { totalRate: 0, count: 0 };
            categoryData.set(cat, { totalRate: existing.totalRate + rate, count: existing.count + 1 });
        }
        topCategoriesNextWeek = Array.from(categoryData.entries()).map(([name, data]) => ({ name, rate: data.count > 0 ? data.totalRate / data.count : 0 })).sort((a, b) => b.rate - a.rate).slice(0, 5);
    }

    return { currentYear: now.getFullYear(), currentMonthLabel: format(now, 'MM'), yearlyTotal, yearlyDone, monthlyTotal, monthlyDone, weeklyTotal, urgentAndCriticalProjects, delayedProjects, dueThisWeekProjects, upcomingMachineCases, statusGroups, testerStats, analysisMonthProjects: projectsWithComputedStatus, topCategoriesNextWeek };
}

// ============================================================
// 3. Project List & Cases
// ============================================================

export type ProjectListData = {
    projects: ProjectData[];
    engineers: Engineer[];
    notes: ProjectNote[];
};

export async function getProjectListData(limit?: number): Promise<ProjectListData> {
    const casesQuery = limit
        ? `SELECT * FROM cases WHERE status NOT IN ('設備保養','設備保養完成') ORDER BY workOrderId DESC LIMIT ${limit}`
        : `SELECT * FROM cases WHERE status NOT IN ('設備保養','設備保養完成') ORDER BY workOrderId DESC`;
    const caseRows = db.prepare(casesQuery).all() as any[];
    const managerName = getLabManagerNameSync();
    const projects = caseRows.map(row => rowToProjectData(row, managerName));
    const engineers = db.prepare(`SELECT * FROM engineers ORDER BY name`).all() as Engineer[];
    const notes = db.prepare(`SELECT * FROM notes ORDER BY createdAt DESC`).all() as ProjectNote[];
    return { projects, engineers, notes };
}

// ============================================================
// 4. Schedule (Calendar)
// ============================================================

export type SchedulePageData = {
    projects: ProjectData[];
    maintenanceProjects: ProjectData[];
    machineScheduleProjects: ProjectData[];
    engineers: Engineer[];
    schedules: MachineSchedule[];
};

export async function getSchedulePageData(): Promise<SchedulePageData> {
    const caseRows = db.prepare(`SELECT * FROM cases WHERE status NOT IN ('設備保養','設備保養完成')`).all() as any[];
    const managerName = getLabManagerNameSync();
    const projects = caseRows.map(row => rowToProjectData(row, managerName));

    // Attach notes to projects
    const notesRows = db.prepare(`SELECT * FROM notes ORDER BY createdAt DESC`).all() as any[];
    projects.forEach(p => {
        const pNotes = notesRows.filter(n => n.workOrderId === p.workOrderId);
        if (pNotes.length > 0) {
            p.notes = pNotes.map(n => n.note).join('\n---\n');
        }
    });

    const maintenanceRows = db.prepare(`SELECT * FROM maintenance`).all() as any[];
    const maintenanceProjects: ProjectData[] = maintenanceRows.map((m: any) => ({
        id: m.id, bookingId: m.id, productName: m.equipmentName || '', tester: formatManagerDisplayName(m.engineerName, managerName),
        status: m.status || '設備保養', estimatedDate: safeDateStr(m.estimatedCompletionDate) || '', priority: '一般件',
        testDetails: {}, name: m.equipmentName || '', partNo: m.equipmentId || '',
    }));

    const scheduleRows = db.prepare(`SELECT * FROM schedules ORDER BY date`).all() as any[];
    const machineScheduleProjects: ProjectData[] = scheduleRows.map((s: any) => ({
        id: s.id, bookingId: s.bookingId || s.id, productName: s.productName || '未指定品名', workOrderId: s.workOrder,
        tester: formatManagerDisplayName(s.tester, managerName), status: '機台預約', estimatedDate: s.date.replace(/-/g, '/'), priority: '一般件',
        testDetails: {}, name: `[機台預約] ${s.equipmentName}`, partNo: s.equipmentId, creator: s.client,
    }));

    const engineers = db.prepare(`SELECT * FROM engineers ORDER BY name`).all() as Engineer[];
    const schedules = scheduleRows.map(row => rowToSchedule(row, managerName));

    return { projects, maintenanceProjects, machineScheduleProjects, engineers, schedules };
}

// ============================================================
// 5. Equipment Schedule
// ============================================================

export type EquipmentScheduleData = {
    schedules: MachineSchedule[];
    equipments: Equipment[];
    cases: ProjectData[];
};

export async function getEquipmentScheduleData(): Promise<EquipmentScheduleData> {
    const scheduleRows = db.prepare(`SELECT * FROM schedules ORDER BY date`).all() as any[];
    const managerName = getLabManagerNameSync();
    const schedules = scheduleRows.map(row => rowToSchedule(row, managerName));
    const equipmentRows = db.prepare(`SELECT * FROM equipment`).all() as any[];
    const equipments = equipmentRows.map(rowToEquipment);
    const caseRows = db.prepare(`SELECT * FROM cases`).all() as any[];
    const cases = caseRows.map(row => rowToProjectData(row, managerName));
    return { schedules, equipments, cases };
}

// ============================================================
// 6. Equipment Monitoring
// ============================================================

export type EquipmentMonitoringData = {
    schedules: MachineSchedule[];
    equipments: Equipment[];
};

export async function getEquipmentMonitoringData(): Promise<EquipmentMonitoringData> {
    const scheduleRows = db.prepare(`SELECT * FROM schedules ORDER BY date`).all() as any[];
    const managerName = getLabManagerNameSync();
    const schedules = scheduleRows.map(row => rowToSchedule(row, managerName));
    const equipmentRows = db.prepare(`SELECT * FROM equipment`).all() as any[];
    const equipments = equipmentRows.map(rowToEquipment);
    return { schedules, equipments };
}

// ============================================================
// 7. Equipment Management
// ============================================================

export async function getEquipmentData(): Promise<Equipment[]> {
    const rows = db.prepare(`SELECT * FROM equipment ORDER BY name`).all() as any[];
    return rows.map(rowToEquipment);
}

// ============================================================
// 8. Personal Dashboard
// ============================================================

export type PersonalDashboardData = {
    projects: ProjectData[];
    schedules: MachineSchedule[];
    engineers: Engineer[];
    maintenanceProjects: ProjectData[];
    machineScheduleProjects: ProjectData[];
    schedulePageProjects: ProjectData[];
};

export async function getPersonalDashboardData(): Promise<PersonalDashboardData> {
    const caseRows = db.prepare(`SELECT * FROM cases`).all() as any[];
    const managerName = getLabManagerNameSync();
    const projects = caseRows.map(row => rowToProjectData(row, managerName));

    const scheduleRows = db.prepare(`SELECT * FROM schedules ORDER BY date`).all() as any[];
    const schedules = scheduleRows.map(row => rowToSchedule(row, managerName));

    const engineers = db.prepare(`SELECT * FROM engineers ORDER BY name`).all() as Engineer[];

    const maintenanceRows = db.prepare(`SELECT * FROM maintenance`).all() as any[];
    const maintenanceProjects: ProjectData[] = maintenanceRows.map((m: any) => ({
        id: m.id, bookingId: m.id, productName: m.equipmentName || '', tester: formatManagerDisplayName(m.engineerName, managerName),
        status: m.status || '設備保養', estimatedDate: safeDateStr(m.estimatedCompletionDate) || '', priority: '一般件',
        testDetails: {}, name: m.equipmentName || '', partNo: m.equipmentId || '',
    }));

    const machineScheduleProjects: ProjectData[] = scheduleRows.map((s: any) => ({
        id: s.id, bookingId: s.bookingId || s.id, productName: s.productName || '未指定品名', workOrderId: s.workOrder,
        tester: formatManagerDisplayName(s.tester, managerName), status: '機台預約', estimatedDate: s.date.replace(/-/g, '/'), priority: '一般件',
        testDetails: {}, name: `[機台預約] ${s.equipmentName}`, partNo: s.equipmentId, creator: s.client,
    }));

    // schedulePageProjects is basically filtered projects (no maintenance jobs)
    const schedulePageProjects = projects.filter(p => p.status !== '設備保養' && p.status !== '設備保養完成');

    return {
        projects,
        schedules,
        engineers,
        maintenanceProjects,
        machineScheduleProjects,
        schedulePageProjects
    };
}

// ============================================================
// 9. Pending Schedules
// ============================================================

export type ActiveCaseForMatch = {
    workOrderId: string;
    productName: string;
    partNo: string;
    creator: string;
    labManager: string;
};

export type PendingSchedulesData = {
    schedules: MachineSchedule[];
    equipments: Equipment[];
    activeCases: ActiveCaseForMatch[];
};

export async function getPendingSchedulesData(): Promise<PendingSchedulesData> {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    // 回傳所有無工單排程（含過去日期），由前端分組後依 startDate 篩選
    // 理由：若直接過濾 date > today，跨天排程（如 4/4-4/15）的 startDate 會被誤判為未來
    const scheduleRows = db.prepare(`
        SELECT * FROM schedules
        WHERE (workOrder IS NULL OR workOrder = '')
        ORDER BY date ASC
    `).all() as any[];
    const managerName = getLabManagerNameSync();
    const schedules = scheduleRows.map(row => rowToSchedule(row, managerName));

    const equipmentRows = db.prepare(`SELECT * FROM equipment`).all() as any[];
    const equipments = equipmentRows.map(rowToEquipment);

    // 取出實驗中案件供前端自動配對
    const TERMINAL = ['已完成', '已結案', '已取消', '設備保養', '設備保養完成'];
    const caseRows = db.prepare(`
        SELECT workOrderId, productName, partNo, creator, labManager FROM cases
        WHERE status NOT IN ('${TERMINAL.join("','")}') AND (workOrderId IS NOT NULL AND workOrderId != '')
    `).all() as any[];
    const activeCases: ActiveCaseForMatch[] = caseRows.map(r => ({
        workOrderId: r.workOrderId || '',
        productName: r.productName || '',
        partNo: r.partNo || '',
        creator: r.creator || '',
        labManager: r.labManager || '',
    }));

    return { schedules, equipments, activeCases };
}

// ============================================================
// 10. KPI Report
// ============================================================

export async function getKpiReportData(): Promise<ProjectData[]> {
    const rows = db.prepare(`SELECT * FROM cases ORDER BY estimatedCompletionDate DESC`).all() as any[];
    const managerName = getLabManagerNameSync();
    return rows.map(row => rowToProjectData(row, managerName));
}

// ============================================================
// 11. Routine Work
// ============================================================

export type RoutineWorkData = {
    schedules: RoutineWork[];
    engineers: Engineer[];
    tasks: RoutineWorkTask[];
};

export async function getRoutineWorkData(): Promise<RoutineWorkData> {
    const schedules = db.prepare(`SELECT * FROM routine_work`).all() as RoutineWork[];
    const engineers = db.prepare(`SELECT * FROM engineers ORDER BY name`).all() as Engineer[];
    const tasks = db.prepare(`SELECT * FROM routine_work_tasks ORDER BY "order" ASC`).all() as RoutineWorkTask[];
    return { schedules, engineers, tasks };
}

export async function getMaintenanceData(): Promise<MaintenanceRecord[]> {
    return db.prepare(`SELECT * FROM maintenance ORDER BY estimatedCompletionDate DESC`).all() as MaintenanceRecord[];
}

// ============================================================
// 12. Engineers
// ============================================================

export async function getEngineersData(): Promise<Engineer[]> {
    return db.prepare(`SELECT id, name, role FROM engineers ORDER BY name`).all() as Engineer[];
}

// ============================================================
// 13. Notes
// ============================================================

export type NotesData = {
    notes: ProjectNote[];
    cases: Case[];
};

export async function getNotesData(): Promise<NotesData> {
    const noteRows = db.prepare(`SELECT * FROM notes ORDER BY createdAt DESC`).all() as ProjectNote[];
    const caseRows = db.prepare(`SELECT * FROM cases`).all() as any[];
    // Cast to Case[] - the schema matches or is a subset
    const cases = caseRows.map(row => ({
        ...row,
        testDetails: row.testDetails ? JSON.parse(row.testDetails) : {}
    })) as Case[];
    return { notes: noteRows, cases };
}

// ============================================================
// 14. Schedule Database (read all schedules)
// ============================================================

export async function getScheduleDatabaseData(): Promise<MachineSchedule[]> {
    const rows = db.prepare(`SELECT * FROM schedules ORDER BY date DESC`).all() as any[];
    const managerName = getLabManagerNameSync();
    return rows.map(row => rowToSchedule(row, managerName));
}

// ============================================================
// Legacy: raw fetch (kept for other uses)
// ============================================================

export async function fetchRawDataFromSQLite() {
    const cases = (db.prepare(`SELECT * FROM cases`).all() as any[]).map(c => ({ ...c, testDetails: c.testDetails ? JSON.parse(c.testDetails) : {} }));
    const equipment = db.prepare(`SELECT * FROM equipment`).all();
    const schedules = db.prepare(`SELECT * FROM schedules`).all();
    return { cases, equipment, schedules };
}

const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import db from '../src/lib/db';
import { initializeDatabase } from '../src/lib/sqlite-schema';
import { firebaseConfig } from '../src/firebase/config';

// mock decodeFirestoreId
const decodeFirestoreId = (id: string) => decodeURIComponent(id);

async function migrate() {
    console.log("Initializing Firebase...");
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);

    console.log("Ensuring SQLite schema...");
    initializeDatabase();

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
      )
    `);

    const insertEquipment = db.prepare(`
      INSERT OR REPLACE INTO equipment (
        id, name, type, remark, logo, status, calibrationDate, isMultiChannel
      ) VALUES (
        @id, @name, @type, @remark, @logo, @status, @calibrationDate, @isMultiChannel
      )
    `);

    const insertSchedule = db.prepare(`
        INSERT OR REPLACE INTO schedules (
            id, bookingId, date, equipmentId, equipmentName, workOrder, productName, tester, client, notes, updatedAt
        ) VALUES (
            @id, @bookingId, @date, @equipmentId, @equipmentName, @workOrder, @productName, @tester, @client, @notes, @updatedAt
        )
    `);

    console.log("Fetching Equipments...");
    const eqSnap = await getDocs(collection(firestore, "equipment"));
    const equipments: any[] = [];
    eqSnap.forEach(doc => { equipments.push({...doc.data(), id: decodeFirestoreId(doc.id)}); });
    console.log(`Fetched ${equipments.length} equipments.`);

    console.log("Fetching Schedules...");
    const scSnap = await getDocs(collection(firestore, "schedules"));
    const schedules: any[] = [];
    scSnap.forEach(doc => { schedules.push({...doc.data(), id: doc.id}); });
    console.log(`Fetched ${schedules.length} schedules.`);

    console.log("Fetching Cases...");
    const casesSnap = await getDocs(collection(firestore, "cases"));
    const cases: any[] = [];
    casesSnap.forEach(doc => { cases.push({...doc.data(), id: doc.id}); });
    console.log(`Fetched ${cases.length} cases.`);

    const migrateTx = db.transaction(() => {
        for (const eq of equipments) {
            insertEquipment.run({
                id: eq.id, name: eq.name, type: eq.type || '', remark: eq.remark || '', logo: eq.logo || '',
                status: eq.status || '正常', calibrationDate: eq.calibrationDate || '', isMultiChannel: eq.isMultiChannel ? 1 : 0
            });
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
                testDetails: c.testDetails ? JSON.stringify(c.testDetails) : '{}'
            });
        }
        for (const s of schedules) {
            insertSchedule.run({
                id: s.id, bookingId: s.bookingId || '', date: s.date || '', equipmentId: s.equipmentId || '', equipmentName: s.equipmentName || '',
                workOrder: s.workOrder || '', productName: s.productName || '', tester: s.tester || '', client: s.client || '',
                notes: s.notes || '', updatedAt: s.updatedAt || ''
            });
        }
    });

    console.log("Writing to SQLite db...");
    migrateTx();
    console.log("Migration complete!");
    process.exit(0);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});

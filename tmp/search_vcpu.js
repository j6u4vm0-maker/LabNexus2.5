const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const machines = db.prepare("SELECT id, name FROM equipment WHERE name LIKE '%衝擊%'").all();
console.log('--- Related Machines ---');
machines.forEach(m => console.log(`${m.id}: ${m.name}`));

const queryVCPU = `
    SELECT equipmentId, equipmentName, workOrder, productName, date
    FROM schedules
    WHERE (workOrder LIKE '%VCPU%' OR productName LIKE '%VCPU%')
    AND date >= '2026-03-29'
    ORDER BY date ASC
`;
const vcpuRows = db.prepare(queryVCPU).all();
console.log('\n--- VCPU Schedules ---');
vcpuRows.forEach(r => console.log(`[${r.date}] Machine: ${r.equipmentName} (${r.equipmentId}) | WO: ${r.workOrder}`));

db.close();

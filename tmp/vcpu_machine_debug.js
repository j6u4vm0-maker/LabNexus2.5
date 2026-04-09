const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT id, equipmentId, equipmentName, workOrder, productName, date, tester
    FROM schedules
    WHERE productName LIKE '%VCPU%' 
    AND date >= '2026-03-29'
    ORDER BY date ASC
`;

const rows = db.prepare(query).all();
console.log('--- VCPU Future Schedules ---');
rows.forEach(r => {
    console.log(`[${r.date}] Machine: ${r.equipmentName} (${r.equipmentId}) | WO: ${r.workOrder}`);
});

db.close();

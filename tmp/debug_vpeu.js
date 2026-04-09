const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT id, equipmentId, equipmentName, workOrder, productName, date, tester
    FROM schedules
    WHERE workOrder LIKE '%VCPU%' OR productName LIKE '%VCPU%'
    ORDER BY date ASC
`;

const rows = db.prepare(query).all();
console.log('--- VCPU Schedule Entries ---');
rows.forEach(r => {
    console.log(`[${r.date}] ${r.equipmentName} (${r.equipmentId}) | WorkOrder: "${r.workOrder}" | Product: "${r.productName}"`);
});
db.close();

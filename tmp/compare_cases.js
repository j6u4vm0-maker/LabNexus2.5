const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT equipmentId, equipmentName, workOrder, productName, date
    FROM schedules
    WHERE (productName LIKE '%VCPU%' OR productName LIKE '%VCCICA%')
    AND date >= '2026-03-29'
    ORDER BY equipmentId, date
`;

const rows = db.prepare(query).all();
console.log('--- Case Comparison ---');
rows.forEach(r => {
    console.log(`[${r.date}] EQ: ${r.equipmentName} (${r.equipmentId}) | WO: <${r.workOrder}> PN: <${r.productName}>`);
});

db.close();

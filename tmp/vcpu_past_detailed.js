const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT id, date, equipmentId, equipmentName, workOrder, productName
    FROM schedules 
    WHERE (productName LIKE '%VCPU%')
    AND date < '2026-03-30'
    ORDER BY date ASC
`;

const rows = db.prepare(query).all();
console.log(`--- VCPU Past Records ---`);
rows.forEach(r => {
    console.log(`[${r.date}] Machine: ${r.equipmentName} (${r.equipmentId}) | PN: [${r.productName}]`);
});

db.close();

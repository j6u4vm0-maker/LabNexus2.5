const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT id, date, equipmentId, equipmentName, workOrder, productName
    FROM schedules 
    WHERE (productName LIKE '%VCPU%')
    ORDER BY date ASC
`;

const rows = db.prepare(query).all();
console.log(`--- VCPU All Machine Analysis ---`);
rows.forEach(r => {
    console.log(`[${r.date}] ID: ${r.id} | Machine: ${r.equipmentName} (${r.equipmentId}) | PN: [${r.productName}]`);
});

db.close();

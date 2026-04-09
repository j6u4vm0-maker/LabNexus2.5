const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT date, equipmentId, equipmentName, workOrder, productName
    FROM schedules 
    WHERE (productName LIKE '%VCPU%' OR workOrder LIKE '%VCPU%')
    ORDER BY date ASC, equipmentId
`;

const rows = db.prepare(query).all();
console.log(`Found ${rows.length} total rows matching VCPU.`);
rows.forEach(r => {
    console.log(`Date: ${r.date} | Machine: ${r.equipmentName} (${r.equipmentId}) | PN: [${r.productName}]`);
});

db.close();

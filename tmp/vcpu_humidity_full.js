const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT id, date, equipmentId, equipmentName, workOrder, productName, client, tester, notes
    FROM schedules
    WHERE equipmentId = 'S200-05外-043' 
    AND (productName LIKE '%VCPU%' OR workOrder LIKE '%VCPU%')
    ORDER BY date ASC
`;

const rows = db.prepare(query).all();
console.log(`--- VCPU on Humidity Machine ---`);
rows.forEach(r => {
    console.log(`[${r.date}] WO: <${r.workOrder}> PN: <${r.productName}> CL: <${r.client}> TS: <${r.tester}> Notes: <${r.notes}>`);
});

db.close();

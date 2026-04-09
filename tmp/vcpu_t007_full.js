const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT id, date, equipmentId, equipmentName, workOrder, productName, client, tester, notes
    FROM schedules
    WHERE equipmentId = 'T000-05外-007' 
    AND (productName LIKE '%VCPU%' OR workOrder LIKE '%VCPU%')
    ORDER BY date ASC
`;

const rows = db.prepare(query).all();
console.log(`--- VCPU on T000-05外-007 ---`);
rows.forEach(r => {
    console.log(`[${r.date}] WO: <${r.workOrder}> PN: <${r.productName}> CL: <${r.client}> TS: <${r.tester}> Notes: <${r.notes}>`);
});

db.close();

const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT id, date, workOrder, productName, client, tester
    FROM schedules
    WHERE equipmentId = 'S200-05外-152' AND date = '2026-03-31'
`;

const rows = db.prepare(query).all();
console.log(`Rows on Mar 31: ${rows.length}`);
rows.forEach((r, i) => {
    console.log(`${i+1}. ID: ${r.id} | WO: [${r.workOrder}] | PN: [${r.productName}] | Tester: [${r.tester}]`);
});

db.close();

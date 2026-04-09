const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT workOrder, productName, client, tester, MIN(date) as start
    FROM schedules
    WHERE equipmentId = 'S200-05外-152' AND date >= '2026-03-31'
    GROUP BY workOrder, productName, client, tester
`;

const rows = db.prepare(query).all();
console.log(`Groups on Shock Machine (Granular):`);
rows.forEach((r, i) => {
    console.log(`${i+1}. WO:[${r.workOrder}] PN:[${r.productName}] CL:[${r.client}] TS:[${r.tester}] Start: ${r.start}`);
});
db.close();

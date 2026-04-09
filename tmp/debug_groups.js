const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT workOrder, productName, client, MIN(date) as start, MAX(date) as end
    FROM schedules
    WHERE equipmentId = 'S200-05外-152'
    GROUP BY workOrder, productName
    HAVING start >= '2026-03-29' AND start <= '2026-04-01'
`;

const rows = db.prepare(query).all();
console.log(`Found ${rows.length} groups.`);
rows.forEach((r, i) => {
    console.log(`${i+1}. WO: [${r.workOrder}] PN: [${r.productName}] Client: [${r.client}] Period: ${r.start} to ${r.end}`);
});
db.close();

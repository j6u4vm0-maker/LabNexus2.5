const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const now = '2026-03-29'; // Sunday
const wdDeadline3 = '2026-04-01'; // Wed

const query = `
    SELECT s.equipmentId, s.equipmentName, s.workOrder, s.productName, s.client, s.tester,
           MIN(s.date) AS startDate,
           MAX(s.date) AS endDate
    FROM schedules s
    GROUP BY s.equipmentId, s.workOrder, s.productName
    HAVING MIN(s.date) >= ? AND MIN(s.date) <= ?
    ORDER BY s.equipmentId, startDate
`;

const rows = db.prepare(query).all(now, wdDeadline3);
console.log(`Groups found: ${rows.length}`);
rows.forEach((r, i) => {
    console.log(`${i+1}. [${r.startDate}] EQ: ${r.equipmentName} (${r.equipmentId}) | WO: [${r.workOrder}] PN: [${r.productName}]`);
});
db.close();

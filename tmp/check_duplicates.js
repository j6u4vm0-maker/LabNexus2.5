const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT date, workOrder, productName, client, tester, COUNT(*) as rowCount
    FROM schedules
    WHERE equipmentId = 'S200-05外-152' AND date >= '2026-03-31'
    GROUP BY date, workOrder, productName, client, tester
    HAVING rowCount > 1
`;

const duplicates = db.prepare(query).all();
console.log(`Duplicate rows per day:`);
duplicates.forEach(d => {
    console.log(`Date: ${d.date} | WO:[${d.workOrder}] | PN:[${d.productName}] | Count: ${d.rowCount}`);
});

if (duplicates.length === 0) {
    console.log('No exact duplicates for the same day found.');
}
db.close();

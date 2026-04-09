const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const rows = db.prepare(`
    SELECT * FROM schedules 
    WHERE productName LIKE '%VCPU%' 
    AND equipmentId = 'S200-05外-043' 
    AND date < '2026-03-30'
`).all();

console.log(`Found ${rows.length} rows before March 30th.`);
rows.forEach(r => console.log(`Date: ${r.date} PN: ${r.productName}`));

db.close();

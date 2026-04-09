const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const rows = db.prepare("SELECT * FROM schedules WHERE equipmentId = 'S200-05外-152' AND date = '2026-03-30'").all();
console.log(`Rows on Mar 30: ${rows.length}`);
rows.forEach(r => console.log(`WO: <${r.workOrder}> PN: <${r.productName}>`));

db.close();

const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const rows = db.prepare("SELECT * FROM schedules WHERE equipmentId = 'S200-05外-152' AND date >= '2026-03-25' ORDER BY date ASC, workOrder, productName").all();
rows.forEach((r, i) => {
    console.log(`${i+1}. Date: ${r.date} | WO: [${r.workOrder}] | PN: [${r.productName}] | Client: [${r.client}]`);
});
db.close();

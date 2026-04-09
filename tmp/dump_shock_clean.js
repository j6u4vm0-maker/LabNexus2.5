const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const rows = db.prepare(`
    SELECT * FROM schedules 
    WHERE equipmentId = 'S200-05外-152' 
    AND date >= '2026-03-29' 
    ORDER BY date ASC, workOrder, productName
`).all();

console.log(`Analyzing ${rows.length} rows...`);
rows.forEach(r => {
    console.log(`[${r.date}] WO: <${r.workOrder}> PN: <${r.productName}> CL: <${r.client}> TS: <${r.tester}> Notes: <${r.notes}>`);
});
db.close();

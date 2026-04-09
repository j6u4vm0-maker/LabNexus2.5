const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT * FROM schedules 
    WHERE (productName LIKE '%VCPU%')
    AND equipmentId = 'S200-05外-043'
    ORDER BY date ASC
`;

const rows = db.prepare(query).all();
console.log(`Found ${rows.length} total rows for VCPU on S200-05外-043.`);
rows.forEach(r => {
    console.log(`Date: ${r.date} | WO: [${r.workOrder}] | PN: [${r.productName}]`);
});

db.close();

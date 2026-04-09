const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT * FROM schedules 
    WHERE (productName LIKE '%VCPU%' OR productName LIKE '%VCCICA%')
    AND equipmentId = 'S200-05外-152'
    ORDER BY date ASC
`;

const rows = db.prepare(query).all();
console.log(`Found ${rows.length} total rows for these products on this machine.`);
rows.forEach(r => {
    console.log(`Date: ${r.date} | PN: [${r.productName}]`);
});

db.close();

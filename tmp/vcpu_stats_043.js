const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const query = `
    SELECT MIN(date) as minDate, MAX(date) as maxDate, COUNT(*) as count
    FROM schedules
    WHERE equipmentId = 'S200-05外-043' 
    AND (productName LIKE '%VCPU%' OR workOrder LIKE '%VCPU%')
`;

const res = db.prepare(query).get();
console.log('--- VCPU Stats on S200-05外-043 ---');
console.log(JSON.stringify(res, null, 2));

db.close();

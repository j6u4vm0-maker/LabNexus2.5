const Database = require('better-sqlite3');
const path = require('path');
const db = new Database('labnexus.db');

const rows = db.prepare("SELECT * FROM schedules WHERE workOrder LIKE '%VCPU%' OR productName LIKE '%VCPU%'").all();
console.log(JSON.stringify(rows, null, 2));
db.close();

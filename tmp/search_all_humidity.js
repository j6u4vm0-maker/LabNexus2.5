const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const rows = db.prepare("SELECT * FROM equipment WHERE name LIKE '%恆溫恆濕%'").all();
console.log('--- All Humidity-related Machines ---');
rows.forEach(r => {
    console.log(`ID: ${r.id} | Name: ${r.name}`);
});

db.close();

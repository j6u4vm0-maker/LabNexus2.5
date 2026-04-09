const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

console.log('--- Schedules Table Info ---');
console.log(db.prepare("PRAGMA table_info(schedules)").all());

console.log('\n--- Sample Rows for Shock Machine ---');
const sample = db.prepare("SELECT * FROM schedules WHERE equipmentId = 'S200-05外-152' LIMIT 5").all();
console.log(sample);

db.close();

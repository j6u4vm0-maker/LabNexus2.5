const Database = require('better-sqlite3');
const db = new Database('labnexus.db');

const row = db.prepare("SELECT * FROM equipment WHERE name = '複合式(恆溫恆濕)試驗機'").get();
console.log('--- Humidity Machine Details ---');
console.log(JSON.stringify(row, null, 2));

db.close();

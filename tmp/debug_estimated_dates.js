const db = require('better-sqlite3')('labnexus.db');

const rows = db.prepare(`SELECT estimatedCompletionDate FROM cases WHERE actualCompletionDate = '' AND status NOT IN ('已完成','已取消','已結案') LIMIT 15`).all();
console.log(rows);

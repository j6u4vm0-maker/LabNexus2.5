
const Database = require('better-sqlite3');
const db = new Database('labnexus.db');
const fs = require('fs');

const now = new Date('2026-04-09');
const todayStr = '2026/04/09';

function mapStatus(status) {
    const mapping = {
        '進行中': '實驗中', '審核中': '實驗中', '已核准': '實驗中',
        '實驗中': '實驗中', '檢測中': '實驗中', '確認中': '實驗中', '計畫中': '實驗中',
        '已完成': '已完成', '已結案': '已完成', '待處置': '已完成', '已指派': '已完成',
        '已取消': '已取消',
    };
    return mapping[status] || status;
}

const allRows = db.prepare('SELECT * FROM cases').all();

const results = {
    simpleDbDelayed: [],
    frontendDelayed: [],
    discrepancy: []
};

const TERMINAL_STATUSES = ['已完成', '已結案', '已取消', '設備保養', '設備保養完成'];
const OPERATIONAL_EXCLUDE = ['設備保養', '設備保養完成'];

allRows.forEach(row => {
    const estDate = row.estimatedCompletionDate;
    const actDate = row.actualCompletionDate;
    
    // Simple logic: past estimated date and no actual date
    const isSimpleDelayed = estDate && estDate < todayStr && (!actDate || actDate.trim() === '');
    if (isSimpleDelayed) {
        results.simpleDbDelayed.push({ id: row.id, workOrderId: row.workOrderId, status: row.status });
    }

    // Frontend logic (from sqlite-api.ts)
    let status = mapStatus(row.status || '');
    if (status !== '已取消' && actDate && actDate.trim() !== '') {
        status = '已完成';
    }
    const isOperational = !OPERATIONAL_EXCLUDE.includes(status);
    const isUnfinished = !TERMINAL_STATUSES.includes(status);
    
    let isFrontendDelayed = false;
    if (isOperational && isUnfinished) {
        if (!actDate || actDate.trim() === '') {
           if (estDate && estDate < todayStr) {
               isFrontendDelayed = true;
           }
        }
    }
    
    if (isFrontendDelayed) {
        results.frontendDelayed.push({ id: row.id, workOrderId: row.workOrderId, status: row.status });
    }

    if (isSimpleDelayed && !isFrontendDelayed) {
        results.discrepancy.push({
            id: row.id,
            workOrderId: row.workOrderId,
            dbStatus: row.status,
            mappedStatus: status,
            estimatedDate: row.estimatedCompletionDate,
            actualDate: row.actualCompletionDate,
            reason: !isOperational ? 'Excluded (Maintenance)' : (!isUnfinished ? 'Excluded (Terminal Status)' : 'Other')
        });
    }
});

fs.writeFileSync('tmp/discrepancy_report.json', JSON.stringify({
    counts: {
        db: results.simpleDbDelayed.length,
        frontend: results.frontendDelayed.length
    },
    discrepancy: results.discrepancy
}, null, 2));

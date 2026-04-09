const db = require('better-sqlite3')('labnexus.db');

const rows = db.prepare(`SELECT * FROM cases`).all();

function safeDateStr(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-CA').replace(/-/g, '/');
    } catch { return dateStr; }
}

function mapStatus(status) {
    const mapping = {
        '進行中': '實驗中', '審核中': '實驗中', '已核准': '實驗中',
        '實驗中': '實驗中', '檢測中': '實驗中', '確認中': '實驗中', '計畫中': '實驗中',
        '已完成': '已完成', '已結案': '已完成', '待處置': '已完成', '已指派': '已完成',
        '已取消': '已取消',
    };
    return mapping[status] || status;
}

// Client logic
const safeParseDate = (dateInput) => {
    if (!dateInput) return null;
    let d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return d;
};

const isProjectDelayed = (project, referenceDate) => {
    if (project.status === '已取消') return false;
    const estimated = safeParseDate(project.estimatedDate);
    const end = safeParseDate(project.endDate);
    if (!estimated) return false;
    estimated.setHours(0, 0, 0, 0);
    if (end) return false;
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);
    return today > estimated;
};

// Map DB rows to ProjectData initially
const projects = rows.filter(r => !['設備保養','設備保養完成'].includes(r.status)).map(row => ({
    id: row.id,
    status: mapStatus(row.status || ''),
    estimatedDate: safeDateStr(row.estimatedCompletionDate) || new Date().toLocaleDateString('en-CA').replace(/-/g, '/'),
    endDate: safeDateStr(row.actualCompletionDate)
}));

// Apply projectsWithComputedStatus logic EXACTLY as in ProjectList.tsx
const terminalStatuses = ['已完成', '已結案', '已取消', '設備保養完成'];
const projectsWithComputedStatus = projects.map(p => {
    if (terminalStatuses.includes(p.status)) {
        return p;
    }
    // IMPORTANT!!! truthy check of p.endDate
    if (p.endDate && p.status !== '已取消') {
        return { ...p, status: '已完成' };
    }
    if (isProjectDelayed(p, new Date())) {
        return { ...p, status: '延遲中' };
    }
    return p;
});

const delayedCount = projectsWithComputedStatus.filter(p => p.status === '延遲中').length;
console.log("Delayed count in Project List logic:", delayedCount);

// Print the status of the 41 cases that we thought would be delayed
const purelyBlankEnDateProjects = projects.filter(p => p.endDate === '' && !terminalStatuses.includes(p.status));
console.log("Remaining pure blank before delay logic:", purelyBlankEnDateProjects.length);
const delayedAmongBlanks = purelyBlankEnDateProjects.filter(p => isProjectDelayed(p, new Date()));
console.log("Actually delayed among them:", delayedAmongBlanks.length);

if (delayedAmongBlanks.length > 0) {
   console.log("Wait, if there are some delayed, why does it show 0?");
   // Maybe they have some estimatedDate string that fails "new Date(dateInput)" in Node.js but not browser?
   console.log("Sample dates:", delayedAmongBlanks.slice(0, 3).map(p => p.estimatedDate));
}

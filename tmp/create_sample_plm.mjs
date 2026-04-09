import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const data = [
    {
        '工單編號': 'C115032411',
        '品名': '2B17-0147-00',
        '狀態': '檢測中',
        '檢測者': '張盟坤',
        '預計測試完成日期': '2026/04/10',
        '完成日期': '2026/04/08', // This should trigger the "Completed" override
        '優先級': '一般件'
    },
    {
        '工單編號': 'C115032327',
        '品名': 'HCC14.7*11.5*111.2*OR',
        '狀態': '實驗中',
        '檢測者': '張盟坤',
        '預計測試完成日期': '2026/04/15',
        '優先級': '特急件'
    }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Projects');

const dir = './plm_data';
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

XLSX.writeFile(wb, path.join(dir, 'project_list.xlsx'));
console.log('Sample Excel file created at ./plm_data/project_list.xlsx');

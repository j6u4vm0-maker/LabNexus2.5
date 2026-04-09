'use client';

import React, { useState, useMemo, useRef } from 'react';
import { format, addYears, subYears } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2, Upload, FileSpreadsheet, ChevronsUpDown, Check } from 'lucide-react';
import type { Engineer, RoutineWork, RoutineWorkTask } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addRoutineWorkTaskAction, deleteRoutineWorkTaskAction, setRoutineWorkAction, overwriteRoutineWorkForYearsAction } from '@/lib/sqlite-api';
import * as XLSX from 'xlsx-js-style';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ActionButton } from '@/components/common/PageHeaderActions';


interface RoutineWorkScheduleProps {
  schedules: RoutineWork[];
  engineers: Engineer[];
  tasks: RoutineWorkTask[];
}

const RoutineWorkSchedule: React.FC<RoutineWorkScheduleProps> = ({ schedules, engineers, tasks }) => {
  const [currentYear, setCurrentYear] = useState(new Date()); // Use this to get the year
  const [newTaskName, setNewTaskName] = useState('');
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handlePrevYear = () => setCurrentYear(prev => subYears(prev, 1));
  const handleNextYear = () => setCurrentYear(prev => addYears(prev, 1));

  const sortedTasks = useMemo(() => tasks.sort((a, b) => a.order - b.order), [tasks]);
  const sortedEngineers = useMemo(() => engineers.sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant')), [engineers]);
  const engineerNames = useMemo(() => new Set(engineers.map(e => e.name)), [engineers]);
  
  const engineerColorMap = useMemo(() => {
    const colors = [
      '203 89% 53%', // sky
      '158 79% 41%', // emerald
      '48 96% 58%',  // amber
      '349 82% 54%', // rose
      '262 79% 58%', // violet
      '84 81% 44%',  // lime
      '330 81% 57%', // pink
      '186 91% 43%', // cyan
    ];
    const map = new Map<string, string>();
    sortedEngineers.forEach((engineer, index) => {
        map.set(engineer.name, colors[index % colors.length]);
    });
    return map;
  }, [sortedEngineers]);

  const handleAddTask = async () => {
    if (!newTaskName.trim()) return;
    const maxOrder = tasks.reduce((max, task) => Math.max(max, task.order), 0);
    const result = await addRoutineWorkTaskAction(newTaskName, maxOrder + 1);
    if (result.success) {
        setNewTaskName('');
        toast({ title: '成功', description: '已新增欄位' });
    } else {
        toast({ title: '新增失敗', description: result.error, variant: 'destructive' });
    }
  };

  const handleRemoveTask = async (taskId: string, taskName: string) => {
    if (!window.confirm(`確定要刪除「${taskName}」欄位嗎？這將會清除該欄位的所有指派紀錄。`)) return;
    const result = await deleteRoutineWorkTaskAction(taskId, taskName);
    if (result.success) {
        toast({ title: '已刪除', description: '欄位已成功刪除' });
    } else {
        toast({ title: '刪除失敗', description: result.error, variant: 'destructive' });
    }
  };

  const handleAssignmentChange = async (yearMonth: string, taskCategory: string, engineerName: string | null, engineerId: string | null = null) => {
    const result = await setRoutineWorkAction(yearMonth, taskCategory, engineerName, engineerId);
    if (!result.success) {
        toast({ title: '更新失敗', description: result.error, variant: 'destructive' });
    }
  };
  
  const yearlyScheduleData = useMemo(() => {
    const year = currentYear.getFullYear();
    const scheduleMap = new Map<string, string>(); 
    schedules.forEach(schedule => {
      if (schedule.yearMonth && schedule.yearMonth.startsWith(year.toString())) {
          const key = `${schedule.yearMonth}_${schedule.taskCategory}`;
          scheduleMap.set(key, schedule.engineerName);
      }
    });
    
    const tableData = [];
    for (let month = 0; month < 12; month++) {
      const yearMonthStr = format(new Date(year, month), 'yyyy-MM');
      const row: { month: string; yearMonth: string; [task: string]: string } = { 
          month: `${month + 1}月`,
          yearMonth: yearMonthStr,
      };
      sortedTasks.forEach(task => {
        const key = `${yearMonthStr}_${task.name}`;
        row[task.name] = scheduleMap.get(key) || '';
      });
      tableData.push(row);
    }
    return tableData;
  }, [currentYear, schedules, engineerNames, sortedTasks]);

  const engineerWorkload = useMemo(() => {
    const workload = new Map<string, number>();
    yearlyScheduleData.forEach(row => {
        sortedTasks.forEach(task => {
            const engineer = row[task.name];
            if(engineer) {
                workload.set(engineer, (workload.get(engineer) || 0) + 1);
            }
        })
    });
    return workload;
  }, [yearlyScheduleData, sortedTasks]);

  const maxWorkload = useMemo(() => {
    if (engineerWorkload.size === 0) return 0;
    return Math.max(...Array.from(engineerWorkload.values()));
  }, [engineerWorkload]);

  const filteredEngineers = useMemo(() => {
    if (!searchTerm) return sortedEngineers;
    return sortedEngineers.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, sortedEngineers]);

  const handleExportExcel = () => {
    if (!yearlyScheduleData || yearlyScheduleData.length === 0) {
      toast({ title: '無資料', description: '目前沒有排程資料可供匯出。' });
      return;
    }
    
    const headers = ['月份', ...sortedTasks.map(t => t.name)];
    
    const dataToExport = yearlyScheduleData.map(row => {
      const newRow: Record<string, string> = { '月份': row.month.replace('月','') };
      sortedTasks.forEach(task => {
        newRow[task.name] = row[task.name] || '';
      });
      return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E293B" } } };
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    
    headers.forEach((h, i) => {
        const cellRef = XLSX.utils.encode_cell({ c: i, r: 0 });
        if(ws[cellRef]) ws[cellRef].s = headerStyle;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Routine Work Schedule");
    XLSX.writeFile(wb, `RoutineWork_${format(currentYear, 'yyyy')}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`您確定要用 Excel 檔案的內容覆蓋 ${format(currentYear, 'yyyy')} 年的所有排程嗎？此操作無法復原。`)) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const year = currentYear.getFullYear();
        const newSchedules: Omit<RoutineWork, 'id'>[] = [];
        const nameToId = new Map<string, string>();
        engineers.forEach(e => nameToId.set(e.name, e.id));

        data.forEach(row => {
          const monthStr = row['月份']?.toString().replace('月', '').padStart(2, '0');
          if (!monthStr || parseInt(monthStr) < 1 || parseInt(monthStr) > 12) return;
          
          const yearMonth = `${year}-${monthStr}`;

          Object.keys(row).forEach(taskCategory => {
            if (taskCategory !== '月份') {
              const engineerName = row[taskCategory]?.toString().trim();
              if (engineerName && engineerName !== '') {
                newSchedules.push({
                  yearMonth,
                  taskCategory,
                  engineerName,
                  engineerId: nameToId.get(engineerName)
                });
              }
            }
          });
        });

        if (newSchedules.length === 0) {
          toast({ title: '匯入失敗', description: '檔案中未找到有效的排程資料。請檢查欄位名稱與月份是否正確。', variant: 'destructive'});
          return;
        }

        const result = await overwriteRoutineWorkForYearsAction(newSchedules, [year]);
        if (result.success) {
            toast({ title: '匯入成功', description: `${year} 年的排程已成功更新。`});
        } else {
            toast({ title: '匯入失敗', description: result.error, variant: 'destructive' });
        }

      } catch (error: any) {
        console.error('Import error:', error);
        toast({ title: '匯入失敗', description: '解析檔案時發生錯誤。', variant: 'destructive'});
      } finally {
          if(fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">例行性工作年排程表</h1>
              <p className="text-sm text-slate-500 mt-1">點擊表格內的儲存格可以指派或變更負責人員。</p>
            </div>
            <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
                 <ActionButton variant="import" icon={Upload} onClick={() => fileInputRef.current?.click()} className="text-xs px-4 py-2">
                  匯入 Excel
                </ActionButton>
                <ActionButton variant="export" icon={FileSpreadsheet} onClick={handleExportExcel} className="text-xs px-4 py-2">
                  匯出 Excel
                </ActionButton>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 border">
                <button onClick={handlePrevYear} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-colors"><ChevronLeft /></button>
                <span className="text-base font-bold text-slate-700 min-w-[100px] text-center">{format(currentYear, 'yyyy年')}</span>
                <button onClick={handleNextYear} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-colors"><ChevronRight /></button>
            </div>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">新增工作項目</h3>
            <div className="flex items-center gap-2">
                <Input 
                    placeholder="輸入新的任務欄位名稱..." 
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    className="max-w-xs bg-slate-50 border-slate-200"
                />
                <Button onClick={handleAddTask} className="bg-blue-600 text-white shadow-blue-100 shadow-lg hover:bg-blue-700"><Plus size={16} className="mr-2"/> 新增欄位</Button>
            </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border overflow-x-auto">
            <Table className="min-w-max">
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead className="w-[80px] font-bold text-slate-600 text-center sticky left-0 bg-slate-50 z-10">月份</TableHead>
                        {sortedTasks.map((task, tidx) => (
                            <TableHead key={task.id || `th-${tidx}`} className="font-bold text-slate-600 w-48">
                              <div className="flex items-center justify-between gap-2">
                                <span>{task.name}</span>
                                <button onClick={() => handleRemoveTask(task.id, task.name)} className="text-slate-400 hover:text-rose-500 opacity-50 hover:opacity-100">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {yearlyScheduleData.map((row, index) => (
                        <TableRow key={index} className="hover:bg-blue-50/20 group">
                            <TableCell className="font-mono font-bold text-slate-500 text-center sticky left-0 bg-white group-hover:bg-blue-50/20 z-10">{row.month}</TableCell>
                            {sortedTasks.map((task, colIdx) => {
                                const cellKey = `${row.yearMonth}_${task.name}`;
                                const selectedEngineerName = row[task.name] || '';
                                const isPopoverOpen = openPopoverKey === cellKey;
                                
                                const hslColor = selectedEngineerName ? engineerColorMap.get(selectedEngineerName) : null;
                                const workload = engineerWorkload.get(selectedEngineerName) || 0;
                                const intensity = maxWorkload > 0 ? Math.min(1, workload / (maxWorkload * 0.8)) : 0;
                                
                                const cellStyle = hslColor ? {
                                    backgroundColor: `hsla(${hslColor.split(' ')[0]}, ${hslColor.split(' ')[1]}, ${96 - (intensity * 35)}%, 1)`,
                                    color: `hsla(${hslColor.split(' ')[0]}, ${hslColor.split(' ')[1]}, ${30 - (intensity * 15)}%, 1)`,
                                    borderColor: `hsla(${hslColor.split(' ')[0]}, ${hslColor.split(' ')[1]}, ${90 - (intensity * 25)}%, 1)`,
                                } : {};

                                return (
                                <TableCell key={task.id || `cell-${index}-${colIdx}`} className="p-1">
                                  <Popover open={isPopoverOpen} onOpenChange={(open) => {
                                    if (open) {
                                      setOpenPopoverKey(cellKey);
                                    } else {
                                      setOpenPopoverKey(null);
                                      setSearchTerm("");
                                    }
                                  }}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        role="combobox"
                                        aria-expanded={isPopoverOpen}
                                        style={cellStyle}
                                        className={cn(
                                          "w-full h-full justify-between px-2 py-3 text-sm font-bold border-2 rounded-xl transition-all",
                                          !hslColor && "bg-slate-50/50 border-slate-200 border-dashed text-slate-500"
                                        )}
                                      >
                                        <span className="truncate">{selectedEngineerName || "-- 未指派 --"}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[200px] p-0" align="start">
                                      <Input
                                        placeholder="搜尋工程師..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="m-1 w-[calc(100%-0.5rem)] h-8"
                                        autoFocus
                                      />
                                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                        <div
                                          onClick={() => {
                                            handleAssignmentChange(row.yearMonth, task.name, null, null);
                                            setOpenPopoverKey(null);
                                          }}
                                          className="text-sm p-2 text-slate-500 hover:bg-accent rounded-md cursor-pointer flex items-center justify-between"
                                        >
                                          -- 未指派 --
                                          {selectedEngineerName === '' && <Check className="h-4 w-4" />}
                                        </div>
                                        {filteredEngineers.map(e => (
                                          <div
                                            key={e.id || e.name}
                                            onClick={() => {
                                              handleAssignmentChange(row.yearMonth, task.name, e.name, e.id);
                                              setOpenPopoverKey(null);
                                              setSearchTerm('');
                                            }}
                                            className="text-sm p-2 hover:bg-accent rounded-md cursor-pointer flex items-center justify-between"
                                          >
                                            {e.name}
                                            {selectedEngineerName === e.name && <Check className="h-4 w-4" />}
                                          </div>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                            )})}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </div>
  );
};

export default RoutineWorkSchedule;

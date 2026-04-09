'use client';
import React, { useState, useMemo, useEffect } from 'react';
import type { ProjectData } from '@/lib/schedule-types';
import { STATUS_SOLID_COLORS, STATUS_HEX_COLORS } from '@/lib/constants';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek, parse, isWeekend, isAfter, differenceInDays } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Cpu, Link as LinkIcon, ClipboardList, ChevronLeft, ChevronRight, Calendar, User, Wrench, Package, Settings, Filter, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Engineer } from '@/lib/types';
import { isProjectDelayed, safeParseDate } from '@/lib/date-utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


interface CalendarViewProps {
  projects: ProjectData[];
  maintenanceProjects: ProjectData[];
  machineScheduleProjects: ProjectData[];
  engineers: Engineer[];
  selectedEngineers: string[];
}

const TAIWAN_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "元旦",
  "2026-02-16": "農曆春節", "2026-02-17": "農曆春節", "2026-02-18": "農曆春節", "2026-02-19": "農曆春節", "2026-02-20": "農曆春節",
  "2026-02-28": "和平紀念日",
  "2026-04-04": "兒童節", "2026-04-05": "清明節",
  "2026-05-01": "勞動節",
  "2026-06-19": "端午節",
  "2026-09-25": "中秋節",
  "2026-10-10": "國慶日",
};

const ICONS = {
  Left: <ChevronLeft size={20} />,
  Right: <ChevronRight size={20} />,
  Calendar: <Calendar size={48} />,
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground font-semibold w-20 shrink-0">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-foreground font-medium break-words">{value}</div>
    </div>
  );
};


const ProjectCalendar: React.FC<CalendarViewProps> = ({ 
  projects, 
  maintenanceProjects,
  machineScheduleProjects,
  engineers,
  selectedEngineers
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [selectedDayContent, setSelectedDayContent] = useState<{ projects: ProjectData[] } | null>(null);
  
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const projectsWithComputedStatus = useMemo(() => {
    const terminalStatuses = ['已完成', '已結案', '已取消', '設備保養完成'];
    return projects.map(p => {
        if (terminalStatuses.includes(p.status)) {
            return p;
        }
        if (p.endDate && p.status !== '已取消') {
            return { ...p, status: '已完成' };
        }
        if (isProjectDelayed(p, new Date())) {
            return { ...p, status: '延遲中' };
        }
        return p;
    });
  }, [projects]);
  
  const allProjects = useMemo(() => [...projectsWithComputedStatus, ...maintenanceProjects, ...machineScheduleProjects], [projectsWithComputedStatus, maintenanceProjects, machineScheduleProjects]);
  
  const allStatuses = useMemo(() => {
    const statuses = new Set(allProjects.map(p => p.status));
    // 強制保留基礎狀態，並把機台預約細分為開始、佔用、結束
    ['實驗中', '延遲中', '已完成', '已取消', '機台預約', '機台開始', '機台結束', '佔用中', '設備保養', '設備保養完成'].forEach(s => statuses.add(s));
    return Array.from(statuses).sort();
  }, [allProjects]);
  
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(allStatuses));

  useEffect(() => {
    setSelectedStatuses(new Set(allStatuses));
  }, [allStatuses]);

  const handleStatusChange = (status: string) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  const setAllStatuses = (select: boolean) => {
    if (select) {
      setSelectedStatuses(new Set(allStatuses));
    } else {
      setSelectedStatuses(new Set());
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const formatTestDetails = (details: ProjectData['testDetails']) => {
    if (!details) return '尚未定義具體測試項';
    const parts = [];
    if (details.dimensions && details.dimensions !== '無') parts.push(`尺寸: ${details.dimensions}`);
    if (details.force && details.force !== '無') parts.push(`力量: ${details.force}`);
    if (details.electrical && details.electrical !== '無') parts.push(`電性: ${details.electrical}`);
    if (details.material && details.material !== '無') parts.push(`材料: ${details.material}`);
    if (details.environment && details.environment !== '無') parts.push(`環境: ${details.environment}`);
    if (details.other && details.other !== '無') parts.push(`其他: ${details.other}`);
    return parts.length > 0 ? parts.join(' | ') : '尚未定義具體測試項';
  };

  const machineScheduleBlocks = useMemo(() => {
      // This map will store the final block info for each individual event ID.
      const blockInfoMap = new Map<string, { start: Date, end: Date }>();
  
      // 1. Group schedules by a composite key that represents a continuous booking.
      const schedulesByCompositeKey = new Map<string, ProjectData[]>();
      machineScheduleProjects.forEach(p => {
          // A specific key to group potential blocks. Using partNo for equipmentId.
          const key = `${p.partNo || 'N/A'}|${p.workOrderId || 'N/A'}|${p.productName || 'N/A'}`;
          if (!schedulesByCompositeKey.has(key)) {
              schedulesByCompositeKey.set(key, []);
          }
          schedulesByCompositeKey.get(key)!.push(p);
      });
  
      // 2. For each group, find continuous blocks of days.
      schedulesByCompositeKey.forEach((group) => {
          if (group.length === 0) return;
  
          group.sort((a, b) => a.estimatedDate.localeCompare(b.estimatedDate));
          
          let currentBlock: ProjectData[] = [group[0]];
  
          for (let i = 1; i < group.length; i++) {
              const prevProject = currentBlock[currentBlock.length - 1];
              const currentProject = group[i];
  
              const prevDate = parse(prevProject.estimatedDate, 'yyyy/MM/dd', new Date());
              const currDate = parse(currentProject.estimatedDate, 'yyyy/MM/dd', new Date());
  
              // If the current day is exactly one day after the previous day, it's a continuous block.
              // This is a simplification and does not account for weekends/holidays.
              if (differenceInDays(currDate, prevDate) === 1) {
                  currentBlock.push(currentProject);
              } else {
                  // Block is broken, process the completed block.
                  if (currentBlock.length > 0) {
                      const firstDay = currentBlock[0];
                      const lastDay = currentBlock[currentBlock.length - 1];
                      const blockStart = parse(firstDay.estimatedDate, 'yyyy/MM/dd', new Date());
                      const blockEnd = parse(lastDay.estimatedDate, 'yyyy/MM/dd', new Date());
                      
                      if (!isNaN(blockStart.getTime()) && !isNaN(blockEnd.getTime())) {
                          currentBlock.forEach(p => {
                              blockInfoMap.set(p.id, { start: blockStart, end: blockEnd });
                          });
                      }
                  }
                  // Start a new block
                  currentBlock = [currentProject];
              }
          }
  
          // Process the last remaining block
          if (currentBlock.length > 0) {
              const firstDay = currentBlock[0];
              const lastDay = currentBlock[currentBlock.length - 1];
              const blockStart = parse(firstDay.estimatedDate, 'yyyy/MM/dd', new Date());
              const blockEnd = parse(lastDay.estimatedDate, 'yyyy/MM/dd', new Date());
  
               if (!isNaN(blockStart.getTime()) && !isNaN(blockEnd.getTime())) {
                  currentBlock.forEach(p => {
                      blockInfoMap.set(p.id, { start: blockStart, end: blockEnd });
                  });
              }
          }
      });
  
      return blockInfoMap;
  }, [machineScheduleProjects]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, { projects: (ProjectData & { displayType?: string })[] }> = {};
    const addProjectToMap = (p: ProjectData, date: Date, displayInfo: Record<string, any> = {}) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        if (!map[dateKey]) map[dateKey] = { projects: [] };
        
        const isAllSelected = selectedEngineers.includes('all') || selectedEngineers.includes('所有人');
        if (!isAllSelected && !selectedEngineers.includes(p.tester)) return;
        
        if (!selectedStatuses.has(p.status)) return;
        map[dateKey].projects.push({ ...p, ...displayInfo });
    }

    const processProjectList = (projectList: ProjectData[], isMachineSchedule = false) => {
        projectList.forEach(p => {
            if (p.estimatedDate && p.estimatedDate.trim() !== '') {
                try {
                    const parsedDate = parse(p.estimatedDate, 'yyyy/MM/dd', new Date());
                    if (!isNaN(parsedDate.getTime())) {
                        if (isMachineSchedule) {
                            const block = machineScheduleBlocks.get(p.id);
                            let displayType = 'single';
                            let specificStatus = '機台預約';
                            if (block && isAfter(block.end, block.start)) {
                                if (isSameDay(parsedDate, block.start)) { displayType = 'start'; specificStatus = '機台開始'; }
                                else if (isSameDay(parsedDate, block.end)) { displayType = 'end'; specificStatus = '機台結束'; }
                                else { displayType = 'middle'; specificStatus = '佔用中'; }
                            }
                            addProjectToMap({ ...p, status: specificStatus }, parsedDate, { displayType });
                        } else {
                            addProjectToMap(p, parsedDate);
                        }
                    } else {
                        const fallbackDate = new Date(p.estimatedDate);
                        if (!isNaN(fallbackDate.getTime())) {
                           addProjectToMap(p, fallbackDate);
                        }
                    }
                } catch (e) { /* ignore */ }
            }
        });
    }

    processProjectList(projectsWithComputedStatus);
    processProjectList(maintenanceProjects);
    processProjectList(machineScheduleProjects, true);
    
    return map;
  }, [projectsWithComputedStatus, maintenanceProjects, machineScheduleProjects, selectedEngineers, selectedStatuses, machineScheduleBlocks]);


  const handleDayClick = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    setSelectedDayContent(eventsByDay[dateKey] || { projects: [] });
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  
  const getEventIcon = (status: string) => {
    if (status === '機台預約') {
        return <Cpu size={12} className="inline-block mr-1" />;
    }
    if (status === '設備保養' || status === '設備保養完成') {
        return <Wrench size={12} className="inline-block mr-1" />;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>時程總覽</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-card rounded-[1.5rem] shadow-sm border overflow-hidden">
              <div className="flex items-center justify-between px-8 py-6 border-b">
                <h3 className="text-xl font-bold text-foreground">{format(currentMonth, 'yyyy年 MMMM', { locale: zhTW })}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrevMonth} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">{ICONS.Left}</button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-1.5 text-xs font-semibold border rounded-lg hover:bg-muted transition-all">今天</button>
                  <button onClick={handleNextMonth} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">{ICONS.Right}</button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b bg-muted/50">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="py-4 text-center text-xs font-semibold text-muted-foreground tracking-wider">週{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 bg-border gap-px">
                {days.map((day, idx) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const holidayName = TAIWAN_HOLIDAYS[dateKey];
                  const dayEvents = eventsByDay[dateKey] || { projects: [] };
                  const pItems = dayEvents.projects;
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isDayToday = hasMounted && isToday(day);
                  
                  const sortedProjects = [...pItems].sort((a, b) => {
                    const isAExperimental = a.status === '實驗中';
                    const isBExperimental = b.status === '實驗中';
                    if (isAExperimental && !isBExperimental) return -1;
                    if (!isAExperimental && isBExperimental) return 1;
                    return 0;
                  });

                  return (
                    <div key={idx} onClick={() => handleDayClick(day)} className={`min-h-[150px] p-1 cursor-pointer group relative transition-all ${!isCurrentMonth ? 'opacity-30 bg-muted/30' : isWeekend(day) ? 'bg-red-500/5' : 'bg-card hover:bg-primary/5'}`}>
                      <div className="flex justify-between items-start mb-2 p-1">
                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg ${isDayToday ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground'}`}>{format(day, 'd')}</span>
                        {holidayName && <span className="text-xs bg-red-500 text-white px-1.5 rounded-sm font-bold tracking-tighter">{holidayName}</span>}
                      </div>
                      
                      <div className="space-y-1 px-0.5">
                        {sortedProjects.slice(0, 3).map(p => {
                          if (['機台預約', '機台開始', '機台結束', '佔用中'].includes(p.status)) {
                              const displayType = (p as any).displayType;
                              let eventContent;
                              let eventClasses;

                              switch (displayType) {
                                  case 'start':
                                      eventClasses = 'bg-status-reserved text-status-reserved-foreground';
                                      eventContent = `[始] ${p.partNo}`;
                                      break;
                                  case 'middle':
                                      eventClasses = 'bg-status-reserved/40 text-status-reserved-foreground/80 italic';
                                      eventContent = `>> 佔用中 >>`;
                                      break;
                                  case 'end':
                                      eventClasses = 'bg-status-reserved text-status-reserved-foreground';
                                      eventContent = `${p.partNo} [終]`;
                                      break;
                                  case 'single':
                                  default:
                                      eventClasses = 'bg-status-reserved text-status-reserved-foreground';
                                      eventContent = p.partNo;
                                      break;
                              }

                              return (
                                  <div key={p.id} className={cn(
                                      'text-xs truncate px-2 py-0.5 rounded-md font-semibold leading-tight shadow-sm flex items-center justify-center',
                                      eventClasses
                                  )}>
                                     <span>{eventContent}</span>
                                  </div>
                              );
                          }

                          let eventText = p.productName;
                          if (p.status.includes('保養')) {
                              eventText = `${p.productName} (${p.partNo || 'N/A'})`;
                          }
                          return (
                              <div key={p.id} className={`text-xs truncate px-2 py-0.5 rounded-md border ${STATUS_SOLID_COLORS[p.status] || STATUS_SOLID_COLORS.default} font-semibold leading-tight shadow-sm flex items-center`}>
                                 {getEventIcon(p.status)}
                                 <span>{eventText}</span>
                              </div>
                          )
                        })}
                        {sortedProjects.length > 3 && (
                          <div className="text-center text-xs font-bold text-muted-foreground mt-1">...</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card p-8 rounded-[1.5rem] shadow-sm border min-h-[550px] flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-lg font-bold text-foreground flex items-center gap-3">
                  <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                  當日排程詳情
                </h4>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-600 transition-colors border">
                        <Filter size={16} />
                        篩選
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b">
                          <span className="text-sm font-bold text-slate-600 border-none">案件狀況</span>
                          <div className="flex gap-2">
                              <button onClick={() => setAllStatuses(true)} className="text-xs font-bold text-blue-600 hover:underline">全選</button>
                              <button onClick={() => setAllStatuses(false)} className="text-xs font-bold text-rose-600 hover:underline">全刪</button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                        {allStatuses.map((status) => (
                          <label key={status} htmlFor={`status-cal-${status}`} className={cn(
                              "flex items-center gap-2 cursor-pointer rounded-lg border-2 text-xs font-bold transition-all px-2.5 py-1",
                              selectedStatuses.has(status) 
                              ? cn(STATUS_SOLID_COLORS[status] || STATUS_SOLID_COLORS.default, 'border-transparent shadow-sm') 
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          )}>
                              <input
                                  id={`status-cal-${status}`}
                                  type="checkbox"
                                  checked={selectedStatuses.has(status)}
                                  onChange={() => handleStatusChange(status)}
                                  className="sr-only"
                              />
                              <span>{status}</span>
                          </label>
                        ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedDayContent && (
                    <span className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border">
                      {selectedDayContent.projects.length} 項
                    </span>
                  )}
                </div>
              </div>
              
              {selectedDayContent && (selectedDayContent.projects.length > 0) ? (
                <div className="space-y-8 overflow-y-auto custom-scrollbar pr-2 flex-1">
                  {selectedDayContent.projects.map(p => {
                      const isMachineStatus = ['機台預約', '機台開始', '機台結束', '佔用中'].includes(p.status);
                      if (isMachineStatus) {
                        let badgeClass = 'bg-teal-100 text-teal-700 border-teal-200';
                        if (p.status === '機台開始') badgeClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                        else if (p.status === '機台結束') badgeClass = 'bg-rose-100 text-rose-700 border-rose-200';
                        else if (p.status === '佔用中') badgeClass = 'bg-slate-100 text-slate-500 border-slate-200';

                        return (
                          <div key={p.id} className="p-5 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="font-bold text-foreground text-base mb-3 leading-tight flex items-center gap-2">
                                <Cpu size={16} className="text-primary" />
                                {p.name?.replace('[機台預約] ', '')}
                              </h5>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${badgeClass}`}>{p.status}</span>
                            </div>
                             <div className="space-y-3">
                                <InfoItem icon={<ClipboardList size={14}/>} label="工服號碼" value={p.workOrderId} />
                                <InfoItem icon={<Package size={14}/>} label="品名" value={p.productName} />
                                <InfoItem icon={<User size={14}/>} label="委測者" value={p.creator} />
                                <InfoItem icon={<Cpu size={14}/>} label="機台編號" value={p.partNo} />
                             </div>
                          </div>
                        )
                      }
                      // Default card for Cases and Maintenance
                      return (
                          <div key={p.id} className="p-5 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-center mb-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase flex items-center gap-2 ${p.status.startsWith('設備') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-800'}`}>
                                 {getEventIcon(p.status)}
                                 {p.status.startsWith('設備') ? `保養: ${p.partNo}` : `工服: ${p.workOrderId || p.id}`}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_SOLID_COLORS[p.status] || STATUS_SOLID_COLORS.default}`}>{p.status}</span>
                              </div>
                              <h5 className="font-bold text-foreground text-sm mb-3 leading-tight">
                                  {`品名：${p.productName}`}
                              </h5>
                              
                              {(((p.testDetails && Object.values(p.testDetails).some(v => v && v !== '無')) || (p.workOrderId?.startsWith('C') || p.id?.startsWith('C'))) || p.notes) && (
                              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-3 space-y-4">
                                {((p.testDetails && Object.values(p.testDetails).some(v => v && v !== '無')) || (p.workOrderId?.startsWith('C') || p.id?.startsWith('C'))) && (
                                  <div>
                                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                                        <ClipboardList size={14} /> 測試詳情內容
                                    </p>
                                    <div className="space-y-1.5 mt-2">
                                        {((p.workOrderId?.startsWith('C') || p.id?.startsWith('C')) 
                                          ? [{ key: 'fai', label: '測試項目', value: 'FAI尺寸量測' }]
                                          : [
                                            { key: 'material', label: '材料測試', value: p.testDetails.material },
                                            { key: 'electrical', label: '電性測試', value: p.testDetails.electrical },
                                            { key: 'dimensions', label: '尺寸測量', value: p.testDetails.dimensions },
                                            { key: 'environment', label: '環境測試', value: p.testDetails.environment }
                                        ].filter(item => item.value && item.value !== '無')).map(item => (
                                            <div key={item.key} className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 text-sm">
                                                <span className="text-slate-600 font-semibold shrink-0 sm:w-20">{item.label}</span>
                                                <span className="text-foreground/90 font-medium">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {p.notes && p.notes !== '無備註' && (
                                  <div>
                                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-amber-600/10 pb-1.5">
                                        <Info size={14} className="text-amber-500" /> 測試備註
                                    </p>
                                    <div className="text-sm font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                        {p.notes}
                                    </div>
                                  </div>
                                )}
                              </div>
                              )}

                              <div className="pt-3 border-t flex items-center justify-between">
                                   <div className="flex items-center gap-2">
                                     <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">👤</div>
                                     <span className="text-sm font-medium text-foreground/80">{p.tester || '未指派'}</span>
                                   </div>
                                   <span className="text-xs font-semibold text-muted-foreground uppercase">{p.priority}</span>
                                </div>
                          </div>
                      );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-20 text-center opacity-30">
                  <div className="w-20 h-20 rounded-[1.5rem] bg-muted flex items-center justify-center mb-6 text-muted-foreground border">{ICONS.Calendar}</div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider leading-relaxed">點擊日期<br/>查看當日詳細排程與測試內容</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCalendar;

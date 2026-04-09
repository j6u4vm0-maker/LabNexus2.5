'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ProjectData, MachineSchedule, TestDetails } from '@/lib/schedule-types';
import type { UserInfo, Engineer } from '@/lib/types';
import { format, addDays, differenceInDays, isToday, parse, isSameDay, differenceInHours } from 'date-fns';
import { isProjectDelayed, safeParseDate, isWorkingDay } from '@/lib/date-utils';
import { AlertCircle, Clock, FlaskConical, Sparkles, CalendarPlus, Bell, User as UserIcon, CalendarCheck, Package, ClipboardList, Info, Calendar, Server, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ProjectCalendar from '@/components/schedule/project-calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Custom hook to track previous state for comparison
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-2 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground font-semibold w-24 shrink-0">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-foreground font-medium break-words">{value}</p>
      </div>
    );
  };

const formatTestDetails = (details: TestDetails | undefined, workOrderId?: string) => {
    if (workOrderId?.startsWith('C')) return '尺寸量測';
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

interface PersonalDashboardProps {
  projects: ProjectData[];
  schedules: MachineSchedule[];
  user: UserInfo;
  engineers: Engineer[];
  schedulePageProjects: ProjectData[];
  maintenanceProjects: ProjectData[];
  machineScheduleProjects: ProjectData[];
}

const PersonalDashboard: React.FC<PersonalDashboardProps> = ({ 
  projects, 
  schedules, 
  user, 
  engineers,
  schedulePageProjects,
  maintenanceProjects,
  machineScheduleProjects,
}) => {
  const prevSchedules = usePrevious(schedules) || [];
  const [selectedTesterNames, setSelectedTesterNames] = useState<string[]>(user ? [user.name] : []);

  useEffect(() => {
    if (user?.name) {
        setSelectedTesterNames([user.name]);
    }
  }, [user?.name]);

  const { newProjects, newSchedules } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { newProjects: [], newSchedules: [] };
    }
    const now = new Date();

    const isAllSelected = selectedTesterNames.includes('all');

    const newPs = projects.filter(p => {
      if (!isAllSelected && !selectedTesterNames.includes(p.tester)) return false;
      const startDate = safeParseDate(p.startDate);
      return startDate ? isToday(startDate) : false;
    });

    const recentSchedules = schedules.filter(s => {
        if (!isAllSelected && !selectedTesterNames.includes(s.tester)) return false;
        if (!s.updatedAt) return false;
        const updatedAtDate = safeParseDate(s.updatedAt);
        if (!updatedAtDate) return false;
        return differenceInHours(now, updatedAtDate) < 24;
    });

    // Group by bookingId (or id if bookingId is not present) to show only one entry per booking
    const uniqueSchedulesMap = new Map<string, MachineSchedule>();
    recentSchedules.forEach(s => {
        const key = s.bookingId || s.id;
        // Keep the latest updated one if there are multiple for the same booking
        if (!uniqueSchedulesMap.has(key) || (s.updatedAt && uniqueSchedulesMap.get(key)!.updatedAt! < s.updatedAt!)) {
            uniqueSchedulesMap.set(key, s);
        }
    });

    const newSs = Array.from(uniqueSchedulesMap.values());


    return { newProjects: newPs, newSchedules: newSs };
  }, [projects, schedules, selectedTesterNames]);

  const myTasks = useMemo(() => {
    const isAllSelected = selectedTesterNames.includes('all');
    const userProjects = projects.filter(p => isAllSelected || selectedTesterNames.includes(p.tester));
    
    const inProgress = userProjects
      .filter(p => p.status === '實驗中')
      .sort((a, b) => {
        const dateA = safeParseDate(a.estimatedDate);
        const dateB = safeParseDate(b.estimatedDate);
        if (!dateA && !dateB) return (a.workOrderId || '').localeCompare(b.workOrderId || '');
        if (!dateA) return 1;
        if (!dateB) return -1;
        const diff = dateA.getTime() - dateB.getTime();
        if (diff !== 0) return diff;
        return (a.workOrderId || '').localeCompare(b.workOrderId || '');
      });
    
    const dueToday = userProjects.filter(p => {
      const terminalStatuses = ['已完成', '已結案', '已取消'];
      if (terminalStatuses.includes(p.status)) return false;
      const estimatedDate = safeParseDate(p.estimatedDate);
      return estimatedDate ? isToday(estimatedDate) : false;
    });

    const delayed = userProjects
      .filter(p => {
        const terminalStatuses = ['已完成', '已結案', '已取消', '設備保養', '設備保養完成'];
        if (terminalStatuses.includes(p.status)) return false;
        return isProjectDelayed(p, new Date());
      })
      .sort((a, b) => {
        const dateA = safeParseDate(a.estimatedDate);
        const dateB = safeParseDate(b.estimatedDate);
        if (!dateA && !dateB) return (a.workOrderId || '').localeCompare(b.workOrderId || '');
        if (!dateA) return 1;
        if (!dateB) return -1;
        const diff = dateA.getTime() - dateB.getTime();
        if (diff !== 0) return diff;
        return (a.workOrderId || '').localeCompare(b.workOrderId || '');
      });

    return { inProgress, dueToday, delayed };
  }, [projects, selectedTesterNames]);

  const upcomingSchedules = useMemo(() => {
    const today = new Date(); // Use real today for this dynamic card
    let workingDaysCount = 0;
    let dateCursor = today;
    const upcomingWorkingDays: string[] = [];

    // Find the next 3 working days
    while (workingDaysCount < 3 && differenceInDays(dateCursor, today) < 14) {
      if (isWorkingDay(dateCursor)) {
        upcomingWorkingDays.push(format(dateCursor, 'yyyy-MM-dd'));
        workingDaysCount++;
      }
      dateCursor = addDays(dateCursor, 1);
    }

    const isAllSelected = selectedTesterNames.includes('all');
    const filteredForTester = schedules.filter(s => isAllSelected || selectedTesterNames.includes(s.tester));

    const schedulesByBooking = new Map<string, MachineSchedule[]>();
    filteredForTester.forEach(schedule => {
      const key = schedule.bookingId || schedule.id;
      if (!schedulesByBooking.has(key)) {
        schedulesByBooking.set(key, []);
      }
      schedulesByBooking.get(key)!.push(schedule);
    });

    const relevantSchedules: {schedule: MachineSchedule, type: 'start' | 'end'}[] = [];

    schedulesByBooking.forEach(group => {
      if (group.length === 0) return;

      group.sort((a, b) => a.date.localeCompare(b.date));
      const startSchedule = group[0];
      const endSchedule = group[group.length - 1];

      if (upcomingWorkingDays.includes(startSchedule.date)) {
        relevantSchedules.push({schedule: startSchedule, type: 'start'});
      }
      // Avoid duplicating if start and end are the same day and fall in the window
      if (startSchedule.date !== endSchedule.date && upcomingWorkingDays.includes(endSchedule.date)) {
        relevantSchedules.push({schedule: endSchedule, type: 'end'});
      }
    });
    
    return relevantSchedules
        .filter((value, index, self) => index === self.findIndex((t) => (t.schedule.id === value.schedule.id && t.type === value.type)))
        .sort((a, b) => {
            if (a.schedule.date !== b.schedule.date) {
                return a.schedule.date.localeCompare(b.schedule.date);
            }
            return a.schedule.equipmentName.localeCompare(b.schedule.equipmentName);
        });

  }, [schedules, selectedTesterNames]);


  const allTesters = useMemo(() => {
    return engineers.map(e => e.name).sort((a,b) => a.localeCompare(b, 'zh-Hant'));
  }, [engineers]);

  const toggleTester = (name: string) => {
    if (name === 'all') {
        setSelectedTesterNames(['all']);
        return;
    }
    
    setSelectedTesterNames(prev => {
        let newSet = prev.filter(n => n !== 'all');
        if (newSet.includes(name)) {
            newSet = newSet.filter(n => n !== name);
        } else {
            newSet.push(name);
        }
        return newSet.length === 0 ? ['all'] : newSet;
    });
  };


  const TaskItem = ({ project }: { project: ProjectData }) => {
    const requiredDate = safeParseDate(project.requiredDate);
    const isUrgent = requiredDate ? isToday(requiredDate) : false;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex-1 truncate">
              <p className="font-bold text-sm text-slate-800 truncate" title={project.productName}>{project.productName}</p>
              <Badge variant="outline" className="text-xs font-mono mt-1">{project.workOrderId}</Badge>
            </div>
            {isUrgent && (
              <div className="flex items-center gap-1.5 text-amber-600 animate-pulse">
                <Bell size={16} />
                <span className="text-xs font-bold">今日需完成</span>
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <h4 className="font-bold">{project.productName}</h4>
            <div className="space-y-2">
              <InfoItem icon={<ClipboardList size={14}/>} label="工單號碼" value={project.workOrderId} />
              <InfoItem icon={<Package size={14}/>} label="品名" value={project.productName} />
              <InfoItem icon={<UserIcon size={14}/>} label="負責人" value={project.tester} />
              <InfoItem icon={<Calendar size={14}/>} label="預計完成日" value={project.estimatedDate} />
              <InfoItem icon={<Info size={14}/>} label="測試項目" value={project.workOrderId?.startsWith('C') ? '尺寸量測' : formatTestDetails(project.testDetails)} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };
  
  if (!user) return null;

  return (
    <div className="space-y-6 mb-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">個人即時看板</h1>
        </div>
        
        <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 mb-1">
                <div className="flex items-center gap-2">
                    <UserIcon size={16} className="text-slate-400" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">篩選測試者</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSelectedTesterNames(['all'])}
                        className="text-xs font-bold text-blue-600 hover:underline transition-all cursor-pointer"
                    >
                        全部選擇
                    </button>
                    <button
                        onClick={() => setSelectedTesterNames([])}
                         className="text-xs font-bold text-rose-600 hover:underline transition-all cursor-pointer"
                    >
                        全部清除
                    </button>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
                <label
                    className={cn(
                        "flex items-center gap-2 cursor-pointer rounded-lg border-2 text-xs font-bold transition-all px-3 py-2",
                        selectedTesterNames.includes('all')
                            ? "bg-blue-600 text-white border-transparent shadow-md"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                >
                    <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedTesterNames.includes('all')}
                        onChange={() => toggleTester('all')}
                    />
                    <span>所有人</span>
                </label>
                
                {allTesters.map((name) => {
                    const isSelected = selectedTesterNames.includes(name);
                    const isMe = name === user.name;
                    return (
                        <label
                            key={name}
                            className={cn(
                                "flex items-center gap-2 cursor-pointer rounded-lg border-2 text-xs font-bold transition-all px-3 py-2",
                                isSelected
                                    ? "bg-blue-600 text-white border-transparent shadow-md"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                        >
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={isSelected}
                                onChange={() => toggleTester(name)}
                            />
                            <span>{isMe ? `${name} (自己)` : name}</span>
                        </label>
                    );
                })}
            </div>
        </div>
      </div>
      {(newProjects.length > 0 || newSchedules.length > 0) && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
           <div className="mb-4">
             <h2 className="text-lg font-bold text-blue-800 flex items-center gap-2"><Sparkles size={20} /> 最新動態</h2>
             <p className="text-sm text-blue-700/80 mt-1 ml-1">顯示規則：今日新進的案件 (依開始日期)，以及 24 小時內有更新的機台排程。</p>
           </div>
           <div className="space-y-3">
            {newProjects.length > 0 && (
                <div>
                    <h3 className="font-semibold text-blue-700 text-sm mb-2">✨ 今日新進案件</h3>
                    <div className="flex flex-wrap gap-2">
                        {newProjects.map(p => <Badge key={p.id} variant="secondary">{p.workOrderId}</Badge>)}
                    </div>
                </div>
            )}
             {newSchedules.length > 0 && (
                <div>
                    <h3 className="font-semibold text-blue-700 text-sm mb-2"><CalendarPlus size={16} className="inline-block mr-1"/> 24hr 內更新的機台排程</h3>
                    <div className="space-y-1">
                        {newSchedules.map((schedule) => (
                            <div key={schedule.id} className="text-xs p-1.5 rounded-md bg-blue-100/50 text-blue-900">
                                <strong>{schedule.date}</strong>: {schedule.equipmentName} - {schedule.productName}
                            </div>
                        ))}
                    </div>
                </div>
            )}
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <TaskSection title="進行中" icon={<FlaskConical className="text-blue-500" />} count={myTasks.inProgress.length}>
          {myTasks.inProgress.map(p => <TaskItem key={p.id} project={p} />)}
        </TaskSection>
        
        <TaskSection title="今日需完成" icon={<Clock className="text-amber-500" />} count={myTasks.dueToday.length}>
          {myTasks.dueToday.map(p => <TaskItem key={p.id} project={p} />)}
        </TaskSection>

        <TaskSection title="已延遲" icon={<AlertCircle className="text-red-500" />} count={myTasks.delayed.length} isDelayed>
          {myTasks.delayed.map(p => <TaskItem key={p.id} project={p} />)}
        </TaskSection>
        <UpcomingSchedulesCard schedules={upcomingSchedules} />
      </div>

      <ProjectCalendar
        projects={schedulePageProjects}
        maintenanceProjects={maintenanceProjects}
        machineScheduleProjects={machineScheduleProjects}
        engineers={engineers}
        selectedEngineers={selectedTesterNames}
      />
    </div>
  );
}

const TaskSection = ({ title, icon, count, children, isDelayed = false }: { title: string, icon: React.ReactNode, count: number, children: React.ReactNode, isDelayed?: boolean }) => (
  <div className={cn("p-4 rounded-2xl border bg-white flex flex-col", isDelayed && "bg-red-50 border-red-200")}>
    <div className="flex items-center justify-between mb-3 px-2">
      <h3 className="font-bold text-slate-600 flex items-center gap-2">{icon} {title}</h3>
      <Badge variant={isDelayed ? 'destructive' : 'secondary'}>{count}</Badge>
    </div>
    <div className="space-y-2 flex-1 overflow-y-auto max-h-60 custom-scrollbar pr-1">
        {count > 0 ? children : <p className="text-center text-xs text-slate-400 pt-8">無相關案件</p>}
    </div>
  </div>
);

const UpcomingSchedulesCard: React.FC<{schedules: {schedule: MachineSchedule, type: 'start' | 'end'}[]}> = ({ schedules }) => {
  return (
    <div className="p-6 rounded-2xl border border-cyan-200 bg-cyan-50">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-cyan-600">未來3個工作日機台排程</h3>
          <p className="text-xs text-slate-500 font-medium">共 {schedules.length} 筆開始/結束的排程</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-100 text-cyan-600">
          <CalendarCheck />
        </div>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
        {schedules.length > 0 ? schedules.map(({schedule, type}) => (
          <Popover key={`${schedule.id}-${type}`}>
            <PopoverTrigger asChild>
              <div className="bg-white/80 rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3 cursor-pointer hover:bg-white transition-colors">
                <div className="flex justify-between">
                    <p className="font-bold text-sm text-slate-800">{schedule.equipmentName}</p>
                    <Badge variant="outline" className={cn(type === 'start' ? 'border-green-300 text-green-700 bg-green-50' : 'border-red-300 text-red-700 bg-red-50')}>{type === 'start' ? '始' : '終'}</Badge>
                </div>
                <div className="flex justify-between items-center mt-1 text-xs">
                  <span className="font-mono text-cyan-700 font-semibold">{schedule.date}</span>
                  <span className="font-semibold text-slate-600">{schedule.tester}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate" title={schedule.productName}>{schedule.productName}</p>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-bold">{schedule.equipmentName}</h4>
                <div className="space-y-2">
                  <InfoItem icon={<Server size={14}/>} label="機台編號" value={schedule.equipmentId} />
                  <InfoItem icon={<ClipboardList size={14}/>} label="工單號碼" value={schedule.workOrder} />
                  <InfoItem icon={<Package size={14}/>} label="品名" value={schedule.productName} />
                  <InfoItem icon={<UserIcon size={14}/>} label="負責人" value={schedule.tester} />
                  <InfoItem icon={<UserIcon size={14}/>} label="委測者" value={schedule.client} />
                   <InfoItem icon={<Calendar size={14}/>} label="排程日期" value={schedule.date} />
                   <InfoItem icon={<Info size={14}/>} label="測試項目" value={schedule.workOrder?.startsWith('C') ? '尺寸量測' : null} />
                   <InfoItem icon={<Info size={14}/>} label="測試備註" value={schedule.notes} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )) : (
          <div className="h-40 flex items-center justify-center text-sm text-slate-400 font-medium">無即將到來的排程</div>
        )}
      </div>
    </div>
  )
};

export default PersonalDashboard;

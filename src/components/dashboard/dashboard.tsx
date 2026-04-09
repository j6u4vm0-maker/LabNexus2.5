'use client';

// Dashboard 現在只負責「呈現」——不做任何資料計算。
// 所有統計數字由 server 端 sqlite-api.ts 計算好後透過 props 傳入。
// 日期切換時透過 Server Action 重新取資料。

import React, { useState, useTransition } from 'react';
import type { ProjectData, TestDetails } from '@/lib/schedule-types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { format, subMonths, addMonths, startOfWeek, endOfWeek, subWeeks, addWeeks, addDays } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Server, User, FileText, ChevronDown, Activity, CalendarX, Package } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Table } from "@/components/ui/table";
import { STATUS_CSS_VARS } from '@/lib/constants';
import { Card } from '@/components/ui/card';
import type { DashboardStats } from '@/lib/sqlite-api';
import { getFullDashboardData } from '@/lib/sqlite-api';

interface DashboardProps {
  initialStats: DashboardStats;
  initialDateStr: string;
}

const formatTestDetails = (details: TestDetails | undefined, workOrderId?: string) => {
  // 最高優先判斷：C 開頭工單一律顯示「尺寸量測」
  if (workOrderId && workOrderId.trim().toUpperCase().startsWith('C')) return '尺寸量測';
  if (!details) return '無測試項目';
  const parts = [details.dimensions, details.force, details.electrical, details.material, details.environment, details.other].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '無測試項目';
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g style={{ filter: 'drop-shadow( 2px 4px 6px rgba(0,0,0,0.2))' }}>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 4} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ initialStats, initialDateStr }) => {
  const [analysisDate, setAnalysisDate] = useState(new Date(initialDateStr));
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [clickedStatus, setClickedStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateDate = (newDate: Date) => {
    setAnalysisDate(newDate);
    const dateStr = format(newDate, 'yyyy-MM-dd');
    startTransition(async () => {
      const newStats = await getFullDashboardData(dateStr);
      setStats(newStats);
    });
  };

  // Pie chart data
  const allStatusStats = stats.statusGroups.flatMap(g => g.stats);
  const pieData = allStatusStats.filter(s => s.value > 0);
  const largeSliceIndices = pieData.map((item, index) => item.value > 100 ? index : -1).filter(i => i !== -1);
  const clickedSliceIndex = clickedStatus ? pieData.findIndex(d => d.name === clickedStatus) : -1;
  const activeIndices = Array.from(new Set([...largeSliceIndices, ...(clickedSliceIndex > -1 ? [clickedSliceIndex] : [])]));

  return (
    <div className={cn("space-y-8 animate-in fade-in duration-500", isPending && "opacity-60 transition-opacity")}>
      {/* 日期控制列 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold text-slate-800">數據分析期間</h3>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100">
            <button onClick={() => updateDate(subMonths(analysisDate, 1))} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all" title="上個月"><ChevronLeft size={16} /></button>
            <span className="text-sm font-black text-slate-700 min-w-[100px] text-center">{format(analysisDate, 'yyyy年 MM月', { locale: zhTW })}</span>
            <button onClick={() => updateDate(addMonths(analysisDate, 1))} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all" title="下個月"><ChevronRight size={16} /></button>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100">
            <button onClick={() => updateDate(subWeeks(analysisDate, 1))} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all" title="上一週"><ChevronLeft size={16} /></button>
            <span className="text-sm font-black text-slate-700 min-w-[140px] text-center">
              {format(startOfWeek(analysisDate), 'MM/dd')} - {format(endOfWeek(analysisDate), 'MM/dd')}
            </span>
            <button onClick={() => updateDate(addWeeks(analysisDate, 1))} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all" title="下一週"><ChevronRight size={16} /></button>
          </div>
          <Button variant="outline" onClick={() => updateDate(new Date())}>回到今天</Button>
        </div>
      </div>

      {/* 主要圖表區 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 案件狀態分布圓餅圖 */}
        <div className="lg:col-span-2 bg-kst-navy p-8 rounded-3xl shadow-2xl border border-white/10 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className='flex items-center gap-2'>
              <span className="w-1.5 h-6 bg-kst-lime rounded-full"></span>
              <h3 className="text-lg font-bold text-white">
                案件狀態分布分析 ({format(analysisDate, 'MMMM', { locale: zhTW })})
              </h3>
            </div>
            <span className="text-xs font-bold text-kst-navy bg-kst-lime px-3 py-1.5 rounded-full shadow-sm">
              本月統計: {stats.analysisMonthProjects.length} 件
            </span>
          </div>
          <p className="text-xs text-slate-300 font-medium mb-6 ml-4">實驗中/延遲中為<span className="text-kst-lime font-bold">年度累積</span>；已完成/已取消為<span className="text-kst-lime font-bold">本月統計</span>。</p>

          <div className="relative h-[450px] -mt-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[220px] h-[220px] rounded-full shadow-[inset_0_8px_20px_rgba(0,0,0,0.5)] bg-slate-800/20"></div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-4xl font-black text-white [text-shadow:0_0_12px_hsl(var(--primary))]">{stats.analysisMonthProjects.length}</span>
              <span className="text-xs font-bold text-slate-300">本月案件統計</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart onClick={(data: any) => data?.activePayload?.[0]?.name && setClickedStatus(prev => prev === data.activePayload[0].name ? null : data.activePayload[0].name)}>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  labelLine={false}
                  innerRadius={120} outerRadius={150}
                  paddingAngle={2} dataKey="value" nameKey="name"
                  className="cursor-pointer"
                  activeIndex={activeIndices}
                  activeShape={renderActiveShape}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '1rem', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1 pt-4 border-t border-white/10">
            {allStatusStats.map((item) => (
              <div
                key={item.name}
                className={cn(
                  'flex flex-col justify-center p-3 rounded-2xl transition-all duration-300 border-2 hover:border-kst-lime hover:shadow-lg hover:bg-white/5 cursor-pointer',
                  clickedStatus === item.name && 'ring-2 ring-offset-2 ring-kst-lime ring-offset-kst-navy'
                )}
                style={{ backgroundColor: item.color, borderColor: item.color }}
                onClick={() => setClickedStatus(prev => prev === item.name ? null : item.name)}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.foregroundColor }}></div>
                  <span className="text-sm font-bold" style={{ color: item.foregroundColor }}>{item.name}</span>
                </div>
                <span
                  className="text-[10px] font-semibold mb-1 pl-4"
                  style={{ color: item.foregroundColor, opacity: 0.75 }}
                >
                  {(item.name === '實驗中' || item.name === '延遲中') ? '年度累積' : '本月統計'}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black" style={{ color: item.foregroundColor }}>{item.value}</span>
                  <span className="text-sm font-semibold" style={{ color: item.foregroundColor }}>件</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右側：工程師負載 + 稼動率 */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className='mb-2 flex items-center gap-2'>
              <span className="w-1.5 h-6 bg-kst-navy rounded-full"></span>
              <h3 className="text-lg font-bold text-slate-800">工程師負載</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium mb-6 ml-4">統計每位工程師目前手上未完成的案件數量。</p>
            <div className="space-y-6">
              {stats.testerStats.length > 0 ? stats.testerStats.slice(0, 5).map((tester) => (
                <div key={tester.name} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-slate-700">{tester.name}</span>
                    <span className="text-xs font-black text-blue-600">{tester.count} 案件</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-kst-navy transition-all duration-1000"
                      style={{ width: `${(tester.count / (stats.testerStats[0]?.count || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )) : (
                <p className="text-center text-gray-400 py-10">尚無人員指派數據</p>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className='mb-2 flex items-center gap-2'>
              <Activity className="text-kst-navy" />
              <h3 className="text-lg font-bold text-slate-800">機台類別稼動率</h3>
            </div>
            <p className="text-xs text-slate-400 font-medium mb-6 ml-4">未來一周各類別平均稼動率；前五名者</p>
            <div className="space-y-6">
              {stats.topCategoriesNextWeek.length > 0 ? stats.topCategoriesNextWeek.map((category, index) => (
                <div key={category.name} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-slate-700">{index + 1}. {category.name}</span>
                    <span className="text-sm font-black text-amber-600">{category.rate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-kst-lime transition-all duration-1000" style={{ width: `${category.rate}%` }}></div>
                  </div>
                </div>
              )) : (
                <p className="text-center text-gray-400 py-10">尚無稼動率數據</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 進度卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ProgressCard title={`${stats.currentYear} 年度進度`} subtitle="年度案件達成率" total={stats.yearlyTotal} done={stats.yearlyDone} icon={<span className="font-bold">Y</span>} color="blue" formula="今年完成件數 / 今年預計完成日件數" />
        <ProgressCard title={`${stats.currentMonthLabel} 月份進度`} subtitle="當月案件達成率" total={stats.monthlyTotal} done={stats.monthlyDone} icon={<span className="font-bold">M</span>} color="indigo" formula="當月完成件數 / 當月預計完成日件數" />
        <ProgressCard title="本週案件件數" subtitle="本週案件數量統計" total={0} done={stats.weeklyTotal} icon={<span className="font-bold">W</span>} color="emerald" countLabel="案件件數" />
      </div>

      {/* 詳細案件清單 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        <UpcomingMachineCasesCard projects={stats.upcomingMachineCases} />
        <DetailedCasesCard title="已延遲案件 (未完成)" subtitle={`共 ${stats.delayedProjects.length} 件已超過預計完成日的案件`} icon={<CalendarX />} color="rose" projects={stats.delayedProjects} />
        <DetailedCasesCard title="本週即將到期 (未完成)" subtitle={`共 ${stats.dueThisWeekProjects.length} 件預計在本週完成的案件`} icon={<Clock />} color="amber" projects={stats.dueThisWeekProjects} />
      </div>
    </div>
  );
};

// ==========================================
// Sub-Components
// ==========================================

interface ProgressCardProps {
  title: string; subtitle: string; total: number; done: number;
  icon: React.ReactNode; color: 'blue' | 'indigo' | 'emerald' | 'rose' | 'amber';
  countLabel?: string; formula?: string;
}

const ProgressCard: React.FC<ProgressCardProps> = ({ title, subtitle, total, done, icon, color, countLabel = "案件件數", formula }) => {
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
  const progressColorStyle = { blue: 'bg-blue-600', indigo: 'bg-indigo-600', emerald: 'bg-emerald-600', rose: 'bg-rose-600', amber: 'bg-amber-600' }[color];
  const textColorStyle = { blue: 'text-blue-600', indigo: 'text-indigo-600', emerald: 'text-emerald-600', rose: 'text-rose-600', amber: 'text-amber-600' }[color];

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md hover:border-kst-lime transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h4>
          <p className="text-xs text-slate-600 font-bold mt-1">{subtitle}</p>
          {formula && <p className="text-xs text-slate-500 font-mono mt-2 bg-slate-50 rounded-md px-2 py-1 inline-block border border-slate-200">{formula}</p>}
        </div>
        <div className={`w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shadow-sm border border-gray-100 shrink-0 ${textColorStyle}`}>{icon}</div>
      </div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800">{done}</span>
            {total > 0 && <span className="text-sm font-bold text-slate-400">/ {total}</span>}
          </div>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase">{countLabel}</p>
        </div>
        {total > 0 && (
          <div className="text-right">
            <span className={`text-2xl font-black ${textColorStyle}`}>{percentage}%</span>
            <p className="text-xs font-bold text-gray-400 mt-1 uppercase">完成率</p>
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="h-2 w-full bg-gray-200/50 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${progressColorStyle}`} style={{ width: `${percentage}%` }}></div>
        </div>
      )}
    </div>
  );
};

interface DetailedCasesCardProps {
  title: string; subtitle: string; icon: React.ReactNode;
  color: 'rose' | 'amber'; projects: ProjectData[];
}

const DetailedCasesCard: React.FC<DetailedCasesCardProps> = ({ title, subtitle, icon, color, projects }) => {
  const styles = {
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', iconBg: 'bg-rose-100' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', iconBg: 'bg-amber-100' },
  }[color];

  return (
    <div className={`p-6 rounded-3xl shadow-sm border ${styles.border} ${styles.bg}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className={`text-lg font-bold ${styles.text}`}>{title}</h3>
          <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${styles.iconBg} ${styles.text}`}>{icon}</div>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
        {projects.length > 0 ? projects.map(p => (
          <Collapsible key={p.id} className="bg-white/80 rounded-2xl border border-slate-200/80 shadow-sm px-4 py-2">
            <CollapsibleTrigger className="w-full text-left flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${styles.border} ${styles.bg}`}>{p.workOrderId || p.id}</span>
                <p className="text-sm font-bold text-slate-800">{p.productName}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform [&[data-state=open]]:-rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 mt-2 border-t border-slate-200/80 space-y-2">
              <InfoItem icon={<User size={14} />} label="負責人" value={p.tester} />
              <InfoItem icon={<Server size={14} />} label="料號" value={p.partNo || 'N/A'} />
              <InfoItem icon={<FileText size={14} />} label="測試項目" value={formatTestDetails(p.testDetails, p.workOrderId)} />
            </CollapsibleContent>
          </Collapsible>
        )) : (
          <div className="h-40 flex items-center justify-center text-sm text-slate-400 font-medium">無相關案件</div>
        )}
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2 text-xs">
    <div className="flex items-center gap-1.5 text-slate-500 font-semibold w-20 shrink-0">{icon} {label}</div>
    <div className="text-slate-700 font-medium break-words">{value}</div>
  </div>
);

// 預計投入案件-工作天標籤式卡片
function addWorkingDays(fromDate: Date, days: number): Date {
  let result = new Date(fromDate);
  let added = 0;
  while (added < days) {
    result = addDays(result, 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

type EquipmentScheduleGroup = {
  equipmentId: string;
  equipmentName: string;
  schedules: { workOrder: string; productName: string; partNo: string; client: string; tester: string; startDate: string; endDate: string }[];
};

const UpcomingMachineCasesCard: React.FC<{ projects: EquipmentScheduleGroup[] }> = ({ projects }) => {
  const [selectedDays, setSelectedDays] = useState(1);
  const today = new Date();
  const tabDeadlines = [1, 2, 3].map(d => ({
    days: d,
    label: `${d}個工作天`,
    deadline: addWorkingDays(today, d),
  }));

  // Filter: only show work orders whose START date falls within the N working days window
  const todayStr = format(today, 'yyyy-MM-dd');
  const deadlineStr = format(addWorkingDays(today, selectedDays), 'yyyy-MM-dd');

  const filtered: EquipmentScheduleGroup[] = projects.map(eq => ({
    ...eq,
    schedules: eq.schedules.filter(s => {
      return s.startDate >= todayStr && s.startDate <= deadlineStr;
    }),
  })).filter(eq => eq.schedules.length > 0);

  // Format startDate-endDate as "yyyy/MM/dd-yyyy/MM/dd"
  const formatDateRange = (start: string, end: string) => {
    const fmt = (d: string) => d.replace(/-/g, '/');
    if (start === end) return fmt(start);
    return `${fmt(start)}-${fmt(end)}`;
  };

  return (
    <div className="p-6 rounded-3xl shadow-sm border border-blue-200 bg-blue-50">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-blue-700">預計投入機台案件</h3>
          <p className="text-xs text-slate-500 font-medium">依機台顯示即將投入的排程</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600"><Server size={18} /></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabDeadlines.map(tab => (
          <button
            key={tab.days}
            onClick={() => setSelectedDays(tab.days)}
            className={cn(
              'flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-xs font-bold transition-all border',
              selectedDays === tab.days
                ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-100'
            )}
          >
            <span>{tab.label}</span>
            <span className={cn('text-[10px] mt-0.5 font-semibold', selectedDays === tab.days ? 'text-blue-100' : 'text-slate-400')}>
              至 {format(tab.deadline, 'M/d')} 止
            </span>
          </button>
        ))}
      </div>

      {/* Equipment Groups */}
      <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-2">
        {filtered.length > 0 ? filtered.map(eq => (
          <div key={eq.equipmentId} className="bg-white/90 rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
            {/* Machine Header - shows both ID and name */}
            <div className="px-4 py-2 bg-blue-500 flex items-center gap-2">
              <Server size={13} className="text-white" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">{eq.equipmentName}</span>
                <span className="text-[10px] text-blue-200 font-mono">{eq.equipmentId}</span>
              </div>
              <span className="ml-auto text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full shrink-0">{eq.schedules.length} 件</span>
            </div>
            {/* Work order rows - collapsible */}
            <div className="divide-y divide-blue-50">
              {eq.schedules.map((s, i) => (
                <Collapsible key={i}>
                  <CollapsibleTrigger className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50/50 transition-colors text-left">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="text-xs font-mono font-bold text-blue-700">{s.workOrder}</span>
                      {s.partNo && <span className="text-[10px] text-slate-500 font-medium truncate">{s.partNo}</span>}
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2 transition-transform [&[data-state=open]]:-rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-3 pt-1 bg-blue-50/40 space-y-1.5 border-t border-blue-100">
                    {s.productName && <InfoItem icon={<Package size={12} />} label="品名" value={s.productName} />}
                    {s.workOrder?.startsWith('C') && <InfoItem icon={<FileText size={12} />} label="測試項目" value="尺寸量測" />}
                    {s.client && <InfoItem icon={<User size={12} />} label="委測者" value={s.client} />}
                    {s.tester && <InfoItem icon={<User size={12} />} label="負責人" value={s.tester} />}
                    <InfoItem icon={<FileText size={12} />} label="測試期間" value={formatDateRange(s.startDate, s.endDate)} />
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )) : (
          <div className="h-40 flex items-center justify-center text-sm text-slate-400 font-medium">目前無預計投入案件</div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

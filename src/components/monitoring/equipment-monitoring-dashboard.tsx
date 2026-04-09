'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Brush, LabelList } from 'recharts';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, subDays, subMonths, subYears, isWithinInterval } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { AreaChart, BarChart2, List, Calendar as CalendarIcon, Server } from 'lucide-react';
import type { Equipment } from '@/lib/types';
import type { MachineSchedule } from '@/lib/schedule-types';
import { getWorkingDays, safeParseDate } from '@/lib/date-utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Tooltip as ShadTooltip, TooltipContent as ShadTooltipContent, TooltipProvider, TooltipTrigger as ShadTooltipTrigger } from '@/components/ui/tooltip';

// Props interface
interface EquipmentMonitoringDashboardProps {
  schedules: MachineSchedule[];
  equipments: Equipment[];
}

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#db2777'];
const DEFAULT_ITEMS_IN_VIEW = 15;

const EquipmentMonitoringDashboard: React.FC<EquipmentMonitoringDashboardProps> = ({ schedules, equipments }) => {
  const [viewDate, setViewDate] = useState<Date>();
  const [timeframe, setTimeframe] = useState<'day' | 'month' | 'year'>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setViewDate(new Date());
    setHasMounted(true);
  }, []);

  const allCategories = useMemo(() => ['all', ...Array.from(new Set(equipments.map(e => e.type || '未分類'))).sort((a,b) => a.localeCompare(b, 'zh-Hant'))], [equipments]);

  const {
    interval,
    totalWorkingDays,
    overallUtilization,
    categoryUtilization,
    machineUtilization,
    trendData,
    heatmapData,
    machineTrendData,
  } = useMemo(() => {
    if (!viewDate) {
      return {
        interval: { start: new Date(), end: new Date() },
        totalWorkingDays: 0,
        overallUtilization: 0,
        categoryUtilization: [],
        machineUtilization: [],
        trendData: [],
        heatmapData: [],
        machineTrendData: new Map(),
      };
    }

    let start, end;
    switch (timeframe) {
      case 'day':
        start = startOfDay(viewDate);
        end = endOfDay(viewDate);
        break;
      case 'year':
        start = startOfYear(viewDate);
        end = endOfYear(viewDate);
        break;
      case 'month':
      default:
        start = startOfMonth(viewDate);
        end = endOfMonth(viewDate);
        break;
    }
    
    const intervalWorkingDays = getWorkingDays(start, end);

    // Calculate rates for all machines first
    const allMachineRates = equipments.map(eq => {
      const usedDays = new Set<string>();
      schedules.forEach(s => {
        const scheduleDate = safeParseDate(s.date);
        if (s.equipmentId === eq.id && scheduleDate && isWithinInterval(scheduleDate, { start, end })) {
          usedDays.add(format(scheduleDate, 'yyyy-MM-dd'));
        }
      });
      
      if (eq.status === '維修' || eq.status === '校正') {
         eachDayOfInterval({ start, end }).forEach(day => {
          usedDays.add(format(day, 'yyyy-MM-dd'));
        });
      } else if (eq.calibrationDate) {
        const calDate = safeParseDate(eq.calibrationDate);
        if (calDate && isWithinInterval(calDate, { start, end })) {
          usedDays.add(format(calDate, 'yyyy-MM-dd'));
        }
      }
      
      const usedDaysCount = usedDays.size;
      const rate = intervalWorkingDays > 0 ? (usedDaysCount / intervalWorkingDays) * 100 : 0;
      return {
        id: eq.id,
        name: eq.name,
        category: eq.type || '未分類',
        rate: Math.min(100, rate),
        usedDays: usedDaysCount,
        totalDays: intervalWorkingDays
      };
    });

    // Calculate category utilization from all machines
    const categoryRatesMap = new Map<string, { totalRate: number, count: number }>();
    allMachineRates.forEach(machine => {
      if (!categoryRatesMap.has(machine.category)) {
        categoryRatesMap.set(machine.category, { totalRate: 0, count: 0 });
      }
      const category = categoryRatesMap.get(machine.category)!;
      category.totalRate += machine.rate;
      category.count++;
    });
    const calculatedCategoryUtilization = Array.from(categoryRatesMap.entries()).map(([name, { totalRate, count }]) => ({
      name,
      rate: count > 0 ? totalRate / count : 0,
    })).sort((a, b) => b.rate - a.rate);

    // Filter machines based on selected category for machine-specific views
    const filteredMachineRates = allMachineRates
      .filter(m => selectedCategory === 'all' || m.category === selectedCategory)
      .sort((a,b) => b.rate - a.rate);
      
    const filteredEquipmentsForCalcs = selectedCategory === 'all' ? equipments : equipments.filter(e => (e.type || '未分類') === selectedCategory);

    // Calculate overall utilization based on filtered machines
    const totalUsedDays = filteredMachineRates.reduce((sum, machine) => sum + machine.usedDays, 0);
    const overallRate = (intervalWorkingDays * filteredEquipmentsForCalcs.length) > 0 ? (totalUsedDays / (intervalWorkingDays * filteredEquipmentsForCalcs.length)) * 100 : 0;

    // Trend data calculation
    let trendPeriods: Date[] = [];
    if (timeframe === 'month') {
        trendPeriods = eachMonthOfInterval({ start: startOfYear(viewDate), end: endOfYear(viewDate) });
    } else if (timeframe === 'year') {
        trendPeriods = Array.from({length: 5}, (_, i) => subYears(viewDate, 4 - i));
    } else { // day
        trendPeriods = Array.from({length: 30}, (_, i) => subDays(viewDate, 29 - i));
    }

    const calculatedTrendData = trendPeriods.map(periodStart => {
        let pStart, pEnd, label;
        if (timeframe === 'month') {
            pStart = startOfMonth(periodStart); pEnd = endOfMonth(periodStart); label = format(pStart, 'MMM', { locale: zhTW });
        } else if (timeframe === 'year') {
            pStart = startOfYear(periodStart); pEnd = endOfYear(periodStart); label = format(pStart, 'yyyy');
        } else {
            pStart = startOfDay(periodStart); pEnd = endOfDay(periodStart); label = format(pStart, 'MM/dd');
        }
        const workingDaysInPeriod = getWorkingDays(pStart, pEnd);
        let totalUsedInPeriod = 0;
        filteredEquipmentsForCalcs.forEach(eq => {
            const machineUsedDays = new Set<string>();
            schedules.forEach(s => {
                const sDate = safeParseDate(s.date);
                if (s.equipmentId === eq.id && sDate && isWithinInterval(sDate, { start: pStart, end: pEnd })) {
                    machineUsedDays.add(format(sDate, 'yyyy-MM-dd'));
                }
            });
            totalUsedInPeriod += machineUsedDays.size;
        });
        const totalPossibleDays = workingDaysInPeriod * filteredEquipmentsForCalcs.length;
        const rate = totalPossibleDays > 0 ? (totalUsedInPeriod / totalPossibleDays) * 100 : 0;
        return { name: label, rate: parseFloat(rate.toFixed(1)) };
    });

    const machineTrends = new Map<string, { name: string; rate: number }[]>();
    filteredEquipmentsForCalcs.forEach(eq => {
        const machineSchedules = schedules.filter(s => s.equipmentId === eq.id);
        const trendPoints = trendPeriods.map(periodStart => {
            let pStart, pEnd, label;
            if (timeframe === 'month') {
                pStart = startOfMonth(periodStart); pEnd = endOfMonth(periodStart); label = format(pStart, 'MMM', { locale: zhTW });
            } else if (timeframe === 'year') {
                pStart = startOfYear(periodStart); pEnd = endOfYear(periodStart); label = format(pStart, 'yyyy');
            } else {
                pStart = startOfDay(periodStart); pEnd = endOfDay(periodStart); label = format(pStart, 'MM/dd');
            }
            const workingDaysInPeriod = getWorkingDays(pStart, pEnd);
            const usedDaysInPeriod = new Set<string>();
            machineSchedules.forEach(s => {
                const sDate = safeParseDate(s.date);
                if (sDate && isWithinInterval(sDate, { start: pStart, end: pEnd })) {
                    usedDaysInPeriod.add(format(sDate, 'yyyy-MM-dd'));
                }
            });
            if (eq.status === '維修' || eq.status === '校正') {
              eachDayOfInterval({ start: pStart, end: pEnd }).forEach(day => { usedDaysInPeriod.add(format(day, 'yyyy-MM-dd')); });
            } else if (eq.calibrationDate) {
              const calDate = safeParseDate(eq.calibrationDate);
              if (calDate && isWithinInterval(calDate, { start: pStart, end: pEnd })) { usedDaysInPeriod.add(format(calDate, 'yyyy-MM-dd')); }
            }
            const rate = workingDaysInPeriod > 0 ? (usedDaysInPeriod.size / workingDaysInPeriod) * 100 : 0;
            return { name: label, rate: parseFloat(rate.toFixed(1)) };
        });
        machineTrends.set(eq.id, trendPoints);
    });

    const monthDays = eachDayOfInterval({start: startOfMonth(viewDate), end: endOfMonth(viewDate)});
    const calculatedHeatmapData = filteredEquipmentsForCalcs.map(eq => {
      const days = monthDays.map(day => {
        let status: 'used' | 'idle' | 'maintenance' | 'calibration' = 'idle';
        const dateStr = format(day, 'yyyy-MM-dd');
        const isScheduled = schedules.some(s => s.equipmentId === eq.id && s.date === dateStr);
        const isCalibration = eq.calibrationDate === dateStr;
        const isMaintenance = eq.status === '維修' || eq.status === '校正';
        if (isScheduled) status = 'used';
        else if (isMaintenance) status = 'maintenance';
        else if (isCalibration) status = 'calibration';
        return { date: dateStr, status };
      });
      return { machineName: eq.name, machineId: eq.id, days };
    });

    return {
      interval: { start, end },
      totalWorkingDays: intervalWorkingDays,
      overallUtilization: overallRate,
      categoryUtilization: calculatedCategoryUtilization,
      machineUtilization: filteredMachineRates,
      trendData: calculatedTrendData,
      heatmapData: calculatedHeatmapData,
      machineTrendData: machineTrends
    };
  }, [viewDate, timeframe, selectedCategory, equipments, schedules]);
  
  const dataForChart = selectedCategory === 'all' ? categoryUtilization : machineUtilization;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>設備稼動率分析儀表板</CardTitle>
          <CardDescription>監控並分析所有測試設備的使用率。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as any)} className="w-auto">
              <TabsList>
                <TabsTrigger value="day">日</TabsTrigger>
                <TabsTrigger value="month">月</TabsTrigger>
                <TabsTrigger value="year">年</TabsTrigger>
              </TabsList>
            </Tabs>
             <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-[280px] justify-start text-left font-normal", !viewDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {viewDate ? format(viewDate, "PPP", { locale: zhTW }) : <span>選擇日期</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={viewDate} onSelect={setViewDate} initialFocus/>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>
      
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AreaChart size={20}/> 整體設備使用率</CardTitle>
          <CardDescription>
             {viewDate && format(interval.start, 'yyyy/MM/dd')} - {viewDate && format(interval.end, 'yyyy/MM/dd')} 期間內，
             {selectedCategory === 'all' ? '所有設備' : `「${selectedCategory}」類別`}
             的總體稼動率。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border">
                <div className="text-6xl font-black text-primary">{overallUtilization.toFixed(1)}<span className="text-3xl ml-1">%</span></div>
                <div className="text-sm font-bold text-slate-500 mt-2">總體平均使用率</div>
            </div>
            <div className="md:col-span-2 h-[250px]">
                {hasMounted && trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis unit="%" fontSize={12} domain={[0, 100]} />
                            <Tooltip contentStyle={{ borderRadius: '1rem' }} formatter={(value) => [`${value}%`, '使用率']} />
                            <Legend wrapperStyle={{fontSize: "12px"}}/>
                            <Line type="monotone" dataKey="rate" name="使用率趨勢" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">正在計算趨勢數據...</div>
                )}
            </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart2 size={20} /> 
               {selectedCategory === 'all' ? '各類別設備使用率' : `「${selectedCategory}」類使用率`}
            </CardTitle>
            <CardDescription>
              {selectedCategory === 'all' ? '比較不同設備類別的平均使用率。' : `顯示「${selectedCategory}」類別下，各獨立機台的使用率。`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {allCategories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-4 py-2 text-sm font-bold rounded-full border transition-all duration-150 shadow-sm",
                      selectedCategory === cat
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    )}
                  >
                      {cat === 'all' ? '所有類別' : cat}
                  </button>
              ))}
            </div>
            <div className="h-[400px] w-full">
              {hasMounted && dataForChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataForChart} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={false} axisLine={false} />
                    <YAxis unit="%" domain={[0, 100]} fontSize={12} allowDataOverflow={false} />
                    <Tooltip contentStyle={{ borderRadius: '1rem' }} formatter={(value) => `${(value as number).toFixed(1)}%`} />
                    <Legend wrapperStyle={{fontSize: "12px", paddingTop: '20px'}}/>
                    <Bar dataKey="rate" name="平均使用率" radius={[4, 4, 0, 0]} maxBarSize={50}>
                        <LabelList dataKey="name" angle={-90} position="center" style={{ fill: 'white', fontSize: '12px', fontWeight: 'bold' }} />
                        {dataForChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                    </Bar>
                     {dataForChart.length > DEFAULT_ITEMS_IN_VIEW && (
                        <Brush 
                            dataKey="name" 
                            height={30} 
                            stroke="#3b82f6"
                            startIndex={0}
                            endIndex={DEFAULT_ITEMS_IN_VIEW - 1}
                        >
                            <BarChart>
                                <XAxis dataKey="name" hide />
                                <Bar dataKey="rate" fill="#3b82f6" fillOpacity={0.5} />
                            </BarChart>
                        </Brush>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    {hasMounted ? '此分類無數據' : '正在載入圖表...'}
                </div>
              )}
            </div>
          </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><List size={20} /> 單一機台使用率分析</CardTitle>
          <CardDescription>列表呈現篩選範圍內每台獨立機台的使用率與歷史趨勢。</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {machineUtilization.map(machine => {
            const trend = machineTrendData.get(machine.id) || [];
            return (
              <Card key={machine.id} className="flex flex-col overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base truncate" title={machine.name}>{machine.name}</CardTitle>
                  <CardDescription className="truncate">{machine.category} / {machine.id}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end">
                  <div className="h-[80px] -ml-6 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <Tooltip contentStyle={{ borderRadius: '0.5rem', fontSize: '12px', padding: '4px 8px' }} formatter={(value) => [`${value}%`, '使用率']} labelStyle={{display: 'none'}} />
                        <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-semibold text-slate-500">當前使用率</span>
                      <span className="text-xl font-bold text-primary">{machine.rate.toFixed(1)}%</span>
                    </div>
                    <Progress value={machine.rate} />
                    <div className="text-xs text-slate-400 font-medium mt-1 text-right">{machine.usedDays} / {machine.totalDays} 天</div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </CardContent>
      </Card>
      
    </div>
  );
};

export default EquipmentMonitoringDashboard;

'use client';
import React, { useMemo, useState } from 'react';
import { ProjectData } from '@/lib/schedule-types';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth, addDays, subMonths, addMonths } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { getWorkingDays, isWorkingDay, safeParseDate } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, LineChart, Line, CartesianGrid, LabelList, ComposedChart } from 'recharts';
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, TrendingUp, FileSpreadsheet, Percent, Target, Clock, BarChart2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import * as XLSX from 'xlsx-js-style';
import { useToast } from '@/hooks/use-toast';


interface KpiDashboardProps {
  projects: ProjectData[];
}

const kpiConfig = [
  { id: 'onTimeRate', name: '工服準時達成率', unit: '%', target: 99, higherIsBetter: true },
  { id: 'rejectionRate', name: '工服報告錯誤退回率', unit: '%', target: 8, higherIsBetter: false },
  { id: 'signingTimeliness', name: '工服報告簽署時效', unit: '件', target: 1, higherIsBetter: false },
];

const KpiDashboard: React.FC<KpiDashboardProps> = ({ projects }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { toast } = useToast();

  const {
    monthlyData,
    lateCompletionProjects,
    rejectedProjects,
    lateSigningProjects,
    trendData,
  } = useMemo(() => {
    const nonMaintenanceProjects = projects.filter(p => p.status !== '設備保養' && p.status !== '設備保養完成');
    const projectsInMonth = nonMaintenanceProjects.filter(p => {
        const estDate = safeParseDate(p.estimatedDate);
        return estDate && isSameMonth(estDate, currentMonth);
    });
    const totalCasesInMonth = projectsInMonth.length;
    
    // KPI 1: On-Time Completion (準時完成件數(完成日期<=預計完成日))
    const onTimeCases = projectsInMonth.filter(p => {
        const estDate = safeParseDate(p.estimatedDate);
        const endDate = safeParseDate(p.endDate);
        if (!estDate || !endDate) return false; // Must be completed to be on-time
        return endDate <= estDate;
    });
    const onTimeCasesCount = onTimeCases.length;
    const onTimeRate = totalCasesInMonth > 0 ? (onTimeCasesCount / totalCasesInMonth) * 100 : 0;
    
    // For abnormal tracking, "late" is now after the estimated date
    const lateCompletionProjects = projectsInMonth.filter(p => {
        const estDate = safeParseDate(p.estimatedDate);
        const endDate = safeParseDate(p.endDate);
        if (!estDate) return false; 
        
        // 1. If completed, was it late?
        if (endDate) {
            return endDate > estDate;
        }
        
        // 2. If not yet completed, is it passed the due date? (Actual delay)
        const today = new Date(currentMonth); // Using the selected month's context, but generally "late" is against current reality
        const realToday = new Date();
        realToday.setHours(0, 0, 0, 0);
        return realToday > estDate;
    });
    
    // KPI 2: Rejection Rate
    const rejectedProjects = projectsInMonth.filter(p => (p.rejectionCount || 0) > 0);
    const totalRejections = rejectedProjects.reduce((sum, p) => sum + (p.rejectionCount || 0), 0);
    const rejectionRate = totalCasesInMonth > 0 ? (totalRejections / totalCasesInMonth) * 100 : 0;
    
    // KPI 3: Signing Timeliness
    const lateSigningProjects = projectsInMonth.filter(p => {
        const endDate = safeParseDate(p.endDate);
        const auditDate = safeParseDate(p.auditTime);
        if (!endDate || !auditDate) return false;
        const oneDayAfterEnd = addDays(endDate, 1);
        if (auditDate < oneDayAfterEnd) return false;
        // The duration (inclusive) is greater than 4 working days, which means the time elapsed is > 3 working days.
        return getWorkingDays(oneDayAfterEnd, auditDate) > 4;
    });

    const calculatedMonthlyData = {
      totalCasesInMonth,
      onTimeRate,
      rejectionRate,
      signingTimeliness: lateSigningProjects.length,
    };

    const yearStart = startOfMonth(new Date(currentMonth.getFullYear(), 0, 1));
    const yearEnd = endOfMonth(new Date(currentMonth.getFullYear(), 11, 1));
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    const calculatedTrendData = months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const projectsInCurrentMonth = nonMaintenanceProjects.filter(p => {
        const estDate = safeParseDate(p.estimatedDate);
        return estDate && format(estDate, 'yyyy-MM') === monthStr;
      });
      
      const totalCases = projectsInCurrentMonth.length;
      const totalCost = projectsInCurrentMonth.reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
      
      const onTimeCasesForTrend = projectsInCurrentMonth.filter(p => {
          const estDate = safeParseDate(p.estimatedDate);
          const endDate = safeParseDate(p.endDate);
          if (!estDate || !endDate) return false;
          return endDate <= estDate;
      }).length;
      const onTimeRate = totalCases > 0 ? (onTimeCasesForTrend / totalCases) * 100 : 0;
      
      const totalRejections = projectsInCurrentMonth.reduce((sum, p) => sum + (p.rejectionCount || 0), 0);
      const rejectionRate = totalCases > 0 ? (totalRejections / totalCases) * 100 : 0;

      const lateSignings = projectsInCurrentMonth.filter(p => {
          const endDate = safeParseDate(p.endDate);
          const auditDate = safeParseDate(p.auditTime);
          if (!endDate || !auditDate) return false;
          const oneDayAfterEnd = addDays(endDate, 1);
          if (auditDate < oneDayAfterEnd) return false;
          // The duration (inclusive) is greater than 4 working days, which means the time elapsed is > 3 working days.
          return getWorkingDays(oneDayAfterEnd, auditDate) > 4;
      }).length;
      
      return {
        month: format(month, 'M月'),
        caseCount: totalCases,
        cost: totalCost,
        onTimeRate: parseFloat(onTimeRate.toFixed(1)),
        rejectionRate: parseFloat(rejectionRate.toFixed(1)),
        signingTimeliness: lateSignings
      };
    });

    return {
      monthlyData: calculatedMonthlyData,
      lateCompletionProjects,
      rejectedProjects,
      lateSigningProjects,
      trendData: calculatedTrendData
    };
  }, [projects, currentMonth]);

  const kpiResults = {
    onTimeRate: { value: monthlyData.onTimeRate, isAbnormal: monthlyData.onTimeRate < kpiConfig[0].target },
    rejectionRate: { value: monthlyData.rejectionRate, isAbnormal: monthlyData.rejectionRate > kpiConfig[1].target },
    signingTimeliness: { value: monthlyData.signingTimeliness >= kpiConfig[2].target, isAbnormal: monthlyData.signingTimeliness >= kpiConfig[2].target },
  };

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

  const handleExportAbnormal = () => {
    const allAbnormal = [
      ...lateCompletionProjects.map(p => ({ ...p, kpiCategory: '工期延誤異常' })),
      ...rejectedProjects.map(p => ({ ...p, kpiCategory: '報告錯誤退件' })),
      ...lateSigningProjects.map(p => ({ ...p, kpiCategory: '簽署時效異常' })),
    ];
    
    const uniqueAbnormal = Object.values(allAbnormal.reduce((acc, p) => {
      if (!acc[p.id]) {
        acc[p.id] = { project: p, categories: new Set() };
      }
      acc[p.id].categories.add(p.kpiCategory);
      return acc;
    }, {} as Record<string, { project: ProjectData, categories: Set<string> }>)).map(item => ({
      ...item.project,
      kpiCategory: Array.from(item.categories).join(', '),
    }));

    if (uniqueAbnormal.length === 0) {
      toast({ title: "無異常案件", description: "本月所有 KPI 指標均符合規範。" });
      return;
    }

    const dataToExport = uniqueAbnormal.map(p => ({
      'KPI異常類別': p.kpiCategory,
      '工單編號': p.workOrderId || p.id,
      '料號': p.partNo || '',
      '產品品名': p.productName,
      '負責人': p.tester,
    }));
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E293B" } } };
    const header = ['KPI異常類別', '工單編號', '料號', '產品品名', '負責人'];
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 15 }];
    header.forEach((h, i) => {
        const cellRef = XLSX.utils.encode_cell({ c: i, r: 0 });
        if(ws[cellRef]) ws[cellRef].s = headerStyle;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Abnormal Cases");
    XLSX.writeFile(wb, `KPI_Abnormal_Cases_${format(currentMonth, 'yyyyMM')}.xlsx`);
  };

  const AbnormalKpiCard = ({ title, projects }: { title: string, projects: ProjectData[] }) => (
    <div className="p-6 rounded-2xl border-2 border-rose-100 bg-rose-50/20 flex flex-col h-full">
      <h3 className="font-bold text-destructive mb-4">{title}</h3>
      {projects.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-green-600">
          <CheckCircle2 size={32} />
          <p className="mt-2 text-sm font-bold">指標符合規範</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto custom-scrollbar -mr-2 pr-2">
          {projects.map(p => (
            <div key={p.id} className="p-3 rounded-lg bg-white border border-rose-200 shadow-sm flex flex-col gap-1.5">
              <p className="font-bold text-sm text-slate-800 line-clamp-2" title={p.productName}>{p.productName}</p>
              <div className="flex justify-between items-start gap-2 mt-1">
                <div className="flex flex-col gap-1 items-start">
                    <Badge variant="outline" className="text-[10px] sm:text-xs font-mono bg-slate-50">{p.workOrderId || p.id}</Badge>
                    {p.partNo && <Badge variant="secondary" className="text-[10px] sm:text-xs font-mono">{p.partNo}</Badge>}
                </div>
                <span className="text-xs font-semibold text-rose-800 bg-rose-100/50 px-2 py-1 rounded-md shrink-0">{p.tester || '未指派'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>實驗室月報 KPI 監控看板 (工作日計)</CardTitle>
          <div className="flex items-center justify-between">
            <CardDescription>
              此看板用於監控實驗室的關鍵績效指標，所有時效計算均基於工作日。
            </CardDescription>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 border">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg text-slate-500"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold text-slate-700 min-w-[100px] text-center">{format(currentMonth, 'yyyy年 MM月', { locale: zhTW })}</span>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg text-slate-500"><ChevronRight size={16} /></button>
              </div>
              <Badge variant="secondary" className="text-sm">當月預計完成：{monthlyData.totalCasesInMonth} 件</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No.</TableHead>
                <TableHead>KPI 指標名稱</TableHead>
                <TableHead className="w-[80px]">單位</TableHead>
                <TableHead>計算定義</TableHead>
                <TableHead className="w-[100px]">目標值</TableHead>
                <TableHead className="w-[100px]">實際數值</TableHead>
                <TableHead className="w-[100px]">狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>1</TableCell>
                <TableCell className="font-medium">工服準時達成率</TableCell>
                <TableCell>%</TableCell>
                <TableCell className="text-xs text-muted-foreground">工作日計算：(準時完成件數(完成日期&lt;=預計完成日) / 當月預計完成總件數)</TableCell>
                <TableCell>&gt; 99%</TableCell>
                <TableCell className="font-bold">{kpiResults.onTimeRate.value.toFixed(2)}%</TableCell>
                <TableCell>
                  {kpiResults.onTimeRate.isAbnormal ? 
                    <Badge variant="destructive">異常</Badge> : 
                    <Badge className="bg-green-500 hover:bg-green-600">正常</Badge>}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2</TableCell>
                <TableCell className="font-medium">工服報告錯誤退回率</TableCell>
                <TableCell>%</TableCell>
                <TableCell className="text-xs text-muted-foreground">次數計算：(審查報告退回總次數 / 當月預計完成總件數)</TableCell>
                <TableCell>&lt; 8%</TableCell>
                <TableCell className="font-bold">{kpiResults.rejectionRate.value.toFixed(2)}%</TableCell>
                <TableCell>
                  {kpiResults.rejectionRate.isAbnormal ? 
                    <Badge variant="destructive">異常</Badge> : 
                    <Badge className="bg-green-500 hover:bg-green-600">正常</Badge>}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>3</TableCell>
                <TableCell className="font-medium">工服報告簽署時效</TableCell>
                <TableCell>件</TableCell>
                <TableCell className="text-xs text-muted-foreground">工作日計算：(完成簽核日期 - (完成日期+1天)) &gt; 3 個工作天之件數</TableCell>
                <TableCell>&lt; 1 件</TableCell>
                <TableCell className="font-bold">{monthlyData.signingTimeliness} 件</TableCell>
                <TableCell>
                  {kpiResults.signingTimeliness.isAbnormal ? 
                    <Badge variant="destructive">異常</Badge> : 
                    <Badge className="bg-green-500 hover:bg-green-600">正常</Badge>}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle /> 本月 KPI 指標異常追蹤
            </CardTitle>
            <Button onClick={handleExportAbnormal} variant="outline" size="sm">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> 匯出異常案件 Excel 總表
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6">
          <AbnormalKpiCard title="工期延誤異常" projects={lateCompletionProjects} />
          <AbnormalKpiCard title="報告錯誤退件" projects={rejectedProjects} />
          <AbnormalKpiCard title="簽署時效異常" projects={lateSigningProjects} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp /> 實驗室案件件數與產值分析</CardTitle>
          <CardDescription>顯示當年度每月的案件數量與成本趨勢。</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
            <div className="lg:col-span-2 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis yAxisId="left" label={{ value: '案件數量 (件)', angle: -90, position: 'insideLeft', style: {textAnchor: 'middle', fontSize: '12px'} }} fontSize={12} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: '產值 (成本)', angle: 90, position: 'insideRight', style: {textAnchor: 'middle', fontSize: '12px'} }} fontSize={12} domain={[0, (dataMax: number) => dataMax * 1.15]} />
                        <Tooltip contentStyle={{ borderRadius: '1rem' }}/>
                        <Legend wrapperStyle={{fontSize: "12px"}}/>
                        <Bar yAxisId="left" dataKey="caseCount" name="案件數" fill="#3b82f6" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="cost" name="產值" stroke="#84cc16" strokeWidth={2} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <div className="lg:col-span-1 h-[300px] overflow-y-auto custom-scrollbar pr-2 border-l pl-4">
                <h4 className="font-bold text-sm mb-4 sticky top-0 bg-card/95 backdrop-blur-sm pb-2">當年度每月數據</h4>
                <div className="space-y-2">
                    {trendData.map(d => (
                        <div key={d.month} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-muted">
                            <span className="font-bold text-slate-600">{d.month}</span>
                            <div className="text-right">
                                <p className="font-semibold text-blue-600">{d.caseCount} 件</p>
                                <p className="text-xs text-green-600 font-bold">{d.cost > 0 ? d.cost.toLocaleString() + ' 元' : '-'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target /> 工服準時達成率 (%) 趨勢</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12}/>
                <YAxis unit="%" fontSize={12} domain={[80, 100]}/>
                <Tooltip contentStyle={{ borderRadius: '1rem' }} />
                <Line type="monotone" dataKey="onTimeRate" name="準時率 (%)" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Percent /> 工服報告錯誤退回率 (%) 趨勢</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12}/>
                <YAxis unit="%" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: '1rem' }} />
                <Line type="monotone" dataKey="rejectionRate" name="退回率 (%)" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock /> 工服報告簽署時效 (件) 趨勢</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12}/>
                <YAxis unit="件" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '1rem' }} />
                <Line type="monotone" dataKey="signingTimeliness" name="簽署延遲 (件)" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KpiDashboard;

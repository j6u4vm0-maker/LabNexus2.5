'use client';

import React, { useState, useMemo } from 'react';
import type { MachineSchedule } from '@/lib/schedule-types';
import type { Equipment } from '@/lib/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Trash2, 
  Calendar, 
  Tag, 
  User, 
  Cpu, 
  Hash,
  Database
} from 'lucide-react';
import { deleteScheduleAction } from '@/lib/sqlite-api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface ScheduleDatabaseClientProps {
  initialSchedules: MachineSchedule[];
  equipments: Equipment[];
}

export default function ScheduleDatabaseClient({ 
  initialSchedules, 
  equipments 
}: ScheduleDatabaseClientProps) {
  const [schedules, setSchedules] = useState<MachineSchedule[]>(initialSchedules);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const filteredSchedules = useMemo(() => {
    if (!searchTerm) return schedules;
    const lower = searchTerm.toLowerCase();
    return schedules.filter(s => 
      s.equipmentName.toLowerCase().includes(lower) ||
      (s.productName || '').toLowerCase().includes(lower) ||
      (s.workOrder || '').toLowerCase().includes(lower) ||
      (s.tester || '').toLowerCase().includes(lower) ||
      (s.client || '').toLowerCase().includes(lower)
    );
  }, [schedules, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除這筆排程記錄嗎？')) return;

    const res = await deleteScheduleAction(id);
    if (res.success) {
      toast({ title: '已刪除', description: '排程記錄已從資料庫移除' });
      setSchedules(prev => prev.filter(s => s.id !== id));
    } else {
      toast({ title: '刪除失敗', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Database className="text-blue-600" />
            機台排程管理資料庫
          </h1>
          <p className="text-muted-foreground mt-2">
            檢視與管理系統中所有的機台預約記錄。
          </p>
        </div>
        <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1 text-sm bg-white shadow-sm border-blue-200 text-blue-700 font-bold">
                總計 {schedules.length} 筆項目
            </Badge>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="搜尋機台、品名、工單或人員..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 border-slate-200 focus:ring-blue-500 rounded-xl"
          />
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold text-slate-700"><Calendar size={14} className="inline mr-2" />日期</TableHead>
                <TableHead className="font-bold text-slate-700"><Cpu size={14} className="inline mr-2" />機台名稱</TableHead>
                <TableHead className="font-bold text-slate-700"><Hash size={14} className="inline mr-2" />工單編號</TableHead>
                <TableHead className="font-bold text-slate-700"><Tag size={14} className="inline mr-2" />產品品名</TableHead>
                <TableHead className="font-bold text-slate-700"><User size={14} className="inline mr-2" />委測/負責人</TableHead>
                <TableHead className="text-right font-bold text-slate-700">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400 font-medium">
                    找不到符合條件的排程記錄
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchedules.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-mono text-sm font-bold text-slate-600 italic">
                      {s.date}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{s.equipmentName}</span>
                        <span className="text-[10px] text-slate-400 font-black tracking-tighter">{s.equipmentId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.workOrder ? (
                        <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700 border-blue-100 font-bold">
                          {s.workOrder}
                        </Badge>
                      ) : (
                        <span className="text-slate-300 text-xs italic">無工單號</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <span className="text-sm font-medium text-slate-700">{s.productName || '(未指定)'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>{s.client || '匿名客戶'}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2.5">
                          {s.tester || '未指派人員'}
                        </span>
                      </div>
                    </TableCell>
                    <TableHead className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(s.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </TableHead>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { MachineSchedule } from '@/lib/schedule-types';
import type { Equipment } from '@/lib/types';
import type { ActiveCaseForMatch } from '@/lib/sqlite-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Trash2, Save, ListTodo, Cpu, User, Tag, ArrowRight,
    CalendarDays, Edit, Search, Link2, Check, Info, ExternalLink,
} from 'lucide-react';
import { updateScheduleGroupAction, deleteSchedulesAction } from '@/lib/sqlite-api';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type GroupedSchedule = {
    key: string;
    equipmentId: string;
    equipmentName: string;
    productName: string;
    client: string;
    schedules: MachineSchedule[];
    startDate: string;
    endDate: string;
    suggestedWorkOrder: string | null;
    suggestedLabManager: string | null;
};

interface PendingSchedulesClientProps {
    initialSchedules: MachineSchedule[];
    initialEquipments: Equipment[];
    initialActiveCases: ActiveCaseForMatch[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PendingSchedulesClient({
    initialSchedules,
    initialEquipments,
    initialActiveCases,
}: PendingSchedulesClientProps) {
    const { toast } = useToast();

    const [schedulesData, setSchedulesData] = useState<MachineSchedule[]>(initialSchedules);
    const [equipments] = useState<Equipment[]>(initialEquipments);
    const [activeCases] = useState<ActiveCaseForMatch[]>(initialActiveCases);

    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedEquipment, setSelectedEquipment] = useState('all');
    const [selectedGroup, setSelectedGroup] = useState<GroupedSchedule | null>(null);
    const [formState, setFormState] = useState({ workOrder: '', tester: '', notes: '' });
    const [searchTerm, setSearchTerm] = useState('');

    // ── Filter options ──────────────────────────────────────────────────────
    const allCategories = useMemo(
        () => ['all', ...Array.from(new Set(equipments.map(e => e.type || '未分類'))).sort()],
        [equipments],
    );
    const equipmentOptions = useMemo(() => {
        if (selectedCategory === 'all') return equipments;
        return equipments.filter(e => (e.type || '未分類') === selectedCategory);
    }, [equipments, selectedCategory]);

    const handleCategoryChange = (cat: string) => {
        setSelectedCategory(cat);
        setSelectedEquipment('all');
    };

    // ── Auto-match ──────────────────────────────────────────────────────────
    // Matches a schedule group to an active case by productName/partNo + client/creator
    const findSuggestion = useCallback(
        (productName: string, client: string): { workOrderId: string; labManager: string } | null => {
            if (!productName && !client) return null;
            const match = activeCases.find(c => {
                const productMatch = c.productName === productName || c.partNo === productName;
                const clientMatch = !client || c.creator === client;
                return productMatch && clientMatch;
            });
            return match ? { workOrderId: match.workOrderId, labManager: match.labManager } : null;
        },
        [activeCases],
    );

    // ── Grouped & filtered schedules ────────────────────────────────────────
    const groupedSchedules = useMemo((): GroupedSchedule[] => {
        const equipmentMap = new Map(equipments.map(e => [e.id, e]));

        // Front-end safety filter (SQL already filters, but keep for optimistic removes)
        const filtered = schedulesData.filter(s => {
            if (s.workOrder && s.workOrder.trim() !== '') return false;
            const eq = equipmentMap.get(s.equipmentId);
            if (selectedCategory !== 'all' && (!eq || (eq.type || '未分類') !== selectedCategory)) return false;
            if (selectedEquipment !== 'all' && s.equipmentId !== selectedEquipment) return false;
            return true;
        });

        // Group by equipmentId + productName + client
        const groups = new Map<string, {
            equipmentId: string; equipmentName: string;
            productName: string; client: string; schedules: MachineSchedule[];
        }>();
        filtered.forEach(s => {
            const key = `${s.equipmentId || 'N/A'}|${s.productName || 'N/A'}|${s.client || 'N/A'}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    equipmentId: s.equipmentId, equipmentName: s.equipmentName,
                    productName: s.productName, client: s.client, schedules: [],
                });
            }
            groups.get(key)!.schedules.push(s);
        });

        // Build result, compute startDate/endDate and auto-match suggestion
        const allGroups: GroupedSchedule[] = Array.from(groups.entries()).map(([key, g]) => {
            const sorted = g.schedules.sort((a, b) => a.date.localeCompare(b.date));
            const suggestion = findSuggestion(g.productName, g.client);
            return {
                key,
                ...g,
                schedules: sorted,
                startDate: sorted[0]?.date ?? '',
                endDate: sorted[sorted.length - 1]?.date ?? '',
                suggestedWorkOrder: suggestion?.workOrderId ?? null,
                suggestedLabManager: suggestion?.labManager ?? null,
            };
        });

        // Sort groups by startDate ascending (nearest first)
        allGroups.sort((a, b) => a.startDate.localeCompare(b.startDate));

        // 篩選：若群組的真實開始日 < 今天，整個群組不顯示
        // 例：今天 4/5，排程 4/4-4/15 → startDate=4/4 < 4/5 → 隱藏
        const todayStr = new Date().toISOString().slice(0, 10); // 'yyyy-MM-dd'
        const futureGroups = allGroups.filter(g => g.startDate >= todayStr);

        // Text search
        if (!searchTerm) return futureGroups;
        const q = searchTerm.toLowerCase();
        return futureGroups.filter(g =>
            g.equipmentName.toLowerCase().includes(q) ||
            (g.productName || '').toLowerCase().includes(q) ||
            (g.client || '').toLowerCase().includes(q),
        );
    }, [schedulesData, equipments, selectedCategory, selectedEquipment, searchTerm, findSuggestion]);

    // ── Sync selected group when list changes (e.g. after optimistic update) ─
    useEffect(() => {
        if (selectedGroup && !groupedSchedules.find(g => g.key === selectedGroup.key)) {
            setSelectedGroup(null);
        }
    }, [groupedSchedules, selectedGroup]);

    // ── Populate form when a group is selected ──────────────────────────────
    useEffect(() => {
        if (selectedGroup) {
            const rep = selectedGroup.schedules[0];
            setFormState({
                workOrder: rep?.workOrder || '',
                tester: rep?.tester || '',
                notes: rep?.notes || '',
            });
        }
    }, [selectedGroup]);

    const handleFormChange = (field: keyof typeof formState, value: string) =>
        setFormState(prev => ({ ...prev, [field]: value }));

    // ── Accept suggestion (fills form only, does NOT write to DB) ───────────
    const handleAcceptSuggestion = () => {
        if (!selectedGroup?.suggestedWorkOrder) return;
        setFormState(prev => ({
            ...prev,
            workOrder: selectedGroup.suggestedWorkOrder!,
            tester: prev.tester || selectedGroup.suggestedLabManager || '',
        }));
        toast({
            title: '已填入建議工單編號',
            description: '請確認後點擊「確認更新」才會正式寫入資料庫。',
        });
    };

    // ── Save to DB ──────────────────────────────────────────────────────────
    const handleUpdate = async () => {
        if (!selectedGroup) return;
        const { workOrder, tester, notes } = formState;
        if (!workOrder.trim()) {
            toast({ title: '請輸入工單編號', variant: 'destructive' });
            return;
        }
        const ids = selectedGroup.schedules.map(s => s.id);
        const res = await updateScheduleGroupAction(ids, { workOrder, tester, notes });
        if (res.success) {
            toast({ title: '更新成功', description: '排程已成功關聯工單編號' });
            setSchedulesData(prev =>
                prev.map(s => ids.includes(s.id) ? { ...s, workOrder, tester, notes } : s),
            );
            setSelectedGroup(null);
        } else {
            toast({ title: '更新失敗', description: res.error, variant: 'destructive' });
        }
    };

    const handleDelete = async () => {
        if (!selectedGroup) return;
        if (!window.confirm(`確定要刪除這 ${selectedGroup.schedules.length} 筆排程嗎？`)) return;
        const ids = selectedGroup.schedules.map(s => s.id);
        const res = await deleteSchedulesAction(ids);
        if (res.success) {
            toast({ title: '已刪除', description: '排程已成功刪除' });
            setSchedulesData(prev => prev.filter(s => !ids.includes(s.id)));
            setSelectedGroup(null);
        } else {
            toast({ title: '刪除失敗', description: res.error, variant: 'destructive' });
        }
    };

    const matchCount = groupedSchedules.filter(g => g.suggestedWorkOrder).length;

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50 flex flex-col h-[calc(100vh-theme(spacing.16))]">

            {/* ── Page Header ── */}
            <div className="flex items-start md:items-center justify-between md:flex-row flex-col md:space-y-0 space-y-4 mb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">無工單編號排程清單</h1>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <p className="text-muted-foreground text-sm">
                            僅顯示日期尚未到達的未來排程，依開始日期由近到遠排列。
                        </p>
                        {matchCount > 0 && (
                            <Badge className="bg-violet-100 text-violet-700 border border-violet-200 gap-1">
                                <Link2 size={11} /> AI 已自動配對 {matchCount} 筆
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜尋品名、機台、委測者..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 w-[250px]"
                        />
                    </div>
                    <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="w-[160px]"><SelectValue placeholder="所有類別" /></SelectTrigger>
                        <SelectContent>
                            {allCategories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat === 'all' ? '所有類別' : cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                        <SelectTrigger className="w-[220px]"><SelectValue placeholder="所有機台" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">所有機台</SelectItem>
                            {equipmentOptions.map(eq => (
                                <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.id})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">

                {/* Left — Group list */}
                <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border overflow-y-auto custom-scrollbar">
                    {groupedSchedules.length === 0 ? (
                        <div className="flex flex-col h-full items-center justify-center text-center p-8">
                            <ListTodo size={48} className="text-green-500 mb-4" />
                            <h2 className="text-xl font-bold text-slate-700">太棒了！</h2>
                            <p className="text-muted-foreground mt-2">目前所有篩選條件下的機台排程都已關聯工單編號。</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            {groupedSchedules.map(group => (
                                <button
                                    key={group.key}
                                    onClick={() => setSelectedGroup(group)}
                                    className={cn(
                                        'w-full text-left p-4 rounded-xl border-2 transition-all duration-150',
                                        selectedGroup?.key === group.key
                                            ? 'bg-blue-50 border-blue-500 shadow-md'
                                            : group.suggestedWorkOrder
                                                ? 'bg-violet-50/40 border-violet-200 hover:border-violet-400 hover:bg-violet-50'
                                                : 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50',
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <Cpu size={14} className="text-slate-500 shrink-0" />
                                            {group.equipmentName}
                                        </p>
                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                            {group.suggestedWorkOrder && (
                                                <Badge className="bg-violet-100 text-violet-700 border border-violet-200 text-[10px] px-1.5 py-0 gap-0.5 h-auto">
                                                    <Link2 size={9} /> AI配對
                                                </Badge>
                                            )}
                                            <Badge variant="secondary">{group.schedules.length} 筆</Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-slate-600">
                                        <p className="flex items-center gap-2">
                                            <Tag size={12} />{group.productName || '(未指定品名)'}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <User size={12} />{group.client || '(未指定委測者)'}
                                        </p>
                                        {group.suggestedWorkOrder && (
                                            <p className="flex items-center gap-1.5 text-violet-600 font-semibold">
                                                <Link2 size={11} />建議工單：{group.suggestedWorkOrder}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/80">
                                            <CalendarDays size={12} />
                                            <span className="font-mono">{group.startDate}</span>
                                            {group.startDate !== group.endDate && <ArrowRight size={12} />}
                                            {group.startDate !== group.endDate && (
                                                <span className="font-mono">{group.endDate}</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right — Edit panel */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border flex flex-col overflow-hidden">
                    {selectedGroup ? (
                        <>
                            {/* Panel header */}
                            <div className="p-6 border-b bg-slate-50/80 rounded-t-2xl">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                                    <Edit size={18} className="text-blue-600" /> 編輯排程群組
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">統一更新此群組的所有排程資訊。</p>
                            </div>

                            <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                                {/* Group info */}
                                <div>
                                    <h4 className="font-bold text-sm text-slate-500 mb-2">群組資訊</h4>
                                    <div className="p-4 rounded-xl bg-slate-50 border space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Cpu size={14} className="text-slate-500 shrink-0" />
                                            <Link
                                                href={`/equipment-schedule?equipmentId=${encodeURIComponent(selectedGroup.equipmentId)}`}
                                                className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors"
                                                title={`跳轉至機台排程：${selectedGroup.equipmentName}`}
                                            >
                                                {selectedGroup.equipmentName}
                                                <ExternalLink size={12} className="text-blue-400" />
                                            </Link>
                                        </div>
                                        <p className="flex items-center gap-2 text-sm">
                                            <Tag size={14} className="text-slate-500 shrink-0" />
                                            <span className="font-bold">{selectedGroup.productName || '(未指定)'}</span>
                                        </p>
                                        <p className="flex items-center gap-2 text-sm">
                                            <User size={14} className="text-slate-500 shrink-0" />
                                            <span className="font-bold">{selectedGroup.client || '(未指定)'}</span>
                                        </p>
                                        <div className="flex items-center gap-2 text-sm pt-2 border-t mt-2">
                                            <CalendarDays size={14} className="text-slate-500 shrink-0" />
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-mono">{selectedGroup.startDate}</Badge>
                                                {selectedGroup.startDate !== selectedGroup.endDate && (
                                                    <>
                                                        <ArrowRight size={16} className="text-muted-foreground" />
                                                        <Badge variant="outline" className="font-mono">{selectedGroup.endDate}</Badge>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── AI Auto-match Suggestion ── */}
                                {selectedGroup.suggestedWorkOrder && (
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-500 mb-2 flex items-center gap-2">
                                            <Link2 size={14} className="text-violet-600" />
                                            AI 自動匹配建議
                                            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] px-2 py-0 h-auto font-semibold">
                                                需人工確認
                                            </Badge>
                                        </h4>
                                        <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 space-y-3">
                                            <div className="flex items-start gap-2">
                                                <Info size={14} className="text-violet-500 mt-0.5 shrink-0" />
                                                <p className="text-xs text-slate-600">
                                                    系統依「料號」與「委測者」比對，發現以下實驗中工單可能與此排程相符：
                                                </p>
                                            </div>
                                            <div className="bg-white rounded-lg border border-violet-200 p-3">
                                                <p className="text-base font-mono font-black text-violet-700">
                                                    {selectedGroup.suggestedWorkOrder}
                                                </p>
                                                {selectedGroup.suggestedLabManager && (
                                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                        <User size={11} /> 負責人：{selectedGroup.suggestedLabManager}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                onClick={handleAcceptSuggestion}
                                                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                                                size="sm"
                                            >
                                                <Check size={14} className="mr-2" /> 確認綁定此工單
                                            </Button>
                                            <p className="text-[10px] text-slate-400 text-center">
                                                點擊後僅填入下方工單編號欄位，仍需點擊「確認更新」才會正式寫入資料庫
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* ── Form ── */}
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="workOrder" className="text-sm font-bold text-slate-700">工單編號</label>
                                        <Input
                                            id="workOrder"
                                            value={formState.workOrder}
                                            onChange={e => handleFormChange('workOrder', e.target.value)}
                                            placeholder="請輸入工單編號..."
                                            className={cn('mt-1', formState.workOrder && 'border-blue-400 ring-1 ring-blue-200')}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="tester" className="text-sm font-bold text-slate-700">負責人</label>
                                        <Input
                                            id="tester"
                                            value={formState.tester}
                                            onChange={e => handleFormChange('tester', e.target.value)}
                                            placeholder="輸入負責人姓名..."
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="notes" className="text-sm font-bold text-slate-700">測試備註</label>
                                        <Textarea
                                            id="notes"
                                            value={formState.notes}
                                            onChange={e => handleFormChange('notes', e.target.value)}
                                            placeholder="輸入測試相關備註..."
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bottom actions */}
                            <div className="p-6 border-t flex justify-end items-center gap-3 bg-slate-50/80 rounded-b-2xl">
                                <Button variant="destructive" onClick={handleDelete}>
                                    <Trash2 size={16} className="mr-2" /> 刪除此群組 ({selectedGroup.schedules.length}筆)
                                </Button>
                                <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700">
                                    <Save size={16} className="mr-2" /> 確認更新
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col h-full items-center justify-center text-center p-8">
                            <ArrowRight size={48} className="text-slate-300 mb-4 -scale-x-100" />
                            <h2 className="text-xl font-bold text-slate-700">請選擇一個項目</h2>
                            <p className="text-muted-foreground mt-2">從左側列表中選擇一個待辦群組以開始編輯。</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

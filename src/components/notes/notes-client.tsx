'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { ProjectNote, UserInfo, Case } from '@/lib/types';
import { UserRole } from '@/lib/types';
import { Plus, Trash2, Pencil, X, Search, MessageSquare, Upload, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx-js-style';
import { saveProjectNoteAction, deleteProjectNoteAction, importProjectNotesAction } from '@/lib/sqlite-api';
import { PageHeader, ActionButton } from '@/components/common/PageHeaderActions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface NotesClientProps {
    initialNotes: ProjectNote[];
    initialCases: Case[];
}

export default function NotesClient({ initialNotes, initialCases }: NotesClientProps) {
    const { toast } = useToast();
    
    const [records, setRecords] = useState<ProjectNote[]>(initialNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    const [editingRecord, setEditingRecord] = useState<ProjectNote | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [formState, setFormState] = useState<Partial<ProjectNote>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const user: UserInfo = { id: 'user-1', name: '黃慧敏主管', role: UserRole.MANAGER };

    useEffect(() => {
        setRecords(initialNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, [initialNotes]);
    
    const filteredRecords = useMemo(() => {
        if (!searchTerm) return records;
        const lowercasedTerm = searchTerm.toLowerCase();
        return records.filter(r => r.workOrderId.toLowerCase().includes(lowercasedTerm));
    }, [records, searchTerm]);

    const workOrderSuggestions = useMemo(() => {
        const uniqueWorkOrders = new Set(initialCases.map(c => c.workOrderId).filter(Boolean) as string[]);
        return Array.from(uniqueWorkOrders);
    }, [initialCases]);

    const openModal = (record?: ProjectNote) => {
        if (record) {
            setEditingRecord(record);
            setFormState(record);
        } else {
            setEditingRecord(null);
            setFormState({
                workOrderId: '',
                note: '',
                author: user.name,
            });
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const result = await saveProjectNoteAction(formState, !editingRecord);
            if (result.success) {
                toast({ title: '成功', description: editingRecord ? '備註已更新' : '新的備註已新增' });
                
                // Optimistic update
                const now = new Date().toISOString();
                if (!editingRecord) {
                    const newNote = { ...formState, id: result.id!, createdAt: now } as ProjectNote;
                    setRecords(prev => [newNote, ...prev]);
                } else {
                    setRecords(prev => prev.map(r => r.id === formState.id ? { ...r, ...formState } : r));
                }
                setShowModal(false);
            } else {
                toast({ title: '儲存失敗', description: result.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: '儲er 失敗', description: error.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
      const result = await deleteProjectNoteAction(id);
      if (result.success) {
          setRecords(prev => prev.filter(r => r.id !== id));
          toast({ title: '已刪除', description: '備註已成功刪除' });
      } else {
          toast({ title: '刪除失敗', description: result.error, variant: 'destructive' });
      }
    };

    const handleExportExcel = () => {
        const dataToExport = records.map(rec => ({
            '工單編號': rec.workOrderId,
            '備註內容': rec.note,
            '建立者': rec.author,
            '建立時間': format(parseISO(rec.createdAt), 'yyyy-MM-dd HH:mm'),
            '紀錄ID': rec.id,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E293B" } } };
        ws['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 15 }, { wch: 20 }, { wch: 30 }];
        
        const header = ['工單編號', '備註內容', '建立者', '建立時間', '紀錄ID'];
        header.forEach((h, i) => {
            const cellRef = XLSX.utils.encode_cell({ c: i, r: 0 });
            if(ws[cellRef]) ws[cellRef].s = headerStyle;
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Project Notes");
        XLSX.writeFile(wb, `Project_Notes_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsName = wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-MM-dd HH:mm' });
                
                const recordsToProcess: Partial<ProjectNote>[] = (data as any[]).map((row: any) => ({
                    id: row['紀錄ID']?.toString(),
                    workOrderId: (row['工單編號'] || row['工單號碼'] || row['工服單號'])?.toString(),
                    note: row['備註內容']?.toString(),
                    author: row['建立者']?.toString(),
                    createdAt: row['建立時間'] ? new Date(row['建立時間']).toISOString() : undefined,
                }));
                
                const result = await importProjectNotesAction(recordsToProcess, user.name);
                if (result.success) {
                    toast({ title: '匯入成功', description: '備註資料已成功匯入/更新。' });
                } else {
                    toast({ title: '匯入失敗', description: result.error, variant: 'destructive'});
                }
            } catch (error) {
                toast({ title: '匯入失敗', description: '操作失敗。', variant: 'destructive'});
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <>
            <datalist id="work-order-suggestions">
                {workOrderSuggestions.map(wo => <option key={wo} value={wo} />)}
            </datalist>
            <PageHeader title="專案備註資料庫">
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
                <ActionButton variant="import" icon={Upload} onClick={() => fileInputRef.current?.click()}>匯入 Excel</ActionButton>
                <ActionButton variant="export" icon={FileSpreadsheet} onClick={handleExportExcel}>匯出 Excel</ActionButton>
                <ActionButton variant="primary" icon={Plus} onClick={() => openModal()}>新增備註</ActionButton>
            </PageHeader>

            <div className="relative mb-4 max-w-sm">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="依工單編號搜尋備註..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border-slate-200 rounded-xl" />
            </div>
            
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr className="text-xs font-black uppercase text-slate-400 tracking-widest">
                                <th className="px-4 py-5">工單編號</th>
                                <th className="px-4 py-5">備註內容</th>
                                <th className="px-4 py-5">建立者</th>
                                <th className="px-4 py-5">建立時間</th>
                                <th className="px-8 py-5 text-right">管理操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredRecords.map(record => (
                                <tr key={record.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-4 py-4"><span className="text-xs font-bold text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">{record.workOrderId}</span></td>
                                    <td className="px-4 py-4"><p className="text-sm font-medium text-slate-800 line-clamp-2 max-w-lg" title={record.note}>{record.note}</p></td>
                                    <td className="px-4 py-4"><span className="text-sm font-bold text-slate-700">{record.author}</span></td>
                                    <td className="px-4 py-4"><span className="text-sm font-mono text-slate-500">{format(parseISO(record.createdAt), 'yyyy-MM-dd HH:mm')}</span></td>
                                    <td className="px-8 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openModal(record)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={15} /></button>
                                            <button onClick={() => handleDelete(record.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={15} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <MessageSquare size={18} className="text-blue-600" />
                                {editingRecord ? '編輯專案備註' : '新增專案備註'}
                            </h4>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">工單編號</label>
                                <Input list="work-order-suggestions" value={formState.workOrderId || ''} onChange={e => setFormState({ ...formState, workOrderId: e.target.value })} required className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">備註內容</label>
                                <Textarea value={formState.note || ''} onChange={e => setFormState({ ...formState, note: e.target.value })} required className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" rows={5} />
                            </div>
                            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-xl shadow-blue-100 mt-4 active:scale-95">
                                {editingRecord ? '確認更新' : '確認新增'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

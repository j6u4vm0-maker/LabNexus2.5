'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Engineer, UserInfo } from '@/lib/types';
import { UserRole } from '@/lib/types';
import { Plus, Trash2, Pencil, X, Users, Upload, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx-js-style';
import { format } from 'date-fns';
import { saveEngineerAction, deleteEngineerAction, overwriteEngineersAction } from '@/lib/sqlite-api';
import { PageHeader, ActionButton } from '@/components/common/PageHeaderActions';

interface EngineersClientProps {
    initialEngineers: Engineer[];
}

export default function EngineersClient({ initialEngineers }: EngineersClientProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [records, setRecords] = useState<Engineer[]>(initialEngineers.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')));
    const [editingRecord, setEditingRecord] = useState<Engineer | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [formState, setFormState] = useState<Partial<Engineer>>({});
    
    const user: UserInfo = { id: 'user-1', name: '黃慧敏主管', role: UserRole.MANAGER };

    useEffect(() => {
        setRecords(initialEngineers.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')));
    }, [initialEngineers]);

    const openModal = (record?: Engineer) => {
        if (record) {
            setEditingRecord(record);
            setFormState(record);
        } else {
            setEditingRecord(null);
            setFormState({ name: '', role: '測試者' });
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name) {
            toast({ title: '錯誤', description: '請填寫人員姓名', variant: 'destructive' });
            return;
        }

        try {
            const result = await saveEngineerAction(formState);
            if (result.success) {
                toast({ title: '成功', description: editingRecord ? '人員資料已更新' : '新的人員已新增' });
                
                // Optimistic update
                if (!editingRecord) {
                    setRecords(prev => [...prev, { id: result.id!, name: formState.name!, role: formState.role || '測試者' }].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')));
                } else {
                    setRecords(prev => prev.map(r => r.id === formState.id ? { ...r, ...formState } : r).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')));
                }
                setShowModal(false);
            } else {
                toast({ title: '儲存失敗', description: result.error, variant: 'destructive' });
            }
        } catch (error: any) {
             toast({ title: '儲存失敗', description: error.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
      const result = await deleteEngineerAction(id);
      if (result.success) {
          setRecords(prev => prev.filter(r => r.id !== id));
          toast({ title: '已刪除', description: '人員資料已成功刪除' });
      } else {
          toast({ title: '刪除失敗', description: result.error, variant: 'destructive' });
      }
    };
    
    const handleExportExcel = () => {
        const dataToExport = records.map(rec => ({ '人員ID': rec.id, '人員姓名': rec.name, '職位': rec.role || '測試者' }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E293B" } } };
        ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }];
        
        const header = ['人員ID', '人員姓名', '職位'];
        header.forEach((h, i) => {
            const cellRef = XLSX.utils.encode_cell({ c: i, r: 0 });
            if(ws[cellRef]) ws[cellRef].s = headerStyle;
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Engineers");
        XLSX.writeFile(wb, `Engineers_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsName = wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                const data = XLSX.utils.sheet_to_json(ws);
                
                if (!window.confirm('您確定要用這個檔案的內容完全覆蓋現有的人員資料庫嗎？此操作無法復原。')) {
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    return;
                }
                
                const newEngineerNames = (data as any[]).map(row => row['人員姓名']?.toString().trim()).filter(Boolean);
                
                const result = await overwriteEngineersAction(newEngineerNames);
                if (result.success) {
                    toast({ title: '匯入成功', description: `資料庫已完全更新，共新增 ${newEngineerNames.length} 筆新紀錄。`});
                } else {
                    toast({ title: '匯入失敗', description: result.error, variant: 'destructive'});
                }
                // Note: Page reload or manual re-migration might be needed to see results from SQLite.

            } catch (error: any) {
                console.error('Import error:', error);
                toast({ title: '匯入失敗', description: '操作失敗，請檢查檔案或稍後再試。', variant: 'destructive'});
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <>
            <PageHeader title="負責人員資料庫">
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
                <ActionButton variant="import" icon={Upload} onClick={() => fileInputRef.current?.click()}>
                    匯入 Excel
                </ActionButton>
                <ActionButton variant="export" icon={FileSpreadsheet} onClick={handleExportExcel}>
                    匯出 Excel
                </ActionButton>
                <ActionButton variant="primary" icon={Plus} onClick={() => openModal()}>
                    新增人員
                </ActionButton>
            </PageHeader>
            
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr className="text-xs font-black uppercase text-slate-400 tracking-widest">
                                <th className="px-4 py-5">人員姓名</th>
                                <th className="px-4 py-5">職位</th>
                                <th className="px-4 py-5">人員ID</th>
                                <th className="px-8 py-5 text-right">管理操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {records.map(record => (
                                <tr key={record.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-4 py-4"><span className="text-sm font-bold text-slate-800">{record.name}</span></td>
                                    <td className="px-4 py-4">
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                                            record.role === '實驗室主管' 
                                            ? 'bg-amber-100 text-amber-600' 
                                            : 'bg-blue-100 text-blue-600'
                                        }`}>
                                            {record.role || '測試者'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4"><span className="text-xs font-mono text-slate-400">{record.id}</span></td>
                                    <td className="px-8 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openModal(record)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={15} /></button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(record.id)}
                                                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                            >
                                                <Trash2 size={15} />
                                            </button>
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
                    <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Users size={18} className="text-blue-600" />
                                {editingRecord ? '編輯人員資料' : '新增人員'}
                            </h4>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">人員姓名</label>
                                <input type="text" value={formState.name || ''} onChange={e => setFormState({ ...formState, name: e.target.value })} required className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">職位</label>
                                <select 
                                    value={formState.role || '測試者'} 
                                    onChange={e => setFormState({ ...formState, role: e.target.value as any })}
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                >
                                    <option value="測試者">測試者</option>
                                    <option value="實驗室主管">實驗室主管</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-4 pt-4">
                                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95">
                                    {editingRecord ? '確認更新' : '確認新增'}
                                </button>
                                {editingRecord && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (editingRecord?.id) handleDelete(editingRecord.id);
                                            setShowModal(false);
                                        }}
                                        className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-sm hover:bg-rose-700 transition-all active:scale-95"
                                    >
                                        刪除此人員
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

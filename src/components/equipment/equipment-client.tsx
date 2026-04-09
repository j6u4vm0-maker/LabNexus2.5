'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { Equipment, UserInfo } from '@/lib/types';
import { UserRole } from '@/lib/types';
import { Cpu, Plus, Trash2, X, Upload, FileSpreadsheet, Filter } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { saveEquipmentAction, deleteEquipmentAction, importEquipmentAction } from '@/lib/sqlite-api';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ActionButton } from '@/components/common/PageHeaderActions';

interface EquipmentClientProps {
    initialEquipments: Equipment[];
}

export default function EquipmentClient({ initialEquipments }: EquipmentClientProps) {
  const { toast } = useToast();
  
  const [equipments, setEquipments] = useState<Equipment[]>(initialEquipments);

  useEffect(() => {
     setEquipments(initialEquipments);
  }, [initialEquipments]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newEquipment, setNewEquipment] = useState<Partial<Equipment>>({
    id: '',
    name: '',
    type: '',
    remark: '',
    logo: '',
    status: '正常',
    calibrationDate: '',
    isMultiChannel: false,
  });
  
  const [filters, setFilters] = useState({
    type: '',
    name: '',
    id: '',
    remark: '',
    logo: '',
    status: '',
    calibrationDate: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const user: UserInfo = { id: 'user-1', name: '黃慧敏主管', role: UserRole.MANAGER };
  const canEdit = user.role === UserRole.MANAGER;

  const getOptions = (field: keyof Equipment) => {
    const values = new Set(equipments.map(e => e[field] || ''));
    return Array.from(values).sort().filter(Boolean) as string[];
  };

  const handleStatusChange = async (id: string, newStatus: '正常' | '維修' | '校正') => {
    if (!canEdit) return;
    const eq = equipments.find(e => e.id === id);
    if (!eq) return;
    const result = await saveEquipmentAction({ ...eq, status: newStatus });
    if (result.success) {
        setEquipments(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    } else {
        toast({ title: '更新失敗', description: result.error, variant: 'destructive' });
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(equipments.map(eq => ({
      '類別': eq.type,
      '機台名稱': eq.name,
      '機台編號': eq.id,
      '備註/規格': eq.remark,
      'TAF LOGO': eq.logo,
      '校正日期': eq.calibrationDate || '',
      '允許多通道': eq.isMultiChannel ? '是' : '否',
      '狀態': eq.status || '正常'
    })));

    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 10 }];

    XLSX.utils.book_append_sheet(wb, ws, "Equipment List");
    XLSX.writeFile(wb, "Laboratory_Equipment_List.xlsx");
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
        
        const newEquipments: Equipment[] = (data as any[]).map((row: any) => ({
          name: row['機台名稱'] || '',
          id: row['機台編號'] || '',
          type: row['類別'] || '未分類',
          remark: row['備註/規格'] || row['備註'] || '',
          logo: row['TAF LOGO'] || '',
          calibrationDate: row['校正日期'] || '',
          isMultiChannel: row['允許多通道'] === '是' || row['允許多通道'] === true,
          status: row['狀態'] || '正常'
        })).filter((eq: any) => eq.id && eq.name);

        if (newEquipments.length === 0) {
          toast({title: '錯誤', description: '未找到有效的機台數據。', variant: 'destructive'});
          return;
        }

        const result = await importEquipmentAction(newEquipments);
        if (result.success) {
            toast({title: '成功', description: `成功匯入/更新 ${newEquipments.length} 筆機台資料！`});
            setEquipments(newEquipments);
        } else {
            toast({title: '錯誤', description: result.error, variant: 'destructive'});
        }
      } catch (error) {
        toast({title: '錯誤', description: '匯入失敗。', variant: 'destructive'});
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAdd = async () => {
    if (equipments.some(e => e.id === newEquipment.id)) {
      toast({title: '錯誤', description: '機台編號已存在', variant: 'destructive'});
      return;
    }
    const result = await saveEquipmentAction(newEquipment);
    if(result.success) {
        setEquipments(prev => [...prev, newEquipment as Equipment]);
        setShowAddModal(false);
        setNewEquipment({ id: '', name: '', type: '', remark: '', logo: '', status: '正常', calibrationDate: '', isMultiChannel: false });
        toast({ title: '成功', description: '機台已新增' });
    } else {
        toast({ title: '新增失敗', description: result.error, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此機台嗎？相關排程可能也會受到影響。')) return;
    const result = await deleteEquipmentAction(id);
    if (result.success) {
        setEquipments(prev => prev.filter(e => e.id !== id));
        toast({ title: '已刪除', description: '機台已成功刪除' });
    } else {
        toast({ title: '刪除失敗', description: result.error, variant: 'destructive' });
    }
  };

  const handleUpdate = async (id: string, updated: Partial<Equipment>) => {
    const eq = equipments.find(e => e.id === id);
    if (!eq) return;
    const result = await saveEquipmentAction({ ...eq, ...updated });
    if (result.success) {
        setEquipments(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
    } else {
        toast({ title: '更新失敗', description: result.error, variant: 'destructive' });
    }
  };

  const filteredEquipments = useMemo(() => equipments.filter(e => {
    return (
      (!filters.type || e.type === filters.type) &&
      (!filters.name || e.name === filters.name) &&
      (!filters.id || e.id === filters.id) &&
      (!filters.remark || (e.remark || '') === filters.remark) &&
      (!filters.logo || (e.logo || '') === filters.logo) &&
      (!filters.calibrationDate || (e.calibrationDate || '') === filters.calibrationDate) &&
      (!filters.status || (e.status || '正常') === filters.status)
    );
  }), [equipments, filters]);

  const renderFilterSelect = (field: keyof Equipment, placeholder: string) => (
    <div className="relative">
      <select
        value={filters[field as keyof typeof filters]}
        onChange={(e) => setFilters(prev => ({ ...prev, [field]: e.target.value }))}
        className="w-full bg-slate-100 border-none text-xs font-bold text-slate-600 rounded-lg py-1 pl-2 pr-6 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {getOptions(field).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 p-4 md:p-8 pt-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-800">儀器設備機台清單</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Laboratory Equipment Inventory Management</p>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <p className="text-xs font-black text-blue-600 uppercase tracking-widest">共 {equipments.length} 台設備</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
            {canEdit && (
              <ActionButton variant="import" icon={Upload} onClick={() => fileInputRef.current?.click()}>匯入</ActionButton>
            )}
            <ActionButton variant="export" icon={FileSpreadsheet} onClick={handleExportExcel}>匯出</ActionButton>
            {canEdit && (
              <ActionButton variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>新增機台</ActionButton>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest border-b border-slate-100">
                <th className="py-4 px-4 text-left w-32">
                  <div className="mb-2">類別</div>
                  {renderFilterSelect('type', '全部')}
                </th>
                <th className="py-4 px-4 text-left w-48">
                  <div className="mb-2">機台名稱</div>
                  {renderFilterSelect('name', '全部')}
                </th>
                <th className="py-4 px-4 text-left w-32">
                  <div className="mb-2">機台編號</div>
                  {renderFilterSelect('id', '全部')}
                </th>
                <th className="py-4 px-4 text-left">
                  <div className="mb-2">備註/規格</div>
                  {renderFilterSelect('remark', '全部')}
                </th>
                <th className="py-4 px-4 text-left w-32">
                  <div className="mb-2">TAF LOGO</div>
                  {renderFilterSelect('logo', '全部')}
                </th>
                <th className="py-4 px-4 text-left w-32">
                  <div className="mb-2">校正日期</div>
                  {renderFilterSelect('calibrationDate', '全部')}
                </th>
                <th className="py-4 px-4 text-left w-28">允許多通道</th>
                <th className="py-4 px-4 text-left w-32">
                  <div className="mb-2">狀態</div>
                  {renderFilterSelect('status', '全部')}
                </th>
                {canEdit && <th className="py-4 px-4 text-right w-20">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEquipments.map(eq => (
                <tr key={eq.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-black uppercase tracking-wider">
                      {eq.type || '未分類'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {canEdit ? (
                      <input 
                        type="text" 
                        defaultValue={eq.name}
                        onBlur={(e) => handleUpdate(eq.id, { name: e.target.value })}
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-none text-sm font-black text-slate-800 transition-all"
                      />
                    ) : (
                      <p className="text-sm font-black text-slate-800">{eq.name}</p>
                    )}
                  </td>
                  <td className="py-4 px-4"><p className="text-xs font-mono text-slate-500">{eq.id}</p></td>
                  <td className="py-4 px-4">
                    {canEdit ? (
                      <input 
                        type="text" 
                        defaultValue={eq.remark || ''}
                        onBlur={(e) => handleUpdate(eq.id, { remark: e.target.value })}
                        placeholder="--"
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-none text-xs font-bold text-slate-500 italic transition-all"
                      />
                    ) : (
                      <p className="text-xs font-bold text-slate-500 italic">{eq.remark || '--'}</p>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <input 
                      type="text" 
                      defaultValue={eq.logo || ''}
                      onBlur={(e) => handleUpdate(eq.id, { logo: e.target.value })}
                      disabled={!canEdit}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-none text-xs font-black text-slate-400"
                    />
                  </td>
                  <td className="py-4 px-4">
                    <input 
                      type="date" 
                      defaultValue={eq.calibrationDate || ''}
                      onBlur={(e) => handleUpdate(eq.id, { calibrationDate: e.target.value })}
                      disabled={!canEdit}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-none text-xs font-bold text-slate-600"
                    />
                  </td>
                  <td className="py-4 px-4">
                    <Switch
                        checked={eq.isMultiChannel || false}
                        onCheckedChange={(checked) => handleUpdate(eq.id, { isMultiChannel: checked })}
                        disabled={!canEdit}
                    />
                  </td>
                  <td className="py-4 px-4">
                    <select
                      value={eq.status || '正常'}
                      onChange={(e) => handleStatusChange(eq.id, e.target.value as any)}
                      disabled={!canEdit}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black outline-none border w-full ${
                        eq.status === '維修' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                        eq.status === '校正' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }`}
                    >
                      <option value="正常">正常</option>
                      <option value="維修">維修</option>
                      <option value="校正">校正</option>
                    </select>
                  </td>
                  {canEdit && (
                    <td className="py-4 px-4 text-right">
                      <button onClick={() => handleDelete(eq.id)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black tracking-tight">新增機台設備</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">Add New Laboratory Equipment</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">機台名稱</label>
                  <input type="text" value={newEquipment.name} onChange={e => setNewEquipment({...newEquipment, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">機台編號</label>
                  <input type="text" value={newEquipment.id} onChange={e => setNewEquipment({...newEquipment, id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">機台類別</label>
                <input type="text" value={newEquipment.type} onChange={e => setNewEquipment({...newEquipment, type: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">備註/規格</label>
                <input type="text" value={newEquipment.remark} onChange={e => setNewEquipment({...newEquipment, remark: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">下次校正日期</label>
                <input type="date" value={newEquipment.calibrationDate} onChange={e => setNewEquipment({...newEquipment, calibrationDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                  <Switch id="isMultiChannel" checked={newEquipment.isMultiChannel || false} onCheckedChange={(checked) => setNewEquipment({...newEquipment, isMultiChannel: checked})} />
                  <Label htmlFor="isMultiChannel" className="text-xs font-bold text-slate-600">允許多通道排程</Label>
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-4 rounded-2xl text-xs font-black text-slate-500 hover:bg-slate-50">取消</button>
                <button onClick={handleAdd} className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl text-xs font-black hover:bg-blue-700 shadow-lg shadow-blue-200">確認新增</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

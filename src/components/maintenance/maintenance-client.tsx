'use client';

import { useState, useMemo, useEffect } from 'react';
import type { MaintenanceRecord, UserInfo, Engineer, ProjectNote } from '@/lib/types';
import type { ProjectData } from '@/lib/schedule-types';
import ProjectList from '@/components/cases/project-list';
import { saveMaintenanceRecordAction, deleteMaintenanceRecordAction, getEngineersData } from '@/lib/sqlite-api';
import { useToast } from '@/hooks/use-toast';

interface MaintenanceClientProps {
    initialRecords: MaintenanceRecord[];
    user: UserInfo;
}

export default function MaintenanceClient({ initialRecords, user }: MaintenanceClientProps) {
    const { toast } = useToast();
    const [records, setRecords] = useState<MaintenanceRecord[]>(initialRecords);
    const [engineers, setEngineers] = useState<Engineer[]>([]);
    
    // Sync state with props
    useEffect(() => {
        setRecords(initialRecords);
    }, [initialRecords]);

    // Fetch engineers for the dropdown
    useEffect(() => {
        const fetchEngineers = async () => {
            const data = await getEngineersData();
            setEngineers(data);
        };
        fetchEngineers();
    }, []);

    const projects: ProjectData[] = useMemo(() => {
        return records.map(m => ({
            id: m.id,
            bookingId: m.id,
            workOrderId: m.id, // Use ID as workOrderId for mapping consistency
            productName: m.equipmentName,
            tester: m.engineerName,
            status: m.status,
            estimatedDate: m.estimatedCompletionDate,
            priority: '一般件',
            testDetails: {},
            name: m.equipmentName,
            partNo: m.equipmentId,
        }));
    }, [records]);

    const handleAdd = async (newProj: ProjectData) => {
        const record: Partial<MaintenanceRecord> = {
            equipmentName: newProj.productName,
            equipmentId: newProj.partNo,
            engineerName: newProj.tester,
            estimatedCompletionDate: newProj.estimatedDate,
            status: newProj.status as any || '設備保養',
        };
        const result = await saveMaintenanceRecordAction(record, true);
        if (result.success) {
            setRecords(prev => [{ ...record, id: result.id! } as MaintenanceRecord, ...prev]);
            toast({ title: '成功', description: '新保養紀錄已新增' });
        } else {
            toast({ title: '錯誤', description: result.error, variant: 'destructive' });
        }
    };

    const handleUpdate = async (updatedProj: ProjectData) => {
        const record: Partial<MaintenanceRecord> = {
            id: updatedProj.id,
            equipmentName: updatedProj.productName,
            equipmentId: updatedProj.partNo,
            engineerName: updatedProj.tester,
            estimatedCompletionDate: updatedProj.estimatedDate,
            status: updatedProj.status as any,
        };
        const result = await saveMaintenanceRecordAction(record, false);
        if (result.success) {
            setRecords(prev => prev.map(r => r.id === updatedProj.id ? { ...r, ...record } : r));
            toast({ title: '成功', description: '保養紀錄已更新' });
        } else {
            toast({ title: '錯誤', description: result.error, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('確定要刪除此保養紀錄嗎？')) return;
        const result = await deleteMaintenanceRecordAction(id);
        if (result.success) {
            setRecords(prev => prev.filter(r => r.id !== id));
            toast({ title: '已刪除', description: '紀錄已成功刪除' });
        } else {
            toast({ title: '錯誤', description: result.error, variant: 'destructive' });
        }
    };

    const [globalTesters, setGlobalTesters] = useState<string[]>(['所有人']);
    const [globalStatus, setGlobalStatus] = useState('所有狀態');

    return (
        <ProjectList
            projects={projects}
            engineers={engineers}
            notes={[]} // Maintenance might not have notes in this view
            user={user}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            globalTesters={globalTesters}
            setGlobalTesters={setGlobalTesters}
            globalStatus={globalStatus}
            setGlobalStatus={setGlobalStatus}
            pageType="maintenance"
        />
    );
}

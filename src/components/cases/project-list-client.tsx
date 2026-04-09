'use client';

// ProjectListClient: handles all interactive logic (filtering, add/edit/delete)
// Initial data is passed from the Server Component (page.tsx) via SQLite.
// Writes (add/update/delete) still go through Firebase via data-api.ts.

import { useState, useEffect } from 'react';
import { saveCaseAction, deleteCaseAction } from '@/lib/sqlite-api';
import ProjectList from '@/components/cases/project-list';
import { useToast } from '@/hooks/use-toast';
import type { ProjectData } from '@/lib/schedule-types';
import type { UserInfo, Engineer, ProjectNote } from '@/lib/types';
import { UserRole } from '@/lib/types';

interface ProjectListClientProps {
    initialProjects: ProjectData[];
    initialEngineers: Engineer[];
    initialNotes: ProjectNote[];
    user: UserInfo;
    readOnly?: boolean;
    pageType?: 'project' | 'maintenance';
}

export default function ProjectListClient({
    initialProjects,
    initialEngineers,
    initialNotes,
    user,
    readOnly = false,
    pageType = 'project',
}: ProjectListClientProps) {
    const { toast } = useToast(); // Needs to import useToast
    const [projects, setProjects] = useState<ProjectData[]>(initialProjects);
    const [engineers] = useState<Engineer[]>(initialEngineers);
    const [notes] = useState<ProjectNote[]>(initialNotes);
    const [globalTesters, setGlobalTesters] = useState<string[]>(['所有人']);
    const [globalStatus, setGlobalStatus] = useState('所有狀態');

    // Update local state if parent passes fresh data (though in Server Component mode, this won't re-render)
    useEffect(() => { setProjects(initialProjects); }, [initialProjects]);

    const handleAdd = async (newProject: ProjectData) => {
        if (readOnly) return;
        const result = await saveCaseAction(newProject as any, true);
        if (result.success) {
            setProjects(prev => [newProject, ...prev]);
            toast({ title: '成功', description: '新案件已新增' });
        } else {
            toast({ title: '錯誤', description: result.error, variant: 'destructive' });
        }
    };

    const handleUpdate = async (updatedProject: ProjectData) => {
        if (readOnly) return;
        const result = await saveCaseAction(updatedProject as any, false);
        if (result.success) {
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
            toast({ title: '成功', description: '案件已更新' });
        } else {
            toast({ title: '錯誤', description: result.error, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        if (readOnly) return;
        if (!window.confirm('確定要刪除此案件嗎？')) return;
        const result = await deleteCaseAction(id);
        if (result.success) {
            setProjects(prev => prev.filter(p => p.id !== id));
            toast({ title: '已刪除', description: '案件已成功刪除' });
        } else {
            toast({ title: '錯誤', description: result.error, variant: 'destructive' });
        }
    };

    return (
        <ProjectList
            projects={projects}
            engineers={engineers}
            notes={notes}
            user={user}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            globalTesters={globalTesters}
            setGlobalTesters={setGlobalTesters}
            globalStatus={globalStatus}
            setGlobalStatus={setGlobalStatus}
            readOnly={readOnly}
            pageType={pageType}
        />
    );
}

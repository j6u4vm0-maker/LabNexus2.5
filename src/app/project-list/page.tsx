// Server Component — reads from SQLite, passes data to ProjectList client component
import { getProjectListData } from '@/lib/sqlite-api';
import type { UserInfo } from '@/lib/types';
import { UserRole } from '@/lib/types';
import ProjectListClient from '@/components/cases/project-list-client';

export default async function ProjectListPage() {
    const data = await getProjectListData(undefined);
    const user: UserInfo = { id: 'user-1', name: '黃慧敏主管', role: UserRole.MANAGER };
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
            <div className="flex items-center justify-between space-y-2 mb-4">
                <h1 className="text-3xl font-bold tracking-tight">專案進度清單</h1>
            </div>
            <ProjectListClient
                initialProjects={data.projects}
                initialEngineers={data.engineers}
                initialNotes={data.notes}
                user={user}
                pageType="project"
            />
        </div>
    );
}

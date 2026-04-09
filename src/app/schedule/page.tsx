import { getSchedulePageData } from '@/lib/sqlite-api';
import ScheduleClient from '@/components/schedule/schedule-client';
import { UserRole } from '@/lib/types';

export default async function SchedulePage() {
    const data = await getSchedulePageData();
    const user = { id: 'user-1', name: '黃慧敏主管', role: UserRole.MANAGER };

    return (
        <div className="flex-1 p-4 md:p-8 pt-6 bg-slate-50">
            <ScheduleClient 
                projects={data.projects} 
                maintenanceProjects={data.maintenanceProjects}
                machineScheduleProjects={data.machineScheduleProjects}
                engineers={data.engineers}
                user={user}
            />
        </div>
    );
}

// Server Component: Fetch data from SQLite, then pass to the client component.
import { getPersonalDashboardData } from '@/lib/sqlite-api';
import PersonalDashboard from '@/components/dashboard/personal-dashboard';
import { UserRole } from '@/lib/types';

export default async function PersonalDashboardPage() {
    // 獲取所有需要的資料
    const data = await getPersonalDashboardData();
    
    // 模擬當前使用者 (在此遷移階段與原本一致)
    const userInfo = { 
        id: 'user-1', 
        name: '黃慧敏主管', 
        role: UserRole.MANAGER 
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
            <PersonalDashboard 
                projects={data.projects}
                schedules={data.schedules}
                user={userInfo}
                engineers={data.engineers}
                schedulePageProjects={data.schedulePageProjects}
                maintenanceProjects={data.maintenanceProjects}
                machineScheduleProjects={data.machineScheduleProjects}
            />
        </div>
    );
}

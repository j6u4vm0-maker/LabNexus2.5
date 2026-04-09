// Server Component: Fetch data from SQLite
import { getEquipmentScheduleData } from '@/lib/sqlite-api';
import EquipmentSchedule from '@/components/schedule/equipment-schedule';
import { UserRole } from '@/lib/types';

export default async function EquipmentSchedulePage() {
    const data = await getEquipmentScheduleData();
    
    // Hardcoded user for now, consistent with previous client-side implementation.
    const user = { id: 'user-1', name: '黃慧敏主管', role: UserRole.MANAGER, canEditSchedule: true };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
           <EquipmentSchedule 
                initialSchedules={data.schedules}
                initialEquipments={data.equipments}
                projects={data.cases}
                user={user}
            />
        </div>
    );
}

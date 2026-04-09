// Server Component: Fetch data from SQLite
import { getRoutineWorkData } from '@/lib/sqlite-api';
import RoutineWorkClient from '@/components/routine-work/routine-work-client';

export default async function RoutineWorkPage() {
    const data = await getRoutineWorkData();

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
           <RoutineWorkClient
                initialSchedules={data.schedules}
                initialEngineers={data.engineers}
                initialTasks={data.tasks}
            />
        </div>
    );
}

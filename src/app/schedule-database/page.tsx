import { getScheduleDatabaseData, getEquipmentData } from '@/lib/sqlite-api';
import ScheduleDatabaseClient from '@/components/schedule/schedule-database-client';

export default async function ScheduleDatabasePage() {
    // Fetch data directly from SQLite on the server
    const schedules = await getScheduleDatabaseData();
    const equipments = await getEquipmentData();

    return (
        <ScheduleDatabaseClient 
            initialSchedules={schedules} 
            equipments={equipments} 
        />
    );
}

import { getMaintenanceData } from '@/lib/sqlite-api';
import type { UserInfo } from '@/lib/types';
import { UserRole } from '@/lib/types';
import MaintenanceClient from '@/components/maintenance/maintenance-client';

export default async function MaintenancePage() {
    // Fetch data directly from SQLite on the server
    const maintenanceData = await getMaintenanceData();
    
    const user: UserInfo = { id: 'user-1', name: '黃慧敏主管', role: UserRole.MANAGER };

    return (
        <MaintenanceClient 
            initialRecords={maintenanceData} 
            user={user} 
        />
    );
}

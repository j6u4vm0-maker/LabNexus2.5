// Server Component
import { getEquipmentMonitoringData } from '@/lib/sqlite-api';
import EquipmentMonitoringDashboard from '@/components/monitoring/equipment-monitoring-dashboard';

export default async function EquipmentMonitoringPage() {
    const { schedules, equipments } = await getEquipmentMonitoringData();
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
            <EquipmentMonitoringDashboard
                schedules={schedules}
                equipments={equipments}
            />
        </div>
    );
}

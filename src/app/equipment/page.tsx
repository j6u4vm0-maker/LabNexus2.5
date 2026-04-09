// Server Component: Fetch data from SQLite
import { getEquipmentData } from '@/lib/sqlite-api';
import EquipmentClient from '@/components/equipment/equipment-client';

export default async function EquipmentPage() {
    const equipments = await getEquipmentData();

    return (
        <div className="flex-1 space-y-4 pt-6 bg-slate-50">
            <EquipmentClient initialEquipments={equipments} />
        </div>
    );
}

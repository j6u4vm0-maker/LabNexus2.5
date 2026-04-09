// Server Component: read initial data from SQLite, render client component
import { getPendingSchedulesData } from '@/lib/sqlite-api';
import PendingSchedulesClient from '@/components/schedule/pending-schedules-client';

export default async function PendingSchedulesPage() {
    const { schedules, equipments, activeCases } = await getPendingSchedulesData();
    return <PendingSchedulesClient initialSchedules={schedules} initialEquipments={equipments} initialActiveCases={activeCases} />;
}

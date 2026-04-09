// Server Component
import { getKpiReportData } from '@/lib/sqlite-api';
import KpiDashboard from '@/components/kpi/kpi-dashboard';

export default async function KpiReportPage() {
    const projects = await getKpiReportData();
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
            <KpiDashboard projects={projects} />
        </div>
    );
}

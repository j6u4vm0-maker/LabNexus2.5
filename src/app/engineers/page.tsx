// Server Component: Fetch data from SQLite
import { getEngineersData } from '@/lib/sqlite-api';
import EngineersClient from '@/components/engineers/engineers-client';

export default async function EngineersPage() {
    const engineers = await getEngineersData();

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
            <EngineersClient initialEngineers={engineers} />
        </div>
    );
}

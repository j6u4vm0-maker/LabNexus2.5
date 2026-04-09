// Server Component — 不需要 'use client'
// 直接在 server 端執行 SQLite 查詢，傳遞計算好的 props 到 Dashboard

import Dashboard from '@/components/dashboard/dashboard';
import { getFullDashboardData } from '@/lib/sqlite-api';
import { format } from 'date-fns';

export default async function DashboardPage() {
  // 預設為今天；日期切換由 URL searchParams 控制
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  let stats;
  let error: string | null = null;

  try {
    stats = await getFullDashboardData(todayStr);
  } catch (err: any) {
    error = err.message || '無法載入資料';
    console.error('[DashboardPage] SQLite query failed:', err);
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2 mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold tracking-tight">即時營運儀表板</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-6 py-4 font-medium">
          ⚠️ 資料載入失敗：{error}
        </div>
      )}

      {!error && stats && (
        <Dashboard initialStats={stats} initialDateStr={todayStr} />
      )}
    </div>
  );
}

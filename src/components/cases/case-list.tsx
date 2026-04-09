'use client';
import type { Case } from '@/lib/types';
import { DataTable } from './data-table';
import { getColumns } from './columns';

interface CaseListProps {
  data: Case[];
}

export function CaseList({ data }: CaseListProps) {
  const columns = getColumns();
  return <DataTable columns={columns} data={data} />;
}

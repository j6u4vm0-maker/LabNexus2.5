'use client';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowUp, ArrowDown, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { Case, CasePriority } from '@/lib/types';
import { DataTableColumnHeader } from './data-table-column-header';
import { format } from 'date-fns';

const priorityIcons: Record<CasePriority, React.ElementType> = {
  LOW: ArrowDown,
  MEDIUM: ArrowRight,
  HIGH: ArrowUp,
  CRITICAL: AlertCircle,
};

const priorityColors: Record<CasePriority, string> = {
  LOW: 'text-green-600',
  MEDIUM: 'text-yellow-600',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600',
};


const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    'Assigned': 'secondary',
    'In Experiment': 'default',
    'In Progress': 'default',
    'Pending Action': 'outline',
    'Completed': 'secondary',
    'Waiting': 'outline',
    'Pending Closure': 'secondary',
    'Completed (Pending Closure)': 'secondary'
};

export const getColumns = (): ColumnDef<Case>[] => [
  {
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Case ID" />,
  },
  {
    accessorKey: 'productName',
    header: 'Product Name',
    cell: ({ row }) => <div className="max-w-[250px] truncate font-medium">{row.getValue('productName')}</div>,
  },
  {
    accessorKey: 'partNo',
    header: 'Part No.',
  },
    {
    accessorKey: 'customer',
    header: 'Customer',
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Priority" />,
    cell: ({ row }) => {
      const priority: CasePriority = row.getValue('priority');
      if (!priority) return null;
      const Icon = priorityIcons[priority] || AlertCircle;
      return (
        <div className={`flex items-center gap-2 font-medium ${priorityColors[priority]}`}>
          <Icon className="h-4 w-4" />
          <span>{priority}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status: string = row.getValue('status');
      return <Badge variant={statusVariants[status] || 'secondary'}>{status}</Badge>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'labManager',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lab Manager" />,
    cell: ({ row }) => row.getValue('labManager') || 'Unassigned',
     filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'estimatedCompletionDate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Est. Completion" />,
    cell: ({ row }) => {
      const dateStr = row.getValue('estimatedCompletionDate') as string;
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr);
        return format(date, 'MM/dd/yyyy');
      } catch {
        return dateStr;
      }
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const caseData = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(caseData.id)}>
              Copy Case ID
            </DropdownMenuItem>
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Assign Engineer</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

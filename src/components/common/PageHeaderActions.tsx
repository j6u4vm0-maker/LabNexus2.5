'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  variant?: 'primary' | 'import' | 'export' | 'destructive' | 'secondary';
  children: React.ReactNode;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, variant = 'primary', children, className, ...props }) => {
  const baseClasses = "px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-lg flex items-center gap-2";
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100',
    import: 'bg-slate-800 text-white hover:bg-slate-900 shadow-slate-200',
    export: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100',
    destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-100',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 shadow-slate-100',
  };

  return (
    <button className={cn(baseClasses, variantClasses[variant], className)} {...props}>
      <Icon size={16} />
      {children}
    </button>
  );
};


interface PageHeaderProps {
  title: string;
  children: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, children }) => {
    return (
        <div className="flex items-center justify-between space-y-2 mb-4">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <div className="flex items-center gap-2">
                {children}
            </div>
        </div>
    );
};

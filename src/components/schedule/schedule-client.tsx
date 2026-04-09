'use client';

import { useState } from 'react';
import ProjectCalendar from './project-calendar';
import type { ProjectData } from '@/lib/schedule-types';
import type { Engineer, UserInfo } from '@/lib/types';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScheduleClientProps {
  projects: ProjectData[];
  maintenanceProjects: ProjectData[];
  machineScheduleProjects: ProjectData[];
  engineers: Engineer[];
  user: UserInfo;
}

export default function ScheduleClient({
  projects,
  maintenanceProjects,
  machineScheduleProjects,
  engineers,
  user
}: ScheduleClientProps) {
  const [selectedEngineers, setSelectedEngineers] = useState<string[]>(['all']);

  const toggleEngineer = (name: string) => {
    if (name === 'all') {
      setSelectedEngineers(['all']);
      return;
    }

    setSelectedEngineers(prev => {
      let newSet = prev.filter(n => n !== 'all');
      if (newSet.includes(name)) {
        newSet = newSet.filter(n => n !== name);
      } else {
        newSet.push(name);
      }
      return newSet.length === 0 ? ['all'] : newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">時程行事曆</h1>
        </div>

        <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 mb-1">
                <div className="flex items-center gap-2">
                    <UserIcon size={16} className="text-slate-400" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">篩選測試者</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSelectedEngineers(['all'])}
                        className="text-xs font-bold text-blue-600 hover:underline transition-all cursor-pointer"
                    >
                        全部選擇
                    </button>
                    <button
                        onClick={() => setSelectedEngineers([])}
                         className="text-xs font-bold text-rose-600 hover:underline transition-all cursor-pointer"
                    >
                        全部清除
                    </button>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
                <label
                    className={cn(
                        "flex items-center gap-2 cursor-pointer rounded-lg border-2 text-xs font-bold transition-all px-3 py-2",
                        selectedEngineers.includes('all')
                            ? "bg-blue-600 text-white border-transparent shadow-md"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                >
                    <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedEngineers.includes('all')}
                        onChange={() => toggleEngineer('all')}
                    />
                    <span>所有工程師</span>
                </label>
                
                {engineers.sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant')).map((eng) => {
                    const isSelected = selectedEngineers.includes(eng.name);
                    return (
                        <label
                            key={eng.id}
                            className={cn(
                                "flex items-center gap-2 cursor-pointer rounded-lg border-2 text-xs font-bold transition-all px-3 py-2",
                                isSelected
                                    ? "bg-blue-600 text-white border-transparent shadow-md"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                        >
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={isSelected}
                                onChange={() => toggleEngineer(eng.name)}
                            />
                            <span>{eng.name}</span>
                        </label>
                    );
                })}
            </div>
        </div>
      </div>
      <ProjectCalendar 
        projects={projects} 
        maintenanceProjects={maintenanceProjects}
        machineScheduleProjects={machineScheduleProjects}
        engineers={engineers}
        selectedEngineers={selectedEngineers}
      />
    </div>
  );
}

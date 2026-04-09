'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  Wrench, 
  Cpu, 
  Briefcase, 
  Users,
  ClipboardList,
  ClipboardCheck,
  Settings,
  CalendarCheck,
  BarChart2,
  ListTodo,
  MessageSquare,
  Contact,
  ChevronDown
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar';

const navGroups = [
    {
        title: '營運監測',
        items: [
          { href: '/personal-dashboard', icon: Contact, label: '個人即時看板' },
          { href: '/', icon: LayoutDashboard, label: '即時營運儀表板' },
          { href: '/kpi-report', icon: ClipboardCheck, label: 'KPI 月報看板' },
          { href: '/equipment-monitoring', icon: BarChart2, label: '設備稼動率分析' },
        ]
    },
    {
        title: '專案進度',
        items: [
            { href: '/cases', icon: Briefcase, label: '專案進度顯示' },
            { href: '/schedule', icon: Calendar, label: '時程行事曆' },
        ]
    },
    {
        title: '排程管理',
        items: [
            { href: '/equipment-schedule', icon: Cpu, label: '機台排程管理' },
            { href: '/pending-schedules', icon: ListTodo, label: '無工單排程清單' },
            { href: '/routine-work', icon: CalendarCheck, label: '例行工作排程' },
        ]
    },
    {
        title: '資料庫',
        items: [
            { href: '/equipment', icon: Wrench, label: '儀器設備清單' },
            { href: '/maintenance', icon: Wrench, label: '設備保養資料庫' },
            { href: '/project-list', icon: ClipboardList, label: '專案進度清單' },
            { href: '/engineers', icon: Users, label: '負責人員資料庫' },
            { href: '/schedule-database', icon: Cpu, label: '機台排程管理資料庫' },
            { href: '/notes', icon: MessageSquare, label: '專案備註資料庫' },
        ]
    },
    {
        title: '系統',
        items: [
            { href: '/settings', icon: Settings, label: '顏色設定' },
        ]
    }
]

export function SidebarNav() {
  const pathname = usePathname();

  // Open the active group by default, others closed.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    const activeGroup = navGroups.find(g => g.items.some(i => pathname === i.href));
    // Set all groups to false initially
    navGroups.forEach(group => {
        initialState[group.title] = false;
    });
    // If there is an active group, set it to be open
    if (activeGroup) {
      initialState[activeGroup.title] = true;
    } else if (navGroups.length > 0) {
      // If no active group, open the first one by default.
      initialState[navGroups[0].title] = true;
    }
    return initialState;
  });

  return (
    <>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className='p-2 bg-primary/20 rounded-lg'>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="hsl(var(--sidebar-primary))" strokeWidth="2" strokeLinejoin="round"/>
                        <path d="M2 7L12 12L22 7" stroke="hsl(var(--sidebar-primary))" strokeWidth="2" strokeLinejoin="round"/>
                        <path d="M12 12V22" stroke="hsl(var(--sidebar-primary))" strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                </div>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                    <h2 className="text-lg font-bold text-sidebar-foreground">
                        LabNexus
                    </h2>
                    <span className="text-xs text-sidebar-foreground/70">V2.5 PRO</span>
                </div>
            </div>
          <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-accent-foreground" />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        {navGroups.map((group, index) => (
            <Collapsible
              key={group.title}
              open={openGroups[group.title] || false}
              onOpenChange={(isOpen) => setOpenGroups(prev => ({...prev, [group.title]: isOpen}))}
              asChild
            >
              <SidebarGroup>
                  <CollapsibleTrigger className='w-full'>
                    <SidebarGroupLabel className='w-full flex justify-between cursor-pointer'>
                      {group.title}
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenu>
                    {group.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                            asChild
                            variant='default'
                            className='data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground'
                            isActive={pathname === item.href}
                            tooltip={{ children: item.label, side: 'right' }}
                        >
                            <a href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                            </a>
                        </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                  {index < navGroups.length - 1 && <SidebarSeparator className='my-2'/>}
              </SidebarGroup>
            </Collapsible>
        ))}
      </SidebarContent>
    </>
  );
}

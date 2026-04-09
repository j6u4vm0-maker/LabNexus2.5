'use client';

import { useMemo, useEffect, useState } from 'react';
import type { Engineer, RoutineWork, RoutineWorkTask } from '@/lib/types';
import RoutineWorkSchedule from '@/components/routine-work/routine-work-schedule';
import { overwriteRoutineWorkForYearsAction, overwriteRoutineWorkTasksAction } from '@/lib/sqlite-api';
import { useToast } from '@/hooks/use-toast';

interface RoutineWorkClientProps {
    initialSchedules: RoutineWork[];
    initialEngineers: Engineer[];
    initialTasks: RoutineWorkTask[];
}

export default function RoutineWorkClient({
    initialSchedules,
    initialEngineers,
    initialTasks,
}: RoutineWorkClientProps) {
    const { toast } = useToast();
    const [isSeeding, setIsSeeding] = useState(false);

    const [schedules, setSchedules] = useState<RoutineWork[]>(initialSchedules);
    const [engineers] = useState<Engineer[]>(initialEngineers);
    const [tasks] = useState<RoutineWorkTask[]>(initialTasks);

    // Initial data sync if props change
    useEffect(() => {
        setSchedules(initialSchedules);
    }, [initialSchedules]);

    // One-time data seeding from image logic (kept for parity)
    useEffect(() => {
        const seedData = async () => {
            if (isSeeding || initialTasks?.some(t => t.name === 'RV/空壓機/滅火器/內應力')) {
                return;
            }
            setIsSeeding(true);
            toast({ title: '資料庫更新', description: '偵測到新的排程範本，正在導入資料...' });

            const taskNames = [
                'RV/空壓機/滅火器/內應力', '維克式硬度', '鹽水',
                '橡膠硬度/拉力', 'ROHS/膜厚', '金相', 'BMC/電鍍溫循'
            ];
            const newTasks = taskNames.map((name, index) => ({ name, order: index + 1 }));

            const scheduleRawData = [
              { ym: '202501', tasks: ['志福', '俞甄', '祈文', '偉澤', '祈文', '郵賢', ''] },
              { ym: '202502', tasks: ['盟坤', '偉澤', '俞甄', '祈文', '郵賢', '盟坤', ''] },
              { ym: '202503', tasks: ['偉澤', '志福', '偉澤', '盟坤', '郵賢', '俞甄', ''] },
              { ym: '202504', tasks: ['祈文', '盟坤', '郵賢', '志福', '俞甄', '俞甄', ''] },
              { ym: '202505', tasks: ['俞甄', '琦苡', '佑甄', '郵賢', '俞甄', '淑君', ''] },
              { ym: '202506', tasks: ['郵賢', '佑甄', '淑君', '俞甄', '盟坤', '琦苡', ''] },
              { ym: '202507', tasks: ['祈文', '淑君', '琦苡', '佑甄', '盟坤', '佑甄', ''] },
              { ym: '202508', tasks: ['淑君', '郵賢', '盟坤', '淑君', '琦苡', '祈文', ''] },
              { ym: '202509', tasks: ['琦苡', '俞甄', '佑甄', '淑君', '琦苡', '郵賢', ''] },
              { ym: '202510', tasks: ['俞甄', '佑甄', '俞甄', '琦苡', '祈文', '盟坤', ''] },
              { ym: '202511', tasks: ['盟坤', '祈文', '郵賢', '盟坤', '祈文', '', '俞甄'] },
              { ym: '202512', tasks: ['郵賢', '琦苡', '志福', '祈文', '郵賢', '淑君', '俞甄'] },
              { ym: '202601', tasks: ['志福', '盟坤', '淑君', '俞甄', '郵賢', '琦苡', '盟坤'] },
              { ym: '202602', tasks: ['祈文', '志福', '琦苡', '盟坤', '俞甄', '琦苡', '祈文'] },
              { ym: '202603', tasks: ['琦苡', '郵賢', '祈文', '志福', '俞甄', '盟坤', '志福'] },
            ];

            const newSchedules: Omit<RoutineWork, 'id'>[] = scheduleRawData.flatMap(row => {
                const year = row.ym.substring(0, 4);
                const month = row.ym.substring(4, 6);
                const yearMonth = `${year}-${month}`;
                return row.tasks.map((engineer, index) => {
                    if (engineer) {
                        return {
                            yearMonth,
                            taskCategory: taskNames[index],
                            engineerName: engineer,
                        };
                    }
                    return null;
                }).filter((s): s is Omit<RoutineWork, 'id'> => s !== null);
            });

            try {
                await overwriteRoutineWorkTasksAction(newTasks);
                await overwriteRoutineWorkForYearsAction(newSchedules, [2025, 2026]);
                toast({ title: '成功', description: '例行工作排程已從新範本導入完畢。' });
                // Note: Re-migration step is recommended after this seeding.
            } catch (error: any) {
                toast({ title: '錯誤', description: `導入資料時發生錯誤`, variant: 'destructive' });
            } finally {
                setIsSeeding(false);
            }
        };

        if (initialTasks) {
            seedData();
        }
    }, [initialTasks, isSeeding, toast]);

    if (isSeeding) {
        return <div className="flex h-full w-full items-center justify-center">正在導入新的排程資料...</div>;
    }

    return (
       <RoutineWorkSchedule
            schedules={schedules}
            engineers={engineers}
            tasks={tasks}
        />
    );
}

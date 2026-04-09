

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, addDays, startOfMonth, eachDayOfInterval, endOfMonth, isWithinInterval, differenceInDays, parse, isValid, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, isToday, isAfter, isBefore } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar as CalendarIcon,
  Search,
  Cpu,
  Layers,
  CheckSquare,
  XSquare,
  User,
  ArrowRight,
  ClipboardList,
  Info,
  Award,
  Upload,
  FileSpreadsheet,
  Pencil,
  Trash2,
  MoreHorizontal,
  MinusCircle,
  Eye,
  EyeOff,
  Wand2,
  ListTodo
} from 'lucide-react';
import type { MachineSchedule, ProjectData } from '@/lib/schedule-types';
import type { Equipment, UserInfo } from '@/lib/types';
import { UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { saveMachineScheduleAction, deleteScheduleAction } from '@/lib/sqlite-api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import * as XLSX from 'xlsx-js-style';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


const EQUIPMENT_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#8b5cf6', // violet-500
  '#db2777', // pink-500
  '#0ea5e9', // sky-500
  '#64748b', // slate-500
];

interface EquipmentScheduleProps {
  initialSchedules: MachineSchedule[];
  initialEquipments: Equipment[];
  projects: ProjectData[];
  user: UserInfo;
}

interface GanttEvent extends MachineSchedule {
  startDate: Date;
  endDate: Date;
  duration: number; // in days
}

const EquipmentSchedule: React.FC<EquipmentScheduleProps> = ({ initialSchedules, initialEquipments, projects, user }) => {
  const [view, setView] = useState<'selection' | 'schedule'>('selection');
  const [schedules, setSchedules] = useState(initialSchedules);
  const [equipments, setEquipments] = useState(initialEquipments);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GanttEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const [activeCategory, setActiveCategory] = useState('所有類別');
  const [visibleEquipmentIds, setVisibleEquipmentIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalCategory, setModalCategory] = useState('所有類別');

  const [bookingForm, setBookingForm] = useState({
    equipmentId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    bookingDays: 1,
    workOrder: '',
    productName: '',
    tester: user.name,
    client: '',
    notes: '',
  });

  const equipmentColorMap = useMemo(() => {
    const map = new Map<string, string>();
    initialEquipments.forEach((eq, index) => {
      map.set(eq.id, EQUIPMENT_COLORS[index % EQUIPMENT_COLORS.length]);
    });
    return map;
  }, [initialEquipments]);

  useEffect(() => {
    setSchedules(initialSchedules);
  }, [initialSchedules]);

  useEffect(() => {
    setEquipments(initialEquipments);
    if (initialEquipments.length > 0 && !bookingForm.equipmentId) {
      setBookingForm(prev => ({ ...prev, equipmentId: initialEquipments[0].id }));
    }
  }, [initialEquipments]);

  const allCategories = useMemo(() => {
    return ['所有類別', ...Array.from(new Set(equipments.map(e => e.type || '未分類'))).sort()];
  }, [equipments]);

  const modalFilteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      const categoryMatch = modalCategory === '所有類別' || (eq.type || '未分類') === modalCategory;
      const searchMatch = modalSearchTerm === '' ||
        eq.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
        eq.id.toLowerCase().includes(modalSearchTerm.toLowerCase());
      return categoryMatch && searchMatch;
    });
  }, [equipments, modalSearchTerm, modalCategory]);

  const equipmentsForCategory = useMemo(() => {
    const isFilteringByDate = availabilityFilter.start && availabilityFilter.end;

    // Pre-calculate busy equipment IDs for the selected date range
    const busyEquipmentIds = new Set<string>();
    if (isFilteringByDate) {
      try {
        const filterStart = parse(availabilityFilter.start, 'yyyy-MM-dd', new Date());
        const filterEnd = parse(availabilityFilter.end, 'yyyy-MM-dd', new Date());
        if (isValid(filterStart) && isValid(filterEnd) && filterStart <= filterEnd) {
          schedules.forEach(schedule => {
            const scheduleDate = parse(schedule.date, 'yyyy-MM-dd', new Date());
            if (isValid(scheduleDate) && isWithinInterval(scheduleDate, { start: filterStart, end: filterEnd })) {
              busyEquipmentIds.add(schedule.equipmentId);
            }
          });
          // Also consider calibration dates
          equipments.forEach(eq => {
            if (eq.calibrationDate) {
              try {
                const calDate = parse(eq.calibrationDate, 'yyyy-MM-dd', new Date());
                if (isValid(calDate) && isWithinInterval(calDate, { start: filterStart, end: filterEnd })) {
                  busyEquipmentIds.add(eq.id);
                }
              } catch (e) { /* ignore */ }
            }
          });
        }
      } catch (e) {
        console.error("Error parsing availability filter dates", e);
      }
    }

    return equipments.filter(eq => {
      const categoryMatch = activeCategory === '所有類別' || (eq.type || '未分類') === activeCategory;
      const searchMatch = searchTerm === '' ||
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.id.toLowerCase().includes(searchTerm.toLowerCase());

      const isAvailable = !isFilteringByDate || !busyEquipmentIds.has(eq.id);

      return categoryMatch && searchMatch && isAvailable;
    });
  }, [equipments, activeCategory, searchTerm, availabilityFilter, schedules]);

  const visibleEquipments = useMemo(() => {
    return equipments
      .filter(eq => visibleEquipmentIds.has(eq.id))
      .sort((a, b) => {
        const aIndex = Array.from(visibleEquipmentIds).indexOf(a.id);
        const bIndex = Array.from(visibleEquipmentIds).indexOf(b.id);
        return aIndex - bIndex;
      });
  }, [equipments, visibleEquipmentIds]);

  const handleSelectAll = () => {
    setVisibleEquipmentIds(prev => {
      const newSet = new Set(prev);
      equipmentsForCategory.forEach(eq => newSet.add(eq.id));
      return newSet;
    });
  };

  const handleClearAll = () => {
    setVisibleEquipmentIds(new Set());
  };

  const handleEquipmentVisibilityChange = (id: string, checked: boolean) => {
    setVisibleEquipmentIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleStartDateChange = (val: string) => {
    try {
      const start = parse(val, 'yyyy-MM-dd', new Date());
      if (!isValid(start)) return;
      const newEnd = addDays(start, bookingForm.bookingDays - 1);
      setBookingForm(prev => ({
        ...prev,
        startDate: val,
        endDate: format(newEnd, 'yyyy-MM-dd')
      }));
    } catch (e) {
      console.error("Invalid start date", e);
    }
  };

  const handleEndDateChange = (val: string) => {
    try {
      const start = parse(bookingForm.startDate, 'yyyy-MM-dd', new Date());
      const end = parse(val, 'yyyy-MM-dd', new Date());
      if (!isValid(start) || !isValid(end)) return;
      const days = differenceInDays(end, start) + 1;
      setBookingForm(prev => ({
        ...prev,
        endDate: val,
        bookingDays: Math.max(1, days)
      }));
    } catch (e) {
      console.error("Invalid end date", e);
    }
  };

  const handleDaysChange = (val: string) => {
    const days = parseInt(val) || 1;
    try {
      const start = parse(bookingForm.startDate, 'yyyy-MM-dd', new Date());
      if (!isValid(start)) return;
      const newEnd = addDays(start, days - 1);
      setBookingForm(prev => ({
        ...prev,
        bookingDays: days,
        endDate: format(newEnd, 'yyyy-MM-dd')
      }));
    } catch (e) {
      console.error("Invalid date operation", e);
    }
  };

  const handleExportExcel = () => {
    if (!schedules || schedules.length === 0) {
      toast({ title: '無資料', description: '目前沒有排程資料可匯出。' });
      return;
    }
    const dataToExport = schedules.map(s => ({
      '日期': s.date,
      '機台ID': s.equipmentId,
      '機台名稱': s.equipmentName,
      '工單號碼': s.workOrder,
      '產品品名': s.productName,
      '負責人': s.tester,
      '委測者': s.client,
      '測試備註': s.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E293B" } } };
    ws['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
    ];

    Object.keys(dataToExport[0]).forEach((key, i) => {
      const cellRef = XLSX.utils.encode_cell({ c: i, r: 0 });
      if (ws[cellRef]) ws[cellRef].s = headerStyle;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Machine Schedules");
    XLSX.writeFile(wb, `MachineSchedules_${format(currentDate, 'yyyyMM')}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true, dateNF: 'yyyy-MM-dd' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false });

        const schedulesToImport: Omit<MachineSchedule, 'id'>[] = (data as any[]).map((row: any) => ({
          date: row['日期'],
          equipmentId: row['機台ID'],
          equipmentName: row['機台名稱'],
          workOrder: row['工單號碼'],
          productName: row['產品品名'],
          tester: row['負責人'],
          client: row['委測者'],
          notes: row['測試備註'],
        })).filter(s => s.date && s.equipmentId && s.equipmentName);

        if (schedulesToImport.length === 0) {
          toast({ title: '匯入失敗', description: '找不到有效的排程資料，請檢查檔案欄位。', variant: 'destructive' });
          return;
        }

        // Save each schedule via SQLite Server Action
        let successCount = 0;
        for (const s of schedulesToImport) {
          const result = await saveMachineScheduleAction(s, true);
          if (result.success) successCount++;
        }

        if (successCount > 0) {
          toast({ title: '匯入成功', description: `已成功匯入 ${successCount} 筆排程資料。` });
          // Refresh local state
          const { getEquipmentScheduleData } = await import('@/lib/sqlite-api');
          const freshData = await getEquipmentScheduleData();
          setSchedules(freshData.schedules);
        } else {
          toast({ title: '匯入失敗', description: '儲存資料時發生錯誤。', variant: 'destructive' });
        }

      } catch (error: any) {
        console.error('Import error:', error);
        toast({ title: '匯入失敗', description: '解析檔案時發生錯誤，請確認檔案格式與欄位名稱。', variant: 'destructive' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const canEdit = user.role === UserRole.MANAGER || user.canEditSchedule;
  const [filterTester, setFilterTester] = useState('所有人');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const projectSuggestions = useMemo(() => {
    const ids = new Set<string>();
    projects.forEach(p => {
      if (p.id) ids.add(p.id);
      if (p.workOrderId) ids.add(p.workOrderId);
    });
    return Array.from(ids).sort();
  }, [projects]);

  const allTesters = useMemo(() => {
    const testers = new Set<string>();
    projects.forEach(p => { if (p.tester && p.tester !== '未指派') testers.add(p.tester); });
    schedules.forEach(s => { if (s.tester) testers.add(s.tester); });
    return Array.from(testers).sort();
  }, [projects, schedules]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const isVisible = visibleEquipmentIds.has(s.equipmentId);
      const matchesTester = filterTester === '所有人' || s.tester === filterTester;
      return isVisible && matchesTester;
    });
  }, [schedules, visibleEquipmentIds, filterTester]);

  const ganttEvents = useMemo(() => {
    const events: GanttEvent[] = [];
    const schedulesByBookingOrId = new Map<string, MachineSchedule[]>();

    filteredSchedules.forEach(s => {
      const key = s.bookingId || s.id;
      if (!schedulesByBookingOrId.has(key)) {
        schedulesByBookingOrId.set(key, []);
      }
      schedulesByBookingOrId.get(key)!.push(s);
    });

    schedulesByBookingOrId.forEach((group) => {
      if (group.length === 0) return;

      group.sort((a, b) => a.date.localeCompare(b.date));

      let currentBlock: MachineSchedule[] = [group[0]];

      for (let i = 1; i < group.length; i++) {
        const prevSchedule = currentBlock[currentBlock.length - 1];
        const currentSchedule = group[i];

        const prevDate = parse(prevSchedule.date, 'yyyy-MM-dd', new Date());
        const currDate = parse(currentSchedule.date, 'yyyy-MM-dd', new Date());

        if (differenceInDays(currDate, prevDate) === 1 &&
          prevSchedule.equipmentId === currentSchedule.equipmentId &&
          prevSchedule.workOrder === currentSchedule.workOrder &&
          prevSchedule.productName === currentSchedule.productName) {
          currentBlock.push(currentSchedule);
        } else {
          const firstDay = currentBlock[0];
          const lastDay = currentBlock[currentBlock.length - 1];
          const startDate = parse(firstDay.date, 'yyyy-MM-dd', new Date());
          const endDate = parse(lastDay.date, 'yyyy-MM-dd', new Date());

          if (isValid(startDate) && isValid(endDate)) {
            events.push({
              ...firstDay,
              id: firstDay.bookingId || firstDay.id,
              bookingId: firstDay.bookingId,
              startDate,
              endDate,
              duration: currentBlock.length,
            });
          }
          currentBlock = [currentSchedule];
        }
      }

      if (currentBlock.length > 0) {
        const firstDay = currentBlock[0];
        const lastDay = currentBlock[currentBlock.length - 1];
        const startDate = parse(firstDay.date, 'yyyy-MM-dd', new Date());
        const endDate = parse(lastDay.date, 'yyyy-MM-dd', new Date());

        if (isValid(startDate) && isValid(endDate)) {
          events.push({
            ...firstDay,
            id: firstDay.bookingId || firstDay.id,
            bookingId: firstDay.bookingId,
            startDate,
            endDate,
            duration: currentBlock.length,
          });
        }
      }
    });

    return events;
  }, [filteredSchedules]);

  const eventsByDateAndEquipment = useMemo(() => {
    const map = new Map<string, GanttEvent[]>();
    ganttEvents.forEach(event => {
      const days = eachDayOfInterval({ start: event.startDate, end: event.endDate });
      days.forEach(day => {
        const key = `${format(day, 'yyyy-MM-dd')}_${event.equipmentId}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(event);
      });
    });
    return map;
  }, [ganttEvents]);

  const calibrationEvents: GanttEvent[] = useMemo(() => {
    const calEvents: GanttEvent[] = [];
    visibleEquipments.forEach(eq => {
      if (eq.calibrationDate) {
        try {
          const calDate = parse(eq.calibrationDate, 'yyyy-MM-dd', new Date());
          if (!isValid(calDate)) return;

          const calEvent: GanttEvent = {
            id: `cal-${eq.id}`,
            date: eq.calibrationDate,
            equipmentId: eq.id,
            equipmentName: eq.name,
            workOrder: '校正',
            productName: '年度校正',
            client: '維護部門',
            tester: '維護部門',
            startDate: calDate,
            endDate: calDate,
            duration: 1
          };
          calEvents.push(calEvent);
        } catch (e) {
          console.warn(`Invalid calibration date format for equipment ${eq.id}: ${eq.calibrationDate}`);
        }
      }
    });
    return calEvents;
  }, [visibleEquipments]);

  const allGanttEvents = useMemo(() => [...ganttEvents, ...calibrationEvents], [ganttEvents, calibrationEvents]);

  const handleBookingWorkOrderChange = (value: string) => {
    const match = projects.find(p => p.workOrderId === value || p.id === value);
    setBookingForm(prev => ({
      ...prev,
      workOrder: value,
      productName: match ? match.productName : prev.productName,
      tester: match ? (match.tester || user.name) : prev.tester,
      client: match ? (match.creator || '') : prev.client,
    }));
  };

  const bookingIssues = useMemo(() => {
    if (!showBookingModal) return [];
    try {
      const start = parse(bookingForm.startDate, 'yyyy-MM-dd', new Date());
      const end = parse(bookingForm.endDate, 'yyyy-MM-dd', new Date());
      if (!isValid(start) || !isValid(end) || start > end) return [];

      const targetEq = equipments.find(e => e.id === bookingForm.equipmentId);
      if (!targetEq) return [];

      const issues: { message: string; isError: boolean }[] = [];

      if (targetEq.status === '維修' || targetEq.status === '校正') {
        issues.push({ message: `衝突：機台目前狀態為「${targetEq.status}」，無法預約。`, isError: true });
        return issues;
      }

      const isMulti = targetEq.isMultiChannel;

      const schedulesToCheck = editingEvent
        ? schedules.filter(s => s.bookingId !== editingEvent.id && s.id !== editingEvent.id)
        : schedules;

      const existingBookings = schedulesToCheck.filter(s => {
        const sDate = parse(s.date, 'yyyy-MM-dd', new Date());
        return isValid(sDate) &&
          s.equipmentId === bookingForm.equipmentId &&
          isWithinInterval(sDate, { start, end });
      });

      if (existingBookings.length > 0) {
        if (isMulti) {
          issues.push({ message: '提醒：本機台在此區間已有排程，可繼續預約。', isError: false });
        } else {
          const conflictDates = [...new Set(existingBookings.map(b => b.date))].sort();
          issues.push({ message: `衝突：日期 ${conflictDates[0]} 已被預約。`, isError: true });
        }
      }

      if (targetEq.calibrationDate) {
        const calDate = parse(targetEq.calibrationDate, 'yyyy-MM-dd', new Date());
        if (isValid(calDate) && isWithinInterval(calDate, { start, end })) {
          issues.push({ message: `衝突：選定區間包含校正日 (${targetEq.calibrationDate})。`, isError: true });
        }
      }

      return issues;
    } catch (e) {
      return [];
    }
  }, [bookingForm.startDate, bookingForm.endDate, bookingForm.equipmentId, schedules, showBookingModal, equipments, editingEvent]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasError = bookingIssues.some(issue => issue.isError);
    if (hasError) return;

    try {
      const start = parse(bookingForm.startDate, 'yyyy-MM-dd', new Date());
      const end = parse(bookingForm.endDate, 'yyyy-MM-dd', new Date());
      if (!isValid(start) || !isValid(end)) {
        toast({ title: '預約失敗', description: '日期格式不正確', variant: 'destructive' });
        return;
      }

      const rangeDays = eachDayOfInterval({ start, end });
      const selectedEq = equipments.find(e => e.id === bookingForm.equipmentId)!;
      if (!selectedEq) {
        toast({ title: '預約失敗', description: '請選擇一台機台', variant: 'destructive' });
        return;
      }

      // If editing, delete old booking first
      if (editingEvent) {
        await deleteScheduleAction(editingEvent.id, true);
      }

      // Generate a shared bookingId for this range
      const bookingId = `BOOKING-${Date.now()}`;

      const newEntries: Partial<MachineSchedule>[] = rangeDays.map(day => ({
        bookingId,
        date: format(day, 'yyyy-MM-dd'),
        equipmentId: selectedEq.id,
        equipmentName: selectedEq.name,
        workOrder: bookingForm.workOrder,
        productName: bookingForm.productName,
        tester: bookingForm.tester,
        client: bookingForm.client,
        notes: bookingForm.notes,
      }));

      let successCount = 0;
      for (const entry of newEntries) {
        const result = await saveMachineScheduleAction(entry, true);
        if (result.success) successCount++;
      }

      if (successCount > 0) {
        toast({ title: editingEvent ? '更新成功' : '預約成功', description: `已為 ${selectedEq.name} ${editingEvent ? '更新' : '新增'} ${successCount} 天的排程。` });

        // Update local state
        const savedEntries: MachineSchedule[] = newEntries.map((entry, i) => ({
          id: `${bookingId}-${i}`,
          bookingId,
          date: entry.date!,
          equipmentId: entry.equipmentId!,
          equipmentName: entry.equipmentName!,
          workOrder: entry.workOrder || '',
          productName: entry.productName || '',
          tester: entry.tester || '',
          client: entry.client || '',
          notes: entry.notes || '',
          updatedAt: new Date().toISOString(),
        }));

        setSchedules(prev => {
          if (editingEvent) {
            // Remove old booking entries by bookingId
            const filtered = prev.filter(s => s.bookingId !== editingEvent.id && s.id !== editingEvent.id);
            return [...filtered, ...savedEntries];
          }
          return [...prev, ...savedEntries];
        });

        setShowBookingModal(false);
        if (!editingEvent) {
          setCurrentDate(start);
          setVisibleEquipmentIds(prev => new Set(prev).add(bookingForm.equipmentId));
        }
        setEditingEvent(null);
      } else {
        toast({ title: '操作失敗', description: '儲存排程時發生錯誤', variant: 'destructive' });
      }
    } catch (e) {
      console.error('Booking submit error:', e);
      toast({ title: '操作失敗', description: '請檢查日期是否正確', variant: 'destructive' });
      setEditingEvent(null);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleOpenBookingModal = () => {
    setEditingEvent(null);
    setBookingForm({
      equipmentId: equipments.length > 0 ? equipments[0].id : '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      bookingDays: 1,
      workOrder: '',
      productName: '',
      tester: user.name,
      client: '',
      notes: '',
    });
    setShowBookingModal(true);
  }

  const handleCellClick = (day: Date, equipment: Equipment) => {
    if (!canEdit) return;

    setEditingEvent(null);
    const formattedDate = format(day, 'yyyy-MM-dd');
    setBookingForm({
      equipmentId: equipment.id,
      startDate: formattedDate,
      endDate: formattedDate,
      bookingDays: 1,
      workOrder: '',
      productName: '',
      tester: user.name,
      client: '',
      notes: '',
    });
    setShowBookingModal(true);
  };

  const handleEditClick = (event: GanttEvent) => {
    if (!canEdit || event.workOrder === '校正') return;
    setEditingEvent(event);
    setBookingForm({
      equipmentId: event.equipmentId,
      startDate: format(event.startDate, 'yyyy-MM-dd'),
      endDate: format(event.endDate, 'yyyy-MM-dd'),
      bookingDays: event.duration,
      workOrder: event.workOrder,
      productName: event.productName,
      tester: event.tester,
      client: event.client,
      notes: event.notes || '',
    });
    setShowBookingModal(true);
  };

  const dailyFocusData = useMemo(() => {
    if (!selectedDate) return null;

    const usedOnDayIds = new Set<string>();

    allGanttEvents.forEach(event => {
      if (isWithinInterval(selectedDate, { start: event.startDate, end: event.endDate })) {
        usedOnDayIds.add(event.equipmentId);
      }
    });

    const used = visibleEquipments.filter(eq => usedOnDayIds.has(eq.id));
    const available = visibleEquipments.filter(eq => !usedOnDayIds.has(eq.id));

    return { used, available };
  }, [selectedDate, allGanttEvents, visibleEquipments]);

  const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) => {
    if (!value) return null;
    const isTafLogo = label === 'TAF LOGO';
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold w-24 shrink-0">
          {icon}
          <span>{label}</span>
        </div>
        <div className={cn(
          "font-medium break-words",
          isTafLogo ? "bg-blue-600 text-white px-2 py-0.5 rounded-md inline-block" : "text-slate-700"
        )}>
          {value}
        </div>
      </div>
    );
  };

  if (view === 'selection') {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20 p-4 md:p-8 pt-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight mb-1">機台排程設定</h1>
              <p className="text-sm text-slate-500">請透過下方篩選器選擇您想查看的機台，再點擊按鈕進入排程總覽。</p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/pending-schedules" className="flex items-center gap-2">
                  <ListTodo size={16} />
                  無工單排程清單
                </a>
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
              {canEdit && (
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="bg-slate-800 text-white hover:bg-slate-900 hover:text-white border-slate-700">
                  <Upload size={16} className="mr-2" /> 上傳 Excel
                </Button>
              )}
              <Button onClick={handleExportExcel} variant="outline" className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white border-emerald-500">
                <FileSpreadsheet size={16} className="mr-2" /> 下載 Excel
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-3">
              <Layers size={16} /> 步驟一：快速機台類別篩選
            </h3>

            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-2xl px-3 py-2">
              <CalendarIcon size={16} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-500 mr-2">搜尋空閒機台:</span>
              <input
                type="date"
                value={availabilityFilter.start}
                onChange={e => setAvailabilityFilter(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={availabilityFilter.end}
                onChange={e => setAvailabilityFilter(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer"
                min={availabilityFilter.start}
              />
              {(availabilityFilter.start || availabilityFilter.end) && (
                <button onClick={() => setAvailabilityFilter({ start: '', end: '' })} className="p-1 hover:bg-slate-200 rounded-full">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋機台名稱或編號..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {allCategories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "px-4 py-2 text-sm font-bold rounded-full border transition-all duration-150 shadow-sm",
                  activeCategory === category
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-3">
              <CheckSquare size={16} /> 步驟二：勾選要顯示於排程的機台
            </h3>
            <div className="flex items-center gap-2">
              <Button onClick={handleOpenBookingModal} size="sm" className="flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"><Wand2 size={14} /> 智慧預約</Button>
              <Button onClick={handleSelectAll} size="sm" variant="outline" className="flex items-center gap-1.5"><CheckSquare size={14} /> 全選此類別</Button>
              <Button onClick={() => setVisibleEquipmentIds(prev => {
                const newSet = new Set(prev);
                equipmentsForCategory.forEach(eq => newSet.delete(eq.id));
                return newSet;
              })} size="sm" variant="outline" className="flex items-center gap-1.5"><XSquare size={14} /> 清除此類別</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipmentsForCategory.map(eq => (
              <div
                key={eq.id}
                style={{ borderLeft: `5px solid ${equipmentColorMap.get(eq.id) || '#ccc'}` }}
                className="p-4 rounded-2xl border bg-slate-50/50 border-slate-200 flex flex-col gap-3 transition-all hover:shadow-md hover:border-blue-200"
              >
                <div className="flex items-center justify-between">
                  <label htmlFor={`eq-${eq.id}`} className="font-bold text-slate-800 text-sm pr-2 truncate cursor-pointer flex-1">{eq.name}</label>
                  <Checkbox
                    id={`eq-${eq.id}`}
                    checked={visibleEquipmentIds.has(eq.id)}
                    onCheckedChange={(checked) => handleEquipmentVisibilityChange(eq.id, !!checked)}
                  />
                </div>
                <div className="space-y-2 text-sm border-t border-slate-200 pt-3">
                  <InfoItem icon={<Cpu size={14} />} label="機台編號" value={eq.id} />
                  <InfoItem icon={<Layers size={14} />} label="類別" value={eq.type} />
                  <InfoItem icon={<Info size={14} />} label="備註/規格" value={eq.remark} />
                  <InfoItem icon={<Award size={14} />} label="TAF LOGO" value={eq.logo} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-3">
              <Cpu size={16} /> 已選擇的機台 (共 {visibleEquipmentIds.size} 台)
            </h3>
            {visibleEquipmentIds.size > 0 && <Button onClick={handleClearAll} size="sm" variant="destructive" className="flex items-center gap-1.5"><XSquare size={14} /> 全部清除</Button>}
          </div>
          {visibleEquipments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visibleEquipments.map(eq => (
                <Badge key={eq.id} variant="secondary" className="pl-2 pr-1 py-1 text-sm bg-blue-100 text-blue-800 border-blue-200">
                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: equipmentColorMap.get(eq.id) }}></div>
                  {eq.name}
                  <button onClick={() => handleEquipmentVisibilityChange(eq.id, false)} className="ml-2 p-0.5 rounded-full hover:bg-blue-200">
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-slate-400 py-4">尚未選擇任何機台。請從上方列表勾選。</div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button size="lg" onClick={() => setView('schedule')} disabled={visibleEquipmentIds.size === 0}>
            查看 {visibleEquipmentIds.size} 台機台排程
            <ArrowRight className="ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-4 md:p-8 pt-6">
      <datalist id="project-wo-suggestions">
        {projectSuggestions.map(id => <option key={id} value={id} />)}
      </datalist>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" onClick={() => {
          setView('selection');
          setVisibleEquipmentIds(new Set());
        }}>
          <ChevronLeft className="mr-2" />
          返回選擇機台
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <a href="/pending-schedules" className="flex items-center gap-2">
              <ListTodo size={16} />
              無工單排程清單
            </a>
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
          {canEdit && (
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="bg-slate-800 text-white hover:bg-slate-900 hover:text-white border-slate-700">
              <Upload size={16} className="mr-2" /> 上傳 Excel
            </Button>
          )}
          <Button onClick={handleExportExcel} variant="outline" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white border-emerald-500">
            <FileSpreadsheet size={16} className="mr-2" /> 下載 Excel
          </Button>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl p-1 shrink-0">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-all"><ChevronLeft size={16} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-black text-blue-600 hover:bg-blue-50 rounded-lg transition-all">今天</button>
            <span className="px-4 text-sm font-black text-slate-700 min-w-[120px] text-center">{format(currentDate, 'yyyy年 MM月', { locale: zhTW })}</span>
            <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-all"><ChevronRight size={16} /></button>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2">
            <User size={14} className="text-slate-400" />
            <select value={filterTester} onChange={e => setFilterTester(e.target.value)} className="bg-transparent text-sm font-black outline-none w-full cursor-pointer">
              <option value="所有人">所有工程師</option>
              {allTesters.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {canEdit && <Button onClick={handleOpenBookingModal} size="sm"><Plus size={16} className="mr-2" /> 區間智慧預約</Button>}
        </div>
      </div>

      <TooltipProvider delayDuration={300}>
      <div className="rounded-2xl border border-slate-200 shadow-sm bg-white">
        <div className="grid" style={{ gridTemplateColumns: `120px repeat(${visibleEquipments.length}, minmax(0, 1fr))` }}>

          {/* Header Row */}
          <div className="sticky top-0 left-0 bg-slate-100 p-2 z-50 border-b border-r border-slate-200"></div>
          {visibleEquipments.map((eq, eqIndex) => (
            <div key={`header-${eq.id}`} className="sticky top-0 z-30 p-3 border-b border-l border-slate-200 bg-slate-50 flex flex-col" style={{ gridColumn: eqIndex + 2 }}>
              <div className="flex items-center justify-between">
                <p className="font-black text-sm text-slate-800 truncate" title={eq.name}>{eq.name}</p>
                <button onClick={() => handleEquipmentVisibilityChange(eq.id, false)} className="p-1 -mr-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate" title={eq.id}>{eq.id}</p>
              <div className="mt-auto pt-2 space-y-1">
                {eq.remark && <p className="text-xs text-slate-500 italic mt-1 truncate" title={eq.remark}>{eq.remark}</p>}
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{eq.type || '未分類'}</Badge>
                  <Badge variant={eq.status === '正常' ? 'outline' : 'destructive'} className="text-xs">{eq.status}</Badge>
                  {eq.logo && <Badge className="mt-1 text-xs bg-blue-600 text-white">{eq.logo}</Badge>}
                </div>
              </div>
            </div>
          ))}

          {/* Date Rows and Background Cells */}
          {daysInMonth.map((day, dayIndex) => (
            <React.Fragment key={`row-${day.toISOString()}`}>
              <div
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "sticky left-0 z-30 h-24 border-b border-r border-slate-200 text-center flex flex-col items-center justify-center cursor-pointer transition-colors",
                  hasMounted && isToday(day) ? "bg-blue-100" : "bg-white",
                  isSameDay(day, selectedDate || new Date(0)) && "bg-blue-200",
                  !(hasMounted && isToday(day)) && !isSameDay(day, selectedDate || new Date(0)) && "hover:bg-slate-50",
                )}
                style={{ gridRow: dayIndex + 2, gridColumn: 1 }}
              >
                <span className="text-xs text-slate-500">{format(day, 'E', { locale: zhTW })}</span>
                <span className="text-xl font-bold text-slate-700">{format(day, 'd')}</span>
              </div>
              {visibleEquipments.map((eq, eqIndex) => (
                <Tooltip key={`cell-${eq.id}-${day.toISOString()}`}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={canEdit ? () => handleCellClick(day, eq) : undefined}
                      className={cn(
                        "relative h-24 border-b border-l border-slate-200 group transition-colors",
                        canEdit && "cursor-pointer hover:bg-slate-50/50"
                      )}
                      style={{ gridColumn: eqIndex + 2, gridRow: dayIndex + 2 }}
                    >
                      <div className="absolute pointer-events-none inset-0 flex items-center justify-center p-1 gap-1">
                        {canEdit && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center w-10 h-10 bg-blue-600/90 rounded-full shadow-lg">
                            <Plus size={24} className="text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={4} className="max-w-xs space-y-1.5 p-3 pointer-events-none z-50">
                    <p className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-1">{eq.name}</p>
                    <div className="flex flex-col gap-1 text-xs text-slate-600">
                      <p className="font-mono text-[11px]"><span className="font-bold text-slate-500 mr-1">編號</span> {eq.id}</p>
                      {eq.remark && <p className="leading-relaxed"><span className="font-bold text-slate-500 mr-1">規格</span> {eq.remark}</p>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </React.Fragment>
          ))}

          {/* Event Overlays */}
          <div className="contents">
            {allGanttEvents.map(event => {
              const eqIndex = visibleEquipments.findIndex(eq => eq.id === event.equipmentId);
              if (eqIndex === -1) return null;

              if (!isWithinInterval(event.startDate, { start: monthStart, end: monthEnd }) && !isWithinInterval(event.endDate, { start: monthStart, end: monthEnd }) && !(isBefore(event.startDate, monthStart) && isAfter(event.endDate, monthEnd))) {
                return null;
              }

              const eventStartInView = isAfter(event.startDate, monthStart) ? event.startDate : monthStart;
              const eventEndInView = isBefore(event.endDate, monthEnd) ? event.endDate : monthEnd;

              const startRowIndex = differenceInDays(eventStartInView, monthStart);
              const durationDays = differenceInDays(eventEndInView, eventStartInView) + 1;

              if (durationDays <= 0) return null;

              const dayKey = `${format(event.startDate, 'yyyy-MM-dd')}_${event.equipmentId}`;
              const dayEvents = (eventsByDateAndEquipment.get(dayKey) || []).filter(e => isWithinInterval(event.startDate, { start: e.startDate, end: e.endDate }));
              const totalSiblings = dayEvents.length;
              const siblingIndex = dayEvents.findIndex(e => e.id === event.id);

              const width = totalSiblings > 0 ? 100 / totalSiblings : 100;
              const left = (siblingIndex > -1 ? siblingIndex : 0) * width;

              const isCalibration = event.workOrder === '校正';
              const color = isCalibration ? '#facc15' : (equipmentColorMap.get(event.equipmentId) || '#ccc');

              const containerStyle: React.CSSProperties = {
                gridColumn: eqIndex + 2,
                gridRow: `${startRowIndex + 2} / span ${durationDays}`,
                zIndex: 20,
                position: 'relative',
                pointerEvents: 'none'
              };

              const eventStyle: React.CSSProperties = {
                top: '2px',
                bottom: '2px',
                backgroundColor: `${color}22`,
                borderColor: color,
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
                position: 'absolute',
                pointerEvents: 'auto'
              };

              return (
                <div key={event.id} style={containerStyle}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div style={eventStyle} className="m-0 p-2 rounded-lg border-2 flex flex-col justify-start overflow-hidden cursor-pointer group">
                        <p className="font-bold text-xs truncate" style={{ color }}>{event.workOrder}</p>
                        <p className="text-xs truncate" style={{ color: `${color}dd` }}>{event.productName}</p>
                        <p className="text-xs truncate mt-auto pt-1" style={{ color: `${color}cc` }}>
                          {event.client}
                        </p>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" side="right" align="start">
                      <div className="space-y-3">
                        <h4 className="font-bold">{event.productName}</h4>
                        <InfoItem icon={<ClipboardList size={14} />} label="工單號碼" value={event.workOrder} />
                        <InfoItem icon={<User size={14} />} label="測試人員" value={event.tester} />
                        <InfoItem icon={<User size={14} />} label="委託者" value={event.client} />
                        <InfoItem icon={<Info size={14} />} label="測試備註" value={event.notes} />
                        <InfoItem icon={<Cpu size={14} />} label="機台名稱" value={event.equipmentName} />
                      </div>
                      {canEdit && event.workOrder !== '校正' && (
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                          <Button size="sm" onClick={() => handleEditClick(event)}><Pencil size={14} className="mr-2" /> 編輯</Button>
                          <Button size="sm" variant="destructive" onClick={async () => {
                            const result = await deleteScheduleAction(event.id, true);
                            if (result.success) {
                              setSchedules(prev => prev.filter(s => s.bookingId !== event.id && s.id !== event.id));
                              toast({ title: '刪除成功', description: '排程已刪除。' });
                            } else {
                              toast({ title: '刪除失敗', variant: 'destructive' });
                            }
                          }}><Trash2 size={14} className="mr-2" /> 刪除</Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </TooltipProvider>


      {selectedDate && dailyFocusData && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">
            <span className="text-slate-400">{format(selectedDate, 'yyyy-MM-dd')}</span> 本日焦點
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-destructive mb-2 flex items-center gap-2"><EyeOff /> 已使用機台 ({dailyFocusData.used.length})</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {dailyFocusData.used.map(eq => (
                  <div key={eq.id} className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                    <p className="font-bold text-sm text-rose-800">{eq.name}</p>
                    <p className="text-xs text-rose-600 font-mono">{eq.id}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-green-600 mb-2 flex items-center gap-2"><Eye /> 可使用機台 ({dailyFocusData.available.length})</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {dailyFocusData.available.map(eq => (
                  <div key={eq.id} className="p-4 rounded-xl bg-green-50 border border-green-200">
                    <p className="font-bold text-sm text-green-800">{eq.name}</p>
                    <p className="text-xs text-green-600 font-mono">{eq.id}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                <CalendarIcon className="text-blue-600" size={20} />
                {editingEvent ? '編輯排程' : '機台區間智慧預約'}
              </h4>
              <button onClick={() => setShowBookingModal(false)} className="p-2 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-500"><X size={24} /></button>
            </div>
            <form onSubmit={handleBookingSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">篩選分類</label>
                    <select value={modalCategory} onChange={e => setModalCategory(e.target.value)} className="w-full mt-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-500">
                      {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">搜尋名稱/編號</label>
                    <input
                      type="text"
                      placeholder="輸入關鍵字..."
                      value={modalSearchTerm}
                      onChange={e => setModalSearchTerm(e.target.value)}
                      className="w-full mt-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">選擇預約機台</label>
                  <select value={bookingForm.equipmentId} onChange={e => setBookingForm({ ...bookingForm, equipmentId: e.target.value })} className="w-full mt-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-500">
                    {modalFilteredEquipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.id})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">開始日期</label>
                    <input type="date" value={bookingForm.startDate} onChange={e => handleStartDateChange(e.target.value)} className="w-full mt-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-blue-600 uppercase tracking-widest ml-1">預約天數</label>
                    <input type="number" min="1" value={bookingForm.bookingDays} onChange={e => handleDaysChange(e.target.value)} className="w-full mt-1 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl text-sm font-black outline-none text-blue-700" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">結束日期</label>
                    <input type="date" value={bookingForm.endDate} onChange={e => handleEndDateChange(e.target.value)} className="w-full mt-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black outline-none" />
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${bookingIssues.some(c => c.isError) ? 'bg-rose-50 border-rose-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold ${bookingIssues.some(c => c.isError) ? 'text-rose-600' : 'text-green-600'}`}>
                    {bookingIssues.some(c => c.isError) ? `偵測到 ${bookingIssues.filter(c => c.isError).length} 筆衝突` : (bookingIssues.length > 0 ? '有提醒事項' : '此區間可預約')}
                  </p>
                </div>
                {bookingIssues.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs font-semibold max-h-20 overflow-y-auto">
                    {bookingIssues.map((c, i) => <p key={i} className={c.isError ? 'text-rose-700' : 'text-amber-700'}>• {c.message}</p>)}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="relative">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">工服單號 (自動勾稽專案)</label>
                  <input type="text" list="project-wo-suggestions" placeholder="輸入工單..." value={bookingForm.workOrder} onChange={e => handleBookingWorkOrderChange(e.target.value)} className="w-full mt-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">委測者</label>
                    <input type="text" placeholder="輸入委測者..." value={bookingForm.client} onChange={e => setBookingForm({ ...bookingForm, client: e.target.value })} className="w-full mt-1 px-4 py-3 bg-slate-100 border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">品名</label>
                    <input type="text" placeholder="輸入品名..." value={bookingForm.productName} onChange={e => setBookingForm({ ...bookingForm, productName: e.target.value })} className="w-full mt-1 px-4 py-3 bg-slate-100 border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">負責工程師</label>
                    <input type="text" placeholder="輸入工程師姓名..." value={bookingForm.tester} onChange={e => setBookingForm({ ...bookingForm, tester: e.target.value })} className="w-full mt-1 px-4 py-3 bg-slate-100 border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">測試備註</label>
                  <Textarea
                    placeholder="輸入測試相關備註..."
                    value={bookingForm.notes || ''}
                    onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })}
                    className="w-full mt-1 px-4 py-3 bg-slate-100 border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button type="submit" disabled={bookingIssues.some(c => c.isError)} className={cn('w-full py-4 rounded-2xl font-black text-sm transition-all shadow-xl', bookingIssues.some(c => c.isError) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200')}>
                {editingEvent ? '確認更新' : '確認並儲存預約'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentSchedule;

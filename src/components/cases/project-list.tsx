'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Search, Filter, User as UserIcon, Settings2, CheckCircle2, Upload, FileSpreadsheet, Pencil, ArrowUp, ArrowDown, CalendarDays, Settings, Check, Building, UserSquare, ChevronDown, Info } from 'lucide-react';
import type { ProjectData } from '@/lib/schedule-types';
import { STATUS_SOLID_COLORS } from '@/lib/constants';
import type { UserInfo, Case, Engineer, ProjectNote } from '@/lib/types';
import { UserRole } from '@/lib/types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx-js-style';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { importCasesAction, clearAllCasesAction, saveProjectNoteAction } from '@/lib/sqlite-api';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { isProjectDelayed, safeParseDate } from '@/lib/date-utils';
import { ActionButton } from '@/components/common/PageHeaderActions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';


interface ProjectListProps {
  projects: ProjectData[];
  engineers: Engineer[];
  notes: ProjectNote[];
  user: UserInfo;
  onAdd: (p: ProjectData) => void;
  onUpdate: (p: ProjectData) => void;
  onDelete: (id: string) => void;
  globalTesters: string[];
  setGlobalTesters: React.Dispatch<React.SetStateAction<string[]>>;
  globalStatus: string;
  setGlobalStatus: React.Dispatch<React.SetStateAction<string>>;
  readOnly?: boolean;
  pageType?: 'project' | 'maintenance';
  limit?: number;
  setLimit?: (val: number | undefined) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ 
  projects, engineers, notes, user, onAdd, onUpdate, onDelete, 
  globalTesters, setGlobalTesters, globalStatus, setGlobalStatus,
  readOnly = false,
  pageType = 'project',
  limit,
  setLimit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [testItemSearch, setTestItemSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [internalItemsPerPage, setInternalItemsPerPage] = useState<number | undefined>(25);

  const effectiveItemsPerPage = limit !== undefined ? limit : internalItemsPerPage;
  const setEffectiveItemsPerPage = setLimit || setInternalItemsPerPage;

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const notesMap = useMemo(() => {
    const map = new Map<string, ProjectNote>();
    if (!notes) return map;

    // Sort by creation date, newest first, to show the latest note.
    const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    sortedNotes.forEach(note => {
        if (note.workOrderId && !map.has(note.workOrderId)) {
            map.set(note.workOrderId, note);
        }
    });
    return map;
  }, [notes]);

  const projectsWithComputedStatus = useMemo(() => {
    return projects.map(p => {
        // Priority 1: "已取消" (Cancelled) has the highest priority
        if (p.status === '已取消') {
            return p;
        }

        // Priority 2: If completion date exists (and not cancelled), show as "已完成"
        if (p.endDate && p.endDate.trim() !== '') {
            return { ...p, status: '已完成' };
        }
        
        // Priority 3: Other terminal statuses (already "已完成", "已結案", "設備保養完成")
        const terminalStatuses = ['已完成', '已結案', '設備保養完成'];
        if (terminalStatuses.includes(p.status)) {
            return p;
        }

        // Priority 4: Delay check
        if (mounted && isProjectDelayed(p, new Date())) {
            return { ...p, status: '延遲中' };
        }
        
        return p;
    });
  }, [projects, mounted]);

  const allStatuses = useMemo(() => {
    const maintenanceSpecificStatuses = ['設備保養', '設備保養完成'];
    const projectSpecificStatuses = ['實驗中', '已完成', '已取消', '延遲中'];
    
    if (pageType === 'maintenance') {
      const set = new Set(maintenanceSpecificStatuses);
      projectsWithComputedStatus.forEach(p => {
        if (maintenanceSpecificStatuses.includes(p.status)) set.add(p.status);
      });
      return Array.from(set).sort();
    }
    
    const relevantStatuses = new Set(projectsWithComputedStatus.map(p => p.status));

    projectSpecificStatuses.forEach(s => relevantStatuses.add(s));
    
    maintenanceSpecificStatuses.forEach(s => relevantStatuses.delete(s));
    
    return Array.from(relevantStatuses).sort();
  }, [projectsWithComputedStatus, pageType]);

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(allStatuses));

  useEffect(() => {
    setSelectedStatuses(new Set(allStatuses));
  }, [allStatuses]);
  

  const handleStatusChange = (status: string) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };
  
  const setAllStatuses = (select: boolean) => {
    if (select) {
      setSelectedStatuses(new Set(allStatuses));
    } else {
      setSelectedStatuses(new Set());
    }
  }

  const [visibleColumns, setVisibleColumns] = useState({
    workOrderId: true,
    partNo: pageType === 'maintenance' ? false : true,
    tester: true,
    productName: true,
    testItems: pageType === 'maintenance' ? false : true,
    notes: true,
    status: true,
    priority: pageType === 'maintenance' ? false : true,
    estimatedDate: true,
    department: false,
    creator: false,
    id: false,
    requiredDate: false,
    startDate: false,
    endDate: false,
  });

  const columnLabels: Record<keyof typeof visibleColumns, string> = {
    workOrderId: '工單編號',
    partNo: pageType === 'maintenance' ? '設備編號' : '機台編號 / 料號',
    tester: '負責人',
    productName: pageType === 'maintenance' ? '設備名稱' : '產品品名',
    testItems: '測試項目',
    notes: '最新備註',
    status: '案件狀態',
    priority: '優先級',
    estimatedDate: '預計日期',
    department: '送樣部門',
    creator: '建立者',
    id: '專案ID',
    requiredDate: '需要日期',
    startDate: '開始日期',
    endDate: '完成日期'
  };

  const requestSort = (key: string) => {
    if (key !== 'estimatedDate') return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return null;
    if (sortConfig.direction === 'ascending') return <ArrowUp size={12} className="ml-1" />;
    return <ArrowDown size={12} className="ml-1" />;
  };

  const allTesters = useMemo(() => engineers.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')), [engineers]);
  const allDepartments = useMemo(() => [...Array.from(new Set(projectsWithComputedStatus.map(p => p.department).filter(Boolean) as string[]))].sort((a, b) => a.localeCompare(b, 'zh-Hant')), [projectsWithComputedStatus]);
  const allCreators = useMemo(() => [...Array.from(new Set(projectsWithComputedStatus.map(p => p.creator).filter(Boolean) as string[]))].sort((a, b) => a.localeCompare(b, 'zh-Hant')), [projectsWithComputedStatus]);
  
  const formatTestDetails = (details: ProjectData['testDetails'], workOrderId?: string) => {
    if (workOrderId?.startsWith('C')) return '尺寸量測';
    if (!details) return '無';
    const parts = [];
    if (details.dimensions && details.dimensions !== '無') parts.push(details.dimensions);
    if (details.force && details.force !== '無') parts.push(details.force);
    if (details.electrical && details.electrical !== '無') parts.push(details.electrical);
    if (details.material && details.material !== '無') parts.push(details.material);
    if (details.environment && details.environment !== '無') parts.push(details.environment);
    if (details.other && details.other !== '無') parts.push(details.other);
    return parts.length > 0 ? parts.join(', ') : '無';
  };

  const testDetailLabels: Record<string, string> = {
      dimensions: '尺寸測量',
      force: '力量測試',
      electrical: '電性測試',
      material: '材料測試',
      environment: '環境測試',
      other: '其他項目',
  };

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projectsWithComputedStatus.filter(p => {
      const searchTarget = `${p.id} ${p.productName} ${p.workOrderId || ''} ${p.partNo || ''}`.toLowerCase();
      const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
      
      const isAllSelected = globalTesters.includes('所有人');
      const matchesTester = isAllSelected || globalTesters.includes(p.tester);
      
      const matchesStatus = selectedStatuses.size === allStatuses.length || selectedStatuses.has(p.status);
      
      const testDetailsStr = formatTestDetails(p.testDetails, p.workOrderId).toLowerCase();
      const matchesTestItems = testItemSearch === '' || testDetailsStr.includes(testItemSearch.toLowerCase());

      const matchesDate = (() => {
        if (!dateFilter.start && !dateFilter.end) return true;
        if (!p.estimatedDate) return false;
        try {
            const projectDate = safeParseDate(p.estimatedDate);
            if (!projectDate) return false;
            projectDate.setHours(0, 0, 0, 0);

            if (dateFilter.start) {
                const startDate = new Date(dateFilter.start);
                startDate.setHours(0,0,0,0);
                if (projectDate < startDate) return false;
            }
            if (dateFilter.end) {
                const endDate = new Date(dateFilter.end);
                endDate.setHours(0,0,0,0);
                if (projectDate > endDate) return false;
            }
            return true;
        } catch {
            return false;
        }
      })();
      
      const matchesDepartment = selectedDepartments.size === 0 || (p.department && selectedDepartments.has(p.department));
      const matchesCreator = selectedCreators.size === 0 || (p.creator && selectedCreators.has(p.creator));

      return matchesSearch && matchesTester && matchesStatus && matchesTestItems && matchesDate && matchesDepartment && matchesCreator;
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
          const aValue = a[sortConfig.key as keyof ProjectData];
          const bValue = b[sortConfig.key as keyof ProjectData];

          if (!aValue) return 1;
          if (!bValue) return -1;
          
          if (sortConfig.key === 'estimatedDate') {
              try {
                  const dateA = new Date(aValue as string);
                  const dateB = new Date(bValue as string);
                  if (isNaN(dateA.getTime())) return 1;
                  if (isNaN(dateB.getTime())) return -1;
                  
                  if (dateA < dateB) {
                      return sortConfig.direction === 'ascending' ? -1 : 1;
                  }
                  if (dateA > dateB) {
                      return sortConfig.direction === 'ascending' ? 1 : -1;
                  }
              } catch {
                  return 0;
              }
          }
          
          return 0;
      });
    }

    return filtered;

  }, [projects, searchTerm, globalTesters, selectedStatuses, allStatuses, testItemSearch, dateFilter, sortConfig, selectedDepartments, selectedCreators]);

  // Reset page to 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, globalTesters, selectedStatuses, testItemSearch, dateFilter, sortConfig, selectedDepartments, selectedCreators, effectiveItemsPerPage]);

  const paginatedProjects = useMemo(() => {
    if (effectiveItemsPerPage === undefined) return filteredAndSortedProjects;
    const startIndex = (currentPage - 1) * effectiveItemsPerPage;
    return filteredAndSortedProjects.slice(startIndex, startIndex + effectiveItemsPerPage);
  }, [filteredAndSortedProjects, currentPage, effectiveItemsPerPage]);

  const totalPages = useMemo(() => {
    if (effectiveItemsPerPage === undefined || filteredAndSortedProjects.length === 0) return 1;
    return Math.ceil(filteredAndSortedProjects.length / effectiveItemsPerPage);
  }, [filteredAndSortedProjects, effectiveItemsPerPage]);

  const [form, setForm] = useState<Partial<ProjectData>>({});

  const openModal = (p?: ProjectData) => {
    if (readOnly) return;
    if (p) {
      setEditingProject(p);
      setForm(p);
    } else {
      setEditingProject(null);
      setForm({
        id: `CASE-${Date.now().toString().slice(-8)}`,
        workOrderId: `WO-${Date.now().toString().slice(-8)}`,
        productName: '',
        partNo: '',
        tester: '實驗室主管',
        status: '已指派',
        priority: '一般件',
        department: '',
        creator: user.name,
        estimatedDate: new Date().toLocaleDateString('en-CA').replace(/-/g, '/'),
        testDetails: { dimensions: '', force: '', electrical: '', material: '', environment: '', other: '' },
      });
    }
    setShowAddModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) onUpdate(form as ProjectData);
    else onAdd(form as ProjectData);
    setShowAddModal(false);
  };

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const processImportedData = async (data: any[]) => {
    const HEADER_MAPPING: { [key: string]: string } = {
        '名稱': 'name',
        '狀態': 'status',
        '送樣單位': 'department',
        '建立者': 'creator',
        '工單編號': 'workOrderId',
        '機台編號 / 料號': 'partNo',
        '設備編號': 'partNo', // Alias for maintenance
        '品名': 'productName',
        '設備名稱': 'productName', // Alias for maintenance
        '需要日期': 'requiredDate',
        '收件日期': 'receptionDate',
        '預計測試完成日期': 'estimatedCompletionDate',
        '預計完成日期': 'estimatedCompletionDate', // Alias for maintenance
        '檢測者': 'labManager',
        '負責人': 'labManager', // Alias for maintenance
        '應測項目數': 'testItemsCount',
        '開始日期': 'startDate',
        '完成日期': 'actualCompletionDate',
        '完成項目數': 'completedItemsCount',
        '專案編號': 'projectId',
        '送件順序': 'submissionOrder',
        '測1_尺寸測量': 'dimensions',
        '測2_力量測試': 'force',
        '測3_電性測試': 'electrical',
        '測4_材料測試': 'material',
        '測5_環境測試': 'environment',
        '測試其他項目': 'other',
        '合格': 'passCount',
        '不合格': 'failCount',
        '不判定': 'naCount',
        '完成審核時間': 'auditTime',
        '費用': 'cost',
        '編號': 'id',
        '客戶': 'customer',
        '實驗室負責人': 'labManager',
        '預計完成日': 'estimatedCompletionDate',
    };

    let skippedCount = 0;
    const casesToUpsert: Partial<Case>[] = data.map((row: any) => {
        const newRow: { [key: string]: any } = {};
        let testDetails: any = {};
        
        for (const key in row) {
            const trimmedKey = key.replace(/^\uFEFF/, '').trim();
            if (Object.prototype.hasOwnProperty.call(row, key) && HEADER_MAPPING[trimmedKey]) {
                const mappedKey = HEADER_MAPPING[trimmedKey];
                if (['dimensions', 'force', 'electrical', 'material', 'environment', 'other'].includes(mappedKey)) {
                    testDetails[mappedKey] = row[key];
                } else {
                    newRow[mappedKey] = row[key];
                }
            }
        }

        if (Object.keys(testDetails).length > 0) {
            newRow.testDetails = testDetails;
        }
        
        if (!newRow.workOrderId) {
            newRow.workOrderId = row['工單號碼'] || row['工服單號'];
        }

        if (!newRow.workOrderId) {
            skippedCount++;
            return null;
        }

        newRow.id = newRow.workOrderId;
        
        if (!newRow.status) {
          newRow.status = pageType === 'maintenance' ? '設備保養' : 'Assigned';
        }

        const numericFields: (keyof Case)[] = ['testItemsCount', 'completedItemsCount', 'submissionOrder', 'passCount', 'failCount', 'naCount', 'rejectionCount'];
        numericFields.forEach(field => {
            newRow[field] = Number(newRow[field]) || 0;
        });

        const stringFields: (keyof Case)[] = ['name', 'status', 'department', 'creator', 'workOrderId', 'productName', 'requiredDate', 'receptionDate', 'estimatedCompletionDate', 'labManager', 'startDate', 'actualCompletionDate', 'projectId', 'auditTime', 'cost', 'partNo', 'customer', 'pm', 'poNo', 'closingDate', 'remarks', 'priorityReason'];
        stringFields.forEach(field => {
            newRow[field] = newRow[field] ? String(newRow[field]) : '';
        });

        if (!newRow.testDetails) newRow.testDetails = {};
        const testDetailFields = ['dimensions', 'force', 'electrical', 'material', 'environment', 'other'];
        testDetailFields.forEach(field => {
            if (newRow.testDetails) {
                (newRow.testDetails as any)[field] = (newRow.testDetails as any)[field] ? String((newRow.testDetails as any)[field]) : '';
            }
        })

        return newRow as Partial<Case>;
    }).filter((c): c is Case => c !== null);

    if (casesToUpsert.length === 0) {
        let description = "檔案中沒有找到有效的案件資料。";
        if (skippedCount > 0) {
            description += ` 已跳過 ${skippedCount} 筆缺少唯一識別碼（如'工單編號'）的資料。`;
        } else {
            description += " 請檢查欄位名稱是否正確。";
        }
        toast({ title: '上傳失敗', description, variant: 'destructive' });
        return;
    }

    try {
        toast({ title: '處理中', description: '正在將資料寫入系統中，請稍候...' });
        const result = await importCasesAction(casesToUpsert);
        
        if (result && result.error) {
            throw new Error(result.error);
        }

        let successDescription = `${casesToUpsert.length} 筆資料已同步完成！`;
        if (skippedCount > 0) {
            successDescription += ` 已跳過 ${skippedCount} 筆缺少識別碼的資料。`;
        }
        toast({ title: '上傳成功', description: successDescription });
        
        // Auto refresh to reflect changes from Server Action
        setTimeout(() => {
            window.location.reload();
        }, 800);

    } catch (e: any) {
         toast({ title: '上傳失敗', description: e.message || '同步資料時發生錯誤。', variant: 'destructive' });
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
      reader.onload = (event) => {
        const csvText = event.target?.result as string;
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: false,
          complete: (results) => {
            processImportedData(results.data);
          },
          error: (err: any) => {
            toast({
              title: '檔案解析失敗',
              description: `CSV 解析錯誤: ${err.message}`,
              variant: 'destructive',
            });
          },
        });
      };
      reader.readAsText(file, 'utf-8');
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true, dateNF: 'yyyy/mm/dd' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy/mm/dd' });
          processImportedData(jsonData);
        } catch (error) {
          console.error('Excel import error:', error);
          toast({
            title: '匯入失敗',
            description: '解析 Excel 檔案時發生錯誤。',
            variant: 'destructive',
          });
        }
      };
      reader.readAsBinaryString(file);
    } else {
      toast({
        title: '檔案類型錯誤',
        description: '請上傳 CSV 或 Excel 格式的檔案。',
        variant: 'destructive',
      });
    }
  };


  const handleExportExcel = () => {
    if (!filteredAndSortedProjects || filteredAndSortedProjects.length === 0) {
        toast({ title: '無資料', description: '目前沒有符合篩選條件的案件資料可供匯出。', variant: 'destructive'});
        return;
    }
    
    const dataToExport = filteredAndSortedProjects.map(p => ({
        '名稱': p.name || '',
        '狀態': p.status,
        '送樣單位': p.department || '',
        '建立者': p.creator || '',
        '工單編號': p.workOrderId || '',
        '機台編號 / 料號': p.partNo || '',
        '品名': p.productName,
        '需要日期': p.requiredDate || '',
        '收件日期': p.receptionDate || '',
        '預計測試完成日期': p.estimatedDate,
        '檢測者': p.tester,
        '應測項目數': p.testItemsCount || 0,
        '開始日期': p.startDate || '',
        '完成日期': p.endDate || '',
        '完成項目數': p.completedItemsCount || 0,
        '專案編號': p.projectId || '',
        '送件順序': p.submissionOrder || 0,
        '測1_尺寸測量': p.testDetails?.dimensions || '',
        '測2_力量測試': p.testDetails?.force || '',
        '測3_電性測試': p.testDetails?.electrical || '',
        '測4_材料測試': p.testDetails?.material || '',
        '測5_環境測試': p.testDetails?.environment || '',
        '測試其他項目': p.testDetails?.other || '',
        '合格': p.passCount || 0,
        '不合格': p.failCount || 0,
        '不判定': p.naCount || 0,
        '完成審核時間': p.auditTime || '',
        '費用': p.cost || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
    
    ws['!cols'] = Object.keys(dataToExport[0]).map(key => ({ wch: key.length > 10 ? 20 : 15 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cases");
    XLSX.writeFile(wb, "Lab_Cases_Export.xlsx");
  };

  const handleClear = async () => {
      if (window.confirm(`您確定要清空所有【${pageType === 'maintenance' ? '設備保養' : '專案進度'}】資料嗎？此操作無法復原。`)) {
          const result = await clearAllCasesAction(pageType);
          if (result.success) {
              toast({ title: '操作成功', description: '所有資料已清空' });
          } else {
              toast({ title: '操作失敗', description: result.error, variant: 'destructive' });
          }
      }
  }

  const handleNoteSave = async (newNoteText: string, project: ProjectData) => {
    if (readOnly || !project.workOrderId) return;

    const existingNote = notesMap.get(project.workOrderId!);

    if (newNoteText === (existingNote?.note || '')) {
        return; // No change
    }
    
    if (!existingNote && newNoteText.trim() === '') {
        return; // Don't save a new note if it's empty
    }

    const notePayload: Partial<ProjectNote> = {
        id: existingNote?.id,
        workOrderId: project.workOrderId,
        note: newNoteText,
        author: existingNote?.author || user.name,
        createdAt: existingNote?.createdAt, // To preserve original creation time
    };

    saveProjectNoteAction(notePayload, !existingNote);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
        {/* Filters Group */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder={pageType === 'maintenance' ? '搜尋設備名稱或編號...' : '搜尋編號、品名或料號...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            {pageType === 'project' && (
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="搜尋測試項目..." 
                      value={testItemSearch}
                      onChange={e => setTestItemSearch(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
            )}

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2">
                <CalendarDays size={14} className="text-slate-400" />
                <input 
                    type="date" 
                    value={dateFilter.start}
                    onChange={e => setDateFilter(prev => ({...prev, start: e.target.value}))}
                    className="bg-transparent text-xs font-black outline-none w-full cursor-pointer"
                />
                <span className="text-slate-400">-</span>
                <input 
                    type="date" 
                    value={dateFilter.end}
                    onChange={e => setDateFilter(prev => ({...prev, end: e.target.value}))}
                    className="bg-transparent text-xs font-black outline-none w-full cursor-pointer"
                />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-slate-50 border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-auto">
                    <div className="flex items-center gap-2">
                      <Building size={16} className="text-slate-400" />
                      <span className="text-slate-800">
                        {selectedDepartments.size === 0 ? '所有部門' : selectedDepartments.size === 1 ? [...selectedDepartments][0] : `已選 ${selectedDepartments.size} 個部門`}
                      </span>
                      <ChevronDown size={14} className="text-slate-400" />
                    </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>篩選送樣部門</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allDepartments.map((dept) => (
                  <DropdownMenuCheckboxItem
                    key={dept}
                    checked={selectedDepartments.has(dept)}
                    onCheckedChange={(checked) => {
                      setSelectedDepartments(prev => {
                        const newSet = new Set(prev);
                        if (checked) newSet.add(dept);
                        else newSet.delete(dept);
                        return newSet;
                      })
                    }}
                  >
                    {dept}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-slate-50 border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-auto">
                    <div className="flex items-center gap-2">
                      <UserSquare size={16} className="text-slate-400" />
                      <span className="text-slate-800">
                        {selectedCreators.size === 0 ? '所有建立者' : selectedCreators.size === 1 ? [...selectedCreators][0] : `已選 ${selectedCreators.size} 個建立者`}
                      </span>
                      <ChevronDown size={14} className="text-slate-400" />
                    </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>篩選建立者</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allCreators.map((creator) => (
                  <DropdownMenuCheckboxItem
                    key={creator}
                    checked={selectedCreators.has(creator)}
                    onCheckedChange={(checked) => {
                      setSelectedCreators(prev => {
                        const newSet = new Set(prev);
                        if (checked) newSet.add(creator);
                        else newSet.delete(creator);
                        return newSet;
                      })
                    }}
                  >
                    {creator}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setShowColumnConfig(!showColumnConfig)}
                className={`p-3 rounded-2xl transition-all ${showColumnConfig ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
                title="欄位編排設定"
              >
                <Settings2 size={18} />
              </button>
              
              {showColumnConfig && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 p-6 animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                    <p className="text-xs font-black text-slate-800 uppercase tracking-widest">標題顯示設定</p>
                    <button onClick={() => setShowColumnConfig(false)}><X size={14} className="text-slate-400" /></button>
                  </div>
                  <div className="space-y-3">
                    {Object.keys(columnLabels).map((key) => (
                      <label key={key} className="flex items-center justify-between group cursor-pointer">
                        <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600 transition-colors">
                          {columnLabels[key as keyof typeof columnLabels]}
                        </span>
                        <input 
                          type="checkbox" 
                          checked={visibleColumns[key as keyof typeof visibleColumns]} 
                          onChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                          className="w-4 h-4 rounded border-slate-200 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {!readOnly && (
              <>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={(e) => {
                  if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                      e.target.value = '';
                  }
                }} />
                <ActionButton variant="import" icon={Upload} onClick={() => fileInputRef.current?.click()}>
                    上傳檔案
                </ActionButton>
              </>
            )}
            <ActionButton variant="export" icon={FileSpreadsheet} onClick={handleExportExcel}>
                下載 Excel
            </ActionButton>
            {!readOnly && pageType !== 'maintenance' && (
              <ActionButton variant="primary" icon={Plus} onClick={() => openModal()}>
                新增實驗
              </ActionButton>
            )}
            {!readOnly && (
            <ActionButton variant="destructive" icon={Trash2} onClick={handleClear} className="px-4 py-3">
                清空所有資料 (測試用)
            </ActionButton>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="limit-select" className="text-xs font-bold text-slate-500 shrink-0">顯示筆數:</label>
              <select
                id="limit-select"
                value={effectiveItemsPerPage === undefined ? 'all' : effectiveItemsPerPage}
                onChange={e => {
                    const val = e.target.value;
                    setEffectiveItemsPerPage(val === 'all' ? undefined : Number(val));
                }}
                className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value={25}>25 筆</option>
                <option value={50}>50 筆</option>
                <option value="all">全部</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <UserIcon size={16} className="text-muted-foreground" />
                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">篩選測試者</span>
              </div>
              <button
                onClick={() => setGlobalTesters(['所有人'])}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                全部選擇
              </button>
              <button
                onClick={() => setGlobalTesters([])}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                全部清除
              </button>
            </div>
             <div className="flex flex-wrap items-center gap-2">
              <label
                className={cn(
                  "flex items-center gap-2 cursor-pointer rounded-lg border-2 text-xs font-bold transition-all px-3 py-2",
                  (globalTesters.includes('所有人') || globalTesters.length === 0)
                    ? "bg-blue-600 text-white border-transparent shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                <div className={cn(
                    "w-4 h-4 rounded-sm border flex items-center justify-center transition-all shrink-0",
                    (globalTesters.includes('所有人') || globalTesters.length === 0)
                        ? "bg-white/20 border-white/50" 
                        : "bg-white border-slate-300"
                )}>
                    {(globalTesters.includes('所有人') || globalTesters.length === 0) && <Check className="w-3 h-3" />}
                </div>
                <span>所有人</span>
                <input
                    type="checkbox"
                    checked={globalTesters.includes('所有人') || globalTesters.length === 0}
                    onChange={() => {
                        const isAll = globalTesters.includes('所有人') || globalTesters.length === 0;
                        if (!isAll) setGlobalTesters(['所有人']);
                    }}
                    className="sr-only"
                />
              </label>
              {allTesters.map((t) => {
                const isSelected = globalTesters.includes(t.name);
                return (
                  <label
                    key={t.id}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer rounded-lg border-2 text-xs font-bold transition-all px-3 py-2",
                      isSelected 
                        ? "bg-blue-600 text-white border-transparent shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <div className={cn(
                        "w-4 h-4 rounded-sm border flex items-center justify-center transition-all shrink-0",
                        isSelected 
                            ? "bg-white/20 border-white/50" 
                            : "bg-white border-slate-300"
                    )}>
                        {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <span>{t.name}</span>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                            const checked = e.target.checked;
                            setGlobalTesters((prev: string[]) => {
                              let newArr = prev.filter(name => name !== '所有人');
                              if (checked) newArr.push(t.name);
                              else newArr = newArr.filter(name => name !== t.name);
                              return newArr.length === 0 ? ['所有人'] : newArr;
                            });
                        }}
                        className="sr-only"
                    />
                  </label>
                );
              })}
            </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-muted-foreground" />
                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">篩選狀態</span>
              </div>
              <button
                onClick={() => setAllStatuses(true)}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                全部選擇
              </button>
              <button
                onClick={() => setAllStatuses(false)}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                全部清除
              </button>
            </div>
             <div className="flex flex-wrap items-center gap-2">
              {allStatuses.map((status) => {
                const isSelected = selectedStatuses.has(status);
                return (
                  <label
                    key={status}
                    htmlFor={`status-${status}`}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer rounded-lg border-2 text-xs font-bold transition-all px-3 py-2", // Base styles
                      isSelected 
                        ? cn(STATUS_SOLID_COLORS[status] || STATUS_SOLID_COLORS.default, 'border-transparent shadow-sm') // isSelected styles
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" // Not selected styles
                    )}
                  >
                    {/* Custom Checkbox */}
                    <div className={cn(
                        "w-4 h-4 rounded-sm border flex items-center justify-center transition-all shrink-0",
                        isSelected 
                            ? "bg-white/20 border-white/50" 
                            : "bg-white border-slate-300"
                    )}>
                        {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    
                    {/* Text */}
                    <span>{status}</span>
            
                    {/* Hidden native checkbox */}
                    <input
                        id={`status-${status}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleStatusChange(status)}
                        className="sr-only"
                    />
                  </label>
                );
              })}
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-xs font-black uppercase text-slate-400 tracking-widest">
                {Object.entries(visibleColumns).map(([key, visible]) => {
                  if (!visible) return null;
                  const isSortable = key === 'estimatedDate';
                  
                  return (
                      <th key={key} className="px-4 py-5">
                          {isSortable ? (
                              <button onClick={() => requestSort(key)} className="flex items-center gap-1 hover:text-slate-600 transition-colors p-0 bg-transparent text-left font-black uppercase text-slate-400 tracking-widest">
                                  {columnLabels[key as keyof typeof columnLabels]}
                                  {getSortIcon(key)}
                              </button>
                          ) : (
                              <span>{columnLabels[key as keyof typeof columnLabels]}</span>
                          )}
                      </th>
                  );
              })}
                {user.role === UserRole.MANAGER && !readOnly && <th className="px-8 py-5 text-right">管理操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedProjects.map(p => {
                const isDelayed = p.status === '延遲中';
                const noteForProject = p.workOrderId ? notesMap.get(p.workOrderId) : undefined;
                
                return (
                  <tr key={p.id} className={cn(
                    "hover:bg-blue-50/20 transition-colors group",
                    isDelayed && 'bg-rose-50 hover:bg-rose-100/50'
                  )}>
                    {visibleColumns.workOrderId && <td className="px-4 py-4"><span className="text-xs font-black text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">{p.workOrderId || '--'}</span></td>}
                    {visibleColumns.partNo && <td className="px-4 py-4"><span className="text-xs font-bold text-slate-500 font-mono">{p.partNo || '--'}</span></td>}
                    {visibleColumns.tester && <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-xs text-blue-500 font-black">{p.tester?.charAt(0)}</div><span className="text-xs font-bold text-slate-700">{p.tester || '未指派'}</span></div></td>}
                    {visibleColumns.productName && <td className="px-4 py-4"><p className="text-xs font-black text-slate-800 line-clamp-1 max-w-[200px]" title={p.productName}>{p.productName}</p></td>}
                    {visibleColumns.testItems && (
                      <td className="px-4 py-4">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              disabled={formatTestDetails(p.testDetails, p.workOrderId) === '無'}
                              className="text-left w-full disabled:cursor-not-allowed"
                            >
                              <p className="text-xs font-bold text-slate-500 line-clamp-1 max-w-[200px]" title={formatTestDetails(p.testDetails, p.workOrderId)}>
                                {formatTestDetails(p.testDetails, p.workOrderId)}
                              </p>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <div className="grid gap-4">
                              <div className="space-y-2">
                                <h4 className="font-medium leading-none">測試項目詳情</h4>
                                <p className="text-sm text-muted-foreground">
                                  工單: {p.workOrderId}
                                </p>
                              </div>
                              <div className="grid gap-2 text-sm">
                                {p.workOrderId?.startsWith('C') ? (
                                  <div className="grid grid-cols-3 items-center gap-2">
                                    <span className="text-muted-foreground">測試項目</span>
                                    <span className="col-span-2 font-semibold text-blue-600">尺寸量測</span>
                                  </div>
                                ) : (
                                  Object.entries(p.testDetails).map(([key, value]) =>
                                    value && value !== '無' ? (
                                      <div key={key} className="grid grid-cols-3 items-center gap-2">
                                        <span className="text-muted-foreground">{testDetailLabels[key] || key}</span>
                                        <span className="col-span-2 font-semibold">{value}</span>
                                      </div>
                                    ) : null
                                  )
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    )}
                    {visibleColumns.notes && (
                      <td className="px-4 py-4">
                        {editingNoteId === p.id ? (
                          <Textarea
                            defaultValue={noteForProject?.note || ''}
                            autoFocus
                            onBlur={(e) => {
                              handleNoteSave(e.target.value, p);
                              setEditingNoteId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleNoteSave(e.currentTarget.value, p);
                                setEditingNoteId(null);
                              } else if (e.key === 'Escape') {
                                setEditingNoteId(null);
                              }
                            }}
                            className="w-full bg-white border-blue-500 ring-2 ring-blue-200 outline-none text-xs font-medium text-slate-700 transition-all max-w-[250px] min-h-[60px]"
                            placeholder="輸入備註..."
                            disabled={readOnly || !p.workOrderId}
                          />
                        ) : (
                          <div
                            onClick={() => {
                              if (!readOnly && p.workOrderId) {
                                setEditingNoteId(p.id);
                              }
                            }}
                            className={cn(
                              "w-full text-xs font-medium text-slate-500 transition-all max-w-[200px] min-h-[60px] p-2 rounded-md",
                              !readOnly && p.workOrderId && "cursor-pointer hover:bg-slate-100",
                              !noteForProject?.note && "italic text-slate-400"
                            )}
                            title={readOnly || !p.workOrderId ? '' : '點擊以編輯備註'}
                          >
                             {noteForProject?.note ? 
                                <p className="whitespace-pre-wrap break-words leading-tight">{noteForProject.note}</p> :
                                (readOnly ? '--' : '新增備註...')
                              }
                          </div>
                        )}
                      </td>
                    )}
                    {visibleColumns.status && <td className="px-4 py-4"><span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 w-fit ${STATUS_SOLID_COLORS[p.status] || STATUS_SOLID_COLORS.default}`}>{p.status}</span></td>}
                    {visibleColumns.priority && <td className="px-4 py-4 text-center"><span className={`text-xs font-black uppercase tracking-tighter ${p.priority.includes('急') ? 'text-rose-600' : 'text-slate-400'}`}>{p.priority}</span></td>}
                    {visibleColumns.estimatedDate && <td className="px-4 py-4"><span className={cn("text-xs font-bold font-mono", isDelayed ? 'text-rose-600' : 'text-slate-500')}>{p.estimatedDate}</span></td>}
                    {visibleColumns.department && <td className="px-4 py-4"><span className="text-xs font-medium text-slate-400 italic">{p.department}</span></td>}
                    {visibleColumns.creator && <td className="px-4 py-4 text-xs font-bold text-slate-500">{p.creator}</td>}
                    {visibleColumns.id && <td className="px-4 py-4"><span className="text-xs font-mono text-slate-400">{p.id}</span></td>}
                    {visibleColumns.requiredDate && <td className="px-4 py-4"><span className="text-xs font-bold text-slate-500 font-mono">{p.requiredDate}</span></td>}
                    {visibleColumns.startDate && <td className="px-4 py-4"><span className="text-xs font-bold text-slate-500 font-mono">{p.startDate}</span></td>}
                    {visibleColumns.endDate && <td className="px-4 py-4"><span className="text-xs font-bold text-slate-500 font-mono">{p.endDate}</span></td>}
                    {user.role === UserRole.MANAGER && !readOnly && (
                      <td className="px-8 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openModal(p)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={15} /></button>
                              <button onClick={() => onDelete(p.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={15} /></button>
                          </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {effectiveItemsPerPage !== undefined && filteredAndSortedProjects.length > effectiveItemsPerPage && (
          <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400">
              顯示第 <span className="text-slate-800">{(currentPage - 1) * effectiveItemsPerPage + 1}</span> 至 <span className="text-slate-800">{Math.min(currentPage * effectiveItemsPerPage, filteredAndSortedProjects.length)}</span> 筆資料 (共 <span className="text-slate-800">{filteredAndSortedProjects.length}</span> 筆)
            </p>
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-xl h-9 px-3 border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40"
              >
                上一頁
              </Button>
              
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5) {
                    if (currentPage > 3) {
                      pageNum = currentPage - 3 + i + 1;
                      if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                    }
                  }
                  if (pageNum > totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-9 h-9 p-0 rounded-xl border-slate-200 transition-all font-black text-xs",
                        currentPage === pageNum ? "bg-blue-600 text-white shadow-lg shadow-blue-100 border-transparent scale-110" : "text-slate-600 hover:bg-white hover:text-blue-600 hover:border-blue-200"
                      )}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-xl h-9 px-3 border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40"
              >
                下一頁
              </Button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden border border-slate-100 shadow-2xl animate-in zoom-in duration-300">
             <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-blue-600" />
                  {editingProject ? '編輯專案資料' : '新增實驗案件'}
                </h4>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X size={20} /></button>
             </div>
             <form onSubmit={handleSave} className="p-8 space-y-4 max-h-[80vh] overflow-y-auto">
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">專案ID</label>
                        <input type="text" value={form.id || ''} onChange={e => setForm({...form, id: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" disabled={!!editingProject}/>
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">工單編號</label>
                        <input type="text" value={form.workOrderId || ''} onChange={e => setForm({...form, workOrderId: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                       <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">優先級</label>
                        <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none cursor-pointer">
                           <option value="一般件">一般件</option>
                           <option value="急件">急件</option>
                           <option value="特急件">特急件</option>
                        </select>
                      </div>
                    </div>
                    <div>
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">產品品名</label>
                       <input type="text" value={form.productName || ''} onChange={e => setForm({...form, productName: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">機台編號 / 料號</label>
                        <input type="text" value={form.partNo || ''} onChange={e => setForm({...form, partNo: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：S200-05外-01"/>
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">送樣部門</label>
                        <input type="text" value={form.department || ''} onChange={e => setForm({...form, department: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" placeholder="例如：研發一組" />
                      </div>
                       <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">建立者</label>
                        <input type="text" value={form.creator || ''} onChange={e => setForm({...form, creator: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" />
                      </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">負責人員</label>
                        <select value={form.tester} onChange={e => setForm({...form, tester: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none cursor-pointer">
                           <option value="未指派">未指派</option>
                           {allTesters.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">案件狀況</label>
                        <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none cursor-pointer">
                           {allStatuses.map((s, i) => <option key={`${s}-${i}`} value={s}>{s}</option>)}
                        </select>
                      </div>
                       <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">預計完成日期</label>
                        <input type="date" value={form.estimatedDate?.split(' ')[0] || ''} onChange={e => setForm({...form, estimatedDate: e.target.value})} className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" />
                      </div>
                    </div>
                     <div className="p-4 border rounded-2xl space-y-2">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">測試項目</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input type="text" placeholder="尺寸測量" value={form.testDetails?.dimensions || ''} onChange={e => setForm({...form, testDetails: {...form.testDetails!, dimensions: e.target.value}})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                            <input type="text" placeholder="力量測試" value={form.testDetails?.force || ''} onChange={e => setForm({...form, testDetails: {...form.testDetails!, force: e.target.value}})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                            <input type="text" placeholder="電性測試" value={form.testDetails?.electrical || ''} onChange={e => setForm({...form, testDetails: {...form.testDetails!, electrical: e.target.value}})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                            <input type="text" placeholder="材料測試" value={form.testDetails?.material || ''} onChange={e => setForm({...form, testDetails: {...form.testDetails!, material: e.target.value}})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                            <input type="text" placeholder="環境測試" value={form.testDetails?.environment || ''} onChange={e => setForm({...form, testDetails: {...form.testDetails!, environment: e.target.value}})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                            <input type="text" placeholder="其他項目" value={form.testDetails?.other || ''} onChange={e => setForm({...form, testDetails: {...form.testDetails!, other: e.target.value}})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                        </div>
                     </div>
                </>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 mt-4 active:scale-95">
                  {editingProject ? '確認更新數據' : '確認建立實驗'}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;

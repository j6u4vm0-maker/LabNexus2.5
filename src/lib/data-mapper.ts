'use client';
import type { Case, MaintenanceRecord } from './types';
import type { ProjectData, MachineSchedule } from './schedule-types';

function safeDateString(dateStr: string | undefined | null): string | undefined {
    if (!dateStr) return undefined;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return undefined;
        return date.toLocaleDateString('en-CA').replace(/-/g, '/');
    } catch {
        return undefined;
    }
}

function mapCaseStatus(status: string): string {
    const mapping: Record<string, string> = {
        '進行中': '實驗中',
        '審核中': '實驗中',
        '已核准': '實驗中',
        '實驗中': '實驗中',
        '檢測中': '實驗中',
        '確認中': '實驗中',
        '計畫中': '實驗中',

        '已完成': '已完成',
        '已結案': '已完成',
        '待處置': '已完成',
        '已指派': '已完成',

        '已取消': '已取消',
    };
    return mapping[status] || status;
}

export function mapCaseToProjectData(c: Case): ProjectData {
  let priority: string;
  switch(c.priority) {
      case 'CRITICAL': priority = '特急件'; break;
      case 'HIGH': priority = '急件'; break;
      case 'MEDIUM': priority = '一般件'; break;
      case 'LOW': priority = '一般件'; break;
      default: priority = '一般件'; break;
  }

  const defaultTestDetails = { dimensions: '', force: '', electrical: '', material: '', environment: '', other: '' };

  return {
    id: c.id,
    bookingId: c.id,
    name: c.name || '',
    workOrderId: c.workOrderId || '',
    productName: c.productName,
    tester: c.labManager || '未指派',
    status: mapCaseStatus(c.status),
    estimatedDate: safeDateString(c.estimatedCompletionDate) || new Date().toLocaleDateString('en-CA').replace(/-/g, '/'),
    priority: priority,
    creator: c.creator || '',
    testDetails: { ...defaultTestDetails, ...c.testDetails },
    department: c.department || '',
    requiredDate: c.requiredDate || '',
    receptionDate: c.receptionDate || '',
    testItemsCount: c.testItemsCount || 0,
    startDate: c.startDate || '',
    endDate: safeDateString(c.actualCompletionDate),
    completedItemsCount: c.completedItemsCount || 0,
    projectId: c.projectId || '',
    submissionOrder: c.submissionOrder || 0,
    result: '',
    passCount: c.passCount || 0,
    failCount: c.failCount || 0,
    naCount: c.naCount || 0,
    auditTime: safeDateString(c.auditTime),
    cost: c.cost || '',
    rejectionCount: c.rejectionCount || 0,
    type: 'E01'
  };
}

export function mapMaintenanceRecordToProjectData(mr: MaintenanceRecord): ProjectData {
  return {
    id: mr.id,
    bookingId: mr.id,
    productName: mr.equipmentName,
    partNo: mr.equipmentId,
    estimatedDate: safeDateString(mr.estimatedCompletionDate) || new Date().toLocaleDateString('en-CA').replace(/-/g, '/'),
    tester: mr.engineerName,
    status: mr.status,
    // Default values for ProjectData fields not present in MaintenanceRecord
    name: mr.equipmentName,
    priority: '一般件',
    testDetails: { dimensions: '', force: '', electrical: '', material: '', environment: '', other: '' },
  };
}


export function mapCaseToScheduleProjectData(c: Case): ProjectData {
    const defaultTestDetails = { dimensions: '', force: '', electrical: '', material: '', environment: '', other: '' };

    return {
        id: c.id,
        bookingId: c.id,
        name: c.name,
        productName: c.productName,
        tester: c.labManager || '未指派',
        status: mapCaseStatus(c.status),
        estimatedDate: safeDateString(c.estimatedCompletionDate) || new Date().toLocaleDateString('en-CA').replace(/-/g, '/'),
        priority: c.priority,
        workOrderId: c.workOrderId,
        testDetails: { ...defaultTestDetails, ...c.testDetails },
        rejectionCount: c.rejectionCount,
        auditTime: safeDateString(c.auditTime),
        cost: c.cost,
        department: c.department,
        creator: c.creator,
        requiredDate: c.requiredDate,
        receptionDate: c.receptionDate,
        testItemsCount: c.testItemsCount,
        startDate: c.startDate,
        completedItemsCount: c.completedItemsCount,
        projectId: c.projectId,
        submissionOrder: c.submissionOrder,
        passCount: c.passCount,
        failCount: c.failCount,
        naCount: c.naCount,
    }
};

export function mapMachineScheduleToProjectData(schedule: MachineSchedule): ProjectData {
    return {
      id: schedule.id,
      bookingId: schedule.bookingId || schedule.id,
      name: `[機台預約] ${schedule.equipmentName}`,
      productName: schedule.productName || '未指定品名',
      workOrderId: schedule.workOrder,
      tester: schedule.tester,
      status: '機台預約', // A unique status to identify this event type
      estimatedDate: schedule.date.replace(/-/g, '/'),
      priority: '一般件',
      testDetails: {}, // No specific test details for a machine booking in this context
      partNo: schedule.equipmentId, // Use partNo to store machine ID
      creator: schedule.client,
    };
  }

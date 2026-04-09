export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Case = {
  id: string;
  name?: string; // 名稱
  status: string; // 狀態
  department?: string; // 送樣單位
  creator?: string; // 建立者
  workOrderId?: string; // 工服單號
  productName: string; // 品名
  requiredDate?: string; // 需要日期
  receptionDate?: string; // 收件日期
  estimatedCompletionDate: string; // 預計測試完成日期
  labManager: string; // 檢測者 (Name of the engineer)
  testItemsCount?: number; // 應測項目數
  startDate?: string; // 開始日期
  actualCompletionDate?: string; // 完成日期
  completedItemsCount?: number; // 完成項目數
  projectId?: string; // 專案編號
  submissionOrder?: number; // 送件順序
  testDetails?: {
    dimensions?: string;
    force?: string;
    electrical?: string;
    material?: string;
    environment?: string;
    other?: string;
  };
  passCount?: number; // 合格
  failCount?: number; // 不合格
  naCount?: number; // 不判定
  auditTime?: string; // 完成審核時間
  cost?: string; // 費用

  // Fields from old schema to retain
  partNo?: string;
  customer?: string;
  pm?: string;
  poNo?: string;
  closingDate?: string;
  remarks?: string;
  
  priority: CasePriority;
  priorityReason?: string;
  createdAt: string;
  rejectionCount?: number;
};

export type MaintenanceRecord = {
  id: string;
  equipmentName: string;
  equipmentId: string;
  estimatedCompletionDate: string; // yyyy-MM-dd
  engineerName: string;
  status: '設備保養' | '設備保養完成';
};

export type Equipment = {
  id: string;
  name: string;
  type: string;
  remark: string;
  logo: string;
  status: '正常' | '維修' | '校正';
  calibrationDate: string;
  isMultiChannel?: boolean;
};

export type EngineerRole = '測試者' | '實驗室主管';

export type Engineer = {
  id: string;
  name: string;
  role?: EngineerRole;
};

export enum UserRole {
  MANAGER = 'manager',
  ENGINEER = 'engineer',
}

export type UserInfo = {
  id: string;
  name: string;
  role: UserRole;
  canEditSchedule?: boolean;
};

export type RoutineWork = {
  id: string;
  yearMonth: string; // YYYY-MM
  taskCategory: string;
  engineerName: string;
  engineerId?: string;
};

export type RoutineWorkTask = {
  id: string;
  name: string;
  order: number;
};

export type ProjectNote = {
  id: string;
  workOrderId: string;
  note: string;
  author: string;
  createdAt: string; // ISO string date
};

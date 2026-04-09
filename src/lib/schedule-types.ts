export type TestDetails = {
    dimensions?: string;
    force?: string;
    electrical?: string;
    material?: string;
    environment?: string;
    other?: string;
  };

export type ProjectData = {
    id: string;
    bookingId?: string;
    name?: string; // 名稱
    status: string; // 狀態
    department?: string; // 送樣單位
    creator?: string; // 建立者
    workOrderId?: string; // 工服單號
    productName: string; // 品名
    requiredDate?: string; // 需要日期
    receptionDate?: string; // 收件日期
    estimatedDate: string; // 預計測試完成日期 yyyy/MM/dd
    tester: string; // 檢測者
    testItemsCount?: number; // 應測項目數
    startDate?: string; // 開始日期
    endDate?: string; // 完成日期 yyyy/MM/dd
    completedItemsCount?: number; // 完成項目數
    projectId?: string; // 專案編號
    submissionOrder?: number; // 送件順序
    testDetails: TestDetails;
    passCount?: number; // 合格
    failCount?: number; // 不合格
    naCount?: number; // 不判定
    auditTime?: string; // 完成審核時間
    cost?: string; // 費用
    rejectionCount?: number;
    partNo?: string;
    
    result?: string;
    type?: string;
    priority: string;
    notes?: string; // 加入備註欄位
};

export type MachineSchedule = {
  id: string;
  bookingId?: string;
  date: string; // "yyyy-MM-dd"
  equipmentId: string;
  equipmentName: string;
  workOrder: string;
  productName: string;
  tester: string;
  client: string;
  notes?: string;
  updatedAt?: string; // ISO string date
};

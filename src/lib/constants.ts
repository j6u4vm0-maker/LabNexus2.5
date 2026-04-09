export const STATUS_COLORS: Record<string, string> = {
  // New simplified statuses
  '實驗中': 'bg-status-experimental text-status-experimental-foreground',
  '已完成': 'bg-status-completed text-status-completed-foreground',
  '已取消': 'bg-status-cancelled text-status-cancelled-foreground',
  '延遲中': 'bg-status-delayed text-status-delayed-foreground', // Added

  // Other statuses
  '機台預約': 'bg-status-reserved text-status-reserved-foreground',
  '機台開始': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '佔用中': 'bg-slate-100 text-slate-500 border-slate-200',
  '機台結束': 'bg-rose-100 text-rose-700 border-rose-200',
  '設備保養': 'bg-status-maintenance text-status-maintenance-foreground',
  '設備保養完成': 'bg-gray-100 text-gray-700',

  'default': 'bg-gray-100 text-gray-700',
};

export const STATUS_SOLID_COLORS: Record<string, string> = {
  // New simplified statuses
  '實驗中': 'bg-status-experimental text-status-experimental-foreground',
  '已完成': 'bg-status-completed text-status-completed-foreground',
  '已取消': 'bg-status-cancelled text-status-cancelled-foreground',
  '延遲中': 'bg-status-delayed text-status-delayed-foreground', // Added

  // Other statuses
  '機台預約': 'bg-status-reserved text-status-reserved-foreground',
  '機台開始': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '佔用中': 'bg-slate-100 text-slate-500 border-slate-200',
  '機台結束': 'bg-rose-100 text-rose-700 border-rose-200',
  '設備保養': 'bg-status-maintenance text-status-maintenance-foreground',
  '設備保養完成': 'bg-gray-500 text-white',
  'default': 'bg-gray-500 text-white',
};

export const STATUS_HEX_COLORS: Record<string, string> = {
  '實驗中': '#4A90E2',
  '已完成': '#27AE60',
  '已取消': '#607D8B',
  '延遲中': '#f45151',
  '機台預約': '#16A085',
  '機台開始': '#10B981',
  '佔用中': '#64748B',
  '機台結束': '#F43F5E',
  '設備保養': '#E74C3C',
};

export const STATUS_CSS_VARS: Record<string, string> = {
  '實驗中': '--status-experimental',
  '已完成': '--status-completed',
  '已取消': '--status-cancelled',
  '延遲中': '--status-delayed', // Added
  '機台預約': '--status-reserved',
  '機台開始': '--status-machine-start',
  '佔用中': '--status-occupied',
  '機台結束': '--status-machine-end',
  '設備保養': '--status-maintenance',
};

    
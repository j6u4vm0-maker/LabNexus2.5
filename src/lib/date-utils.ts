'use client';

import { isWeekend, eachDayOfInterval, addDays, isValid, parse } from 'date-fns';

// 2026 Holidays in Taiwan (example)
const TAIWAN_HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "元旦",
  "2026-02-16": "農曆除夕",
  "2026-02-17": "農曆春節",
  "2026-02-18": "農曆春節",
  "2026-02-19": "農曆春節",
  "2026-02-20": "農曆春節補假",
  "2026-02-27": "和平紀念日補假",
  "2026-02-28": "和平紀念日",
  "2026-04-03": "兒童節補假",
  "2026-04-04": "兒童節",
  "2026-06-19": "端午節",
  "2026-09-25": "中秋節",
  "2026-10-09": "國慶日補假",
  "2026-10-10": "國慶日",
};

function isHoliday(date: Date): boolean {
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return TAIWAN_HOLIDAYS_2026.hasOwnProperty(dateString);
}

export function isWorkingDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}


/**
 * Calculates the number of working days between two dates.
 * If d1 > d2, the result will be negative.
 * The calculation is inclusive of the start and end dates.
 * @param d1 The first date.
 * @param d2 The second date.
 * @returns The number of working days.
 */
export function getWorkingDays(d1: Date, d2: Date): number {
    const isNegative = d1 > d2;
    const start = isNegative ? d2 : d1;
    const end = isNegative ? d1 : d2;
    
    // Ensure start and end are valid dates before proceeding
    if (!isValid(start) || !isValid(end)) {
        return 0;
    }

    let count = 0;
    
    try {
        const interval = { start, end };
        const days = eachDayOfInterval(interval);
        
        for (const day of days) {
            if (isWorkingDay(day)) {
                count++;
            }
        }
    } catch (e) {
        // This might happen if dates are invalid, though we check above.
        return 0;
    }

    return isNegative ? -(count) : count;
}


export const safeParseDate = (dateInput: string | Date | number | undefined | null): Date | null => {
    if (!dateInput) return null;

    // If it's already a Date object, check if it's valid and return.
    if (dateInput instanceof Date) {
        return isValid(dateInput) ? dateInput : null;
    }
    
    // It's a string or a number
    const dateStr = String(dateInput);

    if (dateStr.trim() === '') return null;
    
    // Try parsing 'yyyy/MM/dd' first
    let d = parse(dateStr, 'yyyy/MM/dd', new Date());
    if (isValid(d)) return d;

    // Fallback to direct new Date() for ISO strings, 'yyyy-MM-dd', etc.
    d = new Date(dateStr);
    if (isValid(d)) return d;
    
    return null;
};

/**
 * Checks if a project is delayed based on its estimated and actual completion dates.
 * A project is considered delayed if:
 * 1. It is not yet completed (`endDate` is missing) AND the current date is past the `estimatedDate`.
 * 2. It is completed (`endDate` exists) but the `endDate` is later than the `estimatedDate`.
 * @param project An object with `estimatedDate` and `endDate`.
 * @param referenceDate The date to compare against (e.g., today).
 * @returns True if the project is delayed, false otherwise.
 */
export function isProjectDelayed(project: { estimatedDate?: string | null; endDate?: string | null; status?: string }, referenceDate: Date): boolean {
  if (project.status === '已取消') return false;

  const estimated = safeParseDate(project.estimatedDate);
  const end = safeParseDate(project.endDate);

  // Cannot determine delay without an estimated date.
  if (!estimated) {
    return false;
  }
  
  estimated.setHours(0, 0, 0, 0);

  // Case 1: Project is completed. Do not show as currently delayed.
  if (end) {
    return false;
  }
  
  // Case 2: Project is not yet completed. Check if it's past its due date.
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  
  return today > estimated;
}

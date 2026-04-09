'use client';

import { useEffect, useRef } from 'react';

/**
 * PLMSyncConsoleReporter
 * Monitors the /plm-sync-report.json file and logs results to the console.
 */
export function PLMSyncConsoleReporter() {
  const lastTimestamp = useRef<string | null>(null);

  useEffect(() => {
    const checkReport = async () => {
      try {
        // Use a cache-busting query param to ensure we get the latest file
        const res = await fetch(`/plm-sync-report.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;

        const report = await res.json();
        
        if (report.timestamp !== lastTimestamp.current) {
          lastTimestamp.current = report.timestamp;
          
          console.group('%c🔄 PLM Sync Report', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
          console.log(`%cTime: ${new Date(report.timestamp).toLocaleString()}`, 'color: #64748b;');
          console.log(`%cTotal Rows: ${report.totalRows}`, 'color: #334155; font-weight: bold;');
          console.log(`%cAdded/Updated: ${report.updated}`, 'color: #10b981;');
          console.log(`%cSkipped: ${report.skipped}`, 'color: #f59e0b;');
          
          if (report.errors && report.errors.length > 0) {
            console.error('Errors:', report.errors);
          }
          
          console.groupEnd();
        }
      } catch (err) {
        // Silently fail if file doesn't exist yet
      }
    };

    // Initial check
    checkReport();

    // Poll every 10 seconds
    const interval = setInterval(checkReport, 10000);
    return () => clearInterval(interval);
  }, []);

  return null; // This is a logic-only component
}

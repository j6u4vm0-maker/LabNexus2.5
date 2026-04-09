'use client';

import { useEffect } from 'react';
import { STATUS_CSS_VARS } from '@/lib/constants';
import { hexToHsl, getTextColor } from '@/lib/color-utils';

function applyCustomColors() {
    try {
        const saved = localStorage.getItem('labnexus_status_colors');
        const customColors = saved ? JSON.parse(saved) : {};
        const root = document.documentElement;

        Object.keys(STATUS_CSS_VARS).forEach(statusName => {
            const cssVarName = STATUS_CSS_VARS[statusName as keyof typeof STATUS_CSS_VARS];
            const cssVarNameFg = `${cssVarName}-foreground`;
            const customColor = customColors[statusName];

            if (customColor) {
                root.style.setProperty(cssVarName, hexToHsl(customColor));
                const textColor = getTextColor(customColor);
                root.style.setProperty(cssVarNameFg, hexToHsl(textColor));
            } else {
                root.style.removeProperty(cssVarName);
                root.style.removeProperty(cssVarNameFg);
            }
        });
    } catch (e) {
        console.error("Failed to load or apply custom status colors.", e);
    }
}

export function ColorThemeManager() {
  useEffect(() => {
    applyCustomColors();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'labnexus_status_colors') {
        applyCustomColors();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return null;
}

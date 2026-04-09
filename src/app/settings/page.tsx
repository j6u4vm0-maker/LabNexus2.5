'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Undo } from 'lucide-react';
import { STATUS_HEX_COLORS, STATUS_CSS_VARS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { hexToHsl, getTextColor } from '@/lib/color-utils';

export default function SettingsPage() {
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadColors = () => {
        try {
            const saved = localStorage.getItem('labnexus_status_colors');
            if (saved) {
                setCustomColors(JSON.parse(saved));
            } else {
                setCustomColors({});
            }
        } catch (e) {
            console.error("Failed to load custom colors from localStorage", e);
        }
    };
    
    loadColors();

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'labnexus_status_colors') {
            loadColors();
        }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(customColors).forEach(([statusName, hexColor]) => {
      const cssVarName = STATUS_CSS_VARS[statusName as keyof typeof STATUS_CSS_VARS];
      const cssVarNameFg = `${cssVarName}-foreground`;
      if (cssVarName && hexColor) {
        root.style.setProperty(cssVarName, hexToHsl(hexColor));
        
        const textColor = getTextColor(hexColor);
        const textColorHsl = hexToHsl(textColor);
        root.style.setProperty(cssVarNameFg, textColorHsl);
      }
    });
  }, [customColors]);

  const handleColorChange = (statusName: string, hexColor: string) => {
    const newColors = { ...customColors, [statusName]: hexColor };
    setCustomColors(newColors);
    try {
        localStorage.setItem('labnexus_status_colors', JSON.stringify(newColors));
    } catch (e) {
        console.error("Failed to save custom colors to localStorage", e);
    }
  };
  
  const handleResetDefaults = () => {
    localStorage.removeItem('labnexus_status_colors');
    setCustomColors({});
    
    const root = document.documentElement;
    Object.values(STATUS_CSS_VARS).forEach(varName => {
        root.style.removeProperty(varName);
        root.style.removeProperty(`${varName}-foreground`);
    });
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
        <div className="flex items-center justify-between space-y-2 mb-6">
            <h1 className="text-3xl font-bold tracking-tight">系統設定</h1>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-2xl mx-auto">
            <div className="flex items-center justify-between pb-4 border-b">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">狀態顏色設定</h2>
                    <p className="text-sm text-slate-500">點擊色塊來自訂各狀態的代表顏色。您的設定將會儲存在此瀏覽器中。</p>
                </div>
                 <Button variant="outline" onClick={handleResetDefaults} size="sm" className="flex items-center gap-2">
                    <Undo size={14} />
                    還原預設顏色
                </Button>
            </div>
          
            <div className="space-y-4 py-6 max-h-[60vh] overflow-y-auto pr-3 custom-scrollbar">
                {Object.entries(STATUS_CSS_VARS).map(([statusName, _]) => {
                const defaultColor = STATUS_HEX_COLORS[statusName as keyof typeof STATUS_HEX_COLORS] || '#ffffff';
                const currentColor = customColors[statusName] || defaultColor;

                return (
                    <div key={statusName} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                    <span className="font-medium text-sm text-foreground">{statusName}</span>
                    <div className="flex items-center gap-3">
                        <label
                        htmlFor={`color-picker-${statusName}`}
                        className="w-8 h-8 rounded-md border cursor-pointer shadow-inner"
                        style={{ backgroundColor: currentColor }}
                        />
                        <input
                        id={`color-picker-${statusName}`}
                        type="color"
                        value={currentColor}
                        onChange={(e) => handleColorChange(statusName, e.target.value)}
                        className="opacity-0 w-0 h-0 absolute"
                        />
                        <span className="text-sm font-mono text-muted-foreground w-20">{currentColor.toUpperCase()}</span>
                    </div>
                    </div>
                );
                })}
            </div>
        </div>
    </div>
  );
}

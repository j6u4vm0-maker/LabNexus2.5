'use client';

import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { STATUS_HEX_COLORS, STATUS_CSS_VARS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { hexToHsl, getTextColor } from '@/lib/color-utils';

export function ColorSettings() {
  const [isOpen, setIsOpen] = useState(false);
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

    if (isOpen) {
        loadColors();
    }

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'labnexus_status_colors') {
            loadColors();
        }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };

  }, [isOpen]);

  useEffect(() => {
    if(!isOpen) return;
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
  }, [customColors, isOpen]);

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
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
        <Settings size={16} />
        <span className="sr-only">顏色設定</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>狀態顏色設定</DialogTitle>
            <DialogDescription>
              點擊色塊來自訂各狀態的代表顏色。您的設定將會儲存在此瀏覽器中。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-3 custom-scrollbar">
            {Object.entries(STATUS_CSS_VARS).map(([statusName, _]) => {
              const defaultColor = STATUS_HEX_COLORS[statusName as keyof typeof STATUS_HEX_COLORS] || '#ffffff';
              const currentColor = customColors[statusName] || defaultColor;

              return (
                <div key={statusName} className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">{statusName}</span>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={`color-picker-dialog-${statusName}`}
                      className="w-8 h-8 rounded-md border cursor-pointer shadow-inner"
                      style={{ backgroundColor: currentColor }}
                    />
                    <input
                      id={`color-picker-dialog-${statusName}`}
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
           <div className="pt-4 border-t">
                <Button variant="outline" onClick={handleResetDefaults}>
                    還原預設顏色
                </Button>
           </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

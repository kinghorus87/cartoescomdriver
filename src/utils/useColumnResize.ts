import { useState, useCallback, useRef } from 'react';

export function useColumnResize(tableKey: string) {
  const storageKey = `col_widths_${tableKey}`;

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  const latestWidthsRef = useRef<Record<string, number>>(colWidths);
  latestWidthsRef.current = colWidths;

  const resizingRef = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
    minWidth: number;
  } | null>(null);

  const startResize = useCallback(
    (colKey: string, e: React.MouseEvent, customMinWidth?: number) => {
      e.preventDefault();
      e.stopPropagation();

      const minWidth = customMinWidth || 60;
      const thElement = (e.currentTarget as HTMLElement).closest('th');
      const startWidth = thElement
        ? Math.round(thElement.getBoundingClientRect().width)
        : (latestWidthsRef.current[colKey] || 120);

      resizingRef.current = {
        colKey,
        startX: e.clientX,
        startWidth,
        minWidth,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const current = resizingRef.current;
        if (!current) return;
        const diff = moveEvent.clientX - current.startX;
        const minW = current.minWidth || 60;
        const newWidth = Math.max(minW, Math.round(current.startWidth + diff));
        const activeColKey = current.colKey;

        setColWidths((prev) => {
          const next = { ...prev, [activeColKey]: newWidth };
          latestWidthsRef.current = next;
          return next;
        });
      };

      const handleMouseUp = () => {
        const current = resizingRef.current;
        if (current) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(latestWidthsRef.current));
          } catch {
            // ignore storage quota issues
          }
        }
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [storageKey]
  );

  const resetWidths = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setColWidths({});
    latestWidthsRef.current = {};
  }, [storageKey]);

  const hasCustomWidths = Object.keys(colWidths).length > 0;

  return {
    colWidths,
    startResize,
    handleMouseDown: startResize,
    resetWidths,
    hasCustomWidths,
    isCustomized: hasCustomWidths,
  };
}

import React, { useEffect, useState, useRef } from 'react';
import katex from 'katex';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  rawText: string;
  cleanTex: string;
  renderedHtml?: string;
  error?: string;
  isValid: boolean;
}

/**
 * Heuristic to detect if selected text is LaTeX / math formula.
 */
function checkLatex(raw: string): { isLatex: boolean; cleanTex: string; displayMode: boolean } {
  const text = raw.trim();
  if (!text || text.length < 2 || text.length > 1500) {
    return { isLatex: false, cleanTex: '', displayMode: false };
  }

  // 1. Explicit display math $$...$$
  if (text.startsWith('$$') && text.endsWith('$$') && text.length >= 4) {
    return { isLatex: true, cleanTex: text.slice(2, -2).trim(), displayMode: true };
  }

  // 2. Explicit display math \[...\]
  if (text.startsWith('\\[') && text.endsWith('\\]') && text.length >= 4) {
    return { isLatex: true, cleanTex: text.slice(2, -2).trim(), displayMode: true };
  }

  // 3. Inline math $...$
  if (text.startsWith('$') && text.endsWith('$') && text.length >= 3) {
    return { isLatex: true, cleanTex: text.slice(1, -1).trim(), displayMode: false };
  }

  // 4. Inline math \(...\)
  if (text.startsWith('\\(') && text.endsWith('\\)') && text.length >= 4) {
    return { isLatex: true, cleanTex: text.slice(2, -2).trim(), displayMode: false };
  }

  // 5. Contains LaTeX commands like \frac, \sqrt, \alpha, \sum, \int, \vec, \pm, etc.
  if (/\\[a-zA-Z]+/.test(text)) {
    return {
      isLatex: true,
      cleanTex: text,
      displayMode: text.includes('\\begin') || text.includes('\\int') || text.length > 60
    };
  }

  // 6. Contains math powers/indices/subscripts with formulas (e.g., x^2, y_1, (a+b)^2)
  if (/[a-zA-Z0-9]_\{?[a-zA-Z0-9+\-_]+\}?|[a-zA-Z0-9]\^\{?[a-zA-Z0-9+\-*\s\\]+\}?/.test(text) && /[=+\-*/^_{}\\]/.test(text)) {
    return { isLatex: true, cleanTex: text, displayMode: false };
  }

  return { isLatex: false, cleanTex: '', displayMode: false };
}

export const LatexSelectionTooltip: React.FC = () => {
  const [state, setState] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    rawText: '',
    cleanTex: '',
    isValid: false
  });

  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Track mouse coordinates continuously so we know where the cursor was when selection happened
    const handleMouseMove = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    // Close when user presses Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setState(prev => (prev.visible ? { ...prev, visible: false } : prev));
      }
    };

    const inspectSelection = (clientPos?: { x: number; y: number }) => {
      let selectedText = '';
      let targetX = clientPos ? clientPos.x : lastMousePos.current.x;
      let targetY = clientPos ? clientPos.y : lastMousePos.current.y;

      const active = document.activeElement;

      // Check if user is typing/selecting inside a textarea or input
      if (active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && active.type === 'text')) {
        const start = active.selectionStart;
        const end = active.selectionEnd;
        if (start !== null && end !== null && end > start) {
          selectedText = active.value.substring(start, end);
          if (targetX === 0 && targetY === 0) {
            const rect = active.getBoundingClientRect();
            targetX = rect.left + 50;
            targetY = rect.top + 30;
          }
        }
      } else {
        // Standard DOM selection
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          selectedText = sel.toString();
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect && rect.width > 0) {
            targetX = rect.left + rect.width / 2;
            targetY = rect.top;
          }
        }
      }

      const trimmed = selectedText.trim();
      if (!trimmed) {
        setState(prev => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const check = checkLatex(trimmed);
      if (!check.isLatex) {
        setState(prev => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      // Try rendering with KaTeX
      try {
        const html = katex.renderToString(check.cleanTex, {
          displayMode: check.displayMode,
          throwOnError: true,
          trust: true,
          strict: false
        });

        setState({
          visible: true,
          x: targetX,
          y: targetY,
          rawText: trimmed,
          cleanTex: check.cleanTex,
          renderedHtml: html,
          error: undefined,
          isValid: true
        });
      } catch (err: any) {
        const errMsg = err?.message?.replace(/^KaTeX parse error:\s*/i, '') || 'Cú pháp LaTeX chưa chuẩn hoặc chưa đóng ngoặc';
        setState({
          visible: true,
          x: targetX,
          y: targetY,
          rawText: trimmed,
          cleanTex: check.cleanTex,
          renderedHtml: undefined,
          error: errMsg,
          isValid: false
        });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Small timeout to allow browser selection range to finalize
      setTimeout(() => {
        inspectSelection({ x: e.clientX, y: e.clientY });
      }, 10);
    };

    const handleSelectionChange = () => {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && active.type === 'text')) {
        const start = active.selectionStart;
        const end = active.selectionEnd;
        if (start === end) {
          setState(prev => (prev.visible ? { ...prev, visible: false } : prev));
          return;
        }
      } else {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setState(prev => (prev.visible ? { ...prev, visible: false } : prev));
          return;
        }
      }
      inspectSelection();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        setTimeout(() => inspectSelection(), 10);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!state.visible) return null;

  // Compute smart coordinates so tooltip never goes off-screen
  const POPUP_WIDTH = 340;
  const POPUP_HEIGHT = 160;

  let left = state.x - POPUP_WIDTH / 2;
  let top = state.y - POPUP_HEIGHT - 12; // place above selection

  if (top < 12) {
    // If not enough room on top, place below
    top = state.y + 24;
  }

  if (left < 12) {
    left = 12;
  } else if (left + POPUP_WIDTH > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - POPUP_WIDTH - 12);
  }

  return (
    <div
      ref={tooltipRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-[99999] w-[340px] max-w-[92vw] bg-white border-2 border-black shadow-[4px_4px_0px_#000000] p-3 text-neutral-900 pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-100"
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="bg-black text-white text-[11px] font-black px-1.5 py-0.2 font-mono">
            ∑
          </span>
          <span className="font-black text-xs uppercase tracking-wide">
            Kiểm tra LaTeX
          </span>
        </div>
        <div>
          {state.isValid ? (
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 border border-emerald-600">
              ✓ Hợp lệ
            </span>
          ) : (
            <span className="text-[10px] font-black text-red-700 bg-red-100 px-2 py-0.5 border border-red-600">
              ✕ Cú pháp lỗi
            </span>
          )}
        </div>
      </div>

      {/* Rendered Preview Body */}
      <div className="min-h-[52px] max-h-[160px] overflow-x-auto overflow-y-auto flex items-center justify-center p-2.5 bg-neutral-50 border-2 border-black text-neutral-900">
        {state.isValid && state.renderedHtml ? (
          <div
            className="text-base leading-relaxed text-center"
            dangerouslySetInnerHTML={{ __html: state.renderedHtml }}
          />
        ) : (
          <div className="text-xs text-red-600 font-mono leading-tight whitespace-pre-wrap text-left w-full">
            <b className="font-bold block text-red-700 mb-0.5">Lỗi cú pháp:</b>
            {state.error}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-2 pt-1 text-[10px] text-neutral-500 font-medium">
        <span className="font-mono truncate max-w-[210px] bg-neutral-100 px-1 border border-neutral-300" title={state.cleanTex}>
          {state.cleanTex}
        </span>
        <span className="italic text-neutral-400 select-none">
          Bỏ bôi đen để tắt
        </span>
      </div>
    </div>
  );
};

"use client";

import React, { useState, useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { MathInputEngine, MathInputEngineRef } from "./MathInputEngine";
import { Calculator, CornerDownLeft, Trash2, X } from "lucide-react";

export const BAC_MATH_SNIPPETS = [
  { label: "\\frac{a}{b}", snippet: "\\frac{#0}{#?}", title: "كسر" },
  { label: "x^2", snippet: "x^2", title: "مربع" },
  { label: "x^n", snippet: "x^{#?}", title: "أس" },
  { label: "\\sqrt{x}", snippet: "\\sqrt{#0}", title: "جذر تربيعي" },
  { label: "\\le", snippet: "\\le", title: "أصغر أو يساوي" },
  { label: "\\ge", snippet: "\\ge", title: "أكبر أو يساوي" },
  { label: "\\neq", snippet: "\\neq", title: "لا يساوي" },
  { label: "\\Delta", snippet: "\\Delta", title: "المميز دلتا" },
  { label: "\\infty", snippet: "\\infty", title: "مالانهاية" },
  { label: "\\pi", snippet: "\\pi", title: "باي" },
  { label: "\\ln(x)", snippet: "\\ln(#0)", title: "اللوغاريتم النيبيري" },
  { label: "e^{x}", snippet: "e^{#0}", title: "الدالة الأسية" },
  { label: "\\lim\\limits_{x \\to \\infty}", snippet: "\\lim\\limits_{x \\to \\infty}", title: "نهاية" },
  { label: "\\vec{V}", snippet: "\\vec{#0}", title: "شعاع" },
];

function KaTeXBadge({ math }: { math: string }) {
  try {
    const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span>{math}</span>;
  }
}

export interface MathScratchpadProps {
  isOpen: boolean;
  onClose: () => void;
  initialLatex?: string;
  onApply: (latex: string) => void;
  title?: string;
}

export function MathScratchpad({
  isOpen,
  onClose,
  initialLatex = "",
  onApply,
  title = "مسودة ابتكار المعادلة التفاعلية (Math Scratchpad)",
}: MathScratchpadProps) {
  const [scratchpadMath, setScratchpadMath] = useState(initialLatex);
  const mathEngineRef = useRef<MathInputEngineRef>(null);

  useEffect(() => {
    setScratchpadMath(initialLatex || "");
  }, [initialLatex, isOpen]);

  if (!isOpen) return null;

  const handleInsertSnippet = (snippet: string) => {
    if (mathEngineRef.current) {
      mathEngineRef.current.insert(snippet);
    } else {
      setScratchpadMath((prev) => prev + snippet);
    }
  };

  const handleApply = () => {
    if (!scratchpadMath.trim()) return;
    onApply(scratchpadMath.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn dir-rtl">
      {/* Backdrop click listener to close */}
      <div
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-2xl bg-surface border border-outline/20 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scaleUp">
        <div className="flex items-center justify-between pb-3 border-b border-outline/10">
          <span className="text-xs sm:text-sm font-extrabold text-primary flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            <span>{title}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <MathInputEngine
          ref={mathEngineRef}
          value={scratchpadMath}
          onChange={(val) => setScratchpadMath(val)}
          placeholder="تشكيل معادلة بصرية (كسور، جذور، أسس...)"
        />

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-on-surface-variant block">
            اختصارات صيغ البكالوريا السريعة:
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5 pt-1 scrollbar-thin dir-ltr">
            {BAC_MATH_SNIPPETS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                title={item.title}
                onClick={() => handleInsertSnippet(item.snippet)}
                className="px-3 py-1.5 rounded-xl bg-surface-variant/40 border border-outline/15 hover:bg-primary/10 hover:border-primary/30 text-on-surface hover:text-primary text-xs font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer active:scale-95"
              >
                <KaTeXBadge math={item.label} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-outline/10">
          <button
            type="button"
            disabled={!scratchpadMath.trim()}
            onClick={handleApply}
            className="px-5 py-2.5 rounded-2xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-extrabold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CornerDownLeft className="w-4 h-4" />
            <span>إدراج المعادلة في الرسالة ↵</span>
          </button>

          {scratchpadMath.trim() && (
            <button
              type="button"
              onClick={() => {
                setScratchpadMath("");
                if (mathEngineRef.current) mathEngineRef.current.clear();
              }}
              className="px-3 py-1.5 rounded-xl bg-error/10 text-error hover:bg-error/20 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>تفريغ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MathScratchpad;

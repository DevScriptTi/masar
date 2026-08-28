"use client";

import React, { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/src/components/ui/use-toast";

interface InlineAIRefinerProps {
  currentText: string;
  onRefined: (newText: string) => void;
  placeholder?: string;
}

export function InlineAIRefiner({
  currentText,
  onRefined,
  placeholder = "✨ اطلب من المساعد تعديل أو إضافة شيء للسياق أعلاه...",
}: InlineAIRefinerProps) {
  const { toast } = useToast();
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  const handleRefine = async () => {
    if (!refinementPrompt.trim()) return;

    setIsRefining(true);
    try {
      const res = await fetch("/api/ai/refine-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentContextText: currentText || "",
          refinementPrompt: refinementPrompt.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "فشل في تحسين السياق من الذكاء الاصطناعي");
      }

      const data = await res.json();
      if (data.refinedText) {
        onRefined(data.refinedText);
        setRefinementPrompt("");
        toast({
          title: "تم تحديث السياق بنجاح ✨",
          description: "تمت إعادة صياغة السياق وفقاً لتوجيهاتك.",
        });
      } else {
        throw new Error(data.error || "استجابة غير صالحة من النموذج");
      }
    } catch (err: any) {
      console.error("Error refining context:", err);
      toast({
        title: "خطأ أثناء تحسين السياق",
        description: err.message || "تعذر الاتصال بخدمة الذكاء الاصطناعي.",
        variant: "destructive",
      });
    } finally {
      setIsRefining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  };

  return (
    <div className="flex w-full items-center space-x-2 space-x-reverse mt-3" dir="rtl">
      <input
        type="text"
        value={refinementPrompt}
        onChange={(e) => setRefinementPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isRefining}
        placeholder={placeholder}
        className="flex-1 h-10 px-3.5 rounded-xl bg-surface border border-purple-500/25 text-on-surface font-semibold text-xs focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all disabled:opacity-50 placeholder:text-on-surface-variant/50"
      />

      <button
        type="button"
        onClick={handleRefine}
        disabled={isRefining || !refinementPrompt.trim()}
        className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600"
      >
        {isRefining ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            <span>جاري التحديث...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>تحديث السياق</span>
          </>
        )}
      </button>
    </div>
  );
}

"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QuizQuestionItem } from "@/src/lib/firebase/coursesService";
import {
  HelpCircle,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from "lucide-react";

interface QuizBuilderProps {
  questions: QuizQuestionItem[];
  onChange: (questions: QuizQuestionItem[]) => void;
}

export function QuizBuilder({ questions, onChange }: QuizBuilderProps) {
  const handleAddQuestion = () => {
    const newQuestion: QuizQuestionItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      question: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      explanation: "",
    };
    onChange([...questions, newQuestion]);
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleUpdateQuestionText = (index: number, text: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], question: text };
    onChange(updated);
  };

  // Option Handlers (Add, Remove, Edit Option)
  const handleAddOption = (qIndex: number) => {
    const updated = [...questions];
    const currentOptions = updated[qIndex].options || [];
    updated[qIndex] = {
      ...updated[qIndex],
      options: [...currentOptions, ""],
    };
    onChange(updated);
  };

  const handleRemoveOption = (qIndex: number, oIndex: number) => {
    const updated = [...questions];
    const currentOptions = updated[qIndex].options || [];
    if (currentOptions.length <= 2) return; // Keep minimum 2 options

    const newOptions = currentOptions.filter((_, idx) => idx !== oIndex);
    let newCorrect = updated[qIndex].correctIndex;
    if (newCorrect >= newOptions.length) {
      newCorrect = Math.max(0, newOptions.length - 1);
    } else if (newCorrect === oIndex) {
      newCorrect = 0;
    }

    updated[qIndex] = {
      ...updated[qIndex],
      options: newOptions,
      correctIndex: newCorrect,
    };
    onChange(updated);
  };

  const handleUpdateOption = (qIndex: number, oIndex: number, text: string) => {
    const updated = [...questions];
    const newOptions = [...updated[qIndex].options];
    newOptions[oIndex] = text;
    updated[qIndex] = { ...updated[qIndex], options: newOptions };
    onChange(updated);
  };

  const handleSetCorrectIndex = (qIndex: number, correctIdx: number) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], correctIndex: correctIdx };
    onChange(updated);
  };

  const handleUpdateExplanation = (index: number, text: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], explanation: text };
    onChange(updated);
  };

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === questions.length - 1)
    ) {
      return;
    }
    const updated = [...questions];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    onChange(updated);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between border-b border-outline/10 pb-4">
        <div>
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            <span>بناء الاختبار التفاعلي (Quiz Builder)</span>
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            صمم أسئلة متعددة الخيارات مع الإجابات الصحيحة وتنسيق الصيغ الرياضية ($...$)
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddQuestion}
          className="px-4 h-10 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة سؤال جديد</span>
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="p-8 rounded-2xl bg-surface-variant/20 border border-dashed border-outline/30 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-primary mx-auto opacity-80" />
          <p className="text-xs font-medium text-on-surface-variant">
            لم يتم إضافة أسئلة بعد لهذا الاختبار.
          </p>
          <button
            type="button"
            onClick={handleAddQuestion}
            className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-colors"
          >
            إضافة السؤال الأول
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {questions.map((q, qIdx) => (
              <motion.div
                key={q.id || qIdx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="p-5 rounded-2xl bg-surface border border-outline/15 shadow-sm space-y-4 relative"
              >
                {/* Question Card Header */}
                <div className="flex items-center justify-between bg-surface-variant/30 p-3 rounded-xl border border-outline/10">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-primary text-on-primary font-extrabold text-xs flex items-center justify-center shadow-xs">
                      {qIdx + 1}
                    </span>
                    <span className="text-xs font-bold text-on-surface">
                      السؤال رقم {qIdx + 1}
                    </span>
                  </div>

                  {/* Move & Delete Action Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveQuestion(qIdx, "up")}
                      disabled={qIdx === 0}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant disabled:opacity-30 transition-colors"
                      title="تحريك لأعلى"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveQuestion(qIdx, "down")}
                      disabled={qIdx === questions.length - 1}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant disabled:opacity-30 transition-colors"
                      title="تحريك لأسفل"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIdx)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
                      title="حذف السؤال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-on-surface-variant flex items-center justify-between">
                    <span>نص السؤال <span className="text-error">*</span></span>
                    <span className="text-[10px] text-on-surface-variant/70">
                      يدعم معادلات LaTeX مثل $E = mc^2$
                    </span>
                  </label>
                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                    placeholder="مثال: احسب النهاية التالية عندما يؤول x إلى +infinity..."
                    required
                    className="w-full h-11 px-4 rounded-xl bg-surface-variant/30 border border-outline/30 text-on-surface text-right text-xs font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>

                {/* Dynamic Options Grid */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-on-surface-variant">
                    الخيارات المتاحة (اضغط الدائرة لتحديد الإجابة الصحيحة):
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((optText, oIdx) => {
                      const isCorrect = q.correctIndex === oIdx;

                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                            isCorrect
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-xs"
                              : "bg-surface-variant/20 border-outline/20"
                          }`}
                        >
                          {/* Correct Answer Selector */}
                          <button
                            type="button"
                            onClick={() => handleSetCorrectIndex(qIdx, oIdx)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                              isCorrect
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                                : "border-outline/40 hover:border-primary bg-surface"
                            }`}
                            title={isCorrect ? "الإجابة الصحيحة" : "تحديد كإجابة صحيحة"}
                          >
                            {isCorrect && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                          </button>

                          {/* Option Input */}
                          <input
                            type="text"
                            value={optText}
                            onChange={(e) => handleUpdateOption(qIdx, oIdx, e.target.value)}
                            placeholder={`الخيار ${oIdx + 1}...`}
                            className="flex-1 h-9 px-3 rounded-lg bg-surface border border-outline/20 text-on-surface text-right text-xs focus:outline-none focus:border-primary font-medium"
                          />

                          {/* Trash Button to Remove Option (only if options > 2) */}
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(qIdx, oIdx)}
                              className="p-1 rounded-lg text-on-surface-variant/70 hover:text-error hover:bg-error-container/30 transition-colors"
                              title="حذف الخيار"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Button to Add New Option */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddOption(qIdx)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة خيار جديد</span>
                    </button>
                  </div>
                </div>

                {/* Explanation Input */}
                <div className="space-y-1 pt-1">
                  <label className="block text-[11px] font-semibold text-on-surface-variant/80">
                    شرح وتوضيح الإجابة الصحيحة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={q.explanation || ""}
                    onChange={(e) => handleUpdateExplanation(qIdx, e.target.value)}
                    placeholder="اكتب تعليلاً خفيفاً يظهر للتلميذ بعد الإجابة..."
                    className="w-full h-9 px-3 rounded-lg bg-surface-variant/20 border border-outline/20 text-on-surface text-right text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default QuizBuilder;

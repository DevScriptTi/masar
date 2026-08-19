"use client";

import React, { useState } from "react";
import { Check, X, Calculator, RefreshCw, HelpCircle } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

export interface ExerciseData {
  type?: string;
  question?: string;
  denominator?: number;
  correctNumerator?: number;
  correctAnswer?: string | number;
  options?: string[];
  explanation?: string;
}

export interface InteractiveExerciseProps {
  data: ExerciseData;
  onSuccess?: (message: string) => void;
}

function KaTeXBlock({ math }: { math: string }) {
  try {
    const html = katex.renderToString(math, {
      displayMode: true,
      throwOnError: false,
    });
    return <div dangerouslySetInnerHTML={{ __html: html }} dir="ltr" />;
  } catch {
    return <div dir="ltr" className="font-mono text-sm">{math}</div>;
  }
}

export function InteractiveExercise({ data, onSuccess }: InteractiveExerciseProps) {
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const isFractionExercise =
    typeof data.denominator === "number" &&
    typeof data.correctNumerator === "number";

  const handleCheck = () => {
    if (isSolved) return;

    let isAnswerCorrect = false;
    let correctStr = "";

    if (isFractionExercise) {
      if (!userAnswer.trim()) return;
      const num = parseInt(userAnswer.trim(), 10);
      isAnswerCorrect = num === data.correctNumerator;
      correctStr = `${data.correctNumerator}/${data.denominator}`;
    } else if (Array.isArray(data.options) && data.options.length > 0) {
      if (!selectedOption) return;
      const targetAns = String(data.correctAnswer ?? "").trim();
      isAnswerCorrect = selectedOption.trim() === targetAns;
      correctStr = targetAns || selectedOption;
    } else if (data.correctAnswer !== undefined) {
      if (!userAnswer.trim()) return;
      const targetAns = String(data.correctAnswer).trim().toLowerCase();
      isAnswerCorrect = userAnswer.trim().toLowerCase() === targetAns;
      correctStr = String(data.correctAnswer);
    }

    setIsCorrect(isAnswerCorrect);

    if (isAnswerCorrect) {
      setIsSolved(true);
      if (onSuccess) {
        setTimeout(() => {
          onSuccess(
            `لقد قمت بحل التمرين التفاعلي بنجاح! الإجابة الصحيحة هي: ${correctStr}`
          );
        }, 1500);
      }
    }
  };

  const handleReset = () => {
    setUserAnswer("");
    setSelectedOption(null);
    setIsCorrect(null);
    setIsSolved(false);
    setShowExplanation(false);
  };

  return (
    <div className="my-3 bg-surface-variant/40 border border-outline/20 rounded-2xl p-4 shadow-sm text-on-surface">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-outline/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </div>
          <span className="text-xs font-extrabold text-on-surface">
            تدريب تفاعلي فوري ✏️
          </span>
        </div>

        {isCorrect !== null && (
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>إعادة المحاولة</span>
          </button>
        )}
      </div>

      {/* Math Question Display */}
      {data.question && (
        <div className="mb-4 text-center text-base font-semibold dir-ltr">
          <KaTeXBlock math={data.question} />
        </div>
      )}

      {/* Exercise Input Body */}
      <div className="flex flex-col items-center gap-3">
        {/* Fraction Input Type */}
        {isFractionExercise ? (
          <div className="flex flex-col items-center gap-1 dir-ltr">
            <input
              type="number"
              value={userAnswer}
              onChange={(e) => {
                setUserAnswer(e.target.value);
                setIsCorrect(null);
              }}
              placeholder="?"
              disabled={isSolved || isCorrect === true}
              className="w-16 h-10 text-center rounded-xl bg-surface border border-outline/30 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none font-bold text-sm shadow-2xs disabled:opacity-60"
            />
            <div className="h-0.5 w-16 bg-on-surface/80 rounded-full" />
            <div className="font-extrabold text-sm text-on-surface">
              {data.denominator}
            </div>
          </div>
        ) : Array.isArray(data.options) && data.options.length > 0 ? (
          /* Multiple Choice Options */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            {data.options.map((opt, idx) => {
              const isSelected = selectedOption === opt;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isSolved}
                  onClick={() => {
                    setSelectedOption(opt);
                    setIsCorrect(null);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer disabled:opacity-60 ${
                    isSelected
                      ? "bg-primary text-on-primary border-primary shadow-xs"
                      : "bg-surface text-on-surface border-outline/20 hover:bg-surface-variant/50"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          /* Generic Input Type */
          <div className="w-full max-w-xs dir-ltr">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => {
                setUserAnswer(e.target.value);
                setIsCorrect(null);
              }}
              placeholder="اكتب إجابتك هنا..."
              disabled={isSolved || isCorrect === true}
              className="w-full h-10 px-3 text-center rounded-xl bg-surface border border-outline/30 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none font-bold text-xs shadow-2xs disabled:opacity-60"
            />
          </div>
        )}

        {/* Check Answer Button */}
        <button
          type="button"
          onClick={handleCheck}
          disabled={
            isSolved ||
            isCorrect === true ||
            (isFractionExercise && !userAnswer.trim()) ||
            (!isFractionExercise && Array.isArray(data.options) && !selectedOption) ||
            (!isFractionExercise && !Array.isArray(data.options) && !userAnswer.trim())
          }
          className="mt-1 px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-extrabold shadow-md hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {isSolved ? "تم التمرس بنجاح 🎉" : "تحقق من الإجابة ✨"}
        </button>

        {/* Feedback Messages */}
        {isCorrect === true && (
          <div className="flex flex-col items-center gap-1.5 pt-1 animate-fadeIn">
            <div className="text-emerald-500 flex items-center gap-1 text-xs font-extrabold">
              <Check className="w-4 h-4" />
              <span>إجابة صحيحة! أحسنت العمل 🌟</span>
            </div>
            {data.explanation && (
              <button
                type="button"
                onClick={() => setShowExplanation((prev) => !prev)}
                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                <span>{showExplanation ? "إخفاء الشرح" : "عرض التفسير المنهجي"}</span>
              </button>
            )}
          </div>
        )}

        {isCorrect === false && (
          <div className="text-error flex items-center gap-1 text-xs font-extrabold animate-fadeIn pt-1">
            <X className="w-4 h-4" />
            <span>إجابة غير دقيقة، حاول مرة أخرى!</span>
          </div>
        )}

        {/* Explanation Card */}
        {showExplanation && data.explanation && (
          <div className="w-full p-2.5 rounded-xl bg-surface border border-outline/15 text-xs text-on-surface leading-relaxed animate-fadeIn mt-1">
            <span className="font-bold text-primary block mb-0.5">التفسير المنهجي:</span>
            <span>{data.explanation}</span>
          </div>
        )}
      </div>
    </div>
  );
}

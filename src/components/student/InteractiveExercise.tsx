"use client";

import React, { useState } from "react";
import { Check, X, Calculator, Target, ListChecks } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import katex from "katex";
import "katex/dist/katex.min.css";

export interface ExerciseData {
  type: "fraction_addition" | "equation_solving" | "multiple_choice" | string;
  question: string;

  // For fraction_addition
  denominator?: number;
  correctNumerator?: number;

  // For equation_solving
  variable?: string;
  correctAnswer?: number;

  // For multiple_choice
  options?: string[];
  correctIndex?: number;
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

export function InteractiveExercise({
  data,
  onSuccess,
}: {
  data: ExerciseData;
  onSuccess?: (msg: string) => void;
}) {
  const [userAnswer, setUserAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isSolved, setIsSolved] = useState(false);

  const triggerSuccess = (msg: string) => {
    setIsSolved(true);
    setIsCorrect(true);
    if (onSuccess) {
      setTimeout(() => onSuccess(msg), 1500);
    }
  };

  const renderFeedback = () => {
    if (isCorrect === true) {
      return (
        <div className="text-emerald-500 flex items-center justify-center gap-1.5 text-xs font-bold animate-fadeIn mt-3">
          <Check className="w-4 h-4" />
          <span>إجابة صحيحة! أحسنت العمل.</span>
        </div>
      );
    }
    if (isCorrect === false) {
      return (
        <div className="text-error flex items-center justify-center gap-1.5 text-xs font-bold animate-fadeIn mt-3">
          <X className="w-4 h-4" />
          <span>إجابة غير دقيقة، حاول مرة أخرى!</span>
        </div>
      );
    }
    return null;
  };

  // --- TEMPLATE 1: Fraction Addition ---
  if (data.type === "fraction_addition") {
    return (
      <div className="my-4 bg-surface-variant/30 border border-outline/20 rounded-2xl p-5 shadow-sm max-w-sm mx-auto text-on-surface">
        <div className="flex items-center gap-2 mb-4 border-b border-outline/10 pb-2">
          <Calculator className="w-4 h-4 text-primary" />
          <span className="text-xs font-extrabold text-on-surface">
            تدريب تفاعلي: جمع الكسور
          </span>
        </div>

        <div className="mb-5 text-center text-xl" dir="ltr">
          <KaTeXBlock math={`${data.question} =`} />
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1.5" dir="ltr">
            <input
              type="number"
              value={userAnswer}
              disabled={isSolved}
              onChange={(e) => {
                setUserAnswer(e.target.value);
                setIsCorrect(null);
              }}
              placeholder="?"
              className="w-16 h-10 text-center rounded-lg bg-surface border border-outline/20 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none font-bold disabled:opacity-50"
            />
            <div className="h-0.5 w-16 bg-on-surface" />
            <div className="font-extrabold text-on-surface text-lg">
              {data.denominator}
            </div>
          </div>

          <button
            type="button"
            disabled={isSolved || !userAnswer.trim()}
            onClick={() => {
              if (parseInt(userAnswer.trim(), 10) === data.correctNumerator) {
                triggerSuccess(
                  `لقد قمت بحل تمرين الكسور بنجاح! البسط الصحيح هو: ${data.correctNumerator}`
                );
              } else {
                setIsCorrect(false);
              }
            }}
            className="mt-2 w-full max-w-[120px] py-2 rounded-xl bg-primary text-on-primary text-xs font-extrabold shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            تحقق
          </button>

          {renderFeedback()}
        </div>
      </div>
    );
  }

  // --- TEMPLATE 2: Equation Solving ---
  if (data.type === "equation_solving") {
    return (
      <div className="my-4 bg-secondary/5 border border-secondary/20 rounded-2xl p-5 shadow-sm max-w-sm mx-auto text-on-surface">
        <div className="flex items-center gap-2 mb-4 border-b border-secondary/10 pb-2">
          <Target className="w-4 h-4 text-secondary" />
          <span className="text-xs font-extrabold text-on-surface">
            تدريب تفاعلي: إيجاد المجهول
          </span>
        </div>

        <div className="mb-5 text-center text-xl text-on-surface" dir="ltr">
          <KaTeXBlock math={data.question} />
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3" dir="ltr">
            <span className="font-extrabold text-lg italic text-secondary">
              {data.variable || "x"} =
            </span>
            <input
              type="number"
              step="any"
              value={userAnswer}
              disabled={isSolved}
              onChange={(e) => {
                setUserAnswer(e.target.value);
                setIsCorrect(null);
              }}
              placeholder="?"
              className="w-20 h-10 text-center rounded-lg bg-surface border border-outline/20 text-on-surface focus:ring-2 focus:ring-secondary focus:outline-none font-bold disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            disabled={isSolved || !userAnswer.trim()}
            onClick={() => {
              if (parseFloat(userAnswer.trim()) === data.correctAnswer) {
                triggerSuccess(
                  `لقد قمت بحل المعادلة بنجاح! قيمة المجهول هي: ${data.correctAnswer}`
                );
              } else {
                setIsCorrect(false);
              }
            }}
            className="mt-2 w-full max-w-[120px] py-2 rounded-xl bg-secondary text-on-secondary text-xs font-extrabold shadow-md hover:bg-secondary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            تحقق
          </button>

          {renderFeedback()}
        </div>
      </div>
    );
  }

  // --- TEMPLATE 3: Multiple Choice ---
  if (data.type === "multiple_choice") {
    return (
      <div className="my-4 bg-tertiary/5 border border-tertiary/20 rounded-2xl p-5 shadow-sm max-w-md mx-auto text-on-surface">
        <div className="flex items-center gap-2 mb-3 border-b border-tertiary/10 pb-2">
          <ListChecks className="w-4 h-4 text-tertiary" />
          <span className="text-xs font-extrabold text-on-surface">
            تدريب تفاعلي: اختر الإجابة الصحيحة
          </span>
        </div>

        <div className="mb-5 text-sm font-medium text-on-surface leading-relaxed text-right">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          >
            {data.question}
          </ReactMarkdown>
        </div>

        <div className="flex flex-col gap-2.5">
          {data.options?.map((option, index) => (
            <button
              key={index}
              type="button"
              disabled={isSolved}
              onClick={() => {
                if (index === data.correctIndex) {
                  triggerSuccess("لقد أجبت على السؤال المتعدد الخيارات بنجاح!");
                } else {
                  setIsCorrect(false);
                }
              }}
              className="w-full text-right p-3 rounded-xl border border-outline/15 bg-surface hover:bg-tertiary/10 hover:border-tertiary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-xs font-bold text-on-surface cursor-pointer"
            >
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                components={{
                  p: ({ children }) => <span>{children}</span>,
                }}
              >
                {option}
              </ReactMarkdown>
            </button>
          ))}
        </div>

        {renderFeedback()}
      </div>
    );
  }

  // Fallback for unknown types
  return null;
}

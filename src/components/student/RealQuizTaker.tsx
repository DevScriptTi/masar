"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { QuizQuestionItem } from "@/src/lib/firebase/coursesService";
import { MathText } from "@/src/components/admin/activities/StudentPreview";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  Loader2,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Send,
} from "lucide-react";

interface RealQuizTakerProps {
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  courseId: string;
  activityId: string;
  activityTitle: string;
  quizQuestions: QuizQuestionItem[];
}

export function RealQuizTaker({
  studentId,
  studentName,
  studentEmail,
  courseId,
  activityId,
  activityTitle,
  quizQuestions = [],
}: RealQuizTakerProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedResult, setSubmittedResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Existing Quiz Submission
  useEffect(() => {
    if (!studentId || !activityId) return;

    const fetchQuizSubmission = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "submissions"),
          where("studentId", "==", studentId),
          where("activityId", "==", activityId),
          where("type", "==", "quiz")
        );

        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data: any = { id: docSnap.id, ...docSnap.data() };
          setSubmittedResult(data);
          if (data.answers) {
            setSelectedAnswers(data.answers);
          }
        } else {
          setSubmittedResult(null);
        }
      } catch (error) {
        console.error("Error fetching quiz submission:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizSubmission();
  }, [studentId, activityId]);

  if (loading) {
    return (
      <div className="p-8 text-center space-y-2" dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-tertiary mx-auto" />
        <p className="text-xs font-semibold text-on-surface-variant">جاري إعداد أسئلة الاختبار...</p>
      </div>
    );
  }

  if (quizQuestions.length === 0) {
    return (
      <div className="p-6 rounded-3xl bg-surface border border-outline/15 text-center text-xs text-on-surface-variant" dir="rtl">
        لا توجد أسئلة مضافة لهذا الاختبار حالياً.
      </div>
    );
  }

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    if (submittedResult && !isSubmitting) return; // Prevent selection if quiz is already submitted
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleQuizSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    // Ensure all questions are answered
    const unanswered = quizQuestions.filter((_, idx) => selectedAnswers[idx] === undefined);
    if (unanswered.length > 0) {
      setErrorMsg(`يرجى الإجابة عن كافة الأسئلة (${quizQuestions.length} سؤال) قبل الإرسال.`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate score
      let correctCount = 0;
      quizQuestions.forEach((q, idx) => {
        if (selectedAnswers[idx] === q.correctIndex) {
          correctCount++;
        }
      });

      const maxScore = quizQuestions.length;
      const scoreString = `${correctCount} / ${maxScore}`;

      const subData = {
        studentId,
        studentName: studentName || "تلميذ مسجل",
        studentEmail: studentEmail || "",
        courseId,
        activityId,
        activityTitle,
        type: "quiz",
        score: scoreString,
        scoreValue: correctCount,
        maxScore,
        answers: selectedAnswers,
        status: "graded",
        submittedAt: serverTimestamp(),
      };

      if (submittedResult && submittedResult.id) {
        const docRef = doc(db, "submissions", submittedResult.id);
        await updateDoc(docRef, {
          score: scoreString,
          scoreValue: correctCount,
          maxScore,
          answers: selectedAnswers,
          submittedAt: serverTimestamp(),
        });

        setSubmittedResult((prev: any) => ({
          ...prev,
          ...subData,
        }));
      } else {
        const docRef = await addDoc(collection(db, "submissions"), subData);
        setSubmittedResult({ id: docRef.id, ...subData });
      }

      // Trigger Real-Time Notification to student for Quiz completion
      if (studentId) {
        try {
          await addDoc(collection(db, "notifications"), {
            userId: studentId,
            title: "نتيجة الاختبار التفاعلي",
            message: `تم رصد نتيجة إجابتك في اختبار "${activityTitle}": ${scoreString}`,
            isRead: false,
            createdAt: serverTimestamp(),
            relatedActivityId: activityId || "",
          });
        } catch (notifErr) {
          console.error("Error creating quiz notification:", notifErr);
        }
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      setErrorMsg("حدث خطأ أثناء رصد نتيجة الاختبار. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    setSubmittedResult(null);
    setSelectedAnswers({});
    setErrorMsg(null);
  };

  const isCompleted = Boolean(submittedResult);

  return (
    <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6" dir="rtl">
      {/* Quiz Header */}
      <div className="flex items-center justify-between border-b border-outline/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-on-surface">الاختبار التفاعلي المنهجي</h3>
            <p className="text-xs text-on-surface-variant/80">أجب عن الأسئلة التالية لاختبار مدى استيعابك وفهمك للدرس</p>
          </div>
        </div>

        {isCompleted && (
          <button
            type="button"
            onClick={handleRetakeQuiz}
            className="px-3.5 py-1.5 rounded-xl border border-tertiary/30 bg-tertiary/5 text-tertiary text-xs font-bold hover:bg-tertiary/10 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة الاختبار</span>
          </button>
        )}
      </div>

      {/* Quiz Completion Result Banner */}
      {isCompleted && (
        <div className="p-6 rounded-2xl bg-tertiary/10 border border-tertiary/20 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-tertiary" />
              <span className="text-sm font-extrabold text-on-surface">نتيجة الاختبار النهائية:</span>
            </div>
            <span className="text-xl font-black text-tertiary bg-surface px-4 py-1.5 rounded-xl border border-tertiary/30 shadow-2xs">
              {submittedResult.score}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant font-medium">
            تم رصد النتيجة وحفظ التقييم في ملفك الشخصي بنجاح. يمكنك مراجعة الأسئلة وتصحيحها أدناه.
          </p>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-error-container/20 border border-error/30 text-error text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-6">
        {quizQuestions.map((q, qIdx) => {
          const studentSelected = selectedAnswers[qIdx];
          const isCorrect = isCompleted && studentSelected === q.correctIndex;
          const isWrong = isCompleted && studentSelected !== undefined && studentSelected !== q.correctIndex;

          return (
            <div
              key={q.id || qIdx}
              className={`p-5 rounded-2xl border transition-all space-y-4 ${
                isCompleted
                  ? isCorrect
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-error-container/10 border-error/20"
                  : "bg-surface-variant/20 border-outline/15"
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-xs sm:text-sm font-bold text-on-surface leading-relaxed flex items-start gap-2">
                  <span className="w-6 h-6 rounded-lg bg-tertiary/10 text-tertiary font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {qIdx + 1}
                  </span>
                  <MathText content={q.question} />
                </h4>

                {isCompleted && (
                  <span className="shrink-0">
                    {isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-error" />
                    )}
                  </span>
                )}
              </div>

              {/* Option Choices */}
              <div className="grid grid-cols-1 gap-2.5 pt-1">
                {q.options.map((opt, oIdx) => {
                  const isChoiceSelected = studentSelected === oIdx;
                  let choiceStyle =
                    "bg-surface border-outline/20 text-on-surface hover:border-tertiary/40";

                  if (isCompleted) {
                    if (oIdx === q.correctIndex) {
                      choiceStyle = "bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 border-emerald-500 font-extrabold";
                    } else if (isChoiceSelected && oIdx !== q.correctIndex) {
                      choiceStyle = "bg-error-container/30 text-error border-error font-extrabold";
                    } else {
                      choiceStyle = "bg-surface-variant/30 text-on-surface-variant/60 border-outline/10 opacity-70";
                    }
                  } else if (isChoiceSelected) {
                    choiceStyle = "bg-tertiary text-on-tertiary border-tertiary font-extrabold shadow-2xs";
                  }

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelectOption(qIdx, oIdx)}
                      disabled={isCompleted}
                      className={`p-3.5 rounded-xl border text-xs font-semibold text-right transition-all flex items-center gap-3 ${choiceStyle}`}
                    >
                      <span className="w-5 h-5 rounded-md border border-current text-[11px] font-bold flex items-center justify-center shrink-0">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <div className="flex-1 truncate">
                        <MathText content={opt} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detailed Explanation Display in Review Mode */}
              {isCompleted && q.explanation && (
                <div className="p-3.5 rounded-xl bg-surface border border-outline/10 text-xs space-y-1 mt-2">
                  <span className="font-bold text-tertiary flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>توضيح الإجابة الصحيحة:</span>
                  </span>
                  <div className="text-on-surface-variant leading-relaxed">
                    <MathText content={q.explanation} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Button */}
      {!isCompleted && (
        <div className="pt-4 border-t border-outline/10 flex justify-end">
          <button
            type="button"
            onClick={() => handleQuizSubmit()}
            disabled={isSubmitting}
            className="h-12 px-7 rounded-2xl bg-tertiary text-on-tertiary font-extrabold text-xs hover:bg-tertiary/90 focus:outline-none focus:ring-4 focus:ring-tertiary/30 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري رصد النتيجة...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>إنهاء الاختبار ورصد النتيجة</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default RealQuizTaker;

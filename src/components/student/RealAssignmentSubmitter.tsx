"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { HomeworkUploader } from "@/src/components/student/HomeworkUploader";
import {
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Award,
} from "lucide-react";

interface RealAssignmentSubmitterProps {
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  courseId: string;
  activityId: string;
  activityTitle: string;
  onSubmissionUrlsChange?: (urls: string[]) => void;
}

export function RealAssignmentSubmitter({
  studentId,
  studentName,
  studentEmail,
  courseId,
  activityId,
  activityTitle,
  onSubmissionUrlsChange,
}: RealAssignmentSubmitterProps) {
  const [driveLink, setDriveLink] = useState("");
  const [submissionUrls, setSubmissionUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [existingSubmission, setExistingSubmission] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activityDoc, setActivityDoc] = useState<any>(null);

  const updateSubmissionUrls = (urls: string[]) => {
    setSubmissionUrls(urls);
    if (onSubmissionUrlsChange) {
      onSubmissionUrlsChange(urls);
    }
  };

  // Fetch Activity Doc for Deadline and Paused status
  useEffect(() => {
    if (!activityId) return;
    const fetchActivity = async () => {
      try {
        const actSnap = await getDoc(doc(db, "activities", activityId));
        if (actSnap.exists()) {
          setActivityDoc(actSnap.data());
        }
      } catch (err) {
        console.error("Error fetching activity in submitter:", err);
      }
    };
    fetchActivity();
  }, [activityId]);

  // Compute Rules
  const isPaused = !!activityDoc?.isSubmissionsPaused;
  const isDeadlinePassed = !!(
    activityDoc?.deadline && new Date() > new Date(activityDoc.deadline)
  );
  const canResubmit = !!existingSubmission?.canResubmit;
  const isBlocked = (isPaused || isDeadlinePassed) && !canResubmit;

  const triggerPreAnalysis = (subId: string, urls: string[]) => {
    if (!subId || !urls || urls.length === 0) return;
    fetch("/api/ai/pre-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: subId,
        images: urls,
        lessonContext: activityTitle,
      }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData?.aiEvaluationCache) {
          console.log("⚡ Background Pre-Analysis Ready:", resData.aiEvaluationCache);
        }
      })
      .catch((err) => console.error("Background Pre-Analysis Error:", err));
  };

  // Fetch Existing Submission for this activity
  useEffect(() => {
    if (!studentId || !activityId) return;

    const fetchSubmission = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "submissions"),
          where("studentId", "==", studentId),
          where("activityId", "==", activityId),
          where("type", "==", "assignment")
        );

        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data: any = { id: docSnap.id, ...docSnap.data() };
          setExistingSubmission(data);
          
          let parsedUrls: string[] = [];
          if (Array.isArray(data.contentUrls) && data.contentUrls.length > 0) {
            parsedUrls = data.contentUrls;
          } else if (data.content) {
            parsedUrls = String(data.content).split(",").map((s) => s.trim()).filter(Boolean);
          }
          updateSubmissionUrls(parsedUrls);
          setDriveLink(data.content || "");
          setNotes(data.notes || "");

          // Trigger background pre-analysis if cache does not exist yet
          if (!data.aiEvaluationCache && parsedUrls.length > 0) {
            triggerPreAnalysis(data.id, parsedUrls);
          }
        } else {
          setExistingSubmission(null);
          updateSubmissionUrls([]);
        }
      } catch (error) {
        console.error("Error fetching assignment submission:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [studentId, activityId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isBlocked) {
      setErrorMsg("عذراً، استلام التقييمات موقوف حالياً أو انتهى الموعد المحدد.");
      return;
    }

    if (submissionUrls.length === 0) {
      setErrorMsg("يرجى إرفاق صورة واحدة على الأقل أو ملف لإجابة الواجب.");
      return;
    }

    const combinedContent = submissionUrls.join(",");
    setIsSubmitting(true);

    try {
      let subId = "";
      if (existingSubmission && existingSubmission.id) {
        subId = existingSubmission.id;
        // Update Existing Submission
        const docRef = doc(db, "submissions", existingSubmission.id);
        await updateDoc(docRef, {
          content: combinedContent,
          contentUrls: submissionUrls,
          notes: notes.trim(),
          updatedAt: serverTimestamp(),
        });

        setExistingSubmission((prev: any) => ({
          ...prev,
          content: combinedContent,
          contentUrls: submissionUrls,
          notes: notes.trim(),
        }));
      } else {
        // Create New Submission
        const newSub = {
          studentId,
          studentName: studentName || "تلميذ مسجل",
          studentEmail: studentEmail || "",
          courseId,
          activityId,
          activityTitle,
          type: "assignment",
          content: combinedContent,
          contentUrls: submissionUrls,
          notes: notes.trim(),
          status: "pending",
          score: null,
          feedback: null,
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "submissions"), newSub);
        subId = docRef.id;
        setExistingSubmission({ id: docRef.id, ...newSub });
      }

      // Non-blocking background trigger for AI Pre-Analysis
      triggerPreAnalysis(subId, submissionUrls);

      setSuccessMsg("تم تسليم الإجابة بنجاح! الإجابة في انتظار تقييم الأستاذ.");
    } catch (error) {
      console.error("Error submitting assignment:", error);
      setErrorMsg("حدث خطأ أثناء حفظ التسليم. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center space-y-2" dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        <p className="text-xs font-semibold text-on-surface-variant">جاري التثبت من تسليم الواجب...</p>
      </div>
    );
  }

  const isGraded = existingSubmission?.status === "graded";

  return (
    <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-on-surface">تسليم الواجب والتطبيق</h3>
            <p className="text-xs text-on-surface-variant/80">أرسل رابط إجابتك ليقوم الأستاذ بتقييمها ورصد الدرجة</p>
          </div>
        </div>

        {/* Status Badge */}
        {existingSubmission && (
          <span
            className={`text-xs font-extrabold px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              isGraded
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
            }`}
          >
            {isGraded ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>تم التقييم ({existingSubmission.score})</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-amber-500" />
                <span>تم التسليم - قيد التقييم</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Graded Result Card (If evaluated by teacher) */}
      {isGraded && (() => {
        const rawScoreStr = String(existingSubmission?.score || existingSubmission?.scoreValue || "");
        const match = rawScoreStr.match(/^(\d+(?:\.\d+)?)/);
        const numScore = match
          ? parseFloat(match[1])
          : typeof existingSubmission?.scoreValue === "number"
          ? existingSubmission.scoreValue
          : NaN;

        let gradeColor = "bg-surface-variant/40 border-outline/20"; // default
        let textColor = "text-on-surface";

        if (!isNaN(numScore)) {
          if (numScore >= 15) {
            gradeColor = "bg-emerald-500/15 border-emerald-500/30";
            textColor = "text-emerald-600 dark:text-emerald-400";
          } else if (numScore >= 10) {
            gradeColor = "bg-amber-500/15 border-amber-500/30";
            textColor = "text-amber-600 dark:text-amber-400";
          } else {
            gradeColor = "bg-rose-500/15 border-rose-500/30";
            textColor = "text-rose-600 dark:text-rose-400";
          }
        }

        const displayScore = !isNaN(numScore) ? `${numScore} / 20` : String(existingSubmission?.score || "20 / 20");

        return (
          <div className={`p-6 rounded-3xl border shadow-sm space-y-4 animate-fadeIn ${gradeColor}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className={`text-sm font-extrabold flex items-center gap-2 ${textColor}`}>
                <Award className="w-5 h-5" />
                <span>نتيجة التقييم النهائي:</span>
              </span>
              <div className={`text-3xl sm:text-4xl font-black ${textColor} tracking-tight`} dir="ltr">
                <span dir="ltr" className="inline-block">{displayScore}</span>
              </div>
            </div>

            {existingSubmission?.feedback && (
              <div className="pt-3 border-t border-current/10 space-y-1.5">
                <span className={`text-xs font-extrabold flex items-center gap-1.5 ${textColor}`}>
                  <MessageSquare className="w-4 h-4" />
                  <span>ملاحظات وتوجيهات الأستاذ:</span>
                </span>
                <p className="text-xs sm:text-sm text-on-surface leading-relaxed font-medium bg-surface/70 backdrop-blur-xs p-4 rounded-2xl border border-outline/10 shadow-2xs">
                  {existingSubmission.feedback}
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Task A & B Rules Banners */}
      {canResubmit && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>✨ سمح لك الأستاذ بإعادة التقديم! يمكنك رفع إجابة جديدة وتحديث واجبك الآن.</span>
        </div>
      )}

      {isPaused && !canResubmit && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>⚠️ تم إيقاف استقبال التقييمات لهذا الواجب موقتاً من طرف الأستاذ.</span>
        </div>
      )}

      {isDeadlinePassed && !canResubmit && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <Clock className="w-4 h-4 text-rose-500 shrink-0" />
          <span>⏰ انتهى الموعد النهائي المحدد لتسليم الإجابات لهذا الواجب.</span>
        </div>
      )}

      {/* Alert Banners */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-error-container/20 border border-error/30 text-error text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Cloudinary Multi-File Homework Uploader */}
        <HomeworkUploader
          currentUrls={submissionUrls}
          onUploadSuccess={(urls) => updateSubmissionUrls(urls)}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-on-surface-variant">
            ملاحظات إضافية للأستاذ (اختياري)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={isSubmitting || isBlocked}
            placeholder="أضف أي استفسار أو ملاحظة حول طريقة حلك للتمرين..."
            className="w-full p-3.5 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all resize-none font-medium"
          />
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={isSubmitting || submissionUrls.length === 0 || isBlocked}
            className="h-11 px-6 rounded-2xl bg-secondary text-on-secondary font-bold text-xs hover:bg-secondary/90 focus:outline-none focus:ring-4 focus:ring-secondary/30 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري إرسال التسليم...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{existingSubmission ? "تحديث التسليم" : "تسليم الإجابة"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RealAssignmentSubmitter;

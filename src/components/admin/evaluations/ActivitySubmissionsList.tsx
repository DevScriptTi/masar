"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import {
  ClipboardList,
  FileText,
  HelpCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
  Award,
  MessageSquare,
  AlertCircle,
  Sparkles,
  X,
  Edit,
  UserCheck,
  ChevronDown,
  Layers,
  Calendar,
  PauseCircle,
  PlayCircle,
  Trash2,
  RotateCcw,
  Check,
  ZoomIn,
} from "lucide-react";

export interface LocalSubmissionItem {
  id: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  courseId: string;
  activityId: string;
  activityTitle: string;
  type: "assignment" | "quiz";
  content?: string;
  contentUrls?: string[];
  notes?: string;
  score?: string | number | null;
  scoreValue?: number | null;
  maxScore?: number;
  answers?: Record<string, any>;
  feedback?: string | null;
  status: "pending" | "graded";
  canResubmit?: boolean;
  submittedAt?: any;
  updatedAt?: any;
  gradedAt?: any;
}

interface ActivitySubmissionsListProps {
  activityId: string;
}

export function ActivitySubmissionsList({ activityId }: ActivitySubmissionsListProps) {
  const [submissions, setSubmissions] = useState<LocalSubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Grading State
  const [selectedSubForGrading, setSelectedSubForGrading] = useState<LocalSubmissionItem | null>(null);
  const [modalScore, setModalScore] = useState<number | string>(18);
  const [modalFeedback, setModalFeedback] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Task A: Activity Global Controls State
  const [deadline, setDeadline] = useState<string>("");
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [savingActivity, setSavingActivity] = useState<boolean>(false);

  // Task B & C: Delete Confirmation Modal & Toast Messages
  const [deleteConfirmSubId, setDeleteConfirmSubId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Lightbox State for Admin Evaluation View
  const [adminLightboxOpen, setAdminLightboxOpen] = useState(false);
  const [adminLightboxIndex, setAdminLightboxIndex] = useState(0);
  const [adminLightboxSlides, setAdminLightboxSlides] = useState<Array<{ src: string }>>([]);

  // Raw Client-Side Data Fetching Engine (No Firebase Indexes for Sorting)
  const fetchSubmissions = async () => {
    if (!activityId) return;
    setLoading(true);

    try {
      // 1. Fetch RAW submissions for this activityId without orderBy to prevent index errors
      const subsRef = collection(db, "submissions");
      const q = query(subsRef, where("activityId", "==", activityId));
      const [subsSnap, usersSnap] = await Promise.all([
        getDocs(q),
        getDocs(collection(db, "users")),
      ]);

      // Map users for fast lookup
      const usersMap: Record<string, { name: string; email: string }> = {};
      usersSnap.docs.forEach((d) => {
        const u = d.data();
        usersMap[d.id] = {
          name: u.fullName || u.displayName || u.email?.split("@")[0] || "تلميذ مسجل",
          email: u.email || "",
        };
      });

      // 2. Parse & Join student data
      const list: LocalSubmissionItem[] = subsSnap.docs.map((d) => {
        const data = d.data() as any;
        const rawStudentId = String(data.studentId || data.userId || data.uid || data.studentUid || "").trim();
        const studentInfo = usersMap[rawStudentId];

        return {
          id: d.id,
          ...data,
          studentId: rawStudentId,
          studentName: studentInfo?.name || data.studentName || "تلميذ مسجل",
          studentEmail: studentInfo?.email || data.studentEmail || "",
        };
      });

      // 3. Client-Side Sorting by submittedAt descending
      list.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        return timeB - timeA;
      });

      setSubmissions(list);
    } catch (error) {
      console.error("Error fetching activity submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Activity Global Details (Deadline & Paused Status)
  const fetchActivityDetails = async () => {
    if (!activityId) return;
    try {
      const actSnap = await getDoc(doc(db, "activities", activityId));
      if (actSnap.exists()) {
        const data = actSnap.data();
        setDeadline(data.deadline || "");
        setIsPaused(!!data.isSubmissionsPaused);
      }
    } catch (error) {
      console.error("Error fetching activity global details:", error);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    fetchActivityDetails();
  }, [activityId]);

  // Task A: Save Deadline Handler
  const handleSaveDeadline = async () => {
    if (!activityId) return;
    setSavingActivity(true);
    try {
      await updateDoc(doc(db, "activities", activityId), {
        deadline: deadline || null,
      });
      setToastMsg({ text: "تم تحديث وحفظ الموعد النهائي للنشاط بنجاح!", type: "success" });
    } catch (err) {
      console.error("Failed to update deadline:", err);
      setToastMsg({ text: "حدث خطأ أثناء حفظ الموعد النهائي.", type: "error" });
    } finally {
      setSavingActivity(false);
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  // Task A: Toggle Pause/Resume Submissions Handler
  const handleTogglePauseSubmissions = async () => {
    if (!activityId) return;
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    setSavingActivity(true);
    try {
      await updateDoc(doc(db, "activities", activityId), {
        isSubmissionsPaused: nextPaused,
      });
      setToastMsg({
        text: nextPaused
          ? "تم إيقاف استقبال التقييمات لهذا النشاط مؤقتاً."
          : "تم استئناف استقبال التقييمات لهذا النشاط بنجاح.",
        type: "success",
      });
    } catch (err) {
      console.error("Failed to toggle pause submissions:", err);
      setIsPaused(!nextPaused); // revert state
      setToastMsg({ text: "فشل تغيير حالة استقبال التقييمات.", type: "error" });
    } finally {
      setSavingActivity(false);
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  // Task B: Allow Student Resubmission Handler
  const handleAllowResubmission = async (subId: string) => {
    try {
      await updateDoc(doc(db, "submissions", subId), {
        canResubmit: true,
        status: "pending",
      });
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === subId ? { ...s, canResubmit: true, status: "pending" } : s
        )
      );
      setToastMsg({ text: "تم تفعيل السماح بالإعادة للتلميذ بنجاح!", type: "success" });
    } catch (err) {
      console.error("Failed to allow resubmission:", err);
      setToastMsg({ text: "حدث خطأ أثناء تفعيل خيار إعادة التسليم.", type: "error" });
    } finally {
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  // Task B: Delete Submission Handler with Cloudinary Permanent File Cleanup
  const handleDeleteSubmission = async (subId: string) => {
    try {
      const targetSub = submissions.find((s) => s.id === subId);
      if (targetSub) {
        const urlsToDelete: string[] = Array.isArray(targetSub.contentUrls) && targetSub.contentUrls.length > 0
          ? targetSub.contentUrls
          : targetSub.content
          ? String(targetSub.content).split(",").map((s) => s.trim()).filter(Boolean)
          : [];

        if (urlsToDelete.length > 0) {
          try {
            console.log("🔥 Requesting Cloudinary files deletion for:", urlsToDelete);
            await fetch("/api/cloudinary/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ urls: urlsToDelete }),
            });
          } catch (cloudErr) {
            console.warn("Cloudinary delete call failed, continuing with Firestore deletion:", cloudErr);
          }
        }
      }

      await deleteDoc(doc(db, "submissions", subId));
      setSubmissions((prev) => prev.filter((s) => s.id !== subId));
      setDeleteConfirmSubId(null);
      setToastMsg({ text: "تم حذف تسليم التلميذ وملفاته السحابية نهائياً.", type: "success" });
    } catch (err) {
      console.error("Failed to delete submission:", err);
      setToastMsg({ text: "حدث خطأ أثناء حذف تسليم التلميذ.", type: "error" });
    } finally {
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  // Open Grading Modal handler
  const handleOpenGradingModal = (sub: LocalSubmissionItem) => {
    setSelectedSubForGrading(sub);
    // Parse numeric score if existing (e.g. "18 / 20" -> 18)
    let initialScore: number | string = 18;
    if (sub.scoreValue !== undefined && sub.scoreValue !== null) {
      initialScore = sub.scoreValue;
    } else if (sub.score) {
      const match = String(sub.score).match(/^(\d+(?:\.\d+)?)/);
      if (match) initialScore = parseFloat(match[1]);
    }
    setModalScore(initialScore);
    setModalFeedback(sub.feedback || "");
  };

  // Close Grading Modal handler
  const handleCloseModal = () => {
    setSelectedSubForGrading(null);
    setIsSaving(false);
  };

  // Esc Key Modal Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSubForGrading) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSubForGrading]);

  // Save Grade Handler
  const handleSaveGrading = async () => {
    if (!selectedSubForGrading) return;

    let numScore = parseFloat(String(modalScore));
    if (isNaN(numScore)) {
      alert("يرجى إدخال عدد صحيح للعلامة (من 20).");
      return;
    }

    if (numScore > 20) numScore = 20;
    if (numScore < 0) numScore = 0;

    const formattedScore = `${numScore} / 20`;
    setIsSaving(true);

    try {
      const docRef = doc(db, "submissions", selectedSubForGrading.id);
      await updateDoc(docRef, {
        score: formattedScore,
        scoreValue: numScore,
        maxScore: 20,
        feedback: modalFeedback.trim(),
        status: "graded",
        gradedAt: serverTimestamp(),
      });

      // Universal ID Extractor
      const targetUserId = String(
        selectedSubForGrading.studentId ||
          (selectedSubForGrading as any).userId ||
          (selectedSubForGrading as any).uid ||
          ""
      ).trim();

      if (targetUserId) {
        console.log("✅ SUCCESS: Sending notification to user:", targetUserId);
        try {
          await addDoc(collection(db, "notifications"), {
            userId: targetUserId,
            studentId: targetUserId,
            targetId: targetUserId,
            title: "تم تقييم إجابتك",
            message: `لقد تم تصحيح إجابتك ومنحك علامة ${formattedScore}. راجع ملاحظات الأستاذ.`,
            isRead: false,
            createdAt: serverTimestamp(),
            relatedActivityId: selectedSubForGrading.activityId || "",
          });
        } catch (notifErr) {
          console.error("❌ ERROR writing notification to Firestore:", notifErr);
        }
      } else {
        console.error(
          "❌ CRITICAL: Could not find any student/user ID on this submission to notify!",
          selectedSubForGrading
        );
      }

      // Update local state immediately without refresh
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === selectedSubForGrading.id
            ? {
                ...s,
                score: formattedScore,
                scoreValue: numScore,
                maxScore: 20,
                feedback: modalFeedback.trim(),
                status: "graded",
              }
            : s
        )
      );

      handleCloseModal();
    } catch (error) {
      console.error("Error saving grade:", error);
      alert("حدث خطأ أثناء حفظ التقييم. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSaving(false);
    }
  };

  // Grouping Submissions by Student ID
  const groupedByStudent: Record<string, LocalSubmissionItem[]> = {};
  submissions.forEach((sub) => {
    if (!groupedByStudent[sub.studentId]) {
      groupedByStudent[sub.studentId] = [];
    }
    groupedByStudent[sub.studentId].push(sub);
  });

  const studentIds = Object.keys(groupedByStudent);

  // Statistics Calculation
  const totalSubmissionsCount = submissions.length;
  const pendingCount = submissions.filter((s) => s.type === "assignment" && s.status === "pending").length;
  const gradedCount = submissions.filter((s) => s.status === "graded").length;

  if (loading) {
    return (
      <div className="p-8 text-center space-y-2 bg-surface/50 border border-outline/15 rounded-3xl" dir="rtl">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        <p className="text-xs font-semibold text-on-surface-variant">جاري تجميع وحساب تسليمات التلاميذ لهذا النشاط...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 left-6 z-50 animate-fadeIn">
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-xl backdrop-blur-md ${
              toastMsg.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/90 border-rose-500/40 text-rose-200"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* Top Header & Section Title */}
      <div className="flex items-center justify-between border-b border-outline/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-on-surface">إجابات وتسليمات التلاميذ لهذا النشاط</h3>
            <p className="text-[11px] text-on-surface-variant/80">استعرض نتائج الاختبارات وقيم واجبات التلاميذ المسلمة</p>
          </div>
        </div>

        <span className="text-xs font-extrabold text-on-surface-variant bg-surface-variant/40 px-3 py-1 rounded-xl border border-outline/10">
          {studentIds.length} تلاميذ قاموا بالتسليم
        </span>
      </div>

      {/* Task A: Global Activity Controls Panel */}
      <div className="bg-surface border border-outline/15 rounded-3xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-outline/10 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-extrabold text-on-surface">إعدادات التسليم والتحكم العام بالنشاط</h4>
          </div>
          {savingActivity && (
            <span className="text-[11px] font-bold text-primary flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> جاري التحديث...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deadline Setting */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-on-surface-variant flex items-center justify-between">
              <span>الموعد النهائي لتسليم التقييم (Deadline):</span>
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline("")}
                  className="text-[10px] text-error hover:underline"
                >
                  إلغاء الموعد
                </button>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl bg-surface-variant/40 border border-outline/20 text-on-surface text-xs focus:outline-none focus:border-primary transition-all font-mono"
              />
              <button
                type="button"
                onClick={handleSaveDeadline}
                disabled={savingActivity}
                className="h-10 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ الموعد</span>
              </button>
            </div>
          </div>

          {/* Pause / Resume Submissions Toggle */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-on-surface-variant">
              حالة استلام الإجابات والتسليمات:
            </label>
            <button
              type="button"
              onClick={handleTogglePauseSubmissions}
              disabled={savingActivity}
              className={`w-full h-10 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-between border ${
                isPaused
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                {isPaused ? <PauseCircle className="w-4 h-4 text-amber-500" /> : <PlayCircle className="w-4 h-4 text-emerald-500" />}
                <span>{isPaused ? "التسليمات موقوفة مؤقتاً (مغلق)" : "استقبال التسليمات نشط حالياً (مفتوح)"}</span>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-lg bg-surface font-extrabold shadow-2xs">
                {isPaused ? "استئناف" : "إيقاف مؤقت"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Inline Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-outline/15 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-on-surface-variant">إجمالي التسليمات</span>
            <div className="text-xl font-black text-on-surface">{totalSubmissionsCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">بانتظار التقييم</span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">تم التقييم</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{gradedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Submissions List Grouped by Student */}
      {studentIds.length === 0 ? (
        <div className="p-8 bg-surface-variant/20 border border-outline/15 rounded-3xl text-center space-y-2">
          <AlertCircle className="w-7 h-7 text-outline/50 mx-auto" />
          <p className="text-xs font-semibold text-on-surface-variant">
            لا توجد تسليمات من التلاميذ لهذا النشاط حتى الآن.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {studentIds.map((sId) => {
            const studentSubs = groupedByStudent[sId];
            const primarySub = studentSubs[0]; // Latest submission
            const isAssignment = primarySub.type === "assignment";
            const isGraded = primarySub.status === "graded";

            return (
              <div
                key={sId}
                className={`bg-surface border rounded-3xl p-5 shadow-sm space-y-4 transition-all ${
                  isAssignment && !isGraded
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-outline/15 hover:border-primary/30"
                }`}
              >
                {/* Student Row Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 ${
                        isAssignment ? "bg-secondary/10 text-secondary" : "bg-tertiary/10 text-tertiary"
                      }`}
                    >
                      {(primarySub.studentName || "ت").charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-extrabold text-on-surface">
                          {primarySub.studentName}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            isAssignment
                              ? "bg-secondary/10 text-secondary border-secondary/20"
                              : "bg-tertiary/10 text-tertiary border-tertiary/20"
                          }`}
                        >
                          {isAssignment ? "واجب تطبيق" : "اختبار تفاعلي"}
                        </span>
                        {studentSubs.length > 1 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-variant text-on-surface-variant">
                            {studentSubs.length} تسليمات
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-on-surface-variant/70 block dir-ltr text-right" dir="ltr">
                        {primarySub.studentEmail || "بدون بريد"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span
                      className={`text-[11px] font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5 ${
                        isGraded
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      }`}
                    >
                      {isGraded ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>علامة المادة: {primarySub.score}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>بانتظار تقييمك</span>
                        </>
                      )}
                    </span>

                    {/* Action Button: Trigger Modal for Assignment or Show Score for Quiz */}
                    {isAssignment ? (
                      <button
                        type="button"
                        onClick={() => handleOpenGradingModal(primarySub)}
                        className={`h-9 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                          isGraded
                            ? "bg-surface-variant/50 text-on-surface hover:bg-surface-variant border border-outline/20"
                            : "bg-amber-500 text-white hover:bg-amber-600 shadow-2xs"
                        }`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>{isGraded ? "تعديل التقييم" : "تقييم الإجابة"}</span>
                      </button>
                    ) : (
                      <span className="text-xs font-black text-tertiary bg-tertiary/10 border border-tertiary/20 px-3 py-1 rounded-xl flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-tertiary" />
                        <span>{primarySub.score}</span>
                      </span>
                    )}

                    {/* Task B: Allow Resubmission Button */}
                    {isAssignment && (
                      <button
                        type="button"
                        onClick={() => handleAllowResubmission(primarySub.id)}
                        disabled={primarySub.canResubmit}
                        className={`h-9 px-3 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 border ${
                          primarySub.canResubmit
                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 cursor-default"
                            : "bg-surface-variant/40 hover:bg-indigo-500/10 text-on-surface hover:text-indigo-400 border-outline/20"
                        }`}
                        title="السماح للتلميذ برفع إجابة جديدة"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{primarySub.canResubmit ? "مسموح بالإعادة" : "السماح بالإعادة"}</span>
                      </button>
                    )}

                    {/* Task B: Red Delete Submission Button */}
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmSubId(primarySub.id)}
                      className="h-9 px-3 rounded-xl font-bold text-xs text-error hover:bg-error/10 border border-error/20 transition-all flex items-center gap-1.5"
                      title="حذف تسليم التلميذ نهائياً"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>

                {/* Submission Content Details (CSS Grid Gallery) */}
                {isAssignment ? (
                  <div className="space-y-3 pt-1 text-xs">
                    {(() => {
                      const subUrls: string[] = Array.isArray(primarySub.contentUrls) && primarySub.contentUrls.length > 0
                        ? primarySub.contentUrls
                        : primarySub.content
                        ? String(primarySub.content).split(",").map((s) => s.trim()).filter(Boolean)
                        : [];

                      if (subUrls.length === 0) return null;

                      return (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-on-surface-variant block">
                            ملفات وإجابات الواجب المرفقة ({subUrls.length}):
                          </span>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {subUrls.map((url, uIdx) => {
                              const pdf = url.toLowerCase().split("?")[0].endsWith(".pdf") || url.includes("/pdf/") || url.startsWith("data:application/pdf");
                              return (
                                <div
                                  key={uIdx}
                                  className="relative group rounded-2xl overflow-hidden border border-outline/15 bg-surface-variant/20 shadow-2xs aspect-4/3 flex flex-col justify-between"
                                >
                                  {pdf ? (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="w-full h-full flex flex-col items-center justify-center p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-center hover:bg-amber-500/20 transition-colors"
                                    >
                                      <FileText className="w-7 h-7 mb-1" />
                                      <span className="text-[10px] font-bold truncate max-w-full">
                                        معاينة مستند PDF #{uIdx + 1}
                                      </span>
                                    </a>
                                  ) : (
                                    <div
                                      onClick={() => {
                                        const imageOnlyUrls = subUrls.filter(
                                          (u) =>
                                            !u.toLowerCase().split("?")[0].endsWith(".pdf") &&
                                            !u.includes("/pdf/") &&
                                            !u.startsWith("data:application/pdf")
                                        );
                                        const clickedIdx = imageOnlyUrls.indexOf(url);
                                        setAdminLightboxSlides(imageOnlyUrls.map((src) => ({ src })));
                                        setAdminLightboxIndex(clickedIdx >= 0 ? clickedIdx : 0);
                                        setAdminLightboxOpen(true);
                                      }}
                                      className="w-full h-full block cursor-pointer group"
                                      title="انقر لتكبير ومعاينة الصفحة (Lightbox Zoom)"
                                    >
                                      <img
                                        src={url}
                                        alt={`صفحة الواجب #${uIdx + 1}`}
                                        className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-all duration-300"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="p-2 rounded-full bg-surface/90 text-primary shadow-lg">
                                          <ZoomIn className="w-5 h-5" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-2xs">
                                    #{uIdx + 1}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {primarySub.notes && (
                      <p className="text-on-surface-variant bg-surface-variant/30 p-2.5 rounded-xl font-medium">
                        ملاحظات التلميذ: {primarySub.notes}
                      </p>
                    )}

                    {isGraded && primarySub.feedback && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                        <span className="font-bold block text-[11px] mb-0.5">ملاحظات الأستاذ المرصودة:</span>
                        <p className="font-medium text-xs">{primarySub.feedback}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant/80 font-medium">
                    تم إجراء الاختبار التفاعلي ورصد النتيجة المحسوبة آلياً بنجاح.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task C: The Dedicated Assignment Grading Modal */}
      {selectedSubForGrading && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          dir="rtl"
          onClick={handleCloseModal}
        >
          <div
            className="bg-surface border border-outline/20 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline/15 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">تقييم واجب التلميذ (من 20)</h3>
                  <p className="text-xs text-on-surface-variant">{selectedSubForGrading.studentName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="w-9 h-9 rounded-full bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs">
              {/* Drive Link Button */}
              {selectedSubForGrading.content && (
                <div className="p-3.5 rounded-2xl bg-surface-variant/20 border border-outline/10 flex items-center justify-between gap-3">
                  <span className="font-mono text-primary truncate max-w-xs dir-ltr" dir="ltr">
                    {selectedSubForGrading.content}
                  </span>
                  <a
                    href={selectedSubForGrading.content}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-3.5 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح رابط الواجب</span>
                  </a>
                </div>
              )}

              {/* Student Notes */}
              {selectedSubForGrading.notes && (
                <div className="p-3 rounded-xl bg-surface-variant/30 border border-outline/10 space-y-1">
                  <span className="font-bold text-on-surface-variant">ملاحظات التلميذ مع الإجابة:</span>
                  <p className="text-on-surface font-medium">{selectedSubForGrading.notes}</p>
                </div>
              )}

              {/* MD3 Score Input (Max 20) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-on-surface flex items-center justify-between">
                  <span>التقييم والعلامة (من 20) <span className="text-error">*</span></span>
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold">{modalScore} / 20</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={modalScore}
                  onChange={(e) => {
                    let val = parseFloat(e.target.value);
                    if (isNaN(val)) setModalScore("");
                    else if (val > 20) setModalScore(20);
                    else if (val < 0) setModalScore(0);
                    else setModalScore(val);
                  }}
                  placeholder="أدخل عدد النقاط (مثال: 18)"
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-bold text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {/* MD3 Feedback Textarea */}
              <div className="space-y-1.5">
                <label className="block font-bold text-on-surface">ملاحظات وتوجيهات الأستاذ (تظهر للتلميذ)</label>
                <textarea
                  value={modalFeedback}
                  onChange={(e) => setModalFeedback(e.target.value)}
                  rows={3}
                  placeholder="أدخل توجيهاتك أو الملاحظات التصحيحية للتلميذ حول حله..."
                  className="w-full p-3.5 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-medium text-xs focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-outline/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSaving}
                className="h-11 px-5 rounded-xl bg-surface-variant/40 text-on-surface-variant font-bold text-xs hover:bg-surface-variant transition-colors"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleSaveGrading}
                disabled={isSaving}
                className="h-11 px-6 rounded-xl bg-primary text-on-primary font-extrabold text-xs hover:bg-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ التقييم...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ التقييم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Overlay */}
      {deleteConfirmSubId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-outline/20 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto border border-error/20">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-on-surface">حذف تسليم التلميذ نهائياً</h3>
              <p className="text-xs text-on-surface-variant/80">
                هل أنت أستاذ متأكد من رغبتك في حذف هذا التسليم نهائياً؟ لا يمكن التراجع عن هذه العملية بعد التأكيد.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSubId(null)}
                className="px-4 py-2 rounded-xl bg-surface-variant text-on-surface text-xs font-bold hover:bg-surface-variant/80 transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSubmission(deleteConfirmSubId)}
                className="px-4 py-2 rounded-xl bg-error text-on-error text-xs font-bold hover:bg-error/90 transition-all shadow-sm"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Lightbox Modal with Zoom & Counter */}
      <Lightbox
        open={adminLightboxOpen}
        close={() => setAdminLightboxOpen(false)}
        index={adminLightboxIndex}
        slides={adminLightboxSlides}
        plugins={[Zoom, Counter]}
      />
    </div>
  );
}

export default ActivitySubmissionsList;

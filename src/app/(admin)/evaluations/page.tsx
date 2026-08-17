"use client";

import React, { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  ClipboardCheck,
  FileText,
  HelpCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Search,
  Loader2,
  Save,
  Filter,
  Users,
  Award,
  MessageSquare,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export interface SubmissionItem {
  id: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  courseId: string;
  activityId: string;
  activityTitle: string;
  type: "assignment" | "quiz";
  content?: string;
  notes?: string;
  score?: string | number | null;
  maxScore?: number;
  answers?: Record<string, any>;
  feedback?: string | null;
  status: "pending" | "graded";
  submittedAt?: any;
  updatedAt?: any;
  gradedAt?: any;
}

export default function AdminEvaluationsPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();

  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "quiz" | "graded">("all");

  // Edit State for Assignments Grading
  const [editingScore, setEditingScore] = useState<Record<string, string>>({});
  const [editingFeedback, setEditingFeedback] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  // Admin Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user || !userData) {
        router.replace("/login");
      } else {
        const role = String(userData.role || "").trim().toLowerCase();
        if (role !== "admin") {
          router.replace("/dashboard");
        }
      }
    }
  }, [user, userData, authLoading, router]);

  // Fetch Submissions
  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const subsRef = collection(db, "submissions");
      let snap;
      try {
        const q = query(subsRef, orderBy("submittedAt", "desc"));
        snap = await getDocs(q);
      } catch (err) {
        console.warn("Index fallback for submissions:", err);
        snap = await getDocs(subsRef);
      }

      const list: SubmissionItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SubmissionItem, "id">),
      }));

      // Sort client-side if fallback
      list.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        return timeB - timeA;
      });

      setSubmissions(list);

      // Initialize editing states
      const scoresMap: Record<string, string> = {};
      const feedbackMap: Record<string, string> = {};
      list.forEach((sub) => {
        if (sub.type === "assignment") {
          scoresMap[sub.id] = sub.score ? String(sub.score) : "";
          feedbackMap[sub.id] = sub.feedback ? String(sub.feedback) : "";
        }
      });
      setEditingScore(scoresMap);
      setEditingFeedback(feedbackMap);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData && String(userData.role).toLowerCase() === "admin") {
      fetchSubmissions();
    }
  }, [userData]);

  const handleSaveGrade = async (subId: string) => {
    const scoreVal = editingScore[subId] || "";
    const feedbackVal = editingFeedback[subId] || "";

    if (!scoreVal.trim()) {
      alert("يرجى إدخال العلامة أو النتيجة أولاً.");
      return;
    }

    setSavingId(subId);
    setSavedSuccessId(null);

    try {
      const docRef = doc(db, "submissions", subId);
      await updateDoc(docRef, {
        score: scoreVal.trim(),
        feedback: feedbackVal.trim(),
        status: "graded",
        gradedAt: serverTimestamp(),
      });

      // Universal ID Extractor
      const subToGrade = submissions.find((s) => s.id === subId);
      const targetUserId = String(
        subToGrade?.studentId ||
          (subToGrade as any)?.userId ||
          (subToGrade as any)?.uid ||
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
            message: `لقد تم تصحيح إجابتك ومنحك علامة ${scoreVal.trim()}. راجع ملاحظات الأستاذ.`,
            isRead: false,
            createdAt: serverTimestamp(),
            relatedActivityId: subToGrade?.activityId || "",
          });
        } catch (notifErr) {
          console.error("❌ ERROR writing notification to Firestore:", notifErr);
        }
      } else {
        console.error("❌ CRITICAL: Could not find any student/user ID on this submission to notify!", subToGrade);
      }

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === subId
            ? { ...s, score: scoreVal.trim(), feedback: feedbackVal.trim(), status: "graded" }
            : s
        )
      );

      setSavedSuccessId(subId);
      setTimeout(() => setSavedSuccessId(null), 3000);
    } catch (error) {
      console.error("Error saving grade evaluation:", error);
      alert("حدث خطأ أثناء حفظ التقييم.");
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading || (loading && !submissions.length)) {
    return (
      <div className="p-16 text-center space-y-3" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="text-sm font-semibold text-on-surface-variant">جاري تحميل منصة التقييم والتصحيح...</p>
      </div>
    );
  }

  // Filter Submissions
  const filteredSubmissions = submissions.filter((sub) => {
    // Search query match
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (sub.studentName || "").toLowerCase().includes(q) ||
      (sub.studentEmail || "").toLowerCase().includes(q) ||
      (sub.activityTitle || "").toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Category filter
    if (activeFilter === "pending") return sub.type === "assignment" && sub.status === "pending";
    if (activeFilter === "quiz") return sub.type === "quiz";
    if (activeFilter === "graded") return sub.status === "graded";
    return true; // 'all'
  });

  const totalCount = submissions.length;
  const pendingCount = submissions.filter((s) => s.type === "assignment" && s.status === "pending").length;
  const quizCount = submissions.filter((s) => s.type === "quiz").length;
  const gradedCount = submissions.filter((s) => s.status === "graded").length;

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <ClipboardCheck className="w-4 h-4" />
              <span>منصة تصحيح الواجبات والاختبارات</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              تقييمات وتسليمات التلاميذ
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant/80">
              راجع إجابات الواجبات المسلمة ورصد الدرجات والملاحظات للتلاميذ بكل سهولة.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSubmissions}
            className="h-11 px-4 rounded-xl border border-outline/20 bg-surface-variant/30 text-on-surface font-bold text-xs hover:bg-surface-variant/60 transition-colors shrink-0 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span>تحديث القائمة</span>
          </button>
        </div>

        {/* Counter Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-surface-variant/30 border border-outline/10 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-on-surface-variant">إجمالي التسليمات</span>
            <div className="text-lg font-black text-on-surface">{totalCount}</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">واجبات معلقة</span>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400">{pendingCount}</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-tertiary/10 border border-tertiary/20 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-tertiary">اختبارات تفاعلية</span>
            <div className="text-lg font-black text-tertiary">{quizCount}</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">تم تصحيحها</span>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{gradedCount}</div>
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Category Filter Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-surface border border-outline/15 rounded-3xl p-4 shadow-sm">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-on-surface-variant/70 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم التلميذ أو النشاط..."
            className="w-full h-11 pr-10 pl-4 rounded-2xl bg-surface-variant/40 border border-outline/20 text-on-surface text-xs focus:outline-none focus:border-primary font-medium"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3.5 h-9 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === "all"
                ? "bg-primary text-on-primary shadow-2xs"
                : "bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            الكل ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("pending")}
            className={`px-3.5 h-9 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === "pending"
                ? "bg-amber-500 text-white shadow-2xs"
                : "bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            واجبات معلقة ({pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("quiz")}
            className={`px-3.5 h-9 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === "quiz"
                ? "bg-tertiary text-on-tertiary shadow-2xs"
                : "bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            اختبارات تفاعلية ({quizCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("graded")}
            className={`px-3.5 h-9 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeFilter === "graded"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            تم تصحيحها ({gradedCount})
          </button>
        </div>
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="bg-surface border border-outline/15 rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <AlertCircle className="w-8 h-8 text-outline/50 mx-auto" />
          <h3 className="text-sm font-bold text-on-surface">لا توجد تسليمات تطابق الفلتر المختار</h3>
          <p className="text-xs text-on-surface-variant/80">عندما يقوم التلاميذ بتسليم الواجبات أو حل الاختبارات، ستظهر إجاباتهم هنا لتصحيحها.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((sub) => {
            const isAssignment = sub.type === "assignment";
            const isGraded = sub.status === "graded";

            return (
              <div
                key={sub.id}
                className={`bg-surface border rounded-3xl p-6 shadow-sm transition-all space-y-4 ${
                  isAssignment && !isGraded
                    ? "border-amber-500/30 hover:border-amber-500/60"
                    : "border-outline/15 hover:border-primary/30"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 ${
                        isAssignment
                          ? "bg-secondary/10 text-secondary"
                          : "bg-tertiary/10 text-tertiary"
                      }`}
                    >
                      {(sub.studentName || "ت").charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-extrabold text-on-surface">
                          {sub.studentName || "تلميذ مسجل"}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${
                            isAssignment
                              ? "bg-secondary/10 text-secondary border-secondary/20"
                              : "bg-tertiary/10 text-tertiary border-tertiary/20"
                          }`}
                        >
                          {isAssignment ? "واجب تطبيق" : "اختبار تفاعلي"}
                        </span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant/70 block dir-ltr text-right" dir="ltr">
                        {sub.studentEmail || "بدون بريد"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-bold text-on-surface-variant">
                      النشاط: <strong className="text-on-surface">{sub.activityTitle}</strong>
                    </span>

                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5 ${
                        isGraded
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      }`}
                    >
                      {isGraded ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>مصحي ({sub.score})</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>معلق - في انتظارك</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Submitting Body depending on type */}
                {isAssignment ? (
                  /* Assignment Submission Details & Grading Inputs */
                  <div className="space-y-4 pt-1">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface-variant/20 border border-outline/10">
                      <div className="space-y-1 truncate max-w-xl">
                        <span className="text-xs font-bold text-on-surface block">رابط الإجابة المسلّم من الطالب:</span>
                        <span className="text-xs font-mono text-primary dir-ltr block truncate" dir="ltr">
                          {sub.content || "لا يوجد رابط"}
                        </span>
                      </div>

                      {sub.content && (
                        <a
                          href={sub.content}
                          target="_blank"
                          rel="noreferrer"
                          className="h-10 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>فتح رابط الواجب</span>
                        </a>
                      )}
                    </div>

                    {sub.notes && (
                      <div className="p-3.5 rounded-xl bg-surface-variant/30 border border-outline/10 space-y-1">
                        <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>ملاحظات التلميذ:</span>
                        </span>
                        <p className="text-xs text-on-surface leading-relaxed font-medium">{sub.notes}</p>
                      </div>
                    )}

                    {/* Teacher Grading Box */}
                    <div className="p-4 rounded-2xl bg-surface-variant/40 border border-primary/20 space-y-3">
                      <span className="text-xs font-extrabold text-primary flex items-center gap-1.5">
                        <Award className="w-4 h-4" />
                        <span>رصد درجة التقييم والملاحظات للتلميذ:</span>
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-4 space-y-1">
                          <label className="block text-[11px] font-bold text-on-surface-variant">
                            الدرجة / العلامة <span className="text-error">*</span>
                          </label>
                          <input
                            type="text"
                            value={editingScore[sub.id] || ""}
                            onChange={(e) =>
                              setEditingScore((prev) => ({ ...prev, [sub.id]: e.target.value }))
                            }
                            placeholder="مثال: 18 / 20 أو ممتاز"
                            className="w-full h-11 px-3.5 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                          />
                        </div>

                        <div className="sm:col-span-8 space-y-1">
                          <label className="block text-[11px] font-bold text-on-surface-variant">
                            توجيهات وملاحظات الأستاذ (تظهر للتلميذ)
                          </label>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingFeedback[sub.id] || ""}
                              onChange={(e) =>
                                setEditingFeedback((prev) => ({ ...prev, [sub.id]: e.target.value }))
                              }
                              placeholder="أدخل ملاحظاتك وتوجيهاتك للتلميذ حول إجابته..."
                              className="flex-1 h-11 px-3.5 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs font-medium focus:outline-none focus:border-primary"
                            />

                            <button
                              type="button"
                              onClick={() => handleSaveGrade(sub.id)}
                              disabled={savingId === sub.id}
                              className="h-11 px-5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                            >
                              {savingId === sub.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : savedSuccessId === sub.id ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              <span>{savedSuccessId === sub.id ? "تم الحفظ!" : "حفظ التقييم"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Quiz Submission Details (Auto-graded) */
                  <div className="p-4 rounded-2xl bg-surface-variant/20 border border-outline/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-on-surface">نتيجة الاختبار التفاعلي المحسوبة آلياً:</span>
                      <p className="text-xs text-on-surface-variant/80">
                        قام التلميذ بحل الاختبار المكون من {sub.maxScore || "عدة"} أسئلة.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">النتيجة:</span>
                      <span className="text-sm font-black text-tertiary bg-tertiary/10 border border-tertiary/20 px-4 py-1.5 rounded-xl">
                        {sub.score}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

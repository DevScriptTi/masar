"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getCourseById, CourseDoc, ActivityDoc } from "@/src/lib/firebase/coursesService";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import {
  ChevronLeft,
  Search,
  CheckCircle2,
  Clock,
  Save,
  Loader2,
  Sparkles,
  User,
  Image as ImageIcon,
  MessageSquare,
  Award,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Layers,
  ZoomIn,
  RefreshCw,
} from "lucide-react";

export interface StationSubmissionItem {
  stationId: string;
  stationTitle?: string;
  order?: number;
  content?: string;
  images?: string[];
  contentUrls?: string[];
  aiFeedback?: string;
  teacherComment?: string;
}

export interface ActivitySubmissionDoc {
  id: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  courseId: string;
  activityId: string;
  activityTitle?: string;
  type?: string;
  content?: string;
  contentUrls?: string[];
  score?: number | string | null;
  maxScore?: number;
  feedback?: string | null;
  finalAiEvaluation?: string | null;
  stationSubmissions?: StationSubmissionItem[];
  status: "pending" | "graded";
  submittedAt?: any;
  gradedAt?: any;
}

export default function ActivityGradingPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const activityId = resolvedParams.activityId;

  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [activity, setActivity] = useState<ActivityDoc | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmissionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Master Sidebar States
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "graded">("all");

  // Detail Grader Form States
  const [finalScore, setFinalScore] = useState<number | string>(18);
  const [generalFeedback, setGeneralFeedback] = useState<string>("");
  const [stationComments, setStationComments] = useState<Record<string, string>>({});
  const [expandedStations, setExpandedStations] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSlides, setLightboxSlides] = useState<Array<{ src: string }>>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cData, actSnap, subsSnap, usersSnap] = await Promise.all([
        getCourseById(courseId),
        getDoc(doc(db, "activities", activityId)),
        getDocs(query(collection(db, "submissions"), where("activityId", "==", activityId))),
        getDocs(collection(db, "users")),
      ]);

      if (cData) setCourse(cData);
      if (actSnap.exists()) {
        setActivity({ id: actSnap.id, ...actSnap.data() } as ActivityDoc);
      }

      const usersMap: Record<string, { name: string; email: string }> = {};
      usersSnap.docs.forEach((d) => {
        const u = d.data();
        usersMap[d.id] = {
          name: u.fullName || u.displayName || u.email?.split("@")[0] || "تلميذ مسجل",
          email: u.email || "",
        };
      });

      const parsed: ActivitySubmissionDoc[] = subsSnap.docs.map((d) => {
        const data = d.data();
        const sId = String(data.studentId || data.userId || data.uid || "").trim();
        const uInfo = usersMap[sId];
        return {
          id: d.id,
          studentId: sId,
          studentName: uInfo?.name || data.studentName || "تلميذ مسجل",
          studentEmail: uInfo?.email || data.studentEmail || "",
          courseId: data.courseId || courseId,
          activityId: data.activityId || activityId,
          activityTitle: data.activityTitle || "",
          type: data.type || "assignment",
          content: data.content || "",
          contentUrls: data.contentUrls || [],
          score: data.score !== undefined ? data.score : null,
          maxScore: data.maxScore || 20,
          feedback: data.feedback || "",
          finalAiEvaluation: data.finalAiEvaluation || data.aiEvaluation || data.aiSummary || null,
          stationSubmissions: data.stationSubmissions || [],
          status: data.status === "graded" ? "graded" : "pending",
          submittedAt: data.submittedAt,
          gradedAt: data.gradedAt,
        };
      });

      parsed.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        return timeB - timeA;
      });

      setSubmissions(parsed);

      if (parsed.length > 0 && !selectedSubId) {
        setSelectedSubId(parsed[0].id);
      }
    } catch (err) {
      console.error("Error loading submissions data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courseId, activityId]);

  // Currently Selected Submission
  const selectedSub = useMemo(() => {
    return submissions.find((s) => s.id === selectedSubId) || null;
  }, [submissions, selectedSubId]);

  // Sync Form State when selected submission changes
  useEffect(() => {
    if (selectedSub) {
      setFinalScore(selectedSub.score !== null && selectedSub.score !== undefined ? selectedSub.score : 18);
      setGeneralFeedback(selectedSub.feedback || "");

      const initialComments: Record<string, string> = {};
      const initialExpand: Record<string, boolean> = {};

      if (selectedSub.stationSubmissions && selectedSub.stationSubmissions.length > 0) {
        selectedSub.stationSubmissions.forEach((st, idx) => {
          const key = st.stationId || `st_${idx}`;
          initialComments[key] = st.teacherComment || "";
          initialExpand[key] = true;
        });
      } else if (activity?.stations && activity.stations.length > 0) {
        activity.stations.forEach((st) => {
          initialComments[st.id] = "";
          initialExpand[st.id] = true;
        });
      }

      setStationComments(initialComments);
      setExpandedStations(initialExpand);
    }
  }, [selectedSubId, selectedSub, activity]);

  // Filter Submissions for Master Sidebar
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchesSearch =
        !searchQuery.trim() ||
        sub.studentName?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        sub.studentEmail?.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && sub.status === "pending") ||
        (statusFilter === "graded" && sub.status === "graded");

      return matchesSearch && matchesStatus;
    });
  }, [submissions, searchQuery, statusFilter]);

  // Counts
  const pendingCount = useMemo(() => submissions.filter((s) => s.status === "pending").length, [submissions]);
  const gradedCount = useMemo(() => submissions.filter((s) => s.status === "graded").length, [submissions]);

  // Computed Stations to display for the detail area
  const displayStations = useMemo(() => {
    if (!selectedSub) return [];

    if (selectedSub.stationSubmissions && selectedSub.stationSubmissions.length > 0) {
      return selectedSub.stationSubmissions.map((st, idx) => {
        const matchedActStation = activity?.stations?.find((s) => s.id === st.stationId);
        return {
          stationId: st.stationId || `st_${idx}`,
          stationTitle: st.stationTitle || matchedActStation?.title || `المحطة #${idx + 1}`,
          order: st.order || matchedActStation?.order || idx + 1,
          content: matchedActStation?.content || st.content || "",
          images: st.images || st.contentUrls || (idx === 0 ? selectedSub.contentUrls : []) || [],
          aiFeedback: st.aiFeedback || (idx === 0 ? selectedSub.finalAiEvaluation : null) || "",
          teacherComment: stationComments[st.stationId || `st_${idx}`] || st.teacherComment || "",
        };
      });
    }

    if (activity?.stations && activity.stations.length > 0) {
      return activity.stations.map((st, idx) => ({
        stationId: st.id,
        stationTitle: st.title || `المحطة #${idx + 1}`,
        order: st.order || idx + 1,
        content: st.content || "",
        images: idx === 0 ? selectedSub.contentUrls || [] : [],
        aiFeedback: idx === 0 ? selectedSub.finalAiEvaluation || "" : "",
        teacherComment: stationComments[st.id] || "",
      }));
    }

    return [
      {
        stationId: "default_st",
        stationTitle: "مخرجات وتسليم التلميذ",
        order: 1,
        content: selectedSub.content || "",
        images: selectedSub.contentUrls || [],
        aiFeedback: selectedSub.finalAiEvaluation || "",
        teacherComment: stationComments["default_st"] || "",
      },
    ];
  }, [selectedSub, activity, stationComments]);

  // Save Grade Handler
  const handleSaveGrade = async () => {
    if (!selectedSub) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updatedStationSubmissions = displayStations.map((st) => ({
        stationId: st.stationId,
        stationTitle: st.stationTitle,
        order: st.order,
        images: st.images,
        aiFeedback: st.aiFeedback,
        teacherComment: stationComments[st.stationId] || "",
      }));

      const numScore = Number(finalScore);

      await updateDoc(doc(db, "submissions", selectedSub.id), {
        score: isNaN(numScore) ? finalScore : numScore,
        scoreValue: isNaN(numScore) ? 0 : numScore,
        maxScore: 20,
        feedback: generalFeedback,
        stationSubmissions: updatedStationSubmissions,
        status: "graded",
        gradedAt: serverTimestamp(),
      });

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === selectedSub.id
            ? {
                ...s,
                score: isNaN(numScore) ? finalScore : numScore,
                feedback: generalFeedback,
                stationSubmissions: updatedStationSubmissions,
                status: "graded",
              }
            : s
        )
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving submission grade:", err);
      alert("حدث خطأ أثناء حفظ التقييم.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAccordion = (stId: string) => {
    setExpandedStations((prev) => ({
      ...prev,
      [stId]: !prev[stId],
    }));
  };

  const handleOpenImage = (images: string[], index: number) => {
    setLightboxSlides(images.map((img) => ({ src: img })));
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "بدون تاريخ";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12" dir="rtl">
      {/* Top Header & RTL Breadcrumbs */}
      <header className="bg-surface border border-outline/15 rounded-3xl p-4 sm:px-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant flex-wrap">
          <Link href="/teacher/courses" className="hover:text-primary hover:underline transition-colors shrink-0">
            إدارة الدورات
          </Link>
          <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />
          <Link href={`/teacher/courses/${courseId}`} className="hover:text-primary hover:underline transition-colors truncate max-w-[140px]">
            {course?.title || "مصمم الدورة"}
          </Link>
          <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />
          <Link href={`/teacher/courses/${courseId}/activities/${activityId}`} className="hover:text-primary hover:underline transition-colors truncate max-w-[140px]">
            {activity?.title || "النشاط التعليمي"}
          </Link>
          <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />
          <span aria-current="page" className="text-on-surface font-bold">
            مصمم تقييم تسليمات المحطات
          </span>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchData();
            }}
            className="px-3.5 h-9 rounded-xl bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </header>

      {/* Main Master-Detail Layout */}
      {loading ? (
        <div className="p-16 text-center bg-surface border border-outline/15 rounded-3xl space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs font-bold text-on-surface-variant">جاري تحميل التسليمات ومخرجات المحطات...</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Master Sidebar: Student Submissions List */}
          <aside className="w-full lg:w-80 xl:w-96 shrink-0 bg-surface border border-outline/15 rounded-3xl p-4 space-y-4 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-outline/10 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-extrabold text-on-surface">قائمة تسليمات التلاميذ</h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {submissions.length} تسليم
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-on-surface-variant absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم التلميذ..."
                  className="w-full h-9 pr-9 pl-3 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 p-1 bg-surface-variant/30 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    statusFilter === "all" ? "bg-surface text-primary shadow-2xs font-extrabold" : "text-on-surface-variant"
                  }`}
                >
                  الكل ({submissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("pending")}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    statusFilter === "pending" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold" : "text-on-surface-variant"
                  }`}
                >
                  قيد المراجعة ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("graded")}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    statusFilter === "graded" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold" : "text-on-surface-variant"
                  }`}
                >
                  تم التقييم ({gradedCount})
                </button>
              </div>
            </div>

            {/* Scrollable Student List */}
            <div className="space-y-2 max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
              {filteredSubmissions.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-outline/20 rounded-2xl space-y-1.5">
                  <AlertCircle className="w-6 h-6 text-on-surface-variant/50 mx-auto" />
                  <p className="text-xs font-bold text-on-surface-variant">لم يتم العثور على تسليمات مضللة</p>
                </div>
              ) : (
                filteredSubmissions.map((sub) => {
                  const isSelected = sub.id === selectedSubId;
                  const isGraded = sub.status === "graded";

                  return (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedSubId(sub.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs"
                          : "bg-surface-variant/20 border-outline/15 hover:border-primary/40 hover:bg-surface-variant/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-xs shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <h3 className="text-xs font-bold text-on-surface truncate">{sub.studentName}</h3>
                            <span className="text-[10px] text-on-surface-variant/70 block truncate" dir="ltr">
                              {sub.studentEmail || "تلميذ مسجل"}
                            </span>
                          </div>
                        </div>

                        {/* Status Dot / Badge */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isGraded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{sub.score !== null ? `${sub.score}/20` : "مقيّم"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>قيد المراجعة</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-on-surface-variant/70 pt-1 border-t border-outline/10">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(sub.submittedAt)}</span>
                        </span>
                        {sub.stationSubmissions && sub.stationSubmissions.length > 0 && (
                          <span className="font-bold text-primary">
                            {sub.stationSubmissions.length} محطات
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Main Content Area: Detail Grader UI */}
          <main className="flex-1 w-full bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-6">
            {!selectedSub ? (
              <div className="p-16 text-center space-y-3">
                <User className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
                <h3 className="text-base font-bold text-on-surface">اختر تلميذاً من القائمة المجاورة لبدء التقييم</h3>
                <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                  تتيح هذه الصفحة استعراض إجابات التلميذ عبر كافة محطات النشاط بالتفصيل ومراجعة تقييم المساعد الذكي ورصد العلامة النهائية.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header: Student Info & Final Grade Controls */}
                <div className="p-5 rounded-2xl bg-surface-variant/30 border border-outline/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary font-extrabold text-base flex items-center justify-center shadow-xs">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-extrabold text-on-surface">{selectedSub.studentName}</h2>
                        {selectedSub.status === "graded" ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تم التقييم</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>قيد المراجعة</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant/80 mt-0.5">
                        تاريخ التسليم: {formatDate(selectedSub.submittedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Final Grade Input & Mark as Reviewed Action */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-surface p-2 rounded-xl border border-outline/30 shadow-2xs">
                      <label className="text-xs font-bold text-on-surface shrink-0">العلامة النهائية:</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={finalScore}
                        onChange={(e) => setFinalScore(e.target.value)}
                        className="w-16 h-9 px-2 rounded-lg bg-surface-variant/40 border border-outline/30 text-on-surface text-center font-extrabold text-sm focus:outline-none focus:border-primary"
                      />
                      <span className="text-xs font-bold text-on-surface-variant">/ 20</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveGrade}
                      disabled={isSaving}
                      className="px-5 h-11 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري حفظ التقييم...</span>
                        </>
                      ) : saveSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                          <span>تم حفظ التقييم بنجاح!</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>حفظ التقييم وإكمال المراجعة</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* AI Global Assessment Card */}
                {selectedSub.finalAiEvaluation && (
                  <div className="p-5 rounded-3xl bg-indigo-950/20 border border-indigo-500/30 space-y-3 relative shadow-2xs">
                    <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                          التقييم الشامل المولد بواسطة المساعد الذكي (AI Global Assessment)
                        </h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20">
                        مجموع المحطات
                      </span>
                    </div>

                    <p className="text-xs text-on-surface leading-relaxed whitespace-pre-line font-medium bg-surface/40 p-4 rounded-2xl border border-outline/10">
                      {selectedSub.finalAiEvaluation}
                    </p>
                  </div>
                )}

                {/* Station Timeline Accordions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-outline/10 pb-3">
                    <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      <span>تفاصيل إجابات التلميذ عبر محطات النشاط ({displayStations.length} محطات)</span>
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {displayStations.map((st, idx) => {
                      const isExpanded = expandedStations[st.stationId] ?? true;
                      const hasImages = st.images && st.images.length > 0;

                      return (
                        <div
                          key={st.stationId}
                          className="rounded-2xl border border-outline/20 overflow-hidden bg-surface-variant/10 transition-all shadow-2xs"
                        >
                          {/* Accordion Header */}
                          <div
                            onClick={() => handleToggleAccordion(st.stationId)}
                            className="p-4 bg-surface-variant/30 flex items-center justify-between gap-3 cursor-pointer select-none border-b border-outline/10 hover:bg-surface-variant/50 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-xl bg-primary text-on-primary font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {st.order || idx + 1}
                              </span>
                              <h4 className="text-xs font-extrabold text-on-surface">{st.stationTitle}</h4>

                              {hasImages && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-500/20 flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  <span>{st.images!.length} صور مرفقة</span>
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              className="p-1.5 rounded-lg bg-surface text-on-surface-variant hover:text-primary transition-transform"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Accordion Body */}
                          {isExpanded && (
                            <div className="p-5 space-y-4 animate-fadeIn">
                              {/* Station Sub-Task / Focus description */}
                              {st.content && (
                                <div className="p-3 rounded-xl bg-surface border border-outline/10 space-y-1">
                                  <span className="text-[10px] font-bold text-on-surface-variant/70 block">المهمة المطلوبة في هذه المحطة:</span>
                                  <p className="text-xs text-on-surface font-medium">{st.content}</p>
                                </div>
                              )}

                              {/* Student Uploaded Images Grid */}
                              {hasImages ? (
                                <div className="space-y-2">
                                  <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                                    <span>المرفقات والصور المرفوعة من التلميذ:</span>
                                  </span>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {st.images!.map((imgUrl, imgIdx) => (
                                      <div
                                        key={imgIdx}
                                        onClick={() => handleOpenImage(st.images!, imgIdx)}
                                        className="group relative aspect-4/3 rounded-xl overflow-hidden border border-outline/20 bg-surface cursor-pointer hover:border-primary/50 transition-all shadow-2xs"
                                      >
                                        <img
                                          src={imgUrl}
                                          alt={`صورة المحطة #${imgIdx + 1}`}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-bold">
                                          <ZoomIn className="w-4 h-4" />
                                          <span>تكبير الصورة</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 rounded-xl bg-surface-variant/20 border border-outline/10 text-center text-xs text-on-surface-variant/70">
                                  لم يقم التلميذ برفع صور في هذه المحطة.
                                </div>
                              )}

                              {/* AI Specific Feedback for this Station */}
                              {st.aiFeedback && (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-extrabold text-xs">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>ملاحظات وتقييم الذكاء الاصطناعي لهذه المحطة:</span>
                                  </div>
                                  <p className="text-xs text-on-surface leading-relaxed font-medium">
                                    {st.aiFeedback}
                                  </p>
                                </div>
                              )}

                              {/* Teacher Manual Feedback Textarea */}
                              <div className="space-y-1.5 pt-1">
                                <label className="block text-xs font-bold text-on-surface flex items-center gap-1.5">
                                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                                  <span>ملاحظة الأستاذ الخاصة بهذه الخطوة/المحطة (اختياري):</span>
                                </label>
                                <textarea
                                  value={stationComments[st.stationId] || ""}
                                  onChange={(e) =>
                                    setStationComments((prev) => ({
                                      ...prev,
                                      [st.stationId]: e.target.value,
                                    }))
                                  }
                                  rows={2}
                                  placeholder="أدخل توجيهاً أو تصحيحاً خاصاً بهذه المحطة يظهر للتلميذ..."
                                  className="w-full p-3 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs font-medium focus:outline-none focus:border-primary transition-all resize-y"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Lightbox Component for High-Res Image Zooming */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
        plugins={[Zoom, Counter]}
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getCourseById,
  getModulesByCourse,
  getActivitiesByCourse,
  CourseDoc,
  ModuleDoc,
  ActivityDoc,
} from "@/src/lib/firebase/coursesService";
import { fetchGroups } from "@/src/lib/firebase/groupsService";
import { SocraticStationChat } from "@/src/components/student/SocraticStationChat";
import { RealQuizTaker } from "@/src/components/student/RealQuizTaker";
import { MathText } from "@/src/components/admin/activities/StudentPreview";
import { formatPdfEmbedUrl, formatYouTubeUrl } from "@/src/lib/utils/formatters";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NotificationBell } from "@/src/components/student/NotificationBell";
import { AITutorWidget } from "@/src/components/student/AITutorWidget";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/src/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/src/components/ui/accordion";
import {
  ChevronLeft,
  BookOpen,
  Dumbbell,
  Trophy,
  Loader2,
  AlertCircle,
  Layers,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  Video,
  FileText,
  Maximize2,
  Minimize,
  Maximize,
  ExternalLink,
  PlayCircle,
  Play,
  Eye,
  X,
  Menu,
  ListFilter,
} from "lucide-react";

import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function StudentCoursePlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId?: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const routeActivityId = resolvedParams.activityId;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlActivityId = searchParams.get("activityId") || routeActivityId;

  const { user, userData, loading: authLoading } = useAuth();

  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [modules, setModules] = useState<ModuleDoc[]>([]);
  const [activities, setActivities] = useState<ActivityDoc[]>([]);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Time-Bound Access for Revoked Students Rule 3 & 4
  const [isRevokedEnrollment, setIsRevokedEnrollment] = useState(false);
  const [revokedAtDateStr, setRevokedAtDateStr] = useState<string | null>(null);

  // Task A & B: State Management for Modal Overlays & Fullscreen Toggle
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [activeAttachment, setActiveAttachment] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Task C: Mobile Sidebar Toggle Drawer / Sheet State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Student Homework Submission details for AI Tutor Context & Chat History Persistence
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string | undefined>(undefined);
  const [currentAiEvaluationCache, setCurrentAiEvaluationCache] = useState<any>(undefined);
  const [currentSubmissionUrls, setCurrentSubmissionUrls] = useState<string[]>([]);

  // Fetch student submission doc for active activity
  useEffect(() => {
    if (!user?.uid || !activeActivityId) {
      setCurrentSubmissionId(undefined);
      setCurrentAiEvaluationCache(undefined);
      setCurrentSubmissionUrls([]);
      return;
    }

    const fetchCurrentSubmission = async () => {
      try {
        const q = query(
          collection(db, "submissions"),
          where("studentId", "==", user.uid),
          where("activityId", "==", activeActivityId),
          where("type", "==", "assignment")
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const subData: any = docSnap.data();
          setCurrentSubmissionId(docSnap.id);
          setCurrentAiEvaluationCache(subData.aiEvaluationCache || null);

          let parsedUrls: string[] = [];
          if (Array.isArray(subData.contentUrls) && subData.contentUrls.length > 0) {
            parsedUrls = subData.contentUrls;
          } else if (subData.content) {
            parsedUrls = String(subData.content).split(",").map((s) => s.trim()).filter(Boolean);
          }
          setCurrentSubmissionUrls(parsedUrls);
        } else {
          setCurrentSubmissionId(undefined);
          setCurrentAiEvaluationCache(undefined);
          setCurrentSubmissionUrls([]);
        }
      } catch (err) {
        console.error("Error fetching activity submission for AI Tutor:", err);
      }
    };

    fetchCurrentSubmission();
  }, [user?.uid, activeActivityId]);

  // Freshly fetch the full Activity document to guarantee complete stations array and isolation rules
  useEffect(() => {
    if (!activeActivityId) return;
    const fetchFreshActivityDoc = async () => {
      try {
        const snap = await getDoc(doc(db, "activities", activeActivityId));
        if (snap.exists()) {
          const freshData = { id: snap.id, ...(snap.data() as Omit<ActivityDoc, "id">) };
          setActivities((prev) =>
            prev.map((act) => (act.id === activeActivityId ? freshData : act))
          );
        }
      } catch (err) {
        console.warn("Error fetching fresh activity document:", err);
      }
    };
    fetchFreshActivityDoc();
  }, [activeActivityId]);

  useEffect(() => {
    if (!courseId || authLoading) return;

    const loadCoursePlayerData = async () => {
      setLoading(true);
      setAccessDenied(false);

      try {
        const [courseData, modulesData, activitiesData, groupsData] = await Promise.all([
          getCourseById(courseId),
          getModulesByCourse(courseId),
          getActivitiesByCourse(courseId),
          fetchGroups(),
        ]);

        if (!courseData) {
          alert("لم يتم العثور على هذه الدورة التعليمية.");
          router.push("/dashboard");
          return;
        }

        // Extract student group IDs / names from enrollments, groupId, and cohortId
        const studentRawKeys: string[] = [];

        if (userData?.groupId) studentRawKeys.push(String(userData.groupId));
        if (userData?.cohortId) studentRawKeys.push(String(userData.cohortId));
        if (userData?.group) studentRawKeys.push(String(userData.group));
        if (userData?.cohort) studentRawKeys.push(String(userData.cohort));

        if (userData?.enrollments) {
          if (typeof userData.enrollments === "object" && !Array.isArray(userData.enrollments)) {
            studentRawKeys.push(...Object.keys(userData.enrollments));
            Object.values(userData.enrollments).forEach((val: any) => {
              if (val && typeof val === "object") {
                if (val.groupId) studentRawKeys.push(String(val.groupId));
                if (val.id) studentRawKeys.push(String(val.id));
                if (val.groupName) studentRawKeys.push(String(val.groupName));
              } else if (typeof val === "string") {
                studentRawKeys.push(val);
              }
            });
          } else if (Array.isArray(userData.enrollments)) {
            userData.enrollments.forEach((val: any) => {
              if (typeof val === "string") studentRawKeys.push(val);
              else if (val && typeof val === "object" && val.groupId) {
                studentRawKeys.push(String(val.groupId));
              }
            });
          }
        }

        const uniqueKeys = Array.from(new Set(studentRawKeys.filter(Boolean)));

        // Match against groups to get master list of student group tokens (IDs & Names)
        const matchedGroupObjects = groupsData.filter((g) => {
          const gId = String(g.id || "").trim();
          const gName = String(g.name || "").trim();
          return uniqueKeys.some((k) => k === gId || k === gName);
        });

        const masterStudentTokens = new Set<string>(uniqueKeys);
        matchedGroupObjects.forEach((g) => {
          if (g.id) masterStudentTokens.add(String(g.id));
          if (g.name) masterStudentTokens.add(String(g.name));
        });

        const studentTokens = Array.from(masterStudentTokens);
        const studentUid = user?.uid || "";

        // 1. Security Check for Course Access
        if (
          courseData.groupIds &&
          courseData.groupIds.length > 0 &&
          !courseData.groupIds.some((gId) => studentTokens.includes(gId))
        ) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        // Check for Student Revoked Enrollment Rule 3 & 4
        let isRevoked = false;
        let revokedTimestamp: number | null = null;

        if (studentUid) {
          try {
            const enrSnap = await getDocs(query(collection(db, "enrollments"), where("studentId", "==", studentUid)));
            const matchedEnrDoc = enrSnap.docs.find((d) => {
              const data = d.data();
              return courseData.groupIds?.includes(data.groupId) || data.groupId === (courseData as any).groupId;
            });

            if (matchedEnrDoc) {
              const eData = matchedEnrDoc.data();
              if (eData.status === "revoked") {
                isRevoked = true;
                revokedTimestamp = eData.revokedAt || eData.updatedAt || Date.now();
                setRevokedAtDateStr(new Date(revokedTimestamp!).toLocaleDateString("ar-EG"));
              }
            }
          } catch (e) {
            console.warn("Error checking enrollment revoked status:", e);
          }
        }

        setIsRevokedEnrollment(isRevoked);

        // 2. Filter Modules by Visibility & Excluded Students
        const visibleModules = modulesData.filter((m) => {
          if (m.isVisible === false) return false;
          if (m.excludedStudentIds && m.excludedStudentIds.includes(studentUid)) return false;
          if (m.groupIds && m.groupIds.length > 0 && !m.groupIds.some((gId) => studentTokens.includes(gId))) {
            return false;
          }
          return true;
        });

        // 3. Filter Activities by Visibility & Time-Bound Access (Rule 3)
        const visibleActivities = activitiesData.filter((a) => {
          if (a.isVisible === false) return false;
          if (a.excludedStudentIds && a.excludedStudentIds.includes(studentUid)) return false;
          if (a.groupIds && a.groupIds.length > 0 && !a.groupIds.some((gId) => studentTokens.includes(gId))) {
            return false;
          }

          // Rule 3: Revoked students can only see lessons published before/at revocation date
          if (isRevoked && revokedTimestamp) {
            const actCreatedTime = a.createdAt
              ? typeof a.createdAt === "number"
                ? a.createdAt
                : (a.createdAt as any).seconds
                ? (a.createdAt as any).seconds * 1000
                : Date.now()
              : 0;

            if (actCreatedTime > revokedTimestamp) {
              return false;
            }
          }

          return true;
        });

        setCourse(courseData);
        setModules(visibleModules);
        setActivities(visibleActivities);

        // 4. Auto-select requested url/route activity or first available activity
        let selectedId: string | null = null;
        if (urlActivityId && visibleActivities.some((a) => a.id === urlActivityId)) {
          selectedId = urlActivityId;
        } else if (visibleActivities.length > 0) {
          selectedId = visibleActivities[0].id!;
        }

        if (selectedId) {
          setActiveActivityId(selectedId);

          // Context-Aware Accordion: ONLY expand the module containing the active activity
          const targetAct = visibleActivities.find((a) => a.id === selectedId);
          if (targetAct?.moduleId) {
            setExpandedModuleIds([targetAct.moduleId]);
          } else if (visibleModules.length > 0) {
            setExpandedModuleIds([visibleModules[0].id!]);
          }

          // Sync URL query parameter without full reload
          const currentUrlParam = searchParams.get("activityId");
          if (currentUrlParam !== selectedId) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("activityId", selectedId);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }
        }
      } catch (error) {
        console.error("Error loading student course player data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCoursePlayerData();
  }, [courseId, userData, user, authLoading, router, pathname]);

  // Keep state in sync if URL search params change (e.g. browser back/forward buttons)
  useEffect(() => {
    const actIdFromUrl = searchParams.get("activityId");
    if (actIdFromUrl && actIdFromUrl !== activeActivityId && activities.some((a) => a.id === actIdFromUrl)) {
      setActiveActivityId(actIdFromUrl);
      const targetAct = activities.find((a) => a.id === actIdFromUrl);
      if (targetAct?.moduleId) {
        setExpandedModuleIds((prev) => (prev.includes(targetAct.moduleId!) ? prev : [...prev, targetAct.moduleId!]));
      }
    }
  }, [searchParams, activities, activeActivityId]);

  const handleSelectActivity = (actId: string) => {
    setActiveActivityId(actId);
    const targetAct = activities.find((a) => a.id === actId);
    if (targetAct?.moduleId) {
      setExpandedModuleIds((prev) => (prev.includes(targetAct.moduleId!) ? prev : [...prev, targetAct.moduleId!]));
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("activityId", actId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleModuleAccordion = (mId: string) => {
    setExpandedModuleIds((prev) =>
      prev.includes(mId) ? prev.filter((id) => id !== mId) : [...prev, mId]
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-on-surface-variant">جاري فتح قارئ الدورة التعليمية...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4" dir="rtl">
        <div className="bg-surface border border-outline/15 rounded-3xl p-8 max-w-md text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-error-container/30 text-error flex items-center justify-center mx-auto border border-error/20">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-extrabold text-on-surface">غير مسموح بالوصول</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            ليس لديك صلاحية الوصول إلى هذه الدورة التعليمية. استخدم رمز تفعيل مخصص للوصول إلى هذا المحتوى.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/dashboard/activate"
              className="h-11 px-5 rounded-2xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center"
            >
              تفعيل رمز جديد
            </Link>
            <Link
              href="/dashboard"
              className="h-11 px-5 rounded-2xl bg-surface-variant text-on-surface-variant font-bold text-xs hover:bg-surface-variant/80 transition-all flex items-center justify-center"
            >
              العودة للدورات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!course) return null;

  const activeActivity = activities.find((a) => a.id === activeActivityId) || activities[0];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "practice":
        return <Dumbbell className="w-4 h-4 text-secondary shrink-0" />;
      case "exam":
        return <Trophy className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <BookOpen className="w-4 h-4 text-primary shrink-0" />;
    }
  };

  const studentUid = user?.uid || "";
  const studentName = userData?.fullName || userData?.displayName || "";
  const studentEmail = user?.email || "";

  // Helper renderer for Course Modules Accordion List
  const renderModulesList = () => {
    if (modules.length === 0) {
      return (
        <div className="py-8 text-center text-xs text-on-surface-variant font-medium">
          لا توجد فصول متاحة حالياً.
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[65vh] lg:max-h-[75vh] overflow-y-auto pr-1">
        {modules.map((module) => {
          const moduleActivities = activities.filter((a) => a.moduleId === module.id);
          const isExpanded = expandedModuleIds.includes(module.id!);

          return (
            <div
              key={module.id}
              className="border border-outline/15 rounded-2xl overflow-hidden bg-surface-variant/10 transition-colors"
            >
              {/* Module Header Toggle Button */}
              <button
                type="button"
                onClick={() => toggleModuleAccordion(module.id!)}
                className="w-full p-3.5 flex items-center justify-between gap-3 text-right hover:bg-surface-variant/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-xs font-extrabold text-on-surface truncate">
                    {module.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-on-surface-variant bg-surface-variant/40 px-2 py-0.5 rounded-md">
                    {moduleActivities.length}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${isExpanded ? "rotate-180" : ""
                      }`}
                  />
                </div>
              </button>

              {/* Module Activities Accordion Body */}
              {isExpanded && (
                <div className="p-2 pt-0 space-y-1.5 border-t border-outline/10 bg-surface/50">
                  {moduleActivities.length === 0 ? (
                    <p className="text-[11px] text-on-surface-variant/70 p-2 text-center font-medium">
                      لا توجد دروس أو تمارين في هذا الفصل بعد.
                    </p>
                  ) : (
                    moduleActivities.map((act) => {
                      const isActive = act.id === activeActivityId;

                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => {
                            handleSelectActivity(act.id!);
                            setIsMobileSheetOpen(false);
                            setIsMobileSidebarOpen(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`w-full p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 text-right ${isActive
                            ? "bg-primary text-on-primary shadow-xs"
                            : "bg-surface-variant/20 text-on-surface hover:bg-surface-variant/50 border border-outline/10"
                            }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {getActivityIcon(act.type || "")}
                            <span className="truncate">{act.title}</span>
                          </div>

                          {isActive && <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[3]" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  console.log("🔥 FRONTEND DEBUG 1 (Page): activeActivity directives =", activeActivity?.hiddenTeacherDirectives);

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary/20" dir="rtl">
      {/* Top Navbar Navigation */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-outline/15 px-4 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-4">
        {/* Simple, Elegant Back Button */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors py-1.5 px-3 rounded-xl bg-surface-variant/30 hover:bg-surface-variant/60 border border-outline/10"
        >
          <ArrowRight className="w-4 h-4 text-primary" />
          <span>العودة إلى لوحة التحكم</span>
        </Link>

        {/* Global Icons */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Student Player Workspace */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Top Back Navigation Link */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors py-1"
          >
            <ArrowRight className="w-4 h-4 text-primary" />
            <span>العودة إلى لوحة التحكم</span>
          </Link>
          <span className="text-xs font-extrabold text-on-surface-variant bg-surface-variant/40 px-3 py-1 rounded-xl">
            {course.title}
          </span>
        </div>

        {/* MOBILE STICKY INDEX (Visible only on small screens) */}
        <div className="sticky top-0 z-40 lg:hidden bg-background/95 backdrop-blur-md p-3 sm:p-4 border-b border-border/50 mb-6 shadow-xs rounded-2xl">
          <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="w-full flex justify-between items-center bg-card border border-border/50 rounded-xl px-4 py-2.5 shadow-xs text-primary font-bold text-xs cursor-pointer hover:bg-surface-variant/30 transition-colors"
              >
                <span className="flex items-center gap-2 font-bold text-primary">
                  <Layers className="w-4 h-4" /> فهرس ومحتويات الدروس
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent className="h-[80vh] overflow-y-auto" side="bottom">
              <div className="py-2">
                <div className="flex items-center justify-between gap-2 text-sm font-extrabold text-foreground pb-3 mb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>فهرس ومحتويات الدروس</span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">
                    {activities.length} نشاط
                  </span>
                </div>
                {renderModulesList()}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Revoked Enrollment Time-Bound Access Banner Rule 4 */}
        {isRevokedEnrollment && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
              <span>
                أنت لم تعد عضواً نشطاً في هذا الفوج. يمكنك فقط تصفح الدروس القديمة{revokedAtDateStr ? ` المنشورة قبل تاريخ (${revokedAtDateStr})` : ""}.
              </span>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-[11px] font-black shrink-0">
              وصول أرشفة تاريخية ⏳
            </span>
          </div>
        )}

        {/* Responsive Two-Column Layout */}
        <div className="flex flex-col lg:flex-row items-start gap-8 relative">
          {/* 1. DESKTOP ELEGANT SIDEBAR (Visible only on lg+) */}
          <aside className="hidden lg:block lg:w-1/4 shrink-0 sticky top-20 h-[calc(100vh-6rem)] custom-scrollbar border-l border-outline/15 pl-4">
            <div className="flex flex-col gap-3 overflow-y-auto h-full pr-1">
              <div className="flex items-center justify-between border-b border-outline/10 pb-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-on-surface">
                  <Layers className="w-4 h-4 text-primary" />
                  <span>فهرس ومحتويات الدروس</span>
                </div>
                <span className="text-[11px] font-bold text-on-surface-variant bg-surface-variant/40 px-2.5 py-0.5 rounded-lg">
                  {activities.length} نشاط
                </span>
              </div>
              {renderModulesList()}
            </div>
          </aside>

          {/* 2. MAIN CONTENT AREA (Vertical List Item Flow) */}
          <main className="flex-1 w-full flex flex-col gap-10 min-w-0 pb-10">
            {activeActivity ? (
              <>
                {/* Activity Native Header Card */}
                <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                      {getActivityIcon(activeActivity.type || "")}
                      <span>
                        {activeActivity.type === "practice"
                          ? "تطبيق وتمرين"
                          : activeActivity.type === "exam"
                            ? "امتحان وتقييم"
                            : "درس نظري"}
                      </span>
                    </span>

                    <span className="hidden sm:inline-block text-xs text-on-surface-variant/80 font-bold">
                      {course.title}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight">
                    <MathText content={activeActivity.title} />
                  </h2>
                </div>

                {/* Unified Single-Open Accordion for Activities & Lessons */}
                <Accordion className="w-full flex flex-col gap-4" collapsible defaultValue="section-lesson" type="single">
                  {/* SECTION 1: Lesson */}
                  {activeActivity.description && activeActivity.description.trim() && (
                    <AccordionItem className="border-none bg-card/40 rounded-2xl overflow-hidden shadow-xs" value="section-lesson">
                      <AccordionTrigger className="flex items-center justify-between p-5 hover:no-underline hover:bg-muted/50 transition-all [&[data-state=open]]:bg-muted/30 cursor-pointer w-full text-right">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
                            1
                          </div>
                          <h2 className="text-lg md:text-xl font-bold">شرح الدرس والمعادلات المنهجية</h2>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 pt-2">
                        <div className="pt-4 border-t border-border/20 text-xs sm:text-sm text-foreground leading-relaxed font-medium">
                          <MathText content={activeActivity.description} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* SECTION 2: Attachments & Videos */}
                  {((activeActivity.attachments && activeActivity.attachments.length > 0) ||
                    (activeActivity.videos && activeActivity.videos.length > 0)) && (
                    <AccordionItem className="border-none bg-card/40 rounded-2xl overflow-hidden shadow-xs" value="section-attachments">
                      <AccordionTrigger className="flex items-center justify-between p-5 hover:no-underline hover:bg-muted/50 transition-all [&[data-state=open]]:bg-muted/30 cursor-pointer w-full text-right">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
                            2
                          </div>
                          <h2 className="text-lg md:text-xl font-bold">المرفقات والملفات التعليمية المنهجية</h2>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 pt-2">
                        <div className="pt-4 border-t border-border/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Video Cards */}
                          {activeActivity.videos?.map((vidUrl, idx) => (
                            <div
                              key={`vid-${idx}`}
                              onClick={() => {
                                setActiveVideo(formatYouTubeUrl(vidUrl));
                                setIsFullscreen(false);
                              }}
                              className="p-4 rounded-2xl bg-surface-variant/20 hover:bg-primary/10 border border-outline/15 hover:border-primary/30 transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center shrink-0 transition-colors">
                                  <PlayCircle className="w-5 h-5" />
                                </div>
                                <div className="truncate">
                                  <span className="text-xs font-extrabold text-on-surface block truncate">
                                    فيديو الشرح التفاعلي #{idx + 1}
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant/70 block">
                                    انقر لتشغيل الفيديو ملء الشاشة
                                  </span>
                                </div>
                              </div>

                              <div className="w-8 h-8 rounded-lg bg-surface-variant/40 group-hover:bg-primary/20 text-on-surface-variant group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                                <Play className="w-4 h-4 fill-current" />
                              </div>
                            </div>
                          ))}

                          {/* Attachment Cards */}
                          {activeActivity.attachments?.map((item, idx) => {
                            const isStr = typeof item === "string";
                            const title = isStr ? `ملف المرفق #${idx + 1}` : item.title || `ملف المرفق #${idx + 1}`;
                            const type = isStr ? "pdf" : item.type || "pdf";
                            const url = isStr ? item : item.url;
                            const description = !isStr ? item.description : "";
                            const embedUrl = formatPdfEmbedUrl(url);
                            const isVideo = type === "video";

                            return (
                              <div
                                key={`att-${idx}`}
                                onClick={() => {
                                  if (isVideo) {
                                    setActiveVideo(formatYouTubeUrl(url));
                                  } else {
                                    setActiveAttachment(embedUrl);
                                  }
                                  setIsFullscreen(false);
                                }}
                                className="p-4 rounded-2xl bg-surface-variant/20 hover:bg-secondary/10 border border-outline/15 hover:border-secondary/30 transition-all cursor-pointer group flex flex-col justify-between gap-3 shadow-2xs"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                        isVideo
                                          ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary"
                                          : "bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary"
                                      }`}
                                    >
                                      {isVideo ? <Video className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                    </div>
                                    <div className="truncate">
                                      <span className="text-xs font-extrabold text-on-surface block truncate">
                                        {title}
                                      </span>
                                      <span className="text-[10px] text-on-surface-variant/70 block">
                                        {isVideo ? "فيديو تفاعلي - انقر للمشاهدة" : "مستند PDF - انقر للمعاينة والتحميل"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="w-8 h-8 rounded-lg bg-surface-variant/40 group-hover:bg-secondary/20 text-on-surface-variant group-hover:text-secondary flex items-center justify-center shrink-0 transition-colors">
                                    {isVideo ? <Play className="w-4 h-4 fill-current" /> : <Eye className="w-4 h-4" />}
                                  </div>
                                </div>

                                {description && (
                                  <p className="text-[11px] text-on-surface-variant/80 font-medium leading-relaxed pt-2 border-t border-outline/10">
                                    {description}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* SECTION 3: AI Station */}
                  {activeActivity.id && (
                    <AccordionItem className="border-none bg-card/40 rounded-2xl overflow-hidden shadow-xs" value="section-ai">
                      <AccordionTrigger className="flex items-center justify-between p-5 hover:no-underline hover:bg-indigo-500/10 transition-all [&[data-state=open]]:bg-indigo-500/5 cursor-pointer w-full text-right">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-sm">
                            3
                          </div>
                          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                            المساعد الذكي السقراطي - المحطات التفاعلية
                            <Sparkles className="w-5 h-5 text-indigo-400" />
                          </h2>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-0 pb-0 pt-0">
                        <div className="border-t border-indigo-500/20">
                          <SocraticStationChat
                            key={activeActivity.id}
                            studentId={studentUid}
                            studentName={studentName}
                            studentEmail={studentEmail}
                            courseId={courseId}
                            courseName={course?.title}
                            moduleName={modules.find((m) => m.id === activeActivity.moduleId)?.title || ""}
                            courseIndexContext={course?.courseIndexContext}
                            activityId={activeActivity.id}
                            activityTitle={activeActivity.title}
                            activityDescription={activeActivity.description}
                            globalLatexSummary={activeActivity.globalLatexSummary}
                            globalCustomIsolations={activeActivity.globalCustomIsolations}
                            attachments={activeActivity.attachments || []}
                            stations={activeActivity.stations || []}
                            onSubmissionUrlsChange={setCurrentSubmissionUrls}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* SECTION 4: Real Interactive Quiz Taker (If quiz exists) */}
                  {activeActivity.hasQuiz && activeActivity.quiz && activeActivity.quiz.length > 0 && (
                    <AccordionItem className="border-none bg-card/40 rounded-2xl overflow-hidden shadow-xs" value="section-quiz">
                      <AccordionTrigger className="flex items-center justify-between p-5 hover:no-underline hover:bg-emerald-500/10 transition-all [&[data-state=open]]:bg-emerald-500/5 cursor-pointer w-full text-right">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-sm">
                            4
                          </div>
                          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                            التقييم والاختبار التفاعلي
                            <Trophy className="w-5 h-5 text-emerald-400" />
                          </h2>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 pt-2">
                        <div className="pt-4 border-t border-emerald-500/20">
                          <RealQuizTaker
                            studentId={studentUid}
                            studentName={studentName}
                            studentEmail={studentEmail}
                            courseId={courseId}
                            activityId={activeActivity.id!}
                            activityTitle={activeActivity.title}
                            quizQuestions={activeActivity.quiz}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </>
            ) : (
              <div className="bg-surface border border-outline/15 rounded-3xl p-12 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="text-base font-extrabold text-on-surface">لا تزال الأنشطة التعليمية قيد الإعداد</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  سيقوم الأستاذ بإضافة الدروس والتمارين التفاعلية لهذه الدورة قريباً.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Responsive Video Modal Overlay */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn p-0 sm:p-4"
          dir="rtl"
          onClick={() => {
            setActiveVideo(null);
            setIsFullscreen(false);
          }}
        >
          <div
            className={`bg-card text-card-foreground shadow-2xl transition-all duration-300 flex flex-col overflow-hidden ${
              isFullscreen
                ? "fixed inset-0 z-[200] w-full h-[100dvh] max-w-[100vw] rounded-none m-0 p-0 border-0"
                : "w-full h-[100dvh] max-w-[100vw] rounded-none sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl border border-border/40"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-muted/30 border-b border-border/40 flex items-center justify-between shrink-0">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                <span>مشغّل فيديو الشرح التفاعلي</span>
              </span>

              <div className="flex items-center gap-2">
                {/* Fullscreen Toggle Button (Hidden on Mobile) */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "تصغير" : "تكبير الشاشة"}
                  aria-label={isFullscreen ? "تصغير" : "تكبير الشاشة"}
                  className="hidden sm:flex items-center justify-center p-2 bg-surface-variant/40 hover:bg-surface-variant text-foreground rounded-xl transition-colors cursor-pointer"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveVideo(null);
                    setIsFullscreen(false);
                  }}
                  aria-label="إغلاق التشغيل"
                  className="p-2 bg-error/10 text-error hover:bg-error hover:text-on-error rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full h-full bg-black">
              <iframe
                src={activeVideo}
                title="Video Player Overlay"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Responsive Fullscreen Attachment Modal Overlay */}
      {activeAttachment && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn p-0 sm:p-4"
          dir="rtl"
          onClick={() => {
            setActiveAttachment(null);
            setIsFullscreen(false);
          }}
        >
          <div
            className={`bg-card text-card-foreground shadow-2xl transition-all duration-300 flex flex-col overflow-hidden ${
              isFullscreen
                ? "fixed inset-0 z-[200] w-full h-[100dvh] max-w-[100vw] rounded-none m-0 p-0 border-0"
                : "w-full h-[100dvh] max-w-[100vw] rounded-none sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl border border-border/40"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-muted/30 border-b border-border/40 flex items-center justify-between shrink-0">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-secondary" />
                <span>معاينة المستند والملف المرفق</span>
              </span>

              <div className="flex items-center gap-2">
                {/* Fullscreen Toggle Button (Hidden on Mobile) */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "تصغير" : "تكبير الشاشة"}
                  aria-label={isFullscreen ? "تصغير" : "تكبير الشاشة"}
                  className="hidden sm:flex items-center justify-center p-2 bg-surface-variant/40 hover:bg-surface-variant text-foreground rounded-xl transition-colors cursor-pointer"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveAttachment(null);
                    setIsFullscreen(false);
                  }}
                  aria-label="إغلاق المعاينة"
                  className="p-2 bg-error/10 text-error hover:bg-error hover:text-on-error rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full h-full bg-background/50">
              <iframe
                src={activeAttachment}
                title="Attachment Viewer Overlay"
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* AI Math Tutor Socratic Floating Widget */}
      {/* AI Math Tutor Socratic Floating Widget */}
      <AITutorWidget
        studentId={user?.uid} // <--- السطر الحاسم لربط الذاكرة بالمعرف الحقيقي للتلميذ
        studentName={studentName}
        lessonTitle={activeActivity?.title}
        lessonSummary={activeActivity?.description}
        submissionUrls={currentSubmissionUrls}
        submissionId={currentSubmissionId}
        aiEvaluationCache={currentAiEvaluationCache}
        hiddenTeacherDirectives={activeActivity?.hiddenTeacherDirectives}
        moduleId={activeActivity?.moduleId}
        courseId={courseId}
        activityId={activeActivity?.id}
        latexContent={
          activeActivity?.attachments
            ? activeActivity.attachments
              .map((item) => (typeof item === "string" ? "" : item.latexContent || ""))
              .filter(Boolean)
              .join("\n\n")
            : ""
        }
      />
    </div>
  );
}

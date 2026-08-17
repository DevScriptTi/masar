"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { RealAssignmentSubmitter } from "@/src/components/student/RealAssignmentSubmitter";
import { RealQuizTaker } from "@/src/components/student/RealQuizTaker";
import { MathText } from "@/src/components/admin/activities/StudentPreview";
import { formatPdfEmbedUrl, formatYouTubeUrl } from "@/src/lib/utils/formatters";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NotificationBell } from "@/src/components/student/NotificationBell";
import { AITutorWidget } from "@/src/components/student/AITutorWidget";
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

export default function StudentCoursePlayerPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const router = useRouter();

  const { user, userData, loading: authLoading } = useAuth();

  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [modules, setModules] = useState<ModuleDoc[]>([]);
  const [activities, setActivities] = useState<ActivityDoc[]>([]);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Task A & B: State Management for Modal Overlays & Fullscreen Toggle
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [activeAttachment, setActiveAttachment] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Task C: Mobile Sidebar Toggle Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

        // 2. Filter Modules by Visibility & Excluded Students
        const visibleModules = modulesData.filter((m) => {
          if (m.isVisible === false) return false;
          if (m.excludedStudentIds && m.excludedStudentIds.includes(studentUid)) return false;
          if (m.groupIds && m.groupIds.length > 0 && !m.groupIds.some((gId) => studentTokens.includes(gId))) {
            return false;
          }
          return true;
        });

        // 3. Filter Activities by Visibility & Excluded Students
        const visibleActivities = activitiesData.filter((a) => {
          if (a.isVisible === false) return false;
          if (a.excludedStudentIds && a.excludedStudentIds.includes(studentUid)) return false;
          if (a.groupIds && a.groupIds.length > 0 && !a.groupIds.some((gId) => studentTokens.includes(gId))) {
            return false;
          }
          return true;
        });

        setCourse(courseData);
        setModules(visibleModules);
        setActivities(visibleActivities);

        // Expand all module accordions by default
        const moduleIds = visibleModules.map((m) => m.id!).filter(Boolean);
        setExpandedModuleIds(moduleIds);

        // Auto-select first available activity
        if (visibleActivities.length > 0) {
          setActiveActivityId(visibleActivities[0].id!);
        }
      } catch (error) {
        console.error("Error loading student course player data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCoursePlayerData();
  }, [courseId, userData, user, authLoading, router]);

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
                    className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
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
                            setActiveActivityId(act.id!);
                            setIsMobileSidebarOpen(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`w-full p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 text-right ${
                            isActive
                              ? "bg-primary text-on-primary shadow-xs"
                              : "bg-surface-variant/20 text-on-surface hover:bg-surface-variant/50 border border-outline/10"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {getActivityIcon(act.type)}
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

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary/20" dir="rtl">
      {/* Top Navbar Navigation */}
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-outline/15 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Task B: Scrollable Breadcrumb Links for Mobile */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 min-w-0 mr-2"
        >
          <Link href="/dashboard" className="hover:text-primary hover:underline transition-colors shrink-0 flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
            <span>لوحة التحكم</span>
          </Link>
          <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />
          <span className="text-on-surface-variant font-semibold shrink-0">
            {course.title}
          </span>
          {activeActivity && (
            <>
              <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />
              <span aria-current="page" className="text-on-surface font-bold shrink-0">
                {activeActivity.title}
              </span>
            </>
          )}
        </nav>

        {/* Global Icons (Shrink-0 to prevent squishing on small screens) */}
        <div className="flex items-center gap-3 shrink-0">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Student Player Workspace */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Side Module Navigation Panel (Desktop Side-by-Side: 4 cols) */}
          <aside className="hidden lg:block lg:col-span-4 bg-surface border border-outline/15 rounded-3xl p-5 shadow-sm space-y-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between border-b border-outline/10 pb-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-on-surface">
                <Layers className="w-4 h-4 text-primary" />
                <span>محتويات الدورة المنهجية (فهرس الدروس)</span>
              </div>
              <span className="text-[11px] font-bold text-on-surface-variant bg-surface-variant/40 px-2.5 py-0.5 rounded-lg">
                {modules.length} فصول
              </span>
            </div>

            {renderModulesList()}
          </aside>

          {/* Main Native Activity Player Area (Left/Center in RTL - 8 cols on desktop, full width on mobile) */}
          <section className="col-span-1 lg:col-span-8 space-y-6">
            {activeActivity ? (
              <div className="space-y-6 animate-fadeIn">
                {/* Activity Native Header Card */}
                <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                      {getActivityIcon(activeActivity.type)}
                      <span>
                        {activeActivity.type === "practice"
                          ? "تطبيق وتمرين"
                          : activeActivity.type === "exam"
                          ? "امتحان وتقييم"
                          : "درس نظري"}
                      </span>
                    </span>

                    <span className="text-xs text-on-surface-variant/80 font-bold">
                      {course.title}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight">
                    <MathText content={activeActivity.title} />
                  </h2>

                  {/* Task C: Consolidated Prominent Mobile Index Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-2xs lg:hidden"
                  >
                    <Layers className="w-4 h-4 text-primary" />
                    <span>فهرس ومحتويات الدروس</span>
                  </button>
                </div>

                {/* 1. Description & Lesson Content Text Section (First element below title) */}
                {activeActivity.description && activeActivity.description.trim() && (
                  <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
                    <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-2 border-b border-outline/10 pb-3">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>شرح الدرس والمعادلات المنهجية</span>
                    </h3>
                    <div className="text-xs sm:text-sm text-on-surface leading-relaxed font-medium pt-1">
                      <MathText content={activeActivity.description} />
                    </div>
                  </div>
                )}

                {/* Task C: Video Playlist UI (MD3 Clickable Cards) */}
                {activeActivity.videos && activeActivity.videos.length > 0 && (
                  <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-extrabold text-on-surface flex items-center justify-between border-b border-outline/10 pb-3">
                      <span className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-primary" />
                        <span>فيديوهات الشرح التفاعلي</span>
                      </span>
                      <span className="text-xs font-bold text-on-surface-variant bg-surface-variant/40 px-2.5 py-0.5 rounded-lg">
                        {activeActivity.videos.length} فيديو
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeActivity.videos.map((vidUrl, idx) => (
                        <div
                          key={idx}
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
                    </div>
                  </div>
                )}

                {/* Task B: Structured PDF & Attachments Rich Cards Gallery */}
                {activeActivity.attachments && activeActivity.attachments.length > 0 && (
                  <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-extrabold text-on-surface flex items-center justify-between border-b border-outline/10 pb-3">
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-secondary" />
                        <span>المرفقات والملفات التعليمية المنهجية</span>
                      </span>
                      <span className="text-xs font-bold text-on-surface-variant bg-surface-variant/40 px-2.5 py-0.5 rounded-lg">
                        {activeActivity.attachments.length} مرفق
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeActivity.attachments.map((item, idx) => {
                        const isStr = typeof item === "string";
                        const title = isStr ? `ملف المرفق #${idx + 1}` : item.title || `ملف المرفق #${idx + 1}`;
                        const type = isStr ? "pdf" : item.type || "pdf";
                        const url = isStr ? item : item.url;
                        const description = !isStr ? item.description : "";
                        const embedUrl = formatPdfEmbedUrl(url);

                        const isVideo = type === "video";

                        return (
                          <div
                            key={idx}
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
                  </div>
                )}

                {/* Real Assignment Submitter (If required) */}
                {activeActivity.requireSubmission && (
                  <RealAssignmentSubmitter
                    studentId={studentUid}
                    studentName={studentName}
                    studentEmail={studentEmail}
                    courseId={courseId}
                    activityId={activeActivity.id!}
                    activityTitle={activeActivity.title}
                  />
                )}

                {/* Real Interactive Quiz Taker (If quiz exists) */}
                {activeActivity.hasQuiz && activeActivity.quiz && activeActivity.quiz.length > 0 && (
                  <RealQuizTaker
                    studentId={studentUid}
                    studentName={studentName}
                    studentEmail={studentEmail}
                    courseId={courseId}
                    activityId={activeActivity.id!}
                    activityTitle={activeActivity.title}
                    quizQuestions={activeActivity.quiz}
                  />
                )}
              </div>
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
          </section>
        </div>
      </main>

      {/* Task C: Mobile Sidebar Drawer Bottom Sheet Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden flex flex-col justify-end animate-fadeIn"
          dir="rtl"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div
            className="bg-surface border-t border-outline/20 rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline/10 pb-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-on-surface">
                <Layers className="w-4 h-4 text-primary" />
                <span>فهرس ومحتويات الدورة المنهجية</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="إغلاق الفهرس"
                className="p-1.5 rounded-full bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderModulesList()}
          </div>
        </div>
      )}

      {/* Task A: Responsive Fullscreen Video Modal Overlay */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-0 lg:p-12 backdrop-blur-sm animate-fadeIn"
          dir="rtl"
        >
          <div
            className={`relative bg-surface overflow-hidden shadow-2xl transition-all duration-300 flex flex-col border border-outline/20 ${
              isFullscreen
                ? "w-full h-full rounded-none fixed inset-0 z-[200]"
                : "w-full max-w-5xl aspect-video rounded-2xl sm:w-full sm:h-full sm:rounded-none sm:fixed sm:inset-0"
            }`}
          >
            <div className="p-3.5 bg-surface-variant/80 flex items-center justify-between border-b border-outline/20 shrink-0">
              <span className="font-extrabold text-xs sm:text-sm text-on-surface flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                <span>مشغّل فيديو الشرح التفاعلي</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  aria-label="تغيير حجم الشاشة"
                  className="hidden md:flex p-1.5 bg-surface-variant/80 hover:bg-surface-variant text-on-surface rounded-xl transition-colors"
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
                  className="p-1.5 bg-error/10 text-error hover:bg-error hover:text-on-error rounded-xl transition-colors"
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

      {/* Task A: Responsive Fullscreen Attachment Modal Overlay */}
      {activeAttachment && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-0 lg:p-12 backdrop-blur-sm animate-fadeIn"
          dir="rtl"
        >
          <div
            className={`relative bg-surface overflow-hidden shadow-2xl transition-all duration-300 flex flex-col border border-outline/20 ${
              isFullscreen
                ? "w-full h-full rounded-none fixed inset-0 z-[200]"
                : "w-full max-w-5xl h-[85vh] rounded-2xl sm:w-full sm:h-full sm:rounded-none sm:fixed sm:inset-0"
            }`}
          >
            <div className="p-3.5 bg-surface-variant/80 flex items-center justify-between border-b border-outline/20 shrink-0">
              <span className="font-extrabold text-xs sm:text-sm text-on-surface flex items-center gap-2">
                <FileText className="w-4 h-4 text-secondary" />
                <span>معاينة المستند والملف المرفق</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  aria-label="تغيير حجم الشاشة"
                  className="hidden md:flex p-1.5 bg-surface-variant/80 hover:bg-surface-variant text-on-surface rounded-xl transition-colors"
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
                  className="p-1.5 bg-error/10 text-error hover:bg-error hover:text-on-error rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full h-full bg-surface-variant/20">
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
      <AITutorWidget
        lessonTitle={activeActivity?.title}
        lessonSummary={activeActivity?.description}
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

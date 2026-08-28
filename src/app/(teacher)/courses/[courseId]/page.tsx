"use client";

import React, { useState, useEffect, use, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCourseById,
  getModulesByCourse,
  getActivitiesByCourse,
  createModule,
  createActivity,
  deleteModule,
  deleteActivity,
  CourseDoc,
  ModuleDoc,
  ActivityDoc,
} from "@/src/lib/firebase/coursesService";
import { fetchGroups, GroupDoc } from "@/src/lib/firebase/groupsService";
import { ModuleList } from "@/src/components/admin/courses/ModuleList";
import { StudentExceptionsModal } from "@/src/components/admin/activities/StudentExceptionsModal";
import { InlineAIRefiner } from "@/src/components/admin/activities/InlineAIRefiner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useToast } from "@/src/components/ui/use-toast";
import {
  ChevronLeft,
  BookOpen,
  Plus,
  Loader2,
  X,
  Layers,
  FileCode,
  Users,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Wand2,
  ChevronDown,
  Settings as SettingsIcon,
  Bot,
} from "lucide-react";

export default function CourseBuilderPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const router = useRouter();
  const { toast } = useToast();

  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [modules, setModules] = useState<ModuleDoc[]>([]);
  const [activities, setActivities] = useState<ActivityDoc[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Module Modal State with Subset Rule & Exceptions
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleGroupIds, setModuleGroupIds] = useState<string[]>([]);
  const [moduleExcludedStudentIds, setModuleExcludedStudentIds] = useState<string[]>([]);
  const [moduleIndexContext, setModuleIndexContext] = useState("");
  const [moduleDetailedLatex, setModuleDetailedLatex] = useState("");
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [isNewModuleExceptionsOpen, setIsNewModuleExceptionsOpen] = useState(false);
  const [groupNotice, setGroupNotice] = useState(false);

  // Module AI Context Engine State & Progressive Disclosure
  const [showModuleAdvancedAI, setShowModuleAdvancedAI] = useState(false);
  const [isGeneratingModuleAI, setIsGeneratingModuleAI] = useState(false);

  const handleAutoGenerateModuleAI = async () => {
    if (!moduleTitle.trim()) {
      toast({
        title: "عنوان الفصل مطلوب",
        description: "يرجى إدخال عنوان الفصل أولاً ليتمكن الذكاء الاصطناعي من تحليل موضوع الفصل.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingModuleAI(true);
    try {
      const res = await fetch("/api/ai/generate-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: moduleTitle.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشل في توليد سياق الفصل من الذكاء الاصطناعي");
      }

      const data = await res.json();
      if (data.success) {
        setModuleIndexContext(data.indexContext || "");
        setModuleDetailedLatex(data.detailedLatex || "");
        setShowModuleAdvancedAI(true); // Seamless auto-expand

        toast({
          title: "تم توليد سياق الفصل بنجاح ✨",
          description: "تم استخراج الرموز وقوانين LaTeX لهذا الفصل تلقائياً وتم فتح التعديل اليدوي.",
        });
      } else {
        throw new Error(data.error || "استجابة غير صالحة من نموذج الذكاء الاصطناعي");
      }
    } catch (err: any) {
      console.error("Error generating module AI context:", err);
      toast({
        title: "حدث خطأ أثناء التوليد",
        description: err?.message || "تعذر توليد سياق الفصل.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingModuleAI(false);
    }
  };

  const handleCurriculumModuleCoPilot = () => {
    const template = `الكفاءة المستهدفة للفصل:
- التمكن من تطبيق قوانين المحور وحل التمارين التفاعلية بدقة منهجية.

المحاور الفرعية للفصل:
- 01. ملخص المفاهيم والقواعد المعتمدة.
- 02. المحطات التفاعلية والتطبيق المباشر.

المكتسبات القبلية:
- التحكم في المفاهيم المكتسبة في الفصول السابقة.`;

    setModuleIndexContext(template);
    toast({
      title: "تم تطبيق قالب هيكلة الفصل 🤖",
      description: "تمت صياغة الفهرس وفق المعايير الوزارية الجزائرية المعتمدة.",
    });
  };

  // Add Activity Modal State
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityType, setActivityType] = useState<"lesson" | "practice" | "exam">("lesson");
  const [requireSubmission, setRequireSubmission] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [activityGroupIds, setActivityGroupIds] = useState<string[]>([]);
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      const [courseData, modulesData, activitiesData, groupsData] = await Promise.all([
        getCourseById(courseId),
        getModulesByCourse(courseId),
        getActivitiesByCourse(courseId),
        fetchGroups(),
      ]);

      if (!courseData) {
        alert("لم يتم العثور على الدورة المطلوب تعديلها.");
        router.push("/teacher/courses");
        return;
      }

      setCourse(courseData);
      setModules(modulesData);
      setActivities(activitiesData);
      setAvailableGroups(groupsData.filter((g) => g.status !== "archived"));
    } catch (error) {
      console.error("Error fetching course data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  // Course Subset Rule for Modules: Only groups allowed by parent course
  const courseGroupIds = course?.groupIds || [];
  const allowedCourseGroups = availableGroups.filter(
    (g) => g.status !== "archived" && courseGroupIds.includes(g.id!)
  );

  // Computed allowed activity groups following Subset Rule
  const targetModuleForModal = modules.find((m) => m.id === targetModuleId);
  const targetModuleGroupIds =
    targetModuleForModal?.groupIds && targetModuleForModal.groupIds.length > 0
      ? targetModuleForModal.groupIds
      : courseGroupIds;
  const allowedActivityGroups = allowedCourseGroups.filter((g) =>
    targetModuleGroupIds.includes(g.id!)
  );

  const handleOpenAddModule = () => {
    setModuleTitle("");
    setModuleGroupIds(courseGroupIds);
    setModuleExcludedStudentIds([]);
    setModuleIndexContext("");
    setModuleDetailedLatex("");
    setIsModuleModalOpen(true);
  };

  const handleToggleModuleGroup = (gId: string) => {
    setGroupNotice(false);
    setModuleGroupIds((prev) =>
      prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
    );
  };

  const handleSelectAllModuleGroups = () => {
    setGroupNotice(false);
    const allIds = allowedCourseGroups.map((g) => g.id!).filter(Boolean);
    setModuleGroupIds(allIds);
  };

  // Handle Module Creation
  const handleCreateModule = async (e: FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;

    setIsCreatingModule(true);
    try {
      const sanitizedModuleGroupIds = moduleGroupIds.filter((id) =>
        courseGroupIds.includes(id)
      );

      await createModule({
        courseId,
        title: moduleTitle.trim(),
        order: modules.length + 1,
        isVisible: true,
        groupIds: sanitizedModuleGroupIds,
        excludedStudentIds: moduleExcludedStudentIds,
        moduleIndexContext: moduleIndexContext.trim(),
        moduleDetailedLatex: moduleDetailedLatex.trim(),
      });

      setModuleTitle("");
      setModuleIndexContext("");
      setModuleDetailedLatex("");
      setIsModuleModalOpen(false);
      await fetchCourseData();
    } catch (error) {
      console.error("Error creating module:", error);
      alert("حدث خطأ أثناء إضافة الفصل.");
    } finally {
      setIsCreatingModule(false);
    }
  };

  // Handle Activity Creation
  const handleOpenAddActivity = (moduleId: string) => {
    setTargetModuleId(moduleId);
    setActivityTitle("");
    setActivityType("lesson");
    setRequireSubmission(false);
    setHasQuiz(false);
    const targetMod = modules.find((m) => m.id === moduleId);
    const allowedGroupIdsForAct =
      targetMod?.groupIds && targetMod.groupIds.length > 0
        ? targetMod.groupIds
        : courseGroupIds;
    setActivityGroupIds(allowedGroupIdsForAct);
    setIsActivityModalOpen(true);
  };

  const handleCreateActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim() || !targetModuleId) return;

    setIsCreatingActivity(true);
    try {
      const moduleActivities = activities.filter((a) => a.moduleId === targetModuleId);

      await createActivity({
        courseId,
        moduleId: targetModuleId,
        type: activityType,
        title: activityTitle.trim(),
        isVisible: true,
        order: moduleActivities.length + 1,
        requireSubmission,
        hasQuiz,
        videos: [],
        attachments: [],
        groupIds: activityGroupIds,
        excludedStudentIds: [],
      });

      setActivityTitle("");
      setIsActivityModalOpen(false);
      await fetchCourseData();
    } catch (error) {
      console.error("Error creating activity:", error);
      alert("حدث خطأ أثناء إضافة النشاط.");
    } finally {
      setIsCreatingActivity(false);
    }
  };

  // Handle Deletions
  const handleDeleteModule = async (moduleId: string) => {
    try {
      await deleteModule(moduleId);
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
      setActivities((prev) => prev.filter((a) => a.moduleId !== moduleId));
      toast({
        title: "تم حذف الفصل وكافة أنشطته بنجاح 🗑️",
      });
    } catch (error) {
      console.error("Error deleting module:", error);
      toast({
        title: "حدث خطأ أثناء حذف الفصل",
        variant: "destructive",
      });
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      await deleteActivity(activityId);
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
      toast({
        title: "تم حذف النشاط بنجاح 🗑️",
      });
    } catch (error) {
      console.error("Error deleting activity:", error);
      toast({
        title: "حدث خطأ أثناء حذف النشاط",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="text-sm font-semibold text-on-surface-variant">جاري فتح مصمم الدورة...</p>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Task A & B: Refined RTL Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant min-w-0 flex-wrap">
        <Link
          href="/teacher/courses"
          className="hover:text-primary hover:underline transition-colors shrink-0"
        >
          إدارة الدورات
        </Link>

        <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />

        <span
          aria-current="page"
          className="text-on-surface font-bold max-w-[180px] md:max-w-none truncate md:whitespace-normal cursor-default"
        >
          {course.title}
        </span>
      </nav>

      {/* Header Container */}
      <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <BookOpen className="w-4 h-4" />
            <span>مصمم المنهج والدورة التعليمية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            {course.title}
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant/90 leading-relaxed">
            {course.description || "لا يوجد وصف محدد لهذه الدورة."}
          </p>

          {/* Allowed Groups Badges */}
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <span className="text-xs font-semibold text-on-surface-variant">الأفواج المسموحة لهذه الدورة:</span>
            {courseGroupIds.length === 0 ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                جميع الأفواج
              </span>
            ) : (
              allowedCourseGroups.map((g) => (
                <span
                  key={g.id}
                  className="text-xs font-extrabold px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center gap-1"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{g.name}</span>
                </span>
              ))
            )}
          </div>
        </div>

        {/* MD3 Outlined Add Module Button */}
        <button
          type="button"
          onClick={handleOpenAddModule}
          className="h-12 px-6 rounded-2xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all duration-200 flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة فصل جديد</span>
        </button>
      </div>

      {/* Module Accordion List with Subset Rule */}
      <ModuleList
        courseId={courseId}
        courseGroupIds={courseGroupIds}
        availableGroups={availableGroups}
        modules={modules}
        activities={activities}
        onRefresh={fetchCourseData}
        onAddActivity={handleOpenAddActivity}
        onDeleteModule={handleDeleteModule}
        onDeleteActivity={handleDeleteActivity}
      />

      {/* Modal 1: Create Module with Subset Rule & Exceptions */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scaleUp max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <span>إضافة فصل جديد</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsModuleModalOpen(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateModule} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  عنوان الفصل <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={moduleTitle}
                  onChange={(e) => setModuleTitle(e.target.value)}
                  placeholder="مثال: الفصل 1 - الأعداد المركبة والتحويلات النقطية"
                  disabled={isCreatingModule}
                  required
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                />
              </div>

              {/* Subset Rule Group Selection for New Module */}
              <div className="p-4 rounded-2xl bg-surface-variant/20 border border-outline/15 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    <span>صلاحيات الرؤية والأفواج للفصل (Subset Rule)</span>
                  </span>
                  {allowedCourseGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllModuleGroups}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      تحديد جميع أفواج الدورة
                    </button>
                  )}
                </div>

                {allowedCourseGroups.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    تنبيه: الدورة التعليمية الأب غير مخصصة لأي فوج بعد. يرجى تخصيص الأفواج للدورة أولاً.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allowedCourseGroups.map((g) => {
                      const isSel = moduleGroupIds.includes(g.id!);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleToggleModuleGroup(g.id!)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isSel
                              ? "bg-primary text-on-primary border border-primary shadow-2xs"
                              : "bg-surface-variant/40 text-on-surface border border-outline/20 hover:border-primary/40"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{g.name}</span>
                          {isSel && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 border-t border-outline/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">استثناءات تلاميذ الفصل</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (moduleGroupIds.length === 0) {
                        setGroupNotice(true);
                        setTimeout(() => setGroupNotice(false), 4000);
                        return;
                      }
                      setIsNewModuleExceptionsOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>تخصيص استثناءات الفصل</span>
                    {moduleExcludedStudentIds.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-error text-white font-extrabold text-[9px] flex items-center justify-center">
                        {moduleExcludedStudentIds.length}
                      </span>
                    )}
                  </button>
                </div>

                {groupNotice && (
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-300">
                    الرجاء تحديد فوج واحد على الأقل أولاً لتخصيص الاستثناءات.
                  </p>
                )}
              </div>

              {/* AI Context Settings Section for Module (Requirements 2 & 3) */}
              <div className="space-y-4 pt-3 border-t border-outline/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-extrabold text-on-surface">
                      إعدادات سياق المساعد الذكي للفصل (AI Co-Pilot Context)
                    </h3>
                  </div>
                </div>

                {/* Primary Action State (AI Generation Hero Card) */}
                <div className="bg-gradient-to-br from-indigo-950/20 via-purple-950/15 to-surface border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1 max-w-sm">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-black">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>توليد ذكي تلقائي</span>
                      </span>
                      <h4 className="text-xs font-black text-on-surface">
                        توليد سياق وقوانين الفصل تلقائياً
                      </h4>
                      <p className="text-[11px] text-on-surface-variant/80 leading-relaxed font-medium">
                        دع الذكاء الاصطناعي يقرأ عنوان هذا الفصل لبناء الفهرس وقوانين الـ LaTeX تلقائياً دون كتابتها يدوياً.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoGenerateModuleAI}
                      disabled={isGeneratingModuleAI}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      {isGeneratingModuleAI ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>جارِ الاستخراج...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 text-amber-300 animate-bounce" />
                          <span>✨ توليد سياق الفصل</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Progressive Disclosure Accordion (Advanced Manual Mode) */}
                <div className="bg-surface-variant/20 border border-outline/15 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowModuleAdvancedAI((prev) => !prev)}
                    className="w-full p-3.5 flex items-center justify-between text-xs font-extrabold text-on-surface hover:bg-surface-variant/40 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <SettingsIcon className="w-3.5 h-3.5 text-primary" />
                      <span>⚙️ التعديل اليدوي المتقدم (كود LaTeX والفهرس)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-primary">
                      <span>{showModuleAdvancedAI ? "إخفاء" : "إظهار"}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showModuleAdvancedAI ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {/* Textareas revealed only in Advanced Mode */}
                  {showModuleAdvancedAI && (
                    <div className="p-4 space-y-4 border-t border-outline/10 bg-surface">
                      {/* Field 1: The Permanent Index with Curriculum Co-Pilot */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-on-surface-variant">
                            الفهرس المختصر للوحدة (سياق دائم)
                          </label>
                          <button
                            type="button"
                            onClick={handleCurriculumModuleCoPilot}
                            className="px-2 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-[11px] transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                          >
                            <Bot className="w-3.5 h-3.5 text-amber-300" />
                            <span>🤖 هيكلة الفصل (AI)</span>
                          </button>
                        </div>
                        <textarea
                          value={moduleIndexContext}
                          onChange={(e) => setModuleIndexContext(e.target.value)}
                          rows={4}
                          placeholder="اكتب رؤوس أقلام الفهرس وسياق هذه الوحدة أو انقر زر هيكلة الفصل..."
                          disabled={isCreatingModule}
                          className="w-full p-3 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-xs focus:outline-none focus:border-primary transition-all resize-y font-medium"
                        />
                        <InlineAIRefiner
                          currentText={moduleIndexContext}
                          onRefined={(newText) => setModuleIndexContext(newText)}
                        />
                      </div>

                      {/* Field 2: The Detailed Content (LaTeX) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-on-surface-variant">
                          المحتوى التفصيلي للوحدة بـ LaTeX
                        </label>
                        <textarea
                          value={moduleDetailedLatex}
                          onChange={(e) => setModuleDetailedLatex(e.target.value)}
                          rows={4}
                          placeholder="اكتب القوانين والتفاصيل الخاصة بهذه الوحدة باستخدام أكواد LaTeX..."
                          disabled={isCreatingModule}
                          dir="ltr"
                          className="w-full p-3 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-left font-mono text-xs focus:outline-none focus:border-primary transition-all resize-y"
                        />

                        {/* Live Preview Box */}
                        {moduleDetailedLatex.trim() && (
                          <div className="mt-2 p-3 rounded-xl bg-surface border border-primary/20 space-y-1.5">
                            <div className="flex items-center justify-between border-b border-outline/10 pb-1">
                              <span className="text-[10px] font-extrabold text-primary flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                <span>معاينة حية للرموز (Live KaTeX Preview)</span>
                              </span>
                            </div>
                            <div className="text-xs text-on-surface leading-relaxed max-h-36 overflow-y-auto p-2 bg-surface-variant/20 rounded-lg" dir="rtl">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                                components={{
                                  p: ({ children }) => <p className="my-1">{children}</p>,
                                }}
                              >
                                {moduleDetailedLatex}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsModuleModalOpen(false)}
                  disabled={isCreatingModule}
                  className="flex-1 h-12 rounded-xl bg-surface-variant/60 text-on-surface-variant font-bold text-sm hover:bg-surface-variant transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isCreatingModule}
                  className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isCreatingModule ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الإضافة...</span>
                    </>
                  ) : (
                    <span>إضافة الفصل</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Module Student Exceptions Modal */}
      <StudentExceptionsModal
        isOpen={isNewModuleExceptionsOpen}
        onClose={() => setIsNewModuleExceptionsOpen(false)}
        selectedGroupIds={moduleGroupIds}
        groups={allowedCourseGroups}
        excludedStudentIds={moduleExcludedStudentIds}
        onSave={(newEx) => setModuleExcludedStudentIds(newEx)}
      />

      {/* Modal 2: Create Activity */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-scaleUp" dir="rtl">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <FileCode className="w-5 h-5 text-primary" />
                <span>إضافة نشاط تعليمي</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsActivityModalOpen(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateActivity} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  عنوان النشاط <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="مثال: الدرس 1 - المدخل الشامل ومفاهيم مبرهنة القيم المتوسطة"
                  disabled={isCreatingActivity}
                  required
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  نوع النشاط <span className="text-error">*</span>
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as any)}
                  disabled={isCreatingActivity}
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                >
                  <option value="lesson">درس نظرى (Lesson)</option>
                  <option value="practice">تطبيق / تمرين (Practice)</option>
                  <option value="exam">امتحان / تقييم (Exam)</option>
                </select>
              </div>

              {/* General Isolation: Groups Selection */}
              <div className="p-4 rounded-2xl bg-surface-variant/20 border border-outline/15 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    <span>صلاحيات الرؤية والأفواج المتاحة</span>
                  </span>
                  {allowedActivityGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActivityGroupIds(allowedActivityGroups.map((g) => g.id!))}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      تحديد جميع الأفواج
                    </button>
                  )}
                </div>

                {allowedActivityGroups.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    تنبيه: الفصل الأب غير مخصص لأي فوج بعد. يرجى تخصيص الأفواج للفصل أولاً.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allowedActivityGroups.map((g) => {
                      const isSel = activityGroupIds.includes(g.id!);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              setActivityGroupIds(activityGroupIds.filter((id) => id !== g.id));
                            } else {
                              setActivityGroupIds([...activityGroupIds, g.id!]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                            isSel
                              ? "bg-primary text-on-primary border-primary shadow-xs"
                              : "bg-surface text-on-surface border-outline/20 hover:border-primary/40"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{g.name}</span>
                          {isSel && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-on-surface">
                  <input
                    type="checkbox"
                    checked={hasQuiz}
                    onChange={(e) => setHasQuiz(e.target.checked)}
                    className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary"
                  />
                  <span>يتضمن اختباراً تفاعلياً (Quiz)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-on-surface">
                  <input
                    type="checkbox"
                    checked={requireSubmission}
                    onChange={(e) => setRequireSubmission(e.target.checked)}
                    className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary"
                  />
                  <span>يتطلب تسليم إجابة من الطالب</span>
                </label>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  disabled={isCreatingActivity}
                  className="flex-1 h-12 rounded-xl bg-surface-variant/60 text-on-surface-variant font-bold text-sm hover:bg-surface-variant transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isCreatingActivity}
                  className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isCreatingActivity ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الإضافة...</span>
                    </>
                  ) : (
                    <span>إضافة النشاط</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

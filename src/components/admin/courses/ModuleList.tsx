"use client";

import React, { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import {
  ModuleDoc,
  ActivityDoc,
  updateModuleVisibility,
  updateActivityVisibility,
  updateModule,
  updateActivity,
} from "@/src/lib/firebase/coursesService";
import { GroupDoc } from "@/src/lib/firebase/groupsService";
import { MD3Switch } from "./MD3Switch";
import { StudentExceptionsModal } from "@/src/components/admin/activities/StudentExceptionsModal";
import {
  ChevronDown,
  ChevronLeft,
  BookOpen,
  Dumbbell,
  Trophy,
  Plus,
  Trash2,
  Edit,
  Video,
  FileText,
  HelpCircle,
  FolderOpen,
  X,
  Loader2,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  EyeOff,
  FileCode,
} from "lucide-react";

interface ModuleListProps {
  courseId: string;
  courseGroupIds?: string[];
  availableGroups?: GroupDoc[];
  modules: ModuleDoc[];
  activities: ActivityDoc[];
  onRefresh: () => void;
  onAddActivity: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
  onDeleteActivity: (activityId: string) => void;
}

export function ModuleList({
  courseId,
  courseGroupIds = [],
  availableGroups = [],
  modules,
  activities,
  onRefresh,
  onAddActivity,
  onDeleteModule,
  onDeleteActivity,
}: ModuleListProps) {
  // Subset Rule: Filter available groups to ONLY those allowed by the parent course
  const allowedCourseGroups = availableGroups.filter(
    (g) => g.status !== "archived" && courseGroupIds.includes(g.id!)
  );

  // Optimistic UI Local States
  const [localModules, setLocalModules] = useState<ModuleDoc[]>(modules);
  const [localActivities, setLocalActivities] = useState<ActivityDoc[]>(activities);

  // Accordion Expanded States
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Edit Module Modal State with Granular Visibility & Exceptions
  const [editingModule, setEditingModule] = useState<ModuleDoc | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");
  const [editModuleGroupIds, setEditModuleGroupIds] = useState<string[]>([]);
  const [editModuleExcludedStudentIds, setEditModuleExcludedStudentIds] = useState<string[]>([]);
  const [isUpdatingModule, setIsUpdatingModule] = useState(false);
  const [isModuleExceptionsModalOpen, setIsModuleExceptionsModalOpen] = useState(false);
  const [groupNotice, setGroupNotice] = useState(false);

  // Edit Activity Modal State
  const [editingActivity, setEditingActivity] = useState<ActivityDoc | null>(null);
  const [editActivityTitle, setEditActivityTitle] = useState("");
  const [editActivityType, setEditActivityType] = useState<"lesson" | "practice" | "exam">("lesson");
  const [editRequireSubmission, setEditRequireSubmission] = useState(false);
  const [editHasQuiz, setEditHasQuiz] = useState(false);
  const [isUpdatingActivity, setIsUpdatingActivity] = useState(false);

  useEffect(() => {
    setLocalModules(modules);
  }, [modules]);

  useEffect(() => {
    setLocalActivities(activities);
  }, [activities]);

  useEffect(() => {
    if (modules.length > 0) {
      const initial: Record<string, boolean> = {};
      modules.forEach((mod) => {
        if (mod.id) initial[mod.id] = true;
      });
      setExpandedModules(initial);
    }
  }, [modules]);

  const toggleExpand = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  // Optimistic Module Visibility Toggle
  const handleToggleModuleVisibility = async (moduleId: string, newStatus: boolean) => {
    setLocalModules((prev) =>
      prev.map((mod) => (mod.id === moduleId ? { ...mod, isVisible: newStatus } : mod))
    );

    try {
      await updateModuleVisibility(moduleId, newStatus);
    } catch (error) {
      console.error("Failed to update module visibility:", error);
      setLocalModules(modules);
      alert("فشل تحديث حالة رؤية الفصل.");
    }
  };

  // Optimistic Activity Visibility Toggle
  const handleToggleActivityVisibility = async (activityId: string, newStatus: boolean) => {
    setLocalActivities((prev) =>
      prev.map((act) => (act.id === activityId ? { ...act, isVisible: newStatus } : act))
    );

    try {
      await updateActivityVisibility(activityId, newStatus);
    } catch (error) {
      console.error("Failed to update activity visibility:", error);
      setLocalActivities(activities);
      alert("فشل تحديث حالة رؤية النشاط.");
    }
  };

  // Edit Module Handlers
  const handleOpenEditModule = (e: React.MouseEvent, module: ModuleDoc) => {
    e.stopPropagation();
    setEditingModule(module);
    setEditModuleTitle(module.title);
    setEditModuleGroupIds(module.groupIds || courseGroupIds);
    setEditModuleExcludedStudentIds(module.excludedStudentIds || []);
  };

  const handleToggleModuleGroup = (gId: string) => {
    setGroupNotice(false);
    setEditModuleGroupIds((prev) =>
      prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
    );
  };

  const handleSelectAllModuleGroups = () => {
    setGroupNotice(false);
    const allIds = allowedCourseGroups.map((g) => g.id!).filter(Boolean);
    setEditModuleGroupIds(allIds);
  };

  const handleSaveModuleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingModule || !editingModule.id || !editModuleTitle.trim()) return;

    setIsUpdatingModule(true);
    try {
      await updateModule(editingModule.id, {
        title: editModuleTitle.trim(),
        groupIds: editModuleGroupIds,
        excludedStudentIds: editModuleExcludedStudentIds,
      });
      setEditingModule(null);
      onRefresh();
    } catch (error) {
      console.error("Failed to update module:", error);
      alert("حدث خطأ أثناء تعديل الفصل.");
    } finally {
      setIsUpdatingModule(false);
    }
  };

  // Edit Activity Handlers
  const handleOpenEditActivity = (e: React.MouseEvent, activity: ActivityDoc) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingActivity(activity);
    setEditActivityTitle(activity.title);
    setEditActivityType(activity.type);
    setEditRequireSubmission(Boolean(activity.requireSubmission));
    setEditHasQuiz(Boolean(activity.hasQuiz));
  };

  const handleSaveActivityEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !editingActivity.id || !editActivityTitle.trim()) return;

    setIsUpdatingActivity(true);
    try {
      await updateActivity(editingActivity.id, {
        title: editActivityTitle.trim(),
        type: editActivityType,
        requireSubmission: editRequireSubmission,
        hasQuiz: editHasQuiz,
      });
      setEditingActivity(null);
      onRefresh();
    } catch (error) {
      console.error("Failed to update activity:", error);
      alert("حدث خطأ أثناء تعديل النشاط.");
    } finally {
      setIsUpdatingActivity(false);
    }
  };

  if (localModules.length === 0) {
    return (
      <div className="p-12 rounded-3xl bg-surface-variant/20 border border-dashed border-outline/30 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-primary-container text-on-primary-container flex items-center justify-center mx-auto shadow-sm">
          <FolderOpen className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-on-surface">لا توجد فصول بعد</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            قم بإضافة الفصل الأول لبدء هيكلة الدروس والأنشطة والامتحانات التفاعلية.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {localModules.map((module, index) => {
        const isExpanded = module.id ? !!expandedModules[module.id] : true;
        const moduleActivities = localActivities.filter((act) => act.moduleId === module.id);

        return (
          <div
            key={module.id || index}
            className="bg-surface border border-outline/15 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            {/* Module Accordion Header */}
            <div className="p-5 flex items-center justify-between gap-4 bg-surface-variant/20 border-b border-outline/10 select-none">
              {/* Right Side: Expand Button + Module Title */}
              <div
                onClick={() => module.id && toggleExpand(module.id)}
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <button
                  type="button"
                  className={`p-1.5 rounded-xl bg-surface border border-outline/20 text-on-surface-variant transition-transform duration-200 ${
                    isExpanded ? "rotate-180 text-primary" : ""
                  }`}
                  aria-label="توسيع / طي الفصل"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary">
                      الفصل {index + 1}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-on-surface">
                      {module.title}
                    </h3>
                  </div>
                  <p className="text-xs text-on-surface-variant/80 mt-0.5">
                    {moduleActivities.length} أنشطة تعليمية
                  </p>
                </div>
              </div>

              {/* Left Side: MD3 Visibility Switch + Edit & Delete Actions */}
              <div className="flex items-center gap-3">
                <MD3Switch
                  id={`module-visibility-${module.id}`}
                  checked={module.isVisible}
                  onChange={(val) => module.id && handleToggleModuleVisibility(module.id, val)}
                  label={module.isVisible ? "مرئي" : "مخفي"}
                />

                <button
                  type="button"
                  onClick={(e) => handleOpenEditModule(e, module)}
                  className="p-2 rounded-xl text-on-surface-variant/70 hover:text-primary hover:bg-primary/10 transition-colors"
                  aria-label="تعديل الفصل"
                  title="تعديل الفصل وصلاحيات الرؤية"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => module.id && onDeleteModule(module.id)}
                  className="p-2 rounded-xl text-on-surface-variant/60 hover:text-error hover:bg-error-container/30 transition-colors"
                  aria-label="حذف الفصل"
                  title="حذف الفصل"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Module Expanded Content (Activity List) */}
            {isExpanded && (
              <div className="p-5 space-y-4 animate-fadeIn bg-surface">
                {moduleActivities.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-surface-variant/20 border border-outline/10 text-center space-y-2">
                    <p className="text-xs text-on-surface-variant">
                      لا توجد أنشطة داخل هذا الفصل بعد.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {moduleActivities.map((act) => {
                      let Icon = BookOpen;
                      let typeLabel = "درس";
                      let badgeStyle = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";

                      if (act.type === "practice") {
                        Icon = Dumbbell;
                        typeLabel = "تطبيق / تمرين";
                        badgeStyle = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
                      } else if (act.type === "exam") {
                        Icon = Trophy;
                        typeLabel = "امتحان / تقييم";
                        badgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
                      }

                      return (
                        <div
                          key={act.id}
                          className="group relative p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between gap-4 hover:bg-surface-variant/60 hover:border-primary/30 transition-all duration-200"
                        >
                          <Link
                            href={`/admin/courses/${courseId}/activities/${act.id}`}
                            className="flex items-center gap-3.5 flex-1 min-w-0"
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${badgeStyle}`}>
                              <Icon className="w-5 h-5" />
                            </div>

                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                                  {act.title}
                                </h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeStyle}`}>
                                  {typeLabel}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-on-surface-variant/70 flex-wrap">
                                {act.videos && act.videos.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Video className="w-3.5 h-3.5 text-primary" />
                                    <span>{act.videos.length} فيديو</span>
                                  </span>
                                )}
                                {act.attachments && act.attachments.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-secondary" />
                                    <span>{act.attachments.length} مرفقات</span>
                                  </span>
                                )}
                                {act.hasQuiz && (
                                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <HelpCircle className="w-3.5 h-3.5" />
                                    <span>اختبار تفاعلي</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <ChevronLeft className="w-4 h-4 text-on-surface-variant/50 group-hover:text-primary group-hover:-translate-x-1 transition-all shrink-0 ml-2" />
                          </Link>

                          <div
                            className="flex items-center gap-3 shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <MD3Switch
                              id={`activity-visibility-${act.id}`}
                              checked={act.isVisible}
                              onChange={(val) => act.id && handleToggleActivityVisibility(act.id, val)}
                              label={act.isVisible ? "مرئي" : "مخفي"}
                            />

                            <button
                              type="button"
                              onClick={(e) => handleOpenEditActivity(e, act)}
                              className="p-1.5 rounded-lg text-on-surface-variant/70 hover:text-primary hover:bg-primary/10 transition-colors"
                              aria-label="تعديل النشاط"
                              title="تعديل النشاط"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (act.id) onDeleteActivity(act.id);
                              }}
                              className="p-1.5 rounded-lg text-on-surface-variant/60 hover:text-error hover:bg-error-container/30 transition-colors"
                              aria-label="حذف النشاط"
                              title="حذف النشاط"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => module.id && onAddActivity(module.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة نشاط جديد</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Edit Module Modal with Granular Visibility & Subset Rule */}
      {editingModule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>تعديل الفصل وصلاحيات الرؤية</span>
              </h2>
              <button
                type="button"
                onClick={() => setEditingModule(null)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModuleEdit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  عنوان الفصل <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={editModuleTitle}
                  onChange={(e) => setEditModuleTitle(e.target.value)}
                  disabled={isUpdatingModule}
                  required
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>

              {/* Task C: Granular Visibility & Subset Rule inside Module Modal */}
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

                {/* Group Chips Filtered by Course Group Subset */}
                {allowedCourseGroups.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    تنبيه: الدورة التعليمية الأب غير مخصصة لأي فوج بعد. يرجى تخصيص الأفواج للدورة أولاً.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allowedCourseGroups.map((g) => {
                      const isSel = editModuleGroupIds.includes(g.id!);
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

                {/* Student Exceptions Trigger for Module */}
                <div className="pt-2 border-t border-outline/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">استثناءات تلاميذ الفصل</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (editModuleGroupIds.length === 0) {
                        setGroupNotice(true);
                        setTimeout(() => setGroupNotice(false), 4000);
                        return;
                      }
                      setIsModuleExceptionsModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>تخصيص استثناءات الفصل</span>
                    {editModuleExcludedStudentIds.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-error text-white font-extrabold text-[9px] flex items-center justify-center">
                        {editModuleExcludedStudentIds.length}
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

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingModule(null)}
                  disabled={isUpdatingModule}
                  className="flex-1 h-12 rounded-xl bg-surface-variant/60 text-on-surface-variant font-bold text-sm hover:bg-surface-variant transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingModule}
                  className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isUpdatingModule ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التحديث...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Module Student Exceptions Modal */}
      <StudentExceptionsModal
        isOpen={isModuleExceptionsModalOpen}
        onClose={() => setIsModuleExceptionsModalOpen(false)}
        selectedGroupIds={editModuleGroupIds}
        groups={allowedCourseGroups}
        excludedStudentIds={editModuleExcludedStudentIds}
        onSave={(newEx) => setEditModuleExcludedStudentIds(newEx)}
      />

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <FileCode className="w-5 h-5 text-primary" />
                <span>تعديل النشاط التعليمي</span>
              </h2>
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActivityEdit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  عنوان النشاط <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={editActivityTitle}
                  onChange={(e) => setEditActivityTitle(e.target.value)}
                  disabled={isUpdatingActivity}
                  required
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  نوع النشاط <span className="text-error">*</span>
                </label>
                <select
                  value={editActivityType}
                  onChange={(e) => setEditActivityType(e.target.value as any)}
                  disabled={isUpdatingActivity}
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                >
                  <option value="lesson">درس نظرى (Lesson)</option>
                  <option value="practice">تطبيق / تمرين (Practice)</option>
                  <option value="exam">امتحان / تقييم (Exam)</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-on-surface">
                  <input
                    type="checkbox"
                    checked={editHasQuiz}
                    onChange={(e) => setEditHasQuiz(e.target.checked)}
                    className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary"
                  />
                  <span>يتضمن اختباراً تفاعلياً (Quiz)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-on-surface">
                  <input
                    type="checkbox"
                    checked={editRequireSubmission}
                    onChange={(e) => setEditRequireSubmission(e.target.checked)}
                    className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary"
                  />
                  <span>يتطلب تسليم إجابة من الطالب</span>
                </label>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  disabled={isUpdatingActivity}
                  className="flex-1 h-12 rounded-xl bg-surface-variant/60 text-on-surface-variant font-bold text-sm hover:bg-surface-variant transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingActivity}
                  className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isUpdatingActivity ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
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

export default ModuleList;

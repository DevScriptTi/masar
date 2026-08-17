"use client";

import React, { useState, useEffect, use, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCourseById,
  getModuleById,
  updateActivity,
  ActivityDoc,
  CourseDoc,
  ModuleDoc,
  QuizQuestionItem,
  AttachmentItem,
} from "@/src/lib/firebase/coursesService";
import { HomeworkUploader } from "@/src/components/student/HomeworkUploader";
import { fetchGroups, GroupDoc } from "@/src/lib/firebase/groupsService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { MD3Switch } from "@/src/components/admin/courses/MD3Switch";
import { QuizBuilder } from "@/src/components/admin/activities/QuizBuilder";
import { StudentPreview, MathText } from "@/src/components/admin/activities/StudentPreview";
import { StudentExceptionsModal } from "@/src/components/admin/activities/StudentExceptionsModal";
import { ActivitySubmissionsList } from "@/src/components/admin/evaluations/ActivitySubmissionsList";
import { RichTextEditor } from "@/src/components/admin/RichTextEditor";
import {
  ChevronLeft,
  Save,
  Loader2,
  Video,
  FileText,
  Plus,
  Trash2,
  HelpCircle,
  CheckCircle2,
  Sparkles,
  Eye,
  Edit,
  Users,
  EyeOff,
  AlertCircle,
  UserCheck,
  Layers,
  Code,
  ExternalLink,
  FileUp,
  X,
} from "lucide-react";

export default function ActivityEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const activityId = resolvedParams.activityId;
  const router = useRouter();

  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [parentModule, setParentModule] = useState<ModuleDoc | null>(null);
  const [activity, setActivity] = useState<ActivityDoc | null>(null);
  const [availableGroups, setAvailableGroups] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Global Editor Mode State
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Form States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"lesson" | "practice" | "exam">("lesson");
  const [isVisible, setIsVisible] = useState(true);
  const [requireSubmission, setRequireSubmission] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestionItem[]>([]);

  // Strict Intersection Rule & Auto-Cleanup State
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);
  const [isExceptionsModalOpen, setIsExceptionsModalOpen] = useState(false);
  const [groupNotice, setGroupNotice] = useState(false);

  // Video Links
  const [videos, setVideos] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState("");

  // Structured Attachment Links (PDFs / Videos / Cloudinary + LaTeX Context)
  const [attachments, setAttachments] = useState<(string | AttachmentItem)[]>([]);
  const [isAttModalOpen, setIsAttModalOpen] = useState(false);
  const [attTitle, setAttTitle] = useState("");
  const [attType, setAttType] = useState<"pdf" | "video">("pdf");
  const [attUrl, setAttUrl] = useState("");
  const [attDescription, setAttDescription] = useState("");
  const [attLatexContent, setAttLatexContent] = useState("");
  const [editingAttIndex, setEditingAttIndex] = useState<number | null>(null);

  const handleOpenAddAttModal = () => {
    setAttTitle("");
    setAttType("pdf");
    setAttUrl("");
    setAttDescription("");
    setAttLatexContent("");
    setEditingAttIndex(null);
    setIsAttModalOpen(true);
  };

  const handleOpenEditAttModal = (index: number) => {
    const item = attachments[index];
    if (typeof item === "string") {
      setAttTitle("ملف مرفق");
      setAttType(item.toLowerCase().includes("video") ? "video" : "pdf");
      setAttUrl(item);
      setAttDescription("");
      setAttLatexContent("");
    } else {
      setAttTitle(item.title || "");
      setAttType(item.type || "pdf");
      setAttUrl(item.url || "");
      setAttDescription(item.description || "");
      setAttLatexContent(item.latexContent || "");
    }
    setEditingAttIndex(index);
    setIsAttModalOpen(true);
  };

  const handleSaveAttachmentItem = () => {
    if (!attTitle.trim() || !attUrl.trim()) {
      alert("يرجى إدخال عنوان المرفق ورابط الملف أو الفيديو.");
      return;
    }

    const newItem: AttachmentItem = {
      id: editingAttIndex !== null && typeof attachments[editingAttIndex] !== "string"
        ? (attachments[editingAttIndex] as AttachmentItem).id || String(Date.now())
        : String(Date.now()),
      title: attTitle.trim(),
      type: attType,
      url: attUrl.trim(),
      description: attDescription.trim(),
      latexContent: attLatexContent.trim(),
    };

    if (editingAttIndex !== null) {
      setAttachments((prev) => prev.map((item, idx) => (idx === editingAttIndex ? newItem : item)));
    } else {
      setAttachments((prev) => [...prev, newItem]);
    }

    setIsAttModalOpen(false);
  };

  const handleRemoveAttachmentItem = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchActivityData = async () => {
    setLoading(true);
    try {
      const [courseData, actSnap, groupsData] = await Promise.all([
        getCourseById(courseId),
        getDoc(doc(db, "activities", activityId)),
        fetchGroups(),
      ]);

      if (!actSnap.exists()) {
        alert("لم يتم العثور على هذا النشاط التعليمي.");
        router.push(`/admin/courses/${courseId}`);
        return;
      }

      const actData = { id: actSnap.id, ...(actSnap.data() as Omit<ActivityDoc, "id">) };

      // Fetch parent Module document
      let moduleData: ModuleDoc | null = null;
      if (actData.moduleId) {
        moduleData = await getModuleById(actData.moduleId);
      }

      setCourse(courseData);
      setParentModule(moduleData);
      setActivity(actData);

      // Strict Intersection Rule Calculation
      // Step 1: Base course allowed group IDs
      const courseGroupIds = courseData?.groupIds || [];
      let activityAllowedGroupIds = [...courseGroupIds];

      // Step 2 (Intersection): IF parent Module has groupIds defined AND length > 0, further restrict!
      const moduleGroupIds = moduleData?.groupIds || [];
      if (moduleGroupIds.length > 0) {
        if (activityAllowedGroupIds.length > 0) {
          activityAllowedGroupIds = activityAllowedGroupIds.filter((gId) =>
            moduleGroupIds.includes(gId)
          );
        } else {
          activityAllowedGroupIds = [...moduleGroupIds];
        }
      }

      // Filter active groups from Firestore against activityAllowedGroupIds
      const activityAvailableGroups = groupsData.filter(
        (g) => g.status !== "archived" && activityAllowedGroupIds.includes(g.id!)
      );
      setAvailableGroups(activityAvailableGroups);

      // Auto-Cleanup: Silently remove phantom group IDs that are no longer allowed
      const currentActivityGroupIds = actData.groupIds || [];
      const sanitizedActivityGroupIds = currentActivityGroupIds.filter((gId) =>
        activityAllowedGroupIds.includes(gId)
      );

      setGroupIds(
        sanitizedActivityGroupIds.length > 0
          ? sanitizedActivityGroupIds
          : activityAllowedGroupIds
      );

      setTitle(actData.title || "");
      setDescription(actData.description || "");
      setType(actData.type || "lesson");
      setIsVisible(Boolean(actData.isVisible));
      setRequireSubmission(Boolean(actData.requireSubmission));
      setHasQuiz(Boolean(actData.hasQuiz));
      setQuiz(actData.quiz || []);
      setExcludedStudentIds(actData.excludedStudentIds || []);
      setVideos(actData.videos || []);
      setAttachments(actData.attachments || []);
    } catch (error) {
      console.error("Error fetching activity data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activityId) {
      fetchActivityData();
    }
  }, [activityId]);

  // Group Selection Handlers
  const handleToggleGroup = (gId: string) => {
    setGroupNotice(false);
    setGroupIds((prev) =>
      prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
    );
  };

  const handleSelectAllGroups = () => {
    setGroupNotice(false);
    const allActiveIds = availableGroups.map((g) => g.id!).filter(Boolean);
    setGroupIds(allActiveIds);
  };

  // Open Exceptions Modal Trigger
  const handleOpenExceptionsModal = () => {
    if (groupIds.length === 0) {
      setGroupNotice(true);
      setTimeout(() => setGroupNotice(false), 4000);
      return;
    }
    setIsExceptionsModalOpen(true);
  };



  // Video URL Handlers
  const handleAddVideo = () => {
    if (!newVideoUrl.trim()) return;
    setVideos((prev) => [...prev, newVideoUrl.trim()]);
    setNewVideoUrl("");
  };

  const handleRemoveVideo = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Activity Handler
  const handleSaveActivity = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      alert("يرجى إدخال عنوان النشاط.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateActivity(activityId, {
        title: title.trim(),
        description: description.trim(),
        type,
        isVisible,
        requireSubmission,
        hasQuiz,
        quiz,
        groupIds,
        excludedStudentIds,
        videos,
        attachments,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving activity:", error);
      alert("حدث خطأ أثناء حفظ التغييرات.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="text-sm font-semibold text-on-surface-variant">جاري تحميل النشاط التعليمي...</p>
      </div>
    );
  }

  if (!activity) return null;

  const parentModuleExcludedStudentIds = parentModule?.excludedStudentIds || [];

  // Active document structure for Preview Mode
  const previewDoc: ActivityDoc = {
    id: activityId,
    courseId,
    moduleId: activity.moduleId,
    title: title || activity.title,
    description,
    type,
    isVisible,
    order: activity.order,
    videos,
    attachments,
    requireSubmission,
    hasQuiz,
    quiz,
    groupIds,
    excludedStudentIds,
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
      {/* Sticky MD3 Top Bar */}
      <header className="sticky top-4 z-40 bg-surface/90 backdrop-blur-xl border border-outline/15 rounded-3xl p-4 sm:px-6 shadow-lg flex items-center justify-between gap-4 transition-all">
        {/* Task A & B: Refined RTL Breadcrumbs Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant min-w-0 flex-wrap">
          <Link
            href="/admin/courses"
            className="hover:text-primary hover:underline transition-colors shrink-0"
          >
            إدارة الدورات
          </Link>

          <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />

          <Link
            href={`/admin/courses/${courseId}`}
            className="hover:text-primary hover:underline transition-colors max-w-[120px] md:max-w-none truncate md:whitespace-normal"
          >
            {course?.title || "مصمم الدورة"}
          </Link>

          {parentModule && (
            <>
              <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />
              <span className="text-on-surface-variant font-semibold flex items-center gap-1 max-w-[100px] md:max-w-none truncate md:whitespace-normal">
                <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{parentModule.title}</span>
              </span>
            </>
          )}

          <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />

          <span
            aria-current="page"
            className="text-on-surface font-bold max-w-[150px] md:max-w-none truncate md:whitespace-normal cursor-default"
          >
            {title}
          </span>
        </nav>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`px-4 h-10 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shadow-xs ${
              isPreviewMode
                ? "bg-primary-container text-on-primary-container border border-primary/30"
                : "bg-surface-variant/50 text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            {isPreviewMode ? (
              <>
                <Edit className="w-4 h-4 text-primary" />
                <span>العودة إلى المحرر</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-primary" />
                <span>معاينة كطالب</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSaveActivity()}
            disabled={isSaving}
            className="px-5 h-10 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>تم الحفظ!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التغييرات</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Conditionally Render Preview Mode OR Full Editor */}
      {isPreviewMode ? (
        <StudentPreview activity={previewDoc} courseTitle={course?.title} />
      ) : (
        <form onSubmit={handleSaveActivity} className="space-y-6 animate-fadeIn" noValidate>
          {/* Card 1: General Info & Description */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2 border-b border-outline/10 pb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>معلومات النشاط الأساسية والمحتوى</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  عنوان النشاط التعليمي <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="عنوان الدرس أو التمرين..."
                  required
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                />
              </div>

              {/* Description Textarea with Live Preview Box */}
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-xs font-semibold text-on-surface-variant flex items-center justify-between">
                  <span>الشرح وتفاصيل الدرس (يدعم معادلات LaTeX مثل $E = mc^2$)</span>
                </label>
                <RichTextEditor
                  value={description}
                  onChange={(val) => setDescription(val)}
                  placeholder="أدخل نص الدرس الشارح مع القوانين والمعادلات الرياضية..."
                />

                {description.trim() && (
                  <div className="p-4 rounded-2xl bg-surface-variant/20 border border-primary/20 space-y-2 animate-fadeIn">
                    <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>المعاينة الحية للشرح والرموز (Live Preview)</span>
                    </span>
                    <div className="text-xs text-on-surface leading-relaxed bg-surface p-3.5 rounded-xl border border-outline/10">
                      <MathText content={description} />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  نوع النشاط
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                >
                  <option value="lesson">درس نظرى (Lesson)</option>
                  <option value="practice">تطبيق / تمرين (Practice)</option>
                  <option value="exam">امتحان / تقييم (Exam)</option>
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="p-3 rounded-xl bg-surface-variant/30 border border-outline/20 flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">حالة الرؤية العامة:</span>
                  <MD3Switch
                    id="activity-general-visibility"
                    checked={isVisible}
                    onChange={setIsVisible}
                    label={isVisible ? "مرئي" : "مخفي"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Group Selection & Exceptions */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-outline/10 pb-3">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span>صلاحيات الرؤية والأفواج (Strict Intersection Rule)</span>
              </h3>
              {availableGroups.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllGroups}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  تحديد جميع الأفواج المتاحة
                </button>
              )}
            </div>

            {availableGroups.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>يجب تحديد أفواج للفصل الأب أو المسار أولاً لتتمكن من تخصيصها هنا</span>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  اختر الأفواج المتاح لها رؤية هذا النشاط (مفلترة بحاصل تقاطع أفواج المسار والفصل الأب):
                </label>

                <div className="flex flex-wrap gap-2.5">
                  {availableGroups.map((g) => {
                    const isSelected = groupIds.includes(g.id!);

                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleToggleGroup(g.id!)}
                        className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2 shadow-2xs ${
                          isSelected
                            ? "bg-primary text-on-primary border-primary shadow-xs"
                            : "bg-surface-variant/30 text-on-surface border-outline/20 hover:border-primary/40 hover:bg-surface-variant/60"
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        <span>{g.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-outline/10 space-y-3">
              {groupNotice && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>الرجاء تحديد فوج واحد على الأقل أولاً لتتمكن من تخصيص استثناءات التلاميذ.</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-on-surface">استثناءات تلاميذ محددين</h4>
                  <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
                    اختر تلاميذ معينين لإخفاء النشاط عنهم حتى لو كان فوجهم مختاراً
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenExceptionsModal}
                  disabled={availableGroups.length === 0}
                  className="px-4 h-11 rounded-2xl border border-primary/40 bg-primary/5 text-primary font-extrabold text-xs hover:bg-primary/10 transition-all flex items-center gap-2 shrink-0 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>تخصيص الرؤية لتلاميذ محددين</span>
                  {excludedStudentIds.length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-error text-white font-extrabold text-[10px] flex items-center justify-center">
                      {excludedStudentIds.length}
                    </span>
                  )}
                </button>
              </div>

              {parentModuleExcludedStudentIds.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>هناك {parentModuleExcludedStudentIds.length} تلميذ محظور تلقائياً على مستوى الفصل الأب.</span>
                </div>
              )}

              {excludedStudentIds.length > 0 && (
                <div className="p-3 rounded-xl bg-error-container/20 border border-error/20 text-xs font-semibold text-error flex items-center gap-2">
                  <EyeOff className="w-4 h-4" />
                  <span>تم استثناء {excludedStudentIds.length} تلميذ إضافي من رؤية هذا النشاط.</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Videos */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2 border-b border-outline/10 pb-3">
              <Video className="w-5 h-5 text-primary" />
              <span>فيديوهات الشرح</span>
            </h3>

            {videos.length > 0 && (
              <div className="space-y-2">
                {videos.map((vid, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Video className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-mono text-on-surface dir-ltr truncate" dir="ltr">{vid}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveVideo(idx)}
                      className="p-1.5 rounded-lg text-on-surface-variant/70 hover:text-error hover:bg-error-container/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
                placeholder="ضع رابط فيديو الشرح هنا (YouTube, Vimeo, etc.)..."
                dir="ltr"
                className="flex-1 h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <button
                type="button"
                onClick={handleAddVideo}
                className="px-4 h-11 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة فيديو</span>
              </button>
            </div>
          </div>

          {/* Card 4: Attachments (PDF Files, Videos & LaTeX Reference Context) */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-outline/10 pb-3">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <FileText className="w-5 h-5 text-secondary" />
                <span>المرفقات والملفات المنهجية (PDF / فيديو + أكواد LaTeX للمساعد الذكي)</span>
              </h3>
              <button
                type="button"
                onClick={handleOpenAddAttModal}
                className="px-4 h-10 rounded-xl bg-secondary text-on-secondary font-bold text-xs hover:bg-secondary/90 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مرفق جديد</span>
              </button>
            </div>

            {attachments.length > 0 ? (
              <div className="space-y-3">
                {attachments.map((item, idx) => {
                  const isStr = typeof item === "string";
                  const titleStr = isStr ? `مرفق #${idx + 1}` : item.title;
                  const typeStr = isStr ? "pdf" : item.type || "pdf";
                  const urlStr = isStr ? item : item.url;
                  const descStr = !isStr ? item.description : "";
                  const hasLatex = !isStr && Boolean(item.latexContent?.trim());

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-surface-variant/20 border border-outline/15 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {typeStr === "video" ? (
                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Video className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}
                          <div className="truncate">
                            <h4 className="text-xs font-extrabold text-on-surface truncate">{titleStr}</h4>
                            <span className="text-[10px] font-mono text-on-surface-variant/70 dir-ltr block truncate" dir="ltr">
                              {urlStr}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {hasLatex && (
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-500/20 flex items-center gap-1">
                              <Code className="w-3 h-3" />
                              <span>LaTeX مرجعي للمساعد الذكي</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEditAttModal(idx)}
                            className="p-2 rounded-xl bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant transition-colors"
                            title="تعديل المرفق"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachmentItem(idx)}
                            className="p-2 rounded-xl text-error bg-error/10 hover:bg-error hover:text-on-error transition-colors"
                            title="حذف المرفق"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {descStr && (
                        <p className="text-xs text-on-surface-variant/80 font-medium pt-1 border-t border-outline/10">
                          {descStr}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-outline/20 rounded-2xl space-y-2">
                <FileUp className="w-8 h-8 text-on-surface-variant/50 mx-auto" />
                <p className="text-xs font-bold text-on-surface">لم يتم إضافة أي مرفقات لهذا الدرس بعد</p>
                <p className="text-[11px] text-on-surface-variant/70">
                  انقر على زر "إضافة مرفق جديد" لإدراج ملف PDF أو فيديو وتلقين المساعد الذكي بأكواد الـ LaTeX الخاصة بتمارين الدرس وحلولها النموذجية.
                </p>
              </div>
            )}
          </div>

          {/* Card 5: Interactive Quiz & Settings */}
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-tertiary" />
                <span>إعدادات الاختبار التفاعلي والتسليمات</span>
              </h3>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface">
                  <input
                    type="checkbox"
                    checked={hasQuiz}
                    onChange={(e) => setHasQuiz(e.target.checked)}
                    className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary"
                  />
                  <span>تفعيل اختبار تفاعلي (Quiz)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface">
                  <input
                    type="checkbox"
                    checked={requireSubmission}
                    onChange={(e) => setRequireSubmission(e.target.checked)}
                    className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary"
                  />
                  <span>يتطلب تسليم إجابة</span>
                </label>
              </div>
            </div>

            {hasQuiz && (
              <div className="pt-2">
                <QuizBuilder questions={quiz} onChange={setQuiz} />
              </div>
            )}
          </div>
        </form>
      )}

      {/* Task B: Localized Student Submissions Section for this Activity */}
      {(requireSubmission || hasQuiz) && (
        <div className="mt-10">
          <hr className="my-8 border-outline/20" />
          <ActivitySubmissionsList activityId={activityId} />
        </div>
      )}

      {/* Student Exceptions Modal */}
      <StudentExceptionsModal
        isOpen={isExceptionsModalOpen}
        onClose={() => setIsExceptionsModalOpen(false)}
        selectedGroupIds={groupIds}
        groups={availableGroups}
        excludedStudentIds={excludedStudentIds}
        parentExcludedStudentIds={parentModuleExcludedStudentIds}
        onSave={(newExcluded) => setExcludedStudentIds(newExcluded)}
      />

      {/* Modal Dialog for Adding / Editing Structured Attachment with LaTeX Context */}
      {isAttModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="bg-surface border border-outline/20 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline/15 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-on-surface">
                    {editingAttIndex !== null ? "تعديل المرفق والحل المرجعي" : "إضافة مرفق وحل مرجعي جديد"}
                  </h3>
                  <p className="text-xs text-on-surface-variant/80">
                    أدخل تفاصيل المرفق وأكواد الـ LaTeX ليتدرب عليها المساعد الذكي
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAttModalOpen(false)}
                className="w-9 h-9 rounded-full bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Title */}
              <div className="space-y-1">
                <label className="block font-bold text-on-surface">عنوان المرفق <span className="text-error">*</span></label>
                <input
                  type="text"
                  value={attTitle}
                  onChange={(e) => setAttTitle(e.target.value)}
                  placeholder="مثال: سلسلة تمارين الأعداد والحساب (حلول نموذجية)"
                  className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-semibold text-xs focus:outline-none focus:border-primary"
                />
              </div>

              {/* Type & URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-bold text-on-surface">نوع المرفق <span className="text-error">*</span></label>
                  <select
                    value={attType}
                    onChange={(e) => setAttType(e.target.value as "pdf" | "video")}
                    className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-semibold text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="pdf">مستند PDF / صورة</option>
                    <option value="video">فيديو شرح تفاعلي</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-on-surface">رابط الملف / الفيديو <span className="text-error">*</span></label>
                  <input
                    type="text"
                    value={attUrl}
                    onChange={(e) => setAttUrl(e.target.value)}
                    placeholder="رابط Cloudinary أو YouTube أو Google Drive..."
                    dir="ltr"
                    className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-semibold text-xs focus:outline-none focus:border-primary text-right"
                  />
                </div>
              </div>

              {/* Cloudinary Direct Uploader Helper */}
              <div className="p-3 rounded-2xl bg-surface-variant/20 border border-outline/10 space-y-2">
                <span className="text-[11px] font-bold text-on-surface-variant block">
                  أو يمكنك رفع ملف الـ PDF مباشرة إلى خادم المرفقات السحابية Cloudinary:
                </span>
                <HomeworkUploader
                  currentUrl={attUrl}
                  onUploadSuccess={(urls) => {
                    if (urls && urls.length > 0) setAttUrl(urls[0]);
                  }}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block font-bold text-on-surface">الوصف المختصر للتلميذ (اختياري)</label>
                <textarea
                  value={attDescription}
                  onChange={(e) => setAttDescription(e.target.value)}
                  rows={2}
                  placeholder="أدخل توجيهات أولية للتلميذ حول كيفية الاستفادة من هذا المرفق..."
                  className="w-full p-3.5 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-medium text-xs focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* LaTeX Code Master Context Box */}
              <div className="space-y-1.5 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
                <label className="block font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-indigo-500" />
                  <span>كود الـ LaTeX المرجعي والحلول النموذجية (خفي، مخصص فقط للمساعد الذكي)</span>
                </label>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  انسخ والصق كود الـ LaTeX الكامل للتمارين والحلول هنا. ستقوم الخوارزمية بحقن هذه الأكواد داخل الـ System Prompt للمساعد الذكي (Gemini) كمصادر مرجعية معتمدة لمقارنة حقيقة إجابات التلاميذ سقراطياً!
                </p>
                <textarea
                  value={attLatexContent}
                  onChange={(e) => setAttLatexContent(e.target.value)}
                  rows={6}
                  placeholder="مثال: \begin{exercise} أحسب PGCD(360, 132) \end{exercise} \begin{solution} PGCD = 12 \end{solution} ..."
                  dir="ltr"
                  className="w-full p-3.5 rounded-xl bg-surface/80 border border-indigo-500/30 text-on-surface font-mono text-xs focus:outline-none focus:border-indigo-500 resize-y text-left"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-outline/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAttModalOpen(false)}
                className="h-11 px-5 rounded-xl bg-surface-variant/40 text-on-surface-variant font-bold text-xs hover:bg-surface-variant transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAttachmentItem}
                className="h-11 px-6 rounded-xl bg-secondary text-on-secondary font-extrabold text-xs hover:bg-secondary/90 transition-all shadow-md flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>حفظ المرفق والحل المرجعي</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

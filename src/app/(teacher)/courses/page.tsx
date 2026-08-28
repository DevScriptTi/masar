"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  CourseDoc,
} from "@/src/lib/firebase/coursesService";
import { fetchGroups, GroupDoc } from "@/src/lib/firebase/groupsService";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  BookOpen,
  Plus,
  Loader2,
  Trash2,
  Edit,
  ChevronLeft,
  GraduationCap,
  Sparkles,
  Search,
  X,
  Users,
  Check,
  Bot,
} from "lucide-react";
import { useToast } from "@/src/components/ui/use-toast";
import { InlineAIRefiner } from "@/src/components/admin/activities/InlineAIRefiner";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/src/components/ui/alert-dialog";

export default function CoursesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseDoc | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [courseIndexContext, setCourseIndexContext] = useState("");
  const [courseDetailedLatex, setCourseDetailedLatex] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCurriculumCoPilot = () => {
    const template = `الكفاءة المستهدفة:
- تمكين التلميذ من استيعاب المفاهيم الأساسية وتحليل النتائج بدقة منهجية.

المحاور الأساسية:
- المحور 01: المفاهيم الأولية والتطبيقات التفاعلية.
- المحور 02: حل التمارين النموذجية وتعميق الفهم.

المكتسبات القبلية:
- التحكم في الحساب العددي وقواعد التحليل الرياضي الأساسية.`;

    setDescription(template);
    toast({
      title: "تم تطبيق قالب هيكلة المقرر 🤖",
      description: "تمت صياغة الهيكلية وفق المعايير الوزارية الجزائرية المعتمدة.",
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [coursesData, groupsData] = await Promise.all([
        getCourses(),
        fetchGroups(),
      ]);
      setCourses(coursesData);
      setGroups(groupsData.filter((g) => g.status !== "archived"));
    } catch (error) {
      console.error("Error loading courses or groups:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingCourse(null);
    setTitle("");
    setDescription("");
    setSelectedGroupIds([]);
    setCourseIndexContext("");
    setCourseDetailedLatex("");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, course: CourseDoc) => {
    e.stopPropagation();
    setEditingCourse(course);
    setTitle(course.title);
    setDescription(course.description || "");
    setSelectedGroupIds(course.groupIds || []);
    setCourseIndexContext(course.courseIndexContext || "");
    setCourseDetailedLatex(course.courseDetailedLatex || "");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleToggleGroupSelect = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSubmitCourse = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("يرجى إدخال عنوان الدورة التعليمية.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCourse && editingCourse.id) {
        // Edit Mode
        await updateCourse(editingCourse.id, {
          title: title.trim(),
          description: description.trim(),
          groupIds: selectedGroupIds,
          courseIndexContext: courseIndexContext.trim(),
          courseDetailedLatex: courseDetailedLatex.trim(),
        });
      } else {
        // Create Mode
        await createCourse({
          title: title.trim(),
          description: description.trim(),
          groupIds: selectedGroupIds,
          courseIndexContext: courseIndexContext.trim(),
          courseDetailedLatex: courseDetailedLatex.trim(),
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error: any) {
      console.error("Error saving course:", error);
      setErrorMessage(error?.message || "حدث خطأ أثناء حفظ بيانات الدورة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourseDirect = async (courseId: string) => {
    try {
      await deleteCourse(courseId);
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      toast({
        title: "تم حذف الدورة بنجاح 🗑️",
      });
    } catch (error) {
      console.error("Error deleting course:", error);
      toast({
        title: "حدث خطأ أثناء حذف الدورة",
        variant: "destructive",
      });
    }
  };

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            <span>إدارة الدورات والمناهج</span>
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            صمم الدورات التعليمية، اربطها بالأفواج الدراسية، وهيكل المنهج بكفاءة
          </p>
        </div>

        {/* Create Action Button */}
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="h-12 px-6 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة دورة جديدة</span>
        </button>
      </div>

      {/* Search Filter Input */}
      <div className="relative max-w-sm">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن دورة تعليمية..."
          className="w-full h-11 pr-11 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200"
        />
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/70 pointer-events-none" />
      </div>

      {/* Content Grid / Loading / Empty */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-xs font-semibold text-on-surface-variant">جاري تحميل الدورات التعليمية...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="p-12 rounded-3xl bg-surface-variant/20 border border-dashed border-outline/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-primary-container text-on-primary-container flex items-center justify-center mx-auto shadow-sm">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-on-surface">لا توجد دورات تعليمية</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              {searchQuery ? "لم يتم العثور على نتائج مطابقة للبحث." : "قم بإضافة دورة جديدة لتبدأ في تصميم الفصول والأنشطة."}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all"
            >
              إنشاء أول دورة الآن
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const linkedCount = course.groupIds ? course.groupIds.length : 0;

            return (
              <div
                key={course.id}
                onClick={() => router.push(`/teacher/courses/${course.id}`)}
                className="group bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>

                    {/* Card Action Buttons (Edit & Delete) */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(e, course)}
                        className="p-2 rounded-xl text-on-surface-variant/70 hover:text-primary hover:bg-primary/10 transition-colors"
                        title="تعديل الدورة"
                        aria-label="تعديل الدورة"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <CourseDeleteDialog
                        courseTitle={course.title}
                        onConfirmDelete={() => course.id && handleDeleteCourseDirect(course.id)}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                      {course.title}
                    </h3>
                    <p className="text-xs text-on-surface-variant/80 mt-1 line-clamp-2 leading-relaxed">
                      {course.description || "لا يوجد وصف محدد لهذه الدورة."}
                    </p>
                  </div>

                  {/* Target Groups Badge Indicator */}
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant/70 bg-surface-variant/40 px-3 py-1.5 rounded-xl w-fit">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {linkedCount > 0
                        ? `مرتبطة بـ ${linkedCount} أفواج دراسية`
                        : "غير مرتبطة بأفواج"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-outline/10 flex items-center justify-between text-xs font-semibold text-primary">
                  <span>فتح مصمم الدورة</span>
                  <ChevronLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Course Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>{editingCourse ? "تعديل الدورة التعليمية" : "إضافة دورة جديدة"}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-error-container/70 border border-error/30 text-on-error-container text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmitCourse} className="space-y-4" noValidate>
              {/* Course Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface-variant">
                  عنوان الدورة التعليمية <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: مادة الرياضيات - التحضير للبكالوريا 2027"
                  disabled={isSubmitting}
                  required
                  className="w-full h-12 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>

              {/* Course Description with Curriculum Co-Pilot (Requirement 4) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-on-surface-variant">
                    الوصف العام للدورة
                  </label>
                  <button
                    type="button"
                    onClick={handleCurriculumCoPilot}
                    className="px-2 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-[11px] transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Bot className="w-3.5 h-3.5 text-amber-300" />
                    <span>🤖 هيكلة المقرر (AI)</span>
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="اكتب نبذة مختصرة عن محتوى الدورة والفئة المستهدفة أو انقر زر هيكلة المقرر..."
                  disabled={isSubmitting}
                  className="w-full p-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all resize-y font-medium"
                />
              </div>

              {/* Group Selection Section (Link Course to Groups) */}
              <div className="space-y-2 pt-2 border-t border-outline/10">
                <label className="block text-xs font-semibold text-on-surface-variant flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    <span>الأفواج المستهدفة (ربط الدورة بالأفواج)</span>
                  </span>
                  <span className="text-[10px] text-on-surface-variant/70">
                    اختياري
                  </span>
                </label>

                {groups.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/70 p-3 rounded-xl bg-surface-variant/30 text-center">
                    لا توجد أفواج نشطة مضافة بعد.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1 border border-outline/20 rounded-xl bg-surface-variant/20">
                    {groups.map((group) => {
                      const isSelected = group.id ? selectedGroupIds.includes(group.id) : false;

                      return (
                        <div
                          key={group.id}
                          onClick={() => group.id && handleToggleGroupSelect(group.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                            isSelected
                              ? "bg-primary/10 border-primary text-primary font-bold shadow-sm"
                              : "bg-surface border-outline/15 text-on-surface hover:bg-surface-variant/50"
                          }`}
                        >
                          <span className="text-xs truncate">{group.name}</span>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isSelected
                                ? "bg-primary border-primary text-on-primary"
                                : "border-outline/40 bg-surface"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI Context Settings Section */}
              <div className="space-y-4 pt-3 border-t border-outline/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-extrabold text-on-surface">
                    إعدادات سياق المساعد الذكي
                  </h3>
                </div>

                {/* Field 1: The Permanent Index */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-on-surface-variant">
                    الفهرس المختصر (سياق دائم)
                  </label>
                  <textarea
                    value={courseIndexContext}
                    onChange={(e) => setCourseIndexContext(e.target.value)}
                    rows={3}
                    placeholder="اكتب رؤوس أقلام الفهرس وسياق المنهج المختصر..."
                    disabled={isSubmitting}
                    className="w-full p-3.5 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                  />
                  <InlineAIRefiner
                    currentText={courseIndexContext}
                    onRefined={(newText) => setCourseIndexContext(newText)}
                  />
                  <p className="text-[11px] text-on-surface-variant/70">
                    اكتب رؤوس أقلام فقط. هذا النص سيرافق التلميذ دائماً في هذا المسار.
                  </p>
                </div>

                {/* Field 2: The Detailed Content (LaTeX) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-on-surface-variant">
                    المحتوى التفصيلي (للاستدعاء عند الحاجة)
                  </label>
                  <textarea
                    value={courseDetailedLatex}
                    onChange={(e) => setCourseDetailedLatex(e.target.value)}
                    rows={5}
                    placeholder="اكتب محتوى المسار بالتفصيل باستخدام أكواد LaTeX..."
                    disabled={isSubmitting}
                    dir="ltr"
                    className="w-full p-3.5 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-left font-mono text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all resize-y"
                  />
                  <p className="text-[11px] text-on-surface-variant/70">
                    اكتب محتوى المسار بالتفصيل باستخدام أكواد LaTeX. لن يراه الذكاء الاصطناعي إلا إذا استدعى أداة البحث.
                  </p>

                  {/* Live Preview Box */}
                  {courseDetailedLatex.trim() && (
                    <div className="mt-3 p-4 rounded-2xl bg-surface border border-primary/20 shadow-xs space-y-2">
                      <div className="flex items-center justify-between border-b border-outline/10 pb-1.5">
                        <span className="text-[11px] font-extrabold text-primary flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>معاينة حية للرموز الرياضية (Live Preview)</span>
                        </span>
                        <span className="text-[9px] font-bold text-on-surface-variant">
                          مكتبة KaTeX المباشرة
                        </span>
                      </div>
                      <div className="text-xs text-on-surface leading-relaxed max-h-48 overflow-y-auto p-2 bg-surface-variant/20 rounded-xl" dir="rtl">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                          components={{
                            p: ({ children }) => <p className="my-1">{children}</p>,
                          }}
                        >
                          {courseDetailedLatex}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 h-12 rounded-xl bg-surface-variant/60 text-on-surface-variant font-bold text-sm hover:bg-surface-variant transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>{editingCourse ? "حفظ التغييرات" : "إنشاء الدورة"}</span>
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

function CourseDeleteDialog({
  courseTitle,
  onConfirmDelete,
}: {
  courseTitle: string;
  onConfirmDelete: () => void;
}) {
  const [confirmInput, setConfirmInput] = useState("");

  return (
    <AlertDialog onOpenChange={(open) => { if (!open) setConfirmInput(""); }}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="p-2 rounded-xl text-on-surface-variant/60 hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
          title="حذف الدورة"
          aria-label="حذف الدورة"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف الدورة نهائياً (منطقة الخطر ⚠️)</AlertDialogTitle>
          <AlertDialogDescription>
            هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الدورة <strong>«{courseTitle}»</strong> وكل الفصول والأنشطة والمرفقات المرتبطة بها نهائياً. يرجى كتابة <strong className="text-error font-black">حذف نهائي</strong> لتأكيد العملية.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <label className="block text-[11px] font-bold text-on-surface-variant">
            أدخل كلمة التأكيد:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="حذف نهائي"
            className="w-full h-10 px-3.5 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-extrabold text-xs focus:outline-none focus:border-error focus:ring-2 focus:ring-error/20 transition-all dir-rtl text-right"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmInput("")}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirmInput.trim() !== "حذف نهائي"}
            onClick={onConfirmDelete}
          >
            حذف الدورة
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

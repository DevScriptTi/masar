"use client";

import React, { useState, useEffect, use, useRef, FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCourseById,
  getModuleById,
  updateActivity,
  ActivityDoc,
  ActivityStation,
  CustomIsolationRule,
  TargetingPreset,
  fetchTargetingPresets,
  saveTargetingPreset,
  CourseDoc,
  ModuleDoc,
  QuizQuestionItem,
  AttachmentItem,
  TargetItem,
} from "@/src/lib/firebase/coursesService";
import { HomeworkUploader } from "@/src/components/student/HomeworkUploader";
import { TargetSelectionModal } from "@/src/components/admin/activities/TargetSelectionModal";
import { InlineAIRefiner } from "@/src/components/admin/activities/InlineAIRefiner";
import { generateContextAction, refineContextAction } from "@/actions/ai.actions";
import { fetchGroups, GroupDoc } from "@/src/lib/firebase/groupsService";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { MD3Switch } from "@/src/components/admin/courses/MD3Switch";
import { QuizBuilder } from "@/src/components/admin/activities/QuizBuilder";
import { StudentPreview, MathText } from "@/src/components/admin/activities/StudentPreview";
import { StudentExceptionsModal } from "@/src/components/admin/activities/StudentExceptionsModal";
import { ActivitySubmissionsList } from "@/src/components/admin/evaluations/ActivitySubmissionsList";
import { RichTextEditor } from "@/src/components/admin/RichTextEditor";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useToast } from "@/src/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/src/components/ui/alert-dialog";
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
  ArrowUp,
  ArrowDown,
  MapPin,
  Workflow,
  Bookmark,
  Download,
  BookmarkPlus,
  FolderDown,
  Search,
  Image as ImageIcon,
  Settings as SettingsIcon,
  Upload,
  Link as LinkIcon,
  PlayCircle,
  ChevronDown,
  Wand2,
  Bot,
  Send,
} from "lucide-react";

export interface StudentOption {
  id: string;
  fullName: string;
  groupId?: string;
  groupName?: string;
  email?: string;
  allGroupKeys?: string[];
}

interface SearchableStudentMultiSelectProps {
  selectedIds: string[];
  onChange: (newSelectedIds: string[]) => void;
  allStudents: StudentOption[];
  groups: GroupDoc[];
  targetAudience?: "all" | "specific_groups" | "specific_students";
  targetGroupIds?: string[];
  placeholder?: string;
}

export function SearchableStudentMultiSelect({
  selectedIds,
  onChange,
  allStudents,
  groups,
  targetAudience = "all",
  targetGroupIds = [],
  placeholder = "ابحث عن اسم التلميذ أو اختر من القائمة...",
}: SearchableStudentMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("ALL");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const updatePosition = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Step 1: Base student pool matched with group names
  const basePool = React.useMemo(() => {
    let pool = allStudents.map((s) => {
      const matchedGroup = groups.find((g) =>
        s.allGroupKeys?.some((k) => (g.id && k === g.id) || k === g.name)
      );
      return {
        ...s,
        groupName: matchedGroup ? matchedGroup.name : s.groupId || "",
      };
    });

    if (targetAudience === "specific_groups" && targetGroupIds.length > 0) {
      const groupPool = pool.filter((s) =>
        targetGroupIds.some((selectedGId) => {
          const g = groups.find((grp) => grp.id === selectedGId);
          const gName = g ? g.name : "";
          return s.allGroupKeys?.some(
            (k) => k === selectedGId || (gName && k === gName)
          );
        })
      );
      if (groupPool.length > 0) pool = groupPool;
    }

    return pool;
  }, [allStudents, groups, targetAudience, targetGroupIds]);

  // Step 2: Dynamically extract unique group names present in current base pool
  const uniqueGroupNames = React.useMemo(() => {
    const set = new Set<string>();
    basePool.forEach((s) => {
      if (s.groupName && s.groupName.trim()) {
        set.add(s.groupName.trim());
      }
    });
    return Array.from(set);
  }, [basePool]);

  // Step 3: Apply activeGroupFilter and searchQuery double filtering
  const filteredStudents = React.useMemo(() => {
    let result = basePool;

    if (activeGroupFilter !== "ALL") {
      result = result.filter((s) => s.groupName === activeGroupFilter);
    }

    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.fullName.toLowerCase().includes(queryLower) ||
          (s.groupName && s.groupName.toLowerCase().includes(queryLower)) ||
          s.id.toLowerCase().includes(queryLower)
      );
    }

    return result;
  }, [basePool, activeGroupFilter, searchQuery]);

  const toggleStudent = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sId) => sId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleAddCustomSearchText = () => {
    if (!searchQuery.trim()) return;
    const val = searchQuery.trim();
    if (!selectedIds.includes(val)) {
      onChange([...selectedIds, val]);
    }
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1" dir="rtl">
      {/* Visual Chips / Badges Container */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-surface border border-outline/30 min-h-[42px] items-center cursor-pointer hover:border-indigo-500/50 transition-all shadow-2xs"
      >
        {selectedIds.length === 0 ? (
          <span className="text-xs text-on-surface-variant/60 font-medium px-2">
            {placeholder}
          </span>
        ) : (
          selectedIds.map((id) => {
            const student = allStudents.find((s) => s.id === id);
            const label = student
              ? `${student.fullName}${student.groupName ? ` (${student.groupName})` : ""}`
              : id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-xs animate-fadeIn shrink-0"
              >
                <span>{label}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedIds.filter((item) => item !== id));
                  }}
                  className="hover:text-amber-200 transition-colors"
                >
                  <X className="w-3 h-3 stroke-[3]" />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* Portal-rendered Dropdown Overlay to escape any parent overflow-hidden bounds */}
      {isOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className="bg-surface border border-outline/20 rounded-2xl shadow-2xl p-2.5 space-y-2 animate-scaleUp max-h-72 flex flex-col font-sans"
            dir="rtl"
          >
            {/* Search Bar Input */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-on-surface-variant absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomSearchText();
                  }
                }}
                placeholder="ابحث بالاسم..."
                autoFocus
                className="w-full h-9 pr-9 pl-3 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Group Filter Chips Bar */}
            {uniqueGroupNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-1.5 border-b border-outline/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveGroupFilter("ALL")}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-xs border transition-all inline-flex items-center gap-1 ${
                    activeGroupFilter === "ALL"
                      ? "bg-indigo-600 text-white border-indigo-500 font-bold shadow-2xs"
                      : "bg-surface-variant/40 text-on-surface-variant border-outline/30 hover:border-indigo-500/40 font-medium"
                  }`}
                >
                  <span>الكل</span>
                  <span className="text-[10px] opacity-80">({basePool.length})</span>
                </button>

                {uniqueGroupNames.map((gName) => {
                  const isSelected = activeGroupFilter === gName;
                  const count = basePool.filter((s) => s.groupName === gName).length;
                  return (
                    <button
                      key={gName}
                      type="button"
                      onClick={() => setActiveGroupFilter(gName)}
                      className={`cursor-pointer rounded-full px-2.5 py-1 text-xs border transition-all inline-flex items-center gap-1 ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500 font-bold shadow-2xs"
                          : "bg-surface-variant/40 text-on-surface-variant border-outline/30 hover:border-indigo-500/40 font-medium"
                      }`}
                    >
                      <span>{gName}</span>
                      <span className="text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Scrollable Checkbox List */}
            <div className="overflow-y-auto space-y-1 flex-1 pr-1">
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-center space-y-2">
                  <p className="text-xs text-on-surface-variant/70">لم يتم العثور على تلميذ بهذا الاسم.</p>
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={handleAddCustomSearchText}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-500/20 transition-all inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة "{searchQuery.trim()}" معرّف/اسم مخصص</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isChosen = selectedIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-xs ${
                        isChosen
                          ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold"
                          : "hover:bg-surface-variant/40 text-on-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isChosen
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-outline/40 bg-surface"
                          }`}
                        >
                          {isChosen && <CheckCircle2 className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span>{s.fullName}</span>
                        {s.groupName && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-variant/50 text-on-surface-variant font-medium">
                            {s.groupName}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function ActivityEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const activityId = resolvedParams.activityId;
  const router = useRouter();
  const { toast } = useToast();

  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [parentModule, setParentModule] = useState<ModuleDoc | null>(null);
  const [activity, setActivity] = useState<ActivityDoc | null>(null);
  const [availableGroups, setAvailableGroups] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Global Editor Mode & Modular Studio Navigation State Requirement 3
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [activityMode, setActivityMode] = useState<"theoretical" | "interactive">("interactive");

  type StudioTab = "basic" | "attachments" | "stations" | "ai" | "settings";
  const [activeTab, setActiveTab] = useState<StudioTab>("basic");
  const [tabErrors, setTabErrors] = useState<Record<StudioTab, boolean>>({
    basic: false,
    attachments: false,
    stations: false,
    ai: false,
    settings: false,
  });

  // Auto fallback to basic tab if activityMode becomes theoretical while on stations tab
  useEffect(() => {
    if (activityMode === "theoretical" && activeTab === "stations") {
      setActiveTab("basic");
    }
  }, [activityMode, activeTab]);

  const studioTabsList: { id: StudioTab; label: string; icon: any; isConditional?: boolean }[] = [
    { id: "basic", label: "المحتوى الأساسي", icon: FileText },
    { id: "attachments", label: "المرفقات والملفات", icon: FolderDown },
    { id: "stations", label: "المحطات التفاعلية", icon: Workflow, isConditional: true },
    { id: "ai", label: "إعدادات المساعد الذكي", icon: Sparkles },
    { id: "settings", label: "التصريح والخيارات الإضافية", icon: SettingsIcon },
  ];

  // Form States & Unsaved Changes Guard
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Browser Navigation Guard for Unsaved Changes (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Next.js Client-Side Navigation Interceptor for Unsaved Changes (Shadcn AlertDialog)
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (!isDirty) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && anchor.href && anchor.href !== window.location.href) {
        e.preventDefault();
        e.stopPropagation();

        setPendingNavUrl(anchor.href);
        setShowUnsavedDialog(true);
      }
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
    };
  }, [isDirty]);
  const [type, setType] = useState<"lesson" | "practice" | "exam">("lesson");
  const [isVisible, setIsVisible] = useState(true);
  const [requireSubmission, setRequireSubmission] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestionItem[]>([]);

  // Section A & B: Global Context Summary, Reference Images & Dynamic Stations
  const [globalLatexSummary, setGlobalLatexSummary] = useState("");
  const [contextViewMode, setContextViewMode] = useState<"edit" | "preview">("edit");
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [globalCustomIsolations, setGlobalCustomIsolations] = useState<CustomIsolationRule[]>([]);
  const [stations, setStations] = useState<ActivityStation[]>([]);

  // Co-Pilot Chat UI States & Refinement Handler
  const [refinementChat, setRefinementChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementInput, setRefinementInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [refinementChat, isRefining]);

  const handleSendRefinementChat = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const promptText = refinementInput.trim();
    if (!promptText || isRefining) return;

    setRefinementChat((prev) => [...prev, { role: "user", text: promptText }]);
    setRefinementInput("");
    setIsRefining(true);

    try {
      const result = await refineContextAction(globalLatexSummary, promptText);

      if (result.success && result.markdown) {
        setGlobalLatexSummary(result.markdown);
        setIsDirty(true);
        setRefinementChat((prev) => [
          ...prev,
          {
            role: "ai",
            text: "تم تحديث السياق وإصلاح الأخطاء! هل هناك تعديل آخر؟ ✨",
          },
        ]);
      } else {
        throw new Error(result.error || "فشل تنقيح السياق بواسطة الذكاء الاصطناعي");
      }
    } catch (err: any) {
      console.error("Error in refinement chat:", err);
      const errorMessage = err?.message || "";
      const is503 =
        errorMessage.includes("503") ||
        errorMessage.includes("high demand") ||
        errorMessage.includes("Service Unavailable") ||
        errorMessage.includes("overloaded");

      toast({
        title: is503 ? "الخوادم مزدحمة حالياً 🚦" : "خطأ في تنقيح السياق",
        description: is503
          ? "يوجد ضغط عالٍ على خوادم الذكاء الاصطناعي في هذه اللحظة. يرجى المحاولة مرة أخرى بعد دقيقة."
          : errorMessage || "تعذر تنفيذ التعديل المطلوب.",
        variant: "destructive",
      });

      setRefinementChat((prev) => [
        ...prev,
        {
          role: "ai",
          text: is503
            ? "🚦 عذراً، الخوادم مزدحمة حالياً بسبب ضغط الاستخدام. يرجى إعادة إرسال طلب التعديل بعد دقيقة."
            : `⚠️ عذراً، تعذر تنفيذ التعديل: ${errorMessage || "حدث خطأ غير متوقع."}`,
        },
      ]);
    } finally {
      setIsRefining(false);
    }
  };

  // Available Students Pool State for Multi-Select
  const [allStudentsList, setAllStudentsList] = useState<StudentOption[]>([]);

  // Targeting Presets State & Custom Modal
  const [targetingPresetsList, setTargetingPresetsList] = useState<TargetingPreset[]>([]);
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
  const [presetModalStation, setPresetModalStation] = useState<ActivityStation | null>(null);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // AI LaTeX Cleaner Modal States
  const [isCleanLatexModalOpen, setIsCleanLatexModalOpen] = useState(false);
  const [rawLatexInput, setRawLatexInput] = useState("");
  const [isCleaningLatex, setIsCleaningLatex] = useState(false);
  const [cleanLatexError, setCleanLatexError] = useState("");

  const handleCleanAndExtractLatex = async () => {
    if (!rawLatexInput.trim()) return;

    setIsCleaningLatex(true);
    setCleanLatexError("");

    try {
      const res = await fetch("/api/admin/clean-latex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawLatex: rawLatexInput, latex: rawLatexInput }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const textErr = await res.text();
        console.error("Non-JSON API Response received:", textErr);
        throw new Error("تعذر الوصول لخدمة التنظيف (/api/admin/clean-latex). يرجى التأكد من تشغيل السيرفر ورابط الخدمة.");
      }

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "فشل استخراج المرجع الرياضي.");
      }

      const resultText = data.cleanText || data.cleanedText;
      if (resultText) {
        setGlobalLatexSummary(resultText.trim());
        setIsDirty(true);
        setRawLatexInput("");
        setIsCleanLatexModalOpen(false);
      }
    } catch (err: any) {
      console.error("Error cleaning LaTeX code:", err);
      setCleanLatexError(err?.message || "حدث خطأ أثناء تنظيف كود LaTeX.");
    } finally {
      setIsCleaningLatex(false);
    }
  };

  // Load presets and real student pool on mount
  useEffect(() => {
    fetchTargetingPresets()
      .then((data) => setTargetingPresetsList(data))
      .catch((err) => console.warn("Failed to fetch targeting presets:", err));

    const loadRealStudents = async () => {
      try {
        const usersRef = collection(db, "users");
        let snap;
        try {
          const q = query(usersRef, where("role", "==", "student"));
          snap = await getDocs(q);
          if (snap.empty) {
            snap = await getDocs(usersRef);
          }
        } catch {
          snap = await getDocs(usersRef);
        }

        const fetched: StudentOption[] = snap.docs.map((d) => {
          const u = d.data();
          const groupKeys: string[] = [];

          if (u.groupId) groupKeys.push(String(u.groupId));
          if (u.cohortId) groupKeys.push(String(u.cohortId));
          if (u.groupName) groupKeys.push(String(u.groupName));

          if (u.enrollments) {
            if (Array.isArray(u.enrollments)) {
              u.enrollments.forEach((k: any) => groupKeys.push(String(k)));
            } else if (typeof u.enrollments === "object") {
              Object.keys(u.enrollments).forEach((k) => groupKeys.push(k));
            }
          }

          if (u.groups && Array.isArray(u.groups)) {
            u.groups.forEach((k: any) => groupKeys.push(String(k)));
          }

          return {
            id: d.id,
            fullName: u.fullName || u.displayName || u.name || u.email || "تلميذ مسجل",
            groupId: u.groupId || u.cohortId || groupKeys[0] || "",
            email: u.email || "",
            allGroupKeys: groupKeys,
          };
        });

        setAllStudentsList(fetched);
      } catch (err) {
        console.warn("Failed to fetch real student pool:", err);
      }
    };

    loadRealStudents();
  }, []);

  const handleApplyPreset = (stationId: string, presetId: string) => {
    const preset = targetingPresetsList.find((p) => p.id === presetId);
    if (!preset) return;
    setStations((prev) =>
      prev.map((st) =>
        st.id === stationId
          ? {
              ...st,
              targetAudience: preset.targetAudience,
              targetIds: [...(preset.targetIds || [])],
              isolatedStudentIds: [...(preset.isolatedStudentIds || [])],
              customIsolations: (preset.customIsolations || []).map((r: any) => ({ ...r })),
              stationContextNote: preset.stationContextNote || "",
            }
          : st
      )
    );
  };

  const handleOpenSavePresetModal = (station: ActivityStation) => {
    setPresetModalStation(station);
    setPresetNameInput(`قالب عزل - ${station.title}`);
    setIsSavePresetModalOpen(true);
  };

  const handleConfirmSavePreset = async (e: FormEvent) => {
    e.preventDefault();
    if (!presetModalStation || !presetNameInput.trim()) return;

    setIsSavingPreset(true);
    try {
      const newPresetData: Omit<TargetingPreset, "id" | "createdAt"> = {
        presetName: presetNameInput.trim(),
        targetAudience: presetModalStation.targetAudience || "all",
        targetIds: presetModalStation.targetIds || [],
        isolatedStudentIds: presetModalStation.isolatedStudentIds || [],
        customIsolations: presetModalStation.customIsolations || [],
        stationContextNote: presetModalStation.stationContextNote || "",
      };

      const newId = await saveTargetingPreset(newPresetData);
      const createdPreset: TargetingPreset = {
        id: newId,
        ...newPresetData,
      };

      setTargetingPresetsList((prev) => [createdPreset, ...prev]);
      setIsSavePresetModalOpen(false);
      setPresetModalStation(null);
      setPresetNameInput("");
    } catch (err: any) {
      console.error("Error saving targeting preset:", err);
      toast({
        title: "خطأ أثناء حفظ القالب",
        description: err?.message || "حدث خطأ أثناء حفظ القالب.",
        variant: "destructive",
      });
    } finally {
      setIsSavingPreset(false);
    }
  };

  // Target Selection Modal State for Deep Isolation Rules (Requirement 3 & 4)
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [activeRuleTargetId, setActiveRuleTargetId] = useState<string | null>(null);
  const [targetModalStudentIds, setTargetModalStudentIds] = useState<string[]>([]);
  const [targetModalGroupIds, setTargetModalGroupIds] = useState<string[]>([]);
  const [targetModalTargets, setTargetModalTargets] = useState<TargetItem[]>([]);

  const handleConfirmTargetSelection = (
    targets: TargetItem[],
    newStudentIds: string[],
    newGroupIds: string[]
  ) => {
    if (activeRuleTargetId) {
      setGlobalCustomIsolations((prev) =>
        prev.map((rule) =>
          rule.id === activeRuleTargetId
            ? {
                ...rule,
                targets,
                studentIds: newStudentIds,
                groupIds: newGroupIds,
              }
            : rule
        )
      );
    }
  };

  // Global Custom Isolation Rule Handlers
  const handleAddGlobalCustomIsolationRule = () => {
    const newRule: CustomIsolationRule = {
      id: `rule_global_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentIds: [],
      groupIds: [],
      specificContextNote: "",
    };
    setGlobalCustomIsolations((prev) => [...prev, newRule]);
  };

  const handleUpdateGlobalCustomIsolationRule = (
    ruleId: string,
    field: keyof CustomIsolationRule,
    value: any
  ) => {
    setGlobalCustomIsolations((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule))
    );
  };

  const handleRemoveGlobalCustomIsolationRule = (ruleId: string) => {
    setGlobalCustomIsolations((prev) => prev.filter((r) => r.id !== ruleId));
  };

  // Custom Isolation Rule Handlers
  const handleAddCustomIsolationRule = (stationId: string) => {
    const newRule: CustomIsolationRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentIds: [],
      specificContextNote: "",
    };
    setStations((prev) =>
      prev.map((st) =>
        st.id === stationId
          ? {
              ...st,
              customIsolations: [...(st.customIsolations || []), newRule],
            }
          : st
      )
    );
  };

  const handleUpdateCustomIsolationRule = (
    stationId: string,
    ruleId: string,
    field: keyof CustomIsolationRule,
    value: any
  ) => {
    setStations((prev) =>
      prev.map((st) => {
        if (st.id !== stationId) return st;
        const updatedRules = (st.customIsolations || []).map((rule: any) =>
          rule.id === ruleId ? { ...rule, [field]: value } : rule
        );
        return { ...st, customIsolations: updatedRules };
      })
    );
  };

  const handleRemoveCustomIsolationRule = (stationId: string, ruleId: string) => {
    setStations((prev) =>
      prev.map((st) => {
        if (st.id !== stationId) return st;
        return {
          ...st,
          customIsolations: (st.customIsolations || []).filter((r: any) => r.id !== ruleId),
        };
      })
    );
  };

  // Station Handlers
  const handleAddStation = () => {
    const newStation: ActivityStation = {
      id: `station_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      order: stations.length + 1,
      title: `المحطة ${stations.length + 1}`,
      content: "",
      aiDirectives: "",
      targetAudience: "all",
      targetIds: [],
      isolatedStudentIds: [],
      customIsolations: [],
      stationContextNote: "",
    };
    setStations((prev) => [...prev, newStation]);
  };

  const handleUpdateStation = (id: string, field: keyof ActivityStation, value: any) => {
    setStations((prev) =>
      prev.map((st) => (st.id === id ? { ...st, [field]: value } : st))
    );
  };

  const handleToggleStationTargetId = (stationId: string, targetId: string) => {
    setStations((prev) =>
      prev.map((st) => {
        if (st.id !== stationId) return st;
        const currentTargetIds = st.targetIds || [];
        const newTargetIds = currentTargetIds.includes(targetId)
          ? currentTargetIds.filter((id) => id !== targetId)
          : [...currentTargetIds, targetId];
        return { ...st, targetIds: newTargetIds };
      })
    );
  };

  const handleRemoveStation = (id: string) => {
    setStations((prev) =>
      prev
        .filter((st) => st.id !== id)
        .map((st, idx) => ({ ...st, order: idx + 1 }))
    );
  };

  const handleMoveStation = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === stations.length - 1)
    ) {
      return;
    }
    const newStations = [...stations];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newStations[index];
    newStations[index] = newStations[targetIndex];
    newStations[targetIndex] = temp;

    setStations(newStations.map((st, idx) => ({ ...st, order: idx + 1 })));
  };

  // Strict Intersection Rule & Auto-Cleanup State
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);
  const [isExceptionsModalOpen, setIsExceptionsModalOpen] = useState(false);
  const [groupNotice, setGroupNotice] = useState(false);

  // Video Links
  const [videos, setVideos] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState("");

  // Physical File Attachments (PDFs & Images Uploads)
  const [attachments, setAttachments] = useState<(string | AttachmentItem)[]>([]);
  const [isAttModalOpen, setIsAttModalOpen] = useState(false);
  const [attTitle, setAttTitle] = useState("");
  const [attType, setAttType] = useState<"pdf" | "video" | "image">("pdf");
  const [attUrl, setAttUrl] = useState("");
  const [attDescription, setAttDescription] = useState("");
  const [attLatexContent, setAttLatexContent] = useState("");
  const [editingAttIndex, setEditingAttIndex] = useState<number | null>(null);

  // Inline Validation Error States Requirement 3
  const [attTitleError, setAttTitleError] = useState(false);
  const [attUrlError, setAttUrlError] = useState(false);

  const handleCloseAttModal = () => {
    setAttTitle("");
    setAttType("pdf");
    setAttUrl("");
    setAttDescription("");
    setAttLatexContent("");
    setEditingAttIndex(null);
    setAttTitleError(false);
    setAttUrlError(false);
    setIsAttModalOpen(false);
  };

  const handleOpenAddAttModal = () => {
    setAttTitle("");
    setAttType("pdf");
    setAttUrl("");
    setAttDescription("");
    setAttLatexContent("");
    setEditingAttIndex(null);
    setAttTitleError(false);
    setAttUrlError(false);
    setIsAttModalOpen(true);
  };

  const handleOpenEditAttModal = (index: number) => {
    const item = attachments[index];
    if (typeof item === "string") {
      setAttTitle("ملف مرفق");
      setAttType(item.toLowerCase().includes(".pdf") ? "pdf" : "image");
      setAttUrl(item);
      setAttDescription("");
      setAttLatexContent("");
    } else {
      setAttTitle(item.title || "");
      setAttType((item.type as any) || "pdf");
      setAttUrl(item.url || "");
      setAttDescription(item.description || "");
      setAttLatexContent(item.latexContent || "");
    }
    setEditingAttIndex(index);
    setAttTitleError(false);
    setAttUrlError(false);
    setIsAttModalOpen(true);
  };

  const handleSaveAttachmentItem = () => {
    const isTitleEmpty = !attTitle.trim();
    const isUrlEmpty = !attUrl.trim();

    setAttTitleError(isTitleEmpty);
    setAttUrlError(isUrlEmpty);

    if (isTitleEmpty || isUrlEmpty) {
      toast({
        title: "بيانات مفقودة غير مكتملة",
        description: isTitleEmpty && isUrlEmpty
          ? "يرجى إدخال عنوان المرفق ورفع الملف السحابي المطلوب قبل الحفظ."
          : isTitleEmpty
          ? "يرجى إدخال عنوان الوثيقة المرفقة."
          : "يرجى رفع ملف الـ PDF أو الصورة قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    // Auto-detect file type from URL / mime type (Requirement 2)
    const lowerUrl = attUrl.trim().toLowerCase();
    const autoDetectedType: "pdf" | "image" | "video" =
      lowerUrl.includes(".pdf") || lowerUrl.includes("/pdf/") || lowerUrl.includes("resource_type=raw") || lowerUrl.endsWith(".pdf")
        ? "pdf"
        : lowerUrl.includes("youtube.com") || lowerUrl.includes("vimeo.com")
        ? "video"
        : "image";

    const newItem: AttachmentItem = {
      id: editingAttIndex !== null && typeof attachments[editingAttIndex] !== "string"
        ? (attachments[editingAttIndex] as AttachmentItem).id || String(Date.now())
        : String(Date.now()),
      title: attTitle.trim(),
      type: autoDetectedType,
      url: attUrl.trim(),
      description: attDescription.trim(),
      latexContent: attLatexContent.trim(),
    };

    if (editingAttIndex !== null) {
      setAttachments((prev) => prev.map((item, idx) => (idx === editingAttIndex ? newItem : item)));
    } else {
      setAttachments((prev) => [...prev, newItem]);
    }
    setIsDirty(true);

    handleCloseAttModal();
  };

  const handleRemoveAttachmentItem = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  // AI Co-Pilot Context Engine State & Progressive Disclosure
  const [showAdvancedAIMode, setShowAdvancedAIMode] = useState(false);
  const [isGeneratingAIContext, setIsGeneratingAIContext] = useState(false);

  const handleAutoGenerateAIContext = async () => {
    if (!title.trim()) {
      toast({
        title: "عنوان النشاط مطلوب",
        description: "يرجى إدخال عنوان النشاط التعليمي أولاً في قسم المحتوى الأساسي ليتمكن الذكاء الاصطناعي من تحليل موضوع الدرس.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAIContext(true);

    try {
      // Safely extract attached PDF URLs from attachments array
      const pdfUrls = (attachments || [])
        .map((a: any) => (typeof a === "string" ? a : a?.url))
        .filter((u): u is string => Boolean(u && typeof u === "string" && u.toLowerCase().includes(".pdf")));

      const result = await generateContextAction(title.trim(), description.trim(), pdfUrls);

      if (result.success && result.markdown) {
        setGlobalLatexSummary(result.markdown);
        setShowAdvancedAIMode(true); // Seamless auto-expand accordion
        setIsDirty(true);

        toast({
          title: "تم التوليد بنجاح ✨",
          description: "قام الذكاء الاصطناعي بتبسيط الشرح واستخراج الرموز والقوانين الرياضية تلقائياً.",
        });
      } else {
        throw new Error(result.error || "فشل في استخراج سياق النشاط من الذكاء الاصطناعي");
      }
    } catch (err: any) {
      console.error("Error generating AI activity context:", err);
      const errorMessage = err?.message || "";

      if (
        errorMessage.includes("503") ||
        errorMessage.includes("high demand") ||
        errorMessage.includes("Service Unavailable") ||
        errorMessage.includes("overloaded")
      ) {
        toast({
          title: "الخوادم مزدحمة حالياً 🚦",
          description: "يوجد ضغط عالٍ على خوادم الذكاء الاصطناعي في هذه اللحظة. يرجى المحاولة مرة أخرى بعد دقيقة.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: errorMessage || "فشل في استخراج سياق النشاط",
          variant: "destructive",
        });
      }
    } finally {
      setIsGeneratingAIContext(false);
    }
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
        toast({
          title: "نشاط غير موجود",
          description: "لم يتم العثور على هذا النشاط التعليمي.",
          variant: "destructive",
        });
        router.push(`/teacher/courses/${courseId}`);
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
      setType(actData.type === "practice" ? "practice" : actData.type === "exam" ? "exam" : "lesson");
      const loadedMode = actData.activityMode || actData.activityType || (actData.stations && actData.stations.length > 0 ? "interactive" : "theoretical");
      setActivityMode(loadedMode === "theoretical" ? "theoretical" : "interactive");
      setIsVisible(Boolean(actData.isVisible));
      setRequireSubmission(Boolean(actData.requireSubmission));
      setHasQuiz(Boolean(actData.hasQuiz));
      setQuiz(actData.quiz || []);
      setExcludedStudentIds(actData.excludedStudentIds || []);
      setVideos(actData.videos || []);
      setAttachments(actData.attachments || []);
      setGlobalLatexSummary(actData.globalLatexSummary || "");
      setReferenceImageUrls(actData.referenceImageUrls || []);
      setGlobalCustomIsolations(actData.globalCustomIsolations || []);
      setStations(actData.stations || []);
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
    setIsDirty(true);
  };

  const handleSelectAllGroups = () => {
    setGroupNotice(false);
    const allActiveIds = availableGroups.map((g) => g.id!).filter(Boolean);
    setGroupIds(allActiveIds);
    setIsDirty(true);
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
    setIsDirty(true);
  };

  const handleRemoveVideo = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  // Save Activity Handler
  const handleSaveActivity = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    const errors: Record<StudioTab, boolean> = {
      basic: !title.trim(),
      attachments: false,
      stations: activityMode === "interactive" && stations.length === 0,
      ai: false,
      settings: false,
    };

    setTabErrors(errors);

    if (errors.basic) {
      setActiveTab("basic");
      toast({
        title: "عنوان النشاط مفقود",
        description: "يرجى إدخال عنوان النشاط التعليمي أولاً في قسم المحتوى الأساسي.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        activityMode,
        activityType: activityMode,
        isInteractive: activityMode === "interactive",
        isVisible,
        requireSubmission,
        hasQuiz,
        quiz,
        groupIds,
        excludedStudentIds,
        videos,
        attachments,
        globalLatexSummary: globalLatexSummary.trim(),
        referenceImageUrls: referenceImageUrls || [],
        globalCustomIsolations: globalCustomIsolations || [],
        stations: stations || [],
      };

      console.log("Saving payload:", payload);

      await updateActivity(activityId, payload);
      setIsDirty(false);
      setSaveSuccess(true);
      toast({
        title: "تم حفظ التغييرات بنجاح",
        description: "تم تحديث كافة بيانات ووحدات هذا النشاط التعليمي بنجاح.",
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error saving activity:", error);
      toast({
        title: "فشل حفظ النشاط",
        description: error?.message || "حدث خطأ أثناء حفظ التغييرات.",
        variant: "destructive",
      });
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
    globalLatexSummary,
    referenceImageUrls,
    stations,
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Sticky MD3 Top Bar Requirement 2 */}
      <header className="sticky top-0 z-50 bg-surface/85 backdrop-blur-xl border border-outline/15 rounded-3xl p-4 sm:px-6 shadow-md flex items-center justify-between gap-4 transition-all">
        {/* Task A & B: Refined RTL Breadcrumbs Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant min-w-0 flex-wrap">
          <Link
            href="/teacher/courses"
            className="hover:text-primary hover:underline transition-colors shrink-0"
          >
            إدارة الدورات
          </Link>

          <ChevronLeft className="w-4 h-4 text-outline/50 shrink-0" />

          <Link
            href={`/teacher/courses/${courseId}`}
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
            className={`relative px-5 h-10 rounded-xl font-extrabold text-xs transition-all duration-200 flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isDirty
                ? "bg-primary text-on-primary hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 ring-2 ring-primary/40 scale-[1.02]"
                : "bg-surface-variant/60 text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            {isDirty && !isSaving && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}

            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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

      {/* Conditionally Render Preview Mode OR Full Modular Studio Editor */}
      {isPreviewMode ? (
        <StudentPreview activity={previewDoc} courseTitle={course?.title} />
      ) : (
        <form onSubmit={handleSaveActivity} className="animate-fadeIn" noValidate>
          {/* Main Grid Layout: Left Navigation Sidebar + Right Workspace Column (Requirement 2 & 3) */}
          <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 items-start">
            {/* Left Navigation Column: Vertical Sidebar Tabs (Requirement 2: Scrollbar Eradication) */}
            <aside className="w-full md:sticky md:top-20 z-20 bg-surface border border-outline/15 rounded-3xl p-3 shadow-sm space-y-2 overflow-hidden">
              <div className="hidden md:flex items-center gap-2 px-3 py-2 border-b border-outline/10 text-xs font-black text-on-surface">
                <Workflow className="w-4 h-4 text-primary" />
                <span>أقسام الاستوديو (Studio Tabs)</span>
              </div>

              {/* Tabs buttons container: horizontal scroll on mobile, vertical stack on desktop, scrollbar completely hidden */}
              <div className="flex md:flex-col gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {studioTabsList.map((t) => {
                  // CONDITIONAL RENDER: Tab 3 (stations) ONLY if activityMode === 'interactive' Requirement 3
                  if (t.isConditional && activityMode === "theoretical") {
                    return null;
                  }

                  const isActive = activeTab === t.id;
                  const hasError = tabErrors[t.id];

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`w-full px-3.5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between gap-2.5 cursor-pointer text-right shrink-0 ${
                        isActive
                          ? "bg-primary text-on-primary shadow-xs font-black scale-[1.01]"
                          : "bg-surface-variant/20 hover:bg-surface-variant/50 text-on-surface-variant hover:text-on-surface border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <t.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-on-primary" : "text-primary"}`} />
                        <span className="truncate">{t.label}</span>
                      </div>

                      {/* Validation Red Indicator Dot Requirement 4 */}
                      {hasError && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-error animate-pulse shrink-0"
                          title="يوجد حقل مطلوب غير مكتمل في هذا القسم"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Workspace Column: Active Form Tab Panel */}
            <div className="min-w-0 space-y-6">
              {/* TAB 1: المحتوى الأساسي (Basic Content) */}
              {activeTab === "basic" && (
                <div className="animate-fadeIn space-y-6">
                  {/* Dedicated Card 1: Activity Mode Toggle (Theoretical vs Interactive) Requirement 3 */}
                  <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-outline/10">
                      <span className="text-xs font-black text-on-surface flex items-center gap-2">
                        <Workflow className="w-4 h-4 text-primary" />
                        <span>نوع هيكل النشاط التعليمي (Activity Structure Mode):</span>
                      </span>
                      <span className="text-[11px] font-extrabold text-primary px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                        {activityMode === "theoretical" ? "درس نظري 📖 (محتوى ومرفقات)" : "نشاط تفاعلي 🎯 (بمهام ومحطات)"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => { setActivityMode("theoretical"); setIsDirty(true); }}
                        className={`py-3.5 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer border shadow-2xs ${
                          activityMode === "theoretical"
                            ? "bg-primary text-on-primary border-primary shadow-xs scale-[1.01]"
                            : "bg-surface-variant/30 text-on-surface-variant border-outline/20 hover:border-primary/40"
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>درس نظري 📖 (شرح ومرفقات فقط)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActivityMode("interactive"); setIsDirty(true); }}
                        className={`py-3.5 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer border shadow-2xs ${
                          activityMode === "interactive"
                            ? "bg-primary text-on-primary border-primary shadow-xs scale-[1.01]"
                            : "bg-surface-variant/30 text-on-surface-variant border-outline/20 hover:border-primary/40"
                        }`}
                      >
                        <Workflow className="w-4 h-4" />
                        <span>نشاط تفاعلي 🎯 (بمهام ومحطات)</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-on-surface-variant/80 font-medium leading-relaxed pt-0.5">
                      {activityMode === "theoretical"
                        ? "تنبيه: تحويل النشاط إلى 'درس نظري' سيخفي مصمم المحطات التفاعلية من شريط أقسام الاستوديو وسيُتيح للتلميذ التفاعل مع المساعد الذكي في سياق الدرس الشامل."
                        : "تنبيه: 'النشاط التفاعلي' يتيح تقطير النشاط إلى محطات جزئية ومستقلة وتزويد الذكاء الاصطناعي بتوجيهات خاصة لكل محطة."}
                    </p>
                  </div>

                  {/* Card 2: General Info & Description */}
                  <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-5">
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
                          onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
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
                          onChange={(val) => {
                            setDescription(val);
                            setIsDirty(true);
                          }}
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

                  {/* Card 2: Videos */}
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
                        className="px-4 h-11 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة فيديو</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: المرفقات (Attachments) */}
              {activeTab === "attachments" && (
                <div className="animate-fadeIn space-y-6">
                  <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-outline/10 pb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <FolderDown className="w-5 h-5 text-secondary" />
                        <div>
                          <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                            <span>المرفقات والملفات المنهجية</span>
                            {attachments.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-extrabold border border-secondary/20">
                                {attachments.length} مرفق
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-on-surface-variant/70 mt-0.5">
                            إدارة مستندات الـ PDF والحلول النموذجية والفيديوهات الملحقة بهذا النشاط التعليمي.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenAddAttModal}
                        className="px-4 h-10 rounded-2xl bg-secondary text-on-secondary font-bold text-xs hover:bg-secondary/90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة مرفق جديد</span>
                      </button>
                    </div>

                    {attachments.length > 0 ? (
                      <div className="space-y-3">
                        {attachments.map((item, idx) => {
                          const isStr = typeof item === "string";
                          const titleStr = isStr ? `مرفق منهج رقم #${idx + 1}` : item.title || `مرفق #${idx + 1}`;
                          const typeStr = isStr
                            ? item.toLowerCase().includes("video")
                              ? "video"
                              : "pdf"
                            : item.type || "pdf";
                          const urlStr = isStr ? item : item.url || "";
                          const descStr = !isStr ? item.description : "";

                          const isPdfType = typeStr === "pdf" || urlStr.toLowerCase().includes(".pdf");
                          const isVideoType = typeStr === "video" || urlStr.toLowerCase().includes("youtube") || urlStr.toLowerCase().includes("vimeo");

                          return (
                            <div
                              key={idx}
                              className="p-4 rounded-2xl bg-surface-variant/20 border border-outline/15 hover:border-outline/30 transition-all flex items-center justify-between gap-4 shadow-2xs group"
                            >
                              {/* Right Side: Leading Colored Icon & Content Area (RTL Requirement 3) */}
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                {/* Leading Icon based on attachment category */}
                                {isVideoType ? (
                                  <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                                    <PlayCircle className="w-5.5 h-5.5" />
                                  </div>
                                ) : isPdfType ? (
                                  <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                                    <FileText className="w-5.5 h-5.5" />
                                  </div>
                                ) : (
                                  <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                                    <ImageIcon className="w-5.5 h-5.5" />
                                  </div>
                                )}

                                {/* Content Area: Title, Badge, Description - NO RAW URL DISPLAYED (Requirement 3) */}
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs sm:text-sm font-extrabold text-on-surface truncate">
                                      {titleStr}
                                    </h4>

                                    {/* Category Badge / Chip */}
                                    {isVideoType ? (
                                      <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-extrabold shrink-0">
                                        فيديو تفاعلي
                                      </span>
                                    ) : isPdfType ? (
                                      <span className="px-2.5 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[10px] font-extrabold shrink-0">
                                        مستند PDF
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10px] font-extrabold shrink-0">
                                        صورة مرجعية
                                      </span>
                                    )}
                                  </div>

                                  {descStr ? (
                                    <p className="text-xs text-on-surface-variant/80 font-medium line-clamp-1 leading-relaxed">
                                      {descStr}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-on-surface-variant/50 italic">
                                      لا يوجد وصف محدد لهذا المرفق.
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Left Side: Trailing Actions (Requirement 3) */}
                              <div className="flex items-center gap-2 shrink-0 border-r border-outline/10 pr-3">
                                {urlStr && (
                                  <a
                                    href={urlStr}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 rounded-xl bg-surface border border-outline/15 text-on-surface-variant hover:text-primary hover:border-primary/40 transition-all cursor-pointer"
                                    title="فتح المعاينة في تبويب جديد"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAttModal(idx)}
                                  className="p-2 rounded-xl bg-surface-variant/40 text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-all cursor-pointer border border-transparent hover:border-primary/30"
                                  title="تعديل تفاصيل المرفق"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttachmentItem(idx)}
                                  className="p-2 rounded-xl text-error bg-error/10 hover:bg-error hover:text-on-error transition-all cursor-pointer"
                                  title="حذف المرفق نهائياً"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center border-2 border-dashed border-outline/20 rounded-2xl space-y-2">
                        <FileUp className="w-8 h-8 text-on-surface-variant/50 mx-auto" />
                        <p className="text-xs font-bold text-on-surface">لم يتم إضافة أي مرفقات لهذا الدرس بعد</p>
                        <p className="text-[11px] text-on-surface-variant/70">
                          انقر على زر "إضافة مرفق جديد" لإدراج ملف PDF أو فيديو ملحق بهذا الدرس.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: المحطات التفاعلية (Interactive Stations) */}
              {activeTab === "stations" && activityMode === "interactive" && (
                <div className="animate-fadeIn space-y-6">
                  <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-outline/10 pb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <Workflow className="w-5 h-5 text-primary" />
                        <div>
                          <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                            <span>مصمم المحطات التفاعلية (Section B: Dynamic Stations Builder)</span>
                            {stations.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-extrabold border border-primary/20">
                                {stations.length} محطة
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-on-surface-variant/70 mt-0.5">
                            قسم النشاط إلى محطات تفاعلية متدرجة (Micro-Tasks). تتيح التوجيه الدقيق والمخصص لكل تمرين.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddStation}
                        className="px-4 h-10 rounded-2xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة محطة جديدة</span>
                      </button>
                    </div>

                    {stations.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-outline/20 rounded-2xl space-y-3">
                        <MapPin className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-on-surface">لم يتم إضافة أي محطة تفاعلية لهذا النشاط بعد</p>
                          <p className="text-[11px] text-on-surface-variant/70 max-w-md mx-auto">
                            اضغط على زر "إضافة محطة جديدة" لتقسيم التمرين إلى خطوات جزئية ومستقلة وتزويد الذكاء الاصطناعي بتوجيهات خاصة لكل خطوة.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddStation}
                          className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-extrabold hover:bg-primary/20 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إنشاء أول محطة تفاعلية</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {stations.map((st, idx) => (
                          <div
                            key={st.id}
                            className="p-5 rounded-2xl bg-surface-variant/20 border border-outline/20 space-y-4 transition-all hover:border-primary/30 shadow-2xs"
                          >
                            {/* Station Card Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline/10 pb-3">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="w-7 h-7 rounded-xl bg-primary text-on-primary font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                  {st.order || idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={st.title}
                                  onChange={(e) => handleUpdateStation(st.id, "title", e.target.value)}
                                  placeholder={`عنوان المحطة #${idx + 1} (مثال: المحطة 1 - حساب النهاية)...`}
                                  className="w-full h-10 px-3.5 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary transition-all"
                                />
                              </div>

                              {/* Station Actions (Up/Down Reorder & Delete) */}
                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => handleMoveStation(idx, "up")}
                                  disabled={idx === 0}
                                  className="p-2 rounded-xl bg-surface border border-outline/20 text-on-surface-variant hover:text-primary hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                  title="تحريك للأعلى"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleMoveStation(idx, "down")}
                                  disabled={idx === stations.length - 1}
                                  className="p-2 rounded-xl bg-surface border border-outline/20 text-on-surface-variant hover:text-primary hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                  title="تحريك للأسفل"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveStation(st.id)}
                                  className="p-2 rounded-xl bg-error/10 text-error hover:bg-error hover:text-on-error transition-all cursor-pointer"
                                  title="إزالة المحطة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Station Content Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Field 1: Station Sub-Task / Focus */}
                              <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-on-surface flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  <span>المهمة الحالية للوكيل (Current Sub-task/Focus)</span>
                                </label>
                                <textarea
                                  value={st.content}
                                  onChange={(e) => handleUpdateStation(st.id, "content", e.target.value)}
                                  rows={3}
                                  placeholder="حدد هنا السؤال أو الجزء المطلوب في هذه المحطة فقط (مثال: المطالبة بحساب النهاية عند الصفر)..."
                                  className="w-full p-3.5 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs focus:outline-none focus:border-primary transition-all font-medium resize-y"
                                />
                              </div>

                              {/* Field 2: Station AI Directives */}
                              <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-on-surface flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  <span>توجيهات سرية للوكيل حول هذا التمرين (AI Directives)</span>
                                </label>
                                <textarea
                                  value={st.aiDirectives}
                                  onChange={(e) => handleUpdateStation(st.id, "aiDirectives", e.target.value)}
                                  rows={3}
                                  placeholder="تعليمات سرية خاصة بالذكاء الاصطناعي لهذه المحطة (مثال: عدم إعطاء الناتج النهائي، والتركيز على خطوة توحيد المقامات)..."
                                  className="w-full p-3.5 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs focus:outline-none focus:border-primary transition-all font-medium resize-y"
                                />
                              </div>
                            </div>

                            {/* Station Targeting & Isolation Box */}
                            <div className="p-4 rounded-xl bg-surface-variant/40 border border-outline/20 space-y-3.5">
                              <div className="flex items-center justify-between border-b border-outline/10 pb-2 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-primary" />
                                  <h4 className="text-xs font-bold text-on-surface">
                                    عزل وتخصيص الفئة المستهدفة للمحطة (Station Isolation & Targeting)
                                  </h4>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto pt-1 sm:pt-0">
                                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                                    <FolderDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <select
                                      defaultValue=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleApplyPreset(st.id, e.target.value);
                                          e.target.value = "";
                                        }
                                      }}
                                      className="h-8 px-2.5 rounded-lg bg-surface border border-outline/30 text-on-surface text-[11px] font-bold focus:outline-none focus:border-primary transition-all max-w-[200px]"
                                    >
                                      <option value="" disabled>
                                        -- استيراد قالب عزل محفوظ ({targetingPresetsList.length}) --
                                      </option>
                                      {targetingPresetsList.map((preset) => (
                                        <option key={preset.id} value={preset.id}>
                                          {preset.presetName}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenSavePresetModal(st)}
                                    className="px-3 h-8 rounded-lg bg-primary/10 text-primary border border-primary/30 font-bold text-[11px] hover:bg-primary/20 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                  >
                                    <BookmarkPlus className="w-3.5 h-3.5" />
                                    <span>حفظ كقالب جديد</span>
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="block text-xs font-bold text-on-surface-variant">
                                    الفئة المستهدفة (العزل)
                                  </label>
                                  <select
                                    value={st.targetAudience || "all"}
                                    onChange={(e) =>
                                      handleUpdateStation(
                                        st.id,
                                        "targetAudience",
                                        e.target.value as any
                                      )
                                    }
                                    className="w-full h-10 px-3 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary transition-all"
                                  >
                                    <option value="all">جميع التلاميذ (All)</option>
                                    <option value="specific_groups">أفواج محددة (Specific Groups)</option>
                                    <option value="specific_students">تلاميذ محددون (Specific Students)</option>
                                  </select>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="block text-xs font-bold text-on-surface-variant">
                                    ملاحظة إضافية لسياق الوكيل (اختياري)
                                  </label>
                                  <textarea
                                    value={st.stationContextNote || ""}
                                    onChange={(e) => handleUpdateStation(st.id, "stationContextNote", e.target.value)}
                                    rows={2}
                                    placeholder="ملاحظة مخصصة يقرأها الذكاء الاصطناعي لهذه المحطة تحديداً..."
                                    className="w-full p-2.5 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs font-medium focus:outline-none focus:border-primary transition-all resize-y"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={handleAddStation}
                          className="w-full py-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-bold text-xs hover:bg-primary/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة محطة جديدة (+ Add Station)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: إعدادات المساعد الذكي (AI Settings & Context Engine) */}
              {activeTab === "ai" && (
                <div className="animate-fadeIn space-y-6">
                  {/* Info Header Banner */}
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1">
                    <h4 className="font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span>توجيه عقل الذكاء الاصطناعي (AI Co-Pilot Context Engine)</span>
                    </h4>
                    <p className="text-[11px] text-on-surface-variant/80 leading-relaxed">
                      نظام التوليد المباشر يتيح للذكاء الاصطناعي قراءة عنوان الدرس والمرفقات لبناء القوانين والتوجيهات دون الحاجة لكتابة كود LaTeX يدوي.
                    </p>
                  </div>

                  {/* REQUIREMENT 2 & 4: Primary Action State (AI Generation Hero Card) */}
                  <div className="bg-gradient-to-br from-indigo-950/20 via-purple-950/15 to-surface border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-md space-y-5">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="space-y-1.5 max-w-xl">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-black">
                          <Bot className="w-3.5 h-3.5 text-indigo-500" />
                          <span>الجيل الثالث من محرك الأنشطة (A2A Co-Pilot Engine)</span>
                        </span>
                        <h3 className="text-lg font-black text-on-surface">
                          توليد السياق والقوانين الرياضية تلقائياً
                        </h3>
                        <p className="text-xs text-on-surface-variant/90 leading-relaxed font-medium">
                          دع الذكاء الاصطناعي يقرأ المرفقات ووصف الدرس لبناء سياق دقيق وقوانين رياضية جاهزة لمساعدة تلاميذك تلقائياً دون الحاجة لكتابة كود LaTeX أو الهندسة اليدوية للأوامر.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAutoGenerateAIContext}
                        disabled={isGeneratingAIContext}
                        className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black text-xs sm:text-sm shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                      >
                        {isGeneratingAIContext ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                            <span>جاري تحليل المرفقات وبناء السياق (قد يستغرق الأمر دقيقة أو أكثر)...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-5 h-5 text-amber-300 animate-bounce" />
                            <span>✨ توليد السياق الذكي تلقائياً (Auto-Generate AI Context)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* REQUIREMENT 3: Progressive Disclosure Accordion (Advanced Manual Mode) */}
                  <div className="bg-surface border border-outline/15 rounded-3xl overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedAIMode((prev) => !prev)}
                      className="w-full p-5 bg-surface-variant/30 hover:bg-surface-variant/50 transition-all flex items-center justify-between gap-3 text-right cursor-pointer select-none border-b border-outline/10"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">
                          <SettingsIcon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-on-surface">
                            ⚙️ التعديل اليدوي المتقدم (Advanced Manual Mode)
                          </h4>
                          <p className="text-[11px] text-on-surface-variant/70">
                            خاص بالمعلمين المحترفين لإدخال كود LaTeX المباشر وتعديل قواعد العزل المخصصة
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold text-primary shrink-0">
                        <span>{showAdvancedAIMode ? "إخفاء الوضع المتقدم" : "إظهار الوضع المتقدم"}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAdvancedAIMode ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {/* Hidden by default - Revealed only in Advanced Mode */}
                    {showAdvancedAIMode && (
                      <div className="p-6 space-y-6 animate-fadeIn border-t border-outline/10">
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="block text-xs font-bold text-on-surface">
                                ملخص القواعد المعتمدة للنشاط (سياق دائم للذكاء الاصطناعي - Global Context)
                              </span>
                              {/* Edit / Preview Tab Switcher */}
                              <div className="inline-flex p-1 rounded-xl bg-surface-variant/40 border border-outline/20">
                                <button
                                  type="button"
                                  onClick={() => setContextViewMode("edit")}
                                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                    contextViewMode === "edit"
                                      ? "bg-surface text-primary shadow-xs"
                                      : "text-on-surface-variant/70 hover:text-on-surface"
                                  }`}
                                >
                                  ✏️ وضع التعديل (Edit)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setContextViewMode("preview")}
                                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                    contextViewMode === "preview"
                                      ? "bg-surface text-primary shadow-xs"
                                      : "text-on-surface-variant/70 hover:text-on-surface"
                                  }`}
                                >
                                  👁️ معاينة السياق (Preview)
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsCleanLatexModalOpen(true)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                              <span>استخراج المرجع الرياضي من كود LaTeX</span>
                            </button>
                          </div>

                          {contextViewMode === "edit" ? (
                            <textarea
                              value={globalLatexSummary}
                              onChange={(e) => {
                                setGlobalLatexSummary(e.target.value);
                                setIsDirty(true);
                              }}
                              rows={5}
                              placeholder="اكتب ملخص القوانين والقواعد والإرشادات المعتمدة لهذا النشاط (مثال: ملخص مبرهنة القيم المتوسطة، الشروط، والقوانين المعتمدة)..."
                              className="w-full p-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all font-medium resize-y"
                            />
                          ) : (
                            <div className="p-4.5 rounded-2xl bg-muted/50 border border-outline/20 text-on-surface min-h-[160px] max-h-80 overflow-y-auto shadow-inner space-y-2" dir="rtl">
                              {globalLatexSummary.trim() ? (
                                <div className="prose dark:prose-invert max-w-none text-right text-xs sm:text-sm leading-relaxed">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                                  >
                                    {globalLatexSummary}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="text-center py-8 text-on-surface-variant/60 font-medium text-xs">
                                  لا يوجد سياق مكتوب للمعاينة بعد. قم بالتحويل إلى "وضع التعديل" أو اضغط "توليد السياق الذكي تلقائياً".
                                </div>
                              )}
                            </div>
                          )}

                          <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                            يوفر هذا الحقل الإطار المنهجي والقوانين العامة التي تؤطر المساعد الذكي (AI Agent) أثناء مرافقة التلميذ عبر كافة محطات هذا النشاط.
                          </p>

                          {/* Co-Pilot Chat UI for Context Refinement */}
                          <div className="space-y-2 pt-3 border-t border-outline/10">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-on-surface flex items-center gap-2">
                                <Bot className="w-4 h-4 text-indigo-500" />
                                <span>💬 الدردشة مع المساعد لتنقيح السياق (Chat with Assistant to Refine Context)</span>
                              </span>
                              <span className="text-[11px] font-bold text-on-surface-variant/70">
                                تحديث مباشر للسياق أعلاه
                              </span>
                            </div>

                            <div className="flex flex-col border border-outline/20 rounded-2xl bg-surface-variant/20 overflow-hidden shadow-xs">
                              {/* Scrollable Chat History Window */}
                              <div
                                ref={chatScrollRef}
                                className="overflow-y-auto flex-1 p-4 space-y-3 min-h-[180px] max-h-[260px] cursor-default text-xs"
                                dir="rtl"
                              >
                                {refinementChat.length === 0 ? (
                                  <div className="text-center py-6 text-on-surface-variant/60 space-y-1">
                                    <p className="font-extrabold text-xs">💬 مساعدك الذكي جاهز لتعديل وتنقيح سياق النشاط أعلاه.</p>
                                    <p className="text-[11px]">
                                      اطلب أي تعديل، إضافة، أو تبسيط (مثال: "بسط عبارة مبرهنة القيم المتوسطة"، "أضف قانون مشتق الدالة الأُسية"...).
                                    </p>
                                  </div>
                                ) : (
                                  refinementChat.map((msg, index) => (
                                    <div key={index} className="flex flex-col space-y-1">
                                      <div
                                        className={`p-3 rounded-2xl text-xs font-medium max-w-[85%] leading-relaxed ${
                                          msg.role === "user"
                                            ? "bg-primary text-on-primary ml-auto rounded-tr-xs shadow-2xs"
                                            : "bg-surface border border-outline/15 text-on-surface mr-auto rounded-tl-xs shadow-2xs"
                                        }`}
                                      >
                                        {msg.text}
                                      </div>
                                      <span
                                        className={`text-[10px] font-semibold text-on-surface-variant/50 px-1 ${
                                          msg.role === "user" ? "text-right" : "text-left"
                                        }`}
                                      >
                                        {msg.role === "user" ? "أنت" : "المساعد الذكي ✨"}
                                      </span>
                                    </div>
                                  ))
                                )}

                                {isRefining && (
                                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface border border-outline/15 text-xs font-bold text-primary mr-auto max-w-[85%] shadow-2xs animate-pulse">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>جاري تحليل توجيهاتك وتنفيذ التعديلات على السياق أعلاه...</span>
                                  </div>
                                )}
                              </div>

                              {/* Chat Input Bar (Non-Form DIV to prevent nested form HTML hydration errors) */}
                              <div className="p-2.5 bg-surface border-t border-outline/15 flex items-center gap-2" dir="rtl">
                                <input
                                  type="text"
                                  value={refinementInput}
                                  onChange={(e) => setRefinementInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSendRefinementChat();
                                    }
                                  }}
                                  disabled={isRefining || !globalLatexSummary.trim()}
                                  placeholder="اطلب أي تعديل، إضافة، أو حذف من السياق أعلاه..."
                                  className="flex-1 h-10 px-4 rounded-xl bg-surface-variant/40 border border-outline/20 text-on-surface text-xs font-medium focus:outline-none focus:border-primary transition-all disabled:opacity-50"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendRefinementChat()}
                                  disabled={isRefining || !refinementInput.trim() || !globalLatexSummary.trim()}
                                  className="h-10 px-4 rounded-xl bg-primary text-on-primary font-extrabold text-xs hover:bg-primary/90 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                                >
                                  {isRefining ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                  <span>تعديل</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Media Inclusion Selector (Requirement 2 - Replaces Redundant Dropzone) */}
                        <div className="space-y-3 pt-4 border-t border-outline/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <span className="text-xs font-bold text-on-surface">
                                المرفقات المضمنة في السياق (Attachments Included in Context)
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                              {referenceImageUrls.length} / {attachments.length} مضمّنة
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                            اختر المرفقات المرفوعة مسبقاً في قسم (المرفقات والملفات) لتقديمها كمصدر بصري ومعرفي للمساعد الذكي:
                          </p>

                          {attachments.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-surface-variant/20 border border-dashed border-outline/25 text-center space-y-1">
                              <p className="text-xs font-bold text-on-surface">لا توجد مرفقات مضافة لهذا النشاط بعد</p>
                              <p className="text-[11px] text-on-surface-variant/70">
                                قم برفع وثائق الـ PDF أو الصور أولاً في قسم (المرفقات والملفات) لتتمكن من تضمينها في سياق الذكاء الاصطناعي.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {attachments.map((att, index) => {
                                const attUrl = typeof att === "string" ? att : att.url;
                                const attTitle = typeof att === "string" ? `مرفق #${index + 1}` : att.title || `مرفق #${index + 1}`;
                                const attType = typeof att === "string"
                                  ? (att.endsWith(".pdf") ? "pdf" : "image")
                                  : (att.type || (att.url.endsWith(".pdf") ? "pdf" : "image"));

                                const isIncluded = referenceImageUrls.includes(attUrl);

                                const toggleInclusion = (checked: boolean) => {
                                  setIsDirty(true);
                                  if (checked) {
                                    setReferenceImageUrls((prev) => Array.from(new Set([...prev, attUrl])));
                                  } else {
                                    setReferenceImageUrls((prev) => prev.filter((u) => u !== attUrl));
                                  }
                                };

                                return (
                                  <div
                                    key={index}
                                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                      isIncluded
                                        ? "bg-indigo-500/10 border-indigo-500/40 shadow-2xs"
                                        : "bg-surface-variant/20 border-outline/15 opacity-75 hover:opacity-100"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <a
                                        href={attUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="فتح المعاينة في نافذة جديدة"
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 hover:scale-105 transition-transform cursor-pointer ${
                                          attType === "pdf" ? "bg-red-500/10 text-red-600 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                        }`}
                                      >
                                        {attType === "pdf" ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                                      </a>
                                      <div className="min-w-0">
                                        <a
                                          href={attUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="فتح المعاينة في نافذة جديدة"
                                          className="text-xs font-bold text-on-surface truncate hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer flex items-center gap-1.5 group/link"
                                        >
                                          <span className="truncate">{attTitle}</span>
                                          <ExternalLink className="w-3 h-3 text-on-surface-variant/60 group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-400 shrink-0 transition-colors" />
                                        </a>
                                        <span className="text-[10px] text-on-surface-variant/70 font-semibold">
                                          {attType === "pdf" ? "مستند PDF" : "صورة مرجعية"}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] font-bold text-on-surface-variant">
                                        {isIncluded ? "مضمّن في الذكاء الاصطناعي" : "مستبعد"}
                                      </span>
                                      <MD3Switch checked={isIncluded} onChange={toggleInclusion} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Global Deep Isolation Builder */}
                        <div className="space-y-3 pt-4 border-t border-outline/10">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span className="text-xs font-bold text-on-surface">
                                قواعد العزل المخصصة للنشاط ككل (Global Deep Isolation)
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddGlobalCustomIsolationRule}
                              className="px-3.5 h-8 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold text-[11px] hover:bg-purple-500/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>إضافة سياق مخصص عام لتلميذ/فئة</span>
                            </button>
                          </div>

                          <p className="text-[11px] text-on-surface-variant/80 leading-relaxed">
                            تتيح لك هذه القواعد إضافة توجيهات وملاحظات سرية للمساعد الذكي تطبق على تلاميذ محددين عبر **كافة محطات النشاط** دون الحاجة لتكرارها في كل محطة.
                          </p>

                          {globalCustomIsolations.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-purple-500/5 border border-dashed border-purple-500/20 text-center text-xs font-medium text-on-surface-variant/70">
                              لم يتم إضافة أي سياق مخصص عام لتلاميذ محددين على مستوى النشاط بعد.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {globalCustomIsolations.map((rule, rIdx) => (
                                <div
                                  key={rule.id}
                                  className="p-4 rounded-2xl bg-purple-950/10 dark:bg-purple-950/20 border border-purple-500/30 space-y-3 relative shadow-2xs"
                                >
                                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 font-extrabold text-[10px] flex items-center justify-center">
                                        {rIdx + 1}
                                      </span>
                                      <span className="text-xs font-extrabold text-purple-800 dark:text-purple-300">
                                        قاعدة عزل عامة على مستوى النشاط #{rIdx + 1}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveGlobalCustomIsolationRule(rule.id)}
                                      className="p-1.5 rounded-lg bg-error/10 text-error hover:bg-error hover:text-on-error transition-all cursor-pointer"
                                      title="إزالة هذه القاعدة العامة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] font-bold text-on-surface">
                                        تحديد التلاميذ المستهدفين بهذه القاعدة العامة:
                                      </label>
                                      <button
                                         type="button"
                                         onClick={() => {
                                           setActiveRuleTargetId(rule.id);
                                           setTargetModalStudentIds(rule.studentIds || []);
                                           setTargetModalGroupIds(rule.groupIds || []);
                                           setTargetModalTargets(rule.targets || []);
                                           setIsTargetModalOpen(true);
                                         }}
                                         className="w-full h-11 px-4 rounded-xl bg-surface border border-outline/30 text-on-surface font-extrabold text-xs hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center justify-between shadow-2xs cursor-pointer"
                                       >
                                         <span className="flex items-center gap-2">
                                           <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                           <span>👥 تحديد الفئة المستهدفة</span>
                                         </span>
                                         <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[11px] font-black">
                                           عدد المحدد: {(rule.studentIds?.length || 0) + (rule.groupIds?.length || 0)}
                                         </span>
                                       </button>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="block text-[11px] font-bold text-on-surface">
                                        الملاحظة والسياق السري للذكاء الاصطناعي (لكافة المحطات):
                                      </label>
                                      <textarea
                                        value={rule.specificContextNote}
                                        onChange={(e) =>
                                          handleUpdateGlobalCustomIsolationRule(rule.id, "specificContextNote", e.target.value)
                                        }
                                        rows={3}
                                        placeholder="مثال: هذا التلميذ يحتاج تبسيط القوانين وصياغة التمارين له بلغة مبسطة جداً عبر جميع المحطات..."
                                        className="w-full p-2.5 rounded-xl bg-surface border border-outline/30 text-on-surface text-xs font-medium focus:outline-none focus:border-purple-500 transition-all resize-y"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: التصريح والخيارات الإضافية (Advanced Settings & Targeting) */}
              {activeTab === "settings" && (
                <div className="animate-fadeIn space-y-6">
                  {/* Card: Target Groups & Excluded Students */}
                  <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-outline/10 pb-3 flex-wrap gap-2">
                      <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <span>الأفواج والتلاميذ المستهدفون بالنشاط</span>
                      </h3>
                      <button
                        type="button"
                        onClick={handleOpenExceptionsModal}
                        className="px-3.5 py-2 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold text-xs hover:bg-purple-500/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>استثناء تلاميذ محددين ({excludedStudentIds.length})</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-on-surface-variant">اختر الأفواج المسموح لها بالوصول للنشاط:</span>
                        <button
                          type="button"
                          onClick={handleSelectAllGroups}
                          className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          تحديد كافة الأفواج
                        </button>
                      </div>

                      {groupNotice && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold animate-fadeIn flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>يرجى اختيار فوج واحد على الأقل أولاً قبل استثناء التلاميذ.</span>
                        </div>
                      )}

                      {availableGroups.length === 0 ? (
                        <p className="text-xs text-on-surface-variant/70 italic p-3 rounded-xl bg-surface-variant/20">
                          لا توجد أفواج متاحة لهذا النشاط في هذه الدورة.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {availableGroups.map((g) => {
                            const isSelected = groupIds.includes(g.id!);
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => handleToggleGroup(g.id!)}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                                  isSelected
                                    ? "bg-primary text-on-primary border-primary shadow-xs"
                                    : "bg-surface-variant/30 text-on-surface border-outline/20 hover:border-primary/40"
                                }`}
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>{g.name}</span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
                            onChange={(e) => {
                              setHasQuiz(e.target.checked);
                              setIsDirty(true);
                            }}
                            className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary cursor-pointer"
                          />
                          <span>تفعيل اختبار تفاعلي (Quiz)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface">
                          <input
                            type="checkbox"
                            checked={requireSubmission}
                            onChange={(e) => {
                              setRequireSubmission(e.target.checked);
                              setIsDirty(true);
                            }}
                            className="w-4 h-4 rounded border-outline/30 text-primary focus:ring-primary cursor-pointer"
                          />
                          <span>يتطلب تسليم إجابة</span>
                        </label>
                      </div>
                    </div>

                    {hasQuiz && (
                      <div className="pt-2">
                        <QuizBuilder
                          questions={quiz}
                          onChange={(newQuiz) => {
                            setQuiz(newQuiz);
                            setIsDirty(true);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Task B: Localized Student Submissions Section for this Activity */}
      {(requireSubmission || hasQuiz) && (
        <div className="mt-10">
          <hr className="my-8 border-outline/20" />
          <ActivitySubmissionsList activityId={activityId} courseId={courseId} />
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

      {/* Modal Dialog for Adding / Editing Physical File Attachment (PDF / Image) */}
      {isAttModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="bg-surface border border-outline/20 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline/15 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-on-surface">
                    {editingAttIndex !== null ? "تعديل الوثيقة المرفقة" : "إضافة وثيقة أو ملف جديد (PDF / صورة)"}
                  </h3>
                  <p className="text-xs text-on-surface-variant/80">
                    أدخل عنوان المرفق وارفع ملف الـ PDF أو الصورة مباشرة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseAttModal}
                className="w-9 h-9 rounded-full bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Field 1: Title Input */}
              <div className="space-y-1">
                <label className="block font-bold text-on-surface">عنوان المرفق <span className="text-error">*</span></label>
                <input
                  type="text"
                  value={attTitle}
                  onChange={(e) => {
                    setAttTitle(e.target.value);
                    if (e.target.value.trim()) setAttTitleError(false);
                  }}
                  placeholder="مثال: ملخص الدرس وحلول التمارين المنهجية..."
                  className={`w-full h-11 px-4 rounded-xl bg-surface-variant/40 border text-on-surface font-semibold text-xs focus:outline-none transition-all ${
                    attTitleError
                      ? "border-error focus:border-error ring-2 ring-error/30 bg-error/5"
                      : "border-outline/30 focus:border-primary"
                  }`}
                />
                {attTitleError && (
                  <p className="text-[11px] text-error font-extrabold flex items-center gap-1 mt-1 animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>يرجى إدخال عنوان الوثيقة المرفقة أولاً</span>
                  </p>
                )}
              </div>

              {/* Field 2: File Dropzone (Cloudinary Direct Uploader - Strict Single File PDF/Image) */}
              <div className={`space-y-2 p-4 rounded-2xl transition-all ${
                attUrlError
                  ? "bg-error/5 border-2 border-error ring-2 ring-error/30"
                  : "bg-surface-variant/20 border border-outline/15"
              }`}>
                <HomeworkUploader
                  currentUrl={attUrl}
                  maxFiles={1}
                  label="منطقة رفع الملف (PDF أو صورة). ارفع ملفاً واحداً فقط."
                  onUploadSuccess={(urls) => {
                    if (urls && urls.length > 0) {
                      setAttUrl(urls[0]);
                      setAttUrlError(false);
                    }
                  }}
                />
                {attUrlError && (
                  <p className="text-[11px] text-error font-extrabold flex items-center gap-1 mt-1 animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>يرجى اختيار ورفع ملف PDF أو صورة قبل حفظ المرفق</span>
                  </p>
                )}
              </div>

              {/* Field 4: Description (Optional) */}
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
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-2 border-t border-outline/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseAttModal}
                className="h-11 px-5 rounded-xl bg-surface-variant/40 text-on-surface-variant font-bold text-xs hover:bg-surface-variant transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAttachmentItem}
                className="h-11 px-6 rounded-xl bg-secondary text-on-secondary font-extrabold text-xs hover:bg-secondary/90 transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ المرفق</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom React Modal for Saving Presets (Replaces window.prompt) */}
      {isSavePresetModalOpen && presetModalStation && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          dir="rtl"
        >
          <div className="bg-surface border border-outline/20 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline/15 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <BookmarkPlus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-on-surface">حفظ قالب العزل</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSavePresetModalOpen(false);
                  setPresetModalStation(null);
                }}
                className="w-8 h-8 rounded-full bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSavePreset} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface">
                  اسم القالب <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder="مثال: قالب أفوج مدرسة لؤي..."
                  required
                  disabled={isSavingPreset}
                  className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-semibold text-xs focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-on-surface-variant/70">
                  احفظ الفئة المستهدفة وملاحظة الوكيل الحالية للاستيراد السريع في باقي المحطات.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsSavePresetModalOpen(false);
                    setPresetModalStation(null);
                  }}
                  disabled={isSavingPreset}
                  className="h-11 px-5 rounded-xl bg-surface-variant/40 text-on-surface-variant font-bold text-xs hover:bg-surface-variant transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingPreset || !presetNameInput.trim()}
                  className="h-11 px-6 rounded-xl bg-primary text-on-primary font-extrabold text-xs hover:bg-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingPreset ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>حفظ القالب</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI LaTeX Extractor Modal Overlay */}
      {isCleanLatexModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn dir-rtl">
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!isCleaningLatex) setIsCleanLatexModalOpen(false);
            }}
          />

          <div className="relative z-10 w-full max-w-2xl bg-surface border border-outline/20 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-outline/10">
              <span className="text-xs sm:text-sm font-extrabold text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <span>المستخرج الذكي للمراجع الرياضية من أكواد LaTeX الخام</span>
              </span>
              <button
                type="button"
                disabled={isCleaningLatex}
                onClick={() => setIsCleanLatexModalOpen(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface">
                قم بلصق كود الـ LaTeX الكامل غير المنظم (مع الحزم والـ usepackage والألوان):
              </label>
              <textarea
                dir="ltr"
                value={rawLatexInput}
                onChange={(e) => setRawLatexInput(e.target.value)}
                disabled={isCleaningLatex}
                rows={8}
                placeholder="انسخ كود الـ LaTeX الكامل هنا (بما فيه من \usepackage, \definecolor, \geometry, \fancyhdr, والديباجة الرسمية)..."
                className="w-full p-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-left font-mono text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all leading-relaxed"
              />
              <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                سيعمل الذكاء الاصطناعي على تنقية الكود، حذف الديباجة وأوامر التنسيق الشكلي، واستخلاص التمارين والمعادلات الرياضية الأساسية فقط.
              </p>
            </div>

            {cleanLatexError && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cleanLatexError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-outline/10">
              <button
                type="button"
                disabled={isCleaningLatex || !rawLatexInput.trim()}
                onClick={handleCleanAndExtractLatex}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-extrabold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCleaningLatex ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التنظيف والاستخراج بالذكاء الاصطناعي...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>تنظيف واستخراج التمارين ↵</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isCleaningLatex}
                onClick={() => setIsCleanLatexModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-variant/40 hover:bg-surface-variant text-on-surface font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Selection Modal for Deep Isolation Rules (Requirement 3 & 4) */}
      <TargetSelectionModal
        isOpen={isTargetModalOpen}
        onClose={() => {
          setIsTargetModalOpen(false);
          setActiveRuleTargetId(null);
        }}
        selectedStudentIds={targetModalStudentIds}
        selectedGroupIds={targetModalGroupIds}
        selectedTargets={targetModalTargets}
        allStudents={allStudentsList}
        groups={availableGroups}
        onConfirm={handleConfirmTargetSelection}
      />

      {/* Unsaved Changes Navigation Guard Dialog (Shadcn AlertDialog) */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-500 font-extrabold">تغييرات غير محفوظة</AlertDialogTitle>
            <AlertDialogDescription>
              لديك تغييرات لم تقم بحفظها. إذا غادرت هذه الصفحة الآن، ستفقد كل ما قمت بتعديله.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowUnsavedDialog(false);
                setPendingNavUrl(null);
              }}
            >
              البقاء في الصفحة
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold"
              onClick={() => {
                if (pendingNavUrl) {
                  window.location.href = pendingNavUrl;
                }
              }}
            >
              تجاهل والمغادرة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

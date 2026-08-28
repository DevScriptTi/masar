"use client";

import React, { useState, useEffect, useMemo } from "react";
import { GroupDoc } from "@/src/lib/firebase/groupsService";
import { StudentOption } from "@/src/app/(teacher)/courses/[courseId]/activities/[activityId]/page";
import { TargetItem } from "@/src/lib/firebase/coursesService";
import {
  Users,
  UserCheck,
  Search,
  X,
  CheckCircle2,
  Check,
  Info,
  Filter,
} from "lucide-react";

export interface TargetSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudentIds?: string[];
  selectedGroupIds?: string[];
  selectedTargets?: TargetItem[];
  onConfirm: (targets: TargetItem[], studentIds: string[], groupIds: string[]) => void;
  allStudents: StudentOption[];
  groups: GroupDoc[];
  title?: string;
}

export function TargetSelectionModal({
  isOpen,
  onClose,
  selectedStudentIds = [],
  selectedGroupIds = [],
  selectedTargets = [],
  onConfirm,
  allStudents,
  groups,
  title = "اختيار التلاميذ أو الأفواج المستهدفة",
}: TargetSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<"cohorts" | "students">("cohorts");
  const [searchQuery, setSearchQuery] = useState("");
  const [studentCohortFilter, setStudentCohortFilter] = useState<string>("all");
  const [tempStudentIds, setTempStudentIds] = useState<string[]>([]);
  const [tempGroupIds, setTempGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (Array.isArray(selectedTargets) && selectedTargets.length > 0) {
        const cohortIds = selectedTargets
          .filter((t) => t.targetType === "cohort")
          .map((t) => t.targetId);
        const studentIds = selectedTargets
          .filter((t) => t.targetType === "student")
          .map((t) => t.targetId);

        setTempGroupIds(Array.from(new Set([...selectedGroupIds, ...cohortIds])));
        setTempStudentIds(Array.from(new Set([...selectedStudentIds, ...studentIds])));
      } else {
        setTempStudentIds(selectedStudentIds || []);
        setTempGroupIds(selectedGroupIds || []);
      }
      setSearchQuery("");
      setStudentCohortFilter("all");
    }
  }, [isOpen, selectedStudentIds, selectedGroupIds, selectedTargets]);

  // Dynamically compute student count for each cohort from allStudents & group doc
  const cohortStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    groups.forEach((g) => {
      if (!g.id) return;
      const matchingStudentsCount = allStudents.filter(
        (s) =>
          s.groupId === g.id ||
          (Boolean(s.allGroupKeys && g.id) && s.allGroupKeys!.includes(g.id!)) ||
          s.groupName === g.name
      ).length;
      counts[g.id] = matchingStudentsCount > 0 ? matchingStudentsCount : (g as any).studentCount || 0;
    });
    return counts;
  }, [groups, allStudents]);

  // Filtered Cohorts (100% Independent)
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  // Filtered Students (Strictly visual cohort filter local to Students tab)
  const filteredStudents = useMemo(() => {
    let result = allStudents;

    // Apply local visual cohort filter
    if (studentCohortFilter !== "all") {
      const selectedGroup = groups.find((g) => g.id === studentCohortFilter);
      result = result.filter(
        (s) =>
          s.groupId === studentCohortFilter ||
          (Boolean(s.allGroupKeys && studentCohortFilter) && s.allGroupKeys!.includes(studentCohortFilter)) ||
          (selectedGroup && s.groupName === selectedGroup.name)
      );
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.groupName && s.groupName.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allStudents, searchQuery, studentCohortFilter, groups]);

  const toggleGroup = (groupId: string) => {
    setTempGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleStudent = (studentId: string) => {
    setTempStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleSelectAllGroups = () => {
    const allFilteredGIds = filteredGroups.map((g) => g.id!).filter(Boolean);
    const allSelected = allFilteredGIds.every((id) => tempGroupIds.includes(id));

    if (allSelected) {
      setTempGroupIds((prev) => prev.filter((id) => !allFilteredGIds.includes(id)));
    } else {
      setTempGroupIds((prev) => Array.from(new Set([...prev, ...allFilteredGIds])));
    }
  };

  const toggleSelectAllStudents = () => {
    const allFilteredSIds = filteredStudents.map((s) => s.id);
    const allSelected = allFilteredSIds.every((id) => tempStudentIds.includes(id));

    if (allSelected) {
      setTempStudentIds((prev) => prev.filter((id) => !allFilteredSIds.includes(id)));
    } else {
      setTempStudentIds((prev) => Array.from(new Set([...prev, ...allFilteredSIds])));
    }
  };

  const handleConfirm = () => {
    // Generate strict TargetItem array (No flattening of cohorts into student IDs)
    const targets: TargetItem[] = [
      ...tempGroupIds.map((gId) => ({ targetType: "cohort" as const, targetId: gId })),
      ...tempStudentIds.map((sId) => ({ targetType: "student" as const, targetId: sId })),
    ];
    onConfirm(targets, tempStudentIds, tempGroupIds);
    onClose();
  };

  if (!isOpen) return null;

  const totalSelectedCount = tempStudentIds.length + tempGroupIds.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-surface border border-outline/20 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-4 relative max-h-[90vh] flex flex-col animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline/15 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-on-surface">{title}</h3>
              <p className="text-xs text-on-surface-variant/80">
                حدد الفوج ككل أو اختر تلاميذ محددين لتطبيق قواعد العزل والسياق المخصص
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sticky Search Bar & Filter Controls */}
        <div className="space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute right-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "cohorts"
                  ? "ابحث باسم الفوج..."
                  : "ابحث باسم التلميذ أو الفوج..."
              }
              className="w-full h-10 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface font-semibold text-xs focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>

          {/* Helper Text under Search Bar */}
          <p className="text-[11px] text-on-surface-variant/80 font-medium px-1 flex items-center gap-1.5 leading-normal">
            <Info className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>التبويبات مستقلة: يمكنك تحديد فوج كامل، وإضافة تلاميذ فرديين من أفواج أخرى في نفس القاعدة.</span>
          </p>

          {/* Custom Tabs Bar */}
          <div className="flex items-center justify-between bg-surface-variant/30 p-1.5 rounded-2xl border border-outline/15">
            <div className="flex items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => setActiveTab("cohorts")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "cohorts"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>الأفواج الكاملة ({groups.length})</span>
                {tempGroupIds.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-white/20 text-white text-[10px] font-black flex items-center justify-center">
                    {tempGroupIds.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("students")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "students"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>كل التلاميذ (استثناءات فردية) ({allStudents.length})</span>
                {tempStudentIds.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-white/20 text-white text-[10px] font-black flex items-center justify-center">
                    {tempStudentIds.length}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Bulk Select Button */}
            <button
              type="button"
              onClick={activeTab === "cohorts" ? toggleSelectAllGroups : toggleSelectAllStudents}
              className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 transition-colors shrink-0 cursor-pointer"
            >
              تحديد/إلغاء الكل
            </button>
          </div>

          {/* Local Visual Cohort Filter Dropdown (Active only in Students Tab) */}
          {activeTab === "students" && (
            <div className="flex items-center gap-2 pt-1 animate-fadeIn bg-purple-500/5 p-2 rounded-2xl border border-purple-500/15">
              <Filter className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-[11px] font-extrabold text-purple-900 dark:text-purple-200 shrink-0">
                تصفية القائمة حسب الفوج:
              </span>
              <select
                value={studentCohortFilter}
                onChange={(e) => setStudentCohortFilter(e.target.value)}
                className="h-8 px-3 rounded-xl bg-surface border border-outline/30 text-on-surface font-extrabold text-xs focus:outline-none focus:border-purple-500 transition-all flex-1 cursor-pointer"
              >
                <option value="all">جميع الأفواج (عرض كافة التلاميذ)</option>
                {groups.map((group) => {
                  const count = group.id ? (cohortStudentCounts[group.id] ?? 0) : 0;
                  return (
                    <option key={group.id} value={group.id}>
                      {group.name} ({count} تلميذ)
                    </option>
                  );
                })}
              </select>

              {studentCohortFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setStudentCohortFilter("all")}
                  className="px-2.5 h-8 rounded-xl bg-purple-600 text-white font-bold text-[11px] hover:bg-purple-700 transition-all shrink-0 cursor-pointer shadow-2xs"
                >
                  إعادة تعيين التصفية
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Content List Container */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[340px] pr-1 space-y-2">
          {activeTab === "cohorts" ? (
            filteredGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-on-surface-variant/70 italic">
                لا توجد أفواج مطابقة للبحث.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredGroups.map((group) => {
                  const isChecked = group.id ? tempGroupIds.includes(group.id) : false;
                  const sCount = group.id ? (cohortStudentCounts[group.id] ?? (group as any).studentCount ?? 0) : 0;
                  return (
                    <div
                      key={group.id}
                      onClick={() => group.id && toggleGroup(group.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isChecked
                          ? "bg-purple-500/10 border-purple-500/50 text-purple-900 dark:text-purple-200 font-bold shadow-2xs"
                          : "bg-surface-variant/20 border-outline/15 text-on-surface hover:bg-surface-variant/40"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            isChecked
                              ? "bg-purple-600 border-purple-600 text-white"
                              : "border-outline/40 bg-surface"
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h5 className="text-xs font-bold truncate">{group.name}</h5>
                            <span className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300 shrink-0">
                              ({sCount} {sCount === 1 ? "تلميذ" : sCount > 10 ? "تلميذ" : "تلاميذ"})
                            </span>
                          </div>
                          <span className="text-[10px] text-on-surface-variant/70 font-semibold block">
                            {sCount === 0 ? "فوج فارغ (0 تلاميذ)" : `فوج نشط يحتوي على ${sCount} تلميذ`}
                          </span>
                        </div>
                      </div>

                      {/* Muted Student Count Badge */}
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
                          sCount === 0
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                            : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                        }`}
                      >
                        {sCount} تلميذ
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant/70 italic">
              {studentCohortFilter !== "all"
                ? "لا يوجد تلاميذ في هذا الفوج المحدد مطبقون للتصفية."
                : "لا يوجد تلاميذ مطابقون للبحث."}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredStudents.map((student) => {
                const isChecked = tempStudentIds.includes(student.id);
                return (
                  <div
                    key={student.id}
                    onClick={() => toggleStudent(student.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isChecked
                        ? "bg-purple-500/10 border-purple-500/50 text-purple-900 dark:text-purple-200 font-bold shadow-2xs"
                        : "bg-surface-variant/20 border-outline/15 text-on-surface hover:bg-surface-variant/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isChecked
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "border-outline/40 bg-surface"
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold truncate">{student.fullName}</h5>
                        {student.email && (
                          <span className="text-[10px] text-on-surface-variant/70 block truncate dir-ltr text-right" dir="ltr">
                            {student.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Muted Contextual Cohort Badge */}
                    {student.groupName && (
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0 flex items-center gap-1">
                        <Users className="w-3 h-3 text-purple-500" />
                        <span>{student.groupName}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-outline/15 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-on-surface-variant">
            إجمالي التحديد الحالي: <strong className="text-purple-600 dark:text-purple-400">{totalSelectedCount}</strong> عنصر ({tempGroupIds.length} فوج، {tempStudentIds.length} تلميذ)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-surface-variant/40 text-on-surface-variant font-bold text-xs hover:bg-surface-variant transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="h-10 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تأكيد الاختيار ({totalSelectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

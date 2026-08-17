"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { GroupDoc } from "@/src/lib/firebase/groupsService";
import { MD3Switch } from "@/src/components/admin/courses/MD3Switch";
import {
  Users,
  Search,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Lock,
} from "lucide-react";

export interface StudentItem {
  id: string;
  fullName: string;
  email: string;
  groupId: string;
  groupName: string;
  avatar?: string;
}

interface StudentExceptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGroupIds: string[];
  groups: GroupDoc[];
  excludedStudentIds: string[];
  parentExcludedStudentIds?: string[];
  onSave: (newExcludedStudentIds: string[]) => void;
}

export function StudentExceptionsModal({
  isOpen,
  onClose,
  selectedGroupIds,
  groups,
  excludedStudentIds,
  parentExcludedStudentIds = [],
  onSave,
}: StudentExceptionsModalProps) {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tempExcluded, setTempExcluded] = useState<string[]>([]);

  // Derived selected full Group objects from selectedGroupIds
  const selectedGroups = groups.filter((g) => g.id && selectedGroupIds.includes(g.id));

  // Fetch REAL students with Dual-Check matching
  useEffect(() => {
    if (!isOpen) return;

    setTempExcluded(excludedStudentIds || []);
    setSearchQuery("");

    const loadRealStudents = async () => {
      setLoading(true);
      try {
        const fetched: StudentItem[] = [];
        const usersRef = collection(db, "users");

        const q = query(usersRef, where("role", "==", "student"));
        const snap = await getDocs(q);

        snap.docs.forEach((d) => {
          const u = d.data();
          const uGroupId = u.groupId || u.cohortId;

          let matchedGroup: GroupDoc | undefined = undefined;

          if (uGroupId) {
            matchedGroup = selectedGroups.find(
              (g) => g.id === uGroupId || g.name === uGroupId
            );
          }

          if (!matchedGroup && u.enrollments) {
            if (typeof u.enrollments === "object" && !Array.isArray(u.enrollments)) {
              const keys = Object.keys(u.enrollments);
              matchedGroup = selectedGroups.find((g) =>
                keys.some((key) => (g.id && key === g.id) || key === g.name)
              );
            } else if (Array.isArray(u.enrollments)) {
              matchedGroup = selectedGroups.find((g) =>
                u.enrollments.some((key: string) => (g.id && key === g.id) || key === g.name)
              );
            }
          }

          if (matchedGroup && matchedGroup.id) {
            fetched.push({
              id: d.id,
              fullName: u.fullName || u.displayName || u.name || "تلميذ مسجل",
              email: u.email || "بدون بريد",
              groupId: matchedGroup.id,
              groupName: matchedGroup.name,
              avatar: u.avatar,
            });
          }
        });

        setStudents(fetched);
      } catch (error) {
        console.error("Error fetching real students from Firestore:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRealStudents();
  }, [isOpen, selectedGroupIds, groups, excludedStudentIds]);

  if (!isOpen) return null;

  const handleToggleStudentVisibility = (studentId: string, currentVisible: boolean) => {
    // Cannot toggle if student is blocked at parent module level
    if (parentExcludedStudentIds.includes(studentId)) return;

    if (currentVisible) {
      setTempExcluded((prev) => [...prev, studentId]);
    } else {
      setTempExcluded((prev) => prev.filter((id) => id !== studentId));
    }
  };

  const handleSelectAll = () => {
    setTempExcluded([]);
  };

  const handleDeselectAll = () => {
    // Only exclude non-parent-excluded students here
    const selectableIds = students
      .map((s) => s.id)
      .filter((id) => !parentExcludedStudentIds.includes(id));
    setTempExcluded(selectableIds);
  };

  const handleSave = () => {
    onSave(tempExcluded);
    onClose();
  };

  // Filter students by search
  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.groupName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered students by Group Name
  const groupedStudents: Record<string, StudentItem[]> = {};
  filteredStudents.forEach((s) => {
    if (!groupedStudents[s.groupName]) {
      groupedStudents[s.groupName] = [];
    }
    groupedStudents[s.groupName].push(s);
  });

  const totalStudentsCount = students.length;
  const parentExcludedCount = students.filter((s) => parentExcludedStudentIds.includes(s.id)).length;
  const excludedCount = tempExcluded.length + parentExcludedCount;
  const visibleCount = Math.max(0, totalStudentsCount - excludedCount);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
      <div className="bg-surface border border-outline/15 rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col animate-scaleUp overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-outline/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-on-surface">
                تخصيص استثناءات التلاميذ (Student Exceptions)
              </h3>
              <p className="text-xs text-on-surface-variant/80 mt-0.5">
                حدد التلاميذ المستثنين من رؤية المحتوى داخل الأفواج المختارة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Bulk Action Toolbar */}
        <div className="p-4 bg-surface-variant/20 border-b border-outline/10 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-on-surface-variant/70 absolute right-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم التلميذ أو البريد..."
                className="w-full h-10 pr-9 pl-4 rounded-xl bg-surface border border-outline/20 text-on-surface text-xs focus:outline-none focus:border-primary font-medium"
              />
            </div>

            {students.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 h-9 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>إتاحة للجميع</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-3 h-9 rounded-xl bg-error-container/40 text-error font-bold text-[11px] hover:bg-error-container/60 transition-colors flex items-center gap-1"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>استثناء الجميع</span>
                </button>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-on-surface-variant/90 pt-1 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              إجمالي التلاميذ: <strong>{totalStudentsCount}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Eye className="w-3.5 h-3.5" />
              يستطيعون الرؤية: <strong>{visibleCount}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-error">
              <EyeOff className="w-3.5 h-3.5" />
              مستثنون: <strong>{excludedCount}</strong>
            </span>
          </div>
        </div>

        {/* Scrollable Students List */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 max-h-[50vh]">
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-xs font-semibold text-on-surface-variant">جاري تحميل قائمة تلاميذ الأفواج من قواعد البيانات...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-variant/40 text-on-surface-variant flex items-center justify-center mx-auto border border-outline/10">
                <AlertCircle className="w-6 h-6 text-on-surface-variant/70" />
              </div>
              <p className="text-xs font-bold text-on-surface">لا يوجد تلاميذ مسجلين في هذه الأفواج حالياً</p>
              <p className="text-[11px] text-on-surface-variant/80 max-w-sm mx-auto">
                عند قيام التلاميذ بالتسجيل والانضمام لهذه الأفواج، سيظهرون هنا تلقائياً لضبط استثناءات الرؤية.
              </p>
            </div>
          ) : Object.keys(groupedStudents).length === 0 ? (
            <div className="py-12 text-center space-y-2 text-on-surface-variant">
              <AlertCircle className="w-8 h-8 text-outline/50 mx-auto" />
              <p className="text-xs font-medium">لم يتم العثور على تلاميذ يطابقون شروط البحث.</p>
            </div>
          ) : (
            Object.entries(groupedStudents).map(([groupName, groupSts]) => (
              <div key={groupName} className="space-y-3">
                <div className="flex items-center justify-between border-b border-outline/10 pb-2">
                  <span className="text-xs font-extrabold text-primary flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>{groupName}</span>
                  </span>
                  <span className="text-[10px] font-bold text-on-surface-variant bg-surface-variant/40 px-2.5 py-0.5 rounded-lg">
                    {groupSts.length} تلميذ
                  </span>
                </div>

                <div className="space-y-2">
                  {groupSts.map((student) => {
                    const isParentExcluded = parentExcludedStudentIds.includes(student.id);
                    const isActivityExcluded = tempExcluded.includes(student.id);
                    const isVisibleToStudent = !isParentExcluded && !isActivityExcluded;

                    return (
                      <div
                        key={student.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                          isParentExcluded
                            ? "bg-surface-variant/40 border-outline/10 opacity-70"
                            : isVisibleToStudent
                            ? "bg-surface border-outline/15 hover:border-primary/30"
                            : "bg-error-container/10 border-error/20 opacity-80"
                        }`}
                      >
                        {/* Student Info */}
                        <div className="flex items-center gap-3 truncate">
                          <div
                            className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                              isParentExcluded
                                ? "bg-surface-variant text-on-surface-variant"
                                : isVisibleToStudent
                                ? "bg-primary/10 text-primary"
                                : "bg-error-container/30 text-error"
                            }`}
                          >
                            {student.fullName.charAt(0)}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-on-surface truncate">
                                {student.fullName}
                              </span>
                              {isParentExcluded && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>مستثنى من الفصل الأب</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-on-surface-variant/70 block truncate dir-ltr text-right" dir="ltr">
                              {student.email}
                            </span>
                          </div>
                        </div>

                        {/* MD3 Switch for Visibility */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[11px] font-bold ${
                              isParentExcluded
                                ? "text-on-surface-variant/70"
                                : isVisibleToStudent
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-error"
                            }`}
                          >
                            {isParentExcluded
                              ? "محظور بالفصل"
                              : isVisibleToStudent
                              ? "مرئي"
                              : "مستثنى (مخفي)"}
                          </span>
                          <MD3Switch
                            id={`st-switch-${student.id}`}
                            checked={isVisibleToStudent}
                            onChange={() => {
                              if (!isParentExcluded) {
                                handleToggleStudentVisibility(student.id, isVisibleToStudent);
                              }
                            }}
                            label=""
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-surface-variant/30 border-t border-outline/10 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-10 rounded-xl bg-surface-variant text-on-surface-variant font-bold text-xs hover:bg-surface-variant/80 transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 h-10 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>حفظ الاستثناءات</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudentExceptionsModal;

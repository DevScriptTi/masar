"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  fetchGroups,
  deleteGroup,
  archiveGroup,
  restoreGroup,
  GroupDoc,
} from "@/src/lib/firebase/groupsService";
import { CreateGroupModal } from "@/src/components/admin/modals/CreateGroupModal";
import { EditGroupModal } from "@/src/components/admin/modals/EditGroupModal";
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  FolderPlus,
  UserCheck,
  Archive,
  RotateCcw,
  MoreVertical,
  Edit3,
  Calendar,
  AlertTriangle,
} from "lucide-react";

export default function GroupsPage() {
  const [groupsList, setGroupsList] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals & Action States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupDoc | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<GroupDoc | null>(null);

  // Dropdown Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchGroups();
      setGroupsList(data);
    } catch (error) {
      console.error("Error loading groups:", error);
      setErrorMessage("حدث خطأ أثناء جلب قائمة الأفواج من الفايرستور.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async (group: GroupDoc) => {
    if (!group.id) return;
    setActiveMenuId(null);
    setActionLoadingId(group.id);
    setErrorMessage(null);

    try {
      if (group.status === "archived") {
        await restoreGroup(group.id);
      } else {
        await archiveGroup(group.id);
      }
      await loadGroups();
    } catch (error) {
      console.error("Error toggling archive status:", error);
      setErrorMessage("حدث خطأ أثناء تغيير حالة أرشفة الفوج.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!deletingGroup || !deletingGroup.id) return;

    const groupId = deletingGroup.id;
    setActionLoadingId(groupId);
    setErrorMessage(null);

    try {
      await deleteGroup(groupId);
      setDeletingGroup(null);
      await loadGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
      setErrorMessage("حدث خطأ أثناء حذف الفوج نهائياً.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadGroups}
      />

      {/* Edit Group Modal */}
      <EditGroupModal
        isOpen={!!editingGroup}
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSuccess={loadGroups}
      />

      {/* Permanent Delete Confirmation Dialog (MD3 Dialog) */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div
            onClick={() => setDeletingGroup(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-md bg-surface border border-outline/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3 text-error">
              <div className="p-3 rounded-2xl bg-error-container text-on-error-container">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">حذف الفوج نهائياً</h3>
                <p className="text-xs text-on-surface-variant">إجراء غير قابل للتراجع</p>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              هل أنت تأكد من رغبتك في حذف الفوج <strong className="text-on-surface font-bold">"{deletingGroup.name}"</strong> نهائياً من قاعدة البيانات؟
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
              <button
                type="button"
                onClick={() => setDeletingGroup(null)}
                className="px-4 h-10 rounded-xl bg-surface-variant/60 text-on-surface-variant font-semibold text-xs hover:bg-surface-variant transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmPermanentDelete}
                disabled={actionLoadingId === deletingGroup.id}
                className="px-5 h-10 rounded-xl bg-error text-on-error font-bold text-xs shadow-md hover:bg-error/90 transition-all flex items-center gap-2"
              >
                {actionLoadingId === deletingGroup.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>حذف نهائي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <span>إدارة الأفواج</span>
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            تنظيم المجموعات الدراسية، الأرشفة، وتحديث أو حذف بيانات الأفواج
          </p>
        </div>

        <div className="flex items-center gap-3 w-fit">
          <button
            type="button"
            onClick={loadGroups}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface-variant/60 text-on-surface-variant hover:bg-surface-variant text-sm font-medium transition-colors focus:outline-none"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-primary text-on-primary text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء فوج جديد</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-error-container/70 border border-error/30 text-on-error-container text-sm flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-error shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Main Groups Content */}
      {loading ? (
        /* Loading Skeleton Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-6 rounded-3xl bg-surface border border-outline/15 shadow-sm space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-outline/20" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-outline/20 rounded-md w-3/4" />
                  <div className="h-3 bg-outline/20 rounded-md w-1/2" />
                </div>
              </div>
              <div className="h-12 bg-outline/15 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : groupsList.length === 0 ? (
        /* Empty State */
        <div className="py-20 text-center space-y-4 border-2 border-dashed border-outline/20 rounded-3xl bg-surface/50 p-8 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mx-auto shadow-sm">
            <FolderPlus className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-on-surface">لا توجد أفواج حالياً</h3>
            <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              استخدم زر الإضافة لإنشاء فوج جديد وتنظيم تلاميذك ومتابعة تقدمهم الدراسي.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 h-12 rounded-2xl bg-primary text-on-primary text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء فوج جديد الآن</span>
          </button>
        </div>
      ) : (
        /* CSS Grid of MD3 Elevated Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupsList.map((group) => {
            const isArchived = group.status === "archived";
            const isMenuOpen = activeMenuId === group.id;
            const isLoading = actionLoadingId === group.id;

            return (
              <div
                key={group.id || group.name}
                className={`group relative rounded-3xl bg-surface border border-outline/15 p-6 shadow-sm hover:shadow-md hover:border-outline/30 transition-all duration-300 flex flex-col justify-between ${
                  isArchived ? "opacity-75 bg-surface-variant/20" : ""
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header: Icon & MD3 Action Menu */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`p-3.5 rounded-2xl shadow-sm shrink-0 ${
                        isArchived
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-secondary-container text-on-secondary-container"
                      }`}
                    >
                      <Users className="w-6 h-6" />
                    </div>

                    {/* MD3 Action Menu Trigger Button (MoreVert) */}
                    <div className="relative" ref={isMenuOpen ? dropdownRef : null}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId(isMenuOpen ? null : group.id || null)
                        }
                        disabled={isLoading}
                        className="p-2 rounded-xl text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant/80 focus:outline-none transition-colors"
                        aria-label="قائمة الإجراءات"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                          <MoreVertical className="w-5 h-5" />
                        )}
                      </button>

                      {/* MD3 Action Dropdown Menu */}
                      {isMenuOpen && (
                        <div
                          className="absolute left-0 top-full mt-1 w-44 bg-surface border border-outline/20 rounded-2xl shadow-xl z-30 py-1.5 animate-fadeIn text-xs font-semibold overflow-hidden"
                          dir="rtl"
                        >
                          {/* Item 1: Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setEditingGroup(group);
                            }}
                            className="w-full text-right px-4 py-2.5 flex items-center gap-2.5 text-on-surface hover:bg-surface-variant/60 transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-primary" />
                            <span>تعديل</span>
                          </button>

                          {/* Item 2: Archive / Restore */}
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(group)}
                            className="w-full text-right px-4 py-2.5 flex items-center gap-2.5 text-on-surface hover:bg-surface-variant/60 transition-colors"
                          >
                            {isArchived ? (
                              <>
                                <RotateCcw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>تنشيط</span>
                              </>
                            ) : (
                              <>
                                <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span>أرشفة</span>
                              </>
                            )}
                          </button>

                          <div className="my-1 border-t border-outline/10" />

                          {/* Item 3: Permanent Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setDeletingGroup(group);
                            }}
                            className="w-full text-right px-4 py-2.5 flex items-center gap-2.5 text-error hover:bg-error-container/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>حذف نهائي</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {/* Group Name - MD3 Headline */}
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-extrabold text-on-surface tracking-tight group-hover:text-primary transition-colors">
                        {group.name}
                      </h2>
                    </div>

                    {/* Group Description - MD3 Body Medium */}
                    <p className="text-xs text-on-surface-variant/80 mt-2 leading-relaxed min-h-[3rem] line-clamp-3">
                      {group.description || "لا يوجد وصف متاح لهذا الفوج."}
                    </p>
                  </div>
                </div>

                {/* Card Footer Meta Info */}
                <div className="mt-6 pt-4 border-t border-outline/10 flex items-center justify-between text-xs text-on-surface-variant/70">
                  <div className="flex items-center gap-1.5 font-medium">
                    {isArchived ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                        <Archive className="w-3.5 h-3.5" />
                        <span>مؤرشف</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>نشط</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>فوج تفعيل</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
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
  FileEdit,
  Check,
  X,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

export default function GroupsPage() {
  const { user } = useAuth();
  const [groupsList, setGroupsList] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real-time Pending Name Requests State Requirement 3
  const [nameRequests, setNameRequests] = useState<any[]>([]);
  const [isLoadingNameRequests, setIsLoadingNameRequests] = useState(true);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [requestFeedback, setRequestFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Rejection Modal State Requirement 2
  const [rejectingReq, setRejectingReq] = useState<any | null>(null);
  const [rejectionReasonOption, setRejectionReasonOption] = useState<"fullname" | "nickname" | "custom">("fullname");
  const [customRejectionReason, setCustomRejectionReason] = useState("");
  const [isConfirmingReject, setIsConfirmingReject] = useState(false);

  // Open Rejection Dialog
  const openRejectModal = (req: any) => {
    setRejectingReq(req);
    setRejectionReasonOption("fullname");
    setCustomRejectionReason("");
  };

  // Handle Confirm Rejection with Specific Reason Requirement 3
  const handleConfirmReject = async () => {
    if (!rejectingReq) return;

    let finalReason = "";
    if (rejectionReasonOption === "fullname") {
      finalReason = "يرجى كتابة الاسم واللقب الحقيقي الكامل.";
    } else if (rejectionReasonOption === "nickname") {
      finalReason = "يمنع استخدام الأسماء المستعارة أو الرموز.";
    } else {
      finalReason = customRejectionReason.trim() || "عدم توفر الشروط الرسمية في الاسم.";
    }

    setIsConfirmingReject(true);
    setRequestActionId(rejectingReq.id);
    setRequestFeedback(null);

    try {
      // 1. Create error notification for the student including the specific reason Requirement 3
      if (rejectingReq.studentId) {
        await addDoc(collection(db, "notifications"), {
          userId: rejectingReq.studentId,
          title: "تم رفض طلب تغيير الاسم",
          message: `رفض الأستاذ طلب تغيير اسمك. السبب: ${finalReason}`,
          type: "error",
          href: "/settings",
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

      // 2. DELETE the request document from name_requests to prevent DB bloat
      await deleteDoc(doc(db, "name_requests", rejectingReq.id));

      setRequestFeedback({
        type: "success",
        text: `تم رفض طلب تغيير الاسم وإبلاغ الطالب بالسبب: "${finalReason}" بنجاح.`,
      });

      setRejectingReq(null);
    } catch (err: any) {
      console.error("Error confirming rejection:", err);
      setRequestFeedback({
        type: "error",
        text: "حدث خطأ أثناء تنفيذ عملية الرفض.",
      });
    } finally {
      setIsConfirmingReject(false);
      setRequestActionId(null);
    }
  };

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

  // Real-time onSnapshot listener for pending name requests where teacherId === auth.currentUser.uid Requirement 3
  useEffect(() => {
    if (!user?.uid) return;

    setIsLoadingNameRequests(true);
    const requestsRef = collection(db, "name_requests");

    const unsubscribe = onSnapshot(
      requestsRef,
      (snapshot) => {
        const list = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as any))
          .filter((req) => {
            if (req.status !== "pending") return false;
            // Match teacherId with logged in teacher UID or show if unassigned
            if (!req.teacherId) return true;
            return req.teacherId === user.uid;
          });

        setNameRequests(list);
        setIsLoadingNameRequests(false);
      },
      (error) => {
        console.error("Realtime name requests listener error:", error);
        setIsLoadingNameRequests(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle Approve Name Request Requirement 3
  const handleApproveNameRequest = async (req: any) => {
    setRequestActionId(req.id);
    setRequestFeedback(null);
    try {
      // 1. Update student's displayName & fullName in users collection
      if (req.studentId) {
        await updateDoc(doc(db, "users", req.studentId), {
          fullName: req.requestedName,
          displayName: req.requestedName,
        });

        // 2. Create success notification for the student
        await addDoc(collection(db, "notifications"), {
          userId: req.studentId,
          title: "تم تغيير اسمك",
          message: `وافق الأستاذ على تغيير اسمك إلى: ${req.requestedName}`,
          type: "success",
          href: "/settings",
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

      // 3. DELETE the request document from name_requests to prevent DB bloat
      await deleteDoc(doc(db, "name_requests", req.id));

      setRequestFeedback({
        type: "success",
        text: `تمت الموافقة وتحديث اسم الطالب إلى "${req.requestedName}" وتنبيهه بنجاح!`,
      });
    } catch (err: any) {
      console.error("Error approving request:", err);
      setRequestFeedback({
        type: "error",
        text: "حدث خطأ أثناء اعتماد التغيير.",
      });
    } finally {
      setRequestActionId(null);
    }
  };

  // Handle Reject Name Request Requirement 3
  const handleRejectNameRequest = async (req: any) => {
    setRequestActionId(req.id);
    setRequestFeedback(null);
    try {
      // 1. Create error notification for the student
      if (req.studentId) {
        await addDoc(collection(db, "notifications"), {
          userId: req.studentId,
          title: "تم رفض طلب تغيير الاسم",
          message: "رفض الأستاذ طلب تغيير اسمك.",
          type: "error",
          href: "/settings",
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

      // 2. DELETE the request document from name_requests to prevent DB bloat
      await deleteDoc(doc(db, "name_requests", req.id));

      setRequestFeedback({
        type: "success",
        text: "تم رفض طلب تغيير الاسم وإبلاغ الطالب بنجاح.",
      });
    } catch (err: any) {
      console.error("Error rejecting request:", err);
      setRequestFeedback({
        type: "error",
        text: "حدث خطأ أثناء رفض الطلب.",
      });
    } finally {
      setRequestActionId(null);
    }
  };

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

                {/* Card Footer Meta Info & Enter Group Button Requirement 5 */}
                <div className="mt-6 pt-4 border-t border-outline/10 space-y-3">
                  <div className="flex items-center justify-between text-xs text-on-surface-variant/70">
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

                  {/* Requirement 5: Enter Group Control Room Link Button */}
                  <Link
                    href={`/teacher/groups/${group.id}`}
                    className="w-full h-10 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-on-primary font-black text-xs transition-all flex items-center justify-center gap-2 border border-primary/20 shadow-2xs group/btn cursor-pointer active:scale-95"
                  >
                    <span>دخول غرفة تحكم الفوج</span>
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover/btn:-translate-x-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Real-time Name Change Requests Section Requirement 3 */}
      <div className="pt-8 border-t border-outline/15 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-secondary/15 text-secondary shadow-xs">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2">
                <span>طلبات تغيير الأسماء (تحديث حي)</span>
                {nameRequests.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary text-xs font-extrabold animate-pulse">
                    {nameRequests.length} معلقة
                  </span>
                )}
              </h3>
              <p className="text-xs text-on-surface-variant">
                مراجعة وتعديل أسماء التلاميذ فورياً عبر البث المباشر (Real-time)
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Banner */}
        {requestFeedback && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-fadeIn ${
              requestFeedback.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-error/10 text-error border-error/20"
            }`}
          >
            {requestFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{requestFeedback.text}</span>
          </div>
        )}

        {/* Compact Requests Table / List */}
        {isLoadingNameRequests ? (
          <div className="p-6 text-center bg-surface border border-outline/15 rounded-3xl space-y-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
            <p className="text-xs text-on-surface-variant">جاري الاتصال بالبث المباشر للطلبات...</p>
          </div>
        ) : nameRequests.length === 0 ? (
          <div className="p-6 text-center bg-surface border border-outline/15 rounded-3xl space-y-1">
            <p className="text-xs font-bold text-on-surface">لا توجد طلبات تغيير أسماء معلقة حالياً</p>
            <p className="text-[11px] text-on-surface-variant">أي طلب يقدمه تلميذك سيعرض هنا فوراً بدون الحاجة لتحديث الصفحة</p>
          </div>
        ) : (
          <div className="bg-surface border border-outline/15 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-surface-variant/40 text-on-surface-variant font-extrabold border-b border-outline/10">
                  <tr>
                    <th className="p-3.5 sm:px-6">الطالب الحرفي</th>
                    <th className="p-3.5 sm:px-6">الاسم الجديد المطلوب</th>
                    <th className="p-3.5 sm:px-6 hidden md:table-cell">السبب المكتوب</th>
                    <th className="p-3.5 sm:px-6 text-center">الإجراء السريع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10 font-medium">
                  {nameRequests.map((req) => {
                    const isProcessing = requestActionId === req.id;
                    return (
                      <tr key={req.id} className="hover:bg-surface-variant/20 transition-colors">
                        <td className="p-3.5 sm:px-6">
                          <div className="font-extrabold text-on-surface">{req.studentName || "طالب"}</div>
                          <div className="text-[11px] text-on-surface-variant font-mono" dir="ltr">{req.studentEmail || ""}</div>
                        </td>

                        <td className="p-3.5 sm:px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-black border border-primary/20">
                            {req.requestedName}
                          </span>
                        </td>

                        <td className="p-3.5 sm:px-6 hidden md:table-cell text-on-surface-variant max-w-xs truncate">
                          {req.reason || "بدون سبب"}
                        </td>

                        <td className="p-3.5 sm:px-6">
                          <div className="flex items-center justify-center gap-2">
                            {/* Approve ✓ Button */}
                            <button
                              type="button"
                              onClick={() => handleApproveNameRequest(req)}
                              disabled={isProcessing}
                              title="قبول واعتماد الاسم"
                              className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs flex items-center justify-center disabled:opacity-50 cursor-pointer active:scale-95"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4 stroke-[3]" />
                              )}
                            </button>

                            {/* Reject ✗ Button - Opens Rejection Reason Modal Requirement 2 */}
                            <button
                              type="button"
                              onClick={() => openRejectModal(req)}
                              disabled={isProcessing}
                              title="رفض الطلب وتحديد السبب"
                              className="w-9 h-9 rounded-xl bg-error/15 hover:bg-error/25 text-error font-bold transition-all border border-error/30 flex items-center justify-center disabled:opacity-50 cursor-pointer active:scale-95"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4 stroke-[3]" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Reason Dialog Modal Requirement 2 */}
      {rejectingReq && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => !isConfirmingReject && setRejectingReq(null)} />

          <div className="relative z-10 w-full max-w-md bg-surface border border-outline/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-error/15 text-error">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">سبب رفض الاسم</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">
                    تحديد السبب الموجه للتلميذ "{rejectingReq.studentName}"
                  </p>
                </div>
              </div>

              {!isConfirmingReject && (
                <button
                  type="button"
                  onClick={() => setRejectingReq(null)}
                  className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Rejection Options */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold text-on-surface">
                اختر أو اكتب سبب الرفض الموجه للطالب:
              </label>

              <div className="space-y-2">
                {/* Option 1 */}
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  rejectionReasonOption === "fullname"
                    ? "bg-primary/10 border-primary text-on-surface font-extrabold"
                    : "bg-surface-variant/30 border-outline/20 text-on-surface-variant hover:bg-surface-variant/50"
                }`}>
                  <input
                    type="radio"
                    name="rejectReason"
                    checked={rejectionReasonOption === "fullname"}
                    onChange={() => setRejectionReasonOption("fullname")}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-xs leading-relaxed">
                    يرجى كتابة الاسم واللقب الحقيقي الكامل.
                  </span>
                </label>

                {/* Option 2 */}
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  rejectionReasonOption === "nickname"
                    ? "bg-primary/10 border-primary text-on-surface font-extrabold"
                    : "bg-surface-variant/30 border-outline/20 text-on-surface-variant hover:bg-surface-variant/50"
                }`}>
                  <input
                    type="radio"
                    name="rejectReason"
                    checked={rejectionReasonOption === "nickname"}
                    onChange={() => setRejectionReasonOption("nickname")}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-xs leading-relaxed">
                    يمنع استخدام الأسماء المستعارة أو الرموز.
                  </span>
                </label>

                {/* Option 3: Custom */}
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  rejectionReasonOption === "custom"
                    ? "bg-primary/10 border-primary text-on-surface font-extrabold"
                    : "bg-surface-variant/30 border-outline/20 text-on-surface-variant hover:bg-surface-variant/50"
                }`}>
                  <input
                    type="radio"
                    name="rejectReason"
                    checked={rejectionReasonOption === "custom"}
                    onChange={() => setRejectionReasonOption("custom")}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-xs leading-relaxed">
                    سبب آخر (كتابة يدوية)...
                  </span>
                </label>
              </div>

              {/* Custom Input Textarea if custom option is selected */}
              {rejectionReasonOption === "custom" && (
                <textarea
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                  placeholder="اكتب سبب الرفض بالتفصيل ليظهر للطالب..."
                  rows={3}
                  className="w-full p-3 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary resize-none mt-2 animate-fadeIn"
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                disabled={isConfirmingReject}
                className="px-4 py-2.5 rounded-xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isConfirmingReject || (rejectionReasonOption === "custom" && !customRejectionReason.trim())}
                className="px-5 py-2.5 rounded-xl bg-error text-on-error hover:bg-error/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isConfirmingReject ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الرفض...</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>تأكيد الرفض</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

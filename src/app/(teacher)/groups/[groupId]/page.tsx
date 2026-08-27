"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { toast } from "@/src/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/src/components/ui/dropdown-menu";
import {
  Users,
  ArrowRight,
  UserCheck,
  UserX,
  Trash2,
  Megaphone,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  MoreVertical,
  Calendar,
  Mail,
  ShieldAlert,
  Send,
  X,
  Sparkles,
} from "lucide-react";

export default function GroupDetailsPage({
  params: paramsPromise,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const params = use(paramsPromise);
  const groupId = params.groupId;

  const { user } = useAuth();
  const router = useRouter();

  // Group Details & Status
  const [group, setGroup] = useState<any | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  // Tab State: "students" | "announcements"
  const [activeTab, setActiveTab] = useState<"students" | "announcements">("students");

  // Students List & Actions State
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStudentMenuId, setActiveStudentMenuId] = useState<string | null>(null);
  const [studentActionLoadingId, setStudentActionLoadingId] = useState<string | null>(null);

  // Requirement 3: Removal Confirmation Dialog Modal State
  const [studentToRemove, setStudentToRemove] = useState<any | null>(null);

  // Announcements State
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);

  // Feedback State
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch Group Document
  useEffect(() => {
    if (!groupId) return;
    setLoadingGroup(true);

    const groupRef = doc(db, "groups", groupId);
    const unsubscribe = onSnapshot(
      groupRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setGroup({ id: docSnap.id, ...docSnap.data() });
        } else {
          setGroup(null);
        }
        setLoadingGroup(false);
      },
      (err) => {
        console.error("Error loading group details:", err);
        setLoadingGroup(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  // 2. Real-time Listener & Two-Step NoSQL JOIN Query Requirement 2
  useEffect(() => {
    if (!groupId) return;
    setLoadingStudents(true);

    const enrollmentsQuery = query(
      collection(db, "enrollments"),
      where("groupId", "==", groupId)
    );

    const unsubscribe = onSnapshot(
      enrollmentsQuery,
      async (enrollSnap) => {
        try {
          // Query 1: Fetch documents from 'enrollments' collection
          let docsToProcess = enrollSnap.docs;

          if (enrollSnap.empty) {
            // Fallback for string-trimmed groupId
            const altSnap = await getDocs(
              query(collection(db, "enrollments"), where("groupId", "==", String(groupId).trim()))
            );
            if (!altSnap.empty) {
              docsToProcess = altSnap.docs;
            }
          }

          const enrollmentDocs = docsToProcess.map((d) => ({
            enrollmentId: d.id,
            ...d.data(),
          })) as any[];

          // Extract all student IDs from enrollments
          const studentIds = Array.from(
            new Set(enrollmentDocs.map((e) => e.studentId).filter(Boolean))
          );

          // Query 2: Fetch user profiles from 'users' collection for extracted studentIds
          const userProfilesMap = new Map<string, any>();

          if (studentIds.length > 0) {
            await Promise.all(
              studentIds.map(async (sId) => {
                try {
                  const uSnap = await getDoc(doc(db, "users", sId));
                  if (uSnap.exists()) {
                    userProfilesMap.set(sId, { id: uSnap.id, ...uSnap.data() });
                  }
                } catch (err) {
                  console.warn(`Error fetching profile for student ${sId}:`, err);
                }
              })
            );
          }

          // Merge Data Requirement 2 & 3
          const mergedList: any[] = enrollmentDocs.map((enr) => {
            const profile = userProfilesMap.get(enr.studentId) || {};
            return {
              id: enr.studentId || enr.enrollmentId,
              studentId: enr.studentId,
              enrollmentId: enr.enrollmentId,
              enrollmentStatus: enr.status || "active",
              joinedAt: enr.joinedAt || enr.createdAt || profile.createdAt || Date.now(),
              revokedAt: enr.revokedAt || null,
              fullName: profile.fullName || profile.displayName || "تلميذ",
              displayName: profile.displayName || profile.fullName || "تلميذ",
              email: profile.email || "غير متوفر",
              avatarUrl: profile.avatarUrl || profile.photoURL || "",
              status: enr.status === "suspended" ? "disabled" : profile.status || "active",
              role: profile.role || "student",
              keyUsed: enr.keyUsed || "",
            };
          });

          // Fallback check: include students directly linked via users collection if not in enrollments
          try {
            const directUsersSnap = await getDocs(
              query(
                collection(db, "users"),
                where("role", "==", "student"),
                where("groupId", "==", groupId)
              )
            );
            directUsersSnap.docs.forEach((uDoc) => {
              const uData = uDoc.data();
              if (!mergedList.some((existing) => existing.id === uDoc.id)) {
                mergedList.push({
                  id: uDoc.id,
                  studentId: uDoc.id,
                  enrollmentId: null,
                  enrollmentStatus: uData.status === "disabled" ? "suspended" : "active",
                  joinedAt: uData.createdAt || Date.now(),
                  fullName: uData.fullName || uData.displayName || "تلميذ",
                  displayName: uData.displayName || uData.fullName || "تلميذ",
                  email: uData.email || "غير متوفر",
                  status: uData.status || "active",
                  role: "student",
                });
              }
            });
          } catch (e) {
            console.warn("Fallback direct users check skipped:", e);
          }

          // Sort by joinedAt desc
          mergedList.sort((a, b) => {
            const timeA = typeof a.joinedAt === "number" ? a.joinedAt : (a.joinedAt?.seconds || 0) * 1000;
            const timeB = typeof b.joinedAt === "number" ? b.joinedAt : (b.joinedAt?.seconds || 0) * 1000;
            return timeB - timeA;
          });

          setStudents(mergedList);
          setLoadingStudents(false);
        } catch (err) {
          console.error("Error executing two-step NoSQL JOIN:", err);
          setLoadingStudents(false);
        }
      },
      (err) => {
        console.error("Error listening to group enrollments:", err);
        setLoadingStudents(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  // Handle Suspend / Reactivate Student Enrollment Requirement 4
  const handleToggleSuspendStudent = async (student: any) => {
    setStudentActionLoadingId(student.id);
    setActiveStudentMenuId(null);
    setFeedback(null);

    const isCurrentlyDisabled = student.status === "disabled" || student.enrollmentStatus === "suspended";
    const nextStatus = isCurrentlyDisabled ? "active" : "disabled";
    const nextEnrollmentStatus = isCurrentlyDisabled ? "active" : "suspended";

    try {
      // 1. Update Enrollment document if present Requirement 4
      if (student.enrollmentId) {
        await updateDoc(doc(db, "enrollments", student.enrollmentId), {
          status: nextEnrollmentStatus,
        });
      }

      // 2. Update User document status
      if (student.id) {
        await updateDoc(doc(db, "users", student.id), {
          status: nextStatus,
        });
      }

      // Send notification to student
      if (student.id) {
        await addDoc(collection(db, "notifications"), {
          userId: student.id,
          title: isCurrentlyDisabled ? "تم تفعيل حسابك" : "تم تعليق حسابك",
          message: isCurrentlyDisabled
            ? "قام الأستاذ بتمرير تفعيل حسابك مجدداً في هذا الفوج."
            : "قام الأستاذ بتعليق حسابك مؤقتاً في هذا الفوج.",
          type: isCurrentlyDisabled ? "success" : "error",
          href: "/dashboard",
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

      setFeedback({
        type: "success",
        text: isCurrentlyDisabled
          ? `تم إعادة تفعيل حساب الطالب "${student.fullName || student.displayName}" بنجاح.`
          : `تم تعليق حساب الطالب "${student.fullName || student.displayName}".`,
      });
    } catch (err: any) {
      console.error("Error toggling student status:", err);
      setFeedback({ type: "error", text: "تعذر تغيير حالة حساب الطالب." });
    } finally {
      setStudentActionLoadingId(null);
    }
  };

  // Handle Confirmed Removal of Student From Group (Soft Revocation Rule 2)
  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove) return;

    setStudentActionLoadingId(studentToRemove.id);
    setFeedback(null);

    try {
      // 1. Soft Revoke Enrollment Document (Rule 2: updateDoc status: 'revoked', revokedAt)
      const nowTs = Date.now();

      if (studentToRemove.enrollmentId) {
        await updateDoc(doc(db, "enrollments", studentToRemove.enrollmentId), {
          status: "revoked",
          revokedAt: nowTs,
        });
      }

      // 2. Update User document status
      if (studentToRemove.id) {
        await updateDoc(doc(db, "users", studentToRemove.id), {
          status: "disabled",
        });
      }

      // 3. Send notification to student
      if (studentToRemove.id) {
        await addDoc(collection(db, "notifications"), {
          userId: studentToRemove.id,
          title: "تم إلغاء تفعيل الفوج (إلغاء قيد)",
          message: `تم إلغاء قيدك في الفوج "${group?.name || ""}". يمكنك فقط متابعة الدروس المنشورة سابقاً قبل هذا التاريخ.`,
          type: "info",
          href: "/dashboard",
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

      // 4. Trigger Global Toast Notification Rule 2
      toast({
        title: "تم إلغاء تفعيل القيد",
        description: `تم إلغاء تفعيل قيد الطالب "${studentToRemove.fullName || studentToRemove.displayName}" مع حفظ الوصول للدروس القديمة.`,
        variant: "default",
      });

      setFeedback({
        type: "success",
        text: `تم إلغاء تفعيل قيد الطالب "${studentToRemove.fullName || studentToRemove.displayName}" مع حفظ صلاحية مشاهدة الأرشيف بنجاح.`,
      });

      setStudentToRemove(null);
    } catch (err: any) {
      console.error("Error revoking student enrollment:", err);
      toast({
        title: "خطأ في إلغاء القيد",
        description: "حدث خطأ أثناء تنفيذ عملية إلغاء القيد.",
        variant: "destructive",
      });
      setFeedback({ type: "error", text: "حدث خطأ أثناء إلغاء قيد الطالب من الفوج." });
    } finally {
      setStudentActionLoadingId(null);
    }
  };

  // Handle Publish Announcement
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) return;

    setIsPostingAnnouncement(true);
    setFeedback(null);

    try {
      await addDoc(collection(db, "groups", groupId, "announcements"), {
        title: announcementTitle.trim(),
        content: announcementContent.trim(),
        authorUid: user?.uid,
        createdAt: serverTimestamp(),
      });

      // Dispatch real-time notification to all students in the group
      for (const st of students) {
        if (st.id) {
          await addDoc(collection(db, "notifications"), {
            userId: st.id,
            title: `إعلان جديد في فوج ${group?.name || ""}`,
            message: announcementTitle.trim(),
            type: "announcement",
            href: "/dashboard",
            isRead: false,
            createdAt: serverTimestamp(),
          });
        }
      }

      setFeedback({
        type: "success",
        text: "تم نشر الإعلان وتنبيه جميع تلاميذ الفوج بنجاح!",
      });

      setIsAnnouncementModalOpen(false);
      setAnnouncementTitle("");
      setAnnouncementContent("");
    } catch (err: any) {
      console.error("Error posting announcement:", err);
      setFeedback({ type: "error", text: "حدث خطأ أثناء نشر الإعلان." });
    } finally {
      setIsPostingAnnouncement(false);
    }
  };

  // Filtered Students Search List
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = String(s.fullName || s.displayName || "").toLowerCase();
    const mail = String(s.email || "").toLowerCase();
    return name.includes(q) || mail.includes(q);
  });

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header Banner & Navigation Requirement 3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => router.push("/teacher/groups")}
            className="p-2.5 rounded-2xl bg-surface-variant/40 hover:bg-surface-variant text-on-surface transition-colors cursor-pointer border border-outline/10"
            title="العودة لإدارة الأفواج"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-on-surface">
                {loadingGroup ? "جاري التحميل..." : group?.name || "فوج دراسي"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-black border border-primary/20">
                {students.length} طالب
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1 font-medium">
              {group?.description || "غرفة التحكم وإدارة تلاميذ الفوج والإعلانات"}
            </p>
          </div>
        </div>

        {/* Tab Switcher Buttons Requirement 3 */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-surface-variant/30 border border-outline/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "students"
                ? "bg-surface text-primary shadow-xs border border-outline/10"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>إدارة التلاميذ ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("announcements")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "announcements"
                ? "bg-surface text-primary shadow-xs border border-outline/10"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>الإعلانات ({announcements.length})</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between animate-fadeIn ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : "bg-error/10 text-error border-error/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: STUDENTS MANAGEMENT Requirement 4 */}
      {activeTab === "students" && (
        <div className="space-y-4">
          {/* Search & Actions Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم الطالب أو البريد..."
                className="w-full h-11 pr-10 pl-4 rounded-2xl bg-surface border border-outline/20 text-on-surface text-xs font-bold focus:outline-none focus:border-primary shadow-2xs"
              />
              <Search className="absolute right-3.5 top-3 w-4 h-4 text-on-surface-variant/70 pointer-events-none" />
            </div>
          </div>

          {/* Students Table */}
          {loadingStudents ? (
            <div className="p-12 text-center bg-surface border border-outline/15 rounded-3xl space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-xs font-bold text-on-surface-variant">جاري تحميل قائمة تلاميذ الفوج...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-surface border border-outline/15 rounded-3xl space-y-2">
              <Users className="w-8 h-8 text-outline/50 mx-auto" />
              <h3 className="text-sm font-bold text-on-surface">لا يوجد تلاميذ مسجلين في هذا الفوج حالياً</h3>
              <p className="text-xs text-on-surface-variant">عند انضمام الطلاب باستخدام مفتاح الفوج، سيظهرون هنا تلقائياً</p>
            </div>
          ) : (
            <div className="bg-surface border border-outline/15 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-surface-variant/40 text-on-surface-variant font-extrabold border-b border-outline/10">
                    <tr>
                      <th className="p-4 sm:px-6">الطالب</th>
                      <th className="p-4 sm:px-6">البريد الإلكتروني</th>
                      <th className="p-4 sm:px-6 hidden sm:table-cell">تاريخ الانضمام</th>
                      <th className="p-4 sm:px-6">الحالة</th>
                      <th className="p-4 sm:px-6 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/10 font-medium">
                    {filteredStudents.map((st) => {
                      const isMenuOpen = activeStudentMenuId === st.id;
                      const isLoading = studentActionLoadingId === st.id;
                      const isSuspended = st.status === "disabled" || st.status === "suspended";

                      const dateFormatted = st.createdAt
                        ? new Date(
                            typeof st.createdAt === "number" ? st.createdAt : st.createdAt.seconds * 1000
                          ).toLocaleDateString("ar-EG")
                        : "غير محدد";

                      return (
                        <tr key={st.id} className="hover:bg-surface-variant/20 transition-colors">
                          {/* Student Name & Avatar */}
                          <td className="p-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-secondary/15 text-secondary font-black text-sm flex items-center justify-center shrink-0">
                                {(st.fullName || st.displayName || "ط").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-extrabold text-on-surface">
                                  {st.fullName || st.displayName || "تلميذ"}
                                </div>
                                <div className="text-[10px] text-on-surface-variant sm:hidden font-mono" dir="ltr">
                                  {st.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="p-4 sm:px-6 font-mono text-[11px] text-on-surface-variant" dir="ltr">
                            {st.email}
                          </td>

                          {/* Date */}
                          <td className="p-4 sm:px-6 hidden sm:table-cell text-on-surface-variant font-medium">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-outline/70" />
                              <span>{dateFormatted}</span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="p-4 sm:px-6">
                            {isSuspended ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error/15 text-error font-extrabold text-[11px] border border-error/30">
                                <UserX className="w-3.5 h-3.5" />
                                <span>معلق</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px] border border-emerald-500/30">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>نشط</span>
                              </span>
                            )}
                          </td>

                          {/* Actions Menu with DropdownMenuPortal Requirement 2 & 3 */}
                          <td className="p-4 sm:px-6 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/80 transition-colors cursor-pointer"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  ) : (
                                    <MoreVertical className="w-4 h-4" />
                                  )}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuContent align="end" className="z-[9999]" side="bottom">
                                  <DropdownMenuItem onClick={() => handleToggleSuspendStudent(st)}>
                                    {isSuspended ? (
                                      <>
                                        <UserCheck className="w-4 h-4 text-emerald-600" />
                                        <span>إلغاء تعليق الحساب</span>
                                      </>
                                    ) : (
                                      <>
                                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                                        <span>تعليق الحساب</span>
                                      </>
                                    )}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem onClick={() => setStudentToRemove(st)} className="text-error hover:bg-error/10 border-t border-outline/10">
                                    <Trash2 className="w-4 h-4 text-error" />
                                    <span>إزالة من الفوج</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenuPortal>
                            </DropdownMenu>
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
      )}

      {/* TAB 2: ANNOUNCEMENTS */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              <span>إعلانات وتوجيهات الفوج</span>
            </h3>

            <button
              type="button"
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="px-4 py-2 rounded-2xl bg-primary text-on-primary font-extrabold text-xs hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إعلان جديد</span>
            </button>
          </div>

          {loadingAnnouncements ? (
            <div className="p-12 text-center bg-surface border border-outline/15 rounded-3xl space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-xs font-bold text-on-surface-variant">جاري تحميل إعلانات الفوج...</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-12 text-center bg-surface border border-outline/15 rounded-3xl space-y-2">
              <Sparkles className="w-8 h-8 text-outline/50 mx-auto" />
              <h3 className="text-sm font-bold text-on-surface">لا توجد إعلانات منشورة لهذا الفوج حالياً</h3>
              <p className="text-xs text-on-surface-variant">انقر فوق "إعلان جديد" لنشر توجيه فوري لجميع تلاميذ الفوج</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => {
                const dateStr = ann.createdAt?.seconds
                  ? new Date(ann.createdAt.seconds * 1000).toLocaleString("ar-EG")
                  : "الآن";

                return (
                  <div key={ann.id} className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-black text-on-surface">{ann.title}</h4>
                      <span className="text-[10px] text-on-surface-variant font-medium">{dateStr}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap font-medium">
                      {ann.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* New Announcement Dialog Modal */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => !isPostingAnnouncement && setIsAnnouncementModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-surface border border-outline/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">نشر إعلان للفوج</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">سيتم إرسال تنبيه فوري لجميع الطلاب</p>
                </div>
              </div>

              {!isPostingAnnouncement && (
                <button
                  type="button"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handlePublishAnnouncement} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">عنوان الإعلان</label>
                <input
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="عنوان مختصر..."
                  required
                  className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">نص الإعلان والتوجيهات</label>
                <textarea
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  placeholder="اكتب التوجيهات بالتفصيل لتلاميذ الفوج..."
                  rows={4}
                  required
                  className="w-full p-3 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
                <button
                  type="button"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  disabled={isPostingAnnouncement}
                  className="px-4 py-2.5 rounded-xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isPostingAnnouncement}
                  className="px-5 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isPostingAnnouncement ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري النشر...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>نشر الإعلان الآن</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {studentToRemove && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => !studentActionLoadingId && setStudentToRemove(null)} />

          <div className="relative z-10 w-full max-w-md bg-surface border border-outline/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-error/15 text-error">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">تأكيد إزالة الطالب من الفوج</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">إلغاء تسجيل الطالب في هذا الفوج التعليمي</p>
                </div>
              </div>

              {!studentActionLoadingId && (
                <button
                  type="button"
                  onClick={() => setStudentToRemove(null)}
                  className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Description */}
            <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/15 text-xs text-on-surface leading-relaxed space-y-2">
              <p className="font-bold">
                هل أنت متأكد من إزالة الطالب <span className="text-primary font-black">"{studentToRemove.fullName || studentToRemove.displayName}"</span> من هذا الفوج؟
              </p>
              <p className="text-on-surface-variant font-medium">
                سيتم إلغاء تسجيله ولن يتمكن من الوصول إلى محتوى وحصص هذا الفوج. (لن يتم حذف حساب التلميذ العام من المنصة).
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
              <button
                type="button"
                onClick={() => setStudentToRemove(null)}
                disabled={Boolean(studentActionLoadingId)}
                className="px-4 py-2.5 rounded-xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmRemoveStudent}
                disabled={Boolean(studentActionLoadingId)}
                className="px-5 py-2.5 rounded-xl bg-error text-on-error hover:bg-error/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {studentActionLoadingId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الإزالة...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>إزالة من الفوج</span>
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

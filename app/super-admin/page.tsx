"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { User, UserRole, AccountStatus } from "@/src/types/user";
import {
  ShieldAlert,
  Users,
  GraduationCap,
  BookOpen,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  LayoutDashboard,
  ShieldCheck,
  Copy,
  Check,
  LogOut,
} from "lucide-react";

export interface TeacherKeyDoc {
  id?: string;
  key: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  quota: number;
  note?: string;
  status: "active" | "used" | "disabled";
  createdAt?: any;
}

export default function SuperAdminDashboardPage() {
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // Tab State
  const [activeTab, setActiveTab] = useState<"overview" | "teachers" | "keys">("overview");

  // Data States
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teacherKeys, setTeacherKeys] = useState<TeacherKeyDoc[]>([]);
  const [totalCoursesCount, setTotalCoursesCount] = useState(0);
  const [totalActivitiesCount, setTotalActivitiesCount] = useState(0);

  // Loading & Action States
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [actionLoadingUid, setActionLoadingUid] = useState<string | null>(null);

  // Key Generator Form States
  const [selectedTeacherUid, setSelectedTeacherUid] = useState("");
  const [selectedQuota, setSelectedQuota] = useState(50);
  const [keyNote, setKeyNote] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [keyGenSuccessMsg, setKeyGenSuccessMsg] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Search/Filter State
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");

  // 1. Security Access Control Verification
  const isSuperAdmin =
    userData?.role === "super_admin" || userData?.isAdmin === true;

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, isSuperAdmin, router]);

  // 2. Fetch Super Admin Platform Metrics & Documents
  const fetchSuperAdminData = async () => {
    setIsDataLoading(true);
    try {
      // Fetch Users
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: User[] = usersSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          email: data.email || "",
          displayName: data.displayName || data.fullName || "بدون اسم",
          role: (data.role as UserRole) || "student",
          status: (data.status as AccountStatus) || "active",
          teacherId: data.teacherId,
          createdAt: data.createdAt || Date.now(),
        };
      });

      setTeachers(allUsers.filter((u) => u.role === "teacher"));
      setStudents(allUsers.filter((u) => u.role === "student"));

      // Fetch Teacher Keys
      try {
        const keysSnap = await getDocs(collection(db, "teacher_keys"));
        const keysList: TeacherKeyDoc[] = keysSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as TeacherKeyDoc[];
        setTeacherKeys(keysList);
      } catch (keyErr) {
        console.warn("teacher_keys collection init:", keyErr);
      }

      // Fetch Courses & Activities Count
      try {
        const coursesSnap = await getDocs(collection(db, "courses"));
        setTotalCoursesCount(coursesSnap.docs.length);

        const activitiesSnap = await getDocs(collection(db, "activities"));
        setTotalActivitiesCount(activitiesSnap.docs.length);
      } catch (contentErr) {
        console.warn("Content metrics fetch warning:", contentErr);
      }
    } catch (err) {
      console.error("Error fetching Super Admin data:", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSuperAdminData();
    }
  }, [isSuperAdmin]);

  // 3. Action: Update Teacher Account Status (Activate / Suspend)
  const handleUpdateTeacherStatus = async (
    teacherUid: string,
    newStatus: AccountStatus
  ) => {
    setActionLoadingUid(teacherUid);
    try {
      const teacherRef = doc(db, "users", teacherUid);
      await updateDoc(teacherRef, {
        status: newStatus,
        updatedAt: Date.now(),
      });

      setTeachers((prev) =>
        prev.map((t) => (t.uid === teacherUid ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error("Error updating teacher status:", err);
    } finally {
      setActionLoadingUid(null);
    }
  };

  // 4. Action: Generate New Teacher Key with Student Quota (BKN-TCH-XXXXXX)
  const handleGenerateTeacherKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyGenSuccessMsg(null);

    setIsGeneratingKey(true);

    try {
      const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
      const generatedKey = `BKN-TCH-${randomChars}`;

      const teacherObj = teachers.find((t) => t.uid === selectedTeacherUid);

      const keyPayload: Omit<TeacherKeyDoc, "id"> = {
        key: generatedKey,
        teacherId: teacherObj ? teacherObj.uid : "unassigned",
        teacherName: teacherObj ? teacherObj.displayName : (keyNote.trim() || "دعوة عامة لأستاذ جديد"),
        teacherEmail: teacherObj ? teacherObj.email : "غير معين بعد",
        quota: Number(selectedQuota),
        ...(keyNote.trim() ? { note: keyNote.trim() } : {}),
        status: "active",
        createdAt: Date.now(),
      };

      const docRef = await addDoc(collection(db, "teacher_keys"), keyPayload);

      setTeacherKeys((prev) => [{ id: docRef.id, ...keyPayload }, ...prev]);
      setKeyGenSuccessMsg(`تم مصنع وتوليد مفتاح الدعوة بنجاح: ${generatedKey} (رصيد التلاميذ: ${selectedQuota})`);
      setSelectedTeacherUid("");
      setKeyNote("");
    } catch (err: any) {
      console.error("Error generating teacher key:", err);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleCopyKey = (keyString: string, keyId?: string) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKeyId(keyId || keyString);
    setTimeout(() => {
      setCopiedKeyId(null);
    }, 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4 dir-rtl">
        <div className="max-w-md w-full p-8 rounded-3xl bg-surface border border-error/30 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-error/15 text-error mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-error">403 - وصول غير مصرح</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            عذراً، هذه الصفحة مخصصة حصرياً للمدير الفائق (Super Admin). ليس لديك صلاحيات الوصول.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/dashboard")}
            className="px-6 py-2.5 rounded-2xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all shadow-md cursor-pointer"
          >
            العودة للوحة القيادة
          </button>
        </div>
      </div>
    );
  }

  const filteredTeachers = teachers.filter(
    (t) =>
      t.displayName.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(teacherSearchQuery.toLowerCase())
  );

  const pendingTeachersCount = teachers.filter((t) => t.status === "pending").length;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary/20" dir="rtl">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-outline/15 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-xs">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-on-surface flex items-center gap-2">
              <span>لوحة التحكم القيادية للمدير الفائق</span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-black">
                Super Admin
              </span>
            </h1>
            <p className="text-[11px] text-on-surface-variant hidden sm:block">
              إدارة صلاحيات الأساتذة، تفعيل الحسابات، وتوليد مفاتيح المجموعات ورصيد التلاميذ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSuperAdminData}
            className="p-2.5 rounded-2xl bg-surface-variant/40 hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border border-outline/15"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isDataLoading ? "animate-spin text-primary" : ""}`} />
          </button>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="h-10 px-4 rounded-2xl bg-surface-variant/40 hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-all font-extrabold text-xs flex items-center gap-1.5 border border-outline/15 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Navigation Tabs Header */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-surface border border-outline/15 shadow-2xs overflow-x-auto scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 sm:px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === "overview"
                ? "bg-primary text-on-primary shadow-xs scale-102"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>الإحصائيات العامة (Overview)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("teachers")}
            className={`px-4 sm:px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === "teachers"
                ? "bg-primary text-on-primary shadow-xs scale-102"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>إدارة الأساتذة (Teacher Management)</span>
            {pendingTeachersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center animate-pulse">
                {pendingTeachersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`px-4 sm:px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === "keys"
                ? "bg-primary text-on-primary shadow-xs scale-102"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>مصنع المفاتيح (Key Forge)</span>
          </button>
        </div>

        {/* Tab 1: Overview Section */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Teachers Card */}
              <div className="p-6 rounded-3xl bg-surface border border-outline/15 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant">إجمالي الأساتذة النشطين</span>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-on-surface">{teachers.length}</div>
                <p className="text-[11px] text-on-surface-variant">أساتذة مسجلون بالمنصة</p>
              </div>

              {/* Unused Keys Card */}
              <div className="p-6 rounded-3xl bg-surface border border-outline/15 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant">مفاتيح دعوة غير مستخدمة</span>
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{teacherKeys.length}</div>
                <p className="text-[11px] text-on-surface-variant">مفاتيح جاهزة للنسخ والمشاركة</p>
              </div>

              {/* Total Students Card */}
              <div className="p-6 rounded-3xl bg-surface border border-outline/15 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant">إجمالي التلاميذ بالمنصة</span>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-on-surface">{students.length}</div>
                <p className="text-[11px] text-on-surface-variant">تلاميذ مفعّلون بالفصول</p>
              </div>

              {/* Total Stations & Courses */}
              <div className="p-6 rounded-3xl bg-surface border border-outline/15 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant">إجمالي المحطات والدروس</span>
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-on-surface">{totalActivitiesCount}</div>
                <p className="text-[11px] text-on-surface-variant">في {totalCoursesCount} مسارات تعليمية</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Teacher Management Section */}
        {activeTab === "teachers" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-3xl bg-surface border border-outline/15 shadow-2xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute top-3.5 right-3.5 text-on-surface-variant/60" />
                <input
                  type="text"
                  value={teacherSearchQuery}
                  onChange={(e) => setTeacherSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الأستاذ أو بريده الإلكتروني..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-surface-variant/30 border border-outline/20 text-on-surface text-xs font-medium focus:outline-none focus:border-primary transition-all dir-rtl"
                />
              </div>

              <span className="text-xs font-bold text-on-surface-variant self-center px-2">
                عدد الأساتذة: ({filteredTeachers.length})
              </span>
            </div>

            {/* Teachers Table */}
            <div className="bg-surface border border-outline/15 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-right text-xs">
                  <thead className="bg-surface-variant/40 text-on-surface-variant font-extrabold border-b border-outline/15">
                    <tr>
                      <th className="p-4">الاسم</th>
                      <th className="p-4">البريد الإلكتروني</th>
                      <th className="p-4">تاريخ الانضمام</th>
                      <th className="p-4">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/10 text-on-surface font-medium">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-on-surface-variant/70 font-semibold">
                          لا يوجد أساتذة مسجلون بهذا البحث حالياً.
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((teacher) => {
                        const isLoadingThis = actionLoadingUid === teacher.uid;
                        return (
                          <tr key={teacher.uid} className="hover:bg-surface-variant/20 transition-colors">
                            <td className="p-4 font-bold flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                {teacher.displayName.charAt(0)}
                              </div>
                              <span>{teacher.displayName}</span>
                            </td>

                            <td className="p-4 font-mono dir-ltr text-right text-on-surface-variant">
                              {teacher.email}
                            </td>

                            <td className="p-4 text-on-surface-variant text-[11px]">
                              {new Date(teacher.createdAt).toLocaleDateString("ar-EG")}
                            </td>

                            <td className="p-4">
                              {teacher.status === "active" ? (
                                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] border border-emerald-500/30">
                                  نشط (Active)
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full bg-error/15 text-error font-extrabold text-[11px] border border-error/30">
                                  موقوف (Suspended)
                                </span>
                              )}
                            </td>

                            <td className="p-4 text-center">
                              {teacher.status === "active" ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTeacherStatus(teacher.uid, "suspended")}
                                  disabled={isLoadingThis}
                                  className="px-3 py-1.5 rounded-xl bg-error/10 hover:bg-error/20 text-error border border-error/30 font-extrabold text-[11px] transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {isLoadingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                  <span>تعليق الحساب</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTeacherStatus(teacher.uid, "active")}
                                  disabled={isLoadingThis}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-extrabold text-[11px] transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {isLoadingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  <span>تفعيل الحساب</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: The Key Forge Section */}
        {activeTab === "keys" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Key Generator Form Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-outline/15 shadow-sm space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-outline/10">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">
                    مصنع المفاتيح (The Key Forge - Strict Mode)
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    توليد مفاتيح دعوات الأساتذة بنمط BKN-TCH-[RandomStr] وتعيين رصيد حسابات التلاميذ
                  </p>
                </div>
              </div>

              {keyGenSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{keyGenSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleGenerateTeacherKey} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                {/* Select Teacher Dropdown */}
                <div className="sm:col-span-5 space-y-1.5">
                  <label className="text-xs font-bold text-on-surface block">
                    اختر الأستاذ المستهدف (أو مفتاح دعوة عام):
                  </label>
                  <select
                    value={selectedTeacherUid}
                    onChange={(e) => setSelectedTeacherUid(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surface-variant/30 border border-outline/20 text-on-surface text-xs font-bold focus:outline-none focus:border-primary transition-all dir-rtl"
                  >
                    <option value="">-- مفتاح دعوة عام لأستاذ جديد (BKN-TCH-XXXXXX) --</option>
                    {teachers.map((t) => (
                      <option key={t.uid} value={t.uid}>
                        أستاذ مخصص: {t.displayName} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Note Input */}
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-bold text-on-surface block">
                    ملاحظة / اسم الأستاذ (Note):
                  </label>
                  <input
                    type="text"
                    value={keyNote}
                    onChange={(e) => setKeyNote(e.target.value)}
                    placeholder="مثال: للأستاذ أحمد - فروع العاصمة"
                    className="w-full p-3 rounded-xl bg-surface-variant/30 border border-outline/20 text-on-surface text-xs font-medium focus:outline-none focus:border-primary transition-all dir-rtl"
                  />
                </div>

                {/* Quota Input */}
                <div className="sm:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-on-surface block">
                    رصيد التلاميذ (Quota):
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000}
                    value={selectedQuota}
                    onChange={(e) => setSelectedQuota(Number(e.target.value))}
                    className="w-full p-3 rounded-xl bg-surface-variant/30 border border-outline/20 text-on-surface text-xs font-extrabold focus:outline-none focus:border-primary transition-all text-center dir-ltr"
                  />
                </div>

                {/* Generate Button */}
                <div className="sm:col-span-12">
                  <button
                    type="submit"
                    disabled={isGeneratingKey}
                    className="w-full p-3.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingKey ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>توليد مفتاح دعوة جديد (BKN-TCH-XXXXXX)</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Generated Keys Table */}
            <div className="bg-surface border border-outline/15 rounded-3xl overflow-hidden shadow-sm space-y-2">
              <div className="p-4 bg-surface-variant/20 border-b border-outline/15 font-extrabold text-xs text-on-surface flex items-center justify-between">
                <span>سجل المفاتيح المصنعة والمتاحة للأساتذة ({teacherKeys.length})</span>
                <span className="text-on-surface-variant text-[11px] font-normal">BKN-TCH SHA256 Encrypted</span>
              </div>

              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-right text-xs">
                  <thead className="bg-surface-variant/40 text-on-surface-variant font-extrabold border-b border-outline/15">
                    <tr>
                      <th className="p-4">رمز المفتاح (Key String)</th>
                      <th className="p-4">الأستاذ / الملاحظة</th>
                      <th className="p-4">رصيد التلاميذ</th>
                      <th className="p-4 text-center">نسخ وتنسيق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/10 text-on-surface font-medium">
                    {teacherKeys.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-on-surface-variant/70 font-semibold">
                          لا يوجد مفاتيح مخصصة للأساتذة حالياً.
                        </td>
                      </tr>
                    ) : (
                      teacherKeys.map((k) => {
                        const isCopied = copiedKeyId === (k.id || k.key);
                        return (
                          <tr key={k.id || k.key} className="hover:bg-surface-variant/20 transition-colors">
                            <td className="p-4 font-mono font-extrabold text-primary select-all dir-ltr text-right">
                              {k.key}
                            </td>
                            <td className="p-4 font-bold">
                              {k.teacherName} {k.note ? `[${k.note}]` : ""}
                            </td>
                            <td className="p-4 font-extrabold text-on-surface">
                              {k.quota} طالب
                            </td>
                            <td className="p-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleCopyKey(k.key, k.id || k.key)}
                                className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                                  isCopied
                                    ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/40"
                                    : "bg-surface-variant/40 hover:bg-surface-variant text-on-surface border-outline/20"
                                }`}
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isCopied ? "تم النسخ!" : "نسخ المفتاح"}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  KeyRound,
  Users,
  BookOpen,
  ArrowUpLeft,
  Sparkles,
  Layers,
  AlertTriangle,
  Trash2,
  Loader2,
  X,
  FileEdit,
  Check,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export interface NameRequestDoc {
  id: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  teacherId?: string | null;
  requestedName: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: any;
}

export default function AdminDashboardPage() {
  const { user, userData } = useAuth();

  // Name Change Requests States
  const [nameRequests, setNameRequests] = useState<NameRequestDoc[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);
  const [requestFeedback, setRequestFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Factory Reset Modal States
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetResultMsg, setResetResultMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dynamic Teacher Name with Graceful Fallback
  const userName = userData?.displayName || userData?.fullName || user?.displayName || "يا أستاذ";

  // Fetch pending name requests for the logged-in teacher
  const fetchNameRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const requestsRef = collection(db, "name_requests");
      const snap = await getDocs(requestsRef);

      const allReqs = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<NameRequestDoc, "id">),
      }));

      // Filter pending requests matching this teacher's UID (or orphaned requests)
      const currentUid = user?.uid;
      const pendingForTeacher = allReqs.filter((req) => {
        if (req.status !== "pending") return false;
        if (!req.teacherId) return true; // Fallback to show requests without specified teacherId
        return req.teacherId === currentUid;
      });

      setNameRequests(pendingForTeacher);
    } catch (err) {
      console.error("Error fetching name requests:", err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNameRequests();
    }
  }, [user]);

  // Handle Approve Name Request
  const handleApproveRequest = async (req: NameRequestDoc) => {
    setActionProcessingId(req.id);
    setRequestFeedback(null);

    try {
      // 1. Update Student's user document in Firestore
      if (req.studentId) {
        const studentRef = doc(db, "users", req.studentId);
        await updateDoc(studentRef, {
          fullName: req.requestedName,
          displayName: req.requestedName,
        });
      }

      // 2. Mark request as approved in name_requests
      const reqRef = doc(db, "name_requests", req.id);
      await updateDoc(reqRef, {
        status: "approved",
      });

      // Remove from UI state list
      setNameRequests((prev) => prev.filter((item) => item.id !== req.id));
      setRequestFeedback({
        type: "success",
        text: `تمت الموافقة وتحديث اسم الطالب إلى "${req.requestedName}" بنجاح!`,
      });
    } catch (err: any) {
      console.error("Error approving name request:", err);
      setRequestFeedback({
        type: "error",
        text: "حدث خطأ أثناء التحديث والموافقة على الطلب.",
      });
    } finally {
      setActionProcessingId(null);
    }
  };

  // Handle Reject Name Request
  const handleRejectRequest = async (req: NameRequestDoc) => {
    setActionProcessingId(req.id);
    setRequestFeedback(null);

    try {
      // Mark request as rejected in name_requests
      const reqRef = doc(db, "name_requests", req.id);
      await updateDoc(reqRef, {
        status: "rejected",
      });

      setNameRequests((prev) => prev.filter((item) => item.id !== req.id));
      setRequestFeedback({
        type: "success",
        text: "تم رفض طلب تغيير الاسم.",
      });
    } catch (err: any) {
      console.error("Error rejecting name request:", err);
      setRequestFeedback({
        type: "error",
        text: "حدث خطأ أثناء رفض الطلب.",
      });
    } finally {
      setActionProcessingId(null);
    }
  };

  const metricsGrid = [
    {
      title: "إدارة المفاتيح",
      count: "مفاتيح التفعيل",
      description: "إنشاء وتتبع مفاتيح التفعيل المخصصة للتلاميذ والأفواج",
      icon: KeyRound,
      href: "/teacher/keys",
      color: "bg-primary-container text-on-primary-container",
      borderColor: "border-primary/20 hover:border-primary/50",
    },
    {
      title: "إدارة الأفواج",
      count: "الأفواج التعليمية",
      description: "تنظيم التلاميذ حسب الأفواج والشعب والمجموعات الدراسية",
      icon: Users,
      href: "/teacher/groups",
      color: "bg-secondary-container text-on-secondary-container",
      borderColor: "border-secondary/20 hover:border-secondary/50",
    },
    {
      title: "إدارة المحتوى",
      count: "الدروس والمسارات",
      description: "رفع وتنظيم الدروس والتمارين والملحقات التعليمية",
      icon: BookOpen,
      href: "/teacher/courses",
      color: "bg-tertiary-container text-on-tertiary-container",
      borderColor: "border-tertiary/20 hover:border-tertiary/50",
    },
  ];

  const handleExecuteFactoryReset = async () => {
    if (confirmInput.trim() !== "RESET") return;

    setIsResetting(true);
    setResetResultMsg(null);

    try {
      const res = await fetch("/api/admin/factory-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmKeyword: "RESET",
          adminEmail: userData?.email,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetResultMsg({
          type: "success",
          text: data.message || "تمت فرمتة وتطهير قاعدة البيانات بنجاح!",
        });

        setTimeout(() => {
          setIsResetModalOpen(false);
          setConfirmInput("");
          window.location.reload();
        }, 2000);
      } else {
        setResetResultMsg({
          type: "error",
          text: data.error || "فشلت عملية الفرمتة. يرجى التحقق من الصلاحيات.",
        });
      }
    } catch (err: any) {
      setResetResultMsg({
        type: "error",
        text: err.message || "حدث خطأ غير متوقع أثناء الفرمتة.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Hero Section: Massive Welcoming MD3 Card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-container via-surface-variant/40 to-surface p-8 sm:p-12 border border-outline/15 shadow-md">
        <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>مركز التحكم القيادي</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-on-surface tracking-tight leading-tight">
            مرحباً بك، {userName}!
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
            مرحباً بك في مركز الإدارة الموحد. من هنا يمكنك إدارة المفاتيح، تنظيم الأفواج، وتحديث المحتوى التعليمي.
          </p>
        </div>
      </section>

      {/* Metrics Grid: 3 MD3 Styled Elevated Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metricsGrid.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              href={card.href}
              className={`group relative overflow-hidden rounded-3xl bg-surface border ${card.borderColor} p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-4 rounded-2xl ${card.color} shadow-sm`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-surface-variant/40 flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition-all">
                    <ArrowUpLeft className="w-5 h-5" />
                  </div>
                </div>

                <h2 className="text-xl font-bold text-on-surface group-hover:text-primary transition-colors">
                  {card.title}
                </h2>
                <p className="text-xs font-semibold text-primary mt-1">
                  {card.count}
                </p>
                <p className="text-xs text-on-surface-variant/80 mt-3 leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-outline/10 flex items-center justify-between text-xs font-medium text-on-surface-variant group-hover:text-primary">
                <span>الانتقال للإدارة</span>
                <ArrowUpLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              </div>
            </Link>
          );
        })}
      </section>

      {/* Quick Status Panel */}
      <section className="p-6 rounded-3xl bg-surface border border-outline/15 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <span>ملخص النظام السريع</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between">
            <span className="text-on-surface-variant">حالة الاتصال</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">متصل (Firebase Firestore)</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between">
            <span className="text-on-surface-variant">تشفير المفاتيح</span>
            <span className="font-semibold text-primary">BAC27-SHA256</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between">
            <span className="text-on-surface-variant">إدارة الأفواج</span>
            <span className="font-semibold text-on-surface">نشط</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between">
            <span className="text-on-surface-variant">نظام التشفير</span>
            <span className="font-semibold text-primary">MD3 Auth v2</span>
          </div>
        </div>
      </section>

      {/* Danger Zone Section (Factory Reset Protocol) */}
      <section className="p-6 sm:p-8 rounded-3xl bg-error/5 border border-error/25 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-error/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-error/15 text-error flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-error flex items-center gap-2">
                <span>منطقة الخطر والإعدادات الحساسة (Danger Zone)</span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                خيارات تصفير وتطهير البيئة قبل إطلاق التطبيق للإنتاج الحي
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-error/20">
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-on-surface">
              فرمتة قاعدة البيانات بالكامل (Factory Reset)
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              تطهير كافة البيانات الوهمية والتجريبية (الدروس، الأنشطة، التسليمات، المفاتيح، حسابات التلاميذ). <strong className="text-error">ملاحظة: لن يتم حذف حسابات الأستاذ الأدمن.</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsResetModalOpen(true);
              setConfirmInput("");
              setResetResultMsg(null);
            }}
            className="px-5 py-2.5 rounded-2xl bg-error text-on-error hover:bg-error/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer hover:scale-102 active:scale-98"
          >
            <Trash2 className="w-4 h-4" />
            <span>فرمتة قاعدة البيانات (Factory Reset)</span>
          </button>
        </div>
      </section>

      {/* Factory Reset Modal Confirmation Overlay */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn dir-rtl">
          <div className="fixed inset-0" onClick={() => !isResetting && setIsResetModalOpen(false)} />

          <div className="relative z-10 w-full max-w-lg bg-surface border border-error/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-start justify-between gap-3 border-b border-outline/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-error/15 text-error flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-error">
                    تأكيد الفرمتة الشاملة للنظام!
                  </h3>
                  <p className="text-xs text-on-surface-variant font-bold">
                    إجراء حساس لا يمكن التراجع عنه مطلقاً
                  </p>
                </div>
              </div>

              {!isResetting && (
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs text-on-surface leading-relaxed">
              <div className="p-4 rounded-2xl bg-error/10 border border-error/20 text-error font-extrabold space-y-1">
                <p>⚠️ تحذير صارم:</p>
                <p className="font-normal text-on-surface">
                  سيتم مسح كل بيانات التلاميذ، الدروس، الأنشطة، المفاتيح، والأفواج نهائياً من Firestore لتحضير البيئة للإنتاج. (سيتم الحفاظ حصرياً على حسابات الأدمن).
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-on-surface">
                  يرجى كتابة كلمة <span className="text-error font-mono font-black text-sm select-all">RESET</span> باللغات الكبيرة للتأكيد:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="اكتب RESET هنا للتأكيد..."
                  disabled={isResetting}
                  className="w-full p-3 rounded-xl bg-surface-variant/30 border border-outline/20 text-on-surface font-mono text-center text-sm font-black tracking-widest focus:outline-none focus:border-error"
                />
              </div>

              {resetResultMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${resetResultMsg.type === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-error/10 text-error border border-error/20"}`}>
                  {resetResultMsg.text}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2.5 rounded-xl bg-surface-variant/40 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleExecuteFactoryReset}
                disabled={confirmInput.trim() !== "RESET" || isResetting}
                className="px-5 py-2.5 rounded-xl bg-error hover:bg-error/90 text-on-error font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التطهير والفرمتة...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>فرمتة وتطهير النظام الآن</span>
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

"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import {
  KeyRound,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BookOpen,
} from "lucide-react";

export default function KeyActivationPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activationKey, setActivationKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleActivateKey = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanKey = activationKey.trim().toUpperCase();
    if (!cleanKey) {
      setErrorMessage("يرجى أدخال رمز التفعيل أولاً.");
      return;
    }

    if (!user) {
      setErrorMessage("يرجى تسجيل الدخول أولاً لتفعيل المفتاح.");
      return;
    }

    setIsActivating(true);

    try {
      // 1. Query Firestore activation_keys collection for matching key
      const keysRef = collection(db, "activation_keys");
      const q = query(keysRef, where("key", "==", cleanKey));
      let snap = await getDocs(q);

      let keyDocId: string | null = null;
      let keyData: any = null;

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        keyDocId = docSnap.id;
        keyData = docSnap.data();
      } else {
        // Fallback: Query all keys and match case-insensitively / trimmed
        const allKeysSnap = await getDocs(keysRef);
        const matchedDoc = allKeysSnap.docs.find((d) => {
          const data = d.data();
          return data.key && String(data.key).trim().toUpperCase() === cleanKey;
        });

        if (matchedDoc) {
          keyDocId = matchedDoc.id;
          keyData = matchedDoc.data();
        }
      }

      // 2. Validate Key existence and status
      if (!keyDocId || !keyData) {
        setErrorMessage("رمز التفعيل غير صحيح. يرجى التثبت من الرمز وإعادة المحاولة.");
        setIsActivating(false);
        return;
      }

      if (keyData.status === "used") {
        setErrorMessage("هذا الرمز تم استخدامه من قبل حظ تلميذ آخر.");
        setIsActivating(false);
        return;
      }

      if (keyData.status === "disabled") {
        setErrorMessage("هذا الرمز معطل حالياً من قبل إدارة المنصة.");
        setIsActivating(false);
        return;
      }

      const targetGroupId = keyData.groupId;
      if (!targetGroupId) {
        setErrorMessage("حدث خطأ في بيانات الرمز. يرجى التواصل مع الدعم الفني.");
        setIsActivating(false);
        return;
      }

      // 3. Perform Batch Write to update User enrollments and mark Key as 'used'
      const batch = writeBatch(db);

      // Update user document
      const userDocRef = doc(db, "users", user.uid);
      batch.update(userDocRef, {
        [`enrollments.${targetGroupId}`]: {
          keyUsed: cleanKey,
          enrolledAt: serverTimestamp(),
        },
      });

      // Update activation key document
      const keyDocRef = doc(db, "activation_keys", keyDocId);
      batch.update(keyDocRef, {
        status: "used",
        usedBy: user.uid,
        usedAt: serverTimestamp(),
      });

      await batch.commit();

      setSuccessMessage("تم تفعيل مفتاح الوصول بنجاح! تم منحك صلاحية الوصول للدورة والأفواج التعليمية المخصصة.");
      setActivationKey("");
    } catch (error) {
      console.error("Error activating key:", error);
      setErrorMessage("حدث خطأ غير متوقع أثناء تفعيل الرمز. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsActivating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-on-surface-variant">جاري التثبت من حساب الطالب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary/20" dir="rtl">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-outline/15 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
          <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
            <span>العودة للوحة التحكم</span>
          </Link>
          <ChevronRight className="w-4 h-4 rotate-180 text-outline/50" />
          <span className="text-on-surface font-bold">تفعيل رمز الوصول</span>
        </div>

        <ThemeToggle />
      </header>

      {/* Main Activation Container */}
      <main className="max-w-xl mx-auto p-4 sm:p-8 space-y-8 animate-fadeIn pt-10">
        {/* MD3 Elevated Activation Card */}
        <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
          {/* Ambient Background Gradient Glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          {/* Header Icon & Title */}
          <div className="text-center space-y-3 relative z-10">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto shadow-xs">
              <KeyRound className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
              تفعيل رمز وصول جديد (Activation Key)
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant/90 leading-relaxed max-w-md mx-auto">
              أدخل كود التفعيل المكون من رمز الدفعة أو الفوج لفتح الحصص والدورات التعليمية المسجلة لك.
            </p>
          </div>

          {/* Messages Alert Banners */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-error-container/20 border border-error/30 text-error text-xs font-bold flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 space-y-3 animate-fadeIn">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs font-bold leading-relaxed">{successMessage}</div>
              </div>
              <div className="pt-2 flex justify-end">
                <Link
                  href="/dashboard"
                  className="px-5 h-10 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>الانتقال لمشاهدة الدورات</span>
                </Link>
              </div>
            </div>
          )}

          {/* Key Form */}
          <form onSubmit={handleActivateKey} className="space-y-5 relative z-10" noValidate>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-on-surface-variant">
                كود التفعيل (Key Code) <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                  placeholder="مثال: BAC27-GROUP-XXXXX"
                  dir="ltr"
                  disabled={isActivating}
                  required
                  className="w-full h-14 px-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-center font-mono text-base font-extrabold tracking-wider focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all uppercase placeholder:font-sans placeholder:text-xs placeholder:font-normal"
                />
              </div>
              <p className="text-[11px] text-on-surface-variant/70 text-right">
                تأكد من كتابة الحروف والرموز كما هي مدونة في بطاقة التفعيل الخاصة بك.
              </p>
            </div>

            <button
              type="submit"
              disabled={isActivating || !activationKey.trim()}
              className="w-full h-13 rounded-2xl bg-primary text-on-primary font-extrabold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isActivating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري التحقق والتفعيل...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>تفعيل المفتاح الآن</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Assistance Notice */}
          <div className="pt-4 border-t border-outline/10 text-center text-xs text-on-surface-variant/80">
            تواجه مشكلة في تفعيل الرمز؟ تواصل مع أستاذك أو إدارة الدفعة للحصول على مساعدة.
          </div>
        </div>
      </main>
    </div>
  );
}

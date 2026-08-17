"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import {
  GraduationCap,
  UserPlus,
  LogIn,
  ShieldCheck,
  BookOpen,
  KeyRound,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function RootLandingPage() {
  const { userData, loading } = useAuth();
  const router = useRouter();

  // Dynamic Routing based on authentication state and user role
  useEffect(() => {
    if (!loading && userData) {
      const role = userData.role;
      if (role === "admin" || String(role).toLowerCase() === "admin") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [userData, loading, router]);

  // Loading state while checking AuthContext
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4" dir="rtl">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-sm font-semibold text-on-surface-variant">جاري التثبت من حالة الحساب...</p>
        </div>
      </div>
    );
  }

  // Guest view if user is not logged in
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 bg-background text-on-background overflow-hidden selection:bg-primary/20"
      dir="rtl"
    >
      {/* Background Decorative MD3 Ambient Gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-primary/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full bg-secondary/10 blur-[140px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between z-20 py-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary-container text-on-primary-container shadow-sm">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg text-on-surface tracking-tight leading-none">
              بوابة الأستاذ
            </h1>
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5">
              منصة البكالوريا 2027
            </p>
          </div>
        </div>

        <ThemeToggle />
      </header>

      {/* Hero Section Container */}
      <main className="w-full max-w-2xl z-10 my-auto py-8">
        <div className="bg-surface/80 backdrop-blur-xl border border-outline/15 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-8 animate-fadeIn">
          {/* Main Logo & Icon */}
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-3xl bg-primary-container text-on-primary-container flex items-center justify-center mx-auto shadow-md transform hover:scale-105 transition-transform duration-300">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <span className="absolute -top-1 -right-1 p-1.5 rounded-full bg-primary text-on-primary shadow-sm">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>

          {/* Titles & Descriptions */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black text-on-surface tracking-tight">
              منصة البكالوريا 2027
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed max-w-lg mx-auto">
              منصتك التعليمية المتكاملة للتحضير للبكالوريا ومتابعة الأفواج والدروس التفاعلية مع أستاذ المادة.
            </p>
          </div>

          {/* MD3 Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
            <div className="p-3.5 rounded-2xl bg-surface-variant/40 border border-outline/10 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <KeyRound className="w-4 h-4" />
                <span>مفاتيح التفعيل</span>
              </div>
              <p className="text-[11px] text-on-surface-variant/80">تفعيل الحساب برمز المفتاح المخصص للفوج</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-variant/40 border border-outline/10 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <BookOpen className="w-4 h-4" />
                <span>محتوى دراسي منظم</span>
              </div>
              <p className="text-[11px] text-on-surface-variant/80">دروس وتمارين مخصصة للشعب والمستويات</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-variant/40 border border-outline/10 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>حماية وتوثيق</span>
              </div>
              <p className="text-[11px] text-on-surface-variant/80">إدارة آمنة لحسابات وتراخيص التلاميذ</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            {/* Primary Action Button: Register */}
            <Link
              href="/register"
              className="w-full sm:w-auto h-13 px-8 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <UserPlus className="w-5 h-5" />
              <span>إنشاء حساب جديد</span>
            </Link>

            {/* Outlined Action Button: Login */}
            <Link
              href="/login"
              className="w-full sm:w-auto h-13 px-8 rounded-2xl border-2 border-outline/30 bg-surface/60 text-on-surface font-bold text-sm hover:bg-surface-variant/60 focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <LogIn className="w-5 h-5" />
              <span>تسجيل الدخول</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Landing Footer */}
      <footer className="w-full text-center z-10 py-3 border-t border-outline/10">
        <p className="text-xs text-on-surface-variant/70 font-medium">
          جميع الحقوق محفوظة © منصة البكالوريا 2027
        </p>
      </footer>
    </div>
  );
}

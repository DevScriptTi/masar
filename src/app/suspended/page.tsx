"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ShieldAlert, LogOut, PhoneCall, Mail, AlertTriangle, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/src/components/ThemeToggle";

export default function SuspendedPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (typeof document !== "undefined") {
        document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-between font-sans selection:bg-error/20" dir="rtl">
      {/* Top Header */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-outline/10 bg-surface/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-error/15 text-error">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-on-surface">منصة البكالوريا 2027</h1>
            <p className="text-[11px] font-semibold text-error">نظام الحماية والأمان المتقدم</p>
          </div>
        </div>

        <ThemeToggle />
      </header>

      {/* Main Content Lockdown Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 animate-fadeIn">
        <div className="max-w-xl w-full bg-surface border border-error/30 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 text-center relative overflow-hidden">
          {/* Background Decorative Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-error/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-error/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="w-20 h-20 rounded-3xl bg-error/15 text-error flex items-center justify-center mx-auto border border-error/30 shadow-md">
            <AlertTriangle className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <span className="px-3.5 py-1 rounded-full bg-error/15 text-error text-xs font-black border border-error/30 inline-block">
              حساب معلق مؤقتاً (Suspended)
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
              تم تعليق الوصول لبيانات الحساب
            </h2>
          </div>

          {/* Requirement 5: Lockdown Message */}
          <div className="p-4 sm:p-6 rounded-2xl bg-error/5 border border-error/20 text-xs sm:text-sm text-on-surface font-medium leading-relaxed text-right space-y-2 dir-rtl">
            <p className="font-extrabold text-error flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>تنبيه أمني عاجل:</span>
            </p>
            <p className="text-on-surface-variant leading-relaxed">
              تم تعليق حسابك مؤقتاً لدواعي أمنية بسبب رصد نشاط غير معتاد أو محاولات تسجيل دخول من أجهزة متعددة. لحماية بياناتك، يرجى التواصل مع الإدارة لتأكيد هويتك وإعادة تفعيل الحساب.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href="mailto:support@bac2027.edu.dz"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-primary text-on-primary font-extrabold text-xs shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>التواصل مع الدعم الإداري</span>
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-surface-variant/50 hover:bg-error/15 hover:text-error text-on-surface font-extrabold text-xs transition-all border border-outline/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs font-semibold text-on-surface-variant/70 border-t border-outline/10">
        جميع الحقوق محفوظة © منصة البكالوريا 2027 - حماية الهوية الرقمية
      </footer>
    </div>
  );
}

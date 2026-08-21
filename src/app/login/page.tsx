"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { LogIn, Lock, Mail, Eye, EyeOff, Loader2, GraduationCap, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  // Input states - NO MOCK DATA
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & Error states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic validation
    if (!email.trim() || !password.trim()) {
      setErrorMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      // 1. Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Fetch User Document from Firestore before calling router.push
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        if (role === "admin" || String(role).toLowerCase() === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/dashboard");
        }
      } else {
        // Fallback for user without Firestore document
        router.push("/dashboard");
      }
    } catch (error: any) {
      console.error("Login error:", error?.code || error?.message);
      // Map Firebase error codes to user-friendly Arabic messages
      let errorMessage = "حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.";

      if (
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/user-not-found" ||
        error?.code === "auth/wrong-password"
      ) {
        errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      } else if (error?.code === "auth/too-many-requests") {
        errorMessage = "تم حظر الحساب مؤقتاً بسبب محاولات كثيرة خاطئة. يرجى المحاولة لاحقاً.";
      } else if (error?.code === "auth/invalid-email") {
        errorMessage = "صيغة البريد الإلكتروني غير صحيحة.";
      } else if (error?.code === "auth/network-request-failed") {
        errorMessage = "خطأ في الاتصال بالشبكة. يرجى التثبت من اتصالك بالإنترنت.";
      }

      // Set the error state so the UI displays it gracefully
      setErrorMessage(errorMessage);
    } finally {
      setLoading(false); // Ensure loading state is reset
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background text-on-background overflow-hidden selection:bg-primary/20" dir="rtl">
      {/* Background Decorative MD3 Ambient Gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-secondary/10 blur-[120px] pointer-events-none" />

      {/* Theme Toggle Button in top corner */}
      <header className="absolute top-6 left-6 z-20">
        <ThemeToggle />
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md z-10">
        <div className="bg-surface/80 backdrop-blur-xl border border-outline/15 rounded-3xl p-8 sm:p-10 shadow-2xl transition-all duration-300">
          {/* Header & Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-container text-on-primary-container mb-4 shadow-sm">
              <GraduationCap className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              تسجيل الدخول
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              مرحباً بك في منصة البكالوريا 2027
            </p>
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-error-container/70 border border-error/30 text-on-error-container text-sm flex items-start gap-3 animate-fadeIn">
              <span className="inline-block w-2 h-2 rounded-full bg-error mt-1.5 shrink-0" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6" noValidate>
            {/* Email Input */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-on-surface-variant"
              >
                البريد الإلكتروني
              </label>
              <div className="relative flex items-center">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  dir="ltr"
                  disabled={loading}
                  required
                  className="w-full h-12 pr-11 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200 disabled:opacity-60 text-sm"
                />
                <Mail className="absolute right-3.5 w-5 h-5 text-on-surface-variant/70 pointer-events-none" />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-on-surface-variant"
              >
                كلمة المرور
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  disabled={loading}
                  required
                  className="w-full h-12 pr-11 pl-11 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200 disabled:opacity-60 text-sm"
                />
                <Lock className="absolute right-3.5 w-5 h-5 text-on-surface-variant/70 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 text-on-surface-variant/70 hover:text-on-surface transition-colors focus:outline-none"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 rounded-xl bg-primary text-on-primary font-medium hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري التحميل...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>دخول المنصة</span>
                </>
              )}
            </button>
          </form>

          {/* Registration Link */}
          <div className="mt-4 text-center">
            <p className="text-xs text-on-surface-variant">
              ليس لديك حساب؟{" "}
              <Link
                href="/register"
                className="text-primary font-bold hover:underline transition-colors"
              >
                إنشاء حساب جديد
              </Link>
            </p>
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-6 border-t border-outline/10 text-center">
            <p className="text-xs text-on-surface-variant/70 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>نظام حماية وتسجيل آمن موحد</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

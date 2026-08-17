"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import { User, Mail, Lock, KeyRound, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { RegisterFormData } from "@/src/app/register/page";

interface RegisterStep1Props {
  formData: RegisterFormData;
  updateFormData: (fields: Partial<RegisterFormData>) => void;
  onNext: () => void;
}

export function RegisterStep1({
  formData,
  updateFormData,
  onNext,
}: RegisterStep1Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.fullName.trim()) {
      setErrorMessage("يرجى إدخال الاسم الكامل.");
      return;
    }

    if (!formData.email.trim()) {
      setErrorMessage("يرجى إدخال البريد الإلكتروني.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setErrorMessage("صيغة البريد الإلكتروني غير صحيحة.");
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setErrorMessage("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.");
      return;
    }

    if (!formData.activationKey.trim()) {
      setErrorMessage("يرجى إدخال رمز مفتاح التفعيل.");
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn" noValidate dir="rtl">
      {/* Step Title */}
      <div className="text-right mb-4">
        <h2 className="text-xl font-bold text-on-surface">المعلومات الأساسية ومفتاح التفعيل</h2>
        <p className="text-xs text-on-surface-variant mt-1">
          أدخل بيانات حسابك المخصص ورمز المفتاح المقدم من الأستاذ
        </p>
      </div>

      {/* Error Alert Box */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-error-container/70 border border-error/30 text-on-error-container text-xs flex items-center gap-2.5 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-error shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Full Name Input */}
      <div className="space-y-1.5">
        <label htmlFor="fullName" className="block text-xs font-semibold text-on-surface-variant">
          الاسم الكامل <span className="text-error">*</span>
        </label>
        <div className="relative flex items-center">
          <input
            id="fullName"
            type="text"
            value={formData.fullName}
            onChange={(e) => updateFormData({ fullName: e.target.value })}
            placeholder="مثال: محمد الأمين"
            required
            className="w-full h-12 pr-11 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200 text-sm font-medium"
          />
          <User className="absolute right-3.5 w-5 h-5 text-on-surface-variant/70 pointer-events-none" />
        </div>
      </div>

      {/* Email Input */}
      <div className="space-y-1.5">
        <label htmlFor="regEmail" className="block text-xs font-semibold text-on-surface-variant">
          البريد الإلكتروني <span className="text-error">*</span>
        </label>
        <div className="relative flex items-center">
          <input
            id="regEmail"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData({ email: e.target.value })}
            placeholder="name@example.com"
            dir="ltr"
            required
            className="w-full h-12 pr-11 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200 text-sm font-medium"
          />
          <Mail className="absolute right-3.5 w-5 h-5 text-on-surface-variant/70 pointer-events-none" />
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-1.5">
        <label htmlFor="regPassword" className="block text-xs font-semibold text-on-surface-variant">
          كلمة المرور (6 أحرف على الأقل) <span className="text-error">*</span>
        </label>
        <div className="relative flex items-center">
          <input
            id="regPassword"
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={(e) => updateFormData({ password: e.target.value })}
            placeholder="••••••••"
            dir="ltr"
            required
            className="w-full h-12 pr-11 pl-11 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200 text-sm font-medium"
          />
          <Lock className="absolute right-3.5 w-5 h-5 text-on-surface-variant/70 pointer-events-none" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3.5 text-on-surface-variant/70 hover:text-on-surface transition-colors focus:outline-none"
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Activation Key Input */}
      <div className="space-y-1.5">
        <label htmlFor="activationKey" className="block text-xs font-semibold text-on-surface-variant">
          رمز مفتاح التفعيل <span className="text-error">*</span>
        </label>
        <div className="relative flex items-center">
          <input
            id="activationKey"
            type="text"
            value={formData.activationKey}
            onChange={(e) =>
              updateFormData({ activationKey: e.target.value.toUpperCase() })
            }
            placeholder="مثال: BAC27-GROUP_A-X9Y8Z"
            dir="ltr"
            required
            className="w-full h-12 pr-11 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200 text-sm font-mono font-bold tracking-wider"
          />
          <KeyRound className="absolute right-3.5 w-5 h-5 text-primary pointer-events-none" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 space-y-4">
        <button
          type="submit"
          className="w-full h-12 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-[0.99]"
        >
          <span>التالي: البيانات الدراسية</span>
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Existing User Login Link */}
        <div className="text-center pt-2 border-t border-outline/10">
          <p className="text-xs text-on-surface-variant">
            لديك حساب بالفعل؟{" "}
            <Link
              href="/login"
              className="text-primary font-bold hover:underline transition-colors"
            >
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
}

export default RegisterStep1;

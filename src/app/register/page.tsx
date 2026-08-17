"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { RegisterStep1 } from "@/src/components/auth/RegisterStep1";
import { RegisterStep2 } from "@/src/components/auth/RegisterStep2";
import { RegisterStep3 } from "@/src/components/auth/RegisterStep3";
import { registerStudent } from "@/src/lib/firebase/authService";
import { GraduationCap, Check, ShieldCheck, Loader2, AlertCircle } from "lucide-react";

export interface RegisterFormData {
  fullName: string;
  email: string;
  password: string;
  activationKey: string;
  dob: string;
  level: string;
  year: string;
  stream: string;
  avatar: string;
  avatarFile?: File | null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Shared Form State
  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: "",
    email: "",
    password: "",
    activationKey: "",
    dob: "",
    level: "",
    year: "",
    stream: "",
    avatar: "",
    avatarFile: null,
  });

  // Submission & Error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateFormData = (fields: Partial<RegisterFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  // Task B: Real Firebase Registration Handler
  const handleCompleteRegistration = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await registerStudent(formData);
      // On success: redirect directly to /dashboard (Removing dummy summary screen)
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Registration error:", error);
      const errorCode = error?.code || "";

      switch (errorCode) {
        case "auth/email-already-in-use":
          setErrorMessage("البريد الإلكتروني مستعمل بالفعل من قبل حساب آخر.");
          break;
        case "auth/invalid-email":
          setErrorMessage("صيغة البريد الإلكتروني غير صحيحة.");
          break;
        case "auth/weak-password":
          setErrorMessage("كلمة المرور ضعيفة جداً. استخدم كلمة مرور أطول.");
          break;
        case "auth/network-request-failed":
          setErrorMessage("خطأ في الاتصال بالشبكة. يرجى التثبت من اتصالك بالإنترنت.");
          break;
        default:
          setErrorMessage(
            error?.message || "حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى."
          );
          break;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Steps Metadata for Stepper Indicator
  const steps = [
    { number: 1, label: "المعلومات الأساسية" },
    { number: 2, label: "البيانات الدراسية" },
    { number: 3, label: "الصورة الرمزية" },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background text-on-background overflow-hidden selection:bg-primary/20" dir="rtl">
      {/* Background Decorative MD3 Ambient Gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-secondary/10 blur-[120px] pointer-events-none" />

      {/* Theme Toggle Button in top corner */}
      <header className="absolute top-6 left-6 z-20">
        <ThemeToggle />
      </header>

      {/* Main Registration Card */}
      <main className="w-full max-w-lg z-10 py-6">
        <div className="bg-surface/80 backdrop-blur-xl border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 relative overflow-hidden">
          {/* Submitting Loading Overlay */}
          {isSubmitting && (
            <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 p-6 animate-fadeIn">
              <div className="p-4 rounded-full bg-primary-container text-on-primary-container shadow-md">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-on-surface">جاري إنشاء وتفعيل الحساب...</h3>
                <p className="text-xs text-on-surface-variant">التحقق من المفتاح وتحديث بيانات المجموعات الدراسية</p>
              </div>
            </div>
          )}

          {/* Header & Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-container text-on-primary-container mb-3 shadow-sm">
              <GraduationCap className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
              إنشاء حساب طالب جديد
            </h1>
            <p className="text-xs text-on-surface-variant mt-1">
              انضم إلى منصة البكالوريا 2027 عبر تفعيل حسابك المخصص
            </p>
          </div>

          {/* Global Firebase Error Alert */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-error-container/70 border border-error/30 text-on-error-container text-xs flex items-center gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-error shrink-0" />
              <p className="font-semibold leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* MD3 Visual Stepper Indicator */}
          <div className="mb-8 relative">
            <div className="flex items-center justify-between relative z-10">
              {steps.map((step) => {
                const isPassed = currentStep > step.number;
                const isActive = currentStep === step.number;

                return (
                  <div key={step.number} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm ${
                        isPassed
                          ? "bg-primary text-on-primary"
                          : isActive
                          ? "bg-primary text-on-primary ring-4 ring-primary/20 scale-110"
                          : "bg-surface-variant text-on-surface-variant border border-outline/20"
                      }`}
                    >
                      {isPassed ? <Check className="w-5 h-5 stroke-[3]" /> : step.number}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-semibold mt-2 text-center transition-colors ${
                        isActive ? "text-primary font-bold" : "text-on-surface-variant/70"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Connecting Stepper Bar */}
            <div className="absolute top-5 right-[15%] left-[15%] h-[2px] bg-outline/20 z-0">
              <div
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{
                  width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%",
                }}
              />
            </div>
          </div>

          {/* Step Forms */}
          {currentStep === 1 && (
            <RegisterStep1
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNextStep}
            />
          )}

          {currentStep === 2 && (
            <RegisterStep2
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleNextStep}
              onBack={handlePrevStep}
            />
          )}

          {currentStep === 3 && (
            <RegisterStep3
              formData={formData}
              updateFormData={updateFormData}
              onBack={handlePrevStep}
              onSubmit={handleCompleteRegistration}
            />
          )}

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-outline/10 text-center">
            <p className="text-[11px] text-on-surface-variant/70 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>نظام تفعيل رسمي موحد للمجموعات الدراسية</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

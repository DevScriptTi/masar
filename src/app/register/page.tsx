"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { auth } from "@/lib/firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  GraduationCap,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  User as UserIcon,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  Send,
  Calendar,
  Phone,
  BookOpen,
  Camera,
  Layers,
  ChevronLeft,
  UserCheck,
  Sparkles,
} from "lucide-react";

// ==========================================
// 1. ZOD SCHEMA SPECIFICATION Requirement 2
// ==========================================
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

export const registerWizardSchema = z
  .object({
    // Step 0: Auth & Activation Key
    email: z.string().email("البريد الإلكتروني المدخل غير صالح"),
    password: z.string().min(6, "كلمة المرور يجب أن تتكون من 6 أحرف على الأقل"),
    confirmPassword: z.string().min(6, "تأكيد كلمة المرور مطلوب"),
    activationKey: z.string().min(3, "رمز التفعيل مطلوب للتسجيل"),

    // Step 1: Personal Identity
    firstName: z.string().min(2, "الاسم الأول مطلوب (حرفان على الأقل)"),
    lastName: z.string().min(2, "اللقب مطلوب (حرفان على الأقل)"),
    dateOfBirth: z.string().min(4, "تاريخ الميلاد مطلوب"),
    profileImage: z.string().optional(),

    // Step 2: Academic Track
    level: z.enum(["ابتدائي", "متوسط", "ثانوي", "جامعي"], {
      required_error: "يرجى تحديد المستوى الدراسي",
    }),
    secondaryYear: z.enum(["أولى", "ثانية", "ثالثة"]).optional(),
    firstYearStream: z.enum(["علمي", "أدبي"]).optional(),
    specialization: z.enum([
      "علوم تجريبية",
      "رياضيات",
      "تقني رياضي",
      "آداب وفلسفة",
      "لغات أجنبية",
      "تسيير واقتصاد",
    ]).optional(),

    // Step 3: Contact Details
    studentPhone: z.string().optional(),
    parentPhone: z.string().min(8, "رقم هاتف الولي مطلوب لتلقي إشعارات المتابعة"),
  })
  .superRefine((data, ctx) => {
    // Confirm Password check
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "كلمتا المرور غير متطابقتين",
        path: ["confirmPassword"],
      });
    }

    // Conditional Academic fields check Requirement 2
    if (data.level === "ثانوي") {
      if (!data.secondaryYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "السنة الثانوية مطلوبة عند اختيار المستوى الثانوي",
          path: ["secondaryYear"],
        });
      } else if (data.secondaryYear === "أولى") {
        if (!data.firstYearStream) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "يرجى تحديد الجذع المشترك للسنة الأولى ثانوي (علمي أو أدبي)",
            path: ["firstYearStream"],
          });
        }
      } else if (data.secondaryYear === "ثانية" || data.secondaryYear === "ثالثة") {
        if (!data.specialization) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "يرجى تحديد الشعبة الخاصة بالسنة الثانية أو الثالثة ثانوي",
            path: ["specialization"],
          });
        }
      }
    }
  });

export type RegisterWizardFormData = z.infer<typeof registerWizardSchema>;

export default function RegisterPage() {
  const router = useRouter();

  // Wizard Step State (0: Auth, 1: Identity, 2: Academic, 3: Contact & OTP)
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // Form State Values
  const [formData, setFormData] = useState<Partial<RegisterWizardFormData>>({
    email: "",
    password: "",
    confirmPassword: "",
    activationKey: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    profileImage: "",
    level: "ثانوي",
    secondaryYear: "ثالثة",
    firstYearStream: undefined,
    specialization: "علوم تجريبية",
    studentPhone: "",
    parentPhone: "",
  });

  // UI & Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [debugOtpCode, setDebugOtpCode] = useState<string | null>(null);

  const updateField = (field: keyof RegisterWizardFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle Step Validation before proceeding Requirement 3
  const validateCurrentStep = (): boolean => {
    setErrorMessage(null);

    if (currentStep === 0) {
      if (!formData.email || !formData.email.includes("@")) {
        setErrorMessage("يرجى كتابة بريد إلكتروني صالح.");
        return false;
      }
      if (!formData.password || formData.password.length < 6) {
        setErrorMessage("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMessage("كلمتا المرور غير متطابقتين.");
        return false;
      }
      if (!formData.activationKey || formData.activationKey.trim().length < 3) {
        setErrorMessage("رمز التفعيل إجباري للتسجيل كطالب (Closed Registration).");
        return false;
      }
    } else if (currentStep === 1) {
      if (!formData.firstName || formData.firstName.trim().length < 2) {
        setErrorMessage("يرجى كتابة الاسم الأول (حرفان على الأقل).");
        return false;
      }
      if (!formData.lastName || formData.lastName.trim().length < 2) {
        setErrorMessage("يرجى كتابة اللقب الرسمي.");
        return false;
      }
      if (!formData.dateOfBirth) {
        setErrorMessage("يرجى تحديد تاريخ الميلاد.");
        return false;
      }
    } else if (currentStep === 2) {
      if (!formData.level) {
        setErrorMessage("يرجى اختيار المستوى الدراسي.");
        return false;
      }
      if (formData.level === "ثانوي") {
        if (!formData.secondaryYear) {
          setErrorMessage("يرجى تحديد السنة الثانوية.");
          return false;
        }
        if (formData.secondaryYear === "أولى" && !formData.firstYearStream) {
          setErrorMessage("يرجى تحديد الجذع المشترك (علمي أو أدبي).");
          return false;
        }
        if (
          (formData.secondaryYear === "ثانية" || formData.secondaryYear === "ثالثة") &&
          !formData.specialization
        ) {
          setErrorMessage("يرجى تحديد الشعبة الدراسية.");
          return false;
        }
      }
    } else if (currentStep === 3) {
      if (!formData.parentPhone || formData.parentPhone.trim().length < 8) {
        setErrorMessage("رقم هاتف الولي مطلوب للتواصل والمتابعة.");
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Step 3 Submissions: Send OTP
  const handleSendOtp = async () => {
    if (!validateCurrentStep()) return;

    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email?.trim(), purpose: "signup" }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOtpSent(true);
        setInfoMessage(data.message || `تم إرسال كود التفعيل المكون من 6 أرقام إلى: ${formData.email}`);
        if (data.debugOtpCode) {
          setDebugOtpCode(data.debugOtpCode);
        }
      } else {
        setErrorMessage(data.error || "فشل إرسال كود التفعيل. يرجى التثبت من البريد والمحاولة مجدداً.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ في الاتصال بالخادم عند إرسال كود التفعيل.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final Step: Verify OTP and Register Account Requirement 4
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrorMessage("يرجى إدخال رمز التفعيل المكون من 6 أرقام بشكل صحيح.");
      return;
    }

    setIsSubmitting(true);

    try {
      const fullProfile = {
        firstName: formData.firstName?.trim(),
        lastName: formData.lastName?.trim(),
        fullName: `${formData.firstName?.trim()} ${formData.lastName?.trim()}`,
        dateOfBirth: formData.dateOfBirth,
        level: formData.level,
        secondaryYear: formData.level === "ثانوي" ? formData.secondaryYear : null,
        firstYearStream: formData.level === "ثانوي" && formData.secondaryYear === "أولى" ? formData.firstYearStream : null,
        specialization: formData.level === "ثانوي" && formData.secondaryYear !== "أولى" ? formData.specialization : null,
        studentPhone: formData.studentPhone?.trim() || "",
        parentPhone: formData.parentPhone?.trim() || "",
        profileImage: formData.profileImage || "",
      };

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email?.trim(),
          otp: otpCode.trim(),
          password: formData.password,
          displayName: fullProfile.fullName,
          role: "student",
          teacherId: formData.activationKey?.trim(),
          inviteKey: formData.activationKey?.trim(),
          profile: fullProfile,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        try {
          await signInWithEmailAndPassword(auth, formData.email!.trim(), formData.password!);
        } catch (signInErr) {
          console.warn("Client Sign In notice:", signInErr);
        }

        setInfoMessage("تم إنشاء وتأكيد الحساب بنجاح! جاري التوجيه إلى لوحة التحكم...");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      } else {
        setErrorMessage(data.error || "فشلت عملية التحقق وإنشاء الحساب.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ غير متوقع أثناء تفعيل وإنشاء الحساب.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step Titles Header array
  const stepTitles = [
    { title: "بيانات الحساب", desc: "البريد ورمز التفعيل" },
    { title: "الهوية الشخصية", desc: "الاسم وتاريخ الميلاد" },
    { title: "المسار الدراسي", desc: "المستوى والشعبة" },
    { title: "معلومات الاتصال", desc: "الهواتف والتأكيد" },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background text-on-background overflow-hidden selection:bg-primary/20" dir="rtl">
      {/* Ambient Background Blur Gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/10 blur-[130px] pointer-events-none" />

      {/* Top Header Controls */}
      <header className="absolute top-6 left-6 z-20">
        <ThemeToggle />
      </header>

      {/* Main Multi-Step Wizard Container */}
      <main className="w-full max-w-xl z-10 py-6">
        <div className="bg-surface/90 backdrop-blur-xl border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 relative overflow-hidden space-y-6">
          {/* Submitting Loading Overlay */}
          {isSubmitting && (
            <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 p-6 animate-fadeIn">
              <div className="p-4 rounded-full bg-primary-container text-on-primary-container shadow-md">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-on-surface">
                  {otpSent ? "جاري التحقق وإنشاء الحساب..." : "جاري المعالجة وإرسال كود التفعيل..."}
                </h3>
                <p className="text-xs text-on-surface-variant">ربط الهوية وحفظ بيانات التلميذ في المنصة</p>
              </div>
            </div>
          )}

          {/* Top Logo & Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
              تسجيل حساب تلميذ جديد
            </h1>
            <p className="text-xs text-on-surface-variant">
              معالج التسجيل التفاعلي (الخطوة {currentStep + 1} من 4)
            </p>
          </div>

          {/* Progress Stepper Bar Requirement 3 */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {stepTitles.map((st, idx) => (
                <div key={idx} className="space-y-1 text-center">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentStep
                        ? "bg-primary shadow-sm"
                        : idx < currentStep
                        ? "bg-emerald-500"
                        : "bg-surface-variant/50"
                    }`}
                  />
                  <p className={`text-[10px] font-extrabold truncate ${idx === currentStep ? "text-primary" : "text-on-surface-variant/70"}`}>
                    {st.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Error & Info Banners */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-error/10 border border-error/20 text-error text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {infoMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p className="leading-relaxed">{infoMessage}</p>
            </div>
          )}

          {debugOtpCode && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold text-center">
              🔑 (رمز التفعيل المحلي للتجربة: {debugOtpCode})
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 0: AUTH CREDENTIALS & ACTIVATION KEY  */}
          {/* ========================================== */}
          {currentStep === 0 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-outline/10 pb-2">
                <Lock className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-on-surface">الخطوة 1: بيانات الحساب والدخول</h3>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  البريد الإلكتروني <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="name@example.com"
                    dir="ltr"
                    required
                    className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-on-surface">
                    كلمة المرور <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      required
                      className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                    />
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-on-surface">
                    تأكيد كلمة المرور <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateField("confirmPassword", e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      required
                      className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                    />
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Activation Key Requirement 3 */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-extrabold text-on-surface">
                  رمز التفعيل الصارم (Activation Key) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.activationKey}
                    onChange={(e) => updateField("activationKey", e.target.value.toUpperCase())}
                    placeholder="BAC27-GROUP-XXXXX"
                    dir="ltr"
                    required
                    className="w-full h-12 pr-10 pl-4 rounded-xl bg-primary/5 border border-primary/30 text-on-surface text-center font-mono text-sm font-black focus:outline-none focus:border-primary uppercase"
                  />
                  <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
                </div>
                <p className="text-[11px] text-on-surface-variant/70">
                  التسجيل في المنصة مغلق ويتطلب كود تفعيل مسلم من أستاذك المشرف.
                </p>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 1: PERSONAL IDENTITY                   */}
          {/* ========================================== */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-outline/10 pb-2">
                <UserIcon className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-on-surface">الخطوة 2: الهوية والبيانات الشخصية</h3>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-on-surface">
                    الاسم الأول <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    placeholder="مثال: أحمد"
                    required
                    className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-on-surface">
                    اللقب الرسمي <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    placeholder="مثال: عبد الله"
                    required
                    className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  تاريخ الميلاد <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField("dateOfBirth", e.target.value)}
                    required
                    className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                </div>
              </div>

              {/* Profile Image URL optional */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  رابط الصورة الشخصية (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={formData.profileImage}
                    onChange={(e) => updateField("profileImage", e.target.value)}
                    placeholder="https://..."
                    dir="ltr"
                    className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                  />
                  <Camera className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 2: ACADEMIC TRACK (CONDITIONAL FIELDS) */}
          {/* ========================================== */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-outline/10 pb-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-on-surface">الخطوة 3: المسار الأكاديمي والشعبة</h3>
              </div>

              {/* Level Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  المستوى الدراسي <span className="text-error">*</span>
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => updateField("level", e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="ابتدائي">ابتدائي</option>
                  <option value="متوسط">متوسط</option>
                  <option value="ثانوي">ثانوي</option>
                  <option value="جامعي">جامعي</option>
                </select>
              </div>

              {/* Conditional Secondary Year Requirement 2 & 3 */}
              {formData.level === "ثانوي" && (
                <div className="space-y-4 pt-2 border-t border-outline/10 animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-on-surface">
                      السنة الثانوية <span className="text-error">*</span>
                    </label>
                    <select
                      value={formData.secondaryYear || "ثالثة"}
                      onChange={(e) => updateField("secondaryYear", e.target.value)}
                      className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="أولى">أولى ثانوي</option>
                      <option value="ثانية">ثانية ثانوي</option>
                      <option value="ثالثة">ثالثة ثانوي (بكالوريا)</option>
                    </select>
                  </div>

                  {/* Conditional First Year Stream */}
                  {formData.secondaryYear === "أولى" && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <label className="block text-xs font-extrabold text-on-surface">
                        الجذع المشترك (السنة الأولى) <span className="text-error">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {["علمي", "أدبي"].map((str) => (
                          <button
                            key={str}
                            type="button"
                            onClick={() => updateField("firstYearStream", str)}
                            className={`p-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                              formData.firstYearStream === str
                                ? "bg-primary text-on-primary border-primary shadow-xs"
                                : "bg-surface-variant/30 text-on-surface-variant border-outline/20 hover:border-primary/40"
                            }`}
                          >
                            جذع مشترك {str}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditional Specialization for 2nd & 3rd Year Requirement 2 */}
                  {(formData.secondaryYear === "ثانية" || formData.secondaryYear === "ثالثة") && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <label className="block text-xs font-extrabold text-on-surface">
                        الشعبة الدراسية <span className="text-error">*</span>
                      </label>
                      <select
                        value={formData.specialization || "علوم تجريبية"}
                        onChange={(e) => updateField("specialization", e.target.value)}
                        className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                      >
                        <option value="علوم تجريبية">علوم تجريبية</option>
                        <option value="رياضيات">رياضيات</option>
                        <option value="تقني رياضي">تقني رياضي</option>
                        <option value="آداب وفلسفة">آداب وفلسفة</option>
                        <option value="لغات أجنبية">لغات أجنبية</option>
                        <option value="تسيير واقتصاد">تسيير واقتصاد</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 3: CONTACT DETAILS & FINAL OTP SUBMIT */}
          {/* ========================================== */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-outline/10 pb-2">
                <Phone className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-on-surface">الالخطوة 4: معطيات الاتصال والتأكيد</h3>
              </div>

              {/* Student Phone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  رقم هاتف الطالب (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.studentPhone}
                    onChange={(e) => updateField("studentPhone", e.target.value)}
                    placeholder="06XXXXXXXX"
                    dir="ltr"
                    className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                </div>
              </div>

              {/* Parent Phone Requirement 2 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  رقم هاتف الولي (مطلوب) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => updateField("parentPhone", e.target.value)}
                    placeholder="05XXXXXXXX / 06XXXXXXXX"
                    dir="ltr"
                    required
                    className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-error pointer-events-none" />
                </div>
                <p className="text-[11px] text-on-surface-variant/70">
                  ضروري لإشعارات متابعة النقاط والحصص مع أستاذ الفوج.
                </p>
              </div>

              {/* OTP Code Area once sent */}
              {otpSent && (
                <form onSubmit={handleFinalSubmit} className="space-y-3 pt-3 border-t border-outline/10 animate-fadeIn">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center space-y-1">
                    <p className="text-xs font-bold text-on-surface">تم إرسال كود التفعيل إلى:</p>
                    <p className="text-xs font-mono font-black text-primary dir-ltr">{formData.email}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-on-surface text-center">
                      أدخل كود التفعيل المكون من 6 أرقام:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      required
                      className="w-full h-12 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-center font-mono text-xl font-black tracking-[0.4em] focus:outline-none focus:border-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.length < 6}
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري إنشاء الحساب...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد وإنشاء الحساب الآن</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Wizard Action Footer Navigation Buttons Requirement 3 */}
          <div className="flex items-center justify-between pt-4 border-t border-outline/10">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStep === 0 || isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              <span>السابق</span>
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : !otpSent ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>إرسال كود التفعيل للبريد</span>
                  </>
                )}
              </button>
            ) : null}
          </div>

          {/* Navigation link to Login */}
          <div className="pt-2 text-center border-t border-outline/10">
            <p className="text-xs text-on-surface-variant">
              لديك حساب بالفعل؟{" "}
              <Link href="/login" className="font-bold text-primary hover:underline">
                تسجيل الدخول
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { auth } from "@/lib/firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  ShieldCheck,
  GraduationCap,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  User as UserIcon,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  Send,
  Phone,
  BookOpen,
  ChevronLeft,
  Check,
} from "lucide-react";

// ==========================================
// 1. ZOD SCHEMA SPECIFICATION Requirement 2
// ==========================================
export const teacherWizardSchema = z
  .object({
    // Step 0: Auth & Teacher Key
    email: z.string().email("البريد الإلكتروني المدخل غير صالح"),
    password: z.string().min(6, "كلمة المرور يجب أن تتكون من 6 أحرف على الأقل"),
    confirmPassword: z.string().min(6, "تأكيد كلمة المرور مطلوب"),
    teacherKey: z.string().min(3, "مفتاح دعوة الأستاذ (Teacher Invite Key) إجباري"),

    // Step 1: Identity & Contact
    firstName: z.string().min(2, "الاسم الأول مطلوب (حرفان على الأقل)"),
    lastName: z.string().min(2, "اللقب مطلوب (حرفان على الأقل)"),
    phone: z.string().min(8, "رقم الهاتف مطلوب للتواصل والأمان"),

    // Step 2: Professional Track
    level: z.enum(["ابتدائي", "متوسط", "ثانوي", "جامعي"], {
      required_error: "يرجى تحديد المستوى التدريسي",
    }),
    subjects: z.array(z.string()).min(1, "يرجى اختيار مادة تعليمية واحدة على الأقل"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "كلمتا المرور غير متطابقتين",
        path: ["confirmPassword"],
      });
    }
  });

export type TeacherWizardFormData = z.infer<typeof teacherWizardSchema>;

// Available Academic Subjects List
const AVAILABLE_SUBJECTS = [
  "رياضيات",
  "علوم فيزيائية",
  "علوم الطبيعة والحياة",
  "أدب عربي",
  "لغة إنجليزية",
  "لغة فرنسية",
  "تاريخ وجغرافيا",
  "فلسفة",
  "علوم إسلامية",
  "تسيير مالي ومحاسبي",
  "هندسة مدنية",
  "هندسة ميكانيكية",
  "هندسة كهربائية",
  "لغة ألمانية",
  "لغة إسبانية",
];

export default function TeacherRegisterWizardPage() {
  const router = useRouter();

  // Wizard Step State (0: Auth & Key, 1: Identity & Phone, 2: Level & Subjects)
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // Form State Values
  const [formData, setFormData] = useState<Partial<TeacherWizardFormData>>({
    email: "",
    password: "",
    confirmPassword: "",
    teacherKey: "",
    firstName: "",
    lastName: "",
    phone: "",
    level: "ثانوي",
    subjects: ["رياضيات"],
  });

  // UI & Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [debugOtpCode, setDebugOtpCode] = useState<string | null>(null);

  const updateField = (field: keyof TeacherWizardFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSubject = (subj: string) => {
    const current = formData.subjects || [];
    if (current.includes(subj)) {
      if (current.length > 1) {
        updateField("subjects", current.filter((s) => s !== subj));
      }
    } else {
      updateField("subjects", [...current, subj]);
    }
  };

  // Step Validation Requirement 3
  const validateCurrentStep = (): boolean => {
    setErrorMessage(null);

    if (currentStep === 0) {
      if (!formData.email || !formData.email.includes("@")) {
        setErrorMessage("يرجى إدخال بريد إلكتروني صالح.");
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
      if (!formData.teacherKey || formData.teacherKey.trim().length < 3) {
        setErrorMessage("مفتاح دعوة الأستاذ (Teacher Invite Key) إجباري.");
        return false;
      }
    } else if (currentStep === 1) {
      if (!formData.firstName || formData.firstName.trim().length < 2) {
        setErrorMessage("يرجى كتابة الاسم الأول.");
        return false;
      }
      if (!formData.lastName || formData.lastName.trim().length < 2) {
        setErrorMessage("يرجى كتابة اللقب الرسمي.");
        return false;
      }
      if (!formData.phone || formData.phone.trim().length < 8) {
        setErrorMessage("رقم الهاتف مطلوب للتواصل والأمان.");
        return false;
      }
    } else if (currentStep === 2) {
      if (!formData.level) {
        setErrorMessage("يرجى تحديد المستوى التدريسي.");
        return false;
      }
      if (!formData.subjects || formData.subjects.length === 0) {
        setErrorMessage("يرجى اختيار مادة تعليمية واحدة على الأقل.");
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 2));
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Step 2 Action: Send OTP to Email
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

  // Final Step: Verify OTP, Burn Teacher Key & Create Account Requirement 4
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrorMessage("يرجى إدخال كود التفعيل المكون من 6 أرقام بشكل صحيح.");
      return;
    }

    setIsSubmitting(true);

    try {
      const fullProfile = {
        firstName: formData.firstName?.trim(),
        lastName: formData.lastName?.trim(),
        fullName: `${formData.firstName?.trim()} ${formData.lastName?.trim()}`,
        phone: formData.phone?.trim(),
        level: formData.level,
        subjects: formData.subjects,
        subject: formData.subjects?.[0] || "عام",
      };

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email?.trim(),
          otp: otpCode.trim(),
          password: formData.password,
          displayName: fullProfile.fullName,
          role: "teacher",
          teacherId: formData.teacherKey?.trim(),
          inviteKey: formData.teacherKey?.trim(),
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

        setInfoMessage("تم تفعيل مفتاح الأستاذ وإنشاء الحساب بنجاح! جاري التوجيه إلى لوحة التحكم...");
        setTimeout(() => {
          router.push("/teacher/dashboard");
        }, 1200);
      } else {
        setErrorMessage(data.error || "فشلت عملية التحقق وإنشاء حساب الأستاذ.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ غير متوقع أثناء تفعيل مفتاح الأستاذ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    { title: "بيانات الدخول والمفتاح", desc: "البريد ومفتاح الأستاذ" },
    { title: "الهوية والاتصال", desc: "الاسم ورقم الهاتف" },
    { title: "التخصص والمستوى", desc: "المواد والمستوى التدريسي" },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background text-on-background overflow-hidden selection:bg-primary/20" dir="rtl">
      {/* Ambient Background Blur Gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/10 blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <header className="absolute top-6 left-6 z-20">
        <ThemeToggle />
      </header>

      {/* Main Wizard Container */}
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
                  {otpSent ? "جاري التحقق واعتماد مفتاح الأستاذ..." : "جاري التحقق من المفتاح وإرسال كود التفعيل..."}
                </h3>
                <p className="text-xs text-on-surface-variant">تخصيص الكوتا وحفظ ملف الأستاذ المعتمد</p>
              </div>
            </div>
          )}

          {/* Top Logo & Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
              تسجيل واعتماد أستاذ جديد
            </h1>
            <p className="text-xs text-on-surface-variant">
              تفعيل حساب الأستاذ عبر مفتاح الدعوة المعتمد (الخطوة {currentStep + 1} من 3)
            </p>
          </div>

          {/* Progress Stepper Bar Requirement 3 */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
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
          {/* STEP 0: AUTH CREDENTIALS & TEACHER KEY     */}
          {/* ========================================== */}
          {currentStep === 0 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-outline/10 pb-2">
                <Lock className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-on-surface">الخطوة 1: بيانات الدخول ومفتاح الدعوة</h3>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  البريد الإلكتروني للأستاذ <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="teacher@example.com"
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

              {/* Teacher Invite Key Requirement 2 & 4 */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-extrabold text-on-surface">
                  مفتاح دعوة الأستاذ (Teacher Invite Key) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.teacherKey}
                    onChange={(e) => updateField("teacherKey", e.target.value.toUpperCase())}
                    placeholder="TCH-2027-XXXXXX"
                    dir="ltr"
                    required
                    className="w-full h-12 pr-10 pl-4 rounded-xl bg-primary/5 border border-primary/30 text-on-surface text-center font-mono text-sm font-black focus:outline-none focus:border-primary uppercase"
                  />
                  <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
                </div>
                <p className="text-[11px] text-on-surface-variant/70">
                  مفتاح الأستاذ المعتمد المسلم من إدارة المنصة لتحديد كوتا مفاتيح التفعيل المسموحة لك.
                </p>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 1: IDENTITY & CONTACT                 */}
          {/* ========================================== */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-outline/10 pb-2">
                <UserIcon className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-on-surface">الخطوة 2: الهوية ومعلومات الاتصال</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-on-surface">
                    الاسم الأول <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    placeholder="مثال: عبد القادر"
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
                    placeholder="مثال: الماجد"
                    required
                    className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Phone Requirement 2 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  رقم الهاتف المباشر <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="06XXXXXXXX / 05XXXXXXXX"
                    dir="ltr"
                    required
                    className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* STEP 2: PROFESSIONAL TRACK & SUBJECTS     */}
          {/* ========================================== */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-outline/10 pb-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-on-surface">الخطوة 3: التخصص والمستوى التدريسي</h3>
              </div>

              {/* Level Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  المستوى التدريسي المستهدف <span className="text-error">*</span>
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => updateField("level", e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="ابتدائي">ابتدائي</option>
                  <option value="متوسط">متوسط</option>
                  <option value="ثانوي">ثانوي (بكالوريا)</option>
                  <option value="جامعي">جامعي</option>
                </select>
              </div>

              {/* Multi-Select Subjects Requirement 2 & 3 */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-on-surface">
                  المواد التعليمية المدرسة (حدد مادة أو أكثر) <span className="text-error">*</span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-surface-variant/20 border border-outline/15 max-h-48 overflow-y-auto">
                  {AVAILABLE_SUBJECTS.map((subj) => {
                    const isSelected = (formData.subjects || []).includes(subj);
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => toggleSubject(subj)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-primary text-on-primary shadow-xs border border-primary"
                            : "bg-surface text-on-surface-variant hover:text-on-surface border border-outline/20"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        <span>{subj}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OTP Code Verification area if sent */}
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
                        <span>جاري اعتماد الحساب...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد وإنشاء حساب الأستاذ</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Navigation Buttons Requirement 3 */}
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

            {currentStep < 2 ? (
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
              لديك حساب أستاذ بالفعل؟{" "}
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

"use client";

import React, { useState, ChangeEvent } from "react";
import {
  ArrowRight,
  Check,
  User,
  Sparkles,
  GraduationCap,
  Award,
  Compass,
  Lightbulb,
  Code,
  Rocket,
  Shield,
  Flame,
  Star,
  BookOpen,
  Laptop,
  Upload,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { RegisterFormData } from "@/src/app/register/page";

interface RegisterStep3Props {
  formData: RegisterFormData;
  updateFormData: (fields: Partial<RegisterFormData>) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function RegisterStep3({
  formData,
  updateFormData,
  onBack,
  onSubmit,
}: RegisterStep3Props) {
  // Preview state for custom uploaded file
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(
    formData.avatar?.startsWith("data:image/") ? formData.avatar : null
  );

  // 12 Predefined UI Avatars
  const avatarList = [
    {
      id: "avatar-1",
      name: "طالب متفوق",
      icon: GraduationCap,
      bgClass: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    },
    {
      id: "avatar-2",
      name: "باحث متميز",
      icon: Sparkles,
      bgClass: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    },
    {
      id: "avatar-3",
      name: "مبتكر متقن",
      icon: Lightbulb,
      bgClass: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "avatar-4",
      name: "مبرمج شغوف",
      icon: Code,
      bgClass: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    },
    {
      id: "avatar-5",
      name: "قائد الفوج",
      icon: Award,
      bgClass: "bg-rose-500/20 text-rose-600 dark:text-rose-400",
    },
    {
      id: "avatar-6",
      name: "مكتشف المعرفة",
      icon: Compass,
      bgClass: "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
    },
    {
      id: "avatar-7",
      name: "رائد علوم",
      icon: Rocket,
      bgClass: "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    },
    {
      id: "avatar-8",
      name: "حامي المنصة",
      icon: Shield,
      bgClass: "bg-teal-500/20 text-teal-600 dark:text-teal-400",
    },
    {
      id: "avatar-9",
      name: "شعلة الإنجاز",
      icon: Flame,
      bgClass: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    },
    {
      id: "avatar-10",
      name: "نجم متألق",
      icon: Star,
      bgClass: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    },
    {
      id: "avatar-11",
      name: "قارئ شغوف",
      icon: BookOpen,
      bgClass: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
    },
    {
      id: "avatar-12",
      name: "خبير التقنية",
      icon: Laptop,
      bgClass: "bg-violet-500/20 text-violet-600 dark:text-violet-400",
    },
  ];

  const handleSelectPresetAvatar = (id: string) => {
    setCustomImagePreview(null);
    updateFormData({ avatar: id, avatarFile: null });
  };

  const handleCustomFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("يرجى اختيار ملف صورة صالح.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomImagePreview(result);
      updateFormData({ avatar: result, avatarFile: file });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomImage = () => {
    setCustomImagePreview(null);
    updateFormData({ avatar: "", avatarFile: null });
  };

  const isPresetSelected = avatarList.some((av) => av.id === formData.avatar);
  const isCustomUploaded = Boolean(customImagePreview);
  const isSelectionValid = Boolean(formData.avatar);

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* Step Title */}
      <div className="text-right">
        <h2 className="text-xl font-bold text-on-surface">اختر صورتك الرمزية (Avatar)</h2>
        <p className="text-xs text-on-surface-variant mt-1">
          اختر رمزاً من القائمة المتاحة أو قم برفع صورتك الشخصية المخصصة
        </p>
      </div>

      {/* Custom Image Upload Zone */}
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-on-surface-variant">
          رفع صورة شخصية مخصصة
        </span>

        {isCustomUploaded ? (
          /* Uploaded Custom Image Preview Card */
          <div className="p-4 rounded-2xl bg-surface-variant/40 border border-primary/40 flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-primary shadow-md shrink-0">
                <img
                  src={customImagePreview!}
                  alt="الصورة الشخصية المخصصة"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                  <Check className="w-3.5 h-3.5" />
                  <span>تم رفع الصورة بنجاح</span>
                </span>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  سيتم اعتماد هذه الصورة لملفك الشخصي
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemoveCustomImage}
              className="p-2 rounded-xl text-on-surface-variant/70 hover:text-error hover:bg-error-container/40 transition-colors"
              aria-label="حذف الصورة المخصصة"
              title="حذف الصورة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          /* Dropzone Upload Button */
          <label
            htmlFor="customAvatarInput"
            className="flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed border-outline/30 bg-surface-variant/20 hover:bg-surface-variant/40 hover:border-primary/40 transition-all duration-200 cursor-pointer text-center group"
          >
            <input
              id="customAvatarInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomFileUpload}
            />
            <div className="p-2.5 rounded-xl bg-primary-container text-on-primary-container shadow-sm group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
                اضغط هنا لرفع صورة من جهازك
              </span>
              <p className="text-[10px] text-on-surface-variant/70 mt-0.5">
                يدعم صيغ JPG, PNG, WEBP
              </p>
            </div>
          </label>
        )}
      </div>

      <div className="h-[1px] bg-outline/10 w-full" />

      {/* Predefined Avatars Grid (12 Diverse Avatars) */}
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-on-surface-variant">
          أو اختر رمزاً جاهزاً من القائمة (12 خيار)
        </span>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {avatarList.map((av) => {
            const isSelected = isPresetSelected && formData.avatar === av.id;
            const Icon = av.icon;

            return (
              <button
                key={av.id}
                type="button"
                onClick={() => handleSelectPresetAvatar(av.id)}
                className={`relative group p-3 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center focus:outline-none ${
                  isSelected
                    ? "bg-primary/10 border-primary ring-4 ring-primary/30 shadow-md scale-105"
                    : "bg-surface-variant/30 border-outline/15 hover:border-outline/30 hover:bg-surface-variant/50"
                }`}
              >
                {/* Avatar Icon Container */}
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 ${av.bgClass}`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Avatar Label */}
                <span
                  className={`text-[11px] font-bold truncate w-full transition-colors ${
                    isSelected ? "text-primary font-black" : "text-on-surface-variant"
                  }`}
                >
                  {av.name}
                </span>

                {/* Selected Checkmark Badge */}
                {isSelected && (
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm animate-scaleUp">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons Container (NO SKIP BUTTON) */}
      <div className="pt-4 border-t border-outline/10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 h-12 rounded-xl bg-surface-variant/60 text-on-surface-variant font-bold text-sm hover:bg-surface-variant focus:outline-none transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            <span>السابق</span>
          </button>

          {/* Main Submit Button - Disabled unless valid avatar/image selected */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!isSelectionValid}
            className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99]"
          >
            <User className="w-4 h-4" />
            <span>إنشاء الحساب</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegisterStep3;

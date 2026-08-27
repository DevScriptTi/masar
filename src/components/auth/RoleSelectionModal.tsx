"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Presentation, X, Sparkles, ArrowLeft } from "lucide-react";

interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoleSelectionModal({ isOpen, onClose }: RoleSelectionModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleSelectRole = (targetPath: string) => {
    onClose();
    router.push(targetPath);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" dir="rtl">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Content Requirement 2 & 4 */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-outline/20 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">ما هي صفتك في المنصة؟</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">يرجى تحديد نوع الحساب الذي ترغب بإنشائه</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Role Cards Grid Requirement 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Card 1: Student */}
          <div
            onClick={() => handleSelectRole("/register")}
            className="group relative p-6 rounded-3xl bg-surface-variant/30 border-2 border-outline/20 hover:border-primary hover:bg-primary/5 transition-all duration-300 cursor-pointer space-y-4 shadow-sm hover:shadow-xl active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary border border-primary/20 flex items-center justify-center transition-colors">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-on-surface group-hover:text-primary transition-colors flex items-center justify-between">
                <span>تلميذ</span>
                <ArrowLeft className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0" />
              </h3>
              <p className="text-xs text-on-surface-variant/80 font-medium leading-relaxed">
                للتسجيل في الدورات والانضمام لأفواج الأساتذة عبر رموز التفعيل.
              </p>
            </div>
            <span className="inline-block px-3 py-1 rounded-xl bg-primary/10 text-primary text-[11px] font-black">
              تسجيل التلميذ 🎓
            </span>
          </div>

          {/* Card 2: Teacher */}
          <div
            onClick={() => handleSelectRole("/register/teacher")}
            className="group relative p-6 rounded-3xl bg-surface-variant/30 border-2 border-outline/20 hover:border-secondary hover:bg-secondary/5 transition-all duration-300 cursor-pointer space-y-4 shadow-sm hover:shadow-xl active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary border border-secondary/20 flex items-center justify-center transition-colors">
              <Presentation className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-on-surface group-hover:text-secondary transition-colors flex items-center justify-between">
                <span>أستاذ</span>
                <ArrowLeft className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0" />
              </h3>
              <p className="text-xs text-on-surface-variant/80 font-medium leading-relaxed">
                لإنشاء الأفواج، إدارة التلاميذ، ونشر المحتوى عبر مفاتيح الدعوة.
              </p>
            </div>
            <span className="inline-block px-3 py-1 rounded-xl bg-secondary/10 text-secondary text-[11px] font-black">
              اعتماد الأستاذ 👨‍🏫
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-3 border-t border-outline/10 text-center text-xs text-on-surface-variant/70">
          هل تملك حساباً بالفعل؟{" "}
          <button
            type="button"
            onClick={onClose}
            className="text-primary font-bold hover:underline cursor-pointer"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}

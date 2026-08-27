"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./use-toast";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  ExternalLink,
} from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const router = useRouter();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-5 left-5 md:top-6 md:left-6 z-[9999] pointer-events-none flex flex-col gap-3 max-w-sm w-full transition-all"
      dir="rtl"
    >
      {toasts.map((toast) => {
        const isDestructive = toast.variant === "destructive";
        const isSuccess = toast.variant === "success";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto relative w-full bg-surface/95 backdrop-blur-md border rounded-3xl p-4 shadow-2xl animate-scaleUp flex items-start gap-3 transition-all ${
              isDestructive
                ? "border-error/40 border-r-4 border-r-error"
                : isSuccess
                ? "border-emerald-500/40 border-r-4 border-r-emerald-500"
                : "border-outline/20 border-r-4 border-r-primary"
            }`}
          >
            {/* Icon Header */}
            <div
              className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                isDestructive
                  ? "bg-error/15 text-error"
                  : isSuccess
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {isDestructive ? (
                <AlertCircle className="w-5 h-5" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5 animate-bounce" />
              )}
            </div>

            {/* Title & Description */}
            <div className="flex-1 space-y-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                {toast.title && (
                  <h4 className="text-xs font-black text-on-surface truncate">
                    {toast.title}
                  </h4>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="إغلاق التنبيه"
                  className="p-1 rounded-xl text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {toast.description && (
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  {toast.description}
                </p>
              )}

              {/* Toast Action Button / Href Link */}
              {toast.action ? (
                <div className="pt-1.5">{toast.action}</div>
              ) : toast.href ? (
                <button
                  type="button"
                  onClick={() => {
                    dismiss(toast.id);
                    if (toast.href) router.push(toast.href);
                  }}
                  className="text-[11px] font-extrabold text-primary hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                >
                  <span>عرض التفاصيل</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

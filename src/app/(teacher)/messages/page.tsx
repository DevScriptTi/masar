"use client";

import React from "react";
import { TeacherChatInterface } from "@/src/components/admin/TeacherChatInterface";
import { MessageSquare, Sparkles } from "lucide-react";

export default function TeacherMessagesPage() {
  return (
    <div className="space-y-4" dir="rtl">
      {/* Page Title Row */}
      <div className="flex items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-xs">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-on-surface tracking-tight">
              الرسائل والاستفسارات المباشرة
            </h1>
            <p className="text-xs text-on-surface-variant font-medium">
              التواصل البيداغوجي المباشر والرد على أسئلة وحلول الطلاب
            </p>
          </div>
        </div>

        <div className="hidden sm:inline-flex items-center gap-2 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>مزامنة لحظية مع الطلاب</span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <TeacherChatInterface />
    </div>
  );
}

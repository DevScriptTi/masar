"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DirectChatInterface } from "@/src/components/student/DirectChatInterface";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NotificationBell } from "@/src/components/student/NotificationBell";
import { UserProfileDropdown } from "@/src/components/student/UserProfileDropdown";
import {
  MessageSquare,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function StudentChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Authentication check
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-on-surface-variant">جاري تحميل المحادثات المباشرة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary/20" dir="rtl">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-outline/15 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Simple & Elegant Back Button */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors py-1.5 px-3 rounded-xl bg-surface-variant/30 hover:bg-surface-variant/60 border border-outline/10"
          >
            <ArrowRight className="w-4 h-4 text-primary" />
            <span>العودة إلى لوحة التحكم</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-outline/15">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-extrabold text-on-surface">المحادثة المباشرة مع الأساتذة</h1>
              <p className="text-[10px] text-on-surface-variant">فضاء التواصل الأكاديمي المباشر</p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <NotificationBell />
          <ThemeToggle />
          <UserProfileDropdown />
        </div>
      </header>

      {/* Main Chat Workspace Container */}
      <main className="max-w-7xl mx-auto p-2 sm:p-4 md:p-6 animate-fadeIn">
        <DirectChatInterface />
      </main>
    </div>
  );
}

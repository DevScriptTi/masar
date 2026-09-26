"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useAdminLayout } from "./AdminLayoutWrapper";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NotificationBell } from "@/src/components/student/NotificationBell";
import { Menu, ShieldCheck, Bell, User, Settings, MessageSquare } from "lucide-react";

export function TopAppBar() {
  const { userData } = useAuth();
  const { setMobileOpen } = useAdminLayout();

  return (
    <header
      className="sticky top-0 z-20 w-full h-16 bg-surface/90 backdrop-blur-md border-b border-outline/15 px-4 sm:px-8 flex items-center justify-between shadow-sm transition-all duration-300"
      dir="rtl"
    >
      {/* Right Side (RTL Start): Mobile Hamburger Toggle & Brand Logo */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2.5 rounded-2xl bg-surface-variant/60 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
          aria-label="فتح القائمة الرئيسية"
          title="فتح القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-container text-on-primary-container shadow-sm shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-on-surface tracking-tight leading-none">
              بوابة الأستاذ
            </h1>
            <p className="text-[10px] sm:text-xs text-on-surface-variant font-medium mt-0.5">
              منصة البكالوريا 2027
            </p>
          </div>
        </div>
      </div>

      {/* Left Side (RTL End): Action Group (Chat, Theme Toggle, Notifications, Profile Link) */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Teacher Chat / Messages Button */}
        <Link
          href="/teacher/messages"
          className="relative p-2.5 rounded-2xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface-variant hover:text-primary border border-outline/10 text-xs font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center"
          title="الرسائل والاستفسارات المباشرة مع الطلاب"
        >
          <MessageSquare className="w-5 h-5 text-primary" />
          {/* Unread badge ping */}
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
        </Link>

        {/* Real-time Notification Bell */}
        <NotificationBell />

        {/* Theme Toggle Button */}
        <ThemeToggle />

        {/* Profile / Settings Button */}
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface-variant hover:text-on-surface border border-outline/10 text-xs font-semibold transition-all duration-200 active:scale-95"
          title="إعدادات الحساب والملف الشخصي"
        >
          <User className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">
            {userData?.fullName || userData?.displayName || "الملف الشخصي"}
          </span>
        </Link>
      </div>
    </header>
  );
}

export default TopAppBar;

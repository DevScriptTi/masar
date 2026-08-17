"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminLayout } from "./AdminLayoutWrapper";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { Menu, ShieldCheck, Bell } from "lucide-react";

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

      {/* Left Side (RTL End): Action Group (Theme Toggle, Notifications, User Name Badge) */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Theme Toggle Button */}
        <ThemeToggle />

        {/* Notification Icon Button */}
        <button
          type="button"
          className="relative flex items-center justify-center w-10 h-10 rounded-full bg-surface-variant/60 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 transform active:scale-95 shadow-sm"
          aria-label="التنبيهات والإشعارات"
          title="الإشعارات"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-error animate-pulse" />
        </button>

        {/* User Name Badge */}
        {userData?.fullName && (
          <span className="hidden sm:inline-flex text-xs font-semibold text-on-surface-variant bg-surface-variant/50 px-3.5 py-1.5 rounded-full border border-outline/10">
            {userData.fullName}
          </span>
        )}
      </div>
    </header>
  );
}

export default TopAppBar;

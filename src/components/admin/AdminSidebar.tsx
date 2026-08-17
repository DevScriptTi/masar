"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminLayout } from "./AdminLayoutWrapper";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { CreateGroupModal } from "./modals/CreateGroupModal";
import {
  LayoutDashboard,
  KeyRound,
  Users,
  BookOpen,
  ClipboardCheck,
  LogOut,
  ChevronLeft,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";

export function AdminSidebar() {
  const { userData, loading } = useAuth();
  const { isRail, setIsRail, mobileOpen, setMobileOpen } = useAdminLayout();
  const pathname = usePathname();
  const router = useRouter();

  // Create Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  const navItems = [
    {
      title: "لوحة القيادة",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "إدارة المفاتيح",
      href: "/admin/keys",
      icon: KeyRound,
    },
    {
      title: "إدارة الأفواج",
      href: "/admin/groups",
      icon: Users,
    },
    {
      title: "المسارات والدروس",
      href: "/admin/courses",
      icon: BookOpen,
    },
    {
      title: "تصحيح التسليمات",
      href: "/admin/evaluations",
      icon: ClipboardCheck,
    },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const nameToShow =
    userData?.fullName ||
    userData?.displayName ||
    userData?.email?.split("@")[0] ||
    "الأستاذ المشرف";

  return (
    <>
      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
      />

      {/* ------------------------------------------------------------- */}
      {/* 1. MOBILE MODAL DRAWER (Sliding from Right with Dark Backdrop)  */}
      {/* ------------------------------------------------------------- */}
      {/* Backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Sliding Mobile Drawer */}
      <aside
        dir="rtl"
        className={`md:hidden fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-surface/98 backdrop-blur-xl border-l border-outline/15 z-50 flex flex-col justify-between p-5 shadow-2xl transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Mobile Header */}
          <div className="flex items-center justify-between pb-4 border-b border-outline/10">
            <span className="font-bold text-sm text-on-surface">القائمة الرئيسية</span>

            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-variant focus:outline-none transition-colors"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile FAB Action Button (Opens Create Group Modal) */}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              setIsGroupModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            <span>توليد فوج جديد</span>
          </button>

          {/* User Profile Card */}
          <div className="p-4 rounded-2xl bg-surface-variant/40 border border-outline/10">
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-outline/20 rounded-md w-3/4" />
                <div className="h-3 bg-outline/20 rounded-md w-1/2" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                  {nameToShow.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-sm font-semibold text-on-surface truncate">
                    {nameToShow}
                  </h3>
                  <p className="text-xs text-on-surface-variant truncate" dir="ltr">
                    {userData?.email || ""}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Navigation Links */}
          <nav className="space-y-2 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname?.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-on-primary shadow-md font-semibold"
                      : "text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? "text-on-primary" : "text-on-surface-variant"
                      }`}
                    />
                    <span>{item.title}</span>
                  </div>
                  {isActive && <ChevronLeft className="w-4 h-4 text-on-primary" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Mobile Bottom Actions */}
        <div className="pt-4 border-t border-outline/10">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-error-container/70 text-on-error-container font-medium text-sm hover:bg-error-container focus:outline-none transition-all active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* 2. DESKTOP NAVIGATION RAIL (80px) & EXPANDED DRAWER (280px)   */}
      {/* ------------------------------------------------------------- */}
      <aside
        dir="rtl"
        className={`hidden md:flex fixed top-0 right-0 h-screen bg-surface/95 backdrop-blur-lg border-l border-outline/15 z-30 flex-col justify-between py-4 shadow-lg transition-all duration-300 ease-in-out ${
          isRail ? "w-[80px] px-3" : "w-[280px] px-4"
        }`}
      >
        <div className="space-y-5">
          {/* Top of Sidebar - Toggle Button & Brand Header */}
          <div className="space-y-4">
            <div className={`flex items-center justify-start px-1 pt-1 ${isRail ? "justify-center" : ""}`}>
              {/* Navigation Rail Toggle Button */}
              <button
                type="button"
                onClick={() => setIsRail(!isRail)}
                className="p-2.5 rounded-2xl bg-surface-variant/60 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200 active:scale-95 shadow-sm"
                aria-label={isRail ? "توسيع القائمة" : "تصغير القائمة"}
                title={isRail ? "توسيع القائمة" : "تصغير القائمة"}
              >
                {isRail ? (
                  <PanelLeftOpen className="w-5 h-5" />
                ) : (
                  <PanelLeftClose className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* MD3 Floating Action Button (FAB) -> Opens Create Group Modal */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(true)}
                title={isRail ? "توليد فوج جديد" : undefined}
                className={`group relative flex items-center justify-center rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:shadow-lg transition-all duration-300 active:scale-[0.98] ${
                  isRail
                    ? "w-12 h-12 mx-auto"
                    : "w-full px-4 py-3.5 gap-3"
                }`}
              >
                <Plus className="w-5 h-5 shrink-0" />
                {!isRail && <span>توليد فوج جديد</span>}

                {/* Left-Popping RTL Hover Tooltip for FAB in Rail Mode */}
                {isRail && (
                  <span className="absolute right-full mr-4 hidden w-max rounded-xl bg-primary text-on-primary border border-outline/20 px-3 py-1.5 text-xs font-semibold shadow-xl group-hover:block z-50 pointer-events-none whitespace-nowrap">
                    توليد فوج جديد
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="h-[1px] bg-outline/10 w-full" />

          {/* User Profile Section */}
          <div className={`rounded-2xl bg-surface-variant/40 border border-outline/10 transition-all duration-300 ${isRail ? "p-2 flex justify-center" : "p-3.5"}`}>
            {loading ? (
              <div className="w-10 h-10 rounded-full bg-outline/20 animate-pulse" />
            ) : (
              <div className={`flex items-center gap-3 ${isRail ? "justify-center" : ""}`}>
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                  {nameToShow.charAt(0).toUpperCase()}
                </div>
                {!isRail && (
                  <div className="overflow-hidden">
                    <h2 className="text-sm font-semibold text-on-surface truncate">
                      {nameToShow}
                    </h2>
                    <p className="text-xs text-on-surface-variant truncate" dir="ltr">
                      {userData?.email || ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links Grid / Rail */}
          <nav className="space-y-2 pt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname?.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center py-3.5 rounded-2xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-on-primary shadow-md font-semibold"
                      : "text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface"
                  } ${isRail ? "justify-center px-0" : "justify-between px-4"}`}
                >
                  <div className={`flex items-center ${isRail ? "justify-center" : "gap-3.5"}`}>
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive ? "text-on-primary" : "text-on-surface-variant"
                      }`}
                    />
                    {!isRail && <span>{item.title}</span>}
                  </div>

                  {!isRail && isActive && (
                    <ChevronLeft className="w-4 h-4 text-on-primary" />
                  )}

                  {/* Left-Popping RTL Hover Tooltip when isRail is true */}
                  {isRail && (
                    <span className="absolute right-full mr-4 hidden w-max rounded-xl bg-surface-variant border border-outline/20 px-3 py-1.5 text-xs font-semibold text-on-surface shadow-xl group-hover:block z-50 pointer-events-none whitespace-nowrap">
                      {item.title}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Logout Button */}
        <div className="pt-4 border-t border-outline/10">
          <button
            type="button"
            onClick={handleLogout}
            title={isRail ? "تسجيل الخروج" : undefined}
            className={`group relative w-full flex items-center py-3 rounded-2xl bg-error-container/70 text-on-error-container font-medium text-sm hover:bg-error-container focus:outline-none transition-all active:scale-[0.98] ${
              isRail ? "justify-center px-0" : "justify-center gap-2.5 px-4"
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isRail && <span>تسجيل الخروج</span>}

            {/* Hover Tooltip for Logout when Rail */}
            {isRail && (
              <span className="absolute right-full mr-4 hidden w-max rounded-xl bg-error-container border border-error/30 px-3 py-1.5 text-xs font-semibold text-on-error-container shadow-xl group-hover:block z-50 pointer-events-none whitespace-nowrap">
                تسجيل الخروج
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

export default AdminSidebar;

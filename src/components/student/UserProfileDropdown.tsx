"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  GraduationCap,
  MessageSquare,
  Sparkles,
  Shield,
} from "lucide-react";

export function UserProfileDropdown() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const studentName = userData?.displayName || userData?.fullName || user?.displayName || "التلميذ";
  const studentEmail = userData?.email || user?.email || "";
  const roleName = userData?.role === "teacher" ? "أستاذ" : userData?.role === "admin" ? "مشرف" : "تلميذ بكالوريا";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setIsOpen(false);
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="relative inline-block text-right" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="قائمة الملف الشخصي والحساب"
        className="h-10 px-2.5 sm:px-3 rounded-xl bg-surface-variant/30 hover:bg-surface-variant/60 text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-2 border border-outline/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-primary-container text-on-primary flex items-center justify-center font-bold text-xs shadow-xs">
          {studentName.charAt(0) || <User className="w-3.5 h-3.5" />}
        </div>
        <span className="hidden md:inline text-xs font-bold truncate max-w-[110px]">
          {studentName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-on-surface-variant/70 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-surface/95 backdrop-blur-xl border border-outline/15 shadow-xl p-2 z-50 animate-fadeIn space-y-1">
          {/* User Details Header */}
          <div className="p-3 rounded-xl bg-surface-variant/30 border border-outline/10 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-on-surface truncate block">
                {studentName}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
                {roleName}
              </span>
            </div>
            {studentEmail && (
              <span className="text-[10px] text-on-surface-variant/80 truncate block font-medium">
                {studentEmail}
              </span>
            )}
          </div>

          <div className="py-1">
            {/* Direct Link: Dashboard */}
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-primary hover:bg-surface-variant/40 rounded-xl transition-colors"
            >
              <GraduationCap className="w-4 h-4 text-primary" />
              <span>لوحة تحكم الطالب</span>
            </Link>

            {/* Direct Link: Teacher Chat */}
            <Link
              href="/dashboard/chat"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-primary hover:bg-surface-variant/40 rounded-xl transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>محادثة الأساتذة</span>
            </Link>

            {/* Direct Link: Settings & Profile */}
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-primary hover:bg-surface-variant/40 rounded-xl transition-colors"
            >
              <Settings className="w-4 h-4 text-primary" />
              <span>الملف الشخصي والإعدادات</span>
            </Link>
          </div>

          <div className="pt-1 border-t border-outline/10">
            {/* Logout Action */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-error hover:bg-error/10 rounded-xl transition-colors text-right cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfileDropdown;

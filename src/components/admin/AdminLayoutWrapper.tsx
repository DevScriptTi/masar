"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { TopAppBar } from "./TopAppBar";
import { Loader2, ShieldAlert } from "lucide-react";

interface AdminLayoutContextType {
  isRail: boolean;
  setIsRail: React.Dispatch<React.SetStateAction<boolean>>;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const AdminLayoutContext = createContext<AdminLayoutContextType | undefined>(
  undefined
);

export const useAdminLayout = () => {
  const context = useContext(AdminLayoutContext);
  if (!context) {
    throw new Error("useAdminLayout must be used within AdminLayoutWrapper");
  }
  return context;
};

export function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isRail, setIsRail] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  // Centralized Protection: Enforce strict mutually exclusive routing for /teacher
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else {
        const role = String(userData?.role || "").trim().toLowerCase();
        if (role === "super_admin") {
          router.replace("/super-admin");
        } else if (role === "student") {
          router.replace("/dashboard");
        }
      }
    }
  }, [user, userData, loading, router]);

  // Loading state overlay
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-on-background">
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-surface/80 border border-outline/15 shadow-xl">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-medium text-on-surface-variant">
            جاري التحقق من الصلاحيات...
          </p>
        </div>
      </div>
    );
  }

  const role = String(userData?.role || "").trim().toLowerCase();
  const isAllowedTeacher =
    user && (role === "teacher" || role === "admin" || userData?.isAdmin === true);

  if (!isAllowedTeacher) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-on-background">
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-error-container/40 border border-error/30 text-on-error-container">
          <ShieldAlert className="w-10 h-10 text-error" />
          <p className="text-sm font-medium">
            غير مسموح بالدخول. جاري إعادة التوجيه إلى مكانك المخصص...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayoutContext.Provider
      value={{ isRail, setIsRail, mobileOpen, setMobileOpen }}
    >
      <div
        className="min-h-screen flex bg-background text-on-background selection:bg-primary/20"
        dir="rtl"
      >
        {/* Navigation Sidebar & Rail */}
        <AdminSidebar />

        {/* Main Content Area */}
        <div
          className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ease-in-out ${
            isRail ? "md:pr-[80px]" : "md:pr-[280px]"
          } pr-0`}
        >
          {/* Top Navbar */}
          <TopAppBar />

          {/* Page Body */}
          <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-8">
            {children}
          </main>
        </div>
      </div>
    </AdminLayoutContext.Provider>
  );
}

export default AdminLayoutWrapper;

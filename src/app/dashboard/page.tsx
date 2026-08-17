"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase/config";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { CourseCard } from "@/src/components/student/CourseCard";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NotificationBell } from "@/src/components/student/NotificationBell";
import {
  GraduationCap,
  BookOpen,
  KeyRound,
  LogOut,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function StudentDashboardPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // Local states for raw data fetching & strict rendering
  const [authorizedCourses, setAuthorizedCourses] = useState<any[]>([]);
  const [isFetchingCourses, setIsFetchingCourses] = useState(true);

  // Security & Authentication Routing Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user || !userData) {
        router.replace("/login");
      } else if (userData.role === "admin" || String(userData.role).toLowerCase() === "admin") {
        router.replace("/admin/dashboard");
      }
    }
  }, [user, userData, authLoading, router]);

  // Robust Raw Data Fetching & Authorization Engine
  useEffect(() => {
    async function fetchCourses() {
      if (!userData) {
        setIsFetchingCourses(false);
        return;
      }
      setIsFetchingCourses(true);
      try {
        // 1. Fetch RAW data directly from Firestore collections to bypass index errors
        const [coursesSnap, groupsSnap] = await Promise.all([
          getDocs(collection(db, "courses")),
          getDocs(collection(db, "groups")),
        ]);

        const allCourses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const allGroups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 2. Comprehensive Enrollment Extraction from all possible userData fields
        const studentRawIdentifiers = new Set<string>();

        if (userData.groupId) studentRawIdentifiers.add(String(userData.groupId));
        if (userData.cohortId) studentRawIdentifiers.add(String(userData.cohortId));
        if (userData.group) studentRawIdentifiers.add(String(userData.group));
        if (userData.cohort) studentRawIdentifiers.add(String(userData.cohort));

        if (Array.isArray(userData.groupIds)) {
          userData.groupIds.forEach((id: any) => id && studentRawIdentifiers.add(String(id)));
        }
        if (Array.isArray(userData.groups)) {
          userData.groups.forEach((g: any) => g && studentRawIdentifiers.add(String(g)));
        }

        if (userData.enrollments) {
          if (typeof userData.enrollments === "object" && !Array.isArray(userData.enrollments)) {
            // Map keys
            Object.keys(userData.enrollments).forEach((key) => key && studentRawIdentifiers.add(String(key)));

            // Map values inside enrollments object
            Object.values(userData.enrollments).forEach((val: any) => {
              if (val && typeof val === "object") {
                if (val.groupId) studentRawIdentifiers.add(String(val.groupId));
                if (val.id) studentRawIdentifiers.add(String(val.id));
                if (val.groupName) studentRawIdentifiers.add(String(val.groupName));
                if (val.name) studentRawIdentifiers.add(String(val.name));
                if (val.group) studentRawIdentifiers.add(String(val.group));
              } else if (typeof val === "string") {
                studentRawIdentifiers.add(val);
              }
            });
          } else if (Array.isArray(userData.enrollments)) {
            userData.enrollments.forEach((val: any) => {
              if (typeof val === "string") {
                studentRawIdentifiers.add(val);
              } else if (val && typeof val === "object") {
                if (val.groupId) studentRawIdentifiers.add(String(val.groupId));
                if (val.id) studentRawIdentifiers.add(String(val.id));
                if (val.groupName) studentRawIdentifiers.add(String(val.groupName));
                if (val.name) studentRawIdentifiers.add(String(val.name));
              }
            });
          }
        }

        const rawKeys = Array.from(studentRawIdentifiers).map((k) => k.trim()).filter(Boolean);

        // 3. Bidirectional Group Mapping: Match raw keys against Group IDs & Names
        const matchedGroupObjects = allGroups.filter((g: any) => {
          const gId = String(g.id || "").trim();
          const gName = String(g.name || "").trim();

          return rawKeys.some(
            (key) =>
              key === gId ||
              key === gName ||
              key.toLowerCase() === gId.toLowerCase() ||
              key.toLowerCase() === gName.toLowerCase()
          );
        });

        // Combine all valid student tokens (IDs + Group Names + Raw Keys)
        const masterTokens = new Set<string>(rawKeys);
        matchedGroupObjects.forEach((g: any) => {
          if (g.id) masterTokens.add(String(g.id).trim());
          if (g.name) masterTokens.add(String(g.name).trim());
        });

        const activeStudentTokens = Array.from(masterTokens);

        // 4. Filter courses client-side
        const filtered = allCourses.filter((c: any) => {
          // Open courses (no group restriction array specified)
          if (!c.groupIds || !Array.isArray(c.groupIds) || c.groupIds.length === 0) {
            return true;
          }

          // Match course groupIds against active student tokens
          return c.groupIds.some((cGroupId: any) => {
            const cleanCGroupId = String(cGroupId).trim();
            return activeStudentTokens.some(
              (token) =>
                token === cleanCGroupId || token.toLowerCase() === cleanCGroupId.toLowerCase()
            );
          });
        });

        setAuthorizedCourses(filtered);
      } catch (error) {
        console.error("Error fetching student authorized courses:", error);
        setAuthorizedCourses([]);
      } finally {
        setIsFetchingCourses(false);
      }
    }

    fetchCourses();
  }, [userData]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-on-surface-variant">جاري التثبت من حساب الطالب...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4" dir="rtl">
        <div className="text-center space-y-3 max-w-md bg-surface p-8 rounded-3xl border border-outline/15 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-on-surface">جاري مزامنة بيانات الحساب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary/20" dir="rtl">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-outline/15 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-on-surface tracking-tight">منصة البكالوريا 2027</h1>
            <p className="text-[11px] font-semibold text-on-surface-variant">فضاء الطالب المتفوق</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="h-10 px-4 rounded-xl bg-surface-variant/40 text-on-surface-variant font-bold text-xs hover:bg-error-container/30 hover:text-error transition-all flex items-center gap-1.5 border border-outline/10"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </div>
      </header>

      {/* Main Student Workspace Container */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 animate-fadeIn">
        {/* Welcome Profile Header Card */}
        <div className="relative bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
          {/* Ambient Background Gradient Glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="space-y-3 relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>مرحباً بك مجدداً</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              أهلاً بك، {userData.displayName || userData.fullName || "تلميذنا العزيز"}
            </h2>

            <p className="text-xs sm:text-sm text-on-surface-variant/90 leading-relaxed font-medium">
              مرحباً بك في منصتك التعليمية التفاعلية. استعرض الدورات المتاحة لك أدناه وابدأ رحلة التفوق والنجاح في شهادة البكالوريا.
            </p>
          </div>

          {/* Key Activation Quick Button */}
          <div className="relative z-10 shrink-0">
            <Link
              href="/dashboard/activate"
              className="h-12 px-6 rounded-2xl bg-secondary/15 border border-secondary/30 text-secondary font-extrabold text-xs hover:bg-secondary/25 transition-all flex items-center justify-center gap-2 shadow-2xs"
            >
              <KeyRound className="w-4 h-4" />
              <span>تفعيل رمز جديد (Key Activation)</span>
            </Link>
          </div>
        </div>

        {/* Courses Section: Strict 3-Phase Conditional Rendering */}
        <div className="mt-8">
          {isFetchingCourses ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
          ) : authorizedCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {authorizedCourses.map((course) => (
                <CourseCard course={course} key={course.id} />
              ))}
            </div>
          ) : (
            <div className="text-center p-12 bg-surface-variant/20 rounded-3xl border border-surface-variant/50">
              <h4 className="text-lg font-extrabold text-on-surface mb-2">لا توجد دورات متاحة لك حالياً</h4>
              <p className="text-sm text-on-surface-variant">لم يتم تعيين أي دورات لهذا الحساب حتى الآن.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

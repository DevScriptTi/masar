"use client";

import React from "react";
import Link from "next/link";
import { CourseDoc } from "@/src/lib/firebase/coursesService";
import { BookOpen, Sparkles, Layers, ArrowLeft } from "lucide-react";

interface CourseCardProps {
  course: CourseDoc;
}

export function CourseCard({ course }: CourseCardProps) {
  if (!course) return null;

  return (
    <div className="group relative bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden">
      {/* Decorative MD3 Gradient Accent Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors pointer-events-none" />

      <div className="space-y-4 relative z-10">
        {/* Top Header Row with Icon Badge */}
        <div className="flex items-center justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/15 group-hover:scale-105 transition-transform">
            <BookOpen className="w-6 h-6" />
          </div>

          <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-surface-variant/40 text-on-surface-variant border border-outline/10 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary" />
            <span>منهج تفاعلي</span>
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-lg font-extrabold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
            {course.title || "دورة تعليمية"}
          </h3>
          <p className="text-xs sm:text-sm text-on-surface-variant/85 leading-relaxed line-clamp-3 font-medium">
            {course.description || "لا يوجد وصف محدد لهذه الدورة التعليمية."}
          </p>
        </div>
      </div>

      {/* Footer Row with MD3 Filled Button */}
      <div className="pt-6 mt-6 border-t border-outline/10 flex items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant/80">
          <Layers className="w-4 h-4 text-primary" />
          <span>محتوى تعليمي شامـل</span>
        </div>

        <Link
          href={`/dashboard/courses/${course.id}`}
          prefetch={false}
          className="h-11 px-5 rounded-2xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0 group/btn"
        >
          <span>الدخول إلى الدورة</span>
          <ArrowLeft className="w-4 h-4 transform group-hover/btn:-translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

export default CourseCard;

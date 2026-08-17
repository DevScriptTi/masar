"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  KeyRound,
  Users,
  BookOpen,
  ArrowUpLeft,
  Sparkles,
  Layers,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { userData } = useAuth();

  // STRICT RULE: Use userData?.fullName, NOT the email
  const nameToDisplay = userData?.fullName || "المستخدم";

  const metricsGrid = [
    {
      title: "إدارة المفاتيح",
      count: "مفاتيح التفعيل",
      description: "إنشاء وتتبع مفاتيح التفعيل المخصصة للتلاميذ والأفواج",
      icon: KeyRound,
      href: "/admin/keys",
      color: "bg-primary-container text-on-primary-container",
      borderColor: "border-primary/20 hover:border-primary/50",
    },
    {
      title: "إدارة الأفواج",
      count: "الأفواج التعليمية",
      description: "تنظيم التلاميذ حسب الأفواج والشعب والمجموعات الدراسية",
      icon: Users,
      href: "/admin/groups",
      color: "bg-secondary-container text-on-secondary-container",
      borderColor: "border-secondary/20 hover:border-secondary/50",
    },
    {
      title: "إدارة المحتوى",
      count: "الدروس والمسارات",
      description: "رفع وتنظيم الدروس والتمارين والملحقات التعليمية",
      icon: BookOpen,
      href: "/admin/courses",
      color: "bg-tertiary-container text-on-tertiary-container",
      borderColor: "border-tertiary/20 hover:border-tertiary/50",
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Hero Section: Massive Welcoming MD3 Card (Cleaned without redundant button) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-container via-surface-variant/40 to-surface p-8 sm:p-12 border border-outline/15 shadow-md">
        <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>مركز التحكم القيادي</span>
          </div>
          {/* STRICT REQUIREMENT: "مرحباً بك، {userData?.fullName}!" */}
          <h1 className="text-3xl sm:text-5xl font-extrabold text-on-surface tracking-tight leading-tight">
            مرحباً بك، {nameToDisplay}!
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
            مرحباً بك في مركز الإدارة الموحد. من هنا يمكنك إدارة المفاتيح، تنظيم الأفواج، وتحديث المحتوى التعليمي.
          </p>
        </div>
      </section>

      {/* Metrics Grid: 3 MD3 Styled Elevated Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metricsGrid.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              href={card.href}
              className={`group relative overflow-hidden rounded-3xl bg-surface border ${card.borderColor} p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-4 rounded-2xl ${card.color} shadow-sm`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-surface-variant/40 flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition-all">
                    <ArrowUpLeft className="w-5 h-5" />
                  </div>
                </div>

                <h2 className="text-xl font-bold text-on-surface group-hover:text-primary transition-colors">
                  {card.title}
                </h2>
                <p className="text-xs font-semibold text-primary mt-1">
                  {card.count}
                </p>
                <p className="text-xs text-on-surface-variant/80 mt-3 leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-outline/10 flex items-center justify-between text-xs font-medium text-on-surface-variant group-hover:text-primary">
                <span>الانتقال للإدارة</span>
                <ArrowUpLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              </div>
            </Link>
          );
        })}
      </section>

      {/* Quick Status Panel */}
      <section className="p-6 rounded-3xl bg-surface border border-outline/15 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <span>ملخص النظام السريع</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between">
            <span className="text-on-surface-variant">حالة الاتصال</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">متصل (Firebase Firestore)</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between">
            <span className="text-on-surface-variant">تشفير المفاتيح</span>
            <span className="font-semibold text-primary">BAC27-SHA256</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between">
            <span className="text-on-surface-variant">إدارة الأفواج</span>
            <span className="font-semibold text-on-surface">نشط</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline/10 flex items-center justify-between">
            <span className="text-on-surface-variant">نظام التشفير</span>
            <span className="font-semibold text-primary">MD3 Auth v2</span>
          </div>
        </div>
      </section>
    </div>
  );
}

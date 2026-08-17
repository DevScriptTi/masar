"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Bell,
  CheckCheck,
  Award,
  Sparkles,
  Clock,
  ExternalLink,
  ChevronLeft,
  X,
} from "lucide-react";

export interface NotificationItem {
  id: string;
  userId: string;
  studentId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt?: any;
  relatedActivityId?: string;
}

export function NotificationBell() {
  const { user, userData } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real-time Bulletproof Firestore Listener for student's notifications
  useEffect(() => {
    if (!user?.uid && !userData?.uid) {
      return;
    }

    // Extract all possible student ID variants
    const possibleIds = new Set<string>();
    if (user?.uid) possibleIds.add(String(user.uid).trim());
    if (userData?.uid) possibleIds.add(String(userData.uid).trim());
    if (userData?.id) possibleIds.add(String(userData.id).trim());

    const activeIds = Array.from(possibleIds).filter(Boolean);
    if (activeIds.length === 0) return;

    const notifsRef = collection(db, "notifications");

    // Bulletproof real-time listener without query restrictions to avoid missing index/field errors
    const unsubscribe = onSnapshot(
      notifsRef,
      (snapshot) => {
        const allNotifs: NotificationItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<NotificationItem, "id">),
        }));

        // Client-side filtering for current student's notifications across all possible ID fields
        const studentNotifs = allNotifs.filter((n: any) => {
          const docUser = String(n.userId || n.studentId || n.uid || n.targetId || "").trim();
          return activeIds.some((id) => id === docUser || id.toLowerCase() === docUser.toLowerCase());
        });

        // Client-side sorting by createdAt desc
        studentNotifs.sort((a, b) => {
          const timeA = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : a.createdAt?.seconds
              ? a.createdAt.seconds * 1000
              : 0;
          const timeB = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : b.createdAt?.seconds
              ? b.createdAt.seconds * 1000
              : 0;
          return timeB - timeA;
        });

        setNotifications(studentNotifs);
      },
      (error) => {
        console.error("Real-time notifications listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [user, userData]);

  // Click Outside & Esc Key Listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (notif: NotificationItem) => {
    if (notif.isRead) return;

    try {
      const docRef = doc(db, "notifications", notif.id);
      await updateDoc(docRef, { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        const ref = doc(db, "notifications", n.id);
        batch.update(ref, { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  return (
    <div className="relative inline-block text-right" ref={dropdownRef} dir="rtl">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="الإشعارات والتنبيهات"
        className="relative w-10 h-10 rounded-2xl bg-surface-variant/40 hover:bg-surface-variant/80 border border-outline/10 text-on-surface flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <Bell className="w-5 h-5 text-on-surface-variant" />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-error text-on-error font-extrabold text-[10px] flex items-center justify-center shadow-xs border-2 border-surface animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* MD3 Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-3 w-80 sm:w-96 rounded-3xl bg-surface border border-outline/15 shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Dropdown Header */}
          <div className="p-4 border-b border-outline/10 flex items-center justify-between bg-surface-variant/20">
            <div className="flex items-center gap-2 text-xs font-extrabold text-on-surface">
              <Award className="w-4 h-4 text-primary" />
              <span>الإشعارات والتنبيهات</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-error-container text-error">
                  {unreadCount} جديدة
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تعليم الكل كمقروء</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-outline/10">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-on-surface-variant">
                <Sparkles className="w-6 h-6 text-outline/50 mx-auto" />
                <p className="text-xs font-semibold">لا توجد إشعارات حالياً.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const formattedDate = notif.createdAt?.seconds
                  ? new Date(notif.createdAt.seconds * 1000).toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "الآن";

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif)}
                    className={`p-4 transition-colors flex items-start gap-3 cursor-pointer ${!notif.isRead
                      ? "bg-primary/5 hover:bg-primary/10 font-bold"
                      : "hover:bg-surface-variant/20 text-on-surface-variant/80"
                      }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${!notif.isRead
                        ? "bg-primary text-on-primary"
                        : "bg-surface-variant/60 text-on-surface-variant"
                        }`}
                    >
                      <Award className="w-4 h-4" />
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-extrabold text-on-surface">{notif.title}</h4>
                        <span className="text-[10px] text-on-surface-variant/60 font-medium">
                          {formattedDate}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { toast } from "@/src/components/ui/use-toast";
import {
  Bell,
  CheckCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Info,
  Trash2,
  X,
  ExternalLink,
} from "lucide-react";

export interface NotificationItem {
  id: string;
  userId: string;
  studentId?: string;
  title: string;
  message: string;
  type?: "success" | "error" | "info" | "announcement";
  href?: string;
  isRead: boolean;
  createdAt?: any;
}

/**
 * Format timestamp to relative time in Arabic (e.g. "منذ 5 دقائق", "منذ دقيقتين")
 */
function formatRelativeTimeArabic(createdAt: any): string {
  if (!createdAt) return "الآن";

  let millis = 0;
  if (typeof createdAt?.toMillis === "function") {
    millis = createdAt.toMillis();
  } else if (createdAt?.seconds) {
    millis = createdAt.seconds * 1000;
  } else if (typeof createdAt === "number") {
    millis = createdAt;
  } else {
    return "الآن";
  }

  const diffSeconds = Math.floor((Date.now() - millis) / 1000);
  if (diffSeconds < 45) return "الآن";

  const diffMins = Math.floor(diffSeconds / 60);
  if (diffMins === 1) return "منذ دقيقة";
  if (diffMins === 2) return "منذ دقيقتين";
  if (diffMins >= 3 && diffMins <= 10) return `منذ ${diffMins} دقائق`;
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "منذ ساعة";
  if (diffHours === 2) return "منذ ساعتين";
  if (diffHours >= 3 && diffHours <= 10) return `منذ ${diffHours} ساعات`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "منذ يوم";
  if (diffDays === 2) return "منذ يومين";
  if (diffDays >= 3 && diffDays <= 10) return `منذ ${diffDays} أيام`;
  return `منذ ${diffDays} يوم`;
}

export function NotificationBell() {
  const { user, userData } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Live Toast notification state for new incoming alerts
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const isInitialLoad = useRef(true);

  // Real-time Bulletproof Firestore Listener for notifications
  useEffect(() => {
    if (!user?.uid && !userData?.uid) {
      return;
    }

    // Extract all possible user ID variants
    const possibleIds = new Set<string>();
    if (user?.uid) possibleIds.add(String(user.uid).trim());
    if (userData?.uid) possibleIds.add(String(userData.uid).trim());
    if (userData?.id) possibleIds.add(String(userData.id).trim());

    const activeIds = Array.from(possibleIds).filter(Boolean);
    if (activeIds.length === 0) return;

    const notifsRef = collection(db, "notifications");

    // Real-time listener with live docChanges detection for Toasts
    const unsubscribe = onSnapshot(
      notifsRef,
      (snapshot) => {
        // Detect NEW incoming notifications using docChanges()
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        } else {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = { id: change.doc.id, ...change.doc.data() } as NotificationItem;
              const docUser = String(data.userId || data.studentId || "").trim();
              const matchesUser = activeIds.some(
                (id) => id === docUser || id.toLowerCase() === docUser.toLowerCase()
              );

              // Trigger global Toast for unread incoming notification
              if (matchesUser && !data.isRead) {
                toast({
                  title: data.title,
                  description: data.message,
                  variant:
                    data.type === "error"
                      ? "destructive"
                      : data.type === "success"
                      ? "success"
                      : "default",
                  href: data.href,
                });
              }
            }
          });
        }

        const allNotifs: NotificationItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<NotificationItem, "id">),
        }));

        // Filter for recipient's notifications across all possible ID fields
        const userNotifs = allNotifs.filter((n: any) => {
          const docUser = String(n.userId || n.studentId || n.uid || n.targetId || "").trim();
          return activeIds.some((id) => id === docUser || id.toLowerCase() === docUser.toLowerCase());
        });

        // Client-side sorting by createdAt desc
        userNotifs.sort((a, b) => {
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

        // Limit to 10 most recent notifications
        setNotifications(userNotifs.slice(0, 10));
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

  // Handle clicking notification item (Mark as read & Route to href)
  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      try {
        await updateDoc(doc(db, "notifications", notif.id), { isRead: true });
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }

    setIsOpen(false);

    if (notif.href) {
      router.push(notif.href);
    }
  };

  // Individual notification deletion
  const handleDeleteNotification = async (e: React.MouseEvent, notif: NotificationItem) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "notifications", notif.id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Bulk notifications deletion ("مسح الكل")
  const handleClearAllNotifications = async () => {
    if (notifications.length === 0) return;

    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        batch.delete(doc(db, "notifications", n.id));
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  // Helper to render type-specific icon & background
  const renderNotifIcon = (type?: string, isRead?: boolean) => {
    switch (type) {
      case "success":
        return (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${!isRead ? "bg-emerald-500 text-white shadow-xs" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"}`}>
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case "error":
        return (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${!isRead ? "bg-error text-on-error shadow-xs" : "bg-error/15 text-error"}`}>
            <AlertCircle className="w-4 h-4" />
          </div>
        );
      case "announcement":
        return (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${!isRead ? "bg-secondary text-on-secondary shadow-xs" : "bg-secondary/15 text-secondary"}`}>
            <Sparkles className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${!isRead ? "bg-primary text-on-primary shadow-xs" : "bg-surface-variant/60 text-on-surface-variant"}`}>
            <Info className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <>
      <div className="relative inline-block text-right" ref={dropdownRef} dir="rtl">
        {/* Bell Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="الإشعارات والتنبيهات"
          className="relative w-10 h-10 rounded-2xl bg-surface-variant/40 hover:bg-surface-variant/80 border border-outline/10 text-on-surface flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 active:scale-95 cursor-pointer"
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
            <div className="p-4 border-b border-outline/10 flex items-center justify-between bg-surface-variant/20 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-on-surface">
                <Bell className="w-4 h-4 text-primary" />
                <span>الإشعارات والتنبيهات</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-error/15 text-error">
                    {unreadCount} جديدة
                  </span>
                )}
              </div>

              {/* Action Buttons: Mark all read & Clear all */}
              <div className="flex items-center gap-2 text-[11px] font-bold">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-primary hover:underline flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>تأكيد القراءة</span>
                  </button>
                )}

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllNotifications}
                    className="text-error hover:underline flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>مسح الكل</span>
                  </button>
                )}
              </div>
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
                  const relativeTimeStr = formatRelativeTimeArabic(notif.createdAt);

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`group relative p-4 transition-colors flex items-start gap-3 cursor-pointer ${
                        !notif.isRead
                          ? "bg-primary/5 hover:bg-primary/10 font-bold"
                          : "hover:bg-surface-variant/20 text-on-surface-variant/80"
                      }`}
                    >
                      {renderNotifIcon(notif.type, notif.isRead)}

                      <div className="flex-1 space-y-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-extrabold text-on-surface truncate">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-on-surface-variant/60 font-medium shrink-0">
                            {relativeTimeStr}
                          </span>
                        </div>

                        <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                          {notif.message}
                        </p>

                        {/* Optional Action Link Badge */}
                        {notif.href && (
                          <div className="pt-1 flex items-center gap-1 text-[11px] font-extrabold text-primary group-hover:underline">
                            <span>الانتقال فوراً</span>
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      {/* Individual Delete Button on Hover */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotification(e, notif)}
                        title="حذف الإشعار"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-on-surface-variant/60 hover:text-error hover:bg-error-container/30 transition-all shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

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

      {/* Floating Live Toast Notification Banner overlay for NEW incoming alerts */}
      {activeToast && (
        <div
          className="fixed bottom-5 left-5 z-[999] max-w-sm w-full bg-surface border border-outline/20 rounded-3xl p-4 shadow-2xl animate-scaleUp flex items-start gap-3 border-r-4 border-r-primary"
          dir="rtl"
        >
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0 mt-0.5">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>

          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black text-on-surface">{activeToast.title}</h4>
              <button
                type="button"
                onClick={() => setActiveToast(null)}
                className="p-1 rounded-lg text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              {activeToast.message}
            </p>

            {activeToast.href && (
              <button
                type="button"
                onClick={() => {
                  handleNotificationClick(activeToast);
                  setActiveToast(null);
                }}
                className="text-[11px] font-extrabold text-primary hover:underline flex items-center gap-1 pt-1 cursor-pointer"
              >
                <span>انتقال الآن</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default NotificationBell;

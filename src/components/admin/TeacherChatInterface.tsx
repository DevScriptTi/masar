"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import {
  useConversations,
  useMessages,
  sendMessage,
  uploadChatAttachment,
  markConversationAsRead,
  ConversationDoc,
  MessageDoc,
} from "@/src/hooks/useChat";
import { db } from "@/lib/firebase/config";
import { MathScratchpad } from "@/src/components/student/MathScratchpad";
import { MathText } from "@/src/components/admin/activities/StudentPreview";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  X,
  Check,
  CheckCheck,
  Search,
  User,
  GraduationCap,
  MessageSquare,
  Clock,
  ChevronRight,
  MoreVertical,
  AlertCircle,
  FileText,
  Download,
  Sparkles,
  ArrowRight,
  Filter,
  Users,
  BookOpen,
  Eye,
  Eye as EyeIcon,
  Calculator,
  Loader2,
} from "lucide-react";

export function TeacherChatInterface() {
  const { user, userData } = useAuth();
  const teacherUid = user?.uid || "";
  const teacherName = userData?.fullName || userData?.displayName || "الأستاذ المشرف";

  // 1. Real-time Conversations Hook from Firestore
  const { conversations: liveConversations, loading: isConvosLoading } = useConversations(
    teacherUid,
    "teacher"
  );

  // Effective Conversations State (Strictly Dynamic)
  const [conversationsList, setConversationsList] = useState<ConversationDoc[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationDoc | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "unread">("all");

  // Math Scratchpad State
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);

  // Sync live conversations from hook
  useEffect(() => {
    if (liveConversations) {
      setConversationsList(liveConversations);
      if (activeConversation) {
        // Keep active conversation reference in sync with latest document updates
        const updatedActive = liveConversations.find((c) => c.id === activeConversation.id);
        if (updatedActive) {
          setActiveConversation(updatedActive);
        }
      }
    }
  }, [liveConversations, activeConversation?.id]);

  // 2. Real-time Messages Hook
  const activeConvoId = activeConversation?.id || null;
  const { messages: liveMessages } = useMessages(activeConvoId);

  // Messages State
  const [messagesList, setMessagesList] = useState<MessageDoc[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState<{
    file: File | null;
    previewUrl: string;
    type: "image" | "file";
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  // References for Auto-Scroll & Focus
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync live messages from hook
  useEffect(() => {
    if (liveMessages) {
      setMessagesList(liveMessages);
    } else {
      setMessagesList([]);
    }
    // Mark as read for teacher
    if (activeConvoId) {
      markConversationAsRead(activeConvoId, "teacher");
    }
  }, [liveMessages, activeConvoId]);

  // Filtered Conversations
  const filteredConversations = conversationsList.filter((conv) => {
    const matchesSearch =
      conv.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.groupName && conv.groupName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.courseTitle && conv.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterType === "unread") {
      return matchesSearch && ((conv.unreadTeacherCount || 0) > 0 || (conv.unreadCount || 0) > 0);
    }
    return matchesSearch;
  });

  // Auto-Scroll Engine
  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messagesList.length, activeConversation?.id]);

  // Insert Math Snippet at cursor
  const handleInsertMathSnippet = (snippet: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = inputText;
      const newText = text.substring(0, start) + snippet + text.substring(end);
      setInputText(newText);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd =
            start + snippet.length;
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      setInputText((prev) => (prev ? `${prev} ${snippet}` : snippet));
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const previewUrl = URL.createObjectURL(file);

    setSelectedAttachment({
      file,
      previewUrl,
      type: isImage ? "image" : "file",
    });

    e.target.value = "";
  };

  const removeAttachment = () => {
    if (selectedAttachment?.previewUrl) {
      URL.revokeObjectURL(selectedAttachment.previewUrl);
    }
    setSelectedAttachment(null);
  };

  // Dispatch message via Hook Action
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedAttachment) || !activeConversation || isSending) return;

    setIsSending(true);

    const textToSend = inputText.trim();
    const attachmentToSend = selectedAttachment;
    const convId = activeConversation.id;
    const studentId = activeConversation.studentId;

    try {
      let publicUrl: string | null = null;
      let fileName: string | null = null;

      // 1. Upload to Cloudinary if a file exists
      if (attachmentToSend?.file) {
        const formData = new FormData();
        formData.append("file", attachmentToSend.file);
        formData.append(
          "upload_preset",
          process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "student_homework"
        );

        const cloudName =
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "gavyiksx";

        const isPDF =
          attachmentToSend.file.type === "application/pdf" ||
          attachmentToSend.file.name.toLowerCase().endsWith(".pdf");
        const resourceType = isPDF ? "raw" : "image";

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData?.error?.message || "فشل الرفع إلى Cloudinary");
        }

        const data = await res.json();
        publicUrl = data.secure_url;
        fileName = attachmentToSend.file.name;
      }

      // 2. Save Message to Firestore
      await sendMessage({
        conversationId: convId,
        senderId: teacherUid,
        senderName: teacherName,
        senderRole: "teacher",
        receiverId: studentId,
        text: textToSend,
        attachmentUrl: publicUrl,
        attachmentType:
          attachmentToSend?.type ||
          (attachmentToSend?.file?.type.startsWith("image/") ? "image" : "file"),
        attachmentName: fileName,
      });

      // 3. Clear State on Success
      setInputText("");
      setSelectedAttachment(null);

      // Update conversation in list
      setConversationsList((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessage: textToSend || (attachmentToSend ? "📎 مرفق مرسل" : ""),
                lastSenderId: teacherUid,
                unreadTeacherCount: 0,
              }
            : c
        )
      );
    } catch (error: any) {
      console.error("Upload/Send Error:", error);
      alert("حدث خطأ أثناء إرسال المرفق. تأكد من إعدادات Cloudinary.");
    } finally {
      setIsSending(false);
      scrollToBottom(true);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimeArabic = (createdAt: any) => {
    try {
      let d: Date;
      if (createdAt?.toDate) {
        d = createdAt.toDate();
      } else if (createdAt?.seconds) {
        d = new Date(createdAt.seconds * 1000);
      } else if (typeof createdAt === "string" || typeof createdAt === "number") {
        d = new Date(createdAt);
      } else {
        return "الآن";
      }
      return d.toLocaleTimeString("ar-DZ", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "الآن";
    }
  };

  return (
    <div
      className="h-[calc(100vh-6rem)] w-full flex flex-col md:flex-row bg-background border border-outline/15 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden text-on-background selection:bg-primary/20"
      dir="rtl"
    >
      {/* ==================================================================== */}
      {/* RIGHT PANE: INBOX / CONVERSATIONS LIST (SIDEBAR)                    */}
      {/* ==================================================================== */}
      <aside
        className={`w-full md:w-80 lg:w-96 shrink-0 border-l border-outline/15 bg-surface/60 backdrop-blur-md flex flex-col transition-all duration-300 ${
          mobileView === "chat" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Inbox Header & Search */}
        <div className="p-4 border-b border-outline/10 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-on-surface">صندوق الرسائل</h2>
                <p className="text-[11px] text-on-surface-variant font-medium">
                  استفسارات الطلاب المباشرة
                </p>
              </div>
            </div>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {conversationsList.length} محادثة
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث عن طالب أو فوج أو رسالة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-surface-variant/30 border border-outline/15 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === "all"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant"
              }`}
            >
              جميع المحادثات
            </button>
            <button
              type="button"
              onClick={() => setFilterType("unread")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === "unread"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant"
              }`}
            >
              <span>غير مقروءة</span>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </button>
          </div>
        </div>

        {/* Conversations Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline/5 p-2 space-y-1 scrollbar-thin">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <User className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
              <p className="text-xs font-bold text-on-surface-variant">لا توجد محادثات مطابقة</p>
              <p className="text-[11px] text-on-surface-variant/70">
                لم يتم العثور على رسائل بناءً على معايير البحث
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConversation?.id === conv.id;
              const hasUnread = (conv.unreadTeacherCount || 0) > 0 || (conv.unreadCount || 0) > 0;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    setActiveConversation(conv);
                    setMobileView("chat");
                  }}
                  className={`w-full text-right p-3 rounded-2xl transition-all duration-200 flex items-start gap-3 relative cursor-pointer group ${
                    isActive
                      ? "bg-primary/10 border border-primary/20 shadow-xs"
                      : "hover:bg-surface-variant/40 border border-transparent"
                  }`}
                >
                  {/* Student Avatar with Online Badge */}
                  <div className="relative shrink-0 mt-0.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-xs transition-colors ${
                        isActive
                          ? "bg-primary text-on-primary shadow-xs"
                          : "bg-surface-variant text-on-surface-variant group-hover:bg-primary/20 group-hover:text-primary"
                      }`}
                    >
                      {conv.studentAvatar ? (
                        <Image
                          src={conv.studentAvatar}
                          alt={conv.studentName || "اسم التلميذ"}
                          width={44}
                          height={44}
                          className="w-full h-full rounded-2xl object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div>

                    {conv.isOnline && (
                      <span
                        className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-surface ring-1 ring-emerald-400"
                        title="متصل الآن"
                      />
                    )}
                  </div>

                  {/* Conversation Snippet & Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3
                        className={`text-xs font-extrabold truncate ${
                          isActive ? "text-primary" : "text-on-surface"
                        }`}
                      >
                        {conv.studentName}
                      </h3>
                      {conv.lastMessageTime && (
                        <span className="text-[10px] text-on-surface-variant/70 shrink-0 font-medium">
                          {conv.lastMessageTime}
                        </span>
                      )}
                    </div>

                    {/* Group / Course Badge */}
                    <div className="flex items-center gap-1.5 mb-1 truncate">
                      <span className="text-[10px] font-bold text-primary/80 truncate">
                        {conv.groupName || conv.courseTitle || "تلميذ مسجل"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-on-surface-variant/80 truncate font-medium">
                        {conv.lastMessage || "انقر لفتح المحادثة..."}
                      </p>

                      {hasUnread && (
                        <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary text-[10px] font-black flex items-center justify-center shadow-xs">
                          {conv.unreadTeacherCount || conv.unreadCount || 1}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* LEFT PANE: THE CHAT ROOM (MAIN AREA)                                 */}
      {/* ==================================================================== */}
      <main
        className={`flex-1 flex flex-col h-full bg-surface/30 min-w-0 relative ${
          mobileView === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        {!activeConversation ? (
          /* Null State / Empty State when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-background h-full text-muted-foreground">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-base font-extrabold text-on-surface">
                الرجاء اختيار محادثة من صندوق الرسائل للبدء
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                حدد أحد استفسارات الطلاب من القائمة الجانبية لقراءة تفاصيل السؤال والرد عليه
                مباشرة.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 1. CHAT ROOM HEADER */}
            <header className="px-4 sm:px-6 py-3.5 border-b border-outline/10 bg-surface/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile Back to Inbox */}
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="md:hidden p-2 -mr-2 rounded-xl text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-colors cursor-pointer"
                  aria-label="الرجوع إلى صندوق الرسائل"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Active Student Avatar */}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20">
                    {activeConversation.studentAvatar ? (
                      <Image
                        src={activeConversation.studentAvatar}
                        alt={activeConversation.studentName || "اسم التلميذ"}
                        width={40}
                        height={40}
                        className="w-full h-full rounded-2xl object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  {activeConversation.isOnline && (
                    <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-on-surface truncate">
                      {activeConversation.studentName || "اسم التلميذ"}
                    </h3>
                    <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary/10 text-secondary border border-secondary/20">
                      {activeConversation.groupName || activeConversation.courseTitle || "المجموعة"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-on-surface-variant font-medium truncate max-w-[200px] sm:max-w-xs">
                      {activeConversation.courseTitle || activeConversation.groupName || "المادة الأكاديمية"}
                    </span>
                    <span className="text-outline/40">•</span>
                    {activeConversation.isOnline ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        متصل الآن
                      </span>
                    ) : (
                      <span className="text-on-surface-variant/60 font-medium shrink-0">
                        {activeConversation.lastSeen || "غير متصل"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Math Scratchpad + Pedagogical Badge */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScratchpadOpen(true)}
                  className="p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-outline/10 bg-surface-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/30 cursor-pointer"
                  title="فتح مسودة كتابة المعادلات الرياضية"
                >
                  <Calculator className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">لوحة المعادلات</span>
                </button>
                <span className="hidden lg:flex items-center gap-1.5 text-[11px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تأطير بيداغوجي مباشر</span>
                </span>
              </div>
            </header>

            {/* 2. MESSAGES THREAD */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scroll-smooth"
            >
              {/* Context Banner */}
              <div className="max-w-md mx-auto p-3.5 rounded-2xl bg-surface border border-outline/10 text-center space-y-1 shadow-2xs">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">
                  <GraduationCap className="w-4 h-4" />
                  <span>مساحة الرد والتوجيه الأكاديمي</span>
                </div>
                <p className="text-[11px] text-on-surface-variant/80 leading-relaxed font-medium">
                  يمكنك مراجعة حلول التلميذ المرفقة وتزويده بالتصحيحات والتوجيهات المنهجية خطوة بخطوة.
                </p>
              </div>

              {/* Date Separator Pill */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-surface-variant/40 text-on-surface-variant/80 text-[10px] font-bold border border-outline/10">
                  سجل المحادثة مع {activeConversation.studentName || "اسم التلميذ"}
                </span>
              </div>

              {/* Messages Rendering */}
              {messagesList.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-on-surface">لا توجد رسائل سابقة بعد</p>
                  <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
                    اكتب ردك أو معادلتك الرياضية لتوجيه التلميذ {activeConversation.studentName || "اسم التلميذ"}.
                  </p>
                </div>
              ) : (
                messagesList.map((msg) => {
                  const isTeacher = msg.senderRole === "teacher";

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2.5 ${
                        isTeacher ? "justify-start" : "justify-end"
                      } animate-fadeIn`}
                    >
                      {/* Student Mini Avatar on student side */}
                      {!isTeacher && (
                        <div className="w-7 h-7 rounded-xl bg-surface-variant text-on-surface-variant flex items-center justify-center text-[10px] font-bold shrink-0 mb-1 border border-outline/15">
                          <User className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}

                      {/* Message Bubble Container */}
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] md:max-w-[65%] space-y-1.5 ${
                          isTeacher ? "items-start" : "items-end"
                        }`}
                      >
                        <div
                          className={`p-3.5 sm:p-4 rounded-3xl text-xs sm:text-sm leading-relaxed transition-all shadow-2xs ${
                            isTeacher
                              ? "bg-primary text-on-primary rounded-br-xs"
                              : "bg-surface text-on-surface border border-outline/15 rounded-bl-xs"
                          }`}
                        >
                          {/* Text Content with KaTeX Math Rendering */}
                          {msg.text && (
                            <div className="whitespace-pre-wrap break-words font-medium leading-relaxed">
                              <MathText content={msg.text} />
                            </div>
                          )}

                          {/* Image Attachment Preview */}
                          {msg.attachmentUrl && msg.attachmentType === "image" && (
                            <div className="mt-2.5 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 group/img relative cursor-pointer">
                              <Image
                                src={msg.attachmentUrl}
                                alt="حل أو استفسار التلميذ"
                                width={400}
                                height={300}
                                onClick={() => setPreviewImageModal(msg.attachmentUrl!)}
                                className="w-full max-h-60 object-cover hover:scale-102 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                <span>انقر لتكبير صورة الحل</span>
                              </div>
                            </div>
                          )}

                          {/* File Attachment Pill */}
                          {msg.attachmentUrl && msg.attachmentType === "file" && (
                            <div
                              className={`mt-2.5 p-2.5 rounded-2xl flex items-center justify-between gap-3 ${
                                isTeacher
                                  ? "bg-white/15 text-white"
                                  : "bg-surface-variant/50 text-on-surface"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-bold truncate">
                                  {msg.attachmentName || "مستند مرفق"}
                                </span>
                              </div>
                              <a
                                href={msg.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20 transition-colors"
                                title="تحميل الملف"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Timestamp & Status Metadata */}
                        <div
                          className={`flex items-center gap-1.5 px-2 text-[10px] text-on-surface-variant/70 font-medium ${
                            isTeacher ? "justify-start" : "justify-end"
                          }`}
                        >
                          <span>{formatTimeArabic(msg.createdAt)}</span>
                          {isTeacher && (
                            <span>
                              {msg.isRead ? (
                                <CheckCheck className="w-3.5 h-3.5 text-primary stroke-[2.5]" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-on-surface-variant/60" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* 3. INPUT BAR (STICKY BOTTOM) */}
            <div className="sticky bottom-0 p-3 sm:p-4 bg-surface/95 backdrop-blur-md border-t border-outline/15 space-y-2.5 shrink-0">
              {/* Live LaTeX/Markdown Preview */}
              {inputText.trim().length > 0 && (
                <div className="mb-2 p-3 bg-card/60 dark:bg-surface-variant/40 backdrop-blur-sm border border-border/50 dark:border-outline/20 rounded-xl max-h-32 overflow-y-auto text-sm animate-in fade-in slide-in-from-bottom-2 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30 dark:border-outline/10">
                    <EyeIcon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-primary">معاينة الرسالة</span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-right prose-p:m-0 prose-p:leading-relaxed text-on-surface">
                    <ReactMarkdown
                      rehypePlugins={[rehypeKatex]}
                      remarkPlugins={[remarkMath]}
                    >
                      {inputText}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Attachment Preview Box */}
              {selectedAttachment && (
                <div className="p-2.5 rounded-2xl bg-surface-variant/40 border border-outline/15 flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {selectedAttachment.type === "image" ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-outline/20 relative shrink-0">
                        <Image
                          src={selectedAttachment.previewUrl}
                          alt="معاينة"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="truncate">
                      <span className="text-xs font-bold text-on-surface block truncate">
                        {selectedAttachment.file?.name || "صورة مرفقة"}
                      </span>
                      <span className="text-[10px] text-on-surface-variant block">
                        جاهزة للإرسال للتلميذ
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="p-1.5 text-error hover:bg-error/10 rounded-xl transition-colors cursor-pointer"
                    aria-label="إلغاء المرفق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Form Input Controls */}
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                />

                {/* File Attachment Trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 sm:p-3 rounded-2xl bg-surface-variant/40 hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-all cursor-pointer border border-outline/10 shrink-0"
                  title="إرفاق صورة توضيحية أو تصحيح"
                  aria-label="إرفاق ملف"
                >
                  <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Math Scratchpad Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsScratchpadOpen(true)}
                  className="p-2.5 sm:p-3 rounded-2xl bg-surface-variant/40 hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-all cursor-pointer border border-outline/10 shrink-0"
                  title="فتح مسودة ابتكار المعادلات الرياضية"
                  aria-label="إضافة معادلة رياضية"
                >
                  <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Message Text Input */}
                <div className="flex-1 relative bg-surface-variant/30 rounded-2xl border border-outline/15 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب ردك وتوجيهك للتلميذ هنا... (اضغط + لإضافة معادلة)"
                    className="w-full px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm bg-transparent text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none resize-none max-h-32 min-h-[42px] leading-relaxed"
                  />
                </div>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={(!inputText.trim() && !selectedAttachment) || isSending}
                  className="h-11 sm:h-12 px-4 sm:px-5 rounded-2xl bg-primary text-on-primary font-bold text-xs sm:text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  aria-label="إرسال الرد"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 -scale-x-100" />
                      <span className="hidden sm:inline">إرسال الرد</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </>
        )}
      </main>

      {/* Math Scratchpad Modal */}
      <MathScratchpad
        isOpen={isScratchpadOpen}
        onClose={() => setIsScratchpadOpen(false)}
        onApply={(latex) => handleInsertMathSnippet(`$ ${latex} $`)}
        title="مسودة ابتكار وتوجيه المعادلات الرياضية"
      />

      {/* Fullscreen Image Preview Modal */}
      {previewImageModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative max-w-4xl max-h-[90vh] bg-surface rounded-3xl overflow-hidden border border-outline/20 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-outline/10 bg-surface-variant/20">
              <span className="text-xs font-bold text-on-surface">معاينة صورة الحل المرفق</span>
              <button
                type="button"
                onClick={() => setPreviewImageModal(null)}
                className="p-1.5 rounded-xl bg-error/10 text-error hover:bg-error hover:text-on-error transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center">
              <Image
                src={previewImageModal}
                alt="معاينة كاملة"
                width={800}
                height={600}
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherChatInterface;

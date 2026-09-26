"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import {
  useConversations,
  useMessages,
  sendMessage,
  markConversationAsRead,
  ConversationDoc,
  MessageDoc,
} from "@/src/hooks/useChat";
import { MathText } from "@/src/components/admin/activities/StudentPreview";
import { MathScratchpad } from "@/src/components/student/MathScratchpad";
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
  UserPlus,
  Plus,
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
  Calculator,
  Loader2,
  BookOpen,
  Eye,
  Eye as EyeIcon,
} from "lucide-react";

export type Teacher = ConversationDoc;

export interface DirectChatInterfaceProps {
  defaultConversationId?: string;
  onSendMessage?: (message: Omit<MessageDoc, "id">) => Promise<void>;
}

export function DirectChatInterface({
  defaultConversationId,
  onSendMessage,
}: DirectChatInterfaceProps) {
  const { user, userData } = useAuth();
  const studentUid = user?.uid || "";
  const studentName = userData?.displayName || userData?.fullName || "التلميذ";

  // 1. Real-time Conversations Hook from Firestore
  const { conversations: liveConversations, loading: isConvosLoading } = useConversations(
    studentUid,
    "student"
  );

  // Dynamic Conversations State
  const [conversationsList, setConversationsList] = useState<ConversationDoc[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationDoc | null>(null);

  // Dynamic Teachers List fetched from Firestore (NO MOCK DATA)
  const [teachersList, setTeachersList] = useState<
    Array<{
      id: string;
      name: string;
      avatar?: string;
      subject?: string;
      courseTitle?: string;
      groupName?: string;
      subjectName?: string;
    }>
  >([]);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  // Math Scratchpad State
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);

  // 2. Real-time Messages Hook
  const activeConvoId = activeConversation?.id || null;
  const { messages: liveMessages } = useMessages(activeConvoId);

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
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

  // Fetch enrolled teachers strictly based on student enrollments (Privacy & Relational Filtering)
  useEffect(() => {
    if (!userData && !user) return;

    const fetchEnrolledTeachers = async () => {
      try {
        // 1. Get Group IDs from student's enrollments object/array and user profile
        const studentRawIdentifiers = new Set<string>();

        if (userData?.groupId) studentRawIdentifiers.add(String(userData.groupId));
        if (userData?.cohortId) studentRawIdentifiers.add(String(userData.cohortId));
        if (userData?.group) studentRawIdentifiers.add(String(userData.group));
        if (userData?.cohort) studentRawIdentifiers.add(String(userData.cohort));

        if (Array.isArray(userData?.groupIds)) {
          userData.groupIds.forEach((id: any) => id && studentRawIdentifiers.add(String(id)));
        }
        if (Array.isArray(userData?.groups)) {
          userData.groups.forEach((g: any) => g && studentRawIdentifiers.add(String(g)));
        }

        if (userData?.enrollments) {
          if (typeof userData.enrollments === "object" && !Array.isArray(userData.enrollments)) {
            Object.keys(userData.enrollments).forEach((key) => key && studentRawIdentifiers.add(String(key)));
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

        const groupIds = Array.from(studentRawIdentifiers).map((k) => k.trim()).filter(Boolean);

        if (groupIds.length === 0) {
          setTeachersList([]);
          return;
        }

        // 2. Fetch those specific groups to extract valid teacherIds
        const validTeacherIds = new Set<string>();
        const teacherMetaMap = new Map<string, { subject?: string; courseTitle?: string; groupName?: string }>();

        for (const groupId of groupIds) {
          try {
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (groupDoc.exists()) {
              const gData = groupDoc.data();
              if (gData.teacherId) {
                const tId = String(gData.teacherId).trim();
                validTeacherIds.add(tId);
                teacherMetaMap.set(tId, {
                  groupName: gData.name || "الفوج الأكاديمي",
                  subject: gData.subject || gData.name || "المادة الأكاديمية",
                  courseTitle: gData.courseTitle || gData.name || "دورة تعليمية",
                });
              }
            }
          } catch (err) {
            console.warn(`[DirectChatInterface] Error reading group ${groupId}:`, err);
          }
        }

        // Also check if any courses are authorized for these groups
        try {
          const coursesSnap = await getDocs(collection(db, "courses"));
          coursesSnap.docs.forEach((cDoc) => {
            const cData = cDoc.data();
            const courseGroupIds = Array.isArray(cData.groupIds) ? cData.groupIds.map(String) : [];
            const isAuthorized =
              courseGroupIds.length === 0 ||
              courseGroupIds.some((gId) => groupIds.includes(gId));

            if (isAuthorized && cData.teacherId) {
              const tId = String(cData.teacherId).trim();
              validTeacherIds.add(tId);
              if (!teacherMetaMap.has(tId)) {
                teacherMetaMap.set(tId, {
                  subject: cData.title || "المادة الأكاديمية",
                  courseTitle: cData.title || "دورة تعليمية",
                  groupName: "الفوج الأكاديمي",
                });
              }
            }
          });
        } catch (err) {
          console.warn("[DirectChatInterface] Error reading courses for teacher mapping:", err);
        }

        if (validTeacherIds.size === 0) {
          setTeachersList([]);
          return;
        }

        // 3. Fetch ONLY the specific teacher user documents
        const teachersData: any[] = [];
        for (const teacherId of Array.from(validTeacherIds)) {
          try {
            const teacherDoc = await getDoc(doc(db, "users", teacherId));
            if (teacherDoc.exists()) {
              const data = teacherDoc.data();
              const meta = teacherMetaMap.get(teacherId);
              teachersData.push({
                id: teacherDoc.id,
                name: data.fullName || data.displayName || data.name || "الأستاذ",
                avatar: data.avatar || data.photoURL || "",
                subject: meta?.subject || data.subject || "أستاذ المادة",
                courseTitle: meta?.courseTitle || "دورة تعليمية",
                groupName: meta?.groupName || "الفوج الأكاديمي",
                subjectName: meta?.subject || "المادة الأكاديمية",
                ...data,
              });
            }
          } catch (err) {
            console.warn(`[DirectChatInterface] Error fetching teacher user ${teacherId}:`, err);
          }
        }

        setTeachersList(teachersData);
      } catch (error) {
        console.error("[DirectChatInterface] Error fetching enrolled teachers:", error);
        setTeachersList([]);
      }
    };

    fetchEnrolledTeachers();
  }, [studentUid, userData, user]);

  // Sync live conversations strictly from Firestore
  useEffect(() => {
    if (liveConversations) {
      setConversationsList(liveConversations);
      if (activeConversation) {
        const updated = liveConversations.find(
          (c) => c.id === activeConversation.id || (c.teacherId && c.teacherId === activeConversation.teacherId)
        );
        if (updated) {
          setActiveConversation(updated);
        }
      } else if (defaultConversationId) {
        const defaultConvo = liveConversations.find((c) => c.id === defaultConversationId);
        if (defaultConvo) {
          setActiveConversation(defaultConvo);
        }
      }
    }
  }, [liveConversations, activeConversation?.id, activeConversation?.teacherId, defaultConversationId]);

  // Mark conversation as read on active conversation open
  useEffect(() => {
    if (activeConvoId && !activeConvoId.startsWith("conv_temp_")) {
      markConversationAsRead(activeConvoId, "student");
    }
  }, [liveMessages, activeConvoId]);

  // Filtered conversations list
  const filteredConversations = conversationsList.filter(
    (conv) =>
      conv.teacherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.courseTitle && conv.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.groupName && conv.groupName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Auto-Scroll Implementation
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
  }, [liveMessages.length, activeConversation?.id]);

  // Start chat with an available teacher
  const handleStartConversation = (teacher: {
    id: string;
    name: string;
    avatar?: string;
    subject?: string;
    courseTitle?: string;
    groupName?: string;
    subjectName?: string;
  }) => {
    const existing = conversationsList.find((c) => c.teacherId === teacher.id);
    if (existing) {
      setActiveConversation(existing);
    } else {
      setActiveConversation({
        id: `conv_temp_${studentUid}_${teacher.id}`,
        studentId: studentUid,
        studentName,
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherAvatar: teacher.avatar,
        courseTitle: teacher.courseTitle || teacher.subject || "دورة تعليمية",
        groupName: teacher.groupName || "الفوج الأكاديمي",
        subjectName: teacher.subjectName || teacher.subject || teacher.courseTitle || "المادة الأكاديمية",
        lastMessage: "",
        updatedAt: new Date(),
      });
    }
    setIsNewChatModalOpen(false);
    setMobileView("chat");
  };

  // Insert LaTeX Math Snippet into text input at cursor
  const handleInsertMathSnippet = (snippet: string) => {
    const formatted = snippet.startsWith("$") ? snippet : `$ ${snippet} $`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setInputText((prev) => (prev ? `${prev} ${formatted}` : formatted));
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const currentVal = textarea.value;

    const newVal = currentVal.substring(0, start) + formatted + currentVal.substring(end);
    setInputText(newVal);

    setTimeout(() => {
      textarea.focus();
      const nextPos = start + formatted.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 50);
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

  // Send Message Action
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedAttachment) || !activeConversation || isSending) return;

    setIsSending(true);

    const textToSend = inputText.trim();
    const attachmentToSend = selectedAttachment;
    const convId = activeConversation.id;
    const teacherId = activeConversation.teacherId;

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

      // 2. Save Message to Firestore (Auto-Initialize if missing)
      const sendResult = await sendMessage({
        conversationId: convId,
        senderId: studentUid,
        senderName: studentName,
        senderRole: "student",
        receiverId: teacherId,
        receiverName: activeConversation.teacherName,
        courseTitle: activeConversation.courseTitle,
        groupName: activeConversation.groupName,
        subjectName: activeConversation.subjectName,
        teacherAvatar: activeConversation.teacherAvatar,
        studentAvatar: userData?.avatar || userData?.photoURL || "",
        studentEmail: userData?.email || user?.email || "",
        text: textToSend,
        attachmentUrl: publicUrl,
        attachmentType:
          attachmentToSend?.type ||
          (attachmentToSend?.file?.type.startsWith("image/") ? "image" : "file"),
        attachmentName: fileName,
      });

      const effectiveId = sendResult?.conversationId || convId;
      if (effectiveId && effectiveId !== convId) {
        setActiveConversation((prev) => (prev ? { ...prev, id: effectiveId } : prev));
      }

      if (onSendMessage) {
        await onSendMessage({
          conversationId: effectiveId,
          senderId: studentUid,
          senderName: studentName,
          senderRole: "student",
          receiverId: teacherId,
          text: textToSend,
          attachmentUrl: publicUrl || undefined,
          attachmentType: attachmentToSend?.type,
          attachmentName: fileName || undefined,
          createdAt: new Date().toISOString(),
          isRead: false,
        });
      }

      // 3. Clear State on Success
      setInputText("");
      setSelectedAttachment(null);

      // Update conversation in list
      setConversationsList((prev) => {
        const found = prev.some((c) => c.id === effectiveId);
        if (found) {
          return prev.map((c) =>
            c.id === effectiveId
              ? {
                  ...c,
                  lastMessage: textToSend || (attachmentToSend ? "📎 مرفق مرسل" : ""),
                  lastSenderId: studentUid,
                  unreadStudentCount: 0,
                }
              : c
          );
        }
        return [
          {
            ...activeConversation,
            id: effectiveId,
            lastMessage: textToSend || (attachmentToSend ? "📎 مرفق مرسل" : ""),
            lastSenderId: studentUid,
            unreadStudentCount: 0,
            updatedAt: new Date(),
          },
          ...prev,
        ];
      });
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

  return (
    <div
      className="h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] w-full flex flex-col md:flex-row bg-background border border-outline/15 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden text-on-background selection:bg-primary/20"
      dir="rtl"
    >
      {/* ==================================================================== */}
      {/* PANE 1: CONVERSATIONS SIDEBAR (STRICTLY REAL FIRESTORE DATA)           */}
      {/* ==================================================================== */}
      <aside
        className={`w-full md:w-80 lg:w-96 shrink-0 border-l border-outline/15 bg-surface/60 backdrop-blur-md flex flex-col transition-all duration-300 ${
          mobileView === "chat" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Sidebar Header & Search */}
        <div className="p-4 border-b border-outline/10 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-on-surface">محادثات الأساتذة</h2>
                <p className="text-[11px] text-on-surface-variant font-medium">
                  التواصل المباشر مع مؤطري دوراتك
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {teachersList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="p-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-all cursor-pointer shadow-xs"
                  title="بدء محادثة جديدة مع أستاذ"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {conversationsList.length} محادثة
              </span>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث عن أستاذ أو مادة..."
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
        </div>

        {/* Conversations Scrollable List - STRICT FIREBASE MAPPING */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          {isConvosLoading ? (
            <div className="p-8 text-center space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-xs font-bold text-on-surface-variant">جاري مزامنة محادثاتك مع الأساتذة...</p>
            </div>
          ) : filteredConversations && filteredConversations.length > 0 ? (
            filteredConversations.map((convo) => (
              <div
                key={convo.id}
                onClick={() => {
                  setActiveConversation(convo);
                  setMobileView("chat");
                }}
                className={`p-3 rounded-2xl cursor-pointer transition-all duration-200 border ${
                  activeConversation?.id === convo.id
                    ? "bg-primary/10 border-primary/20 shadow-xs"
                    : "bg-surface hover:bg-surface-variant/40 border-outline/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                    {convo.teacherAvatar ? (
                      <Image
                        src={convo.teacherAvatar}
                        alt={convo.teacherName}
                        width={44}
                        height={44}
                        className="w-full h-full rounded-2xl object-cover"
                      />
                    ) : (
                      convo.teacherName?.charAt(0) || "أ"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="font-extrabold text-xs text-on-surface truncate">
                        {convo.teacherName}
                      </p>
                      {convo.lastMessageTime && (
                        <span className="text-[10px] text-on-surface-variant/70 shrink-0 font-medium">
                          {convo.lastMessageTime}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-primary/80 font-bold truncate mb-0.5">
                      {convo.courseTitle || convo.groupName || "المادة الأكاديمية"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-on-surface-variant/80 truncate font-medium">
                        {convo.lastMessage || "محادثة جديدة"}
                      </p>
                      {convo.unreadStudentCount && convo.unreadStudentCount > 0 ? (
                        <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary text-[10px] font-black flex items-center justify-center shadow-xs">
                          {convo.unreadStudentCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-3 p-1">
              <div className="text-center text-on-surface-variant/70 text-xs p-6 border border-dashed rounded-2xl border-outline/20 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <p className="font-bold text-on-surface text-xs">لا توجد محادثات سابقة</p>
                <p className="text-[11px] text-on-surface-variant/80">
                  {teachersList.length > 0
                    ? "اختر أحد الأساتذة أدناه لبدء محادثة فورية:"
                    : "لا يوجد أساتذة متاحون حالياً."}
                </p>
              </div>

              {teachersList.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold text-on-surface-variant px-1">الأساتذة المتاحون:</p>
                  {teachersList.map((teacher) => (
                    <div
                      key={teacher.id}
                      onClick={() => handleStartConversation(teacher)}
                      className="p-3 rounded-2xl bg-surface hover:bg-surface-variant/40 border border-outline/10 cursor-pointer transition-all flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                        {teacher.avatar ? (
                          <Image
                            src={teacher.avatar}
                            alt={teacher.name}
                            width={40}
                            height={40}
                            className="w-full h-full rounded-xl object-cover"
                          />
                        ) : (
                          teacher.name.charAt(0) || "أ"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-on-surface truncate group-hover:text-primary transition-colors">
                          {teacher.name}
                        </p>
                        <p className="text-[10px] text-on-surface-variant truncate">
                          {teacher.subject || teacher.courseTitle || "المادة الأكاديمية"}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-on-surface-variant/40 group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* PANE 2: THE CHAT ROOM (MAIN AREA)                                    */}
      {/* ==================================================================== */}
      <main
        className={`flex-1 flex flex-col h-full bg-surface/30 min-w-0 relative ${
          mobileView === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground bg-background h-full text-center p-6">
            <div className="space-y-3 max-w-sm">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20 shadow-xs">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-on-surface">
                الرجاء النقر على محادثة أو أستاذ للبدء
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                حدد أحد أساتذة دوراتك من القائمة الجانبية لطرح أسئلتك ومناقشة حلول التمارين والتوجيهات الأكاديمية.
              </p>
              {teachersList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="mt-2 py-2 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>بدء محادثة جديدة مع أستاذ</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <ChatWindow
            activeConversation={activeConversation}
            liveMessages={liveMessages}
            isScratchpadOpen={isScratchpadOpen}
            setIsScratchpadOpen={setIsScratchpadOpen}
            inputText={inputText}
            setInputText={setInputText}
            selectedAttachment={selectedAttachment}
            setSelectedAttachment={setSelectedAttachment}
            isSending={isSending}
            setMobileView={setMobileView}
            previewImageModal={previewImageModal}
            setPreviewImageModal={setPreviewImageModal}
            handleSendMessage={handleSendMessage}
            handleFileChange={handleFileChange}
            removeAttachment={removeAttachment}
            handleKeyDown={handleKeyDown}
            messagesEndRef={messagesEndRef}
            chatContainerRef={chatContainerRef}
            fileInputRef={fileInputRef}
            textareaRef={textareaRef}
          />
        )}
      </main>

      {/* Interactive Math Scratchpad Modal */}
      <MathScratchpad
        isOpen={isScratchpadOpen}
        onClose={() => setIsScratchpadOpen(false)}
        onApply={(latex) => {
          handleInsertMathSnippet(`$ ${latex} $`);
        }}
        title="مسودة ابتكار المعادلات الرياضية للمحادثة"
      />

      {/* Start New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative w-full max-w-md bg-surface rounded-3xl overflow-hidden border border-outline/20 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-outline/10 bg-surface-variant/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-on-surface">بدء محادثة جديدة مع أستاذ</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1.5 rounded-xl bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <p className="text-xs text-on-surface-variant">
                اختر الأستاذ الذي ترغب في التواصل معه لبدء محادثة فورية:
              </p>
              <div className="space-y-3 mt-4">
                {teachersList.length > 0 ? (
                  teachersList.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted transition-colors bg-surface/50 border-outline/15"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-on-secondary shrink-0">
                          {teacher.avatar ? (
                            <Image
                              src={teacher.avatar}
                              alt={teacher.name}
                              width={40}
                              height={40}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            teacher.name?.charAt(0) || "أ"
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">{teacher.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 truncate">
                            {teacher.subject || teacher.courseTitle || "أستاذ"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartConversation(teacher)}
                        className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-full hover:bg-primary/90 transition-all shrink-0 cursor-pointer"
                      >
                        محادثة
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground text-sm p-4 border border-dashed rounded-xl border-outline/15">
                    لا يوجد أساتذة متاحين حالياً.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview Modal */}
      {previewImageModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="relative max-w-4xl max-h-[90vh] bg-surface rounded-3xl overflow-hidden border border-outline/20 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-outline/10 bg-surface-variant/20">
              <span className="text-xs font-bold text-on-surface">معاينة الصورة المرفقة</span>
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

// =========================================================================
// ISOLATED CHAT WINDOW COMPONENT (STRICT PROP DRILLING & DYNAMIC BINDING)
// =========================================================================
export interface ChatWindowProps {
  activeConversation: ConversationDoc;
  liveMessages: MessageDoc[];
  isScratchpadOpen: boolean;
  setIsScratchpadOpen: (open: boolean) => void;
  inputText: string;
  setInputText: (text: string) => void;
  selectedAttachment: {
    file: File | null;
    previewUrl: string;
    type: "image" | "file";
  } | null;
  setSelectedAttachment: React.Dispatch<
    React.SetStateAction<{
      file: File | null;
      previewUrl: string;
      type: "image" | "file";
    } | null>
  >;
  isSending: boolean;
  setMobileView: (view: "list" | "chat") => void;
  previewImageModal: string | null;
  setPreviewImageModal: (url: string | null) => void;
  handleSendMessage: (e: React.FormEvent) => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeAttachment: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatWindow({
  activeConversation,
  liveMessages,
  isScratchpadOpen,
  setIsScratchpadOpen,
  inputText,
  setInputText,
  selectedAttachment,
  isSending,
  setMobileView,
  setPreviewImageModal,
  handleSendMessage,
  handleFileChange,
  removeAttachment,
  handleKeyDown,
  messagesEndRef,
  chatContainerRef,
  fileInputRef,
  textareaRef,
}: ChatWindowProps) {
  const teacherName = activeConversation.teacherName || "اسم الأستاذ";
  const subjectName = activeConversation.courseTitle || activeConversation.groupName || "المادة";

  const formatTimeArabic = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString("ar-DZ", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* 1. CHAT ROOM HEADER */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-outline/10 bg-surface/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className="md:hidden p-2 -mr-2 rounded-xl text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface transition-colors cursor-pointer"
            aria-label="الرجوع إلى قائمة الأساتذة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Active Teacher Avatar & Details */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20">
              {activeConversation.teacherAvatar ? (
                <Image
                  src={activeConversation.teacherAvatar}
                  alt={teacherName}
                  width={40}
                  height={40}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <GraduationCap className="w-5 h-5" />
              )}
            </div>
            {activeConversation.isOnline && (
              <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-on-surface truncate">
                {teacherName}
              </h3>
              <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary/10 text-secondary border border-secondary/20">
                {activeConversation.groupName || activeConversation.courseTitle || "الفوج الأكاديمي"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-on-surface-variant font-medium truncate max-w-[200px] sm:max-w-xs">
                {subjectName}
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

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsScratchpadOpen(true)}
            className="p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-outline/10 bg-surface-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/30 cursor-pointer"
            title="فتح مسودة كتابة المعادلات الرياضية"
          >
            <Calculator className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">مسودة المعادلات</span>
          </button>
        </div>
      </header>

      {/* 2. MESSAGES THREAD */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scroll-smooth"
      >
        {/* Pedagogical Guidance Banner */}
        <div className="max-w-md mx-auto p-3.5 rounded-2xl bg-surface border border-outline/10 text-center space-y-1 shadow-2xs">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>فضاء التواصل البيداغوجي المباشر</span>
          </div>
          <p className="text-[11px] text-on-surface-variant/80 leading-relaxed font-medium">
            اطرح استفساراتك، اكتب معادلاتك الرياضية، أو أرفق صور الحلول اليدوية لتلقي التوجيه
            من {teacherName}.
          </p>
        </div>

        {/* Date Separator Pill */}
        <div className="flex items-center justify-center my-4">
          <span className="px-3 py-1 rounded-full bg-surface-variant/40 text-on-surface-variant/80 text-[10px] font-bold border border-outline/10">
            سجل المحادثة مع {teacherName}
          </span>
        </div>

        {/* Message List */}
        {liveMessages.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-on-surface">لا توجد رسائل سابقة بعد</p>
            <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
              اكتب سؤالك أو معادلتك في الأسفل لبدء المحادثة المباشرة مع {teacherName}.
            </p>
          </div>
        ) : (
          liveMessages.map((msg) => {
            const isStudent = msg.senderRole === "student";

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2.5 ${
                  isStudent ? "justify-start" : "justify-end"
                } animate-fadeIn`}
              >
                {!isStudent && (
                  <div className="w-7 h-7 rounded-xl bg-surface-variant text-on-surface-variant flex items-center justify-center text-[10px] font-bold shrink-0 mb-1 border border-outline/15">
                    <GraduationCap className="w-3.5 h-3.5 text-secondary" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[70%] md:max-w-[65%] space-y-1.5 ${
                    isStudent ? "items-start" : "items-end"
                  }`}
                >
                  <div
                    className={`p-3.5 sm:p-4 rounded-3xl text-xs sm:text-sm leading-relaxed transition-all shadow-2xs ${
                      isStudent
                        ? "bg-primary text-on-primary rounded-br-xs"
                        : "bg-surface text-on-surface border border-outline/15 rounded-bl-xs"
                    }`}
                  >
                    {/* Rich LaTeX Math Text Rendering */}
                    {msg.text && (
                      <div className="font-medium whitespace-pre-wrap break-words leading-relaxed">
                        <MathText content={msg.text} />
                      </div>
                    )}

                    {/* Image Attachment Preview */}
                    {msg.attachmentUrl && msg.attachmentType === "image" && (
                      <div className="mt-2.5 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 group/img relative cursor-pointer">
                        <Image
                          src={msg.attachmentUrl}
                          alt="مرفق محادثة"
                          width={400}
                          height={300}
                          onClick={() => setPreviewImageModal(msg.attachmentUrl!)}
                          className="w-full max-h-60 object-cover hover:scale-102 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                          <span>انقر لتكبير الصورة</span>
                        </div>
                      </div>
                    )}

                    {/* File Attachment Pill */}
                    {msg.attachmentUrl && msg.attachmentType === "file" && (
                      <div
                        className={`mt-2.5 p-2.5 rounded-2xl flex items-center justify-between gap-3 ${
                          isStudent
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
                      isStudent ? "justify-start" : "justify-end"
                    }`}
                  >
                    <span>{formatTimeArabic(msg.createdAt)}</span>
                    {isStudent && (
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

      {/* 3. INPUT BAR (STICKY BOTTOM WITH LIVE PREVIEW & ATTACHMENTS) */}
      <div className="p-3 sm:p-4 bg-surface/95 backdrop-blur-md border-t border-outline/15 space-y-2.5 shrink-0">
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
                  جاهزة للإرسال مع الرسالة
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
            title="إرفاق صورة أو حل يدوي"
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
              placeholder="اكتب رسالتك أو استفسارك للأستاذ هنا... (اضغط + لإضافة معادلة)"
              className="w-full px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm bg-transparent text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none resize-none max-h-32 min-h-[42px] leading-relaxed"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedAttachment) || isSending}
            className="h-11 sm:h-12 px-4 sm:px-5 rounded-2xl bg-primary text-on-primary font-bold text-xs sm:text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            aria-label="إرسال الرسالة"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">جاري الإرسال...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 -scale-x-100" />
                <span className="hidden sm:inline">إرسال</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export const StudentChatInterface = DirectChatInterface;
export default DirectChatInterface;

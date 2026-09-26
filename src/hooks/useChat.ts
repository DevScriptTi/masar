"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  getDocs,
  serverTimestamp,
  increment,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export interface ConversationDoc {
  id: string;
  studentId: string;
  teacherId: string;
  studentName: string;
  studentAvatar?: string;
  studentEmail?: string;
  teacherName: string;
  teacherAvatar?: string;
  groupName?: string;
  courseTitle?: string;
  subjectName?: string;
  lastMessage: string;
  lastMessageTime?: string;
  lastSenderId?: string;
  unreadCount?: number;
  unreadTeacherCount?: number;
  unreadStudentCount?: number;
  updatedAt: any;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface MessageDoc {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: "student" | "teacher";
  receiverId: string;
  text: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "file";
  attachmentName?: string;
  createdAt: any;
  isRead?: boolean;
}

export interface SendMessageOptions {
  conversationId?: string | null;
  senderId: string;
  senderName: string;
  senderRole: "student" | "teacher";
  receiverId: string;
  receiverName?: string;
  subjectName?: string;
  groupName?: string;
  courseTitle?: string;
  teacherAvatar?: string;
  studentAvatar?: string;
  studentEmail?: string;
  text: string;
  file?: File | null;
  attachmentUrl?: string | null;
  attachmentType?: "image" | "file" | null;
  attachmentName?: string | null;
}

/**
 * Upload a chat attachment (image or document) to Cloudinary REST API and return its secure HTTPS URL
 */
export const uploadChatAttachment = async (file: File): Promise<string> => {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "gavyiksx";
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "student_homework";

  const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const resourceType = isPDF ? "raw" : "image";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || "فشل الرفع إلى Cloudinary");
  }

  const data = await res.json();
  return data.secure_url;
};

/**
 * Hook to fetch and listen to real-time conversations for a student or teacher
 */
export const useConversations = (
  userId: string | undefined | null,
  role: "student" | "teacher"
) => {
  const [conversations, setConversations] = useState<ConversationDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const fieldToQuery = role === "teacher" ? "teacherId" : "studentId";

    try {
      const q = query(
        collection(db, "conversations"),
        where(fieldToQuery, "==", userId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const convos = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as ConversationDoc[];

          // In-memory robust sort by updatedAt descending to prevent index requirement blockages
          convos.sort((a, b) => {
            const timeA = a.updatedAt?.toMillis
              ? a.updatedAt.toMillis()
              : a.updatedAt?.seconds
              ? a.updatedAt.seconds * 1000
              : new Date(a.updatedAt || 0).getTime();
            const timeB = b.updatedAt?.toMillis
              ? b.updatedAt.toMillis()
              : b.updatedAt?.seconds
              ? b.updatedAt.seconds * 1000
              : new Date(b.updatedAt || 0).getTime();
            return timeB - timeA;
          });

          setConversations(convos);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.warn("[useConversations] Firestore onSnapshot warning:", err.message);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.warn("[useConversations] Initialization error:", err);
      setError(err?.message || "Error setting up listener");
      setLoading(false);
    }
  }, [userId, role]);

  return { conversations, loading, error, setConversations };
};

/**
 * Hook to fetch and listen to real-time messages for a specific conversation thread
 */
export const useMessages = (conversationId: string | null | undefined) => {
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const q = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const msgs = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as MessageDoc[];

          // In-memory robust sort by createdAt ascending
          msgs.sort((a, b) => {
            const timeA = a.createdAt?.toMillis
              ? a.createdAt.toMillis()
              : a.createdAt?.seconds
              ? a.createdAt.seconds * 1000
              : new Date(a.createdAt || 0).getTime();
            const timeB = b.createdAt?.toMillis
              ? b.createdAt.toMillis()
              : b.createdAt?.seconds
              ? b.createdAt.seconds * 1000
              : new Date(b.createdAt || 0).getTime();
            return timeA - timeB;
          });

          setMessages(msgs);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.warn("[useMessages] Firestore onSnapshot warning:", err.message);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.warn("[useMessages] Initialization error:", err);
      setError(err?.message || "Error setting up listener");
      setLoading(false);
    }
  }, [conversationId]);

  return { messages, loading, error, setMessages };
};

/**
 * Send message and update or auto-create the parent conversation doc
 */
export const sendMessage = async ({
  conversationId,
  senderId,
  senderName,
  senderRole,
  receiverId,
  receiverName,
  subjectName,
  courseTitle,
  groupName,
  teacherAvatar,
  studentAvatar,
  studentEmail,
  text,
  file,
  attachmentUrl,
  attachmentType,
  attachmentName,
}: SendMessageOptions): Promise<{ conversationId: string; messageId: string } | undefined> => {
  if ((!text.trim() && !file && !attachmentUrl) || (!conversationId && !receiverId)) return;

  const cleanText = text.trim();
  let finalAttachmentUrl = attachmentUrl || null;

  // If a raw File is provided, upload it to Cloudinary first
  if (file) {
    finalAttachmentUrl = await uploadChatAttachment(file);
  }

  const studentId = senderRole === "student" ? senderId : receiverId;
  const teacherId = senderRole === "teacher" ? senderId : receiverId;
  const targetStudentName = senderRole === "student" ? senderName : (receiverName || "التلميذ");
  const targetTeacherName = senderRole === "teacher" ? senderName : (receiverName || "الأستاذ المشرف");
  const targetCourseName = subjectName || courseTitle || groupName || "المادة الأكاديمية";

  let effectiveConvoId = conversationId;

  // 1. Check if the specified conversation document exists or if we need to locate/upsert it
  let convoDocExists = false;
  if (effectiveConvoId && !effectiveConvoId.startsWith("conv_temp_")) {
    try {
      const q = query(
        collection(db, "conversations"),
        where("studentId", "==", studentId),
        where("teacherId", "==", teacherId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        effectiveConvoId = snap.docs[0].id;
        convoDocExists = true;
      }
    } catch {
      convoDocExists = false;
    }
  }

  // 2. If it does not exist in Firestore, query or auto-create it immediately
  if (!convoDocExists) {
    const q = query(
      collection(db, "conversations"),
      where("studentId", "==", studentId),
      where("teacherId", "==", teacherId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      effectiveConvoId = snap.docs[0].id;
    } else {
      // ARCHITECTURE RESILIENCE: Auto-create conversation document with addDoc
      const newConvoRef = await addDoc(collection(db, "conversations"), {
        studentId,
        studentName: targetStudentName,
        teacherId,
        teacherName: targetTeacherName,
        subjectName: targetCourseName,
        courseTitle: courseTitle || targetCourseName,
        groupName: groupName || "الفوج الأكاديمي",
        studentAvatar: studentAvatar || "",
        studentEmail: studentEmail || "",
        teacherAvatar: teacherAvatar || "",
        lastMessage: cleanText || (finalAttachmentUrl ? "📎 مرفق مرسل" : ""),
        lastSenderId: senderId,
        unreadCount: senderRole === "student" ? 1 : 0,
        unreadTeacherCount: senderRole === "student" ? 1 : 0,
        unreadStudentCount: senderRole === "teacher" ? 1 : 0,
        updatedAt: serverTimestamp(),
      });
      effectiveConvoId = newConvoRef.id;
    }
  }

  if (!effectiveConvoId) {
    throw new Error("فشل تحديد أو إنشاء وثيقة المحادثة");
  }

  // 3. Save the actual message inside the messages collection linking to effectiveConvoId
  const messageRef = await addDoc(collection(db, "messages"), {
    conversationId: effectiveConvoId,
    senderId,
    senderName: senderName || "مستخدم",
    senderRole,
    receiverId,
    text: cleanText,
    attachmentUrl: finalAttachmentUrl,
    attachmentType: attachmentType || (file?.type.startsWith("image/") ? "image" : "file") || null,
    attachmentName: attachmentName || file?.name || null,
    createdAt: serverTimestamp(),
    isRead: false,
  });

  // 4. Update the parent conversation with last message metadata & counters
  const convoRef = doc(db, "conversations", effectiveConvoId);
  await updateDoc(convoRef, {
    lastMessage: cleanText || (finalAttachmentUrl ? "📎 مرفق مرسل" : ""),
    lastSenderId: senderId,
    updatedAt: serverTimestamp(),
    ...(senderRole === "student"
      ? { unreadTeacherCount: increment(1), unreadCount: increment(1) }
      : { unreadStudentCount: increment(1) }),
  });

  return { conversationId: effectiveConvoId, messageId: messageRef.id };
};

/**
 * Get an existing conversation between student and teacher, or create a new one
 */
export const getOrCreateConversation = async ({
  studentId,
  studentName,
  studentEmail,
  studentAvatar,
  teacherId,
  teacherName,
  teacherAvatar,
  groupName,
  courseTitle,
  subjectName,
}: {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  studentAvatar?: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  groupName?: string;
  courseTitle?: string;
  subjectName?: string;
}): Promise<string> => {
  try {
    // 1. Query the conversations collection for studentId == currentUser.id and teacherId == targetTeacher.id
    const q = query(
      collection(db, "conversations"),
      where("studentId", "==", studentId),
      where("teacherId", "==", teacherId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      return snap.docs[0].id;
    }

    // 2. If it DOES NOT exist, immediately create it using addDoc
    const targetCourseName = subjectName || courseTitle || groupName || "المادة الأكاديمية";
    const newConvoRef = await addDoc(collection(db, "conversations"), {
      studentId,
      studentName: studentName || "التلميذ",
      teacherId,
      teacherName: teacherName || "الأستاذ المشرف",
      subjectName: targetCourseName,
      groupName: groupName || "الفوج الأكاديمي",
      courseTitle: courseTitle || targetCourseName,
      studentAvatar: studentAvatar || "",
      studentEmail: studentEmail || "",
      teacherAvatar: teacherAvatar || "",
      updatedAt: serverTimestamp(),
      lastMessage: "",
      unreadCount: 0,
      unreadTeacherCount: 0,
      unreadStudentCount: 0,
    });

    return newConvoRef.id;
  } catch (err) {
    console.warn("[getOrCreateConversation] Error querying/creating conversation:", err);
    throw err;
  }
};

/**
 * Mark all unread messages for a given role as read in conversation
 */
export const markConversationAsRead = async (
  conversationId: string,
  role: "student" | "teacher"
) => {
  if (!conversationId) return;
  try {
    const convoRef = doc(db, "conversations", conversationId);
    if (role === "teacher") {
      await updateDoc(convoRef, { unreadTeacherCount: 0, unreadCount: 0 });
    } else {
      await updateDoc(convoRef, { unreadStudentCount: 0 });
    }
  } catch (err) {
    console.warn("[markConversationAsRead] Error resetting counter:", err);
  }
};

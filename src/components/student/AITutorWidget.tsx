"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  X,
  Send,
  Loader2,
  Image as ImageIcon,
  Eye,
  Calculator,
  CornerDownLeft,
  Trash2,
  Pencil,
  Trophy,
  Maximize2,
  Minimize2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import katex from "katex";
import "katex/dist/katex.min.css";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { MathInputEngine, MathInputEngineRef } from "./MathInputEngine";
import { InteractiveExercise } from "./InteractiveExercise";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AITutorWidgetProps {
  studentId?: string;
  studentName?: string;
  lessonTitle?: string;
  lessonSummary?: string;
  studentImages?: string[];
  submissionUrls?: string[];
  latexContent?: string;
  aiEvaluationCache?: any;
  submissionId?: string;
  hiddenTeacherDirectives?: string;
}

// Baccalaureate Math Snippets using MathLive Placeholders (#0, #?)
const BAC_MATH_SNIPPETS = [
  { label: "\\frac{a}{b}", snippet: "\\frac{#0}{#?}", title: "كسر" },
  { label: "x^2", snippet: "x^2", title: "مربع" },
  { label: "x^n", snippet: "x^{#?}", title: "أس" },
  { label: "\\sqrt{x}", snippet: "\\sqrt{#0}", title: "جذر تربيعي" },
  { label: "\\le", snippet: "\\le", title: "أصغر أو يساوي" },
  { label: "\\ge", snippet: "\\ge", title: "أكبر أو يساوي" },
  { label: "\\neq", snippet: "\\neq", title: "لا يساوي" },
  { label: "\\Delta", snippet: "\\Delta", title: "المميز دلتا" },
  { label: "\\infty", snippet: "\\infty", title: "مالانهاية" },
  { label: "\\pi", snippet: "\\pi", title: "باي" },
  { label: "\\ln(x)", snippet: "\\ln(#0)", title: "اللوغاريتم النيبيري" },
  { label: "e^{x}", snippet: "e^{#0}", title: "الدالة الأسية" },
  { label: "\\lim_{x \\to \\infty}", snippet: "\\lim_{x \\to \\infty}", title: "نهاية" },
  { label: "\\vec{V}", snippet: "\\vec{#0}", title: "شعاع" },
];

function parseMessageContent(rawContent: string) {
  const suggestionRegex = /\[اقتراح:\s*(.*?)\]/g;
  const suggestions: string[] = [];
  let match;

  while ((match = suggestionRegex.exec(rawContent)) !== null) {
    if (match[1] && match[1].trim()) {
      suggestions.push(match[1].trim());
    }
  }

  const cleanContent = rawContent.replace(suggestionRegex, "").trim();
  return { cleanContent, suggestions };
}

// Helper to render KaTeX math safely in small badges/buttons
function KaTeXBadge({ math }: { math: string }) {
  try {
    const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span>{math}</span>;
  }
}

export function AITutorWidget({
  studentId,
  studentName,
  lessonTitle,
  lessonSummary,
  studentImages = [],
  submissionUrls = [],
  latexContent = "",
  aiEvaluationCache,
  submissionId,
  hiddenTeacherDirectives = "",
}: AITutorWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [scratchpadMath, setScratchpadMath] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);

  // Task A: Lazy Loading & Expansion States
  const [displayLimit, setDisplayLimit] = useState(15);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [evaluationStats, setEvaluationStats] = useState<{
    newSkills: number;
    mistakesResolved: number;
    totalSkills: number;
  } | null>(null);

  // Task A & B: Track MathLive Virtual Keyboard Height & Visibility
  const [vkbHeight, setVkbHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateKeyboardHeight = () => {
      const vkb = (window as any).mathVirtualKeyboard;
      if (vkb && vkb.visible) {
        const height = vkb.boundingRect?.height || 300;
        setVkbHeight(height);
      } else {
        setVkbHeight(0);
      }
    };

    const vkb = (window as any).mathVirtualKeyboard;
    if (vkb) {
      vkb.addEventListener("geometrychange", updateKeyboardHeight);
      updateKeyboardHeight();
    }

    return () => {
      if (vkb) {
        vkb.removeEventListener("geometrychange", updateKeyboardHeight);
      }
    };
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mathEngineRef = useRef<MathInputEngineRef>(null);

  // Combine student images from props
  const imagesToEvaluate = submissionUrls.length > 0 ? submissionUrls : studentImages;

  // Dynamic Welcome Message
  const studentDisplayName = studentName && studentName.trim() ? studentName : "التلميذ العزيز";
  const initialGreeting = `مرحباً بك يا ${studentDisplayName}! أنا مساعدك الذكي لمادة الرياضيات في درس "${lessonTitle || "الرياضيات"
    }". كيف يمكنني مساعدتك اليوم؟ [اقتراح: يرجى شرح فكرة الدرس بالتفصيل] [اقتراح: مراجعة حلي المرفوع]`;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-greeting",
      role: "assistant",
      content: initialGreeting,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load persisted Chat History from Firestore submission document if available
  useEffect(() => {
    if (!submissionId) return;

    const loadChatHistory = async () => {
      try {
        const subRef = doc(db, "submissions", submissionId);
        const subSnap = await getDoc(subRef);

        if (subSnap.exists()) {
          const data = subSnap.data();
          if (Array.isArray(data.chatHistory) && data.chatHistory.length > 0) {
            setMessages(data.chatHistory);
          }
        }
      } catch (err) {
        console.error("Error loading chat history from Firestore:", err);
      }
    };

    loadChatHistory();
  }, [submissionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, vkbHeight]);

  // Save Chat History to Firestore helper
  const persistChatHistory = async (newMessages: Message[]) => {
    if (!submissionId) return;
    try {
      const subRef = doc(db, "submissions", submissionId);
      await updateDoc(subRef, {
        chatHistory: newMessages,
        chatUpdatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not save chat history to Firestore:", err);
    }
  };

  // High-End Textbook Markdown Components Renderer Override
  const renderTextbookComponents = {
    h1: ({ children }: any) => (
      <h1 className="text-base font-extrabold text-amber-500 dark:text-amber-400 mt-3 mb-1.5 flex items-center gap-1.5 border-b border-amber-500/20 pb-1">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-sm font-extrabold text-amber-500 dark:text-amber-400 mt-2.5 mb-1 flex items-center gap-1">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-xs font-bold text-amber-500 dark:text-amber-300 mt-2 mb-1 flex items-center gap-1">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-xs font-bold text-amber-400 mt-2 mb-0.5">
        {children}
      </h4>
    ),
    strong: ({ children }: any) => (
      <strong className="text-indigo-400 dark:text-indigo-300 font-extrabold px-1 py-0.5 rounded bg-indigo-500/10">
        {children}
      </strong>
    ),
    em: ({ children }: any) => (
      <em className="text-emerald-400 font-semibold not-italic px-1">
        {children}
      </em>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-r-4 border-amber-500 bg-amber-500/10 p-2.5 rounded-2xl my-2 text-on-surface font-medium shadow-2xs">
        {children}
      </blockquote>
    ),
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";

      // Intercept the Generative UI JSON block (e.g. ```exercise ... ```)
      if (!inline && (language === "exercise" || language === "json-exercise")) {
        try {
          const rawContent = String(children).replace(/\n$/, "").trim();
          const data = JSON.parse(rawContent);
          return (
            <InteractiveExercise
              data={data}
              onSuccess={(msg) => handleAutoSubmit(msg)}
            />
          );
        } catch (e) {
          console.error("Failed to parse interactive exercise JSON", e);
          return null;
        }
      }

      return (
        <code
          className="px-1.5 py-0.5 rounded-lg bg-surface-variant text-primary font-mono text-[11px] dir-ltr inline-block"
          {...props}
        >
          {children}
        </code>
      );
    },
    a: ({ href, children, ...props }: any) => {
      const imageRefMatch =
        href &&
        (href.match(/#(?:image|img)-?(\d+)/i) ||
          href.match(/^(?:image|img)-?(\d+)/i));

      if (imageRefMatch) {
        const imgNumber = parseInt(imageRefMatch[1], 10);
        const imgIndex = !isNaN(imgNumber) ? imgNumber - 1 : 0;
        const targetUrl = imagesToEvaluate[imgIndex] || imagesToEvaluate[0];

        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (targetUrl) {
                setLightboxImageUrl(targetUrl);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-extrabold cursor-pointer transition-colors text-xs my-1 shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{children || `معاينة الصورة ${imgNumber}`}</span>
          </button>
        );
      }

      const isImageUrl =
        href &&
        (href.includes("cloudinary.com") ||
          href.match(/\.(jpeg|jpg|png|gif|webp|svg)($|\?)/i) ||
          href.startsWith("data:image/"));

      if (isImageUrl) {
        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setLightboxImageUrl(href);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-extrabold cursor-pointer transition-colors text-xs my-1 shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{children || "معاينة الصورة"}</span>
          </button>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline font-bold hover:text-primary/80"
          {...props}
        >
          {children}
        </a>
      );
    },
  };

  // Task B: STRICT Guarded Gamified End Session Evaluation Function
  const handleEndSession = async () => {
    if (messages.length < 2 || isEvaluating) return;

    // Strict Guard: Prevent evaluation if explicit studentId is missing
    if (!studentId || studentId.trim() === "") {
      console.error("Critical Error: studentId is undefined or empty. Cannot update Master Profile.");
      alert("عذراً، حدث خطأ في التعرف على حسابك. يرجى التأكد من تسجيل الدخول.");
      return;
    }

    setIsEvaluating(true);

    try {
      const res = await fetch("/api/ai/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: studentId, // Strictly enforce the real studentId
          studentId: studentId,
          messages,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const delta = data.delta || {};
        const updatedProfile = data.updatedProfile || {};

        const newSkillsCount = delta.newSkillTags ? Object.keys(delta.newSkillTags).length : 0;
        const resolvedCount = Array.isArray(delta.resolvedMistakes) ? delta.resolvedMistakes.length : 0;
        const totalSkillsCount = updatedProfile.skillTags ? Object.keys(updatedProfile.skillTags).length : 0;

        setEvaluationStats({
          newSkills: newSkillsCount,
          mistakesResolved: resolvedCount,
          totalSkills: totalSkillsCount,
        });
        setShowRewardModal(true);
      } else {
        console.warn("Update profile API returned non-ok status:", res.status);
      }
    } catch (error) {
      console.error("Evaluation session end error:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Task B: Smart Clear Chat & Context Contagion Prevention Function
  const handleClearChat = async () => {
    if (messages.length <= 1 || isLoading) return;

    const confirmWipe = window.confirm(
      "هل أنت متأكد أنك تريد مسح الدردشة وبدء جلسة جديدة؟ سيتم حفظ تقدمك أولاً."
    );
    if (!confirmWipe) return;

    setIsLoading(true);

    try {
      // 1. Silently update context (Master Profile) if there's enough data
      if (messages.length > 2 && studentId) {
        await fetch("/api/ai/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: studentId,
            studentId: studentId,
            messages,
          }),
        }).catch((err) => console.warn("Silent profile update failed:", err));
      }

      // 2. Nuke Firestore chat history for this submission
      if (submissionId) {
        const subRef = doc(db, "submissions", submissionId);
        await updateDoc(subRef, {
          chatHistory: [messages[0]], // Keep only the initial greeting
          chatUpdatedAt: serverTimestamp(),
        });
      }

      // 3. Reset local state
      setMessages([messages[0]]);
      setDisplayLimit(15);
    } catch (error) {
      console.error("Error clearing chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = (index: number, content: string) => {
    if (isLoading) return;

    const truncatedMessages = messages.slice(0, index);
    setMessages(truncatedMessages);
    persistChatHistory(truncatedMessages);

    setInput(content);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(content.length, content.length);
      }
    }, 50);
  };

  const handleInsertMathToBuilder = (snippet: string) => {
    if (mathEngineRef.current) {
      mathEngineRef.current.executeCommand(["insert", snippet]);
      mathEngineRef.current.focus();
    }
  };

  const handleInsertScratchpadToText = () => {
    const mathVal = scratchpadMath.trim();
    if (!mathVal) return;

    const formattedMath = `$${mathVal}$`;

    if (textareaRef.current) {
      const el = textareaRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const textBefore = el.value.substring(0, start);
      const textAfter = el.value.substring(end);
      const prefix = textBefore && !textBefore.endsWith(" ") ? " " : "";
      const suffix = textAfter && !textAfter.startsWith(" ") ? " " : "";
      const newText = `${textBefore}${prefix}${formattedMath}${suffix}${textAfter}`;
      setInput(newText);
      setTimeout(() => {
        el.focus();
        const newPos = start + prefix.length + formattedMath.length + suffix.length;
        el.setSelectionRange(newPos, newPos);
      }, 50);
    } else {
      setInput((prev) => (prev ? `${prev} ${formattedMath} ` : `${formattedMath} `));
    }

    setScratchpadMath("");
    if (mathEngineRef.current) {
      mathEngineRef.current.clear();
    }
    setIsScratchpadOpen(false);
  };

  const sendPayload = async (
    userPromptText: string,
    customMessages: Message[],
    forceVision = false
  ) => {
    setIsLoading(true);

    try {
      console.log("🔥 FRONTEND DEBUG 2 (Widget): Directives prop value =", hiddenTeacherDirectives);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: customMessages.map((m) => ({ role: m.role, content: m.content })),
          userId: studentId || "",
          studentId: studentId || "",
          studentName: studentDisplayName,
          lessonContext: lessonTitle || "درس الرياضيات",
          lessonSummary: lessonSummary || "",
          latexContent: latexContent || "",
          aiEvaluationCache: aiEvaluationCache || null,
          forceVision: forceVision,
          uploadedImages: forceVision ? imagesToEvaluate : [],
          studentImages: forceVision ? imagesToEvaluate : [],
          hiddenTeacherDirectives: hiddenTeacherDirectives || "",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Backend Chat Error Details:", res.status, errorData);
        throw new Error(
          errorData.error || errorData.message || "فشل الاتصال بالمساعد الذكي"
        );
      }

      let replyContent = "";
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        replyContent = data.content || data.text || "";
      } else {
        const textData = await res.text();
        replyContent =
          textData
            .split("\n")
            .filter((line) => line.startsWith('0:"'))
            .map((line) => {
              try {
                return JSON.parse(line.slice(2));
              } catch {
                return "";
              }
            })
            .join("") || textData;
      }

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: replyContent || "أعتذر، حدث خلل بسيط أثناء إعداد الإجابة.",
      };

      const finalMessages = [...customMessages, assistantMsg];
      setMessages(finalMessages);
      persistChatHistory(finalMessages);
    } catch (error: any) {
      console.error("AI Tutor Error:", error);
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content:
          error?.message ||
          "عذراً، حدث خطأ مؤقت في الاتصال بالمساعد الذكي. الرجاء المحاولة مجدداً.",
      };
      const finalMessages = [...customMessages, errorMsg];
      setMessages(finalMessages);
      persistChatHistory(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const sendText = input.trim();
    if (!sendText || isLoading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: sendText,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await sendPayload(sendText, newMessages, false);
  };

  const handleAutoSubmit = async (autoText: string) => {
    if (isLoading || !autoText.trim()) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: autoText.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    await sendPayload(autoText.trim(), newMessages, false);
  };

  const handleChipClick = async (chipText: string) => {
    if (isLoading || !chipText.trim()) return;

    const isExplicitVisionRequest =
      chipText.includes("اعترض") ||
      chipText.includes("قراءة الصور بصرياً") ||
      chipText.includes("إعادة فحص الصورة");

    const useVision = isExplicitVisionRequest || (!aiEvaluationCache && chipText.includes("مراجعة حلي"));

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: chipText.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await sendPayload(chipText.trim(), newMessages, useVision);
  };

  const handleEvaluateSubmission = async (explicitVisionRequest = false) => {
    if (isLoading || imagesToEvaluate.length === 0) return;

    const hasCache = !!aiEvaluationCache;
    const useVision = explicitVisionRequest || !hasCache;

    const evalMsgText = useVision
      ? "الرجاء قراءة صور إجابتي المرفوعة بصرياً وتوجيهي أين أخطأت خطوة بخطوة."
      : "الرجاء مراجعة حلي وتوجيهي أين أخطأت خطوة بخطوة.";

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: evalMsgText,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    await sendPayload(evalMsgText, newMessages, useVision);
  };

  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf("assistant");
  const displayedMessages = messages.slice(-displayLimit);

  return (
    <div dir="rtl">
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="فتح المساعد الذكي"
        className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full bg-gradient-to-tr from-primary to-primary-container text-on-primary shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-primary/30 group"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <Bot className="w-7 h-7" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-tertiary rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-tertiary rounded-full" />
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-surface border-outline/20 shadow-2xl transition-all duration-300 ease-in-out backdrop-blur-md overflow-hidden animate-fadeIn ${isExpanded
            ? "inset-0 w-full h-full rounded-none border-0"
            : "inset-0 w-full h-full rounded-none sm:inset-auto sm:bottom-24 sm:left-6 sm:w-96 sm:h-[590px] sm:max-h-[86vh] sm:rounded-3xl sm:border"
            }`}
        >
          {/* Header */}
          <div className="p-4 bg-primary/10 border-b border-outline/15 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-1.5">
                  <span>المساعد الذكي للدرس</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
                <p className="text-[10px] font-bold text-on-surface-variant truncate max-w-[140px]">
                  {lessonTitle || "الرياضيات"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleEndSession}
                disabled={isEvaluating || messages.length < 2}
                title="إنهاء الدرس وتقييم مستواي التراكمي"
                className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-[11px] font-extrabold shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shrink-0 active:scale-95"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>تقييم...</span>
                  </>
                ) : (
                  <>
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    <span>تقييم المستوي ✨</span>
                  </>
                )}
              </button>

              {/* Task C: Clear Chat Button */}
              <button
                type="button"
                onClick={handleClearChat}
                disabled={isLoading || messages.length <= 1}
                className="hidden sm:flex items-center justify-center p-1.5 rounded-full text-error hover:bg-error/10 transition-colors disabled:opacity-30 cursor-pointer"
                title="مسح الدردشة وبدء جلسة جديدة"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:flex items-center justify-center p-1.5 rounded-full text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
                title={isExpanded ? "تصغير النافذة" : "تكبير النافذة"}
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {imagesToEvaluate.length > 0 && (
            <div className="px-4 py-2 bg-surface-variant/30 border-b border-outline/10 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                <span>مرفق {imagesToEvaluate.length} صورة</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleEvaluateSubmission(false)}
                  className="px-3 py-1 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-[11px] font-extrabold transition-all flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>مراجعة حلي المرفوع ✨</span>
                </button>

                {aiEvaluationCache && (
                  <button
                    type="button"
                    disabled={isLoading}
                    title="فحص بصري مباشر للصور المرفوعة"
                    onClick={() => handleEvaluateSubmission(true)}
                    className="px-2 py-1 rounded-xl bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Eye className="w-3 h-3" />
                    <span>فحص بصري 👁️</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chat Messages (Lazy Loaded / Paginated) */}
          <div
            className="flex-1 p-4 overflow-y-auto space-y-4 bg-background/40"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              if (target.scrollTop === 0 && displayLimit < messages.length) {
                setDisplayLimit((prev) => prev + 15);
              }
            }}
          >
            {displayedMessages.map((msg) => {
              const isUser = msg.role === "user";
              const originalIdx = messages.findIndex((m) => m.id === msg.id);
              const isLastAssistantMsg = originalIdx === lastAssistantIndex;
              const { cleanContent, suggestions } = isUser
                ? { cleanContent: msg.content, suggestions: [] }
                : parseMessageContent(msg.content);

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-start" : "items-end"} space-y-2 group`}
                >
                  <div
                    className={`max-w-[90%] p-3.5 rounded-2xl text-xs font-medium leading-relaxed shadow-2xs ${isUser
                      ? "bg-primary text-on-primary rounded-tr-xs"
                      : "bg-surface border border-outline/15 text-on-surface rounded-tl-xs prose prose-invert max-w-none"
                      }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                      components={renderTextbookComponents}
                    >
                      {cleanContent}
                    </ReactMarkdown>

                    {isUser && (
                      <div className="flex items-center justify-end pt-1.5 border-t border-on-primary/15 mt-2">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleEditMessage(originalIdx, cleanContent)}
                          title="تعديل هذه الرسالة وإعادة الإرسال"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-on-primary/80 hover:text-on-primary hover:underline transition-all cursor-pointer disabled:opacity-50 opacity-90 group-hover:opacity-100"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>تعديل ✎</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {isLastAssistantMsg && suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 animate-fadeIn">
                      {suggestions.map((chipText, chipIdx) => (
                        <button
                          key={chipIdx}
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleChipClick(chipText)}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-bold text-xs transition-all shadow-2xs cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95 flex items-center gap-1.5"
                        >
                          <span className="shrink-0 text-primary">✨</span>
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                            components={{
                              p: ({ children }) => <span className="inline-block">{children}</span>,
                            }}
                          >
                            {chipText}
                          </ReactMarkdown>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 bg-surface border border-outline/15 rounded-2xl w-fit animate-pulse">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-xs font-semibold text-on-surface-variant">
                  جاري صياغة التوجيه المنهجي...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Math Scratchpad */}
          {isScratchpadOpen && (
            <div className="p-3 bg-surface-variant/40 border-t border-outline/15 space-y-2 animate-slideUp">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-extrabold text-primary flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>مسودة ابتكار المعادلة التفاعلية (Math Scratchpad)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsScratchpadOpen(false)}
                  className="text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors"
                >
                  إغلاق ✕
                </button>
              </div>

              <MathInputEngine
                ref={mathEngineRef}
                value={scratchpadMath}
                onChange={(val) => setScratchpadMath(val)}
                placeholder="تشكيل معادلة بصرية (كسور، جذور، أسس...)"
                disabled={isLoading}
              />

              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-0.5 pt-1">
                {BAC_MATH_SNIPPETS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    title={item.title}
                    onClick={() => handleInsertMathToBuilder(item.snippet)}
                    className="px-2 py-0.5 rounded-xl bg-surface border border-outline/15 hover:bg-primary/10 hover:border-primary/30 text-on-surface hover:text-primary text-xs font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <KaTeXBadge math={item.label} />
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-outline/10">
                <button
                  type="button"
                  disabled={!scratchpadMath.trim()}
                  onClick={handleInsertScratchpadToText}
                  className="px-3.5 py-1 rounded-xl bg-primary text-on-primary hover:bg-primary/90 text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>إدراج المعادلة في الرسالة ↵</span>
                </button>

                {scratchpadMath.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setScratchpadMath("");
                      if (mathEngineRef.current) mathEngineRef.current.clear();
                    }}
                    className="px-2 py-0.5 rounded-xl bg-error/10 text-error hover:bg-error/20 text-[10px] font-bold transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>تفريغ</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live Preview Overlay */}
          {input.trim().length > 0 && (
            <div className="px-3 py-2 bg-primary/5 border-t border-primary/20 animate-fadeIn space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>معاينة حية للرسالة (Live Preview):</span>
                </span>
                <span className="text-[9px] font-bold text-on-surface-variant">
                  الشكل النهائي المعروض للتلميذ
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface border border-outline/15 text-xs text-on-surface leading-relaxed max-h-28 overflow-y-auto font-medium shadow-2xs">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                  components={renderTextbookComponents}
                >
                  {input}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Chat Input Area */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-surface border-t border-outline/15 flex flex-col gap-2 transition-all duration-300"
            style={{ paddingBottom: vkbHeight > 0 ? `${vkbHeight + 12}px` : undefined }}
          >
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setIsScratchpadOpen((prev) => !prev)}
                title="فتح مسودة ابتكار المعادلة الرياضية التفاعلية"
                className={`px-3 py-1 rounded-xl flex items-center gap-1.5 text-[11px] font-extrabold transition-all border border-outline/15 cursor-pointer ${isScratchpadOpen
                  ? "bg-primary text-on-primary border-primary shadow-xs"
                  : "bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant hover:text-primary"
                  }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>مسودة معادلة تفاعلية ∑</span>
              </button>

              <button
                type="button"
                onClick={handleEndSession}
                disabled={isEvaluating || messages.length < 2}
                className="text-[10px] font-bold text-emerald-500 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
              >
                {isEvaluating ? "جاري التقييم..." : "إنهاء الدرس وتقييم المستوي 🏆"}
              </button>
            </div>

            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="اكتب استفسارك أو سؤالك باللغة العربية هنا..."
                disabled={isLoading}
                className="flex-1 p-3 rounded-2xl bg-surface-variant/40 text-on-surface text-xs font-medium placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 border border-outline/10 resize-none transition-all"
              />

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="h-11 w-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0 shadow-xs cursor-pointer mb-0.5"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setLightboxImageUrl(null)}
          dir="rtl"
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-surface rounded-3xl overflow-hidden shadow-2xl border border-outline/20 p-2 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-html-element-suppress-warnings */}
            <img
              src={lightboxImageUrl}
              alt="معاينة الصورة"
              className="max-h-[82vh] w-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Reward Modal */}
      {showRewardModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
          dir="rtl"
        >
          <div className="bg-surface border border-outline/20 p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center transform scale-100 animate-slideUp space-y-4">
            <div className="text-5xl animate-bounce">🌟</div>

            <h3 className="text-lg font-extrabold text-on-surface">
              أحسنت العمل يا {studentDisplayName}!
            </h3>

            <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
              لقد تم تحليل إجاباتك بنجاح وتحديث ملفك البيداغوجي والتراكمي في منصة "مسار".
            </p>

            <div className="flex justify-center gap-2 py-2">
              <div className="bg-primary/10 border border-primary/20 p-3 rounded-2xl text-center flex-1">
                <div className="text-2xl font-extrabold text-primary">
                  +{evaluationStats?.newSkills || 1}
                </div>
                <div className="text-[10px] font-bold text-on-surface-variant">
                  مهارات جديدة
                </div>
              </div>

              {evaluationStats && evaluationStats.mistakesResolved > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-center flex-1">
                  <div className="text-2xl font-extrabold text-emerald-500">
                    {evaluationStats.mistakesResolved}
                  </div>
                  <div className="text-[10px] font-bold text-on-surface-variant">
                    أخطاء متجاوزة
                  </div>
                </div>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl text-center flex-1">
                <div className="text-2xl font-extrabold text-amber-500">
                  {evaluationStats?.totalSkills || 1}
                </div>
                <div className="text-[10px] font-bold text-on-surface-variant">
                  إجمالي المهارات
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowRewardModal(false);
                setIsOpen(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-extrabold text-xs shadow-md hover:bg-primary/90 transition-all cursor-pointer"
            >
              إغلاق ومتابعة التعلم ✨
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
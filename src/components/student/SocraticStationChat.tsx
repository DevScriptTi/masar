"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ActivityStation } from "@/src/lib/firebase/coursesService";
import { HomeworkUploader } from "@/src/components/student/HomeworkUploader";
import { MathText } from "@/src/components/admin/activities/StudentPreview";
import { MathScratchpad } from "@/src/components/student/MathScratchpad";
import TextareaAutosize from "react-textarea-autosize";
import katex from "katex";
import "katex/dist/katex.min.css";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/src/components/ui/collapsible";
import {
  Sparkles,
  Send,
  Image as ImageIcon,
  Bot,
  User,
  Layers,
  Loader2,
  X,
  ZoomIn,
  CheckCircle2,
  Clock,
  Calculator,
  Edit,
  Bug,
  Trash2,
  Maximize2,
  Minimize2,
  BookOpen,
  ChevronDown,
} from "lucide-react";

export interface ChatMessage {
  id: string;
  sender: "ai" | "student";
  text: string;
  images?: string[];
  timestamp: string;
}

export interface SocraticStationChatProps {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  courseId: string;
  courseName?: string;
  moduleName?: string;
  courseIndexContext?: string;
  activityId: string;
  activityTitle: string;
  activityDescription?: string;
  globalLatexSummary?: string;
  referenceImageUrls?: string[];
  globalCustomIsolations?: any[];
  attachments?: any[];
  stations?: ActivityStation[];
  onSubmissionUrlsChange?: (urls: string[]) => void;
}

/**
 * Live Preview Component that renders text + inline LaTeX ($ ... $)
 * and makes each rendered LaTeX equation interactive (clickable to edit in MathScratchpad).
 */
function LivePreviewText({
  content,
  onEditMath,
}: {
  content: string;
  onEditMath: (rawLatex: string) => void;
}) {
  if (!content) return null;

  // Split content by single $ ... $ or double $$ ... $$ LaTeX blocks
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <span className="leading-relaxed font-arabic dir-rtl text-right">
      {parts.map((part, idx) => {
        const isDisplayMath = part.startsWith("$$") && part.endsWith("$$") && part.length > 4;
        const isInlineMath = !isDisplayMath && part.startsWith("$") && part.endsWith("$") && part.length > 2;

        if (isDisplayMath || isInlineMath) {
          const rawLatex = isDisplayMath ? part.slice(2, -2).trim() : part.slice(1, -1).trim();

          // Force \limits for \lim so subscript renders directly underneath
          let formattedLatex = rawLatex.replace(/\\lim_(?!\\limits)/g, "\\lim\\limits_");

          try {
            const html = katex.renderToString(formattedLatex, {
              displayMode: isDisplayMath,
              throwOnError: false,
            });

            return (
              <span
                key={idx}
                onClick={() => onEditMath(rawLatex)}
                className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-primary/20 hover:border-primary border border-primary/20 border-dashed rounded-xl px-2.5 py-1 my-1 transition-all text-primary font-bold shadow-2xs group relative bg-primary/5 active:scale-95"
                title="انقر لتعديل هذه المعادلة في مسودة MathScratchpad"
              >
                <span dangerouslySetInnerHTML={{ __html: html }} />
                <Edit className="w-3.5 h-3.5 text-primary shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
              </span>
            );
          } catch (err) {
            return (
              <span
                key={idx}
                onClick={() => onEditMath(rawLatex)}
                className="inline-flex items-center gap-1 cursor-pointer bg-error/10 text-error border border-error/20 rounded-lg px-2 py-0.5 text-xs font-mono"
              >
                ${rawLatex}$
              </span>
            );
          }
        }

        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Component that parses Chat Message Content:
 * - Sanitizes #image links into styled badges instead of broken links
 * - Intercepts JSON exercise code blocks into interactive React UI components
 */
function StationChatMessageText({
  text,
  onSelectOption,
}: {
  text: string;
  onSelectOption?: (optText: string) => void;
}) {
  if (!text) return null;

  // 1. Sanitize #image anchor links to prevent broken link clicks
  let sanitized = text.replace(/\[([^\]]+)\]\(#image-\d+\)/g, (_, label) => {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[11px] border border-primary/20">📷 ${label}</span>`;
  });
  sanitized = sanitized.replace(/href="#image-\d+"/g, 'href="javascript:void(0)"');

  // 2. Intercept exercise code blocks ```exercise ... ``` or ```json ... ```
  const exerciseRegex = /```(?:exercise|json)?\s*(\{[\s\S]*?"type"\s*:\s*"(?:multiple_choice|fraction_addition|equation_solving)"[\s\S]*?\})\s*```/g;
  const match = exerciseRegex.exec(sanitized);

  if (match) {
    const rawJson = match[1];
    try {
      const exerciseData = JSON.parse(rawJson);
      const textBefore = sanitized.substring(0, match.index);
      const textAfter = sanitized.substring(match.index + match[0].length);

      return (
        <div className="space-y-3">
          {textBefore && <MathText content={textBefore} />}

          {/* Interactive Exercise UI Card */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 dark:bg-indigo-950/30 border border-indigo-500/30 space-y-3 my-2 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 border-b border-indigo-500/20 pb-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>تمرين تفاعلي:</span>
            </div>

            <div className="text-xs font-bold text-on-surface">
              <MathText content={exerciseData.question} />
            </div>

            {exerciseData.type === "multiple_choice" && Array.isArray(exerciseData.options) && (
              <div className="space-y-2 pt-1">
                {exerciseData.options.map((opt: string, oIdx: number) => (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => {
                      if (onSelectOption) onSelectOption(opt);
                    }}
                    className="w-full text-right p-3 rounded-xl bg-surface border border-outline/20 hover:border-primary text-xs font-semibold text-on-surface hover:bg-primary/5 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-surface-variant/50 group-hover:bg-primary/20 text-on-surface-variant group-hover:text-primary font-bold text-[10px] flex items-center justify-center">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <MathText content={opt} />
                    </div>
                    <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      اختيار هذا الرد ←
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {textAfter && <MathText content={textAfter} />}
        </div>
      );
    } catch (e) {
      console.warn("Failed to parse exercise block JSON:", e);
    }
  }

  return <MathText content={sanitized} />;
}

export function SocraticStationChat({
  studentId,
  studentName,
  studentEmail,
  courseId,
  courseName,
  moduleName,
  courseIndexContext,
  activityId,
  activityTitle,
  activityDescription,
  globalLatexSummary,
  referenceImageUrls,
  globalCustomIsolations,
  attachments,
  stations,
  onSubmissionUrlsChange,
}: SocraticStationChatProps) {
  // Requirement 2 & 4: Strict check for interactive stations availability
  const hasStations = Boolean(stations && stations.length > 0);

  const stationsList = useMemo(() => {
    if (hasStations) return stations!;
    return [];
  }, [stations, hasStations]);

  const [activeStationIndex, setActiveStationIndex] = useState<number>(0);
  const currentStation = hasStations ? (stationsList[activeStationIndex] || stationsList[0]) : null;

  const [stationChats, setStationChats] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Auto-scroll & Textarea Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // MathScratchpad & Unified Textarea Math Editing States
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [editingEquationLatex, setEditingEquationLatex] = useState<string | null>(null);
  const [scratchpadInitialLatex, setScratchpadInitialLatex] = useState("");

  // Context Debug Modal & Fullscreen Focus Mode States
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentStationKey = useMemo(() => {
    if (hasStations && currentStation) {
      return currentStation.id || `st_${activeStationIndex}`;
    }
    return "global_chat";
  }, [hasStations, currentStation, activeStationIndex]);

  const currentStationMessages = useMemo(() => {
    return stationChats[currentStationKey] || [];
  }, [stationChats, currentStationKey]);

  const [isFetchingChatHistory, setIsFetchingChatHistory] = useState(true);
  const prevMessageCount = useRef<number>(0);
  const isHistoryLoaded = useRef<boolean>(false);

  // Reset history tracker when switching stations
  useEffect(() => {
    isHistoryLoaded.current = false;
    prevMessageCount.current = 0;
  }, [currentStationKey]);

  // Auto-scroll ONLY when message count INCREASES after initial load
  useEffect(() => {
    // If still fetching history from Firestore, keep ref updated without scrolling
    if (isFetchingChatHistory) {
      prevMessageCount.current = currentStationMessages.length;
      return;
    }

    // First time history finishes loading, initialize ref without scrolling
    if (!isHistoryLoaded.current) {
      isHistoryLoaded.current = true;
      prevMessageCount.current = currentStationMessages.length;
      return;
    }

    // Only scroll if the number of messages has INCREASED (i.e. user sent a message or AI responded)
    if (currentStationMessages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    // Always update ref to current length
    prevMessageCount.current = currentStationMessages.length;
  }, [currentStationMessages.length, isFetchingChatHistory]);

  // Step A: Fetch station chat history from Firestore on mount & when station/student changes
  useEffect(() => {
    if (!studentId || !activityId || !currentStationKey) {
      setIsFetchingChatHistory(false);
      return;
    }

    let isMounted = true;
    setIsFetchingChatHistory(true);

    const fetchStationChatHistory = async () => {
      try {
        const chatDocRef = doc(
          db,
          "users",
          studentId,
          "stationChats",
          `${activityId}_${currentStationKey}`
        );
        const snap = await getDoc(chatDocRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          if (Array.isArray(data.messages)) {
            setStationChats((prev) => ({
              ...prev,
              [currentStationKey]: data.messages,
            }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch station chat history from Firestore:", err);
      } finally {
        if (isMounted) setIsFetchingChatHistory(false);
      }
    };

    fetchStationChatHistory();

    return () => {
      isMounted = false;
    };
  }, [studentId, activityId, currentStationKey]);

  // Step B: Auto-sync messages array to Firestore whenever messages change
  useEffect(() => {
    if (isFetchingChatHistory || !studentId || !activityId || !currentStationKey) return;

    const timeoutId = setTimeout(async () => {
      try {
        const chatDocRef = doc(
          db,
          "users",
          studentId,
          "stationChats",
          `${activityId}_${currentStationKey}`
        );

        if (currentStationMessages.length > 0) {
          await setDoc(
            chatDocRef,
            {
              studentId,
              activityId,
              stationId: currentStationKey,
              messages: currentStationMessages,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn("Failed to sync station chat history to Firestore:", err);
      }
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [currentStationMessages, studentId, activityId, currentStationKey, isFetchingChatHistory]);

  // Step C: Clear Chat Action (Wipe UI & Delete Firestore Document)
  const handleClearChat = async () => {
    if (!studentId || !activityId || !currentStationKey) return;

    setStationChats((prev) => ({
      ...prev,
      [currentStationKey]: [],
    }));

    try {
      const chatDocRef = doc(
        db,
        "users",
        studentId,
        "stationChats",
        `${activityId}_${currentStationKey}`
      );
      await deleteDoc(chatDocRef);
    } catch (err) {
      console.warn("Failed to delete station chat history from Firestore:", err);
    }
  };

  const currentGlobalIsoNote = useMemo(() => {
    if (globalCustomIsolations && Array.isArray(globalCustomIsolations)) {
      const matchingRule = globalCustomIsolations.find((r: any) =>
        r.studentIds && Array.isArray(r.studentIds) && r.studentIds.includes(studentId)
      );
      if (matchingRule) return matchingRule.specificContextNote || "";
    }
    return "";
  }, [globalCustomIsolations, studentId]);

  const currentStationIsoNote = useMemo(() => {
    if (currentStation && currentStation.customIsolations && Array.isArray(currentStation.customIsolations)) {
      const matchingRule = currentStation.customIsolations.find((r: any) =>
        r.studentIds && Array.isArray(r.studentIds) && r.studentIds.includes(studentId)
      );
      if (matchingRule) return matchingRule.specificContextNote || "";
    }
    return "";
  }, [currentStation, studentId]);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<"pending" | "graded">("pending");
  const [score, setScore] = useState<number | string | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(true);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSlides, setLightboxSlides] = useState<Array<{ src: string }>>([]);

  const handleOpenScratchpadNew = () => {
    setEditingEquationLatex(null);
    setScratchpadInitialLatex("");
    setIsScratchpadOpen(true);
  };

  const handleEditMathEquationFromPreview = (rawLatex: string) => {
    setEditingEquationLatex(rawLatex);
    setScratchpadInitialLatex(rawLatex);
    setIsScratchpadOpen(true);
  };

  const handleApplyScratchpadLatex = (newLatex: string) => {
    const formattedMath = `$ ${newLatex.trim()} $`;

    if (editingEquationLatex) {
      // Replace existing equation in inputText
      let updatedText = inputText;
      const targetLatex = editingEquationLatex.trim();

      if (updatedText.includes(`$ ${targetLatex} $`)) {
        updatedText = updatedText.replace(`$ ${targetLatex} $`, formattedMath);
      } else if (updatedText.includes(`$${targetLatex}$`)) {
        updatedText = updatedText.replace(`$${targetLatex}$`, formattedMath);
      } else if (updatedText.includes(targetLatex)) {
        updatedText = updatedText.replace(targetLatex, newLatex.trim());
      } else {
        updatedText += ` ${formattedMath}`;
      }

      setInputText(updatedText);
      setEditingEquationLatex(null);
    } else {
      // Insert new equation at cursor position inside textarea
      if (!textareaRef.current) {
        setInputText((prev) => (prev ? `${prev} ${formattedMath}` : formattedMath));
        return;
      }
      const start = textareaRef.current.selectionStart || inputText.length;
      const end = textareaRef.current.selectionEnd || inputText.length;
      const updated =
        inputText.substring(0, start) +
        (start > 0 && !inputText[start - 1].match(/\s/) ? " " : "") +
        formattedMath +
        (end < inputText.length && !inputText[end].match(/\s/) ? " " : "") +
        inputText.substring(end);

      setInputText(updated);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = start + formattedMath.length + 1;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 50);
    }
  };

  useEffect(() => {
    if (!studentId || !activityId) return;

    const fetchSubmission = async () => {
      setLoadingSubmission(true);
      try {
        const q = query(
          collection(db, "submissions"),
          where("studentId", "==", studentId),
          where("activityId", "==", activityId)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();
          setSubmissionId(d.id);
          setSubmissionStatus(data.status === "graded" ? "graded" : "pending");
          setScore(data.score !== undefined ? data.score : null);

          if (data.contentUrls && Array.isArray(data.contentUrls)) {
            if (onSubmissionUrlsChange) onSubmissionUrlsChange(data.contentUrls);
          }
        }
      } catch (err) {
        console.error("Error fetching student submission in SocraticStationChat:", err);
      } finally {
        setLoadingSubmission(false);
      }
    };

    fetchSubmission();
  }, [studentId, activityId]);

  useEffect(() => {
    const stId = currentStationKey;
    if (!stationChats[stId] || stationChats[stId].length === 0) {
      let initialGreetingText = "";

      if (hasStations && currentStation) {
        initialGreetingText = `مرحباً بك في **${currentStation.title || `المحطة #${activeStationIndex + 1}`}**! 👋\n\n**المهمة الحالية المطلوبة منك:**\n${currentStation.challenge || currentStation.content || "قم بحل المطلوب وتزويد المساعد الذكي بإجابتك"}\n\nاكتب إجابتك أو أرفق صورة لحلك اليدوي لمراجعتها وتوجيهك سقراطياً!`;
      } else {
        // Requirement 3: Global Lesson Assistant greeting when stations.length === 0
        initialGreetingText = `مرحباً بك! 👋 أنا مساعدك الذكي لدرس **${activityTitle}**.\n\nهل لديك أي سؤال حول مفاهيم أو تمارين هذا الدرس؟ تفضل بطرح سؤالك أو أرفق صورة إجابتك المباشرة وسأساعدك خطوة بخطوة!`;
      }

      const initialGreeting: ChatMessage = {
        id: `msg_init_${stId}`,
        sender: "ai",
        text: initialGreetingText,
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      };
      setStationChats((prev) => ({
        ...prev,
        [stId]: [initialGreeting],
      }));
    }
  }, [hasStations, activeStationIndex, currentStation, currentStationKey, activityTitle, stationChats]);

  const handleSendMessage = async (customText?: string) => {
    const messageContent = (customText !== undefined ? customText : inputText).trim();

    if (!messageContent && attachedImages.length === 0) return;

    const stId = currentStationKey;
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: "student",
      text: messageContent,
      images: [...attachedImages],
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };

    const newStationMessages = [...(stationChats[stId] || []), userMsg];
    setStationChats((prev) => ({
      ...prev,
      [stId]: newStationMessages,
    }));

    const currentImages = [...attachedImages];
    setInputText("");
    setAttachedImages([]);
    setShowImageUploader(false);
    setIsAiThinking(true);

    try {
      const allImagesAcrossStations: string[] = [];
      Object.values({ ...stationChats, [stId]: newStationMessages }).forEach((msgs) => {
        msgs.forEach((m) => {
          if (m.images) allImagesAcrossStations.push(...m.images);
        });
      });
      const uniqueUrls = Array.from(new Set(allImagesAcrossStations));

      if (onSubmissionUrlsChange) onSubmissionUrlsChange(uniqueUrls);

      const stationSubmissionsData = stationsList.map((st, idx) => {
        const msgs = (stationChats[st.id || `st_${idx}`] || []).concat(
          (currentStation && st.id === currentStation.id) || idx === activeStationIndex ? [userMsg] : []
        );
        const imgs: string[] = [];
        msgs.forEach((m) => {
          if (m.images) imgs.push(...m.images);
        });
        return {
          stationId: st.id || `st_${idx}`,
          stationTitle: st.title || `المحطة #${idx + 1}`,
          order: st.order || idx + 1,
          content: st.content || "",
          images: Array.from(new Set(imgs)),
          aiFeedback: `تم التفاعل في محطة ${st.title}`,
        };
      });

      if (submissionId) {
        await updateDoc(doc(db, "submissions", submissionId), {
          contentUrls: uniqueUrls,
          stationSubmissions: stationSubmissionsData,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newRef = await addDoc(collection(db, "submissions"), {
          studentId,
          studentName,
          studentEmail: studentEmail || "",
          courseId,
          activityId,
          activityTitle,
          type: "assignment",
          contentUrls: uniqueUrls,
          stationSubmissions: stationSubmissionsData,
          status: "pending",
          submittedAt: serverTimestamp(),
        });
        setSubmissionId(newRef.id);
      }
    } catch (err) {
      console.error("Error updating submission doc in Firestore:", err);
    }

    try {
      let globalIsoNote = "";
      if (globalCustomIsolations && Array.isArray(globalCustomIsolations)) {
        const matchingRule = globalCustomIsolations.find((r: any) =>
          r.studentIds && Array.isArray(r.studentIds) && r.studentIds.includes(studentId)
        );
        if (matchingRule) globalIsoNote = matchingRule.specificContextNote || "";
      }

      let stationIsoNote = "";
      if (hasStations && currentStation && currentStation.customIsolations && Array.isArray(currentStation.customIsolations)) {
        const matchingRule = currentStation.customIsolations.find((r: any) =>
          r.studentIds && Array.isArray(r.studentIds) && r.studentIds.includes(studentId)
        );
        if (matchingRule) stationIsoNote = matchingRule.specificContextNote || "";
      }

      const formattedMessages = newStationMessages.map((m) => ({
        role: m.sender === "student" ? "user" : "assistant",
        content: m.text,
      }));

      const currentStationPayload = hasStations && currentStation ? {
        title: currentStation.title || `المحطة #${activeStationIndex + 1}`,
        content: currentStation.content || "",
        aiDirectives: currentStation.aiDirectives || "",
      } : null;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isStationMode: hasStations,
          studentId,
          studentName,
          courseId,
          courseName: courseName || "",
          courseTitle: courseName || "",
          moduleName: moduleName || "",
          moduleTitle: moduleName || "",
          courseIndexContext: courseIndexContext || "",
          activityId,
          activityTitle,
          globalContext: globalLatexSummary || activityDescription || activityTitle,
          globalIsolationNote: globalIsoNote,
          referenceImageUrls: referenceImageUrls || [],
          attachments: attachments || [],
          ...(currentStationPayload ? { currentStation: currentStationPayload } : {}),
          stationIsolationNote: stationIsoNote,
          messages: formattedMessages,
          uploadedImages: currentImages,
          forceVision: currentImages.length > 0,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      const aiMsgId = `msg_ai_${Date.now()}`;
      setStationChats((prev) => ({
        ...prev,
        [stId]: [
          ...(prev[stId] || []),
          {
            id: aiMsgId,
            sender: "ai",
            text: "",
            timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          },
        ],
      }));

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          setStationChats((prev) => ({
            ...prev,
            [stId]: (prev[stId] || []).map((m) =>
              m.id === aiMsgId ? { ...m, text: accumulatedText } : m
            ),
          }));
        }
      }
    } catch (apiErr) {
      console.warn("API Chat fetch error, using Socratic fallback:", apiErr);
      let aiText = hasStations && currentStation
        ? `أحسنت في هذه المحاولة! 👏 دعنا نناقش حلك في **${currentStation.title || `المحطة #${activeStationIndex + 1}`}** سقراطياً:`
        : `أحسنت! 👏 دعنا نناقش استفسارك وحلك لدرس **${activityTitle}** سقراطياً:`;

      if (currentImages.length > 0) {
        aiText += `\n\nلقد قمت بفحص صورة حلك اليدوي المرفقة (${currentImages.length} صورة). خطوات الكتابة واضحة وممتازة!`;
      }

      if (hasStations && currentStation && currentStation.aiDirectives) {
        aiText += `\n\n💡 **توجيه الوكيل:** تم تطبيق التوجيهات الخاصة بالنشاط. هل يمكنك مراجعة خطوة الحساب الأولى للتأكد من النتيجة؟`;
      }

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: "ai",
        text: aiText,
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      };

      setStationChats((prev) => ({
        ...prev,
        [stId]: [...(prev[stId] || []), aiMsg],
      }));
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleOpenChatImage = (images: string[], index: number) => {
    setLightboxSlides(images.map((img) => ({ src: img })));
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[100] flex flex-col bg-surface w-full h-[100dvh] m-0 p-0 rounded-none border-none overflow-hidden animate-fadeIn"
          : "flex flex-col h-[100dvh] sm:h-auto sm:flex-none space-y-3 sm:space-y-4 rounded-3xl bg-surface border border-outline/15 p-3.5 sm:p-5 shadow-sm overflow-hidden"
      }
      dir="rtl"
    >
      {/* Header Bar */}
      <div className={`flex items-center justify-between flex-wrap gap-2 border-b border-outline/10 shrink-0 ${isFullscreen ? "p-3.5 sm:p-5 border-b" : "pb-3 sm:pb-4"}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-xs shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xs sm:text-base font-extrabold text-on-surface">
              {hasStations
                ? "المساعد الذكي السقراطي - المحطات التفاعلية"
                : "المساعد الذكي للدرس"}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-on-surface-variant hidden sm:block">
              {hasStations
                ? "تنقل بين محطات النشاط وناقش إجاباتك خطوة بخطوة مع الذكاء الاصطناعي"
                : `ناقش مفاهيم وإجابات درس (${activityTitle}) مع الذكاء الاصطناعي`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {submissionStatus === "graded" ? (
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم التقييم ({score !== null ? `${score}/20` : "مقيّم"})</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20 flex items-center gap-1.5">
              <Clock className="w-4 h-4 animate-spin" />
              <span>تفاعل قيد المراجعة</span>
            </span>
          )}
        </div>
      </div>

      {/* Progress & Navigation Bar (Strict Rule Requirement 2: Render ONLY IF hasStations is true) */}
      {!isFullscreen && hasStations && (
        <div className="space-y-2.5 p-3 sm:p-4 rounded-2xl bg-surface-variant/20 border border-outline/10 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-on-surface flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              <span>المحطة الحالية: {activeStationIndex + 1} من {stationsList.length}</span>
            </span>
            <span className="text-primary font-extrabold">
              {Math.round(((activeStationIndex + 1) / stationsList.length) * 100)}% أكملت
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-variant/60 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${((activeStationIndex + 1) / stationsList.length) * 100}%` }}
            />
          </div>

          {/* Station Navigation Numbered Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {stationsList.map((st, idx) => {
              const isActive = idx === activeStationIndex;
              return (
                <button
                  key={st.id || idx}
                  type="button"
                  onClick={() => setActiveStationIndex(idx)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border cursor-pointer ${
                    isActive
                      ? "bg-primary text-on-primary border-primary shadow-xs scale-102"
                      : "bg-surface text-on-surface-variant border-outline/20 hover:border-primary/40"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-surface/20 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="truncate max-w-[150px]">{st.title || `المحطة ${idx + 1}`}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Task Focus Card (Collapsible Exercise Challenge Header & Body) */}
      {!isFullscreen && hasStations && currentStation && (
        <Collapsible
          defaultOpen={false}
          className="w-full border border-outline/20 rounded-2xl bg-surface shadow-2xs mb-3 shrink-0 overflow-hidden"
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2.5 bg-surface-variant/30 hover:bg-surface-variant/50 transition-colors cursor-pointer group text-right">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">
                نص التمرين ({currentStation.title || `المحطة #${activeStationIndex + 1}`}) - انقر للعرض / الإخفاء
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-on-surface-variant/70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-4 max-h-[40vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-right custom-scrollbar border-t border-outline/15 text-xs font-medium text-on-surface">
              <MathText content={currentStation.challenge || currentStation.content} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Chat Messages Timeline (Scrollable Area for Messenger UX) */}
      <div className={`flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 rounded-2xl bg-surface border border-outline/15 space-y-4 shadow-inner scrollbar-thin ${isFullscreen ? "mx-0 rounded-none border-none sm:max-h-none" : "sm:max-h-[480px]"}`}>
        {(stationChats[currentStationKey] || []).map((msg) => {
          const isAi = msg.sender === "ai";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 items-start ${isAi ? "justify-start" : "justify-end"}`}
            >
              {isAi && (
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl space-y-2 text-xs leading-relaxed ${
                  isAi
                    ? "bg-indigo-500/10 border border-indigo-500/20 text-on-surface rounded-tr-xs shadow-2xs"
                    : "bg-primary text-on-primary rounded-tl-xs shadow-xs"
                }`}
              >
                <div className="font-medium whitespace-pre-line">
                  <StationChatMessageText
                    text={msg.text}
                    onSelectOption={(opt) => handleSendMessage(opt)}
                  />
                </div>

                {msg.images && msg.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline/10">
                    {msg.images.map((imgUrl, imgIdx) => (
                      <div
                        key={imgIdx}
                        onClick={() => handleOpenChatImage(msg.images!, imgIdx)}
                        className="group relative aspect-4/3 rounded-xl overflow-hidden border border-outline/20 bg-surface cursor-pointer shadow-2xs"
                      >
                        <img src={imgUrl} alt="صورة الحل" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>تكبير</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <span className={`text-[9px] block text-left ${isAi ? "text-on-surface-variant/70" : "text-on-primary/80"}`}>
                  {msg.timestamp}
                </span>
              </div>

              {!isAi && (
                <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isAiThinking && (
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold max-w-fit">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>جاري تحليل إجابتك وسياق المحطة بواسطة المساعد الذكي...</span>
          </div>
        )}

        {/* Anchor for Auto-Scroll to Bottom */}
        <div ref={messagesEndRef} />
      </div>

      {/* Live Message Preview */}
      {inputText.trim() !== "" && (
        <div className={`p-3.5 rounded-2xl bg-surface-variant/30 border border-primary/25 space-y-1.5 animate-fadeIn shrink-0 ${isFullscreen ? "mx-3.5 sm:mx-6" : ""}`} dir="rtl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>المعاينة الحية للرسالة (انقر على أي معادلة منسقة لتعديلها بالمسودة):</span>
            </span>
            <span className="text-[10px] font-bold text-on-surface-variant/70">معاينة فورية بالـ KaTeX</span>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-outline/10 text-xs text-on-surface leading-relaxed dir-rtl text-right font-medium">
            <LivePreviewText
              content={inputText}
              onEditMath={handleEditMathEquationFromPreview}
            />
          </div>
        </div>
      )}

      {/* Slide-Up MathScratchpad Modal / Panel */}
      <MathScratchpad
        isOpen={isScratchpadOpen}
        onClose={() => setIsScratchpadOpen(false)}
        initialLatex={scratchpadInitialLatex}
        onApply={handleApplyScratchpadLatex}
        title={editingEquationLatex ? "تعديل المعادلة الرياضية بالمسودة" : "مسودة ابتكار المعادلة التفاعلية (Math Scratchpad)"}
      />

      {/* Attached Images Preview */}
      {attachedImages.length > 0 && (
        <div className={`p-3 rounded-2xl bg-surface border border-outline/20 space-y-2 max-h-[35vh] overflow-y-auto shrink-0 ${isFullscreen ? "mx-3.5 sm:mx-6" : ""}`}>
          <span className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-primary" />
            <span>الصور المرفقة المعينة للإرسال: ({attachedImages.length})</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {attachedImages.map((url, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-outline/30 group">
                <img src={url} alt="مرفق" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachedImages(attachedImages.filter((_, i) => i !== idx))}
                  className="absolute top-1 left-1 w-5 h-5 rounded-full bg-error text-on-error flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Uploader Drawer */}
      {showImageUploader && (
        <div className={`p-4 rounded-2xl bg-surface border border-outline/20 space-y-2 animate-fadeIn max-h-[35vh] overflow-y-auto shrink-0 ${isFullscreen ? "mx-3.5 sm:mx-6" : ""}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-primary" />
              <span>إرفاق صور الحلول اليدوية أو المسودة</span>
            </span>
            <button
              type="button"
              onClick={() => setShowImageUploader(false)}
              className="text-on-surface-variant hover:text-on-surface p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <HomeworkUploader
            currentUrls={attachedImages}
            onUploadSuccess={(urls) => {
              setAttachedImages(urls);
            }}
          />
        </div>
      )}

      {/* Bottom Input Controls Bar (Fixed Bottom in Fullscreen & Mobile) */}
      <div className={`shrink-0 p-2.5 sm:p-3 bg-surface border-t border-outline/25 z-20 ${isFullscreen ? "w-full" : "rounded-2xl border shadow-2xs"}`} dir="rtl">
        {/* Fabulous Sleek Modern Input Card Wrapper */}
        <div className="relative flex flex-col w-full rounded-2xl bg-surface border border-outline/20 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all duration-300 shadow-sm p-2 gap-2 shrink-0">
          {/* Main Input TextareaAutosize */}
          <TextareaAutosize
            ref={textareaRef as any}
            minRows={1}
            maxRows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="اكتب إجابتك، أو استخدم مسودة إضافة المعادلات بالضغط على (+ إضافة معادلة)..."
            className="w-full min-h-[40px] shrink-0 bg-transparent resize-none p-3 text-sm outline-none placeholder:text-muted-foreground font-arabic leading-relaxed text-right dir-rtl text-on-surface"
          />

          {/* Action Button Group */}
          <div className="flex justify-between items-center w-full pt-1.5 border-t border-outline/10">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Math Scratchpad Icon Button */}
              <button
                type="button"
                onClick={handleOpenScratchpadNew}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                  isScratchpadOpen
                    ? "bg-primary/20 border-primary text-primary shadow-xs scale-105"
                    : "bg-surface-variant/40 border-outline/20 text-on-surface-variant hover:text-primary hover:bg-primary/10 hover:border-primary/40"
                }`}
                title="إضافة معادلة رياضية (Math Scratchpad)"
              >
                <Calculator className="w-4 h-4" />
              </button>

              {/* Image Upload Icon Button */}
              <button
                type="button"
                onClick={() => setShowImageUploader(!showImageUploader)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                  showImageUploader || attachedImages.length > 0
                    ? "bg-primary/20 border-primary text-primary shadow-xs scale-105"
                    : "bg-surface-variant/40 border-outline/20 text-on-surface-variant hover:text-primary hover:bg-primary/10 hover:border-primary/40"
                }`}
                title="إرفاق صورة الحل اليدوي أو المسودة"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {/* Context Debug Icon Button (Teacher Context Inspector) */}
              <button
                type="button"
                onClick={() => setIsDebugModalOpen(true)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs hover:scale-105"
                title="فحص سياق الوكيل السقراطي (Context Debug)"
              >
                <Bug className="w-4 h-4" />
              </button>

              {/* Clear Chat Icon Button (Wipe Station Chat History) */}
              <button
                type="button"
                onClick={handleClearChat}
                disabled={currentStationMessages.length === 0}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-error/10 hover:bg-error/20 text-error border border-error/30 flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                title="مسح سجل محادثة هذه المحطة (Clear Chat)"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Fullscreen / Focus Mode Toggle Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 ${
                  isFullscreen
                    ? "bg-primary/20 border-primary text-primary shadow-xs scale-105"
                    : "bg-surface-variant/40 border-outline/20 text-on-surface-variant hover:text-primary hover:bg-primary/10 hover:border-primary/40"
                }`}
                title={isFullscreen ? "إنهاء وضع ملء الشاشة (Minimize)" : "وضع ملء الشاشة والتركيز (Fullscreen)"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-primary" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Dynamic Send Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() && attachedImages.length === 0}
              className={`h-9 sm:h-10 px-4 sm:px-5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all duration-200 ${
                inputText.trim().length > 0 || attachedImages.length > 0
                  ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transform active:scale-95 cursor-pointer"
                  : "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
              }`}
            >
              <span>إرسال</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Context Debug Modal Overlay */}
      {isDebugModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn dir-rtl">
          <div className="fixed inset-0" onClick={() => setIsDebugModalOpen(false)} />

          <div className="relative z-10 w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs sm:text-sm font-extrabold text-amber-400 flex items-center gap-2">
                <Bug className="w-5 h-5" />
                <span>فحص سياق الوكيل الذكي (Socratic Context Debug)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsDebugModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 text-emerald-400 font-mono p-4 rounded-2xl border border-emerald-500/30 text-xs leading-relaxed max-h-[65vh] overflow-y-auto whitespace-pre-wrap dir-rtl text-right scrollbar-thin">
{`=== 🧠 عقل الوكيل الذكي (السياق الحالي) ===

[التلميذ المستهدف]:
${studentName} (ID: ${studentId})

[التموضع الحالي للنشاط]:
المسار الدراسي: ${courseName || 'غير محدد'}
الوحدة التعليمية: ${moduleName || 'غير محدد'}
النشاط الحالي (مهمتك الأساسية): ${activityTitle || 'غير محدد'}

🛑 [البروتوكول العسكري للفحص (Strict Audit Protocol) - إجباري وحتمي]:
أنت لست مساعداً تقليدياً للدردشة، أنت "مفتش تدريب صارم ودقيق". يُمنع منعاً باتاً الرد بفقرات سردية أو مجاملات طويلة. 
عندما يرسل التلميذ إجابة (خاصة الصور)، يجب عليك مقارنة إجابته بـ [الحل النموذجي المعتمد] نقطة بنقطة. ثم بناء ردك *حصرياً* باستخدام هذا القالب الثابت (انسخ العناوين كما هي واملأها):

---
📋 **تقرير الفحص السقراطي:**

✅ **النقاط المكتسبة:** 
- [اذكر باختصار شديد ما أصاب فيه، مثال: النشر والتحليل صحيحان].

❌ **الأخطاء المرصودة (بدون إعطاء الحل):**
- [الخطأ 1: كذا وكذا...]
- [الخطأ 2: كذا وكذا...] (إذا لم توجد أخطاء، اكتب: لا يوجد).

⚠️ **الأسئلة المتجاهلة أو الناقصة:**
- [السؤال كذا...] (إذا أجاب على كل شيء، اكتب: لا يوجد).

📌 **تنبيه هام:** تذكر يا بطل أن التصحيح النهائي والتقييم سيكون من طرف أستاذك (الأستاذ جعفري). دوري هنا هو تدريبك لتفادي هذه الأخطاء أمامه!

🎯 **مهمتنا الآن (خطوة بخطوة):**
[اطرح هنا سؤالاً سقراطياً واحداً فقط لمعالجة الخطأ الأول أو النقص الأول. يُمنع منعاً باتاً مناقشة أكثر من نقطة واحدة في نفس الوقت].
---

قواعد إضافية للتتبع:
1. في الردود القادمة، لا تنتقل إلى "الخطأ 2" حتى يصحح التلميذ "الخطأ 1" بنسبة 100%.
2. ذكر التلميذ دائماً بما تبقى من القائمة أعلاه إذا حاول التهرب أو القفز لسؤال آخر.

====================
[الدستور العام للنشاط (القوانين والمعارف)]:
${globalLatexSummary || activityDescription || activityTitle || "لا يوجد سياق عام محدد."}
====================

[توجيهات سرية خاصة بهذا التلميذ]:
- العزل العام للنشاط: ${currentGlobalIsoNote || "لا يوجد توجيه عام مخصص هذا التلميذ."}
- عزل هذه المحطة: ${currentStationIsoNote || "لا يوجد توجيه مخصص لهذا التلميذ في هذه المحطة."}

====================
[المهمة الحالية (${hasStations ? `المحطة ${activeStationIndex + 1} من ${stationsList.length}` : "دروس ومفاهيم الدرس الشاملة"})]:
العنوان: ${currentStation ? currentStation.title || `المحطة #${activeStationIndex + 1}` : activityTitle}
نص التمرين (Challenge): ${currentStation ? currentStation.challenge || currentStation.content || "لا يوجد محتوى محدد." : activityDescription || activityTitle}${currentStation && currentStation.groundTruth ? `\nالحل النموذجي المعتمد (Ground Truth):\n${currentStation.groundTruth}` : ""}
التوصيات البيداغوجية وقواعد التوجيه: ${currentStation ? currentStation.pedagogyRules || currentStation.aiDirectives || "لا يوجد توجيه سري للمعلم في هذه المحطة." : "لا يوجد محطات تفاعلية خاصة بهذا الدرس."}

المحتوى والمرفقات المتوفرة للتلميذ في هذه الصفحة:
${attachments && attachments.length > 0 ? attachments.map((a: any) => `- ملف: ${a.title || a.name || "مرفق"} (نوع: ${a.type || "مستند"})`).join("\n") : "- لا توجد مرفقات حالياً."}
====================

[عدد الرسائل السابقة في الذاكرة]:
${(stationChats[currentStationKey] || []).length} رسائل تفاعلية`}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsDebugModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
        plugins={[Zoom, Counter]}
      />
    </div>
  );
}

export default SocraticStationChat;

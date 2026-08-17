"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Bot, X, Send, Loader2, RefreshCw, Image as ImageIcon } from "lucide-react";
import { MathText } from "@/src/components/admin/activities/StudentPreview";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AITutorWidgetProps {
  lessonTitle?: string;
  lessonSummary?: string;
  studentImages?: string[];
  latexContent?: string;
}

export function AITutorWidget({
  lessonTitle,
  lessonSummary,
  studentImages = [],
  latexContent = "",
}: AITutorWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-greeting",
      role: "assistant",
      content: `مرحباً بك! أنا مساعدك الذكي السقراطي لمادة الرياضيات في درس "${
        lessonTitle || "الرياضيات"
      }". يسعدني مساعدتك في تحليل حلك والإجابة عن تساؤلاتك حول الشرح! $ E = mc^2 $`,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: input.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          lessonContext: lessonTitle || "درس الرياضيات",
          lessonSummary: lessonSummary || "",
          studentImages: studentImages,
          latexContent: latexContent || "",
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

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error("AI Tutor Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content:
            error?.message ||
            "عذراً، حدث خطأ مؤقت في الاتصال بالمساعد الذكي. الرجاء المحاولة مجدداً.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl">
      {/* Floating Action Button (FAB) at Bottom-Left */}
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

      {/* Sleek Floating MD3 Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 left-6 z-40 w-80 sm:w-96 h-[520px] max-h-[80vh] bg-surface border border-outline/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn backdrop-blur-md">
          {/* Header */}
          <div className="p-4 bg-primary/10 border-b border-outline/15 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-on-surface flex items-center gap-1.5">
                  <span>المساعد الذكي للدرس</span>
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </h3>
                <p className="text-[10px] font-semibold text-on-surface-variant truncate max-w-[180px]">
                  {lessonTitle || "شرح مادة الرياضيات"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="إغلاق النافذة"
              className="p-1.5 rounded-xl bg-surface-variant/40 text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Attached Images Indicator Banner */}
          {studentImages && studentImages.length > 0 && (
            <div className="px-4 py-1.5 bg-secondary/10 border-b border-secondary/20 text-secondary text-[11px] font-bold flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span>مرفق {studentImages.length} صورة من إجابة التلميذ (تحليل ملائم بالرؤية الذكية Gemini Vision)</span>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-surface-variant/10">
            {messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-start" : "items-end"}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-2xs ${
                      isUser
                        ? "bg-primary text-on-primary rounded-tr-xs"
                        : "bg-surface border border-outline/15 text-on-surface rounded-tl-xs"
                    }`}
                  >
                    <MathText content={msg.content} />
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface border border-outline/15 text-xs text-on-surface-variant w-fit">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>جاري تحليل الدرس والصور وصياغة التوجيه...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-surface border-t border-outline/15 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اسأل المساعد الذكي عن الشرح أو صورك المرفقة..."
              className="flex-1 h-10 px-3.5 rounded-xl bg-surface-variant/30 border border-outline/15 text-xs font-medium text-on-surface focus:outline-none focus:border-primary transition-colors"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 rounded-xl bg-primary text-on-primary disabled:opacity-40 hover:bg-primary/90 transition-all flex items-center justify-center shrink-0 shadow-xs"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default AITutorWidget;

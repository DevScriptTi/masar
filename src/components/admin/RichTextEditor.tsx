"use client";

import React from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="h-44 w-full rounded-2xl bg-surface-variant/20 border border-outline/20 animate-pulse flex items-center justify-center text-xs text-on-surface-variant font-medium">
      جاري تحميل المحرر التفاعلي...
    </div>
  ),
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ direction: "rtl" }],
    ["clean"],
  ],
};

const formats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "list",
  "direction",
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  return (
    <div className="rich-text-editor-wrapper rounded-2xl overflow-hidden border border-outline/20 bg-surface-variant/20 focus-within:border-primary transition-all" dir="rtl">
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder || "أدخل شرح وتفاصيل الدرس هنا..."}
        modules={modules}
        formats={formats}
      />
    </div>
  );
}

export default RichTextEditor;

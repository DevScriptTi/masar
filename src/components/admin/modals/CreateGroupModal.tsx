"use client";

import React, { useState, FormEvent } from "react";
import { createGroup } from "@/src/lib/firebase/groupsService";
import { Users, X, Loader2, Plus, FileText, CheckCircle2, AlertCircle } from "lucide-react";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateGroupModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("يرجى إدخال اسم الفوج.");
      return;
    }

    setLoading(true);

    try {
      await createGroup(name, description);
      setName("");
      setDescription("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating group:", error);
      setErrorMessage("حدث خطأ أثناء إنشاء الفوج. يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 transform scale-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline/10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-secondary-container text-on-secondary-container shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">إنشاء فوج تعليمي جديد</h2>
              <p className="text-xs text-on-surface-variant">تنظيم مخصص لتلاميذ ومجموعات الدراسة</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-variant focus:outline-none transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-2xl bg-error-container/70 border border-error/30 text-on-error-container text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-error shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Group Name Input */}
          <div className="space-y-2">
            <label htmlFor="groupName" className="block text-xs font-semibold text-on-surface-variant">
              اسم الفوج التعليمي <span className="text-error">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="groupName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: فوج العلوم التجريبية 1"
                disabled={loading}
                required
                className="w-full h-12 pr-11 pl-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-sm"
              />
              <Users className="absolute right-3.5 w-5 h-5 text-on-surface-variant/60 pointer-events-none" />
            </div>
          </div>

          {/* Group Description Input */}
          <div className="space-y-2">
            <label htmlFor="groupDesc" className="block text-xs font-semibold text-on-surface-variant">
              وصف الفوج (اختياري)
            </label>
            <div className="relative flex items-start">
              <textarea
                id="groupDesc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="أدخل وصفاً توضيحياً للفوج والمستوى الدراسي..."
                disabled={loading}
                className="w-full pr-11 pl-4 pt-3 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface placeholder:text-on-surface-variant/50 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-sm resize-none"
              />
              <FileText className="absolute right-3.5 top-3.5 w-5 h-5 text-on-surface-variant/60 pointer-events-none" />
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-outline/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 h-11 rounded-2xl bg-surface-variant/60 text-on-surface-variant font-semibold text-sm hover:bg-surface-variant transition-colors focus:outline-none"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 h-11 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 shadow-md transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>حفظ الفوج</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;

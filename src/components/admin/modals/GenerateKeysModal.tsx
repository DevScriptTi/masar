"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { fetchGroups, GroupDoc } from "@/src/lib/firebase/groupsService";
import { generateKeys } from "@/src/lib/firebase/keysService";
import { KeyRound, X, Loader2, Users, Hash, ChevronDown, AlertCircle } from "lucide-react";

interface GenerateKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GenerateKeysModal({
  isOpen,
  onClose,
  onSuccess,
}: GenerateKeysModalProps) {
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [quantity, setQuantity] = useState<number>(10);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch groups whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      loadGroups();
    }
  }, [isOpen]);

  const loadGroups = async () => {
    setLoadingGroups(true);
    setErrorMessage(null);
    try {
      const data = await fetchGroups();
      const activeGroups = data.filter(
        (g) => (g.status || "active") === "active"
      );
      setGroups(activeGroups);
      if (activeGroups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(activeGroups[0].name || activeGroups[0].id || "");
      }
    } catch (error) {
      console.error("Error loading groups:", error);
      setErrorMessage("تعذر جلب قائمة الأفواج من الفايرستور.");
    } finally {
      setLoadingGroups(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const targetGroup = selectedGroupId.trim();

    if (!targetGroup) {
      setErrorMessage("يرجى اختيار الفوج المستهدف.");
      return;
    }

    if (quantity < 1 || quantity > 50) {
      setErrorMessage("عدد المفاتيح يجب أن يكون بين 1 و 50 مفتاحاً.");
      return;
    }

    setGenerating(true);

    try {
      await generateKeys(targetGroup, quantity);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error generating keys:", error);
      setErrorMessage("حدث خطأ أثناء توليد المفاتيح. يرجى التثبت من الاتصال.");
    } finally {
      setGenerating(false);
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

      {/* Modal Dialog Container */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 transform scale-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline/10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary-container text-on-primary-container shadow-sm">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">توليد دفعة مفاتيح جديدة</h2>
              <p className="text-xs text-on-surface-variant">اختر الفوج وعدد المفاتيح المطلوبة</p>
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
          {/* Select Dropdown: Group ID (CRITICAL: Populated from Firestore groups) */}
          <div className="space-y-2">
            <label htmlFor="selectGroup" className="block text-xs font-semibold text-on-surface-variant">
              الفوج المستهدف <span className="text-error">*</span>
            </label>
            <div className="relative flex items-center">
              <select
                id="selectGroup"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                disabled={generating || loadingGroups}
                required
                className="w-full h-12 pr-11 pl-10 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-sm appearance-none cursor-pointer"
              >
                {loadingGroups ? (
                  <option value="">جاري تحميل الأفواج من الفايرستور...</option>
                ) : groups.length === 0 ? (
                  <option value="">لا توجد أفواج حالياً (أدخل اسماً جديداً)</option>
                ) : (
                  groups.map((g) => (
                    <option key={g.id || g.name} value={g.name || g.id}>
                      {g.name} {g.description ? `(${g.description})` : ""}
                    </option>
                  ))
                )}
              </select>
              <Users className="absolute right-3.5 w-5 h-5 text-on-surface-variant/60 pointer-events-none" />
              <ChevronDown className="absolute left-3.5 w-5 h-5 text-on-surface-variant/60 pointer-events-none" />
            </div>

            {/* Custom group name fallback input if no groups exist */}
            {groups.length === 0 && !loadingGroups && (
              <input
                type="text"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                placeholder="أدخل اسم الفوج (مثال: group_alfa)"
                className="w-full h-11 px-4 mt-2 rounded-xl bg-surface-variant/30 border border-outline/20 text-on-surface text-xs text-right focus:outline-none focus:border-primary"
              />
            )}
          </div>

          {/* Number Input: Quantity */}
          <div className="space-y-2">
            <label htmlFor="keyQuantity" className="block text-xs font-semibold text-on-surface-variant">
              عدد المفاتيح المطلوب (1 - 50) <span className="text-error">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="keyQuantity"
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                disabled={generating}
                required
                className="w-full h-12 pr-11 pl-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-sm font-semibold"
              />
              <Hash className="absolute right-3.5 w-5 h-5 text-on-surface-variant/60 pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-outline/10">
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="px-5 h-11 rounded-2xl bg-surface-variant/60 text-on-surface-variant font-semibold text-sm hover:bg-surface-variant transition-colors focus:outline-none"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={generating || loadingGroups}
              className="px-6 h-11 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/90 shadow-md transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-70"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التوليد...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>توليد المفاتيح</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GenerateKeysModal;

"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  fetchKeys,
  toggleKeyStatus,
  deleteKey,
  ActivationKeyDoc,
} from "@/src/lib/firebase/keysService";
import { GenerateKeysModal } from "@/src/components/admin/modals/GenerateKeysModal";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Users,
  MoreVertical,
  Power,
  Trash2,
  AlertTriangle,
  Ban,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

export default function KeysPage() {
  // Keys List States
  const [keysList, setKeysList] = useState<ActivationKeyDoc[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "used" | "disabled"
  >("all");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Action Menu & Modal States
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<ActivationKeyDoc | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Load keys on mount
  useEffect(() => {
    loadKeys();
  }, []);

  // Reset pagination whenever search query or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Close dropdown menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadKeys = async () => {
    setLoadingKeys(true);
    setErrorMessage(null);
    try {
      const data = await fetchKeys();
      setKeysList(data);
    } catch (error) {
      console.error("Error loading keys:", error);
      setErrorMessage("حدث خطأ أثناء جلب قائمة المفاتيح من الفايرستور.");
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleCopyKey = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(keyText);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleStatus = async (item: ActivationKeyDoc) => {
    if (!item.id) return;
    if (item.status === "used") {
      setErrorMessage("لا يمكن تغيير حالة مفتاح مستعمل.");
      setActiveMenuId(null);
      return;
    }

    setActiveMenuId(null);
    setActionLoadingId(item.id);
    setErrorMessage(null);

    try {
      await toggleKeyStatus(item.id, item.status);
      await loadKeys();
    } catch (error: any) {
      console.error("Error toggling key status:", error);
      setErrorMessage(
        error.message || "حدث خطأ أثناء تعديل حالة المفتاح."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDeleteKey = async () => {
    if (!deletingKey || !deletingKey.id) return;

    const keyId = deletingKey.id;
    setActionLoadingId(keyId);
    setErrorMessage(null);

    try {
      await deleteKey(keyId, deletingKey);
      setDeletingKey(null);
      await loadKeys();
    } catch (error) {
      console.error("Error deleting key:", error);
      setErrorMessage(
        "حدث خطأ أثناء حذف المفتاح والتحديث الآمن لصلاحيات التلميذ."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter keys based on search and status filter
  const filteredKeys = keysList.filter((k) => {
    const matchesSearch =
      k.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.groupId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ? true : k.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate pagination values
  const totalPages = Math.ceil(filteredKeys.length / itemsPerPage);
  const paginatedKeys = filteredKeys.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeCount = keysList.filter((k) => k.status === "active").length;
  const usedCount = keysList.filter((k) => k.status === "used").length;
  const disabledCount = keysList.filter((k) => k.status === "disabled").length;

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Generate Keys Modal Component */}
      <GenerateKeysModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onSuccess={loadKeys}
      />

      {/* Delete Key Confirmation / Severe Warning Modal (MD3 Dialog) */}
      {deletingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div
            onClick={() => setDeletingKey(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-md bg-surface border border-outline/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            {deletingKey.status === "used" ? (
              /* Severe Warning for Used Key Delete */
              <>
                <div className="flex items-center gap-3 text-error">
                  <div className="p-3.5 rounded-2xl bg-error-container text-on-error-container shrink-0">
                    <AlertTriangle className="w-7 h-7 text-error" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-on-surface">تحذير هام جداً!</h3>
                    <p className="text-xs text-error font-semibold">سحب صلاحيات دخول الفوج</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-error-container/40 border border-error/30 text-on-error-container text-xs font-semibold leading-relaxed">
                  هذا المفتاح مستعمل. حذفه سيؤدي إلى سحب صلاحية دخول التلميذ لهذا الفوج! هل أنت متأكد؟
                </div>

                <div className="text-xs text-on-surface-variant space-y-1 bg-surface-variant/30 p-3 rounded-xl font-mono" dir="ltr">
                  <div><strong>Key:</strong> {deletingKey.key}</div>
                  <div><strong>User:</strong> {deletingKey.usedBy}</div>
                  <div><strong>Group:</strong> {deletingKey.groupId}</div>
                </div>
              </>
            ) : (
              /* Standard Confirmation for Unused Key Delete */
              <>
                <div className="flex items-center gap-3 text-error">
                  <div className="p-3 rounded-2xl bg-error-container text-on-error-container shrink-0">
                    <Trash2 className="w-6 h-6 text-error" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-on-surface">حذف مفتاح التفعيل</h3>
                    <p className="text-xs text-on-surface-variant">تأكيد عملية الحذف</p>
                  </div>
                </div>

                <p className="text-sm text-on-surface-variant leading-relaxed">
                  هل أنت تأكد من رغبتك في حذف المفتاح <code className="font-mono text-xs font-bold bg-surface-variant px-2 py-0.5 rounded text-primary" dir="ltr">{deletingKey.key}</code>؟
                </p>
              </>
            )}

            {/* Modal Dialog Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
              <button
                type="button"
                onClick={() => setDeletingKey(null)}
                className="px-4 h-10 rounded-xl bg-surface-variant/60 text-on-surface-variant font-semibold text-xs hover:bg-surface-variant transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmDeleteKey}
                disabled={actionLoadingId === deletingKey.id}
                className="px-5 h-10 rounded-xl bg-error text-on-error font-bold text-xs shadow-md hover:bg-error/90 transition-all flex items-center gap-2 disabled:opacity-70"
              >
                {actionLoadingId === deletingKey.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Title and Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight flex items-center gap-3">
            <KeyRound className="w-8 h-8 text-primary" />
            <span>إدارة مفاتيح التفعيل</span>
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            توليد وتتبع رموز تفعيل الحسابات والحذف الآمن للمفاتيح
          </p>
        </div>

        <div className="flex items-center gap-3 w-fit">
          <button
            type="button"
            onClick={loadKeys}
            disabled={loadingKeys}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface-variant/60 text-on-surface-variant hover:bg-surface-variant text-sm font-medium transition-colors focus:outline-none"
          >
            <RefreshCw className={`w-4 h-4 ${loadingKeys ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>

          {/* Primary Action Button: Opens GenerateKeysModal */}
          <button
            type="button"
            onClick={() => setIsGenerateModalOpen(true)}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-primary text-on-primary text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>توليد دفعة مفاتيح</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-error-container/70 border border-error/30 text-on-error-container text-sm flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-error shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Keys Data Table Section */}
      <section className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Table Controls (Search & Filters) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-outline/10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-on-surface">سجل مفاتيح التفعيل</h2>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant">
              الإجمالي: {keysList.length}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Step 1: Fixed Search Input Container */}
            <div className="relative w-full max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالمفتاح أو الفوج..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface-variant/40 border border-outline/20 text-on-surface placeholder:text-on-surface-variant/50 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Status Filter Dropdown / Pills */}
            <div className="flex flex-wrap items-center gap-2 bg-surface-variant/30 p-1.5 rounded-xl border border-outline/15 text-xs font-medium w-full sm:w-auto overflow-visible" dir="rtl">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-all text-center whitespace-nowrap ${
                  statusFilter === "all"
                    ? "bg-surface text-on-surface shadow-sm font-bold"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                الكل ({keysList.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-lg transition-all text-center whitespace-nowrap ${
                  statusFilter === "active"
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                نشط ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("disabled")}
                className={`px-3 py-1.5 rounded-lg transition-all text-center whitespace-nowrap ${
                  statusFilter === "disabled"
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                معطل ({disabledCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("used")}
                className={`px-3 py-1.5 rounded-lg transition-all text-center whitespace-nowrap ${
                  statusFilter === "used"
                    ? "bg-error-container text-on-error-container font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                مستعمل ({usedCount})
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {loadingKeys ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-sm text-on-surface-variant">جاري تحميل سجل المفاتيح من الفايرستور...</p>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="py-16 text-center space-y-3 border-2 border-dashed border-outline/20 rounded-2xl">
            <KeyRound className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
            <h3 className="text-base font-bold text-on-surface">لا توجد مفاتيح تفعيل مطابقة</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "جرب تغيير معايير البحث أو تصفية الحالة."
                : "قم بنقر زر (توليد دفعة مفاتيح) لإنشاء مفاتيح جديدة."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-outline/15 shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-surface-variant/50 text-on-surface-variant text-xs font-bold uppercase tracking-wider border-b border-outline/15">
                  <tr>
                    <th scope="col" className="px-6 py-4">
                      المفتاح (Key)
                    </th>
                    <th scope="col" className="px-6 py-4">
                      الفوج (Group ID)
                    </th>
                    <th scope="col" className="px-6 py-4">
                      الحالة (Status)
                    </th>
                    <th scope="col" className="px-6 py-4">
                      مستعمل من طرف
                    </th>
                    <th scope="col" className="px-6 py-4 text-center">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10 bg-surface">
                  {paginatedKeys.map((item) => {
                    const isActive = item.status === "active";
                    const isUsed = item.status === "used";
                    const isDisabled = item.status === "disabled";
                    const isCopied = copiedKey === item.key;
                    const isMenuOpen = activeMenuId === item.id;
                    const isLoading = actionLoadingId === item.id;

                    return (
                      <tr
                        key={item.id || item.key}
                        className="hover:bg-surface-variant/30 transition-colors"
                      >
                        {/* Column 1: Key & Copy Button */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20" dir="ltr">
                              {item.key}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyKey(item.key)}
                              className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                              title="نسخ المفتاح"
                            >
                              {isCopied ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Column 2: Group ID */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant text-xs font-semibold">
                            <Users className="w-3.5 h-3.5" />
                            <span>{item.groupId}</span>
                          </span>
                        </td>

                        {/* Column 3: Status Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isActive && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>نشط</span>
                            </span>
                          )}
                          {isDisabled && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-500/30">
                              <Ban className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>معطل</span>
                            </span>
                          )}
                          {isUsed && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container text-xs font-bold border border-error/20">
                              <span className="w-2 h-2 rounded-full bg-error" />
                              <span>مستعمل</span>
                            </span>
                          )}
                        </td>

                        {/* Column 4: Used By */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-on-surface-variant">
                          {item.usedBy ? (
                            <span className="font-mono bg-surface-variant/40 px-2 py-1 rounded-md" dir="ltr">{item.usedBy}</span>
                          ) : (
                            <span className="text-on-surface-variant/50">-</span>
                          )}
                        </td>

                        {/* Column 5: MD3 Action Menu Dropdown */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="relative inline-block text-right" ref={isMenuOpen ? dropdownRef : null}>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMenuId(isMenuOpen ? null : item.id || null)
                              }
                              disabled={isLoading}
                              className="p-2 rounded-xl text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-variant/80 focus:outline-none transition-colors"
                              aria-label="خيارات المفتاح"
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              ) : (
                                <MoreVertical className="w-4 h-4" />
                              )}
                            </button>

                            {/* MD3 Action Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                className="absolute left-0 top-full mt-1 w-44 bg-surface border border-outline/20 rounded-2xl shadow-xl z-30 py-1.5 animate-fadeIn text-xs font-semibold overflow-hidden"
                                dir="rtl"
                              >
                                {/* Option 1: Toggle Status (Disabled if Used) */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(item)}
                                  disabled={isUsed}
                                  className={`w-full text-right px-4 py-2.5 flex items-center gap-2.5 transition-colors ${
                                    isUsed
                                      ? "opacity-50 cursor-not-allowed text-on-surface-variant/40"
                                      : "text-on-surface hover:bg-surface-variant/60"
                                  }`}
                                  title={isUsed ? "لا يمكن تعطيل مفتاح مستعمل" : ""}
                                >
                                  <Power className={`w-4 h-4 ${isActive ? "text-amber-500" : "text-emerald-600"}`} />
                                  <span>
                                    {isActive ? "تعطيل المفتاح" : "تنشيط المفتاح"}
                                  </span>
                                </button>

                                <div className="my-1 border-t border-outline/10" />

                                {/* Option 2: Safe Delete */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setDeletingKey(item);
                                  }}
                                  className="w-full text-right px-4 py-2.5 flex items-center gap-2.5 text-error hover:bg-error-container/40 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>حذف المفتاح</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Step 3: MD3 Pagination Controls Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-surface-variant/30 border border-outline/15 text-xs">
              <span className="text-on-surface-variant font-medium">
                صفحة <strong className="text-on-surface font-bold">{totalPages > 0 ? currentPage : 0}</strong> من <strong className="text-on-surface font-bold">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                {/* Previous Button (السابق) */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || totalPages === 0}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-outline/20 bg-surface text-on-surface font-semibold hover:bg-surface-variant/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابق</span>
                </button>

                {/* Next Button (التالي) */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-outline/20 bg-surface text-on-surface font-semibold hover:bg-surface-variant/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

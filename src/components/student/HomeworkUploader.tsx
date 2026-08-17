"use client";

import React, { useState, useRef, useEffect } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Image as ImageIcon, Loader2, X, Plus, ExternalLink, ZoomIn } from "lucide-react";

export interface HomeworkUploaderProps {
  onUploadSuccess: (urls: string[]) => void;
  currentUrls?: string[];
  currentUrl?: string; // Backwards compatibility
}

export function HomeworkUploader({ onUploadSuccess, currentUrls, currentUrl }: HomeworkUploaderProps) {
  const [uploading, setUploading] = useState(false);
  
  // Normalize initial URLs
  const initialList = currentUrls && currentUrls.length > 0
    ? currentUrls
    : currentUrl
    ? [currentUrl]
    : [];

  const [uploadedUrls, setUploadedUrls] = useState<string[]>(initialList);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "gavyiksx";
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "student_homework";

  useEffect(() => {
    if (currentUrls && currentUrls.length > 0) {
      setUploadedUrls(currentUrls);
    } else if (currentUrl) {
      setUploadedUrls([currentUrl]);
    }
  }, [currentUrls, currentUrl]);

  const isPdf = (url: string) => {
    if (!url) return false;
    const clean = url.toLowerCase().split("?")[0];
    return clean.endsWith(".pdf") || clean.includes("/pdf/") || clean.startsWith("data:application/pdf");
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Check individual file sizes (max 20MB)
    const overSized = fileArray.some((f) => f.size > 20 * 1024 * 1024);
    if (overSized) {
      setError("إحدى الصور أو الملفات تتجاوز الحد المسموح به (20 ميغابايت).");
      return;
    }

    setUploading(true);
    setError(null);

    const uploadSingleFile = async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.secure_url) return data.secure_url;
        if (data.url) return data.url;
        throw new Error(data.error?.message || "Cloudinary Upload Failed");
      } catch (err) {
        console.warn("Cloudinary upload failed for file, using FileReader fallback:", file.name);
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
    };

    try {
      const newUrls = await Promise.all(fileArray.map((f) => uploadSingleFile(f)));
      const updatedList = [...uploadedUrls, ...newUrls];
      setUploadedUrls(updatedList);
      onUploadSuccess(updatedList);
    } catch (err: any) {
      console.error("Multi upload error:", err);
      setError(err.message || "حدث خطأ أثناء رفع الصور. يرجى المحاولة مجدداً.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files);
    }
  };

  const handleRemoveItem = async (index: number) => {
    const urlToRemove = uploadedUrls[index];

    if (urlToRemove && urlToRemove.includes("cloudinary.com")) {
      try {
        console.log("🔥 Permanently deleting Cloudinary image on remove:", urlToRemove);
        await fetch("/api/cloudinary/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: [urlToRemove] }),
        });
      } catch (err) {
        console.warn("Failed to delete Cloudinary file on remove:", err);
      }
    }

    const updated = uploadedUrls.filter((_, i) => i !== index);
    setUploadedUrls(updated);
    onUploadSuccess(updated);
  };

  return (
    <div className="space-y-3" dir="rtl">
      <label className="block text-xs font-bold text-on-surface flex items-center justify-between">
        <span>رفع وتصوير إجابة الواجب (يمكن اختيار عدة صور أو ملفات PDF) <span className="text-error">*</span></span>
        {uploadedUrls.length > 0 && (
          <span className="text-[11px] font-extrabold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
            تم إرفاق {uploadedUrls.length} {uploadedUrls.length === 1 ? "ملف" : "ملفات/صور"}
          </span>
        )}
      </label>

      {/* Hidden File Input with MULTIPLE attribute */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        onChange={handleChange}
        className="hidden"
      />

      {/* Uploaded Gallery Grid Preview */}
      {uploadedUrls.length > 0 && (
        <div className="space-y-3 p-4 rounded-2xl bg-surface-variant/20 border border-outline/15">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {uploadedUrls.map((url, idx) => {
              const pdf = isPdf(url);

              return (
                <div
                  key={idx}
                  className="relative group rounded-xl overflow-hidden border border-outline/20 bg-surface shadow-2xs aspect-4/3 flex flex-col justify-between"
                >
                  {pdf ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-amber-500/10 text-amber-500 text-center">
                      <FileText className="w-8 h-8 mb-1" />
                      <span className="text-[10px] font-bold text-on-surface truncate max-w-full">
                        مستند PDF #{idx + 1}
                      </span>
                    </div>
                  ) : (
                    <img
                      src={url}
                      alt={`صفحة الواجب #${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  )}

                  {/* Actions Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!pdf && (
                      <button
                        type="button"
                        onClick={() => {
                          const imgIndex = uploadedUrls.filter((u) => !isPdf(u)).indexOf(url);
                          setLightboxIndex(imgIndex >= 0 ? imgIndex : 0);
                          setLightboxOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-surface/90 text-on-surface hover:bg-primary hover:text-on-primary transition-colors"
                        title="تكبير ومعاينة الصورة (Lightbox Zoom)"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    )}
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-surface/90 text-on-surface hover:bg-primary hover:text-on-primary transition-colors"
                      title="فتح في نافذة جديدة"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 rounded-lg bg-surface/90 text-error hover:bg-error hover:text-on-error transition-colors"
                      title="حذف هذا الصفح/الملف"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                    {idx + 1}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>إضافة المزيد من الصور أو ملفات الإجابة</span>
          </button>
        </div>
      )}

      {/* Main Upload Dropzone */}
      {uploadedUrls.length === 0 && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center space-y-3 ${
            dragActive
              ? "border-primary bg-primary/10 shadow-inner"
              : "border-outline/20 bg-surface-variant/20 hover:bg-surface-variant/40 hover:border-primary/40"
          }`}
        >
          {uploading ? (
            <div className="space-y-2 py-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-xs font-bold text-primary">جاري رفع الصور وحفظها سحابياً...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-extrabold text-on-surface">
                  انقر هنا لاختيار صور إجابتك (يمكن تحديد عدة صور) أو اسحبها إلى هنا
                </p>
                <p className="text-[11px] text-on-surface-variant/70 font-medium">
                  يدعم التقط صور متعددة للدفتر (JPG, PNG) أو ملفات PDF بحجم يصل حتى 20MB لكل صورة
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lightbox Modal with Zoom and Counter Plugins */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={uploadedUrls.filter((u) => !isPdf(u)).map((src) => ({ src }))}
        plugins={[Zoom, Counter]}
      />
    </div>
  );
}

export default HomeworkUploader;

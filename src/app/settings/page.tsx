"use client";

import React, { useState, useEffect, FormEvent, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase/config";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from "firebase/auth";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { toast } from "@/src/components/ui/use-toast";
import {
  User,
  Mail,
  Lock,
  Camera,
  Image as ImageIcon,
  ShieldCheck,
  ArrowRight,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  X,
  GraduationCap,
  Sparkles,
  KeyRound,
  FileText,
  Clock,
  Trash2,
  AlertTriangle,
  BookOpen,
  Calendar,
  Phone,
  Layers,
  ShieldAlert,
  Send,
} from "lucide-react";

type SettingsTab = "personal" | "academic" | "security";

export default function SettingsPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  // Role detection
  const role = String(userData?.role || "").trim().toLowerCase();
  const isSuperAdmin = role === "super_admin";
  const isTeacher = role === "teacher" || role === "admin" || userData?.isAdmin === true;
  const isStudent = role === "student" || (!isSuperAdmin && !isTeacher);

  // Active Tab state (Responsive Tabs UI Requirement 2)
  const [activeTab, setActiveTab] = useState<SettingsTab>("personal");

  // Dashboard back link
  const backLink = isSuperAdmin
    ? "/super-admin"
    : isTeacher
    ? "/teacher/dashboard"
    : "/dashboard";

  // Form input states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Cloudinary image upload states
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Cloudinary Image Deletion Confirm Dialog States Requirement 3
  const [isDeleteAvatarDialogOpen, setIsDeleteAvatarDialogOpen] = useState(false);
  const [isDeleteCoverDialogOpen, setIsDeleteCoverDialogOpen] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);

  // Mobile Touch Action Menu States (< sm) Requirement 3
  const [isMobileAvatarMenuOpen, setIsMobileAvatarMenuOpen] = useState(false);
  const [isMobileCoverMenuOpen, setIsMobileCoverMenuOpen] = useState(false);

  // Parent Phone OTP Modal States Requirement 4
  const [isParentPhoneOtpModalOpen, setIsParentPhoneOtpModalOpen] = useState(false);
  const [newParentPhoneInput, setNewParentPhoneInput] = useState("");
  const [otpCodeInput, setOtpCodeInput] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Status & Notification states
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Pending Name Change Request State
  const [hasPendingNameRequest, setHasPendingNameRequest] = useState(false);
  const [pendingRequestDoc, setPendingRequestDoc] = useState<{ id: string; requestedName: string; reason: string } | null>(null);

  // Danger Zone GDPR Delete Account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Name Change Request Modal state (for students)
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [requestedName, setRequestedName] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestStatusMsg, setRequestStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Initialize form fields when userData loads
  useEffect(() => {
    if (userData) {
      setFirstName(userData.firstName || "");
      setLastName(userData.lastName || "");
      setFullName(userData.fullName || userData.displayName || "");
      setAvatarUrl(userData.avatarUrl || userData.photoURL || "");
      setCoverUrl(userData.coverUrl || "");
      setStudentPhone(userData.studentPhone || userData.phone || "");
      setParentPhone(userData.parentPhone || "");
      setNewParentPhoneInput(userData.parentPhone || "");
      setDateOfBirth(userData.dateOfBirth || "");
      setEmail(userData.email || user?.email || "");
    }
  }, [userData, user]);

  // Real-time listener for student's pending name requests
  useEffect(() => {
    if (!user?.uid || !isStudent) return;

    const q = query(
      collection(db, "name_requests"),
      where("studentId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data();
          setPendingRequestDoc({
            id: docSnap.id,
            requestedName: data.requestedName || "",
            reason: data.reason || "",
          });
          setHasPendingNameRequest(true);
        } else {
          setPendingRequestDoc(null);
          setHasPendingNameRequest(false);
        }
      },
      (err) => {
        console.error("Error listening to pending name requests:", err);
      }
    );

    return () => unsubscribe();
  }, [user, isStudent]);

  // Cloudinary Backend File Deletion API Trigger Requirement 3
  const deleteCloudinaryImageOnServer = async (urlToDelete: string) => {
    if (!urlToDelete || !urlToDelete.includes("cloudinary.com")) return;
    try {
      const res = await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [urlToDelete] }),
      });
      const data = await res.json();
      console.log("Cloudinary destroy server response:", data);
    } catch (err) {
      console.warn("Failed to trigger Cloudinary deletion API for image:", err);
    }
  };

  // Confirm Avatar Deletion Action Requirement 3
  const handleConfirmDeleteAvatar = async () => {
    if (!avatarUrl || !user) return;
    setIsDeletingImage(true);

    try {
      // 1. Delete image physically from Cloudinary servers
      await deleteCloudinaryImageOnServer(avatarUrl);

      // 2. Update Firestore document setting avatarUrl and photoURL to empty
      await updateDoc(doc(db, "users", user.uid), {
        avatarUrl: "",
        photoURL: "",
        updatedAt: serverTimestamp(),
      });

      setAvatarUrl("");
      setIsDeleteAvatarDialogOpen(false);

      toast({
        title: "تم مسح الصورة الشخصية",
        description: "تم حذف الصورة نهائياً من خوادم Cloudinary وتفريغ بياناتها من القاعدة.",
      });
    } catch (err: any) {
      console.error("Error deleting avatar:", err);
      toast({
        title: "خطأ أثناء الحذف",
        description: err.message || "تعذر مسح الصورة الشخصية حالياً.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingImage(false);
    }
  };

  // Confirm Cover Photo Deletion Action Requirement 3
  const handleConfirmDeleteCover = async () => {
    if (!coverUrl || !user) return;
    setIsDeletingImage(true);

    try {
      await deleteCloudinaryImageOnServer(coverUrl);

      await updateDoc(doc(db, "users", user.uid), {
        coverUrl: "",
        updatedAt: serverTimestamp(),
      });

      setCoverUrl("");
      setIsDeleteCoverDialogOpen(false);

      toast({
        title: "تم مسح صورة الغلاف",
        description: "تم حذف الغلاف نهائياً من خوادم Cloudinary.",
      });
    } catch (err: any) {
      console.error("Error deleting cover:", err);
      toast({
        title: "خطأ أثناء الحذف",
        description: err.message || "تعذر مسح صورة الغلاف حالياً.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingImage(false);
    }
  };

  // Direct Cloudinary Upload Handler for Avatar
  const handleCloudinaryAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setStatusMsg(null);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "gavyiksx";
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "student_homework";

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.secure_url) {
        const oldAvatar = avatarUrl;
        const newUrl = data.secure_url;
        setAvatarUrl(newUrl);

        if (oldAvatar && oldAvatar !== newUrl) {
          await deleteCloudinaryImageOnServer(oldAvatar);
        }

        if (user) {
          await updateDoc(doc(db, "users", user.uid), {
            avatarUrl: newUrl,
            photoURL: newUrl,
            updatedAt: serverTimestamp(),
          });
        }

        toast({
          title: "تم تحديث الصورة الشخصية",
          description: "تم رفع الصورة الجديدة إلى Cloudinary وتحديث البروفايل بنجاح.",
        });
      } else {
        throw new Error(data.error?.message || "فشل رفع الصورة إلى Cloudinary");
      }
    } catch (err: any) {
      console.error("Cloudinary Avatar Upload Error:", err);
      toast({
        title: "خطأ في رفع الصورة",
        description: err.message || "تعذر رفع الصورة الشخصية حالياً.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Direct Cloudinary Upload Handler for Cover Image (Teacher Only)
  const handleCloudinaryCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    setStatusMsg(null);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "gavyiksx";
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "student_homework";

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.secure_url) {
        const oldCover = coverUrl;
        const newUrl = data.secure_url;
        setCoverUrl(newUrl);

        if (oldCover && oldCover !== newUrl) {
          await deleteCloudinaryImageOnServer(oldCover);
        }

        if (user) {
          await updateDoc(doc(db, "users", user.uid), {
            coverUrl: newUrl,
            updatedAt: serverTimestamp(),
          });
        }

        toast({
          title: "تم تحديث صورة الغلاف",
          description: "تم رفع الغلاف الجديد ومسح الصورة السابقة بنجاح.",
        });
      } else {
        throw new Error(data.error?.message || "فشل رفع الغلاف إلى Cloudinary");
      }
    } catch (err: any) {
      console.error("Cloudinary Cover Upload Error:", err);
      toast({
        title: "خطأ في رفع الغلاف",
        description: err.message || "تعذر رفع صورة الغلاف حالياً.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Parent Phone OTP Step 1: Send OTP to User's Email Requirement 4
  const handleSendParentPhoneOtp = async () => {
    setOtpError(null);
    if (!newParentPhoneInput.trim() || newParentPhoneInput.trim().length < 9) {
      setOtpError("يرجى إدخال رقم هاتف الولي صحيح كاملاً (مثال: 05XXXXXXXX).");
      return;
    }

    const userEmail = user?.email || userData?.email;
    if (!userEmail) {
      setOtpError("لم يتم العثور على بريد إلكتروني مسجل للجلسة الحالية.");
      return;
    }

    setIsSendingOtp(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, purpose: "parent_phone_update" }),
      });

      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        toast({
          title: "تم إرسال كود التفعيل",
          description: `تم إرسال رمز التحقق OTP إلى البريد الإلكتروني: ${userEmail}`,
        });
      } else {
        throw new Error(data.error || "فشل إرسال كود التفعيل.");
      }
    } catch (err: any) {
      console.error("Error sending parent phone OTP:", err);
      setOtpError(err.message || "حدث خطأ أثناء طلب رمز OTP.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Parent Phone OTP Step 2: Verify OTP & Update Parent Phone in Firestore Requirement 4
  const handleVerifyParentPhoneOtp = async (e: FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    if (!otpCodeInput.trim() || otpCodeInput.trim().length !== 6) {
      setOtpError("يرجى إدخال رمز التحقق OTP المكون من 6 أرقام.");
      return;
    }

    const userEmail = user?.email || userData?.email;
    if (!userEmail || !user?.uid) {
      setOtpError("انتهت الجلسة. يرجى إعادة تسجيل الدخول.");
      return;
    }

    setIsVerifyingOtp(true);

    try {
      // Fetch OTP from Firestore otps collection
      const cleanEmail = userEmail.trim().toLowerCase();
      const otpDocRef = doc(db, "otps", cleanEmail);
      const otpDocSnap = await getDoc(otpDocRef);

      if (!otpDocSnap.exists()) {
        throw new Error("رمز التحقق غير متاح أو انتهت صلاحيته. يرجى طلب كود جديد.");
      }

      const otpData = otpDocSnap.data();
      if (otpData.code !== otpCodeInput.trim()) {
        throw new Error("رمز التحقق OTP غير صحيح. يرجى التثبت وإعادة المحاولة.");
      }

      if (otpData.expiresAt && Date.now() > otpData.expiresAt) {
        await deleteDoc(otpDocRef);
        throw new Error("انتهت صلاحية كود التفعيل. يرجى طلب رمز جديد.");
      }

      // OTP Verification Success -> Update parentPhone in Firestore Requirement 4
      const updatedPhone = newParentPhoneInput.trim();
      await updateDoc(doc(db, "users", user.uid), {
        parentPhone: updatedPhone,
        updatedAt: serverTimestamp(),
      });

      setParentPhone(updatedPhone);
      await deleteDoc(otpDocRef);

      setIsParentPhoneOtpModalOpen(false);
      setOtpSent(false);
      setOtpCodeInput("");

      toast({
        title: "تم تحديث رقم الولي بنجاح 🎉",
        description: "تم التثبت عبر رمز الأمان OTP وحفظ رقم الولي الجديد في قاعدة البيانات.",
      });
    } catch (err: any) {
      console.error("Error verifying parent phone OTP:", err);
      setOtpError(err.message || "فشل التحقق من رمز OTP.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Submit Main Settings Form
  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!user) {
      setStatusMsg({ type: "error", text: "يرجى تسجيل الدخول أولاً لتعديل البيانات." });
      return;
    }

    // Password change re-authentication check
    if (newPassword.trim()) {
      if (!currentPassword.trim()) {
        setStatusMsg({ type: "error", text: "يرجى إدخال كلمة المرور الحالية للأمان قبل التغيير." });
        return;
      }
      if (newPassword.length < 6) {
        setStatusMsg({ type: "error", text: "كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف." });
        return;
      }
      if (newPassword !== confirmPassword) {
        setStatusMsg({ type: "error", text: "كلمتا المرور الجديدتان غير متطابقتين." });
        return;
      }
    }

    setIsSaving(true);

    try {
      const userRef = doc(db, "users", user.uid);
      const updateData: Record<string, any> = {
        updatedAt: serverTimestamp(),
        studentPhone: studentPhone.trim(),
        phone: studentPhone.trim(),
        dateOfBirth,
      };

      if (!isStudent) {
        if (firstName.trim()) updateData.firstName = firstName.trim();
        if (lastName.trim()) updateData.lastName = lastName.trim();
        const computedName = `${firstName.trim()} ${lastName.trim()}`.trim() || fullName.trim();
        if (computedName) {
          updateData.fullName = computedName;
          updateData.displayName = computedName;
        }
      }

      if (avatarUrl) {
        updateData.avatarUrl = avatarUrl;
        updateData.photoURL = avatarUrl;
      }

      if (isTeacher && coverUrl) {
        updateData.coverUrl = coverUrl;
      }

      await updateDoc(userRef, updateData);

      // Re-authenticate & update Auth password if provided
      if (newPassword.trim()) {
        if (auth.currentUser && (user.email || auth.currentUser.email)) {
          const userEmail = user.email || auth.currentUser.email!;
          const credential = EmailAuthProvider.credential(userEmail, currentPassword.trim());
          await reauthenticateWithCredential(auth.currentUser, credential);
          await updatePassword(auth.currentUser, newPassword.trim());
        }
      }

      setStatusMsg({
        type: "success",
        text: "تم حفظ التغييرات وتحديث بيانات الملف الشخصي بنجاح!",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Save settings error:", error);
      let errText = error.message || "حدث خطأ أثناء حفظ البيانات.";
      if (error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password") {
        errText = "كلمة المرور الحالية التي أدخلتها غير صحيحة.";
      }
      setStatusMsg({ type: "error", text: errText });
    } finally {
      setIsSaving(false);
    }
  };

  // GDPR Account Deletion Execution
  const handleDeleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (deleteConfirmationText.trim() !== "تأكيد") {
      setDeleteError('يرجى كتابة كلمة "تأكيد" للتحقق من الرغبة في الحذف.');
      return;
    }

    if (!deletePassword || deletePassword.length < 6) {
      setDeleteError("يرجى إدخال كلمة المرور الحالية لتأكيد الهوية.");
      return;
    }

    if (!user || !auth.currentUser || !user.email) {
      setDeleteError("عذراً، لم يتم العثور على الجلسة الحالية. يرجى إعادة تسجيل الدخول.");
      return;
    }

    setIsDeletingAccount(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      const userUid = user.uid;
      await deleteDoc(doc(db, "users", userUid));

      try {
        const enrSnap = await getDocs(query(collection(db, "enrollments"), where("studentId", "==", userUid)));
        for (const enrDoc of enrSnap.docs) {
          await deleteDoc(enrDoc.ref);
        }
      } catch (e) {}

      await deleteUser(auth.currentUser);

      toast({
        title: "تم حذف الحساب نهائياً",
        description: "تم مسح كافة بياناتك وسجلاتك بالكامل وفق معايير GDPR.",
        variant: "destructive",
      });

      router.replace("/login");
    } catch (err: any) {
      console.error("Error deleting account:", err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setDeleteError("كلمة المرور الحالية المدخلة غير صحيحة.");
      } else {
        setDeleteError(err.message || "حدث خطأ أثناء تنفيذ عملية حذف الحساب.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Open Student Name Change Request Modal
  const handleOpenNameModal = () => {
    if (pendingRequestDoc) {
      setRequestedName(pendingRequestDoc.requestedName);
      setChangeReason(pendingRequestDoc.reason);
    } else {
      setRequestedName("");
      setChangeReason("");
    }
    setRequestStatusMsg(null);
    setIsNameModalOpen(true);
  };

  // Submit Student Name Change Request
  const handleSubmitNameRequest = async (e: FormEvent) => {
    e.preventDefault();
    setRequestStatusMsg(null);

    if (!requestedName.trim()) {
      setRequestStatusMsg({ type: "error", text: "يرجى إدخال الاسم الجديد المطلوب." });
      return;
    }

    if (!changeReason.trim()) {
      setRequestStatusMsg({ type: "error", text: "يرجى توضيح سبب طلب تغيير الاسم." });
      return;
    }

    setIsSubmittingRequest(true);

    try {
      if (pendingRequestDoc) {
        await updateDoc(doc(db, "name_requests", pendingRequestDoc.id), {
          requestedName: requestedName.trim(),
          reason: changeReason.trim(),
          updatedAt: serverTimestamp(),
        });
        setRequestStatusMsg({ type: "success", text: "تم تحديث طلبك بنجاح!" });
      } else {
        const studentTeacherId = userData?.teacherId || null;
        await addDoc(collection(db, "name_requests"), {
          studentId: user?.uid,
          studentName: userData?.fullName || userData?.displayName || "تلميذ",
          studentEmail: userData?.email || user?.email || "",
          teacherId: studentTeacherId,
          requestedName: requestedName.trim(),
          reason: changeReason.trim(),
          status: "pending",
          createdAt: serverTimestamp(),
        });
        setRequestStatusMsg({ type: "success", text: "تم تقديم طلب تغيير الاسم وسيتلقاه أستاذك للمراجعة!" });
      }

      setTimeout(() => {
        setIsNameModalOpen(false);
        setRequestStatusMsg(null);
      }, 1500);
    } catch (err: any) {
      setRequestStatusMsg({ type: "error", text: "تعذر حفظ التغييرات حالياً. يرجى المحاولة لاحقاً." });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-4" dir="rtl">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-sm font-semibold text-on-surface-variant">جاري تحميل إعدادات الحساب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary/20" dir="rtl">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-outline/15 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={backLink}
            className="p-2 rounded-2xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-all"
            title="الرجوع للوحة الرئيسية"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-on-surface tracking-tight">إعدادات الحساب والملف الشخصي</h1>
            <p className="text-[11px] font-semibold text-on-surface-variant">
              {isSuperAdmin ? "حساب المدير الفائق" : isTeacher ? "حساب الأستاذ المشرف" : "حساب الطالب"}
            </p>
          </div>
        </div>

        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8 animate-fadeIn pb-16">
        {/* Cover & Profile Banner Container */}
        <div className="bg-surface border border-outline/15 rounded-3xl overflow-hidden shadow-sm">
          {/* REQUIREMENT 2 & 3: Cover Photo Area rendered ONLY FOR TEACHER / SUPER ADMIN (Completely removed for Student) */}
          {!isStudent && (
            <div className="h-36 sm:h-48 w-full bg-gradient-to-r from-primary/30 via-secondary/20 to-surface-variant/40 relative group/cover">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant/50 text-xs font-bold">
                  <span>غلاف الملف الشخصي للأستاذ</span>
                </div>
              )}

              {/* Mobile Touch Trigger Overlay (< sm) Requirement 3 */}
              <div
                onClick={() => setIsMobileCoverMenuOpen(true)}
                className="sm:hidden absolute inset-0 cursor-pointer flex items-end justify-end p-3 bg-gradient-to-t from-black/40 to-transparent"
              >
                <span className="px-3 py-1.5 rounded-xl bg-black/65 text-white backdrop-blur-md text-[11px] font-extrabold flex items-center gap-1.5 shadow-md border border-white/20">
                  <Camera className="w-3.5 h-3.5" />
                  <span>خيارات الغلاف</span>
                </span>
              </div>

              {/* Desktop Hover Controls (sm:flex opacity-0 sm:group-hover/cover:opacity-100 transition-opacity) Requirement 2 */}
              <div className="hidden sm:flex absolute top-4 left-4 items-center gap-2 opacity-0 sm:group-hover/cover:opacity-100 transition-opacity duration-300">
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteCoverDialogOpen(true)}
                    className="p-2.5 rounded-2xl bg-error/80 hover:bg-error text-on-error backdrop-blur-md transition-all shadow-md cursor-pointer"
                    title="حذف صورة الغلاف نهائياً من Cloudinary"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                  className="p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md cursor-pointer transition-all flex items-center gap-2 text-xs font-extrabold shadow-md disabled:opacity-50"
                >
                  {isUploadingCover ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <ImageIcon className="w-4 h-4" />}
                  <span>تغيير الغلاف</span>
                </button>
              </div>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCloudinaryCoverUpload}
              />
            </div>
          )}

          {/* Avatar Profile Section */}
          <div className={`p-6 relative flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 ${!isStudent ? "-mt-14 sm:-mt-16 pt-0" : ""}`}>
            <div className="flex items-end gap-4">
              <div className="relative group/avatar">
                <div
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 640) {
                      setIsMobileAvatarMenuOpen(true);
                    }
                  }}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 border-surface bg-primary-container text-on-primary-container font-extrabold text-3xl flex items-center justify-center shadow-lg overflow-hidden shrink-0 cursor-pointer sm:cursor-default"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(fullName || firstName || "أ").charAt(0).toUpperCase()}</span>
                  )}

                  {/* Mobile Camera Indicator (< sm) */}
                  <div className="sm:hidden absolute bottom-1.5 left-1.5 p-1 rounded-xl bg-black/60 text-white backdrop-blur-md border border-white/20">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Desktop Hover Controls Overlay (sm:flex opacity-0 sm:group-hover/avatar:opacity-100 transition-opacity) Requirement 2 */}
                <div className="hidden sm:flex absolute inset-0 rounded-3xl bg-black/65 text-white opacity-0 sm:group-hover/avatar:opacity-100 transition-opacity duration-300 flex-col items-center justify-center gap-2 backdrop-blur-xs p-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-extrabold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <span>تغيير</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setIsDeleteAvatarDialogOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-error/80 hover:bg-error text-on-error font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCloudinaryAvatarUpload}
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-bold inline-block">
                {isSuperAdmin ? "المدير الفائق 👑" : isTeacher ? "أستاذ المادة 👨‍🏫" : "طالب البكالوريا 🎓"}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface">
                {fullName || `${firstName} ${lastName}`.trim() || "الملف الشخصي"}
              </h2>
            </div>
          </div>
        </div>

        {/* Status Notification Alert */}
        {statusMsg && (
          <div
            className={`p-4 rounded-2xl border text-sm font-bold flex items-start gap-3 animate-fadeIn ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-error/10 text-error border-error/20"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            )}
            <p className="leading-relaxed">{statusMsg.text}</p>
          </div>
        )}

        {/* REQUIREMENT 2: Shadcn UI 3-Tab Responsive Navigation Bar (Mobile Labels Hidden via sm:inline) */}
        <div className="bg-surface border border-outline/15 rounded-2xl p-1.5 flex items-center gap-2 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("personal")}
            className={`flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "personal"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40"
            }`}
          >
            <User className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">البيانات الشخصية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("academic")}
            className={`flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "academic"
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40"
            }`}
          >
            <BookOpen className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">{isTeacher ? "الملف المهني والكوتا" : "المسار الدراسي"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "security"
                ? "bg-error/15 text-error border border-error/30 shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40"
            }`}
          >
            <Lock className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">الأمان والخطر</span>
          </button>
        </div>

        {/* ========================================== */}
        {/* TAB 1: PERSONAL DATA                       */}
        {/* ========================================== */}
        {activeTab === "personal" && (
          <form onSubmit={handleSaveSettings} className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
            <div className="border-b border-outline/10 pb-4">
              <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <span>البيانات الشخصية والهاتف</span>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">تحديث الاسم، أرقام التواصل وتاريخ الميلاد</p>
            </div>

            {/* Names Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-on-surface">الاسم الأول</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isStudent}
                  placeholder="أدخل الاسم الأول..."
                  className={`w-full h-12 px-4 rounded-2xl border text-xs font-bold focus:outline-none transition-all ${
                    isStudent
                      ? "bg-surface-variant/30 border-outline/20 text-on-surface-variant cursor-not-allowed opacity-75"
                      : "bg-surface-variant/40 border-outline/30 text-on-surface focus:border-primary"
                  }`}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-on-surface">اللقب الرسمي</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isStudent}
                  placeholder="أدخل اللقب..."
                  className={`w-full h-12 px-4 rounded-2xl border text-xs font-bold focus:outline-none transition-all ${
                    isStudent
                      ? "bg-surface-variant/30 border-outline/20 text-on-surface-variant cursor-not-allowed opacity-75"
                      : "bg-surface-variant/40 border-outline/30 text-on-surface focus:border-primary"
                  }`}
                />
              </div>
            </div>

            {/* Student Name Change Restriction Notice */}
            {isStudent && (
              <div className="p-4 rounded-2xl bg-secondary/5 border border-secondary/15 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-on-surface-variant font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-secondary shrink-0" />
                    <span>يسمح بتغيير الاسم مرة واحدة كل 60 يوماً وتأكيده عبر أستاذ الفوج.</span>
                  </p>

                  <button
                    type="button"
                    onClick={handleOpenNameModal}
                    className={`px-4 py-2 rounded-xl font-extrabold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                      hasPendingNameRequest
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                        : "bg-secondary text-on-secondary hover:bg-secondary/90"
                    }`}
                  >
                    {hasPendingNameRequest ? (
                      <>
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                        <span>تعديل طلب الاسم ✏️</span>
                      </>
                    ) : (
                      <>
                        <FileEdit className="w-4 h-4" />
                        <span>طلب تغيير الاسم</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Phone & DOB Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-on-surface">رقم هاتف الطالب/الأستاذ</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="06XXXXXXXX"
                    dir="ltr"
                    className="w-full h-12 pr-10 pl-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                  />
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                </div>
              </div>

              {/* REQUIREMENT 4: Parent Phone with OTP Verification Trigger */}
              {isStudent ? (
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-on-surface flex items-center justify-between">
                    <span>رقم هاتف الولي (محمي برمز OTP)</span>
                    <span className="text-[10px] font-bold text-secondary flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>تأكيد الأمان</span>
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="tel"
                      disabled
                      value={parentPhone || "غير مسجل"}
                      dir="ltr"
                      className="flex-1 h-12 px-4 rounded-2xl bg-surface-variant/30 border border-outline/20 text-on-surface-variant text-xs font-bold cursor-not-allowed text-right opacity-80"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setNewParentPhoneInput(parentPhone);
                        setOtpError(null);
                        setOtpSent(false);
                        setIsParentPhoneOtpModalOpen(true);
                      }}
                      className="px-4 h-12 rounded-2xl bg-secondary text-on-secondary hover:bg-secondary/90 font-extrabold text-xs transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>تحديث عبر OTP</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-on-surface">تاريخ الميلاد / الاعتماد</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full h-12 pr-10 pl-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                    />
                    <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="h-12 px-8 rounded-2xl bg-primary text-on-primary font-extrabold text-xs shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ البيانات الشخصية</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================== */}
        {/* TAB 2: ACADEMIC / PROFESSIONAL PROFILE     */}
        {/* ========================================== */}
        {activeTab === "academic" && (
          <div className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
            <div className="border-b border-outline/10 pb-4">
              <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <span>{isTeacher ? "الملف المهني وكوتا المفاتيح" : "المسار الأكاديمي الصارم"}</span>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {isTeacher ? "مستوياتك ورصيد المفاتيح المسموح" : "بيانات الشعبة والمستوى الدراسي المسجل"}
              </p>
            </div>

            {/* Student Academic Fields (Disabled) */}
            {isStudent && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="leading-relaxed">
                    لا يمكن تعديل المسار الدراسي بعد التسجيل. تواصل مع الإدارة عند وجود أي خطأ في الشعبة.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-on-surface">المستوى الدراسي</label>
                    <input
                      type="text"
                      disabled
                      value={userData?.level || "ثانوي"}
                      className="w-full h-12 px-4 rounded-2xl bg-surface-variant/30 border border-outline/20 text-on-surface-variant text-xs font-bold cursor-not-allowed opacity-75"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-on-surface">السنة الدراسية</label>
                    <input
                      type="text"
                      disabled
                      value={userData?.secondaryYear || "ثالثة ثانوي (بكالوريا)"}
                      className="w-full h-12 px-4 rounded-2xl bg-surface-variant/30 border border-outline/20 text-on-surface-variant text-xs font-bold cursor-not-allowed opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-on-surface">الشعبة / الجذع المشترك</label>
                  <input
                    type="text"
                    disabled
                    value={userData?.specialization || userData?.firstYearStream || "علوم تجريبية"}
                    className="w-full h-12 px-4 rounded-2xl bg-surface-variant/30 border border-outline/20 text-on-surface-variant text-xs font-bold cursor-not-allowed opacity-75"
                  />
                </div>
              </div>
            )}

            {/* Teacher Professional Fields */}
            {isTeacher && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold text-on-surface">
                    رصيد مفاتيح التلاميذ المتاح (Quota)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      disabled
                      value={userData?.studentQuota || 100}
                      className="w-full h-12 pr-10 pl-4 rounded-2xl bg-primary/5 border border-primary/20 text-primary text-sm font-black cursor-not-allowed opacity-85"
                    />
                    <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-on-surface-variant/70">
                    الحد الأقصى للتلاميذ الذين تستطيع توليد مفاتيح تفعيل لهم. تواصل مع الإدارة لزيادة الرصيد.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-outline/10">
                  <label className="block text-xs font-extrabold text-on-surface">المواد التعليمية المعتمدة</label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-surface-variant/20 border border-outline/15">
                    {Array.isArray(userData?.subjects) && userData.subjects.length > 0 ? (
                      userData.subjects.map((subj: string) => (
                        <span key={subj} className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-extrabold shadow-xs">
                          {subj}
                        </span>
                      ))
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-extrabold">
                        {userData?.subject || "رياضيات"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: SECURITY & DANGER ZONE              */}
        {/* ========================================== */}
        {activeTab === "security" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Password & Security Card */}
            <form onSubmit={handleSaveSettings} className="bg-surface border border-outline/15 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-outline/10 pb-4">
                <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  <span>تعديل الأمان وكلمة المرور</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">يتطلب تغيير كلمة المرور إدخال كلمة المرور الحالية</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-on-surface">البريد الإلكتروني</label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full h-12 pr-10 pl-4 rounded-2xl bg-surface-variant/30 border border-outline/20 text-on-surface-variant text-xs font-bold cursor-not-allowed opacity-75 text-right"
                  />
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-outline/10">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-on-surface">
                    كلمة المرور الحالية <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full h-12 pr-10 pl-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                    />
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-on-surface">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full h-12 pr-10 pl-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-on-surface">تأكيد كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full h-12 pr-10 pl-4 rounded-2xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-12 px-8 rounded-2xl bg-primary text-on-primary font-extrabold text-xs shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري تحديث كلمة المرور...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>تأكيد كلمة المرور الجديدة</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Danger Zone GDPR Delete Account Card */}
            <div className="p-6 rounded-3xl bg-error/5 border border-error/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-error/15 text-error shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-error">منطقة الخطر (Danger Zone)</h3>
                    <p className="text-xs text-on-surface-variant/80 font-medium">
                      حذف الحساب نهائياً ومسح كافة البيانات المسجلة وفق معايير GDPR
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmationText("");
                    setDeletePassword("");
                    setDeleteError(null);
                    setIsDeleteModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-error/15 hover:bg-error text-error hover:text-on-error font-extrabold text-xs transition-all border border-error/30 shrink-0 cursor-pointer active:scale-95"
                >
                  حذف الحساب نهائياً
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* REQUIREMENT 3: AlertDialog Confirmation Modal for Deleting Avatar Image */}
      {isDeleteAvatarDialogOpen && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => !isDeletingImage && setIsDeleteAvatarDialogOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-surface border border-error/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3 pb-3 border-b border-outline/10">
              <div className="p-2.5 rounded-2xl bg-error/15 text-error">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-on-surface">تأكيد مسح الصورة الشخصية</h3>
                <p className="text-[11px] text-on-surface-variant font-medium">إزالة من القاعدة ومن Cloudinary</p>
              </div>
            </div>

            <p className="text-xs font-bold text-on-surface-variant leading-relaxed">
              هل أنت تأكد من رغبتك في حذف صورتك الشخصية؟ سيتم إزالة الملف فوراً من خوادم Cloudinary وتفريغ خانة الصورة في حسابك.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
              <button
                type="button"
                onClick={() => setIsDeleteAvatarDialogOpen(false)}
                disabled={isDeletingImage}
                className="px-4 py-2.5 rounded-xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteAvatar}
                disabled={isDeletingImage}
                className="px-5 py-2.5 rounded-xl bg-error text-on-error hover:bg-error/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isDeletingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري المسح...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف من Cloudinary</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUIREMENT 3: AlertDialog Confirmation Modal for Deleting Cover Image */}
      {isDeleteCoverDialogOpen && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => !isDeletingImage && setIsDeleteCoverDialogOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-surface border border-error/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3 pb-3 border-b border-outline/10">
              <div className="p-2.5 rounded-2xl bg-error/15 text-error">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-on-surface">تأكيد مسح صورة الغلاف</h3>
                <p className="text-[11px] text-on-surface-variant font-medium">حذف الملف من Cloudinary</p>
              </div>
            </div>

            <p className="text-xs font-bold text-on-surface-variant leading-relaxed">
              هل أنت تأكد من رغبتك في حذف صورة الغلاف الخارجي لملفك الشخصي؟
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
              <button
                type="button"
                onClick={() => setIsDeleteCoverDialogOpen(false)}
                disabled={isDeletingImage}
                className="px-4 py-2.5 rounded-xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteCover}
                disabled={isDeletingImage}
                className="px-5 py-2.5 rounded-xl bg-error text-on-error hover:bg-error/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isDeletingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري المسح...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف من Cloudinary</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* REQUIREMENT 3: Touch-Friendly Mobile Action Menu Modal for Avatar (< sm) */}
      {isMobileAvatarMenuOpen && (
        <div className="fixed inset-0 z-[105] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => setIsMobileAvatarMenuOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-outline/20 rounded-3xl p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline/10 pb-3">
              <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <span>خيارات الصورة الشخصية</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileAvatarMenuOpen(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileAvatarMenuOpen(false);
                  avatarInputRef.current?.click();
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-surface-variant/40 hover:bg-primary/10 text-on-surface font-extrabold text-xs flex items-center gap-3 transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 text-primary shrink-0" />
                <span>تغيير الصورة الشخصية (رفع جديدة)</span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileAvatarMenuOpen(false);
                    setIsDeleteAvatarDialogOpen(true);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-error/10 hover:bg-error/20 text-error font-extrabold text-xs flex items-center gap-3 transition-colors cursor-pointer border border-error/20"
                >
                  <Trash2 className="w-4 h-4 text-error shrink-0" />
                  <span>حذف الصورة الحالية نهائياً</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsMobileAvatarMenuOpen(false)}
              className="w-full py-2.5 rounded-xl bg-surface-variant/20 text-on-surface-variant font-bold text-xs"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* REQUIREMENT 3: Touch-Friendly Mobile Action Menu Modal for Cover (< sm) */}
      {isMobileCoverMenuOpen && (
        <div className="fixed inset-0 z-[105] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => setIsMobileCoverMenuOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-outline/20 rounded-3xl p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline/10 pb-3">
              <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span>خيارات صورة الغلاف</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileCoverMenuOpen(false)}
                className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileCoverMenuOpen(false);
                  coverInputRef.current?.click();
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-surface-variant/40 hover:bg-primary/10 text-on-surface font-extrabold text-xs flex items-center gap-3 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                <span>تغيير صورة الغلاف (رفع جديدة)</span>
              </button>

              {coverUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCoverMenuOpen(false);
                    setIsDeleteCoverDialogOpen(true);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-error/10 hover:bg-error/20 text-error font-extrabold text-xs flex items-center gap-3 transition-colors cursor-pointer border border-error/20"
                >
                  <Trash2 className="w-4 h-4 text-error shrink-0" />
                  <span>حذف صورة الغلاف نهائياً</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsMobileCoverMenuOpen(false)}
              className="w-full py-2.5 rounded-xl bg-surface-variant/20 text-on-surface-variant font-bold text-xs"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* REQUIREMENT 4: Parent Phone OTP Verification Modal */}
      {isParentPhoneOtpModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => !isSendingOtp && !isVerifyingOtp && setIsParentPhoneOtpModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-surface border border-outline/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-secondary/15 text-secondary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">تحديث رقم هاتف الولي عبر OTP</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">التحقق الأمني من ملكية الحساب</p>
                </div>
              </div>

              {!isSendingOtp && !isVerifyingOtp && (
                <button
                  type="button"
                  onClick={() => setIsParentPhoneOtpModalOpen(false)}
                  className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {otpError && (
              <div className="p-3.5 rounded-2xl bg-error/10 border border-error/20 text-error text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">رقم هاتف الولي الجديد</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={newParentPhoneInput}
                    onChange={(e) => setNewParentPhoneInput(e.target.value)}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    disabled={otpSent}
                    className="w-full h-11 pr-10 pl-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary text-right"
                  />
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendParentPhoneOtp}
                  disabled={isSendingOtp || !newParentPhoneInput.trim()}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary font-extrabold text-xs hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSendingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري إرسال كود OTP...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>إرسال رمز التفعيل OTP للبريد الإلكتروني</span>
                    </>
                  )}
                </button>
              ) : (
                <form onSubmit={handleVerifyParentPhoneOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-on-surface">
                      رمز التحقق OTP المكون من 6 أرقام (تم إرساله لبريدك)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCodeInput}
                      onChange={(e) => setOtpCodeInput(e.target.value)}
                      placeholder="123456"
                      dir="ltr"
                      required
                      className="w-full h-11 px-4 text-center tracking-widest text-lg font-black rounded-xl bg-surface-variant/40 border border-outline/30 text-primary focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors underline"
                    >
                      إعادة تعديل الرقم أو طلب رمز آخر
                    </button>

                    <button
                      type="submit"
                      disabled={isVerifyingOtp || otpCodeInput.trim().length !== 6}
                      className="px-5 h-11 rounded-xl bg-secondary text-on-secondary hover:bg-secondary/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isVerifyingOtp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري التثبت...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تأكيد وحفظ رقم الولي</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Name Change Request Dialog Modal */}
      {isNameModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => !isSubmittingRequest && setIsNameModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-surface border border-outline/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-secondary/15 text-secondary">
                  <FileEdit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-on-surface">طلب تغيير الاسم الرسمي</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">إرسال طلب لمراجعة الأستاذ المشرف</p>
                </div>
              </div>

              {!isSubmittingRequest && (
                <button
                  type="button"
                  onClick={() => setIsNameModalOpen(false)}
                  className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {pendingRequestDoc && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
                <span>لديك طلب قيد المراجعة، يمكنك تعديله أدناه.</span>
              </div>
            )}

            {requestStatusMsg && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2 ${
                  requestStatusMsg.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-error/10 text-error border border-error/20"
                }`}
              >
                {requestStatusMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <span>{requestStatusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNameRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">الاسم الجديد المطلوب</label>
                <input
                  type="text"
                  value={requestedName}
                  onChange={(e) => setRequestedName(e.target.value)}
                  placeholder="أدخل الاسم المطلوب..."
                  required
                  className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">سبب طلب تغيير الاسم</label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="توضيح سبب الطلب..."
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
                <button
                  type="button"
                  onClick={() => setIsNameModalOpen(false)}
                  disabled={isSubmittingRequest}
                  className="px-4 py-2.5 rounded-xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary hover:bg-secondary/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingRequest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{pendingRequestDoc ? "جاري التعديل..." : "جاري الإرسال..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{pendingRequestDoc ? "تعديل الطلب" : "إرسال الطلب الآن"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GDPR Delete Account Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="fixed inset-0" onClick={() => !isDeletingAccount && setIsDeleteModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-surface border border-error/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-error/15 text-error">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-error">تأكيد حذف الحساب نهائياً</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">إجراء نهائي مسح الشواهد (GDPR Purge)</p>
                </div>
              </div>

              {!isDeletingAccount && (
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-error/10 border border-error/20 text-xs text-error font-bold leading-relaxed space-y-1">
              <p>⚠️ تحذير شديد الخطورة:</p>
              <p className="font-medium text-on-surface-variant">
                سيتم مسح مستنداتك وسجلات تفعيلك وانضمامك بالكامل من الفايرستور ومسح الهوية نهائياً.
              </p>
            </div>

            {deleteError && (
              <div className="p-3.5 rounded-2xl bg-error/10 border border-error/20 text-error text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  اكتب كلمة <span className="text-error font-black">"تأكيد"</span> للموافقة:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder='اكتب كلمة "تأكيد" هنا...'
                  required
                  className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-error"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-on-surface">
                  إدخال كلمة المرور الحالية لتأكيد الهوية:
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  required
                  className="w-full h-11 px-4 rounded-xl bg-surface-variant/40 border border-outline/30 text-on-surface text-xs font-bold focus:outline-none focus:border-error"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/10">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeletingAccount}
                  className="px-4 py-2.5 rounded-xl bg-surface-variant/50 hover:bg-surface-variant text-on-surface font-extrabold text-xs transition-all disabled:opacity-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={
                    isDeletingAccount ||
                    deleteConfirmationText.trim() !== "تأكيد" ||
                    deletePassword.length < 6
                  }
                  className="px-5 py-2.5 rounded-xl bg-error text-on-error hover:bg-error/90 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحذف...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>تأكيد الحذف النهائياً</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

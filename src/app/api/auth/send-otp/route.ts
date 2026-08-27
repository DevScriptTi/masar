import { NextResponse } from "next/server";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { sendEmail } from "@/src/lib/mail";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, purpose = "signup" } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "يرجى تقديم عنوان بريد إلكتروني صحيح." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    // Store OTP in Firestore 'otps' collection (Email as doc ID)
    await setDoc(doc(db, "otps", cleanEmail), {
      code: otpCode,
      email: cleanEmail,
      purpose,
      expiresAt,
      createdAt: serverTimestamp(),
    });

    // Send HTML Email via central mail utility with dev override Requirement 2
    const mailResult = await sendEmail({
      to: cleanEmail,
      subject: "رمز التفعيل والتحقق من الحساب - منصة البكالوريا 2027",
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 30px; border-radius: 16px; max-width: 550px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">منصة البكالوريا 2027</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 5px;">رمز التحقق لتفعيل حسابك الشخصي</p>
          </div>
          <div style="background-color: #ffffff; padding: 25px; border-radius: 14px; border: 1px solid #cbd5e1; text-align: center;">
            <p style="color: #334155; font-size: 15px; font-weight: 600; margin-bottom: 15px;">كود التفعيل الخاص بك هو:</p>
            <div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5; background-color: #eef2ff; padding: 15px 25px; border-radius: 12px; display: inline-block; border: 1px border-dashed #6366f1;">
              ${otpCode}
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">هذا الرمز صالح لمدة 15 دقيقة فقط. يرجى عدم مشاركته مع أي شخص.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `تم إرسال كود التفعيل إلى بريدك الإلكتروني: ${cleanEmail}`,
      emailSent: mailResult.success,
      // For development testing when RESEND_API_KEY is not configured
      ...(process.env.NODE_ENV !== "production" ? { debugOtpCode: otpCode } : {}),
    });
  } catch (error: any) {
    console.error("Send OTP Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "حدث خطأ أثناء إرسال كود التفعيل." },
      { status: 500 }
    );
  }
}

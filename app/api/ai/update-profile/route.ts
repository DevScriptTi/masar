import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  getStudentMasterProfile,
  updateStudentMasterProfile,
} from "@/lib/firebase/masterProfile";

// Task A: Zod Schema for Structured Master Profile Delta
const ProfileUpdateSchema = z.object({
  newSkillTags: z
    .record(z.string(), z.enum(["ضعيف", "متوسط", "ممتاز"]))
    .describe(
      "A dictionary of math skills evaluated during the chat. Keep keys short in Arabic, e.g., 'النشر', 'المتراجحات'."
    ),
  resolvedMistakes: z
    .array(z.string())
    .describe(
      "Past mistakes the student successfully avoided this time (to be removed from their profile)."
    ),
  newCommonMistakes: z
    .array(z.string())
    .describe(
      "New, repeated mistakes the student made during this specific session."
    ),
});

export async function POST(req: Request) {
  try {
    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "مفتاح API غير متوفر في ملف البيئة .env.local" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { userId, studentId, messages } = body;

    const targetUserId = userId || studentId || "";

    if (!targetUserId || typeof targetUserId !== "string" || !targetUserId.trim()) {
      return new Response(
        JSON.stringify({ error: "معرف التلميذ (userId) مطلوب لإجراء التقييم." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ message: "سجل المحادثة فارغ، تم تخطي التحديث.", skipped: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const customGoogle = createGoogleGenerativeAI({
      apiKey: apiKey,
    });

    // Task B: Fetch current Master Profile from Firestore
    const currentProfile = await getStudentMasterProfile(targetUserId);

    const systemPrompt = `أنت خبير تربوي في تحليل الأداء المنهجي للتلاميذ في مادة الرياضيات منصة "مسار".
مهمتك هي تحليل سجل المحادثة المرفق بين التلميذ والمساعد الذكي واستخراج "الفروقات والتحديثات" (Delta) فقط على ملفه التراكمي.

الملف التراكمي الحالي للتلميذ:
- نقاط القوة والضعف (Skill Tags): ${JSON.stringify(currentProfile.skillTags || {})}
- الأخطاء الشائعة المسجلة (Common Mistakes): ${JSON.stringify(currentProfile.commonMistakes || [])}
- أسلوب التعلم المفضل: ${currentProfile.preferredLearningStyle || "غير محدد"}

قواعد التقييم الصارمة:
1. عدم التخمين (No Hallucination): لا تضف أي مهارة أو خطأ ما لم يكن هناك دليل واضح وصريح في سجل المحادثة المرفق.
2. الكلمات المفتاحية قصيرة وبسيطة باللغة العربية (مثل: "توحيد المقامات", "الاشتقاق", "نشر العبارات").
3. حدد المهارات بالقيم الصريحة فقط: ["ضعيف", "متوسط", "ممتاز"].
4. إذا لم يطرأ أي تغيير على عنصر ما، أرجع مصفوفة فارغة أو قاموساً فارغاً لهذا العنصر.`;

    // Format chat history messages for AI analysis
    const formattedMessages = messages.map((m: any) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    // Candidate fallback models sequence
    const candidateModels = [
      "gemini-2.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-2.5-pro",
    ];

    let deltaResult: z.infer<typeof ProfileUpdateSchema> | null = null;
    let lastError: any = null;

    // Automatic Model Fallback Loop for Profile Analysis
    for (const modelName of candidateModels) {
      try {
        console.log(`🤖 Analyzing chat session for MasterProfile update with model "${modelName}"...`);
        const { object } = await generateObject({
          model: customGoogle(modelName),
          schema: ProfileUpdateSchema,
          system: systemPrompt,
          messages: [
            ...formattedMessages,
            {
              role: "user",
              content:
                "يرجى استخراج التحديثات والفروقات (Delta) من هذه المحادثة وتوليد كائن JSON المطابق للنمط.",
            },
          ],
        });

        console.log(`✅ MasterProfile evaluation successful with model "${modelName}"`);
        deltaResult = object;
        break;
      } catch (err: any) {
        console.warn(`⚠️ Profile update model "${modelName}" failed:`, err?.message || err);
        lastError = err;
      }
    }

    if (!deltaResult) {
      throw lastError || new Error("فشل تحليل المحادثة وتوليد تحديثات الملف التراكمي.");
    }

    // Task C: Merge AI insights with current Master Profile
    const updatedSkillTags = {
      ...(currentProfile.skillTags || {}),
      ...(deltaResult.newSkillTags || {}),
    };

    // Filter out resolved mistakes
    const resolvedSet = new Set(
      (deltaResult.resolvedMistakes || []).map((s) => s.trim().toLowerCase())
    );
    const filteredCommonMistakes = (currentProfile.commonMistakes || []).filter(
      (m) => !resolvedSet.has(m.trim().toLowerCase())
    );

    // Merge new common mistakes avoiding duplicate entries
    const mergedMistakesSet = new Set(
      filteredCommonMistakes.map((m) => m.trim())
    );
    for (const newMistake of deltaResult.newCommonMistakes || []) {
      if (newMistake && newMistake.trim()) {
        mergedMistakesSet.add(newMistake.trim());
      }
    }
    const updatedCommonMistakes = Array.from(mergedMistakesSet);

    const mergedProfileData = {
      skillTags: updatedSkillTags,
      commonMistakes: updatedCommonMistakes,
    };

    // Save merged updates back into Firestore master_profiles doc
    await updateStudentMasterProfile(targetUserId, mergedProfileData);

    return new Response(
      JSON.stringify({
        success: true,
        userId: targetUserId,
        delta: deltaResult,
        updatedProfile: {
          ...currentProfile,
          ...mergedProfileData,
          studentId: targetUserId,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API Update Profile Route Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "حدث خطأ أثناء تحديث الملف التراكمي." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

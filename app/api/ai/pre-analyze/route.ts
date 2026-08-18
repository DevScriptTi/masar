import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// Zod Schema for Structured Homework Evaluation
export const evaluationSchema = z.object({
  exercises: z.array(
    z.object({
      exerciseNumber: z.string(),
      status: z.enum(["correct", "incorrect", "partial", "not_attempted"]),
      strengths: z
        .array(z.string())
        .describe("Student's strong points. Use Markdown and LaTeX ($or$$) for math."),
      mistakes: z
        .array(z.string())
        .describe("Mistakes found. Use Markdown and LaTeX ($or$$) for math."),
      methodologyNote: z.string(),
      fellIntoTrap: z.boolean(),
    })
  ),
  missingAnswers: z.array(z.string()),
  teacherSecretFlags: z.array(z.string()),
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

    const customGoogle = createGoogleGenerativeAI({
      apiKey: apiKey,
    });

    const body = await req.json();
    const { submissionId, images, latexReference, lessonContext } = body;

    const imagesPayload: string[] = Array.isArray(images) ? images : [];

    // Build multimodal image file parts with timeout fallback
    const imageParts: any[] = [];
    for (let idx = 0; idx < imagesPayload.length; idx++) {
      const url = imagesPayload[idx];
      if (url && typeof url === "string" && !url.toLowerCase().split("?")[0].endsWith(".pdf")) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
            imageParts.push({
              type: "file",
              data: buffer,
              mediaType: contentType,
            });
          }
        } catch {
          try {
            imageParts.push({
              type: "file",
              data: new URL(url),
              mediaType: "image/jpeg",
            });
          } catch {
            // Ignore invalid image URL
          }
        }
      }
    }

    const systemPrompt = `أنت خبير في تقييم إجابات الرياضيات لمنصة "مسار".
قم بتحليل صور حلول التلميذ المرفقة ومقارنتها بدقة متناهية مع الحل المرجعي وأكواد الـ LaTeX التالية:
--- بداية الحل المرجعي الرسمي ---
${latexReference && String(latexReference).trim() ? latexReference : "لا يوجد كود LaTeX مرجعي محدد، استند لقواعد الرياضيات المعتمدة."}
--- نهاية الحل المرجعي الرسمي ---

المطلوب: توليد تحليل هيكلي دقيق بأسلوب JSON يتوافق مع النمط المحدد.
اكتب الملاحظات والأخطاء والنقاط بأسلوب Markdown ومعادلات LaTeX محاطة بـ $ أو $$.`;

    // Primary model is set to gemini-1.5-flash, followed by fallback candidate models
    const candidateModels = [
      "gemini-1.5-flash",
      "gemini-3.5-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-2.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-2.5-pro",
    ];

    let evaluationResult: any = null;
    let lastError: any = null;

    // Automatic Fallback retry loop for generateObject
    for (const modelName of candidateModels) {
      try {
        console.log(`🤖 Pre-Analysis attempt with model "${modelName}"...`);
        const { object } = await generateObject({
          model: customGoogle(modelName),
          schema: evaluationSchema,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `يرجى إجراء التقييم المسبق وتوليد الـ JSON لإجابات التلميذ المرفقة في درس "${lessonContext || "الرياضيات"}".`,
                },
                ...imageParts,
              ],
            },
          ],
        });

        console.log(`✅ Success pre-analyzing submission with model "${modelName}"`);
        evaluationResult = object;
        break;
      } catch (err: any) {
        const isQuotaOr429 =
          err?.status === 429 ||
          err?.statusCode === 429 ||
          String(err?.message || "").includes("429") ||
          String(err?.message || "").includes("Quota") ||
          String(err?.message || "").includes("RESOURCE_EXHAUSTED") ||
          String(err?.message || "").includes("rateLimitExceeded");

        if (isQuotaOr429) {
          console.warn(
            `⚠️ Pre-analysis primary model "${modelName}" failed (Quota/429). Triggering fallback to secondary model...`,
            err?.message || err
          );
        } else {
          console.warn(`⚠️ Pre-analysis attempt with "${modelName}" failed:`, err?.message || err);
        }
        lastError = err;
      }
    }

    if (!evaluationResult) {
      throw lastError || new Error("فشل التقييم المسبق عبر الذكاء الاصطناعي.");
    }

    // Save generated evaluation cache into Firestore submission document if submissionId is provided
    if (submissionId && typeof submissionId === "string") {
      try {
        const subRef = doc(db, "submissions", submissionId);
        await updateDoc(subRef, {
          aiEvaluationCache: evaluationResult,
          aiEvaluatedAt: new Date().toISOString(),
        });
        console.log(`✅ Saved aiEvaluationCache to Firestore for submission "${submissionId}"`);
      } catch (fsErr) {
        console.warn(`Could not update Firestore submission "${submissionId}" with aiEvaluationCache:`, fsErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, aiEvaluationCache: evaluationResult }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Pre-Analyze Route Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "حدث خطأ أثناء إجراء التقييم المسبق." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

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
    const {
      messages,
      prompt,
      lessonContext,
      lessonSummary,
      studentImages,
      latexContent,
      attachments,
    } = body;

    const baseMessages =
      Array.isArray(messages) && messages.length > 0
        ? messages
        : [{ role: "user", content: prompt || "مرحبا" }];

    // Aggregate all LaTeX contents passed directly or via attachments array
    let aggregatedLatex = latexContent && typeof latexContent === "string" ? latexContent.trim() : "";
    if (Array.isArray(attachments)) {
      const latexFromAtts = attachments
        .map((att: any) => (typeof att === "object" && att.latexContent ? att.latexContent : ""))
        .filter(Boolean)
        .join("\n\n");
      if (latexFromAtts) {
        aggregatedLatex = (aggregatedLatex ? aggregatedLatex + "\n\n" : "") + latexFromAtts;
      }
    }

    // Strict System Prompt adhering strictly to lessonSummary & master LaTeX context
    let systemPrompt = `أنت مساعد تعليمي لمادة الرياضيات. تقيد حرفياً وفقط بالمعلومات الموجودة في 'ملخص الدرس' أدناه. لا تقترح أو تذكر أي دروس، قواعد، أو مفاهيم (مثل PGCD أو PPCM أو أي مفهوم لم يُذكر) لم تُذكر صراحة في الملخص. إذا سألك التلميذ سؤالاً خارج الملخص، أعد توجيهه بلطف إلى محتوى الدرس.

سياق الدرس الحالي: "${lessonContext || "الرياضيات"}"

--- بداية ملخص الدرس الرسمي ---
${lessonSummary && String(lessonSummary).trim() ? lessonSummary : "محتوى وقوانين درس الرياضيات المعتمد."}
--- نهاية ملخص الدرس الرسمي ---

القواعد الأساسية:
1. المنهج السقراطي: لا تعطِ الحل النهائي أو الإجابة المباشرة أبداً، بل اطرح أسئلة توجيهية وخطوات مساعدة ليقوم التلميذ باكتشاف الحل بنفسه.
2. التنسيق: اكتب كافة الصيغ، المعاملات، المتغيرات والأرقام بأسلوب LaTeX محاطاً بـ $ للمعادلات المضمنة و $$ للمعادلات المستقلة.
3. التواضع والتشجيع: تحدث بأسلوب أستاذ رياضيات مشجع ولطيف.`;

    if (aggregatedLatex) {
      systemPrompt += `\n\n--- بداية المراجع وأكواد الـ LaTeX والحلول النموذجية المعتمدة للدرس ---
${aggregatedLatex}
--- نهاية المراجع والحلول النموذجية المعتمدة ---
هذه هي المراجع وأكواد الـ LaTeX الخاصة بالتمارين والحلول النموذجية المعتمدة لهذا الدرس. استخدمها حصرياً لمقارنة حلول التلميذ وتوجيهه سقراطياً واكتشاف أي خطأ منهجي أو حسابي في حله.`;
    }

    // Inject Vision Instructions if studentImages are provided
    if (Array.isArray(studentImages) && studentImages.length > 0) {
      systemPrompt += `\n\n4. لقد قام التلميذ بإرفاق صور لحله. قم بتحليل الصور المرفقة، واكتشف الأخطاء المنهجية أو الحسابية بناءً على قواعد الدرس وأكواد الحلول المعتمدة. لا تعطه الحل النهائي، بل وجهه لاكتشاف خطئه.`;
    }

    // Build Multimodal Message Array for Vercel AI SDK Vision Capabilities
    const promptMessages = [...baseMessages];
    if (Array.isArray(studentImages) && studentImages.length > 0) {
      const lastUserIdx = promptMessages.map((m) => m.role).lastIndexOf("user");
      if (lastUserIdx !== -1) {
        const lastMsg = promptMessages[lastUserIdx];
        const textContent = typeof lastMsg.content === "string" ? lastMsg.content : "";

        const contentParts: any[] = [
          { type: "text", text: textContent || "يرجى الاطلاع على الصور المرفقة لحلي وتحليلها." },
        ];

        for (const imgUrl of studentImages) {
          if (imgUrl && typeof imgUrl === "string" && !imgUrl.toLowerCase().split("?")[0].endsWith(".pdf")) {
            try {
              contentParts.push({
                type: "image",
                image: new URL(imgUrl),
              });
            } catch {
              contentParts.push({
                type: "image",
                image: imgUrl,
              });
            }
          }
        }

        promptMessages[lastUserIdx] = {
          ...lastMsg,
          content: contentParts,
        };
      }
    }

    // Deprecated models returned by Google that throw 404 for new users
    const deprecated = [
      "gemini-2.5-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
    ];

    // Priority ordered active non-deprecated models for new Gemini API keys
    const activePriority = [
      "gemini-3.5-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro",
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash-image",
    ];

    let candidateModels = activePriority;

    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        if (Array.isArray(listData.models)) {
          const validNames: string[] = listData.models
            .filter((m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
            )
            .map((m: any) => m.name.replace(/^models\//, ""))
            .filter((name: string) => !deprecated.includes(name));

          if (validNames.length > 0) {
            candidateModels = validNames.sort((a, b) => {
              const priorityA = activePriority.indexOf(a);
              const priorityB = activePriority.indexOf(b);
              if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;
              if (priorityA !== -1) return -1;
              if (priorityB !== -1) return 1;
              return 0;
            });
            console.log("📋 Prioritized Active Gemini models (excluding deprecated):", candidateModels);
          }
        }
      }
    } catch (err) {
      console.warn("Model discovery fetch fallback used:", err);
    }

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`🤖 Attempting streamText with active model "${modelName}"...`);
        const result = await streamText({
          model: customGoogle(modelName),
          system: systemPrompt,
          messages: promptMessages,
        });

        console.log(`✅ Success streaming AI Tutor response with model "${modelName}"`);
        return result.toTextStreamResponse();
      } catch (err: any) {
        console.warn(`⚠️ Model "${modelName}" failed:`, err?.message || err);
        lastError = err;
      }
    }

    throw lastError || new Error("فشل الاتصال بجميع نماذج الذكاء الاصطناعي.");
  } catch (error: any) {
    console.error("API Chat Route Crash:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "حدث خطأ أثناء معالجة الطلب." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

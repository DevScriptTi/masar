import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { getStudentMasterProfile } from "@/lib/firebase/masterProfile";

// Resilient server-side image fetch helper using Vercel AI SDK "file" content part (non-deprecated)
async function fetchImagePart(url: string, index: number): Promise<any> {
  if (!url || typeof url !== "string" || url.toLowerCase().split("?")[0].endsWith(".pdf")) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`⚠️ Failed to download image [${index + 1}] (${url}) - Status: ${res.status}`);
      return {
        type: "text",
        text: `[الصورة ${index + 1}: ${url}] (تعذر المعاينة المباشرة للصورة بسبب استجابة السيرفر)`,
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0];

    // Standard non-deprecated Vercel AI SDK Core "file" content part structure
    return {
      type: "file",
      data: buffer,
      mediaType: contentType,
    };
  } catch (err: any) {
    console.warn(`⚠️ Image [${index + 1}] download skipped due to timeout/network error:`, err?.message || err);
    try {
      return {
        type: "file",
        data: new URL(url),
        mediaType: "image/jpeg",
      };
    } catch {
      return {
        type: "text",
        text: `[رابط الصورة ${index + 1}: ${url}]`,
      };
    }
  }
}

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
      userId,
      studentId,
      studentName,
      lessonContext,
      lessonSummary,
      studentImages,
      uploadedImages,
      latexContent,
      attachments,
      aiEvaluationCache,
      forceVision,
      data,
    } = body;

    const targetUserId =
      userId ||
      studentId ||
      (data && (data.userId || data.studentId)) ||
      "";

    // Task C: Non-blocking execution for Master Profile fetch
    let masterProfile = null;
    if (targetUserId) {
      try {
        masterProfile = await getStudentMasterProfile(targetUserId);
      } catch (profileErr) {
        console.warn("Non-blocking MasterProfile fetch error:", profileErr);
      }
    }

    const studentDisplayName =
      studentName || (data && data.studentName) || "التلميذ العزيز";

    const evalCacheObj = aiEvaluationCache || (data && data.aiEvaluationCache);
    const evalCacheStr = evalCacheObj
      ? typeof evalCacheObj === "string"
        ? evalCacheObj
        : JSON.stringify(evalCacheObj)
      : "";

    const baseMessages =
      Array.isArray(messages) && messages.length > 0
        ? messages
        : [{ role: "user", content: prompt || "مرحبا" }];

    // Extract images list from uploadedImages, studentImages, or data.uploadedImages
    const imagesPayload: string[] =
      Array.isArray(uploadedImages) && uploadedImages.length > 0
        ? uploadedImages
        : Array.isArray(studentImages) && studentImages.length > 0
        ? studentImages
        : data && Array.isArray(data.uploadedImages)
        ? data.uploadedImages
        : [];

    // Only include heavy vision image downloads if forceVision is explicitly true
    const shouldIncludeImages = forceVision === true && imagesPayload.length > 0;

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

    // Strict System Prompt incorporating Pre-Analysis Cache, Master Profile, Socratic Pacing, Student Name, Smart Chips & Textbook Formatting
    let systemPrompt = `أنت مساعد ذكي لسقراطي في منصة "مسار". التلميذ الذي تتحدث معه اسمه "${studentDisplayName}".

القواعد الصارمة للرد:
1. المناداة بالاسم: يجب أن تذكر اسم التلميذ (${studentDisplayName}) في ردودك دائماً لخلق ألفة وتشجيع.
2. التقطيع السقراطي: لا تقم بتشخيص كل الصور أو الأخطاء دفعة واحدة. قدم ملاحظة واحدة فقط أو خطأ واحداً، ثم اسأل التلميذ سؤالاً تفاعلياً ليفكر فيه، وانتظر رده.
3. التنسيق والأسلوب المدرسي الممتاز: استخدم عناوين Markdown (مثل ### الخطوة الأولى:) لتنظيم ردك كأنه كتاب مدرسي للرياضيات. قم بتظليل الكلمات المفتاحية بخط غامق (Bold). تأكد من وضع جميع المتغيرات والمعادلات الرياضية، حتى البسيطة منها مثل $x=0$ أو $x-1=0$، بين علامات $ لكي يتم تنسيقها بشكل صحيح باللون الأزرق المنهجي ومنع تفككها في اتجاه RTL.
4. الإشارة للصور: عند الإشارة إلى صورة من صور التلميذ، استخدم هذا التنسيق الحرفي فقط: [الصورة X](#image-X) حيث X هو رقم الصورة (مثل #image-1 للصورة الأولى، #image-2 للصورة الثانية...). لا تضع أفكاراً أو روابط وهمية بديلة.
5. الردود المقترحة (Smart Chips): في نهاية كل رد لك، يجب أن تقترح على التلميذ 2 أو 3 خيارات قصيرة وذكية للرد. اكتب كل خيار في سطر جديد بالصيغة التالية حصراً: [اقتراح: نص الرد المقترح هنا].
6. التعامل مع أكواد LaTeX المرفقة: إذا احتوى المرجع أو رسالة المستخدم على كود LaTeX كامل (مستند بحزم وديباجة مثل \\documentclass أو \\usepackage أو tcolorbox)، قم باستخلاص المفاهيم الرياضية، التمارين والحلول النموذجية منه فقط. لا تقم أبداً بإرجاع أو طباعة أوامر الديباجة في ردودك للتلميذ.

سياق الدرس الحالي: "${lessonContext || "الرياضيات"}"

--- بداية ملخص الدرس الرسمي ---
${lessonSummary && String(lessonSummary).trim() ? lessonSummary : "محتوى وقوانين درس الرياضيات المعتمد."}
--- نهاية ملخص الدرس الرسمي ---`;

    // Task B: Inject Master Profile (Cumulative Learning Memory) into System Prompt
    if (
      masterProfile &&
      ((masterProfile.skillTags && Object.keys(masterProfile.skillTags).length > 0) ||
        (masterProfile.commonMistakes && masterProfile.commonMistakes.length > 0) ||
        masterProfile.preferredLearningStyle)
    ) {
      systemPrompt += `\n\n--- الذاكرة التراكمية للتلميذ (Master Profile) ---
نقاط القوة والضعف (Skill Tags): ${JSON.stringify(masterProfile.skillTags || {})}
الأخطاء الشائعة التي يقع فيها (Common Mistakes): ${JSON.stringify(masterProfile.commonMistakes || [])}
${masterProfile.preferredLearningStyle ? `أسلوب التعلم المفضل: ${masterProfile.preferredLearningStyle}` : ""}
--- نهاية الذاكرة التراكمية ---
استخدم هذه الذاكرة التراكمية لتوجيه التلميذ بشكل مخصص ومساعدته على تجاوز نقاط ضعفه وأخطائه المنهجية السابقة.`;
    }

    if (evalCacheStr) {
      systemPrompt += `\n\n--- بداية الملخص والتقييم المسبق لإجابات التلميذ (AI Evaluation JSON) ---
${evalCacheStr}
--- نهاية الملخص والتقييم المسبق ---
لديك ملخص مسبق لإجابات التلميذ (JSON) استند إليه دائماً لسرعة الرد وإجابة التلميذ فوراً بدون الحاجة للصور.
قاعدة استثنائية (Vision Fallback): إذا اعترض التلميذ صراحة على تقييمك، أو طلب مراجعة صورة محددة أو خطوة معينة، تجاهل الملخص مؤقتاً، واعتمد على الصور المرفقة في هذه المحادثة لقراءتها بصرياً بدقة وتصحيح الموقف.`;
    }

    if (aggregatedLatex) {
      systemPrompt += `\n\n--- بداية المراجع وأكواد الـ LaTeX والحلول النموذجية المعتمدة للدرس ---
${aggregatedLatex}
--- نهاية المراجع والحلول النموذجية المعتمدة ---
هذه هي المراجع وأكواد الـ LaTeX الخاصة بالتمارين والحلول النموذجية المعتمدة لهذا الدرس. استخدمها حصرياً لمقارنة حلول التلميذ وتوجيهه سقراطياً واكتشاف أي خطأ منهجي أو حسابي في حله.`;
    }

    // Inject Vision Instructions ONLY if forceVision requested image attachment
    if (shouldIncludeImages) {
      systemPrompt += `\n\n7. صور حل التلميذ المرفقة: لقد طلب التلميذ مراجعة صور إجابته بصرياً المرفقة (${imagesPayload.length} صورة). عند الإشارة إلى أي صورة أو خطأ فيها، استخدم التنسيق الحرفي الحصري التالي فقط: [الصورة X](#image-X) حيث X هو رقم الصورة الحقيقي (من 1 إلى ${imagesPayload.length}).`;
    }

    // Fast Payload vs Multimodal Vision Payload
    const promptMessages = [...baseMessages];
    if (shouldIncludeImages) {
      const lastUserIdx = promptMessages.map((m) => m.role).lastIndexOf("user");
      if (lastUserIdx !== -1) {
        const lastMsg = promptMessages[lastUserIdx];
        const textContent = typeof lastMsg.content === "string" ? lastMsg.content : "";

        const multimodalContent: any[] = [
          { type: "text", text: textContent || "الرجاء الاطلاع على الصور المرفقة لحلي وتحليلها." },
        ];

        // Fetch image buffers in parallel with 6s timeout fallback
        const imagePartsPromises = imagesPayload.map((url, idx) => fetchImagePart(url, idx));
        const resolvedParts = await Promise.all(imagePartsPromises);

        for (const part of resolvedParts) {
          if (part) {
            multimodalContent.push(part);
          }
        }

        promptMessages[lastUserIdx] = {
          ...lastMsg,
          content: multimodalContent,
        };
      }
    }

    // Primary Model -> Fallback Model Sequence (gemini-3.1-flash-lite -> gemini-2.5-flash-lite -> gemini-3.5-flash)
    let result;
    let finalModelUsed = "gemini-3.1-flash-lite";

    try {
      console.log(
        `🤖 Attempting streamText with primary model: "${finalModelUsed}" (forceVision: ${shouldIncludeImages})...`
      );
      result = await streamText({
        model: customGoogle(finalModelUsed),
        system: systemPrompt,
        messages: promptMessages,
      });
    } catch (primaryError: any) {
      console.warn(
        `⚠️ Primary model "${finalModelUsed}" failed. Triggering fallback to gemini-2.5-flash-lite... Error:`,
        primaryError?.message || primaryError
      );

      // Fallback Model 1
      finalModelUsed = "gemini-2.5-flash-lite";
      console.log(`🤖 Attempting streamText with fallback model: "${finalModelUsed}"...`);

      try {
        result = await streamText({
          model: customGoogle(finalModelUsed),
          system: systemPrompt,
          messages: promptMessages,
        });
      } catch (fallbackError: any) {
        console.warn(
          `⚠️ Secondary model "${finalModelUsed}" failed. Attempting tertiary fallback (gemini-3.5-flash)... Error:`,
          fallbackError?.message || fallbackError
        );

        // Fallback Model 2
        finalModelUsed = "gemini-3.5-flash";
        try {
          result = await streamText({
            model: customGoogle(finalModelUsed),
            system: systemPrompt,
            messages: promptMessages,
          });
        } catch (tertiaryError: any) {
          console.error("🚨 All candidate models completely failed.");
          throw tertiaryError;
        }
      }
    }

    console.log(`✅ Success streaming AI Tutor response with model "${finalModelUsed}"`);
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("API Chat Route Crash:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "حدث خطأ أثناء معالجة الطلب." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
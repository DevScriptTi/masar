import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getStudentMasterProfile } from "@/lib/firebase/masterProfile";
import { getModuleById } from "@/src/lib/firebase/coursesService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// Resolve Student Cohort / Group IDs for Isolation (Requirement 3)
async function resolveStudentCohortIds(studentId: string, providedCohortIds?: string[]): Promise<string[]> {
  if (Array.isArray(providedCohortIds) && providedCohortIds.length > 0) {
    return providedCohortIds;
  }
  if (!studentId) return [];

  try {
    const uSnap = await getDoc(doc(db, "users", studentId.trim()));
    if (uSnap.exists()) {
      const uData = uSnap.data();
      const groupIds = uData.groupIds || uData.cohortIds || uData.groups || [];
      if (Array.isArray(groupIds)) return groupIds;
    }
  } catch (err) {
    console.warn("Error fetching student cohorts for isolation:", err);
  }
  return [];
}

// Backend-Resolved Deep Isolation Engine (Requirement 3)
function resolveIsolationDirectives(
  isolationRules: any[],
  studentId: string,
  cohortIds: string[]
): string[] {
  if (!Array.isArray(isolationRules) || isolationRules.length === 0) {
    return [];
  }

  const resolvedDirectives: string[] = [];

  for (const rule of isolationRules) {
    if (!rule) continue;

    const targetType = rule.targetType || rule.targetAudience;
    const targetId = rule.targetId;
    const sIds = rule.studentIds || rule.isolatedStudentIds || rule.targetIds || [];
    const gIds = rule.groupIds || rule.cohortIds || rule.targetGroupIds || [];
    const directiveText = (
      rule.directive ||
      rule.specificContextNote ||
      rule.stationContextNote ||
      rule.note ||
      ""
    ).trim();

    if (!directiveText) continue;

    const isAll = targetType === "all" || targetType === "everyone";
    const isStudentMatch =
      targetType === "student"
        ? targetId === studentId || sIds.includes(studentId)
        : targetId === studentId || sIds.includes(studentId);

    const isCohortMatch =
      targetType === "cohort"
        ? (targetId && cohortIds.includes(targetId)) || gIds.some((g: string) => cohortIds.includes(g))
        : gIds.some((g: string) => cohortIds.includes(g));

    if (isAll || isStudentMatch || isCohortMatch) {
      resolvedDirectives.push(directiveText);
    }
  }

  return Array.from(new Set(resolvedDirectives));
}

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
      hiddenTeacherDirectives,
      moduleId,
      data,
    } = body;

    console.log("==== DEBUG STAGE 1: Received Directives ====", hiddenTeacherDirectives);

    const targetUserId =
      userId ||
      studentId ||
      (data && (data.userId || data.studentId)) ||
      "";

    const targetModuleId =
      moduleId ||
      (data && data.moduleId) ||
      "";

    const teacherDirectivesStr =
      hiddenTeacherDirectives ||
      (data && data.hiddenTeacherDirectives) ||
      "";

    // Non-blocking execution for Master Profile fetch
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

    // Resolve Cohort/Group IDs for targetUserId (Requirement 3)
    const cohortIds = await resolveStudentCohortIds(
      targetUserId,
      body.cohortIds || body.groupIds || (data && (data.cohortIds || data.groupIds))
    );

    // Deep Firestore Traversal: Activity -> Module -> Course
    let courseTitle =
      body.courseTitle ||
      body.courseName ||
      (body.course && (body.course.title || body.course.name)) ||
      (data && (data.courseTitle || data.courseName || (data.course && (data.course.title || data.course.name)))) ||
      "";

    let moduleTitle =
      body.moduleTitle ||
      body.moduleName ||
      body.sectionName ||
      (body.module && (body.module.title || body.module.name)) ||
      (data && (data.moduleTitle || data.moduleName || data.sectionName || (data.module && (data.module.title || data.module.name)))) ||
      "";

    let activityTitle =
      body.activityTitle ||
      body.activityName ||
      body.title ||
      body.lessonContext ||
      (body.activity && (body.activity.title || body.activity.name)) ||
      (data && (data.activityTitle || data.activityName || data.title || data.lessonContext || (data.activity && (data.activity.title || data.activity.name)))) ||
      "";

    let courseIndexContext =
      body.courseIndexContext ||
      body.indexContext ||
      body.courseSyllabus ||
      (body.course && (body.course.courseIndexContext || body.course.indexContext)) ||
      (data && (data.courseIndexContext || data.indexContext || data.courseSyllabus || (data.course && (data.course.courseIndexContext || data.course.indexContext)))) ||
      "";

    let activityGlobalContext =
      body.globalContext ||
      body.globalLatexSummary ||
      lessonSummary ||
      (body.activity && (body.activity.globalContext || body.activity.globalLatexSummary || body.activity.description)) ||
      (data && (data.globalContext || data.globalLatexSummary || data.lessonSummary)) ||
      "";

    let courseId = body.courseId || (data && data.courseId);
    let resolvedModuleId = moduleId || body.sectionId || (data && (data.moduleId || data.sectionId));
    const activityId = body.activityId || (data && data.activityId);

    try {
      if (activityId) {
        const aSnap = await getDoc(doc(db, "activities", activityId));
        if (aSnap.exists()) {
          const actData = aSnap.data();
          if (!activityTitle) activityTitle = actData.title || actData.name || "";
          if (!activityGlobalContext) {
            activityGlobalContext = actData.globalContext || actData.globalLatexSummary || actData.description || "";
          }
          if (!resolvedModuleId) resolvedModuleId = actData.moduleId || actData.sectionId;
          if (!courseId) courseId = actData.courseId;
        }
      }

      if (resolvedModuleId) {
        const mSnap = await getDoc(doc(db, "modules", resolvedModuleId));
        if (mSnap.exists()) {
          const mData = mSnap.data();
          if (!moduleTitle) moduleTitle = mData.title || mData.name || "";
          if (!courseId) courseId = mData.courseId;
        }
      }

      if (courseId) {
        const cSnap = await getDoc(doc(db, "courses", courseId));
        if (cSnap.exists()) {
          const cData = cSnap.data();
          if (!courseTitle) courseTitle = cData.title || cData.name || "";
          if (!courseIndexContext) {
            courseIndexContext =
              cData.courseIndexContext ||
              cData.indexContext ||
              cData.syllabus ||
              cData.syllabusContext ||
              "";
          }
        }
      }
    } catch (err: any) {
      console.warn("Spatio-Temporal & Course Syllabus Breadcrumbs Firestore fetch error:", err);
    }

    const finalCourseTitle = courseTitle.trim() || "المادة الحالية";
    const finalModuleTitle = moduleTitle.trim() || "غير محدد";
    const finalActivityTitle = activityTitle.trim() || "غير محدد";
    const finalCourseIndex = courseIndexContext.trim() || "لا يوجد فهرس متاح.";
    const finalActivityGlobalContext = (activityGlobalContext && String(activityGlobalContext).trim()) || aggregatedLatex || "لا توجد قوانين مدخلة.";

    // Station Mode Check & System Log Injection
    const isStationChat = Boolean(
      body.isStationMode ||
      body.stationMode ||
      body.currentStation ||
      (data && (data.isStationMode || data.stationMode || data.currentStation))
    );

    const stationData =
      body.currentStation ||
      (data && data.currentStation) || {
        title: body.stationTitle || "المحطة الحالية",
        challenge: body.stationChallenge || body.stationContent || "حل المطلوب وتزويد المساعد بإجابتك",
        content: body.stationChallenge || body.stationContent || "حل المطلوب وتزويد المساعد بإجابتك",
        groundTruth: body.stationGroundTruth || "",
        pedagogyRules: body.stationPedagogyRules || body.stationAiDirectives || teacherDirectivesStr || "",
        aiDirectives: body.stationPedagogyRules || body.stationAiDirectives || teacherDirectivesStr || "",
        customIsolations: body.stationCustomIsolations || [],
      };

    // Deep Isolation Directives Resolution
    const rawGlobalIsolations =
      body.globalCustomIsolations ||
      body.isolationRules ||
      (body.activity && body.activity.globalCustomIsolations) ||
      (data && (data.globalCustomIsolations || data.isolationRules || (data.activity && data.activity.globalCustomIsolations))) ||
      [];

    const rawStationIsolations =
      stationData.customIsolations ||
      body.stationCustomIsolations ||
      (data && (data.stationCustomIsolations || (data.currentStation && data.currentStation.customIsolations))) ||
      [];

    const combinedIsolationRules = [
      ...(Array.isArray(rawGlobalIsolations) ? rawGlobalIsolations : []),
      ...(isStationChat && Array.isArray(rawStationIsolations) ? rawStationIsolations : []),
    ];

    const resolvedDirectives = resolveIsolationDirectives(combinedIsolationRules, targetUserId, cohortIds);

    if (resolvedDirectives.length === 0) {
      if (body.globalIsolationNote) resolvedDirectives.push(body.globalIsolationNote);
      if (isStationChat && body.stationIsolationNote) resolvedDirectives.push(body.stationIsolationNote);
    }

    const formattedIsolationRules =
      resolvedDirectives.length > 0
        ? resolvedDirectives.map((d) => `- ${d}`).join("\n")
        : "لا توجد توجيهات خاصة.";

    // Extract attachments metadata payload Requirement 3
    const attachmentsPayload: any[] =
      Array.isArray(attachments) && attachments.length > 0
        ? attachments
        : Array.isArray(body.activityAttachments)
        ? body.activityAttachments
        : data && Array.isArray(data.attachments)
        ? data.attachments
        : [];

    let formattedAttachmentsMetadata = "- لا توجد مرفقات حالياً.";
    if (attachmentsPayload.length > 0) {
      formattedAttachmentsMetadata = attachmentsPayload
        .map((a: any) => {
          const titleStr = typeof a === "string" ? a : a.title || a.name || a.filename || "ملف مرفق";
          const typeStr = typeof a === "object" && a.type ? a.type : typeof a === "string" && a.includes("video") ? "فيديو" : "مستند/PDF";
          return `- ملف: ${titleStr} (نوع: ${typeStr})`;
        })
        .join("\n");
    }

    // STRICT MULTI-SUBJECT SYSTEM PROMPT TEMPLATE (Guardrails & Anti-Hallucination)
    let strictSystemPrompt = `أنت مساعد تعليمي ذكي وداعم (Socratic AI Tutor) متخصص في مادة (${finalCourseTitle}).
مهمتك هي مرافقة التلميذ (${studentDisplayName}) خطوة بخطوة للتمكن من المفاهيم.

[التموضع الحالي للنشاط]:
المسار الدراسي: ${finalCourseTitle}
الوحدة التعليمية: ${finalModuleTitle}
النشاط الحالي (مهمتك الأساسية): ${finalActivityTitle}

🛑 [البروتوكول العسكري للفحص (Strict Audit Protocol) - إجباري وحتمي]:
أنت لست مساعداً تقليدياً للدردشة، أنت "مفتش تدريب صارم ودقيق". يُمنع منعاً باتاً الرد بفقرات سردية أو مجاملات طويلة. 
عندما يرسل التلميذ إجابة (خاصة الصور)، يجب عليك مقارنة إجابته بـ [الحل النموذجي المعتمد] نقطة بنقطة. ثم بناء ردك *حصرياً* باستخدام هذا القالب الثابت (انسخ العناوين كما هي واملأها):

---
📋 **تقرير الفحص السقراطي:**

✅ **النقاط المكتسبة:** 
- [اذكر باختصار شديد ما أصاب فيه، مثال: النشر والتحليل صحيحان].

❌ **الأخطاء المرصودة (بدون إعطاء الحل):**
- [الخطأ 1: كذا وكذا...]
- [الخطأ 2: كذا وكذا...] (إذا لم توجد أخطاء، اكتب: لا يوجد).

⚠️ **الأسئلة المتجاهلة أو الناقصة:**
- [السؤال كذا...] (إذا أجاب على كل شيء، اكتب: لا يوجد).

📌 **تنبيه هام:** تذكر يا ${studentDisplayName || "بطل"} أن التصحيح النهائي والتقييم سيكون من طرف أستاذك (الأستاذ جعفري). دوري هنا هو تدريبك لتفادي هذه الأخطاء أمامه!

🎯 **مهمتنا الآن (خطوة بخطوة):**
[اطرح هنا سؤالاً سقراطياً واحداً فقط لمعالجة الخطأ الأول أو النقص الأول. يُمنع منعاً باتاً مناقشة أكثر من نقطة واحدة في نفس الوقت].
---

قواعد إضافية للتتبع:
1. في الردود القادمة، لا تنتقل إلى "الخطأ 2" حتى يصحح التلميذ "الخطأ 1" بنسبة 100%.
2. ذكر التلميذ دائماً بما تبقى من القائمة أعلاه إذا حاول التهرب أو القفز لسؤال آخر.

====================
[الدستور العام للنشاط (القوانين والمعارف)]:
${finalActivityGlobalContext}
====================

[توجيهات سرية خاصة بهذا التلميذ]:
${formattedIsolationRules}`;

    // Station Task & Attachments (If Station Mode)
    if (isStationChat) {
      const stationChallengeText = stationData.challenge || stationData.content || "حل المطلوب وتزويد المساعد بإجابتك";
      const stationGroundTruthText = stationData.groundTruth ? `\n\nالحل النموذجي المعتمد (Ground Truth - للتقييم الداخلي فقط ومقارنة الحلول):\n${stationData.groundTruth}` : "";
      const stationPedagogyText = stationData.pedagogyRules || stationData.aiDirectives || "لا يوجد.";

      strictSystemPrompt += `\n\n====================
[المهمة الحالية (${stationData.title || "المحطة الحالية"})]:
العنوان: ${stationData.title || "المحطة الحالية"}
نص التمرين (Challenge): ${stationChallengeText}${stationGroundTruthText}
التوصيات البيداغوجية وقواعد التوجيه (Pedagogy Guardrails): ${stationPedagogyText}

المحتوى والمرفقات المتوفرة للتلميذ في هذه الصفحة:
${formattedAttachmentsMetadata}

قواعد المحطة:
1. قيّم أي إجابة أو صورة يرسلها التلميذ بناءً على التوجيه السري والحل النموذجي للمحطة الحالية حصراً.
2. لا تنتقل لطلب مهام المحطة التالية؛ ركز فقط على المحطة الحالية.
====================`;
    }

    // Pre-Analysis Evaluation Cache Injection
    if (evalCacheStr) {
      strictSystemPrompt += `\n\n--- بداية الملخص والتقييم المسبق لإجابات التلميذ (AI Evaluation JSON) ---
${evalCacheStr}
--- نهاية الملخص والتقييم المسبق ---
لديك ملخص مسبق لإجابات التلميذ (JSON) استند إليه دائماً لسرعة الرد وإجابة التلميذ فوراً بدون الحاجة للصور.
قاعدة استثنائية (Vision Fallback): إذا اعترض التلميذ صراحة على تقييمك، أو طلب مراجعة صورة محددة أو خطوة معينة، تجاهل الملخص مؤقتاً، واعتمد على الصور المرفقة في هذه المحادثة لقراءتها بصرياً بدقة وتصحيح الموقف.`;
    }

    // Model LaTeX Solutions & References
    if (aggregatedLatex && !finalActivityGlobalContext.includes(aggregatedLatex)) {
      strictSystemPrompt += `\n\n--- بداية المراجع وأكواد الـ LaTeX والحلول النموذجية المعتمدة للنشاط ---
${aggregatedLatex}
--- نهاية المراجع والحلول النموذجية المعتمدة ---`;
    }

    // Teacher Directives
    if (teacherDirectivesStr && teacherDirectivesStr.trim() !== "") {
      strictSystemPrompt += `\n\n### توجيهات إضافية وسرية من أستاذ المادة لهذا النشاط:\n${teacherDirectivesStr.trim()}`;
    }

    // Technical Formatting Directives
    const technicalDirectives = `
=== توجيهات تنسيقية تقنية صارمة (يجب الالتزام بها حرفياً) ===
1. **تنسيق النهايات والمعادلات:** تأكد من وضع جميع الرموز والمعادلات الرياضية بين $ للمعادلات المضمنة و $$ للكتل. عند كتابة أي نهاية رياضية استخدم الصيغة: \\lim\\limits_{x \\to a}.
2. **الإشارة للصور المرفقة:** التلميذ أرفق صوراً لحله. عندما تشير إلى هذه الصور في ردك، استخدم كلمات عادية مثل "في صورتك الأولى" أو "في الحل المرفق". يُمنع منعاً باتاً استخدام أي روابط ماركداون (Markdown Links) للصور مثل [الصورة 1](#) أو محاولة تضمين رابط الصورة. فقط أشر إليها نصياً.
`.trim();

    strictSystemPrompt += `\n\n${technicalDirectives}`;

    const finalSystemPrompt = strictSystemPrompt;

    // Debugging Log (Requirement 4)
    console.log("FINAL SYSTEM PROMPT HEADER:", finalSystemPrompt.substring(0, 300));
    console.log("\n========== [SYSTEM PROMPT DEBUG START] ==========");
    console.log(finalSystemPrompt);
    console.log("========== [SYSTEM PROMPT DEBUG END] ==========\n");

    // Reference Images Injection (Teacher's Official Reference Diagrams / Graphs)
    const referenceImageUrlsPayload: string[] =
      Array.isArray(body.referenceImageUrls) && body.referenceImageUrls.length > 0
        ? body.referenceImageUrls
        : data && Array.isArray(data.referenceImageUrls)
        ? data.referenceImageUrls
        : [];

    const referenceMessages: any[] = [];
    if (referenceImageUrlsPayload.length > 0) {
      const refPartsPromises = referenceImageUrlsPayload.map((url, idx) => fetchImagePart(url, idx));
      const resolvedRefParts = await Promise.all(refPartsPromises);
      const validRefParts = resolvedRefParts.filter(Boolean);

      if (validRefParts.length > 0) {
        referenceMessages.push(
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `[الصور المرجعية المعتمدة من أستاذ المادة للدرس/النشاط]: هذه ${validRefParts.length} صور مرجعية معتمدة (رسومات بيانية، منحنيات دالة، أو أشكال هندسية) تابعة للنشاط. اعتمد عليها وافحصها بدقة إذا سأل التلميذ عنها أو تطلب التمرين تحليلها:`,
              },
              ...validRefParts,
            ],
          },
          {
            role: "assistant",
            content: "فهمت. قمت بقراءة وحفظ الصور المرجعية المعتمدة من الأستاذ، وسأعتمد عليها حصرياً في توجيه التلميذ وتحليل منحنيات ورسومات التمرين.",
          }
        );
      }
    }

    // Fast Payload vs Multimodal Vision Payload
    const promptMessages = [...referenceMessages, ...baseMessages];
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

    // Primary Model -> Working Model (gemini-3.1-flash-lite)
    let result;
    let finalModelUsed = "gemini-3.1-flash-lite";

    console.log("==== DEBUG STAGE 2: System Prompt Tail ====", finalSystemPrompt.slice(-250));

    try {
      console.log(
        `🤖 Attempting streamText with primary model: "${finalModelUsed}" (forceVision: ${shouldIncludeImages})...`
      );
      result = await streamText({
        model: customGoogle(finalModelUsed),
        system: finalSystemPrompt,
        messages: promptMessages,
      });
    } catch (primaryError: any) {
      console.error(
        `🚨 Primary model "${finalModelUsed}" failed:`,
        primaryError?.message || primaryError
      );
      throw primaryError;
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

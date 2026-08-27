import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getStudentMasterProfile } from "@/lib/firebase/masterProfile";
import { getModuleById } from "@/src/lib/firebase/coursesService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// Resolve Space-Time Breadcrumbs Header (Requirement 2)
async function resolveBreadcrumbsHeader(body: any, data: any): Promise<string> {
  let courseTitle = body.courseTitle || body.courseName || (data && (data.courseTitle || data.courseName)) || "";
  let moduleTitle = body.moduleTitle || body.moduleName || (data && (data.moduleTitle || data.moduleName)) || "";
  let activityTitle = body.activityTitle || body.activityName || body.lessonContext || (data && (data.activityTitle || data.activityName || data.lessonContext)) || "";
  let stationTitle = body.stationTitle || (body.currentStation && body.currentStation.title) || (data && (data.stationTitle || (data.currentStation && data.currentStation.title))) || "";

  const courseId = body.courseId || (data && data.courseId);
  const moduleId = body.moduleId || (data && data.moduleId);
  const activityId = body.activityId || (data && data.activityId);

  if ((!courseTitle && courseId) || (!moduleTitle && moduleId) || (!activityTitle && activityId)) {
    try {
      const [cSnap, mSnap, aSnap] = await Promise.all([
        courseId ? getDoc(doc(db, "courses", courseId)) : Promise.resolve(null),
        moduleId ? getDoc(doc(db, "modules", moduleId)) : Promise.resolve(null),
        activityId ? getDoc(doc(db, "activities", activityId)) : Promise.resolve(null),
      ]);

      if (!courseTitle && cSnap && cSnap.exists()) courseTitle = cSnap.data().title || "";
      if (!moduleTitle && mSnap && mSnap.exists()) moduleTitle = mSnap.data().title || "";
      if (!activityTitle && aSnap && aSnap.exists()) activityTitle = aSnap.data().title || "";
    } catch (err) {
      console.warn("Breadcrumbs Firestore fetch error:", err);
    }
  }

  const finalCourse = courseTitle.trim() || "مادة الرياضيات";
  const finalModule = moduleTitle.trim() || "الوحدة التعلمية";
  const finalActivity = activityTitle.trim() || "النشاط التعليمي";
  const finalStation = stationTitle.trim() || "عام";

  return `[التموضع الحالي للتلميذ]: مسار: ${finalCourse} > وحدة: ${finalModule} > نشاط: ${finalActivity} > محطة: ${finalStation}`;
}

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

    // Strict System Prompt incorporating Pre-Analysis Cache, Master Profile, Generative UI, Socratic Pacing & Textbook Formatting
    let systemPrompt = `أنت مساعد ذكي لسقراطي في منصة "مسار". التلميذ الذي تتحدث معه اسمه "${studentDisplayName}".

القواعد الصارمة للرد:
1. المناداة بالاسم: يجب أن تذكر اسم التلميذ (${studentDisplayName}) في ردودك دائماً لخلق ألفة وتشجيع.
2. التقطيع السقراطي: لا تقم بتشخيص كل الصور أو الأخطاء دفعة واحدة. قدم ملاحظة واحدة فقط أو خطأ واحداً، ثم اسأل التلميذ سؤالاً تفاعلياً ليفكر فيه، وانتظر رده.
3. التنسيق والأسلوب المدرسي الممتاز: استخدم عناوين Markdown (مثل ### الخطوة الأولى:) لتنظيم ردك كأنه كتاب مدرسي للرياضيات. قم بتظليل الكلمات المفتاحية بخط غامق (Bold). تأكد من وضع جميع المتغيرات والمعادلات الرياضية، حتى البسيطة منها مثل $x=0$ أو $x-1=0$، بين علامات $ لكي يتم تنسيقها بشكل صحيح باللون الأزرق المنهجي ومنع تفككها في اتجاه RTL.
4. الإشارة للصور: عند الإشارة إلى صورة من صور التلميذ، استخدم هذا التنسيق الحرفي فقط: [الصورة X](#image-X) حيث X هو رقم الصورة (مثل #image-1 للصورة الأولى، #image-2 للصورة الثانية...). لا تضع أفكاراً أو روابط وهمية بديلة.
5. الردود المقترحة (Smart Chips): في نهاية كل رد لك، يجب أن تقترح على التلميذ 2 أو 3 خيارات قصيرة وذكية للرد. اكتب كل خيار في سطر جديد بالصيغة التالية حصراً: [اقتراح: نص الرد المقترح هنا].
6. التعامل مع أكواد LaTeX المرفقة: إذا احتوى المرجع أو رسالة المستخدم على كود LaTeX كامل (مستند بحزم وديباجة مثل \\documentclass أو \\usepackage أو tcolorbox)، قم باستخلاص المفاهيم الرياضية، التمارين والحلول النموذجية منه فقط. لا تقم أبداً بإرجاع أو طباعة أوامر الديباجة في ردودك للتلميذ.
7. ميزة التدريبات التفاعلية (Generative UI) - [أولوية قصوى وشرط إجباري]:
أنت تمتلك قدرة خارقة على توليد تمارين تفاعلية تظهر كبطاقات مرئية داخل الدردشة.
عندما يطلب منك التلميذ تمريناً، أو عندما تختبر فهمه، يُمنع منعاً باتاً كتابة التمرين الرياضي كنص عادي.
يجب عليك وجوباً توليد التمرين حصرياً باستخدام كتلة كود (Code Block) من نوع \`exercise\` تحتوي على كائن JSON دقيق.

أنت تمتلك 3 قوالب تفاعلية (اختر الأنسب حسب السياق):

1. قالب "جمع الكسور" (fraction_addition):
استخدمه لاختبار توحيد المقامات أو جمعها.
\`\`\`exercise
{
  "type": "fraction_addition",
  "question": "\\\\frac{2}{7} + \\\\frac{3}{7}",
  "denominator": 7,
  "correctNumerator": 5
}
\`\`\`

2. قالب "إيجاد المجهول" (equation_solving):
استخدمه لاختبار حل المعادلات البسيطة (مثل المتراجحات المكتوبة كمعادلة، أو الضرب في المقلوب).
\`\`\`exercise
{
  "type": "equation_solving",
  "question": "2x - 4 = 10",
  "variable": "x",
  "correctAnswer": 7
}
\`\`\`

3. قالب "خيارات متعددة" (multiple_choice):
استخدمه لاختبار المفاهيم النظرية (مثل اتجاه المتراجحة، أو اختيار المجال الصحيح). الخيارات يمكن أن تحتوي على LaTeX.
\`\`\`exercise
{
  "type": "multiple_choice",
  "question": "عند ضرب طرفي المتراجحة $-2x > 4$ في العدد $-\\\\frac{1}{2}$، ماذا يحدث؟",
  "options": [
    "يظل اتجاه المتراجحة كما هو وتصبح $x > -2$",
    "يتغير اتجاه المتراجحة وتصبح $x < -2$",
    "تصبح معادلة $x = -2$"
  ],
  "correctIndex": 1
}
\`\`\`

قواعد الإعدام البرمجي الصارمة (Strict Rules):
1. إياك أن تكتب المعادلة المطلوبة من التلميذ حلها خارج كائن الـ JSON.
2. يجب أن يكون الـ JSON صالحاً برمجياً.
3. يمكنك كتابة سطر تشجيعي واحد فقط قبل الكتلة، مثلاً: "لنجرب حل هذا التمرين التفاعلي للتأكد من فهمك:" ثم تدرج كتلة الكود مباشرة.

سياق الدرس الحالي: "${lessonContext || "الرياضيات"}"

--- بداية ملخص الدرس الرسمي ---
${lessonSummary && String(lessonSummary).trim() ? lessonSummary : "محتوى وقوانين درس الرياضيات المعتمد."}
--- نهاية ملخص الدرس الرسمي ---`;

    // Inject Master Profile (Cumulative Learning Memory) into System Prompt
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

    // Inject Hidden Teacher Directives if present (Dual-Layer Context Injection)
    if (teacherDirectivesStr && teacherDirectivesStr.trim() !== "") {
      systemPrompt += `\n\n### توجيهات سرية وخاصة من أستاذ المادة لهذا الدرس (يجب الالتزام بها حرفياً):\n${teacherDirectivesStr.trim()}`;
    }

    // Inject Vision Instructions ONLY if forceVision requested image attachment
    if (shouldIncludeImages) {
      systemPrompt += `\n\n8. صور حل التلميذ المرفقة: لقد طلب التلميذ مراجعة صور إجابته بصرياً المرفقة (${imagesPayload.length} صورة). عند الإشارة إلى أي صورة أو خطأ فيها، استخدم التنسيق الحرفي الحصري التالي فقط: [الصورة X](#image-X) حيث X هو رقم الصورة الحقيقي (من 1 إلى ${imagesPayload.length}).`;
    }

    // Resolve Cohort/Group IDs for targetUserId (Requirement 3)
    const cohortIds = await resolveStudentCohortIds(
      targetUserId,
      body.cohortIds || body.groupIds || (data && (data.cohortIds || data.groupIds))
    );

    // Resolve Space-Time Breadcrumbs Header (Requirement 2)
    const breadcrumbsHeader = await resolveBreadcrumbsHeader(body, data);

    // Station Mode Check & System Log Injection
    const isStationChat = Boolean(
      body.isStationMode ||
      body.stationMode ||
      body.currentStation ||
      (data && (data.isStationMode || data.stationMode || data.currentStation))
    );

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

    if (isStationChat) {
      const actGlobalContext =
        body.globalContext ||
        body.globalLatexSummary ||
        (body.activity && (body.activity.globalContext || body.activity.globalLatexSummary)) ||
        (data && (data.globalContext || data.globalLatexSummary)) ||
        lessonSummary ||
        "لا يوجد سياق عام محدد.";

      const stationData =
        body.currentStation ||
        (data && data.currentStation) || {
          title: body.stationTitle || "المحطة الحالية",
          content: body.stationContent || "حل التمرين المطلوب",
          aiDirectives: body.stationAiDirectives || teacherDirectivesStr || "",
          customIsolations: body.stationCustomIsolations || [],
        };

      // Backend-Resolved Deep Isolation Filtering (Requirement 3)
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
        ...(Array.isArray(rawStationIsolations) ? rawStationIsolations : []),
      ];

      const resolvedDirectives = resolveIsolationDirectives(combinedIsolationRules, targetUserId, cohortIds);

      // Also check fallback single-note strings if no rules array matched
      if (resolvedDirectives.length === 0) {
        if (body.globalIsolationNote) resolvedDirectives.push(body.globalIsolationNote);
        if (body.stationIsolationNote) resolvedDirectives.push(body.stationIsolationNote);
      }

      const isolationSection =
        resolvedDirectives.length > 0
          ? `[العزل المخصص لهذا التلميذ]:\n${resolvedDirectives.map((d) => `- ${d}`).join("\n")}`
          : `[العزل المخصص لهذا التلميذ]: لا توجد توجيهات مخصصة لهذا التلميذ.`;

      systemPrompt = `
${breadcrumbsHeader}

[SYSTEM LOG - INITIALIZATION]
أنت "وكيل المحطات السقراطي" التابع للأستاذ فوزي. التلميذ الذي أمامك هو: ${studentDisplayName}.

--- إعدادات النشاط العام ---
${actGlobalContext}

--- [العزل المخصص لهذا التلميذ] ---
${isolationSection}

[2. المهمة الحالية (${stationData.title || "المحطة الحالية"})]:
العنوان: ${stationData.title || "المحطة الحالية"}
الهدف: ${stationData.content || "حل المطلوب وتزويد المساعد بإجابتك"}
التوجيه السري للمعلم: ${stationData.aiDirectives || "لا يوجد."}

المحتوى والمرفقات المتوفرة للتلميذ في هذه الصفحة:
${formattedAttachmentsMetadata}

توجيه خاص للمرفقات: أنت تعلم ما هي المرفقات الموجودة في الصفحة من خلال السياق أعلاه. لا تخترع مرفقات غير موجودة، وأرشد التلميذ لفتحها إذا سأل عنها.

[RULES]
1. لا تقدم الحلول الجاهزة أبداً.
2. قيّم أي صورة يرسلها التلميذ بناءً على التوجيه السري للمحطة حصراً.
3. لا تنتقل لطلب مهام المحطة التالية؛ ركز فقط على المحطة الحالية.
4. إياك واستخدام روابط Markdown للصور مثل [الصورة](#image-1). أشار للصور بالحديث عنها طبيعياً في النص (مثال: 'في محاولتك المرفقة').
5. إذا أردت اختبار التلميذ بسؤال أو تمرين، اطرح السؤال طبيعياً بنص عادي وبسيط دون استخدام أكواد JSON أو كتل كود.
`.trim();
    } else {
      // Non-station mode: prepend breadcrumbs and resolved isolation directives to system prompt
      const rawGlobalIsolations =
        body.globalCustomIsolations ||
        body.isolationRules ||
        (body.activity && body.activity.globalCustomIsolations) ||
        (data && (data.globalCustomIsolations || data.isolationRules)) ||
        [];

      const resolvedDirectives = resolveIsolationDirectives(rawGlobalIsolations, targetUserId, cohortIds);
      const isolationSection =
        resolvedDirectives.length > 0
          ? `[العزل المخصص لهذا التلميذ]:\n${resolvedDirectives.map((d) => `- ${d}`).join("\n")}`
          : `[العزل المخصص لهذا التلميذ]: لا توجد توجيهات مخصصة لهذا التلميذ.`;

      systemPrompt = `${breadcrumbsHeader}\n\n${isolationSection}\n\n${systemPrompt}`;
    }

    const technicalDirectives = `
=== توجيهات تنسيقية تقنية صارمة (يجب الالتزام بها حرفياً) ===
1. **تنسيق النهايات (Limits):** عند كتابة أي نهاية رياضية، يُمنع منعاً باتاً استخدام الصيغة المختصرة \\lim_{x \\to a}. يجب عليك دائماً وحصرياً استخدام الصيغة: \\lim\\limits_{x \\to a} لضمان ظهورها بشكل سليم في الواجهة.
2. **الإشارة للصور المرفقة:** التلميذ أرفق صوراً لحله. عندما تشير إلى هذه الصور في ردك، استخدم كلمات عادية مثل "في صورتك الأولى" أو "في الحل المرفق". يُمنع منعاً باتاً استخدام أي روابط ماركداون (Markdown Links) للصور مثل [الصورة 1](#) أو محاولة تضمين رابط الصورة. فقط أشر إليها نصياً.
`.trim();

    systemPrompt += `\n\n${technicalDirectives}`;

    // Backend Audit Logger: Print exact assembled System Prompt to server terminal
    console.log("\n========== [SYSTEM PROMPT DEBUG START] ==========");
    console.log(systemPrompt);
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

    // Dynamic Tool Definition: getModuleSyllabus
    const chatTools = {
      getModuleSyllabus: tool({
        description:
          "استخدم هذه الأداة حصرياً عندما يسأل التلميذ سؤالاً شمولياً يتطلب منك مراجعة التدرج السنوي الوزاري أو القوانين التفصيلية للوحدة الحالية.",
        inputSchema: z.object({
          reason: z.string().describe("سبب استدعاء أداة جلب محتوى الوحدة بالتفصيل"),
        }),
        execute: async ({ reason }) => {
          console.log(
            "🛠️ AI Executing getModuleSyllabus tool... Reason:",
            reason,
            "targetModuleId:",
            targetModuleId
          );
          if (!targetModuleId) {
            return "لا توجد وحدة محددة حالياً في سياق الجلسة.";
          }

          try {
            const moduleDoc = await getModuleById(targetModuleId);
            if (
              !moduleDoc ||
              !moduleDoc.moduleDetailedLatex ||
              !moduleDoc.moduleDetailedLatex.trim()
            ) {
              return "لا يوجد محتوى تفصيلي إضافي مدون لهذه الوحدة في قاعدة البيانات.";
            }

            return `--- بداية التدرج السنوي والقوانين التفصيلية للوحدة ---
${moduleDoc.moduleDetailedLatex.trim()}
--- نهاية القوانين التفصيلية للوحدة ---`;
          } catch (err: any) {
            console.error("Error executing getModuleSyllabus tool:", err);
            return "حدث خطأ أثناء جلب محتوى الوحدة من قاعدة البيانات.";
          }
        },
      }),
    };

    // Primary Model -> Working Model (gemini-3.1-flash-lite)
    let result;
    let finalModelUsed = "gemini-3.1-flash-lite";

    console.log("==== DEBUG STAGE 2: System Prompt Tail ====", systemPrompt.slice(-250));

    try {
      console.log(
        `🤖 Attempting streamText with primary model: "${finalModelUsed}" (forceVision: ${shouldIncludeImages})...`
      );
      result = await streamText({
        model: customGoogle(finalModelUsed),
        system: systemPrompt,
        messages: promptMessages,
        tools: chatTools,
        stopWhen: stepCountIs(5),
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

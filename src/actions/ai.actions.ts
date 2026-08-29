"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateContextAction(
  activityTitle: string,
  description: string,
  attachedPdfUrls: string[]
) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const prompt = `You are an expert mathematics AI compiler for the Algerian Baccalaureate.
    Activity Title: ${activityTitle || 'N/A'}
    Description: ${description || 'N/A'}
    
    Task: Extract mathematical formulas, rules, and theorems from the attached documents. 
    Rule 1: Output ONLY valid Markdown.
    Rule 2: Wrap all math formulas in $ (inline) or $$ (block).
    Rule 3: Keep it concise, remove boilerplate.`;

    const parts: any[] = [{ text: prompt }];

    if (attachedPdfUrls && attachedPdfUrls.length > 0) {
      console.log(`🟢 [AI Action] Fetching PDF from URL: ${attachedPdfUrls[0]}`);
      const pdfResponse = await fetch(attachedPdfUrls[0]);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF from URL. Status: ${pdfResponse.status}`);
      }

      const arrayBuffer = await pdfResponse.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString("base64");

      parts.push({
        inlineData: {
          data: base64String,
          mimeType: "application/pdf",
        },
      });
    }

    console.log("🟢 [AI Action] Generating content via gemini-3.6-flash...");
    const result = await model.generateContent(parts);
    const textResponse = result.response.text();
    return { success: true, markdown: textResponse };
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return { success: false, error: error.message || "Failed to generate context" };
  }
}

export async function refineContextAction(currentContext: string, userInstruction: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const prompt = `You are an expert mathematics AI editor for the Algerian Baccalaureate.
    
CURRENT CONTEXT:
${currentContext || "(No previous context provided)"}

USER INSTRUCTION:
${userInstruction}

TASK:
1. Rewrite the CURRENT CONTEXT to strictly apply the USER INSTRUCTION.
2. CRITICAL: Fix any broken LaTeX syntax. Ensure ALL complex math environments (like \\begin{array}, \\begin{pmatrix}, \\frac) are strictly wrapped inside display math blocks $$ ... $$ or inline $ ... $.
3. Do not output any conversational filler (e.g., "Here is the updated text"). Output ONLY the raw updated Markdown/KaTeX.`;

    console.log("🟢 [AI Action] Refining context via gemini-3.6-flash...");
    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    return { success: true, markdown: textResponse };
  } catch (error: any) {
    console.error("Refinement Error:", error);
    return { success: false, error: error.message || "Failed to refine context" };
  }
}

export interface CurrentStationDraft {
  challenge?: string;
  groundTruth?: string;
  pedagogyRules?: string;
}

export async function generateStationFromAttachmentAction(
  fileUrl: string,
  mimeType: string,
  userInstruction: string,
  base64Data?: string,
  currentDraft?: CurrentStationDraft
) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const hasExistingDraft = Boolean(
      currentDraft &&
      ((currentDraft.challenge && currentDraft.challenge.trim().length > 0) ||
       (currentDraft.groundTruth && currentDraft.groundTruth.trim().length > 0) ||
       (currentDraft.pedagogyRules && currentDraft.pedagogyRules.trim().length > 0))
    );

    let systemPrompt = `You are an expert educational inspector, pedagogical architect, and LaTeX specialist for high-school / Algerian Baccalaureate curricula.`;

    if (hasExistingDraft) {
      systemPrompt += `
### CURRENT DRAFT TO REFINE (Contextual Memory) ###
[نص التمرين الحالي / Challenge]:
${currentDraft?.challenge || "لا يوجد بعد"}

[الحل النموذجي الحالي / Ground Truth]:
${currentDraft?.groundTruth || "لا يوجد بعد"}

[التوصيات البيداغوجية الحالية / Pedagogy & Guardrails]:
${currentDraft?.pedagogyRules || "لا يوجد بعد"}

🛑 CRITICAL REFINEMENT INSTRUCTIONS:
1. Do NOT start from scratch unless explicitly requested! Take the CURRENT DRAFT above as your baseline truth.
2. Apply the teacher's instruction precisely to this draft (e.g. adding line breaks between questions, formatting formulas with KaTeX $ / $$, correcting calculations, numbering sub-questions, elaborating on pedagogical steps).
3. If an attached document is present, use it as reference to verify or complete information, while preserving all valid draft edits.
4. Maintain all three sections cleanly: "challenge", "groundTruth", and "pedagogy".`;
    } else {
      systemPrompt += `
Analyze the attached document/image and the teacher's instruction.
Extract the specified exercise and solve it completely step-by-step.
Generate pedagogical guardrails and recommendations for a Socratic AI Tutor that will teach this specific exercise.`;
    }

    systemPrompt += `

HTML & FORMATTING RULES:
1. The outputs will be rendered inside an HTML Rich Text Editor. Use <br/> for new lines between questions/paragraphs.
2. MATH & INEQUALITIES (CRITICAL): NEVER use HTML entities (like &lt;, &gt;, or &amp;) for mathematical inequalities or formulas. You MUST use raw "<" and ">" symbols, or standard LaTeX commands like \\le and \\ge, exclusively inside LaTeX blocks.
3. STRICT LATEX DELIMITERS: Every single mathematical variable, number, fraction, root, inequality, or equation MUST be strictly wrapped in $ (for inline math) or $$ (for display block math). Do NOT leave math symbols or commands like \\sqrt in plain text. Example: Write "$\\sqrt{3} > 1$" instead of "\\sqrt{3} &gt; 1" or "$\\sqrt{3}$ &gt; 1".
4. JSON ESCAPING: Since your output is JSON, you MUST double-escape all LaTeX backslashes. For example, write \\\\sqrt instead of \\sqrt, and \\\\frac instead of \\frac, and \\\\lim instead of \\lim.

CRITICAL OUTPUT RULES:
1. "challenge": The complete exercise text written cleanly in Arabic with explicit HTML line breaks (<br/>) between question items and properly formatted LaTeX ($ ... $ inline, $$ ... $$ display blocks). Every single question must be on a new line.
2. "groundTruth": The thorough step-by-step mathematical/conceptual solution in Arabic and LaTeX with clear line breaks (<br/>) between steps (HIDDEN rubric for AI evaluation). For limits always use \\lim\\limits_{x \\to a}.
3. "pedagogy": Strict pedagogical rules and negative guardrails for the Socratic agent formatted with clean bullet points (<br/> or <ul><li>...</li></ul>) (e.g. do not give away the final result, probe on sign mistakes, guide with hints).

You MUST return ONLY a valid JSON object matching this exact structure:
{
  "challenge": "نص التمرين باللغة العربية واللاتكس مع <br/> بين كل سؤال وسؤال...",
  "groundTruth": "الحل النموذجي المفصل خطوة بخطوة باللاتكس مع <br/> بين الخطوات...",
  "pedagogy": "التوصيات البيداغوجية والتوجيهات السرية للوكيل السقراطي..."
}`;

    const parts: any[] = [
      { text: systemPrompt },
      { text: "User Instruction: " + (userInstruction || (hasExistingDraft ? "قم بتنقيح وتنسيق المسودة الحالية وجعل كل سؤال على سطر مستقل مع الحفاظ على صياغة اللاتكس." : "استخرج نص التمرين كاملاً مع كتابة الحل النموذجي المفصل والتوصيات البيداغوجية للوكيل السقراطي.")) },
    ];

    if (base64Data && base64Data.trim() !== "") {
      const cleanBase64 = base64Data.includes("base64,")
        ? base64Data.split("base64,")[1]
        : base64Data;
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "application/pdf",
        },
      });
    } else if (fileUrl && fileUrl.trim() !== "") {
      if (fileUrl.startsWith("data:")) {
        const [meta, b64] = fileUrl.split(";base64,");
        const detectedMime = meta.replace("data:", "") || mimeType || "application/pdf";
        parts.push({
          inlineData: {
            data: b64,
            mimeType: detectedMime,
          },
        });
      } else {
        console.log(`🟢 [AI Station Inspector] Fetching file from URL: ${fileUrl}`);
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download file from URL. Status: ${fileResponse.status}`);
        }
        const arrayBuffer = await fileResponse.arrayBuffer();
        const b64 = Buffer.from(arrayBuffer).toString("base64");
        const detectedMime =
          fileResponse.headers.get("content-type")?.split(";")[0] ||
          mimeType ||
          (fileUrl.toLowerCase().includes(".pdf") ? "application/pdf" : "image/jpeg");

        parts.push({
          inlineData: {
            data: b64,
            mimeType: detectedMime,
          },
        });
      }
    }

    console.log("🟢 [AI Station Inspector] Generating station content via gemini-3.6-flash...");
    
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(parts);
    let textResponse = result.response.text().trim();

    // Clean up potential markdown formatting if the model ignored responseMimeType
    if (textResponse.startsWith("```")) {
      textResponse = textResponse.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    }

    let stationData: any;
    try {
      stationData = JSON.parse(textResponse);
    } catch {
      // Regex to find single backslashes that are NOT followed by valid JSON escape characters (", \, /, b, f, n, r, t)
      // and replace them with a double backslash. This fixes raw LaTeX (e.g. \sqrt becomes \\sqrt).
      let sanitized = textResponse.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");

      // Also escape known LaTeX words starting with b, f, n, r, t that would otherwise be treated as control chars
      sanitized = sanitized.replace(/\\(frac|times|beta|bar|binom|bmod|bowtie|bullet|nabla|nu|nearrow|neg|neq|nparallel|nwarrow|right|rho|rangle|rceil|rfloor|rightarrow|text|tan|theta|to|tau|top|triangle|triangleq)/gi, "\\\\$1");

      try {
        stationData = JSON.parse(sanitized);
      } catch (secondErr) {
        console.error("Sanitized JSON String failed to parse:", textResponse);
        throw new Error("فشل في تحليل البيانات المستخرجة (JSON Error). الرجاء المحاولة مرة أخرى.");
      }
    }

    return {
      success: true,
      data: {
        challenge: stationData.challenge || "",
        groundTruth: stationData.groundTruth || "",
        pedagogy: stationData.pedagogy || stationData.pedagogyRules || "",
      },
    };
  } catch (error: any) {
    console.error("AI Station Generation Error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate station from attachment.",
    };
  }
}


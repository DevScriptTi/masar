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

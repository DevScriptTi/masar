import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

export async function POST(req: Request) {
  try {
    const { currentContextText, refinementPrompt } = await req.json();

    if (!refinementPrompt || typeof refinementPrompt !== "string") {
      return new Response(
        JSON.stringify({ error: "تعليمات التحديث مطلوبة (refinementPrompt is required)." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert AI assistant editing a math context for a tutoring agent for the Algerian Baccalaureate. 
CURRENT CONTEXT:
${currentContextText || "(No previous context provided)"}

USER INSTRUCTION:
${refinementPrompt}

TASK: Rewrite the CURRENT CONTEXT to incorporate the USER INSTRUCTION seamlessly.
Rule 1: Output ONLY valid Markdown.
Rule 2: Wrap math formulas in $ or $$.
Rule 3: Return ONLY the updated Markdown text, without any conversational preamble.`;

    let text = "";
    try {
      const result = await generateText({
        model: google("gemini-3.6-flash"),
        prompt: systemPrompt,
        temperature: 0.2,
      });
      text = result.text;
    } catch (err: any) {
      console.warn("gemini-3.6-flash failed in refine-context, falling back to gemini-1.5-flash:", err?.message);
      const fallbackResult = await generateText({
        model: google("gemini-1.5-flash"),
        prompt: systemPrompt,
        temperature: 0.2,
      });
      text = fallbackResult.text;
    }

    return new Response(
      JSON.stringify({ refinedText: text.trim() }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in AI refine-context route:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to refine context via AI." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

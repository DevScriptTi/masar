import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

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
    const rawLatex = body.rawLatex || body.latex || "";

    if (!rawLatex || typeof rawLatex !== "string" || !rawLatex.trim()) {
      return new Response(
        JSON.stringify({ error: "يرجى تزويد كود الـ LaTeX المراد تنظيفه." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const systemPrompt = `أنت خبير في تحويل وتنظيف أكواد LaTeX الرياضية لـ Markdown و KaTeX.
مهمتك:
1. إزالة جميع أوامر الديباجة (Boilerplate) مثل \\documentclass, \\usepackage, \\geometry, \\definecolor, \\fancyhdr, \\begin{document}, \\end{document}.
2. استخراج المعارف الرياضية، التمارين، والمعادلات والحلول النموذجية فقط.
3. التنسيق: قم بصياغة المخرجات كنص Markdown ممتاز يحتوي على معادلات رياضية بين علامات $ للمعادلات السطرية (inline math) و $$ للمعادلات الكبيرة (display math).
4. عدم طباعة أي شرح إضافي أو تعليقات برمجية. أرجع فقط المحتوى الرياضي المُنظف الجاهز للاستخدام مباشرة.`;

    const result = await generateText({
      model: google("gemini-1.5-flash"),
      system: systemPrompt,
      prompt: `كود الـ LaTeX الخام المراد تنظيفه:\n${rawLatex}`,
    });

    const cleanedText = result.text.trim();

    return new Response(
      JSON.stringify({ success: true, cleanedLatex: cleanedText, result: cleanedText }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in clean-latex API route:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "حدث خطأ أثناء تنظيف كود LaTeX." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export async function POST(req: Request) {
  try {
    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "مفتاح API غير متوفر في ملف البيئة .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawLatex = body.rawLatex || body.latex || "";

    if (!rawLatex || typeof rawLatex !== "string" || !rawLatex.trim()) {
      return NextResponse.json(
        { error: "يرجى إرسال كود LaTeX صالح للتنظيف." },
        { status: 400 }
      );
    }

    const customGoogle = createGoogleGenerativeAI({
      apiKey: apiKey,
    });

    const systemPrompt = `أنت خبير صارم جداً في الرياضيات ولغة LaTeX. مهمتك استخراج التمارين الرياضية من كود مصدري.
قواعد صارمة جداً (يمنع مخالفتها):
1. احذف الديباجة وأوامر التنسيق (مثل \\usepackage, \\geometry, \\color).
2. إياك أن تلخص أو تعيد صياغة الأسئلة الرياضية. انسخ النص الرياضي والمعادلات ($...$ و $$...$$) كما هي حرفياً بالضبط.
3. حافظ على رموز النهايات الدقيقة مثل \\lim\\limits_{x \\xrightarrow{>} 1}.
4. إذا وجدت أمر \\includegraphics، استبدله بجملة واضحة: "[يوجد هنا رسم بياني مرفق في التمرين]".
5. أعد الناتج كنص Markdown نظيف ومنظم.`;

    console.log(`🤖 Executing LaTeX cleaning with model "gemini-3.1-flash-lite"...`);
    const { text } = await generateText({
      model: customGoogle("gemini-3.1-flash-lite"),
      system: systemPrompt,
      prompt: `إليك كود الـ LaTeX الخام لتنظيفه واستخراج التمارين والمعادلات فقط:\n\n${rawLatex}`,
    });

    return NextResponse.json({
      cleanText: text,
      cleanedText: text,
    });
  } catch (error: any) {
    console.error("LaTeX Cleaner Error:", error);
    return NextResponse.json(
      { error: error?.message || "فشلت معالجة كود LaTeX." },
      { status: 500 }
    );
  }
}

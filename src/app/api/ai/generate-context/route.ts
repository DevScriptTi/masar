import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    console.log("🟢 [AI Context API] Request received");
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    const body = await req.json();
    console.log("🟢 [AI Context API] Body parsed:", { 
      activityTitle: body.activityTitle || body.title, 
      pdfCount: (body.attachedPdfUrls || body.pdfUrls)?.length || 0 
    });

    const activityTitle = body.activityTitle || body.title;
    const description = body.description;
    const attachedPdfUrls = body.attachedPdfUrls || body.pdfUrls;

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `You are an expert mathematics AI compiler for the Algerian Baccalaureate.
    Activity Title: ${activityTitle || 'N/A'}
    Description: ${description || 'N/A'}
    
    Task: Extract mathematical formulas, rules, and theorems from the attached documents (if any) or base it on the title. 
    Rule 1: Output ONLY valid Markdown.
    Rule 2: Wrap all math formulas in $ (inline) or $$ (block).
    Rule 3: Keep it concise, remove boilerplate text.`;

    const parts: any[] = [{ text: prompt }];

    // Handle PDFs
    if (attachedPdfUrls && attachedPdfUrls.length > 0) {
      console.log(`🟢 [AI Context API] Fetching PDF from URL: ${attachedPdfUrls[0]}`);
      const pdfResponse = await fetch(attachedPdfUrls[0]);
      
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF from URL. Status: ${pdfResponse.status}`);
      }
      
      const arrayBuffer = await pdfResponse.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString("base64");
      console.log("🟢 [AI Context API] PDF successfully converted to Base64");

      parts.push({
        inlineData: {
          data: base64String,
          mimeType: "application/pdf",
        },
      });
    }

    let result;
    try {
      console.log("🟢 [AI Context API] Generating content via Gemini (gemini-1.5-pro-latest)...");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      result = await model.generateContent(parts);
    } catch (firstErr: any) {
      console.warn("⚠️ [AI Context API] gemini-1.5-pro-latest failed, trying gemini-1.5-flash fallback:", firstErr?.message);
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      result = await fallbackModel.generateContent(parts);
    }

    const responseText = result.response.text();
    
    console.log("🟢 [AI Context API] Success! Returning markdown.");
    return NextResponse.json({
      markdown: responseText,
      success: true,
      detailedLatex: responseText,
      indexContext: responseText,
    });

  } catch (error: any) {
    console.error("🔴 [AI Context API] FATAL ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "gavyiksx",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function extractPublicId(url: string): string | null {
  try {
    if (!url || !url.includes("cloudinary.com")) return null;
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    let path = parts[1];
    // Remove version prefix v12345678/ if present
    path = path.replace(/^v\d+\//, "");
    // Remove file extension
    const lastDotIndex = path.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      path = path.substring(0, lastDotIndex);
    }
    return path;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { urls } = body;

    const urlList: string[] = Array.isArray(urls)
      ? urls
      : typeof urls === "string"
      ? [urls]
      : [];

    if (urlList.length === 0) {
      return new Response(JSON.stringify({ success: true, deletedCount: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hasCredentials =
      process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

    if (!hasCredentials) {
      console.warn(
        "⚠️ CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET missing in .env.local. Skipping Cloudinary server deletion."
      );
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Cloudinary credentials missing, proceeding with Firestore cleanup.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const results = await Promise.all(
      urlList.map(async (url) => {
        const publicId = extractPublicId(url);
        if (!publicId) return { url, status: "skipped" };
        try {
          const res = await cloudinary.uploader.destroy(publicId);
          return { url, publicId, result: res.result };
        } catch (err: any) {
          console.error(`Failed to destroy Cloudinary image ${publicId}:`, err);
          return { url, publicId, error: err.message };
        }
      })
    );

    console.log("✅ Cloudinary Files Deletion Summary:", results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Cloudinary Delete API Route Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to delete Cloudinary files" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

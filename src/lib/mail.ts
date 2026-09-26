import { transporter } from "./nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  text?: string;
}

/**
 * Send Transactional Email utility using Nodemailer & Gmail App Password
 * Free of third-party sandbox and custom domain verification restrictions.
 */
export async function sendEmail({ to, subject, html, from, text }: SendEmailOptions) {
  const senderEmail =
    from ||
    process.env.GMAIL_EMAIL_ADDRESS ||
    "منصة البكالوريا 2027";

  try {
    const info = await transporter.sendMail({
      from: senderEmail,
      to,
      subject,
      html,
      text: text || undefined,
    });

    return { success: true, data: info };
  } catch (error: any) {
    console.error("[Nodemailer] Email send error:", error);
    return { success: false, error: error?.message || "Failed to send email via Nodemailer" };
  }
}

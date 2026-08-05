// Email delivery.
//
// When SMTP_HOST is configured, messages are sent over SMTP via Nodemailer
// (works with Gmail, SendGrid, Mailgun, Resend, ...). Without SMTP config the
// message is printed to the server console and the URL is echoed back by the
// API so the flow works end-to-end locally with zero setup.
//
// Required env vars for real delivery:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ("true" for SSL 465),
//   SMTP_USER, SMTP_PASS, SMTP_FROM (sender, optional)

import nodemailer from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function sendEmail(message: MailMessage): Promise<void> {
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "Business AI <no-reply@business-ai.local>",
      to: message.to,
      subject: message.subject,
      text: message.text ?? stripTags(message.html),
      html: message.html,
    });
    return;
  }
  const url = message.html.match(/https?:\/\/[^\s<"]+/)?.[0] ?? "";
  console.log("\n==============================================");
  console.log(`[MAIL → ${message.to}] ${message.subject}`);
  console.log(message.text ?? stripTags(message.html));
  if (url) console.log(`Link: ${url}`);
  console.log("==============================================\n");
}

export function resetPasswordEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Reset your Business AI password",
    html: `<p>You requested a password reset.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 24 hours.</p>`,
    text: `You requested a password reset.\n\n${link}\n\nThis link expires in 24 hours.`,
  };
}

export function verifyEmailEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Verify your Business AI email",
    html: `<p>Welcome to Business AI. Confirm your address:</p><p><a href="${link}">Verify email</a></p>`,
    text: `Welcome to Business AI. Confirm your address:\n\n${link}`,
  };
}

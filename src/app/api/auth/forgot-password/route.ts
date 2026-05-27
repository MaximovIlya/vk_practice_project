import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email: string = body?.email;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always 200 to avoid email enumeration
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    await prisma.passwordResetToken.deleteMany({ where: { email } });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    const isGoogleAccount = !user.password;
    const subject = isGoogleAccount ? "Set a password for your Pulse account" : "Reset your Pulse password";
    const heading = isGoogleAccount ? "Set your password" : "Reset your password";
    const buttonText = isGoogleAccount ? "Set password" : "Reset password";

    await resend.emails.send({
      from: "Pulse <onboarding@resend.dev>",
      to: email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #07060F; color: #FFFFFE; border-radius: 12px;">
          <h2 style="margin: 0 0 8px; font-size: 22px;">${heading}</h2>
          <p style="color: #6E708A; margin: 0 0 24px;">Click the button below to set a new password. The link expires in 1 hour.</p>
          <a href="${resetUrl}"
             style="display: inline-block; padding: 12px 24px; background: #FFB547; color: #07060F; font-weight: 700; border-radius: 10px; text-decoration: none; font-size: 14px;">
            ${buttonText}
          </a>
          <p style="color: #6E708A; font-size: 12px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

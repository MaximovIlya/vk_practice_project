import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { name, email, password, role } = await req.json();

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!["ORGANIZER", "PARTICIPANT"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name: name.trim(), email: email.toLowerCase().trim(), password: hashed, role: role as Role },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

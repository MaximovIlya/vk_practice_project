import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
  if (!quiz || quiz.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reset = new URL(req.url).searchParams.get("reset") === "1";

  // Reuse an existing non-finished session instead of creating a duplicate.
  // Without this, the page's load effect (which React Strict Mode invokes twice
  // in dev) creates two WAITING rooms — one gets played, the other lingers
  // forever and keeps the dashboard "active quiz" banner alive.
  if (!reset) {
    const existing = await prisma.quizSession.findFirst({
      where: { quizId: params.id, status: { not: "FINISHED" } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      // Drop any *other* abandoned empty rooms so only one stays open per quiz.
      await prisma.quizSession.deleteMany({
        where: { quizId: params.id, status: { not: "FINISHED" }, id: { not: existing.id }, players: { none: {} } },
      });
      return NextResponse.json(existing, { status: 200 });
    }
  }

  // Creating fresh (reset or none open): clear abandoned empty rooms first.
  await prisma.quizSession.deleteMany({
    where: { quizId: params.id, status: { not: "FINISHED" }, players: { none: {} } },
  });

  // Generate unique room code
  let roomCode = randomCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.quizSession.findUnique({ where: { roomCode } });
    if (!existing) break;
    roomCode = randomCode();
    attempts++;
  }

  const quizSession = await prisma.quizSession.create({
    data: { quizId: params.id, roomCode, status: "WAITING" },
  });

  return NextResponse.json(quizSession, { status: 201 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the organizer's current (non-finished) session for this quiz
  const quizSession = await prisma.quizSession.findFirst({
    where: { quizId: params.id, status: { not: "FINISHED" }, quiz: { authorId: session.user.id } },
    orderBy: { createdAt: "desc" },
  });
  if (!quizSession) return NextResponse.json({ ok: true });

  // SessionPlayer → PlayerAnswer cascade on delete, so removing the session
  // is enough.
  await prisma.quizSession.delete({ where: { id: quizSession.id } });

  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latest = await prisma.quizSession.findFirst({
    where: { quizId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      players: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { score: "desc" },
      },
    },
  });

  return NextResponse.json(latest);
}

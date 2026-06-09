import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
  if (!quiz || quiz.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  // No onDelete: Cascade on these relations, so remove children first.
  await prisma.$transaction([
    prisma.playerAnswer.deleteMany({ where: { sessionPlayer: { sessionId: quizSession.id } } }),
    prisma.sessionPlayer.deleteMany({ where: { sessionId: quizSession.id } }),
    prisma.quizSession.delete({ where: { id: quizSession.id } }),
  ]);

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

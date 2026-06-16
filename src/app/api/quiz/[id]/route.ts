import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { answers: true },
      },
    },
  });

  if (!quiz || quiz.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(quiz);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
  if (!quiz || quiz.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await req.json();
  const SCORING_MODES = ["standard", "speed", "streak"];
  const DIFFICULTIES = ["Легко", "Средне", "Сложно"];
  const updated = await prisma.quiz.update({
    where: { id: params.id },
    data: {
      title: data.title?.trim() ?? quiz.title,
      description: data.description?.trim() ?? quiz.description,
      category: data.category ?? quiz.category,
      timePerQuestion: data.timePerQuestion ?? quiz.timePerQuestion,
      pointsPerQuestion: data.pointsPerQuestion ?? quiz.pointsPerQuestion,
      scoring: SCORING_MODES.includes(data.scoring) ? data.scoring : quiz.scoring,
      difficulty: DIFFICULTIES.includes(data.difficulty) ? data.difficulty : quiz.difficulty,
      tags: Array.isArray(data.tags) ? data.tags.filter((t: unknown): t is string => typeof t === "string") : quiz.tags,
      coverImageUrl: data.coverImageUrl === null || typeof data.coverImageUrl === "string"
        ? (data.coverImageUrl || null)
        : quiz.coverImageUrl,
      archived: typeof data.archived === "boolean" ? data.archived : quiz.archived,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
  if (!quiz || quiz.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The session graph (QuizSession → SessionPlayer → PlayerAnswer) and the
  // question graph cascade on delete, so removing the quiz is enough.
  await prisma.quiz.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

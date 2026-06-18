import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: { id: string; questionId: string } };

export async function PUT(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
  if (!quiz || quiz.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { text, type, imageUrl, answers, tags, timeLimit, points } = await req.json();

  await prisma.question.update({
    where: { id: params.questionId },
    data: {
      text: text ?? undefined,
      type: type ?? undefined,
      imageUrl: imageUrl !== undefined ? imageUrl : undefined,
      tags: Array.isArray(tags) ? tags : undefined,
      timeLimit: timeLimit ?? undefined,
      points: points ?? undefined,
    },
  });

  if (Array.isArray(answers)) {
    await prisma.answer.deleteMany({ where: { questionId: params.questionId } });
    if (answers.length > 0) {
      await prisma.answer.createMany({
        data: answers.map((a: { text: string; isCorrect: boolean }) => ({
          questionId: params.questionId,
          text: a.text,
          isCorrect: a.isCorrect ?? false,
        })),
      });
    }
  }

  const updated = await prisma.question.findUnique({
    where: { id: params.questionId },
    include: { answers: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
  if (!quiz || quiz.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.question.delete({ where: { id: params.questionId } });

  // Re-order remaining questions
  const remaining = await prisma.question.findMany({
    where: { quizId: params.id },
    orderBy: { order: "asc" },
  });
  for (let i = 0; i < remaining.length; i++) {
    await prisma.question.update({
      where: { id: remaining[i].id },
      data: { order: i + 1 },
    });
  }

  return NextResponse.json({ ok: true });
}

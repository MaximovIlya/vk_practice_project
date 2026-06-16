import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quizSession = await prisma.quizSession.findUnique({
    where: { roomCode: params.code.toUpperCase() },
    include: {
      quiz: {
        include: {
          author: { select: { name: true } },
          questions: {
            orderBy: { order: "asc" },
            include: {
              answers: {
                select: { id: true, text: true },
              },
            },
          },
        },
      },
    },
  });

  if (!quizSession) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  return NextResponse.json({
    session: {
      id: quizSession.id,
      roomCode: quizSession.roomCode,
      status: quizSession.status,
    },
    quiz: {
      id: quizSession.quiz.id,
      title: quizSession.quiz.title,
      description: quizSession.quiz.description,
      category: quizSession.quiz.category,
      scoring: quizSession.quiz.scoring,
      difficulty: quizSession.quiz.difficulty,
      tags: quizSession.quiz.tags,
      coverImageUrl: quizSession.quiz.coverImageUrl,
      hostName: quizSession.quiz.author.name ?? "Host",
      questions: quizSession.quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        imageUrl: q.imageUrl ?? null,
        timeLimit: q.timeLimit,
        points: q.points,
        answers: q.answers,
      })),
    },
  });
}

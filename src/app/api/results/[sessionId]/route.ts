import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quizSession = await prisma.quizSession.findUnique({
    where: { id: params.sessionId },
    include: {
      quiz: {
        include: {
          author: { select: { name: true } },
          questions: { select: { id: true } },
        },
      },
      players: {
        include: {
          user: { select: { id: true, name: true } },
          playerAnswers: { select: { isCorrect: true } },
        },
        orderBy: { score: "desc" },
      },
    },
  });

  if (!quizSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalQuestions = quizSession.quiz.questions.length;

  const leaderboard = quizSession.players.map((sp, i) => ({
    rank: i + 1,
    userId: sp.userId,
    name: sp.user.name,
    score: sp.score,
    correct: sp.playerAnswers.filter((a) => a.isCorrect).length,
    total: totalQuestions,
  }));

  return NextResponse.json({
    sessionId: quizSession.id,
    quizId: quizSession.quizId,
    quizTitle: quizSession.quiz.title,
    hostName: quizSession.quiz.author.name,
    startedAt: quizSession.startedAt,
    playerCount: quizSession.players.length,
    leaderboard,
  });
}

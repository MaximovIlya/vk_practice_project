export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import OrganizerDashboard from "./_components/OrganizerDashboard";
import ParticipantDashboard from "./_components/ParticipantDashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.needsRoleSelection) redirect("/select-role");

  const user = { name: session.user.name, role: session.user.role };

  if (session.user.role === "ORGANIZER") {
    const quizzes = await prisma.quiz.findMany({
      where: { authorId: session.user.id },
      include: {
        _count: { select: { questions: true } },
        sessions: {
          select: {
            status: true,
            startedAt: true,
            _count: { select: { players: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const quizzesData = quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      category: q.category,
      questionCount: q._count.questions,
      totalPlays: q.sessions.reduce((sum, s) => sum + s._count.players, 0),
      lastRun:
        q.sessions
          .filter((s) => s.startedAt)
          .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))[0]
          ?.startedAt?.toISOString() ?? null,
    }));

    const totalPlays = quizzesData.reduce((sum, q) => sum + q.totalPlays, 0);
    const activeRooms = quizzes.reduce(
      (sum, q) =>
        sum + q.sessions.filter((s) => s.status === "ACTIVE" || s.status === "WAITING").length,
      0
    );

    const avgResult = await prisma.sessionPlayer.aggregate({
      where: { session: { quiz: { authorId: session.user.id } } },
      _avg: { score: true },
    });

    const activeSession = await prisma.quizSession.findFirst({
      where: {
        quiz: { authorId: session.user.id },
        status: { in: ["ACTIVE", "WAITING"] },
      },
      include: { quiz: { select: { id: true, title: true } } },
      orderBy: { startedAt: "desc" },
    });

    return (
      <OrganizerDashboard
        user={user}
        stats={{
          totalQuizzes: quizzes.length,
          totalPlays,
          avgScore: avgResult._avg.score != null ? Math.round(avgResult._avg.score) : null,
          activeRooms,
        }}
        quizzes={quizzesData}
        activeSession={activeSession ? {
          sessionId: activeSession.id,
          quizId: activeSession.quiz.id,
          quizTitle: activeSession.quiz.title,
          status: activeSession.status,
        } : null}
      />
    );
  }

  // Participant — check active session
  const activeParticipation = await prisma.sessionPlayer.findFirst({
    where: {
      userId: session.user.id,
      session: { status: { in: ["ACTIVE", "WAITING"] } },
    },
    include: {
      session: {
        include: { quiz: { select: { title: true } } },
      },
    },
  });

  // Participant
  const sessionPlayers = await prisma.sessionPlayer.findMany({
    where: { userId: session.user.id },
    include: {
      session: {
        include: {
          quiz: { include: { author: { select: { name: true } } } },
          players: { select: { score: true }, orderBy: { score: "desc" } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const history = sessionPlayers.map((sp) => {
    const rank = sp.session.players.filter((p) => p.score > sp.score).length + 1;
    return {
      id: sp.id,
      quizTitle: sp.session.quiz.title,
      hostName: sp.session.quiz.author.name,
      date: sp.joinedAt.toISOString(),
      score: sp.score,
      rank,
      totalPlayers: sp.session.players.length,
    };
  });

  return (
    <ParticipantDashboard
      user={user}
      history={history}
      activeSession={activeParticipation ? {
        roomCode: activeParticipation.session.roomCode,
        quizTitle: activeParticipation.session.quiz.title,
        status: activeParticipation.session.status,
      } : null}
    />
  );
}

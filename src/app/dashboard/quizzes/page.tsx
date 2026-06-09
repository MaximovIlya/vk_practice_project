export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import MyQuizzesView from "../_components/MyQuizzesView";

export default async function MyQuizzesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.needsRoleSelection) redirect("/select-role");
  // Only organizers own quizzes; participants have no library.
  if (session.user.role !== "ORGANIZER") redirect("/dashboard");

  const quizzes = await prisma.quiz.findMany({
    where: { authorId: session.user.id },
    include: {
      _count: { select: { questions: true } },
      sessions: { select: { startedAt: true, _count: { select: { players: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const quizzesData = quizzes.map((q) => ({
    id: q.id,
    title: q.title,
    category: q.category,
    questionCount: q._count.questions,
    archived: q.archived,
    totalPlays: q.sessions.reduce((sum, s) => sum + s._count.players, 0),
    lastRun:
      q.sessions
        .filter((s) => s.startedAt)
        .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))[0]
        ?.startedAt?.toISOString() ?? null,
  }));

  return (
    <MyQuizzesView
      user={{ name: session.user.name, role: session.user.role }}
      quizzes={quizzesData}
    />
  );
}

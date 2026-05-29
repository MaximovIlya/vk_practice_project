import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import type { ServerToClientEvents, ClientToServerEvents, Player } from "@/types/socket";
import { prisma } from "@/lib/db";

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

// In-memory session state
const sessionTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Track socket -> { sessionId, userId } for disconnect cleanup
const socketPlayers = new Map<string, { sessionId: string; userId: string }>();

function roomKey(sessionId: string) { return `session:${sessionId}`; }

export function initSocketServer(httpServer: HTTPServer) {
  const io: IO = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {

    socket.on("organizer-join", ({ sessionId }) => {
      socket.join(roomKey(sessionId));
    });

    socket.on("disconnect", () => {
      const info = socketPlayers.get(socket.id);
      if (info) {
        io.to(roomKey(info.sessionId)).emit("player-left", info.userId);
        socketPlayers.delete(socket.id);
      }
    });

    socket.on("join-room", async ({ roomCode, userId, name }) => {
      const session = await prisma.quizSession.findUnique({
        where: { roomCode },
        include: { players: true },
      });
      if (!session) return socket.emit("error", "Room not found");
      if (session.status === "FINISHED") return socket.emit("error", "Quiz already finished");

      // Upsert SessionPlayer
      let sp = session.players.find((p) => p.userId === userId);
      if (!sp) {
        sp = await prisma.sessionPlayer.create({
          data: { sessionId: session.id, userId, score: 0 },
        });
      }

      socket.join(roomKey(session.id));
      socketPlayers.set(socket.id, { sessionId: session.id, userId });
      const player: Player = { userId, name, score: sp.score, sessionPlayerId: sp.id };
      io.to(roomKey(session.id)).emit("player-joined", player);

      // Send the full current player list to the newly joined socket so they
      // can see players who were already in the room before them.
      const currentPlayers = await getLeaderboard(session.id);
      socket.emit("score-update", currentPlayers);
    });

    socket.on("start-quiz", async ({ sessionId }) => {
      const session = await prisma.quizSession.findUnique({
        where: { id: sessionId },
        include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
      });
      if (!session) return;

      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { status: "ACTIVE", startedAt: new Date() },
      });

      io.to(roomKey(sessionId)).emit("quiz-started", { questionIndex: 0 });
      startQuestion(io, sessionId, 0);
    });

    socket.on("next-question", async ({ sessionId }) => {
      const session = await prisma.quizSession.findUnique({
        where: { id: sessionId },
        include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
      });
      if (!session) return;

      // Find current question index from metadata (stored in timer map key)
      const currentIdx = (sessionTimers.has(`${sessionId}:idx`)
        ? Number((sessionTimers as unknown as Map<string, number>).get(`${sessionId}:idx`))
        : 0);
      const nextIdx = currentIdx + 1;

      if (nextIdx >= session.quiz.questions.length) {
        return finishQuiz(io, sessionId);
      }
      startQuestion(io, sessionId, nextIdx);
    });

    socket.on("end-question", async ({ sessionId }) => {
      const timer = sessionTimers.get(sessionId);
      if (timer) { clearTimeout(timer); sessionTimers.delete(sessionId); }
      await revealQuestion(io, sessionId);
    });

    socket.on("submit-answer", async ({ sessionId, questionId, answerIds, userId }) => {
      const session = await prisma.quizSession.findUnique({
        where: { id: sessionId },
        include: { players: true },
      });
      if (!session || session.status !== "ACTIVE") return;

      const sp = session.players.find((p) => p.userId === userId);
      if (!sp) return;

      const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { answers: true },
      });
      if (!question) return;

      const correctIds = question.answers.filter((a) => a.isCorrect).map((a) => a.id);
      const isCorrect = answerIds.length === correctIds.length &&
        answerIds.every((id) => correctIds.includes(id));

      await prisma.playerAnswer.create({
        data: {
          sessionPlayerId: sp.id,
          questionId,
          isCorrect,
          points: isCorrect ? question.points : 0,
          answers: { connect: answerIds.map((id) => ({ id })) },
        },
      });

      if (isCorrect) {
        await prisma.sessionPlayer.update({
          where: { id: sp.id },
          data: { score: { increment: question.points } },
        });
      }

      // Broadcast updated vote counts
      const votes = await getVotes(sessionId, questionId);
      const totalAnswered = await prisma.playerAnswer.count({
        where: { sessionPlayerId: { in: session.players.map((p) => p.id) }, questionId },
      });
      io.to(roomKey(sessionId)).emit("answer-received", { votes, totalAnswered });
    });
  });

  return io;
}

async function startQuestion(io: IO, sessionId: string, idx: number) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!session) return;

  const question = session.quiz.questions[idx];
  if (!question) return finishQuiz(io, sessionId);

  // Store current idx
  (sessionTimers as unknown as Map<string, number>).set(`${sessionId}:idx`, idx);

  const endsAt = Date.now() + question.timeLimit * 1000;
  io.to(roomKey(sessionId)).emit("question-started", { questionIndex: idx, endsAt });

  const timer = setTimeout(() => revealQuestion(io, sessionId), question.timeLimit * 1000);
  sessionTimers.set(sessionId, timer);
}

async function revealQuestion(io: IO, sessionId: string) {
  sessionTimers.delete(sessionId);

  const idx = (sessionTimers as unknown as Map<string, number>).get(`${sessionId}:idx`) ?? 0;

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { quiz: { include: { questions: { orderBy: { order: "asc" }, include: { answers: true } } } } },
  });
  if (!session) return;

  const question = session.quiz.questions[idx as number];
  if (!question) return;

  const correctAnswerIds = question.answers.filter((a) => a.isCorrect).map((a) => a.id);
  const votes = await getVotes(sessionId, question.id);

  io.to(roomKey(sessionId)).emit("question-ended", { correctAnswerIds, votes });

  // Update scores in leaderboard
  const players = await getLeaderboard(sessionId);
  io.to(roomKey(sessionId)).emit("score-update", players);
}

async function finishQuiz(io: IO, sessionId: string) {
  await prisma.quizSession.update({ where: { id: sessionId }, data: { status: "FINISHED" } });
  const players = await getLeaderboard(sessionId);
  io.to(roomKey(sessionId)).emit("quiz-finished", players);
}

async function getVotes(sessionId: string, questionId: string) {
  const answers = await prisma.playerAnswer.findMany({
    where: { question: { id: questionId }, sessionPlayer: { sessionId } },
    include: { answers: true },
  });
  const votes: Record<string, number> = {};
  for (const pa of answers) {
    for (const a of pa.answers) {
      votes[a.id] = (votes[a.id] ?? 0) + 1;
    }
  }
  return votes;
}

async function getLeaderboard(sessionId: string): Promise<Player[]> {
  const players = await prisma.sessionPlayer.findMany({
    where: { sessionId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { score: "desc" },
  });
  return players.map((p) => ({
    userId: p.user.id,
    name: p.user.name,
    score: p.score,
    sessionPlayerId: p.id,
  }));
}

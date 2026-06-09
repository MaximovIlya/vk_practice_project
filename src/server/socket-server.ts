import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import type { ServerToClientEvents, ClientToServerEvents, Player } from "@/types/socket";
import { prisma } from "@/lib/db";

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

// In-memory session state
const sessionTimers  = new Map<string, ReturnType<typeof setTimeout>>();
const sessionIndexes = new Map<string, number>(); // sessionId -> current question index
const sessionEndsAt  = new Map<string, number>(); // sessionId -> current question endsAt timestamp
const sessionReveal  = new Map<string, { correctAnswerIds: string[]; votes: Record<string, number> }>();
// Track socket -> { sessionId, userId } for disconnect cleanup
const socketPlayers  = new Map<string, { sessionId: string; userId: string }>();

function roomKey(sessionId: string) { return `session:${sessionId}`; }

export function initSocketServer(httpServer: HTTPServer) {
  const io: IO = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {

    socket.on("organizer-join", async ({ sessionId }) => {
      socket.join(roomKey(sessionId));

      // Restore current state if rejoining an active session
      const sess = await prisma.quizSession.findUnique({ where: { id: sessionId } });
      if (!sess || sess.status !== "ACTIVE") return;

      const idx = sessionIndexes.get(sessionId) ?? 0;
      const revealState = sessionReveal.get(sessionId);

      if (revealState) {
        socket.emit("question-ended", { ...revealState, questionIndex: idx });
        const leaderboard = await getLeaderboard(sessionId);
        socket.emit("score-update", leaderboard);
      } else {
        const endsAt = sessionEndsAt.get(sessionId);
        if (endsAt !== undefined) {
          socket.emit("question-started", { questionIndex: idx, endsAt });
          // Restore live vote counts for organizer
          const sessData = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } }, players: true },
          });
          if (sessData) {
            const q = sessData.quiz.questions[idx];
            if (q) {
              const votes = await getVotes(sessionId, q.id);
              const totalAnswered = await prisma.playerAnswer.count({
                where: { sessionPlayerId: { in: sessData.players.map((p) => p.id) }, questionId: q.id },
              });
              socket.emit("answer-received", { votes, totalAnswered });
            }
          }
        }
      }
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

      // Restore current question state if rejoining an active session
      if (session.status === "ACTIVE") {
        const idx = sessionIndexes.get(session.id) ?? 0;
        const revealState = sessionReveal.get(session.id);
        if (revealState) {
          socket.emit("question-ended", { ...revealState, questionIndex: idx });
          // Also re-send how many points this player earned on the current
          // question, so the reveal screen shows the real number (and the
          // "partial credit" state) after a refresh/reconnect mid-reveal.
          const questions = await prisma.question.findMany({
            where: { quizId: session.quizId },
            orderBy: { order: "asc" },
            select: { id: true },
          });
          const currentQuestionId = questions[idx]?.id;
          if (currentQuestionId) {
            const myAnswer = await prisma.playerAnswer.findFirst({
              where: { sessionPlayerId: sp.id, questionId: currentQuestionId },
            });
            if (myAnswer) {
              socket.emit("answer-result", {
                points: myAnswer.points,
                isCorrect: myAnswer.isCorrect,
              });
            }
          }
        } else {
          const endsAt = sessionEndsAt.get(session.id);
          if (endsAt !== undefined) {
            socket.emit("question-started", { questionIndex: idx, endsAt });
          }
        }
      }
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

      const currentIdx = sessionIndexes.get(sessionId) ?? 0;
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
        include: { players: true, quiz: { select: { scoring: true } } },
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

      let isCorrect: boolean;
      let earnedPoints: number;

      if (question.type === "MULTIPLE") {
        const correctlySelected = answerIds.filter((id) => correctIds.includes(id)).length;
        const wronglySelected = answerIds.filter((id) => !correctIds.includes(id)).length;
        isCorrect = correctlySelected === correctIds.length && wronglySelected === 0;
        // Partial credit: each correct selection adds points, each wrong selection
        // subtracts the same amount. Net is clamped to 0 so you can't go negative.
        const net = Math.max(0, correctlySelected - wronglySelected);
        earnedPoints = correctIds.length > 0
          ? Math.round((net / correctIds.length) * question.points)
          : 0;
      } else {
        isCorrect = answerIds.length === correctIds.length &&
          answerIds.every((id) => correctIds.includes(id));
        earnedPoints = isCorrect ? question.points : 0;
      }

      // Apply the quiz's scoring system on top of the base (correctness) points.
      const mode = session.quiz.scoring;
      if (earnedPoints > 0 && mode === "speed") {
        // score = base_points * (remaining_time / total_time)
        const endsAt = sessionEndsAt.get(sessionId);
        const totalMs = question.timeLimit * 1000;
        const remainingMs = endsAt ? Math.max(0, endsAt - Date.now()) : 0;
        const factor = totalMs > 0 ? remainingMs / totalMs : 0;
        earnedPoints = Math.round(earnedPoints * factor);
      } else if (isCorrect && mode === "streak") {
        // streak = consecutive correct answers ending with this one (counted from
        // the player's prior answers, since this one isn't persisted yet).
        const prior = await prisma.playerAnswer.findMany({
          where: { sessionPlayerId: sp.id },
          include: { question: { select: { order: true } } },
        });
        prior.sort((a, b) => a.question.order - b.question.order);
        let streak = 1; // this correct answer
        for (let i = prior.length - 1; i >= 0; i--) {
          if (prior[i].isCorrect) streak++;
          else break;
        }
        // The bonus only starts from the 2nd consecutive correct answer, so the
        // first correct answer earns just the base points (multiplier 1.0).
        // multiplier = 1 + (streak - 1) * 0.1  →  1.0, 1.1, 1.2, …
        earnedPoints = Math.round(earnedPoints * (1 + (streak - 1) * 0.1));
      }

      await prisma.playerAnswer.create({
        data: {
          sessionPlayerId: sp.id,
          questionId,
          isCorrect,
          points: earnedPoints,
          answers: { connect: answerIds.map((id) => ({ id })) },
        },
      });

      if (earnedPoints > 0) {
        await prisma.sessionPlayer.update({
          where: { id: sp.id },
          data: { score: { increment: earnedPoints } },
        });
      }

      // Tell the submitting player exactly how many points they earned this
      // round (after the speed/streak modifiers), so the reveal screen can show
      // the real number instead of the base points.
      socket.emit("answer-result", { points: earnedPoints, isCorrect });

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

  const advTimer = sessionTimers.get(`${sessionId}:advance`);
  if (advTimer) { clearTimeout(advTimer); sessionTimers.delete(`${sessionId}:advance`); }
  const qTimer = sessionTimers.get(sessionId);
  if (qTimer) { clearTimeout(qTimer); sessionTimers.delete(sessionId); }
  sessionIndexes.set(sessionId, idx);
  sessionReveal.delete(sessionId);

  const endsAt = Date.now() + question.timeLimit * 1000;
  sessionEndsAt.set(sessionId, endsAt);
  io.to(roomKey(sessionId)).emit("question-started", { questionIndex: idx, endsAt });

  const timer = setTimeout(
    () => revealQuestion(io, sessionId).catch(e => console.error("[revealQuestion]", e)),
    question.timeLimit * 1000,
  );
  sessionTimers.set(sessionId, timer);
}

async function revealQuestion(io: IO, sessionId: string) {
  sessionTimers.delete(sessionId);
  // NOTE: deliberately do NOT delete sessionEndsAt here. Restoration logic
  // checks sessionReveal first (it takes priority), so a lingering endsAt is
  // harmless — and keeping it avoids a race window where a rejoining player
  // finds neither reveal state nor endsAt and gets stuck on the loading screen.

  const idx = sessionIndexes.get(sessionId) ?? 0;

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { quiz: { include: { questions: { orderBy: { order: "asc" }, include: { answers: true } } } } },
  });
  if (!session) return;

  const question = session.quiz.questions[idx as number];
  if (!question) return;

  // For the final question we skip the 5-second reveal window entirely and jump
  // straight to the results — there is no "next question" to count down to.
  const isLast = (idx as number) >= session.quiz.questions.length - 1;
  if (isLast) {
    await finishQuiz(io, sessionId);
    return;
  }

  const correctAnswerIds = question.answers.filter((a) => a.isCorrect).map((a) => a.id);
  const votes = await getVotes(sessionId, question.id);

  sessionReveal.set(sessionId, { correctAnswerIds, votes });
  io.to(roomKey(sessionId)).emit("question-ended", { correctAnswerIds, votes, questionIndex: idx as number });

  // Update scores in leaderboard
  const players = await getLeaderboard(sessionId);
  io.to(roomKey(sessionId)).emit("score-update", players);

  // Auto-advance after 5-second reveal window
  const nextIdx = (idx as number) + 1;
  const advanceTimer = setTimeout(async () => {
    sessionTimers.delete(`${sessionId}:advance`);
    try {
      if (nextIdx >= session.quiz.questions.length) {
        await finishQuiz(io, sessionId);
      } else {
        await startQuestion(io, sessionId, nextIdx);
      }
    } catch (e) {
      console.error("[auto-advance]", e);
    }
  }, 5000);
  sessionTimers.set(`${sessionId}:advance`, advanceTimer);
}

async function finishQuiz(io: IO, sessionId: string) {
  const advTimer = sessionTimers.get(`${sessionId}:advance`);
  if (advTimer) { clearTimeout(advTimer); sessionTimers.delete(`${sessionId}:advance`); }
  sessionIndexes.delete(sessionId);
  sessionEndsAt.delete(sessionId);
  sessionReveal.delete(sessionId);
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

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { Player, AnswerVotes } from "@/types/socket";
import { plural } from "@/lib/plural";

type Answer = { id: string; text: string; isCorrect: boolean };
type Question = { id: string; text: string; type: string; timeLimit: number; points: number; answers: Answer[]; order: number; imageUrl?: string | null };
type Quiz = { id: string; title: string; questions: Question[] };
type QuizSession = { id: string; roomCode: string; status: string };

type Phase = "WAITING" | "ACTIVE" | "REVEAL" | "FINISHED";

const ANS_GRADIENTS = [
  "linear-gradient(135deg,#FF6584 0%,#E54170 100%)",
  "linear-gradient(135deg,#4DC4FF 0%,#2B7FE0 100%)",
  "linear-gradient(135deg,#FFB547 0%,#E08512 100%)",
  "linear-gradient(135deg,#43D98F 0%,#1FA269 100%)",
];
const ANS_LETTERS = ["A", "B", "C", "D"];

function initials(name: string) {
  const p = name.trim().split(" ");
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase();
}

const AVATAR_COLORS = ["#0077FF","#E64646","#4BB34B","#FFA000","#4DC4FF","#F97316","#14B8A6","#A78BFA"];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function RunQuizPage() {
  const params       = useParams<{ id: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [quiz,        setQuiz]        = useState<Quiz | null>(null);
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [players,     setPlayers]     = useState<Player[]>([]);
  const [phase,       setPhase]       = useState<Phase>("WAITING");
  const [qIdx,        setQIdx]        = useState(0);
  const [votes,       setVotes]       = useState<AnswerVotes>({});
  const [correctIds,  setCorrectIds]  = useState<string[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [copied,      setCopied]      = useState(false);
  const [revealSecs,  setRevealSecs]  = useState(5);
  const [isLastReveal, setIsLastReveal] = useState(false);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionInitRef = useRef(false);

  const currentQuestion: Question | null = quiz?.questions[qIdx] ?? null;

  // Load quiz + create/get session
  useEffect(() => {
    if (!params.id) return;
    // Guard against React Strict Mode invoking this effect twice in dev — a
    // double run would POST two sessions and leave an orphan WAITING room.
    if (sessionInitRef.current) return;
    sessionInitRef.current = true;
    const reset = searchParams.get("reset") === "1";
    Promise.all([
      fetch(`/api/quiz/${params.id}`).then((r) => r.json()),
      fetch(`/api/quiz/${params.id}/session`).then((r) => r.json()),
    ]).then(([quizData, sessionData]) => {
      setQuiz(quizData);
      if (sessionData && sessionData.id && sessionData.status === "FINISHED" && !reset) {
        // Quiz already finished — redirect to results instead of creating a new session
        router.replace(`/results/${sessionData.id}`);
        return;
      }
      if (sessionData && sessionData.id && sessionData.status !== "FINISHED") {
        setQuizSession(sessionData);
        setPlayers(sessionData.players?.map((sp: { user: { id: string; name: string }; score: number; id: string }) => ({
          userId: sp.user.id, name: sp.user.name, score: sp.score, sessionPlayerId: sp.id,
        })) ?? []);
      } else {
        // No session or ?reset=1 — create new session
        fetch(`/api/quiz/${params.id}/session${reset ? "?reset=1" : ""}`, { method: "POST" })
          .then((r) => r.json())
          .then((s) => setQuizSession(s));
      }
      // Strip ?reset=1 from the URL once the session is set up. Otherwise, after
      // the quiz finishes and the organizer presses Back, they'd land on this
      // page with reset=1 still in the URL and spawn yet another phantom session.
      // Without reset, a Back navigation onto a FINISHED quiz hits the redirect
      // to results above instead.
      if (reset) router.replace(`/quiz/${params.id}/run`);
    });
  }, [params.id]);

  // Socket.IO
  useEffect(() => {
    if (!quizSession?.id) return;
    const socket = getSocket();
    const sessionId = quizSession.id;

    const joinAsOrganizer = () => {
      socket.emit("organizer-join", { sessionId });
    };

    // Use `on` (not `once`) so that every reconnect re-joins the room.
    socket.on("connect", joinAsOrganizer);
    if (socket.connected) joinAsOrganizer();

    socket.on("player-joined", (player) => {
      setPlayers((prev) => {
        if (prev.find((p) => p.userId === player.userId)) return prev;
        return [...prev, player];
      });
    });
    socket.on("player-left", (userId) => {
      setPlayers((prev) => prev.filter((p) => p.userId !== userId));
    });
    socket.on("quiz-started", () => { setPhase("ACTIVE"); setQIdx(0); });
    socket.on("question-started", ({ questionIndex, endsAt }) => {
      if (revealTimerRef.current) { clearInterval(revealTimerRef.current); revealTimerRef.current = null; }
      setPhase("ACTIVE");
      setQIdx(questionIndex);
      setVotes({});
      setTotalAnswered(0);
      setCorrectIds([]);
      const tick = () => {
        const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        setTimeLeft(left);
        if (left <= 0 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      };
      tick();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(tick, 250);
    });
    socket.on("answer-received", ({ votes: v, totalAnswered: t }) => { setVotes(v); setTotalAnswered(t); });
    socket.on("question-ended", ({ correctAnswerIds, votes: v, questionIndex, isLast }) => {
      if (questionIndex !== undefined) setQIdx(questionIndex);
      setPhase("REVEAL");
      setIsLastReveal(!!isLast);
      setCorrectIds(correctAnswerIds);
      setVotes(v);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      // The final question doesn't auto-advance — the organizer presses a button
      // to move on to the results, so skip the countdown timer in that case.
      if (isLast) {
        if (revealTimerRef.current) { clearInterval(revealTimerRef.current); revealTimerRef.current = null; }
        return;
      }
      // Countdown until auto-advance
      setRevealSecs(5);
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      revealTimerRef.current = setInterval(() => {
        setRevealSecs(prev => {
          if (prev <= 1) { clearInterval(revealTimerRef.current!); revealTimerRef.current = null; return 0; }
          return prev - 1;
        });
      }, 1000);
    });
    socket.on("score-update", (p) => setPlayers(p));
    socket.on("quiz-finished", (p) => {
      setPlayers(p);
      setPhase("FINISHED");
      if (sessionId) router.push(`/results/${sessionId}`);
    });

    return () => {
      socket.off("connect", joinAsOrganizer);
      socket.off("player-joined"); socket.off("player-left");
      socket.off("quiz-started"); socket.off("question-started");
      socket.off("answer-received"); socket.off("question-ended");
      socket.off("score-update"); socket.off("quiz-finished");
      if (timerRef.current) clearInterval(timerRef.current);
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      disconnectSocket();
    };
  }, [quizSession?.id]);

  const startQuiz = useCallback(() => {
    if (!quizSession) return;
    getSocket().emit("start-quiz", { sessionId: quizSession.id });
  }, [quizSession]);

  const nextQuestion = useCallback(() => {
    if (!quizSession) return;
    getSocket().emit("next-question", { sessionId: quizSession.id });
    setPhase("ACTIVE");
  }, [quizSession]);

  const endQuestion = useCallback(() => {
    if (!quizSession) return;
    getSocket().emit("end-question", { sessionId: quizSession.id });
  }, [quizSession]);

  // After the final question's reveal: tell the server to finish the quiz. The
  // server responds with `quiz-finished`, whose handler redirects to /results.
  const goToResults = useCallback(() => {
    if (!quizSession) return;
    getSocket().emit("next-question", { sessionId: quizSession.id });
  }, [quizSession]);

  const endSession = useCallback(async () => {
    await fetch(`/api/quiz/${params.id}/session`, { method: "DELETE" });
    disconnectSocket();
    window.location.href = "/dashboard";
  }, [params.id]);

  const copyCode = useCallback(() => {
    if (!quizSession) return;
    navigator.clipboard.writeText(quizSession.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [quizSession]);

  // Space key to start
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && phase === "WAITING") { e.preventDefault(); startQuiz(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, startQuiz]);

  if (!quiz || !quizSession) {
    return (
      <div style={{ minHeight: "100vh", background: "#19191A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#909499", fontFamily: "Inter, sans-serif" }}>Настраиваем комнату…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#19191A", fontFamily: "Inter, sans-serif", color: "#E7E8EA", display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ── */}
      <header style={{
        flexShrink: 0, height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px",
        borderBottom: "1px solid #363738",
        position: "relative", zIndex: 5,
      }}>
        {/* Left: Pulse logo + quiz title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(180deg,#0077FF,#005CC4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="11" viewBox="8 11 20 14" fill="none">
              <path d="M10.5825 18H13.0552L14.7036 13.055L18 22.946L19.649 18H25.418" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>Pulse</span>
          <div style={{ width: 1, height: 20, background: "#363738", marginLeft: 4 }} />
          <span style={{ fontSize: 14, color: "#909499" }}>{quiz.title}</span>
        </div>

        {/* Right */}
        {phase === "WAITING" && (
          <button onClick={endSession} style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "none", background: "transparent", color: "#909499", fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Завершить сессию
          </button>
        )}
      </header>

      {/* ── Question progress bar (ACTIVE / REVEAL only) ── */}
      {(phase === "ACTIVE" || phase === "REVEAL") && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 32px", borderBottom: "1px solid #363738", background: "#19191A" }}>
          <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "rgba(0,119,255,0.15)", border: "1px solid rgba(0,119,255,0.3)", fontSize: 13, fontWeight: 600, color: "#71AAEB", fontVariantNumeric: "tabular-nums" }}>
            Вопрос {qIdx + 1} / {quiz.questions.length}
          </div>
          {phase === "REVEAL" && (
            isLastReveal ? (
              <button
                onClick={goToResults}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  height: 34, padding: "0 18px", borderRadius: 8, border: "none",
                  background: "linear-gradient(180deg,#0077FF,#005CC4)", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  boxShadow: "0 4px 16px rgba(0,119,255,0.35)",
                }}
              >
                Перейти к результатам
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#909499" }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {[1, 0.6, 0.3].map((op, i) => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#76787A", opacity: op }} />)}
                </div>
                {revealSecs > 0 ? `Следующий вопрос через ${revealSecs} сек` : "Переходим к следующему…"}
              </div>
            )
          )}
          {phase === "ACTIVE" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#909499" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{totalAnswered} / {players.length} ответили</span>
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ══ WAITING ══ */}
        {phase === "WAITING" && (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 420px", overflow: "hidden", position: "relative" }}>

            {/* Main waiting area */}
            <div style={{ padding: "40px 56px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              {/* Dot grid */}
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", pointerEvents: "none", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)" }} />
              {/* Glow blobs */}
              <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,119,255,0.25) 0%, transparent 60%)", top: "calc(30% - 300px)", left: "calc(30% - 300px)", pointerEvents: "none", filter: "blur(40px)" }} />
              <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(75,179,75,0.15) 0%, transparent 60%)", top: "calc(70% - 250px)", left: "calc(70% - 250px)", pointerEvents: "none", filter: "blur(40px)" }} />

              <div style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                {/* Room live badge */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(75,179,75,0.12)", border: "1px solid rgba(75,179,75,0.3)", marginBottom: 16 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4BB34B", display: "inline-block", boxShadow: "0 0 8px #4BB34B" }} />
                  <span style={{ color: "#4BB34B", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Комната открыта</span>
                </div>

                {/* Join at */}
                <div style={{ fontSize: 22, color: "#909499", marginBottom: 12 }}>
                  Подключайтесь на <span style={{ color: "#E7E8EA", fontWeight: 600 }}>pulse.app/join</span>
                </div>

                {/* Room code card */}
                <div style={{
                  display: "inline-flex", gap: 14,
                  padding: "22px 28px",
                  background: "rgba(35,35,36,0.7)",
                  border: "1px solid #363738",
                  borderRadius: 24,
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 4px rgba(0,119,255,0.1)",
                  marginBottom: 32,
                }}>
                  {quizSession.roomCode.split("").map((ch, i) => (
                    <div key={i} style={{
                      width: 88, height: 110,
                      background: "linear-gradient(180deg,#232324 0%,#19191A 100%)",
                      border: "1px solid #363738",
                      borderRadius: 14,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 64, fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "#E7E8EA",
                    }}>{ch}</div>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 36 }}>
                  <button onClick={copyCode} style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #363738", background: "#2C2D2E", color: "#E7E8EA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M9 4.5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    {copied ? "Скопировано!" : "Скопировать код"}
                  </button>
                  <button style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #363738", background: "#2C2D2E", color: "#E7E8EA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
                    Показать QR
                  </button>
                </div>

                {/* Start button */}
                <button
                  onClick={startQuiz}
                  disabled={players.length === 0}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    minWidth: 280, height: 60,
                    borderRadius: 10, border: "none",
                    background: players.length > 0
                      ? "linear-gradient(180deg,#0077FF 0%,#005CC4 100%)"
                      : "#2C2D2E",
                    boxShadow: players.length > 0
                      ? "0 4px 16px rgba(0,119,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)"
                      : "inset 0 0 0 1px #363738",
                    color: players.length > 0 ? "#fff" : "#76787A",
                    fontSize: 18, fontWeight: 600,
                    cursor: players.length > 0 ? "pointer" : "not-allowed",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Начать квиз ({players.length} {plural(players.length, ["игрок", "игрока", "игроков"])})
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#76787A", fontSize: 13, marginTop: 10 }}>
                  Нажмите{" "}
                  <kbd style={{ background: "#2C2D2E", padding: "2px 7px", borderRadius: 4, fontSize: 11, border: "1px solid #363738", fontFamily: "monospace" }}>Пробел</kbd>
                  {" "}для старта
                </div>
              </div>
            </div>

            {/* Right: players list */}
            <div style={{ borderLeft: "1px solid #363738", background: "#19191A", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Panel header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #363738", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#E7E8EA" }}>Игроки</div>
                  <div style={{ fontSize: 12, color: "#76787A", marginTop: 2 }}>
                    {players.length} подключились
                    {players.length > 0 && <span style={{ color: "#4BB34B" }}> · только что</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4BB34B", boxShadow: "0 0 8px #4BB34B" }} />
                  <span style={{ fontSize: 12, color: "#4BB34B", fontWeight: 500 }}>live</span>
                </div>
              </div>

              {/* Player rows */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 6 }}>
                {players.length === 0 && (
                  <p style={{ color: "#76787A", fontSize: 13, margin: 0 }}>Ожидаем игроков…</p>
                )}
                {players.map((p, i) => {
                  const isNew = i >= players.length - 2;
                  return (
                    <div key={p.userId} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", borderRadius: 8,
                      background: isNew ? "rgba(75,179,75,0.08)" : "#232324",
                      border: `1px solid ${isNew ? "rgba(75,179,75,0.3)" : "#363738"}`,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: avatarColor(p.name),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff",
                      }}>
                        {initials(p.name)}
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#E7E8EA" }}>{p.name}</span>
                      {isNew && <span style={{ fontSize: 11, color: "#4BB34B", fontWeight: 600 }}>только что</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ ACTIVE / REVEAL ══ */}
        {(phase === "ACTIVE" || phase === "REVEAL") && currentQuestion && (() => {
          const totalVotes = Object.values(votes).reduce((s, v) => s + v, 0) || 1;
          const correctCount = Object.entries(votes).filter(([id]) => correctIds.includes(id)).reduce((s, [, v]) => s + v, 0);
          const accuracy = totalAnswered > 0 ? Math.round(correctCount / totalAnswered * 100) : 0;
          const pct = currentQuestion.timeLimit > 0 ? (timeLeft / currentQuestion.timeLimit) * 100 : 0;
          const timerColor = pct > 50 ? "#4BB34B" : pct > 20 ? "#FFA000" : "#E64646";

          return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Timer bar strip */}
              {phase === "ACTIVE" && (
                <div style={{ padding: "20px 56px 0", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg,${timerColor}aa,${timerColor})`, borderRadius: 5, boxShadow: `0 0 20px ${timerColor}80`, transition: "width 0.25s linear" }} />
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, minWidth: 32, textAlign: "right", color: timerColor, fontVariantNumeric: "tabular-nums" }}>{timeLeft}</span>
                  </div>
                </div>
              )}

              {/* Main content grid */}
              <div style={{ flex: 1, padding: "28px 56px 40px", display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, overflow: "hidden" }}>

                {/* Left: question + tiles */}
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Meta + question text */}
                  <div style={{ flexShrink: 0, marginBottom: 28 }}>
                    {phase === "REVEAL" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4BB34B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 12 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Правильный ответ раскрыт
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#76787A", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 12 }}>
                      {currentQuestion.type === "SINGLE" ? "Один ответ" : "Несколько ответов"} · {currentQuestion.points.toLocaleString()} {plural(currentQuestion.points, ["очко", "очка", "очков"])}
                    </div>
                    {currentQuestion.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentQuestion.imageUrl}
                        alt=""
                        style={{ display: "block", margin: "0 auto 16px", maxHeight: 280, maxWidth: "100%", borderRadius: 12, objectFit: "contain" }}
                      />
                    )}
                    <div style={{ background: "#232324", border: "1px solid #363738", borderRadius: 16, padding: "28px 44px" }}>
                      <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                        {currentQuestion.text}
                      </div>
                    </div>
                  </div>

                  {/* Answer tiles 2×2 grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, alignContent: "start" }}>
                    {currentQuestion.answers.map((ans, ai) => {
                      const voteCount = votes[ans.id] ?? 0;
                      const votePct = Math.round((voteCount / totalVotes) * 100);
                      const isCorrect = correctIds.includes(ans.id);
                      const isReveal = phase === "REVEAL";
                      const dimmed = isReveal && !isCorrect;

                      return (
                        <div key={ans.id} style={{
                          position: "relative", overflow: "hidden",
                          borderRadius: 14, minHeight: 130,
                          padding: "28px 120px 28px 88px",
                          display: "flex", alignItems: "center",
                          fontSize: 22, fontWeight: 600, color: "white",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: ANS_GRADIENTS[ai % 4],
                          filter: dimmed ? "grayscale(0.7) brightness(0.45)" : "none",
                          boxShadow: isReveal && isCorrect ? "0 0 0 3px #4BB34B, 0 0 40px rgba(75,179,75,0.5)" : "none",
                          transition: "filter 0.3s, box-shadow 0.3s",
                        }}>
                          {/* Letter chip */}
                          <div style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", width: 52, height: 52, borderRadius: 12, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>
                            {ANS_LETTERS[ai % 4]}
                          </div>
                          {/* Answer text */}
                          <span style={{ flex: 1 }}>{ans.text}</span>
                          {/* Right: count + bar */}
                          <div style={{ position: "absolute", right: 14, top: 14, bottom: 14, width: 84, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isReveal && isCorrect && (
                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4BB34B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                              )}
                              <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{voteCount}</span>
                            </div>
                            <div style={{ width: 80, height: 6, background: "rgba(0,0,0,0.3)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${votePct}%`, height: "100%", background: "white", transition: "width 0.4s ease" }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* Right: live standings card */}
                <div style={{ background: "#232324", border: "1px solid #363738", borderRadius: 16, boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)", padding: 20, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Турнирная таблица</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(75,179,75,0.12)", border: "1px solid rgba(75,179,75,0.3)", fontSize: 12, fontWeight: 600, color: "#4BB34B" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4BB34B", display: "inline-block" }} />
                      live
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {players.slice(0, 10).map((p, i) => (
                      <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #363738" }}>
                        <span style={{ width: 22, fontSize: 13, fontWeight: 700, color: i < 3 ? "#FFA000" : "#76787A", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarColor(p.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {initials(p.name)}
                        </div>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{p.score.toLocaleString()}</span>
                      </div>
                    ))}
                    {players.length === 0 && <p style={{ color: "#76787A", fontSize: 13 }}>Игроков пока нет</p>}
                  </div>
                  <div style={{ paddingTop: 12, fontSize: 12, color: "#76787A", textAlign: "center", flexShrink: 0 }}>Обновляется после каждого вопроса</div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* FINISHED: redirecting to /results/[sessionId] */}
        {phase === "FINISHED" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#909499", fontFamily: "Inter, sans-serif" }}>Переходим к результатам…</p>
          </div>
        )}

      </div>
    </div>
  );
}

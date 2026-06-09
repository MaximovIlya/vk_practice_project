"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { AnswerVotes } from "@/types/socket";

type Answer      = { id: string; text: string };
type Question    = { id: string; text: string; type: string; timeLimit: number; points: number; answers: Answer[] };
type QuizData    = { id: string; title: string; hostName: string; scoring?: string; questions: Question[] };
type SessionData = { id: string; roomCode: string; status: string };
type Phase       = "LOADING" | "WAITING" | "ACTIVE" | "REVEAL" | "FINISHED";

const ANS_GRADIENTS = [
  "linear-gradient(135deg,#FF6584 0%,#E54170 100%)",
  "linear-gradient(135deg,#4DC4FF 0%,#2B7FE0 100%)",
  "linear-gradient(135deg,#FFB547 0%,#E08512 100%)",
  "linear-gradient(135deg,#43D98F 0%,#1FA269 100%)",
];

const AVATAR_PALETTE = ["#0077FF","#E64646","#4BB34B","#FFA000","#4DC4FF","#F97316","#14B8A6","#A78BFA"];
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(name: string) {
  const p = name.trim().split(" ");
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase();
}

export default function PlayPage() {
  const params           = useParams<{ code: string }>();
  const { data: auth }   = useSession();
  const router           = useRouter();

  const [phase,        setPhase]        = useState<Phase>("LOADING");
  const [quizSession,  setQuizSession]  = useState<SessionData | null>(null);
  const [quiz,         setQuiz]         = useState<QuizData | null>(null);
  const [qIdx,         setQIdx]         = useState(0);
  const [selectedIds,  setSelectedIds]  = useState<string[]>([]);
  const [submitted,    setSubmitted]    = useState(false);
  const [votes,        setVotes]        = useState<AnswerVotes>({});
  const [correctIds,   setCorrectIds]   = useState<string[]>([]);
  const [timeLeft,     setTimeLeft]     = useState(0);
  const [players,      setPlayers]      = useState<{ userId: string; name: string; score: number }[]>([]);
  const [error,        setError]        = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answerTimes,  setAnswerTimes]  = useState<number[]>([]);
  const [bestStreak,   setBestStreak]   = useState(0);
  const [roundPoints,  setRoundPoints]  = useState(0); // points earned on the current question
  const streakRef = useRef(0);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedRef   = useRef<string[]>([]);

  useEffect(() => { selectedRef.current = selectedIds; }, [selectedIds]);

  const myId    = auth?.user?.id;
  const myName  = auth?.user?.name ?? "Вы";
  const myScore = players.find(p => p.userId === myId)?.score ?? 0;
  const myRank  = (() => { const i = players.findIndex(p => p.userId === myId); return i >= 0 ? i + 1 : 0; })();

  const currentQuestion: Question | null = quiz?.questions[qIdx] ?? null;

  const isCorrect = correctIds.length > 0 && selectedRef.current.length > 0 &&
    selectedRef.current.every(id => correctIds.includes(id)) &&
    correctIds.every(id => selectedRef.current.includes(id));

  // Partial: earned some points but not the full amount (only possible for MULTIPLE questions)
  const isPartial = !isCorrect && roundPoints > 0;
  const correctlySelectedCount = selectedIds.filter(id => correctIds.includes(id)).length;
  const wronglySelectedCount = selectedIds.filter(id => !correctIds.includes(id)).length;

  // Load session
  useEffect(() => {
    if (!params.code) return;
    fetch(`/api/play/${params.code}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setQuizSession(data.session);
        setQuiz(data.quiz);
        if (data.session.status === "FINISHED") setPhase("FINISHED");
        else if (data.session.status === "ACTIVE") setPhase("LOADING"); // wait for socket to restore state
        else setPhase("WAITING");
      })
      .catch(() => setError("Не удалось подключиться к комнате"));
  }, [params.code]);

  // Socket
  useEffect(() => {
    if (!quizSession || !auth?.user) return;
    const socket = getSocket();
    const userId = auth.user.id;
    const name   = auth.user.name ?? "Аноним";

    const doJoin = () => socket.emit("join-room", { roomCode: quizSession.roomCode, userId, name });
    // Use `on` (not `once`) so that every reconnect re-joins the room.
    // The server's join-room handler restores current question state on rejoin.
    socket.on("connect", doJoin);
    if (socket.connected) doJoin();

    socket.on("error", msg => setError(msg));

    socket.on("player-joined", player =>
      setPlayers(prev => prev.find(p => p.userId === player.userId)
        ? prev : [...prev, { userId: player.userId, name: player.name, score: player.score }])
    );
    socket.on("player-left", uid =>
      setPlayers(prev => prev.filter(p => p.userId !== uid))
    );

    socket.on("quiz-started", ({ questionIndex }) => {
      setQIdx(questionIndex); setSelectedIds([]); setSubmitted(false);
      setVotes({}); setCorrectIds([]); setRoundPoints(0); setPhase("ACTIVE");
    });

    socket.on("question-started", ({ questionIndex, endsAt }) => {
      setQIdx(questionIndex); setSelectedIds([]); setSubmitted(false);
      setVotes({}); setCorrectIds([]); setRoundPoints(0); setPhase("ACTIVE");
      const tick = () => {
        const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        setTimeLeft(left);
        if (left <= 0 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      };
      tick();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(tick, 250);
    });

    socket.on("answer-received", ({ votes: v }) => setVotes(v));

    socket.on("answer-result", ({ points }) => setRoundPoints(points));

    socket.on("question-ended", ({ correctAnswerIds, votes: v, questionIndex }) => {
      if (questionIndex !== undefined) setQIdx(questionIndex);
      setPhase("REVEAL");
      setCorrectIds(correctAnswerIds);
      setVotes(v);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const sel = selectedRef.current;
      const wasCorrect = sel.length > 0 &&
        sel.every(id => correctAnswerIds.includes(id)) &&
        correctAnswerIds.every(id => sel.includes(id));
      if (wasCorrect) {
        setCorrectCount(prev => prev + 1);
        streakRef.current += 1;
        setBestStreak(prev => Math.max(prev, streakRef.current));
      } else {
        streakRef.current = 0;
      }
    });

    socket.on("score-update", p =>
      setPlayers(p.map(pl => ({ userId: pl.userId, name: pl.name, score: pl.score })))
    );
    socket.on("quiz-finished", p => {
      setPlayers(p.map(pl => ({ userId: pl.userId, name: pl.name, score: pl.score })));
      setPhase("FINISHED");
      // The final question skips the reveal step that normally updates local
      // stats, so pull the authoritative per-question correctness for the recap.
      fetch(`/api/results/${quizSession.id}`)
        .then(r => r.json())
        .then(d => {
          const me = d?.leaderboard?.find((e: { userId: string }) => e.userId === userId);
          if (me && typeof me.correct === "number") setCorrectCount(me.correct);
        })
        .catch(() => {});
    });

    return () => {
      socket.off("connect", doJoin);
      socket.off("error"); socket.off("player-joined"); socket.off("player-left");
      socket.off("quiz-started"); socket.off("question-started");
      socket.off("answer-received"); socket.off("answer-result"); socket.off("question-ended");
      socket.off("score-update"); socket.off("quiz-finished");
      if (timerRef.current) clearInterval(timerRef.current);
      disconnectSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizSession?.id, auth?.user?.id]);

  const toggleAnswer = useCallback((id: string) => {
    if (submitted || phase !== "ACTIVE") return;
    if (currentQuestion?.type === "SINGLE") setSelectedIds([id]);
    else setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, [submitted, phase, currentQuestion?.type]);

  const submitAnswer = useCallback(() => {
    if (!quizSession || !currentQuestion || !auth?.user || submitted || selectedIds.length === 0) return;
    setSubmitted(true);
    const timeTaken = currentQuestion.timeLimit - timeLeft;
    setAnswerTimes(prev => [...prev, timeTaken]);
    getSocket().emit("submit-answer", {
      sessionId: quizSession.id, questionId: currentQuestion.id,
      answerIds: selectedIds, userId: auth.user.id,
    });
  }, [quizSession, currentQuestion, auth, submitted, selectedIds, timeLeft]);

  useEffect(() => {
    if (currentQuestion?.type === "SINGLE" && selectedIds.length === 1 && !submitted) submitAnswer();
  }, [selectedIds, currentQuestion?.type, submitted, submitAnswer]);

  // ── Loading / Error ──
  if (phase === "LOADING" || !quiz) {
    return (
      <div style={{ minHeight: "100vh", background: "#19191A", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, fontFamily: "Inter, sans-serif" }}>
        {error ? (
          <>
            <p style={{ color: "#E64646", fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</p>
            <Link href="/dashboard" style={{ color: "#0077FF", fontSize: 14, textDecoration: "none" }}>← На главную</Link>
          </>
        ) : (
          <p style={{ color: "#909499", margin: 0 }}>Подключаемся к комнате…</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#19191A", fontFamily: "Inter, sans-serif", color: "#E7E8EA", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{ height: 56, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #363738", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(180deg,#0077FF,#005CC4)",  display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="11" viewBox="8 11 20 14" fill="none">
              <path d="M10.5825 18H13.0552L14.7036 13.055L18 22.946L19.649 18H25.418" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>Pulse</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: "#76787A" }}>Комната</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16, padding: "4px 10px", borderRadius: 6, background: "#2C2D2E", letterSpacing: "0.06em" }}>
            {quizSession!.roomCode}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 5px", borderRadius: 999, background: "#2C2D2E", border: "1px solid #363738" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg(myName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
              {initials(myName)}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{myName}</span>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ══ WAITING ══ */}
        {phase === "WAITING" && (
          <>
            <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,119,255,0.25) 0%,transparent 60%)", top: "calc(40% - 250px)", left: "calc(30% - 250px)", filter: "blur(40px)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(75,179,75,0.15) 0%,transparent 60%)", top: "calc(60% - 200px)", left: "calc(70% - 200px)", filter: "blur(40px)", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
              <div style={{ textAlign: "center", maxWidth: 560 }}>

                <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 32px" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(135deg,#0077FF,#005CC4)", opacity: 0.3, filter: "blur(20px)" }} />
                  <div style={{ position: "absolute", inset: 16, borderRadius: "50%", background: avatarBg(myName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800, color: "white", boxShadow: "0 20px 60px rgba(0,119,255,0.4)" }}>
                    {initials(myName)}
                  </div>
                  <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid rgba(0,119,255,0.3)" }} />
                  <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: "1px solid rgba(0,119,255,0.15)" }} />
                </div>

                <div style={{ fontSize: 14, color: "#76787A", textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>Вы в комнате</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>{myName}</div>

                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 22px", background: "#232324", border: "1px solid #363738", borderRadius: 999, marginBottom: 28 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 0.6, 0.3].map((op, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#0077FF", opacity: op }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 15, color: "#909499" }}>Ждём, пока {quiz.hostName} начнёт квиз…</span>
                </div>

                <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{quiz.title}</div>
                <div style={{ fontSize: 14, color: "#76787A", marginBottom: 32 }}>
                  {quiz.questions.length} вопросов · ведущий: {quiz.hostName}
                </div>

                {(() => {
                  const others = players.filter(p => p.userId !== myId);
                  return (
                  <>
                    <div style={{ fontSize: 12, color: "#76787A", marginBottom: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                      {others.length} {others.length === 1 ? "другой игрок" : others.length <= 4 ? "игрока" : "игроков"} в комнате
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", maxWidth: 380, margin: "0 auto", minHeight: 34 }}>
                      {others.slice(0, 12).map((p, i) => (
                        <div key={p.userId} style={{ width: 32, height: 32, borderRadius: "50%", background: avatarBg(p.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, marginLeft: i === 0 ? 0 : -8, border: "2px solid #19191A", flexShrink: 0 }}>
                          {initials(p.name)}
                        </div>
                      ))}
                      {others.length > 12 && (
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2C2D2E", color: "#909499", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, marginLeft: -8, border: "2px solid #19191A", flexShrink: 0 }}>
                          +{others.length - 12}
                        </div>
                      )}
                    </div>
                  </>
                  );
                })()}
              </div>
            </div>
          </>
        )}

        {/* ══ ACTIVE ══ */}
        {phase === "ACTIVE" && currentQuestion && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 56px 36px" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "rgba(0,119,255,0.15)", border: "1px solid rgba(0,119,255,0.3)", fontSize: 13, fontWeight: 600, color: "#71AAEB" }}>
                Вопрос {qIdx + 1} / {quiz.questions.length}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#76787A" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFA000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                {currentQuestion.points.toLocaleString()} очков · {currentQuestion.type === "SINGLE" ? "один ответ" : "несколько ответов"}
              </div>
            </div>

            {/* Timer bar */}
            {(() => {
              const pct = (timeLeft / currentQuestion.timeLimit) * 100;
              const timerColor = pct > 50 ? "#4BB34B" : pct > 20 ? "#FFA000" : "#E64646";
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
                  <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${timerColor}aa, ${timerColor})`,
                      borderRadius: 5,
                      boxShadow: `0 0 20px ${timerColor}80`,
                      transition: "width 0.25s linear",
                    }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, minWidth: 32, textAlign: "right", flexShrink: 0, color: timerColor }}>
                    {timeLeft}
                  </span>
                </div>
              );
            })()}

            {/* Question card */}
            <div style={{ background: "#232324", border: "1px solid #363738", borderRadius: 16, padding: "36px 44px", textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                {currentQuestion.text}
              </div>
            </div>

            {/* Answer tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, alignContent: "start" }}>
              {currentQuestion.answers.map((ans, ai) => {
                const sel = selectedIds.includes(ans.id);
                return (
                  <div key={ans.id} onClick={() => toggleAnswer(ans.id)} style={{
                    position: "relative", overflow: "hidden",
                    borderRadius: 12, minHeight: 80,
                    padding: "22px 22px 22px 78px",
                    display: "flex", alignItems: "center",
                    fontSize: 18, fontWeight: 600, color: "white",
                    cursor: submitted ? "default" : "pointer",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: ANS_GRADIENTS[ai % 4],
                    boxShadow: sel ? "0 0 0 3px white, 0 0 30px rgba(255,255,255,0.3)" : "none",
                    transform: sel ? "translateY(-2px)" : "none",
                    filter: submitted && !sel ? "grayscale(0.5) brightness(0.6)" : "none",
                    transition: "box-shadow 0.15s, transform 0.15s, filter 0.15s",
                  }}>
                    <div style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                      {String.fromCharCode(65 + ai)}
                    </div>
                    <span>{ans.text}</span>
                    {sel && submitted && (
                      <div style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "white", color: "#0077FF", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap" as const }}>
                        ОТВЕТ ЗАФИКСИРОВАН
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {currentQuestion.type === "MULTIPLE" && !submitted && selectedIds.length > 0 && (
              <button onClick={submitAnswer} style={{ marginTop: 16, height: 52, borderRadius: 10, border: "none", background: "linear-gradient(180deg,#0077FF,#005CC4)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(0,119,255,0.35)" }}>
                Отправить ответ
              </button>
            )}
            {submitted && (
              <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#76787A" }}>
                Ответ зафиксирован. Ждём конца раунда…
              </div>
            )}
          </div>
        )}

        {/* ══ REVEAL ══ */}
        {phase === "REVEAL" && currentQuestion && (
          <>
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 640 }}>

                <div style={{
                  width: 120, height: 120, borderRadius: "50%",
                  background: isCorrect
                    ? "linear-gradient(135deg,#4BB34B,#2E8B2E)"
                    : isPartial
                      ? "linear-gradient(135deg,#FFA000,#E67600)"
                      : "linear-gradient(135deg,#E64646,#C03030)",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
                }}>
                  {isCorrect ? (
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : isPartial ? (
                    /* half-check: one tick arm only */
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                      <line x1="4" y1="6" x2="8" y2="10"/>
                    </svg>
                  ) : (
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  )}
                </div>

                <div style={{
                  fontSize: 14,
                  color: isCorrect ? "#4BB34B" : isPartial ? "#FFA000" : "#E64646",
                  textTransform: "uppercase" as const, letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8,
                }}>
                  {selectedIds.length === 0
                    ? "Время вышло!"
                    : isCorrect
                      ? "Правильно!"
                      : isPartial
                        ? "Частично верно!"
                        : "Неверно!"}
                </div>

                {(isCorrect || isPartial) && (
                  <>
                    <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 8 }}>
                      <span style={{
                        background: isCorrect
                          ? "linear-gradient(135deg,#4BB34B,#0077FF)"
                          : "linear-gradient(135deg,#FFA000,#E67600)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                      }}>
                        +{roundPoints.toLocaleString()} очков
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: "#909499", marginBottom: 28 }}>
                      {isPartial
                        ? `Верных: ${correctlySelectedCount}/${correctIds.length}${wronglySelectedCount > 0 ? ` · Лишних: ${wronglySelectedCount}` : ""}`
                        : quiz.scoring === "speed"
                          ? `С бонусом за скорость · из ${currentQuestion.points.toLocaleString()}`
                          : quiz.scoring === "streak"
                            ? `С множителем серии · базовые ${currentQuestion.points.toLocaleString()}`
                            : `Базовые ${currentQuestion.points.toLocaleString()} очков`}
                    </div>
                  </>
                )}
                {!isCorrect && !isPartial && (
                  <div style={{ fontSize: 14, color: "#76787A", marginBottom: 28 }}>
                    {selectedIds.length === 0 ? "Не успели ответить вовремя" : "В следующий раз повезёт!"}
                  </div>
                )}

                {myRank > 0 && players.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 28px", background: "#232324", border: "1px solid #363738", borderRadius: 16, marginBottom: 24 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: myRank <= 3 ? "linear-gradient(135deg,#FFA000,#E64646)" : "#2C2D2E", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 26, fontWeight: 800, flexShrink: 0 }}>
                      {myRank}
                    </div>
                    <div style={{ textAlign: "left" as const }}>
                      <div style={{ fontSize: 12, color: "#76787A", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontWeight: 600 }}>Текущее место</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>
                        {myRank} <span style={{ color: "#76787A", fontWeight: 400 }}>/ {players.length}</span>
                      </div>
                    </div>
                    <div style={{ width: 1, height: 40, background: "#363738", margin: "0 8px" }} />
                    <div style={{ textAlign: "left" as const }}>
                      <div style={{ fontSize: 12, color: "#76787A", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontWeight: 600 }}>Общий счёт</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{myScore.toLocaleString()}</div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#2C2D2E", borderRadius: 999, fontSize: 14, color: "#909499" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 0.7, 0.4].map((op, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#76787A", opacity: op }} />)}
                  </div>
                  Следующий вопрос скоро…
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ FINISHED ══ */}
        {phase === "FINISHED" && (
          <>
            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
              <div style={{ textAlign: "center" }}>

                <div style={{ width: 120, height: 120, borderRadius: 28, background: "linear-gradient(135deg,#FFA000,#E64646)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", transform: "rotate(-4deg)" }}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>
                </div>

                <div style={{ fontSize: 13, color: "#FFA000", textTransform: "uppercase" as const, letterSpacing: "0.12em", fontWeight: 700, marginBottom: 10 }}>
                  Квиз завершён · отличная игра
                </div>
                <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 10 }}>
                  {myRank > 0 ? myRank : "—"}
                  <span style={{ color: "#76787A", fontWeight: 400, fontSize: 36 }}> / {players.length}</span>
                </div>
                {(() => {
                  const topPct = myRank > 0 && players.length > 0
                    ? Math.ceil(myRank / players.length * 100) : null;
                  const avgTime = answerTimes.length > 0
                    ? (answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length).toFixed(1) : "—";
                  const bestTime = answerTimes.length > 0
                    ? Math.min(...answerTimes).toFixed(1) : "—";
                  // The third stat depends on the quiz's scoring system: fastest
                  // answer for the speed bonus, longest correct streak otherwise.
                  const thirdStat = quiz.scoring === "speed"
                    ? { label: "Лучшее время", value: bestTime === "—" ? "—" : `${bestTime} с`, color: "#FFA000" }
                    : { label: "Лучшая серия", value: String(bestStreak), color: "#FFA000" };
                  const stats = [
                    { label: "Правильно", value: `${correctCount} / ${quiz.questions.length}`, color: "#4BB34B" },
                    { label: "Среднее время", value: avgTime === "—" ? "—" : `${avgTime} с`, color: "#E7E8EA" },
                    thirdStat,
                  ];
                  return (
                    <>
                      <div style={{ fontSize: 17, color: "#909499", marginBottom: 32 }}>
                        Вы набрали{" "}
                        <span style={{ color: "#E7E8EA", fontWeight: 700 }}>{myScore.toLocaleString()} очков</span>
                        {topPct !== null && (
                          <span style={{ color: "#76787A" }}> — топ {topPct}%</span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 12, marginBottom: 36, justifyContent: "center" }}>
                        {stats.map(({ label, value, color }) => (
                          <div key={label} style={{ minWidth: 120, padding: "14px 18px", background: "#232324", border: "1px solid #363738", borderRadius: 12 }}>
                            <div style={{ fontSize: 10, color: "#76787A", textTransform: "uppercase" as const, letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>{label}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    onClick={() => quizSession && router.push(`/results/${quizSession.id}`)}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 52, padding: "0 28px", borderRadius: 10, border: "1px solid #363738", background: "#2C2D2E", color: "#E7E8EA", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    Таблица результатов
                  </button>
                  <button
                    onClick={() => router.push("/dashboard")}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, padding: "0 28px", borderRadius: 10, border: "none", background: "linear-gradient(180deg,#0077FF,#005CC4)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    Сыграть ещё
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

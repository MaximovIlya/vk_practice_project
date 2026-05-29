"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { Player, AnswerVotes } from "@/types/socket";

type Answer = { id: string; text: string; isCorrect: boolean };
type Question = { id: string; text: string; type: string; timeLimit: number; points: number; answers: Answer[]; order: number };
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

const AVATAR_COLORS = ["#6C63FF","#FF6584","#43D98F","#FFB547","#4DC4FF","#F97316","#14B8A6","#A78BFA"];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function RunQuizPage() {
  const params   = useParams<{ id: string }>();
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQuestion: Question | null = quiz?.questions[qIdx] ?? null;

  // Load quiz + create/get session
  useEffect(() => {
    if (!params.id) return;
    Promise.all([
      fetch(`/api/quiz/${params.id}`).then((r) => r.json()),
      fetch(`/api/quiz/${params.id}/session`).then((r) => r.json()),
    ]).then(([quizData, sessionData]) => {
      setQuiz(quizData);
      if (sessionData && sessionData.id) {
        setQuizSession(sessionData);
        setPlayers(sessionData.players?.map((sp: { user: { id: string; name: string }; score: number; id: string }) => ({
          userId: sp.user.id, name: sp.user.name, score: sp.score, sessionPlayerId: sp.id,
        })) ?? []);
      } else {
        // Create new session
        fetch(`/api/quiz/${params.id}/session`, { method: "POST" })
          .then((r) => r.json())
          .then((s) => setQuizSession(s));
      }
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

    if (socket.connected) {
      joinAsOrganizer();
    } else {
      socket.once("connect", joinAsOrganizer);
    }

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
    socket.on("question-ended", ({ correctAnswerIds, votes: v }) => {
      setPhase("REVEAL");
      setCorrectIds(correctAnswerIds);
      setVotes(v);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    });
    socket.on("score-update", (p) => setPlayers(p));
    socket.on("quiz-finished", (p) => { setPlayers(p); setPhase("FINISHED"); });

    return () => {
      socket.off("player-joined"); socket.off("player-left");
      socket.off("quiz-started"); socket.off("question-started");
      socket.off("answer-received"); socket.off("question-ended");
      socket.off("score-update"); socket.off("quiz-finished");
      if (timerRef.current) clearInterval(timerRef.current);
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
      <div style={{ minHeight: "100vh", background: "#0F0E17", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#A7A9BE", fontFamily: "Inter, sans-serif" }}>Setting up room…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F0E17", fontFamily: "Inter, sans-serif", color: "#E8E8F0", display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ── */}
      <header style={{
        flexShrink: 0, height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px",
        borderBottom: "1px solid #2E2E4A",
        position: "relative", zIndex: 5,
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6C63FF,#FF6584)", boxShadow: "0 4px 20px rgba(108,99,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="11" viewBox="8 11 20 14" fill="none">
              <path d="M10.5825 18H13.0552L14.7036 13.055L18 22.946L19.649 18H25.418" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {(phase === "ACTIVE" || phase === "REVEAL") ? (
            <>
              <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)", fontSize: 13, fontWeight: 600, color: "#B9B3FF", fontVariantNumeric: "tabular-nums" }}>
                Q {qIdx + 1} / {quiz.questions.length}
              </div>
              <span style={{ fontSize: 14, color: "#A7A9BE" }}>{quiz.title}</span>
            </>
          ) : (
            <>
              <div style={{ width: 1, height: 20, background: "#2E2E4A" }} />
              <span style={{ fontSize: 14, color: "#A7A9BE" }}>
                Hosting · <span style={{ color: "#E8E8F0", fontWeight: 500 }}>{quiz.title}</span>
              </span>
            </>
          )}
        </div>

        {/* Right */}
        {phase === "ACTIVE" && (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#A7A9BE" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{totalAnswered} / {players.length} answered</span>
            </div>
            <button onClick={endQuestion} style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "1px solid #3D3D5F", background: "#24243E", color: "#A7A9BE", fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>End early</button>
            <button onClick={endQuestion} style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", borderRadius: 6, border: "none", background: "linear-gradient(180deg,#6C63FF,#4B44CC)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 12px rgba(108,99,255,0.35)" }}>
              Skip <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        )}
        {phase === "REVEAL" && (
          <button onClick={nextQuestion} style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", borderRadius: 6, border: "none", background: "linear-gradient(180deg,#6C63FF,#4B44CC)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 12px rgba(108,99,255,0.35)" }}>
            {qIdx + 1 < quiz.questions.length ? "Next question" : "Finish"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        )}
        {phase === "WAITING" && (
          <button onClick={() => window.location.href = "/dashboard"} style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "none", background: "transparent", color: "#A7A9BE", fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            End session
          </button>
        )}
      </header>

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
              <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,99,255,0.3) 0%, transparent 60%)", top: "calc(30% - 300px)", left: "calc(30% - 300px)", pointerEvents: "none", filter: "blur(40px)" }} />
              <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,101,132,0.2) 0%, transparent 60%)", top: "calc(70% - 250px)", left: "calc(70% - 250px)", pointerEvents: "none", filter: "blur(40px)" }} />

              <div style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                {/* Room live badge */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(67,217,143,0.12)", border: "1px solid rgba(67,217,143,0.3)", marginBottom: 16 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#43D98F", display: "inline-block", boxShadow: "0 0 8px #43D98F" }} />
                  <span style={{ color: "#43D98F", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Room live</span>
                </div>

                {/* Join at */}
                <div style={{ fontSize: 22, color: "#A7A9BE", marginBottom: 12 }}>
                  Join at <span style={{ color: "#E8E8F0", fontWeight: 600 }}>pulse.app/join</span>
                </div>

                {/* Room code card */}
                <div style={{
                  display: "inline-flex", gap: 14,
                  padding: "22px 28px",
                  background: "rgba(26,26,46,0.7)",
                  border: "1px solid #2E2E4A",
                  borderRadius: 24,
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 4px rgba(108,99,255,0.1)",
                  marginBottom: 32,
                }}>
                  {quizSession.roomCode.split("").map((ch, i) => (
                    <div key={i} style={{
                      width: 88, height: 110,
                      background: "linear-gradient(180deg,#1A1A2E 0%,#07060F 100%)",
                      border: "1px solid #3D3D5F",
                      borderRadius: 14,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 64, fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "#E8E8F0",
                    }}>{ch}</div>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 36 }}>
                  <button onClick={copyCode} style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #3D3D5F", background: "#24243E", color: "#E8E8F0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M9 4.5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    {copied ? "Copied!" : "Copy code"}
                  </button>
                  <button style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #3D3D5F", background: "#24243E", color: "#E8E8F0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
                    Show QR
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
                      ? "linear-gradient(180deg,#6C63FF 0%,#4B44CC 100%)"
                      : "#24243E",
                    boxShadow: players.length > 0
                      ? "0 4px 16px rgba(108,99,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)"
                      : "inset 0 0 0 1px #3D3D5F",
                    color: players.length > 0 ? "#fff" : "#6E708A",
                    fontSize: 18, fontWeight: 600,
                    cursor: players.length > 0 ? "pointer" : "not-allowed",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Start quiz ({players.length} {players.length === 1 ? "player" : "players"})
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6E708A", fontSize: 13, marginTop: 10 }}>
                  Press{" "}
                  <kbd style={{ background: "#24243E", padding: "2px 7px", borderRadius: 4, fontSize: 11, border: "1px solid #2E2E4A", fontFamily: "monospace" }}>Space</kbd>
                  {" "}to start
                </div>
              </div>
            </div>

            {/* Right: players list */}
            <div style={{ borderLeft: "1px solid #2E2E4A", background: "#07060F", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Panel header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #2E2E4A", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E8F0" }}>Players</div>
                  <div style={{ fontSize: 12, color: "#6E708A", marginTop: 2 }}>
                    {players.length} joined
                    {players.length > 0 && <span style={{ color: "#43D98F" }}> · {players.length <= 2 ? players.length : 2} just now</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#43D98F", boxShadow: "0 0 8px #43D98F" }} />
                  <span style={{ fontSize: 12, color: "#43D98F", fontWeight: 500 }}>live</span>
                </div>
              </div>

              {/* Player rows */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 6 }}>
                {players.length === 0 && (
                  <p style={{ color: "#6E708A", fontSize: 13, margin: 0 }}>Waiting for players…</p>
                )}
                {players.map((p, i) => {
                  const isNew = i >= players.length - 2;
                  return (
                    <div key={p.userId} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", borderRadius: 8,
                      background: isNew ? "rgba(67,217,143,0.08)" : "#1A1A2E",
                      border: `1px solid ${isNew ? "rgba(67,217,143,0.3)" : "#2E2E4A"}`,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: avatarColor(p.name),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff",
                      }}>
                        {initials(p.name)}
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#E8E8F0" }}>{p.name}</span>
                      {isNew && <span style={{ fontSize: 11, color: "#43D98F", fontWeight: 600 }}>just joined</span>}
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
          const timerColor = pct > 50 ? "#43D98F" : pct > 20 ? "#FFB547" : "#FF6584";

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
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#43D98F", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 12 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Correct answer revealed
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#6E708A", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 12 }}>
                      {currentQuestion.type === "SINGLE" ? "Single choice" : "Multiple choice"} · {currentQuestion.points.toLocaleString()} pts
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 800 }}>
                      {currentQuestion.text}
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
                          boxShadow: isReveal && isCorrect ? "0 0 0 3px #43D98F, 0 0 40px rgba(67,217,143,0.5)" : "none",
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
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#43D98F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
                <div style={{ background: "#1A1A2E", border: "1px solid #2E2E4A", borderRadius: 16, boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)", padding: 20, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Live standings</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(67,217,143,0.12)", border: "1px solid rgba(67,217,143,0.3)", fontSize: 12, fontWeight: 600, color: "#43D98F" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#43D98F", display: "inline-block" }} />
                      live
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {players.slice(0, 10).map((p, i) => (
                      <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #2E2E4A" }}>
                        <span style={{ width: 22, fontSize: 13, fontWeight: 700, color: i < 3 ? "#FFB547" : "#6E708A", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarColor(p.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {initials(p.name)}
                        </div>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{p.score.toLocaleString()}</span>
                      </div>
                    ))}
                    {players.length === 0 && <p style={{ color: "#6E708A", fontSize: 13 }}>No players yet</p>}
                  </div>
                  <div style={{ paddingTop: 12, fontSize: 12, color: "#6E708A", textAlign: "center", flexShrink: 0 }}>Updates after every question</div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ══ FINISHED ══ */}
        {phase === "FINISHED" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 24 }}>
            <div style={{ fontSize: 32, fontWeight: 800 }}>Quiz finished! 🎉</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 400 }}>
              {players.slice(0, 10).map((p, i) => (
                <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "#1A1A2E", border: `1px solid ${i === 0 ? "rgba(255,181,71,0.4)" : "#2E2E4A"}` }}>
                  <span style={{ width: 24, fontSize: 14, fontWeight: 700, color: i < 3 ? "#FFB547" : "#6E708A" }}>#{i + 1}</span>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColor(p.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {initials(p.name)}
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#E8E8F0" }}>{p.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? "#FFB547" : "#E8E8F0" }}>{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <Link href="/dashboard" style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(180deg,#6C63FF,#4B44CC)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              Back to Dashboard
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

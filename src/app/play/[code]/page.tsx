"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { AnswerVotes } from "@/types/socket";

type Answer      = { id: string; text: string };
type Question    = { id: string; text: string; type: string; timeLimit: number; points: number; answers: Answer[] };
type QuizData    = { id: string; title: string; hostName: string; questions: Question[] };
type SessionData = { id: string; roomCode: string; status: string };
type Phase       = "LOADING" | "WAITING" | "ACTIVE" | "REVEAL" | "FINISHED";

const ANS_GRADIENTS = [
  "linear-gradient(135deg,#FF6584 0%,#E54170 100%)",
  "linear-gradient(135deg,#4DC4FF 0%,#2B7FE0 100%)",
  "linear-gradient(135deg,#FFB547 0%,#E08512 100%)",
  "linear-gradient(135deg,#43D98F 0%,#1FA269 100%)",
];
const ANS_LETTERS = ["A", "B", "C", "D"];

const AVATAR_PALETTE = ["#6C63FF","#FF6584","#43D98F","#FFB547","#4DC4FF","#F97316","#14B8A6","#A78BFA"];
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

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinedRef     = useRef(false);
  const selectedRef   = useRef<string[]>([]);

  // Keep ref in sync with state (for use inside stale socket closures)
  useEffect(() => { selectedRef.current = selectedIds; }, [selectedIds]);

  const myId    = auth?.user?.id;
  const myName  = auth?.user?.name ?? "You";
  const myScore = players.find(p => p.userId === myId)?.score ?? 0;
  const myRank  = (() => { const i = players.findIndex(p => p.userId === myId); return i >= 0 ? i + 1 : 0; })();

  const currentQuestion: Question | null = quiz?.questions[qIdx] ?? null;

  const isCorrect = correctIds.length > 0 && selectedRef.current.length > 0 &&
    selectedRef.current.every(id => correctIds.includes(id)) &&
    correctIds.every(id => selectedRef.current.includes(id));

  // Load session
  useEffect(() => {
    if (!params.code) return;
    fetch(`/api/play/${params.code}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setQuizSession(data.session);
        setQuiz(data.quiz);
        setPhase(data.session.status === "FINISHED" ? "FINISHED" : "WAITING");
      })
      .catch(() => setError("Could not connect to room"));
  }, [params.code]);

  // Socket
  useEffect(() => {
    if (!quizSession || !auth?.user || joinedRef.current || phase === "LOADING") return;
    joinedRef.current = true;
    const socket = getSocket();
    const userId = auth.user.id;
    const name   = auth.user.name ?? "Anonymous";

    socket.emit("join-room", { roomCode: quizSession.roomCode, userId, name });

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
      setVotes({}); setCorrectIds([]); setPhase("ACTIVE");
    });

    socket.on("question-started", ({ questionIndex, endsAt }) => {
      setQIdx(questionIndex); setSelectedIds([]); setSubmitted(false);
      setVotes({}); setCorrectIds([]); setPhase("ACTIVE");
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

    socket.on("question-ended", ({ correctAnswerIds, votes: v }) => {
      setPhase("REVEAL");
      setCorrectIds(correctAnswerIds);
      setVotes(v);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    });

    socket.on("score-update", p =>
      setPlayers(p.map(pl => ({ userId: pl.userId, name: pl.name, score: pl.score })))
    );
    socket.on("quiz-finished", p => {
      setPlayers(p.map(pl => ({ userId: pl.userId, name: pl.name, score: pl.score })));
      setPhase("FINISHED");
    });

    return () => {
      socket.off("error"); socket.off("player-joined"); socket.off("player-left");
      socket.off("quiz-started"); socket.off("question-started");
      socket.off("answer-received"); socket.off("question-ended");
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
    getSocket().emit("submit-answer", {
      sessionId: quizSession.id, questionId: currentQuestion.id,
      answerIds: selectedIds, userId: auth.user.id,
    });
  }, [quizSession, currentQuestion, auth, submitted, selectedIds]);

  // Auto-submit single choice on tap
  useEffect(() => {
    if (currentQuestion?.type === "SINGLE" && selectedIds.length === 1 && !submitted) submitAnswer();
  }, [selectedIds, currentQuestion?.type, submitted, submitAnswer]);

  // ── Loading / Error ──
  if (phase === "LOADING" || !quiz) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0E17", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, fontFamily: "Inter, sans-serif" }}>
        {error ? (
          <>
            <p style={{ color: "#FC6C85", fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</p>
            <Link href="/dashboard" style={{ color: "#6C63FF", fontSize: 14, textDecoration: "none" }}>← Back to dashboard</Link>
          </>
        ) : (
          <p style={{ color: "#A7A9BE", margin: 0 }}>Connecting to room…</p>
        )}
      </div>
    );
  }

  // ── Shell ──
  return (
    <div style={{ minHeight: "100vh", background: "#0F0E17", fontFamily: "Inter, sans-serif", color: "#E8E8F0", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{ height: 56, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #2E2E4A", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6C63FF,#FF6584)", boxShadow: "0 4px 20px rgba(108,99,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="11" viewBox="8 11 20 14" fill="none">
              <path d="M10.5825 18H13.0552L14.7036 13.055L18 22.946L19.649 18H25.418" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>Pulse</span>
        </div>
        {/* Room + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: "#6E708A" }}>Room</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16, padding: "4px 10px", borderRadius: 6, background: "#24243E", letterSpacing: "0.06em" }}>
            {quizSession!.roomCode}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 5px", borderRadius: 999, background: "#24243E", border: "1px solid #2E2E4A" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg(myName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
              {initials(myName)}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{myName}</span>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* ══ WAITING ══ */}
        {phase === "WAITING" && (
          <>
            <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(108,99,255,0.35) 0%,transparent 60%)", top: "calc(40% - 250px)", left: "calc(30% - 250px)", filter: "blur(40px)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,101,132,0.25) 0%,transparent 60%)", top: "calc(60% - 200px)", left: "calc(70% - 200px)", filter: "blur(40px)", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, height: "100%", display: "grid", placeItems: "center", padding: 48 }}>
              <div style={{ textAlign: "center", maxWidth: 560 }}>

                {/* Avatar with pulse rings */}
                <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 32px" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#FF6584)", opacity: 0.3, filter: "blur(20px)" }} />
                  <div style={{ position: "absolute", inset: 16, borderRadius: "50%", background: avatarBg(myName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800, color: "white", boxShadow: "0 20px 60px rgba(108,99,255,0.4)" }}>
                    {initials(myName)}
                  </div>
                  <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid rgba(108,99,255,0.3)" }} />
                  <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: "1px solid rgba(108,99,255,0.15)" }} />
                </div>

                <div style={{ fontSize: 14, color: "#6E708A", textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 }}>You&apos;re in</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>{myName}</div>

                {/* Waiting pill */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 22px", background: "#1A1A2E", border: "1px solid #2E2E4A", borderRadius: 999, marginBottom: 28 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 0.6, 0.3].map((op, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#6C63FF", opacity: op }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 15, color: "#A7A9BE" }}>Waiting for {quiz.hostName} to start the quiz…</span>
                </div>

                <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{quiz.title}</div>
                <div style={{ fontSize: 14, color: "#6E708A", marginBottom: 32 }}>
                  {quiz.questions.length} questions · hosted by {quiz.hostName}
                </div>

                {/* Stacked avatars */}
                {(() => {
                  const others = players.filter(p => p.userId !== myId);
                  return (
                  <>
                    <div style={{ fontSize: 12, color: "#6E708A", marginBottom: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                      {others.length} {others.length === 1 ? "other" : "others"} in the room
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", maxWidth: 380, margin: "0 auto", minHeight: 34 }}>
                      {others.slice(0, 12).map((p, i) => (
                        <div key={p.userId} style={{ width: 32, height: 32, borderRadius: "50%", background: avatarBg(p.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, marginLeft: i === 0 ? 0 : -8, border: "2px solid #0F0E17", flexShrink: 0 }}>
                          {initials(p.name)}
                        </div>
                      ))}
                      {others.length > 12 && (
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#24243E", color: "#A7A9BE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, marginLeft: -8, border: "2px solid #0F0E17", flexShrink: 0 }}>
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
          <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "24px 56px 36px" }}>

            {/* Q meta row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)", fontSize: 13, fontWeight: 600, color: "#B9B3FF" }}>
                Question {qIdx + 1} / {quiz.questions.length}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6E708A" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB547" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                {currentQuestion.points.toLocaleString()} pts · {currentQuestion.type === "SINGLE" ? "single choice" : "multiple choice"}
              </div>
            </div>

            {/* Timer bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 800, width: 40, textAlign: "right", flexShrink: 0, color: timeLeft <= 5 ? "#FC6C85" : "#E8E8F0" }}>
                {timeLeft}
              </span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#1A1A2E", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  background: timeLeft <= 5 ? "linear-gradient(90deg,#FC6C85,#E54170)" : "linear-gradient(90deg,#6C63FF,#4DC4FF)",
                  width: `${(timeLeft / currentQuestion.timeLimit) * 100}%`,
                  transition: "width 0.25s linear, background 0.3s",
                }} />
              </div>
            </div>

            {/* Question card */}
            <div style={{ background: "#1A1A2E", border: "1px solid #2E2E4A", borderRadius: 16, padding: "36px 44px", textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
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
                      {ANS_LETTERS[ai % 4]}
                    </div>
                    <span>{ans.text}</span>
                    {sel && submitted && (
                      <div style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "white", color: "#6C63FF", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap" as const }}>
                        LOCKED IN
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Multiple choice submit */}
            {currentQuestion.type === "MULTIPLE" && !submitted && selectedIds.length > 0 && (
              <button onClick={submitAnswer} style={{ marginTop: 16, height: 52, borderRadius: 10, border: "none", background: "linear-gradient(180deg,#6C63FF,#4B44CC)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(108,99,255,0.35)" }}>
                Submit answer
              </button>
            )}
            {submitted && (
              <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#6E708A" }}>
                Answer locked. Waiting for round to end…
              </div>
            )}
          </div>
        )}

        {/* ══ REVEAL ══ */}
        {phase === "REVEAL" && currentQuestion && (
          <>
            <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle,${isCorrect ? "rgba(67,217,143,0.25)" : "rgba(252,108,133,0.2)"} 0%,transparent 60%)`, top: "calc(40% - 300px)", left: "calc(50% - 300px)", filter: "blur(40px)", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, height: "100%", display: "grid", placeItems: "center", padding: 48 }}>
              <div style={{ textAlign: "center", maxWidth: 640 }}>

                {/* Result circle */}
                <div style={{ width: 120, height: 120, borderRadius: "50%", background: isCorrect ? "linear-gradient(135deg,#43D98F,#1FA269)" : "linear-gradient(135deg,#FC6C85,#E54170)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: isCorrect ? "0 20px 60px rgba(67,217,143,0.4),0 0 0 12px rgba(67,217,143,0.1)" : "0 20px 60px rgba(252,108,133,0.4),0 0 0 12px rgba(252,108,133,0.1)" }}>
                  {isCorrect ? (
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  )}
                </div>

                <div style={{ fontSize: 14, color: isCorrect ? "#43D98F" : "#FC6C85", textTransform: "uppercase" as const, letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>
                  {selectedIds.length === 0 ? "Time's up!" : isCorrect ? "Correct!" : "Wrong!"}
                </div>

                {isCorrect && (
                  <>
                    <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 8 }}>
                      <span style={{ background: "linear-gradient(135deg,#43D98F,#6C63FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                        +{currentQuestion.points.toLocaleString()} pts
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: "#A7A9BE", marginBottom: 28 }}>
                      Base {currentQuestion.points.toLocaleString()} points
                    </div>
                  </>
                )}
                {!isCorrect && <div style={{ fontSize: 14, color: "#6E708A", marginBottom: 28 }}>{selectedIds.length === 0 ? "You didn't answer in time" : "Better luck next time!"}</div>}

                {/* Rank card */}
                {myRank > 0 && players.length > 0 && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "18px 28px", background: "#1A1A2E", border: "1px solid #2E2E4A", borderRadius: 16, marginBottom: 24 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: myRank <= 3 ? "linear-gradient(135deg,#FFB547,#FF6584)" : "#24243E", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 26, fontWeight: 800, flexShrink: 0 }}>
                      {myRank}
                    </div>
                    <div style={{ textAlign: "left" as const }}>
                      <div style={{ fontSize: 12, color: "#6E708A", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontWeight: 600 }}>Current rank</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>
                        {myRank} <span style={{ color: "#6E708A", fontWeight: 400 }}>/ {players.length}</span>
                      </div>
                    </div>
                    <div style={{ width: 1, height: 40, background: "#2E2E4A", margin: "0 8px" }} />
                    <div style={{ textAlign: "left" as const }}>
                      <div style={{ fontSize: 12, color: "#6E708A", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontWeight: 600 }}>Total score</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{myScore.toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {/* Next question hint */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#24243E", borderRadius: 999, fontSize: 14, color: "#A7A9BE" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 0.7, 0.4].map((op, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#6E708A", opacity: op }} />)}
                  </div>
                  Next question in a moment…
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ FINISHED ══ */}
        {phase === "FINISHED" && (
          <>
            <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,181,71,0.3) 0%,transparent 60%)", top: "calc(30% - 300px)", left: "calc(50% - 300px)", filter: "blur(40px)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(108,99,255,0.2) 0%,transparent 60%)", top: "calc(80% - 250px)", left: "calc(50% - 250px)", filter: "blur(40px)", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, height: "100%", display: "grid", placeItems: "center", padding: 48 }}>
              <div style={{ textAlign: "center" }}>

                {/* Trophy */}
                <div style={{ width: 140, height: 140, borderRadius: 32, background: "linear-gradient(135deg,#FFB547,#FF6584)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px", boxShadow: "0 20px 80px rgba(255,181,71,0.4)", transform: "rotate(-6deg)" }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>
                </div>

                <div style={{ fontSize: 14, color: "#FFB547", textTransform: "uppercase" as const, letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>
                  Quiz over · nicely played
                </div>
                <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 12 }}>
                  {myRank > 0 ? myRank : "—"}
                  <span style={{ color: "#6E708A", fontWeight: 400, fontSize: 36 }}> / {players.length}</span>
                </div>
                <div style={{ fontSize: 18, color: "#A7A9BE", marginBottom: 36 }}>
                  You finished with <span style={{ color: "#E8E8F0", fontWeight: 700 }}>{myScore.toLocaleString()} pts</span>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 52, padding: "0 28px", borderRadius: 10, border: "1px solid #3D3D5F", background: "#24243E", color: "#E8E8F0", fontSize: 16, fontWeight: 600, textDecoration: "none" }}>
                    See full leaderboard
                  </Link>
                  <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, padding: "0 28px", borderRadius: 10, border: "none", background: "linear-gradient(180deg,#6C63FF,#4B44CC)", color: "#fff", fontSize: 16, fontWeight: 600, textDecoration: "none", boxShadow: "0 4px 16px rgba(108,99,255,0.35)" }}>
                    Play another
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

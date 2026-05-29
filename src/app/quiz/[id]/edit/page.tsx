"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

type Answer = { id?: string; text: string; isCorrect: boolean };
type Question = {
  id: string;
  text: string;
  type: "SINGLE" | "MULTIPLE";
  imageUrl?: string | null;
  order: number;
  answers: Answer[];
  tags: string[];
  timeLimit: number;
  points: number;
};
type Quiz = {
  id: string;
  title: string;
  category: string;
  timePerQuestion: number;
  pointsPerQuestion: number;
  questions: Question[];
};

const ANS_BG = ["#4DC4FF", "#FFB547", "#43D98F", "#FC6C85"];

export default function EditQuestionsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedSec, setSavedSec] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/quiz/${params.id}`)
      .then((r) => r.json())
      .then((data) => { setQuiz(data); setLoading(false); });
  }, [params.id]);

  // tick saved-seconds counter
  useEffect(() => {
    tickRef.current = setInterval(() => setSavedSec((s) => (s === null ? null : s + 1)), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const selectedQuestion: Question | null = quiz?.questions[selectedIdx] ?? null;

  const autoSave = useCallback((q: Question) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      await fetch(`/api/quiz/${params.id}/questions/${q.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q.text, type: q.type, imageUrl: q.imageUrl, answers: q.answers, tags: q.tags, timeLimit: q.timeLimit, points: q.points }),
      });
      setSaving(false);
      setSavedSec(0);
    }, 800);
  }, [params.id]);

  function updateQuestion(patch: Partial<Question>) {
    if (!quiz || !selectedQuestion) return;
    const updated: Question = { ...selectedQuestion, ...patch };
    const questions = quiz.questions.map((q, i) => (i === selectedIdx ? updated : q));
    setQuiz({ ...quiz, questions });
    autoSave(updated);
  }

  function updateAnswer(idx: number, patch: Partial<Answer>) {
    if (!selectedQuestion) return;
    let answers = selectedQuestion.answers.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    if (selectedQuestion.type === "SINGLE" && patch.isCorrect) {
      answers = answers.map((a, i) => ({ ...a, isCorrect: i === idx }));
    }
    updateQuestion({ answers });
  }

  function addAnswer() {
    if (!selectedQuestion) return;
    updateQuestion({ answers: [...selectedQuestion.answers, { text: "", isCorrect: false }] });
  }

  function removeAnswer(idx: number) {
    if (!selectedQuestion) return;
    updateQuestion({ answers: selectedQuestion.answers.filter((_, i) => i !== idx) });
  }

  async function addQuestion() {
    if (!quiz) return;
    const res = await fetch(`/api/quiz/${params.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "", type: "SINGLE" }),
    });
    const q: Question = await res.json();
    const newQuestions = [...quiz.questions, { ...q, answers: [], tags: q.tags ?? [], timeLimit: q.timeLimit ?? 30, points: q.points ?? 1000 }];
    setQuiz({ ...quiz, questions: newQuestions });
    setSelectedIdx(newQuestions.length - 1);
  }

  async function deleteQuestion() {
    if (!quiz || !selectedQuestion) return;
    await fetch(`/api/quiz/${params.id}/questions/${selectedQuestion.id}`, { method: "DELETE" });
    const questions = quiz.questions.filter((_, i) => i !== selectedIdx);
    setQuiz({ ...quiz, questions });
    setSelectedIdx(Math.max(0, selectedIdx - 1));
  }

  function savedLabel() {
    if (saving) return "Saving…";
    if (savedSec === null) return "All changes saved";
    if (savedSec < 5) return "Just saved";
    if (savedSec < 60) return `Auto-saved · ${savedSec} s ago`;
    return `Auto-saved · ${Math.round(savedSec / 60)} min ago`;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0E17", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#A7A9BE", fontFamily: "Inter, sans-serif", fontSize: 15 }}>Loading…</span>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0E17", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#FF6584", fontFamily: "Inter, sans-serif", fontSize: 15 }}>Quiz not found.</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", height: "100vh", background: "#0F0E17", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <header style={{
        flexShrink: 0, height: 56,
        display: "flex", alignItems: "center",
        padding: "0 20px",
        background: "rgba(15,14,23,0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #2E2E4A",
        position: "relative",
      }}>
        {/* Left: back button + quiz title */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Link
            href="/dashboard"
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              color: "#A7A9BE", fontSize: 13, textDecoration: "none",
              padding: "5px 8px", borderRadius: 7,
              border: "1px solid transparent",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2E2E4A"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M7 2L3.5 5.5 7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </Link>
          <span style={{ color: "#2E2E4A", fontSize: 16, lineHeight: 1 }}>·</span>
          <input
            value={quiz.title}
            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "#E8E8F0", fontSize: 14, fontWeight: 600,
              fontFamily: "Inter, sans-serif", minWidth: 0, flex: 1, maxWidth: 280,
            }}
            onBlur={() => {
              fetch(`/api/quiz/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: quiz.title }),
              });
            }}
          />
        </div>

        {/* Center: auto-save */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#6E708A", fontSize: 12 }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: saving ? "#FFB547" : (savedSec !== null ? "#43D98F" : "#6E708A"),
              display: "inline-block",
            }} />
            {savedLabel()}
          </span>
        </div>

        {/* Right: action buttons */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8,
            border: "1px solid #2E2E4A", background: "transparent",
            color: "#A7A9BE", fontSize: 13, cursor: "pointer",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Preview
          </button>
          <button
            onClick={() => router.push(`/quiz/${quiz.id}/run`)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 8, border: "none",
              background: "linear-gradient(180deg, #6C63FF 0%, #4B44CC 100%)",
              color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 2l8 4.5L3 11V2z" fill="currentColor" />
            </svg>
            Run quiz
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left: question list (260px) ── */}
        <aside style={{
          width: 260, flexShrink: 0,
          background: "#0D0C1A",
          borderRight: "1px solid #2E2E4A",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Sidebar header */}
          <div style={{
            padding: "14px 14px 10px",
            borderBottom: "1px solid #2E2E4A",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: "#E8E8F0", fontWeight: 600, fontSize: 13 }}>
              Questions{" "}
              <span style={{ color: "#6E708A", fontWeight: 400 }}>· {quiz.questions.length}</span>
            </span>
            <button
              onClick={addQuestion}
              style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid #2E2E4A",
                background: "rgba(108,99,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="#6C63FF" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Question cards */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 0" }}>
            {quiz.questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setSelectedIdx(i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 10px", borderRadius: 8, marginBottom: 2,
                  background: i === selectedIdx ? "rgba(108,99,255,0.12)" : "transparent",
                  border: `1px solid ${i === selectedIdx ? "rgba(108,99,255,0.45)" : "transparent"}`,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                {/* Drag handle */}
                <svg width="12" height="14" viewBox="0 0 12 14" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
                  <circle cx="3" cy="2.5" r="1.2" fill="#A7A9BE" />
                  <circle cx="3" cy="7" r="1.2" fill="#A7A9BE" />
                  <circle cx="3" cy="11.5" r="1.2" fill="#A7A9BE" />
                  <circle cx="9" cy="2.5" r="1.2" fill="#A7A9BE" />
                  <circle cx="9" cy="7" r="1.2" fill="#A7A9BE" />
                  <circle cx="9" cy="11.5" r="1.2" fill="#A7A9BE" />
                </svg>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: i === selectedIdx ? "#6C63FF" : "#6E708A",
                    }}>
                      <span style={{ opacity: 0.6 }}>Q</span>{i + 1}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 600, color: "#6E708A",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>{q.type}</span>
                    {q.answers.length === 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: "#FFB547",
                        background: "rgba(255,181,71,0.1)", borderRadius: 3, padding: "1px 4px",
                      }}>● draft</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 12, color: i === selectedIdx ? "#E8E8F0" : "#A7A9BE",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {q.text || <span style={{ color: "#6E708A", fontStyle: "italic" }}>Empty question…</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Add question — bottom */}
          <div style={{ padding: "10px 8px", borderTop: "1px solid #2E2E4A" }}>
            <button
              onClick={addQuestion}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px", borderRadius: 8,
                border: "1px dashed rgba(108,99,255,0.35)",
                background: "transparent", color: "#6C63FF",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Add question
            </button>
          </div>
        </aside>

        {/* ── Center: editor ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "#0F0E17" }}>
          {!selectedQuestion ? (
            <div style={{ textAlign: "center", color: "#6E708A", fontSize: 14, marginTop: 80 }}>
              Select or add a question to edit.
            </div>
          ) : (
            <div style={{ maxWidth: 640 }}>
              {/* Editor header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: "#6E708A", fontSize: 13 }}>
                    Question {selectedIdx + 1} of {quiz.questions.length}
                  </span>
                  {/* Type toggle */}
                  <div style={{
                    display: "flex", background: "#1A1A2E", borderRadius: 7,
                    border: "1px solid #2E2E4A", padding: 3,
                  }}>
                    {(["SINGLE", "MULTIPLE"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => updateQuestion({ type: t })}
                        style={{
                          padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer",
                          fontSize: 12, fontWeight: 600,
                          background: selectedQuestion.type === t ? "rgba(108,99,255,0.22)" : "transparent",
                          color: selectedQuestion.type === t ? "#6C63FF" : "#6E708A",
                        }}
                      >
                        {t === "SINGLE" ? "Single choice" : "Multiple"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={deleteQuestion}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 7,
                    border: "1px solid rgba(255,101,132,0.25)",
                    background: "rgba(255,101,132,0.07)",
                    color: "#FF6584", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.75 3.50016H12.25M4.66667 3.50016V2.3335H9.33333V3.50016M4.08333 3.50016V11.6668H9.91667V3.50016M5.83333 6.41683V9.91683M8.16667 6.41683V9.91683" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Delete
                </button>
              </div>

              {/* Question text */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#A7A9BE", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Question text
                </label>
                <textarea
                  value={selectedQuestion.text}
                  onChange={(e) => updateQuestion({ text: e.target.value })}
                  placeholder="Type your question here…"
                  rows={3}
                  style={{
                    width: "100%", background: "#1A1A2E",
                    border: "1px solid #2E2E4A", borderRadius: 10,
                    padding: "12px 14px", color: "#E8E8F0",
                    fontSize: 15, fontFamily: "Inter, sans-serif",
                    resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(108,99,255,0.6)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2E2E4A"; }}
                />
              </div>

              {/* Image upload */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", color: "#A7A9BE", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Image <span style={{ color: "#6E708A", fontWeight: 400, textTransform: "none" }}>(optional)</span>
                </label>
                <div style={{
                  border: "1.5px dashed #2E2E4A", borderRadius: 10,
                  padding: "20px", textAlign: "center",
                  background: "rgba(26,26,46,0.4)", cursor: "pointer",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(108,99,255,0.5)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2E2E4A"; }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: "block", margin: "0 auto 6px" }}>
                    <rect x="2" y="5" width="20" height="16" rx="2.5" stroke="#6E708A" strokeWidth="1.4" />
                    <circle cx="8" cy="10.5" r="1.8" stroke="#6E708A" strokeWidth="1.4" />
                    <path d="M2 17l5-4.5 4 3.5 4-3 5 4" stroke="#6E708A" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  <span style={{ color: "#6E708A", fontSize: 12 }}>
                    Drop an image or{" "}
                    <span style={{ color: "#6C63FF", textDecoration: "underline", cursor: "pointer" }}>browse</span>
                  </span>
                </div>
              </div>

              {/* Answer options */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ color: "#A7A9BE", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Answer options{" "}
                    <span style={{ color: "#6E708A", fontWeight: 400, textTransform: "none" }}>
                      · {selectedQuestion.type === "SINGLE" ? "pick one correct" : "pick all correct"}
                    </span>
                  </span>
                  <button
                    onClick={addAnswer}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "5px 10px", borderRadius: 6,
                      border: "1px solid rgba(108,99,255,0.3)",
                      background: "rgba(108,99,255,0.08)",
                      color: "#6C63FF", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    Add answer
                  </button>
                </div>

                {selectedQuestion.answers.length === 0 && (
                  <div style={{ color: "#6E708A", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
                    No answers yet — click "Add answer"
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedQuestion.answers.map((answer, ai) => {
                    const letter = String.fromCharCode(65 + ai);
                    const bg = ANS_BG[ai % ANS_BG.length];
                    return (
                      <div key={ai} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: "#1A1A2E",
                        border: `1px solid ${answer.isCorrect ? "rgba(67,217,143,0.35)" : "#2E2E4A"}`,
                        borderRadius: 10, padding: "9px 10px",
                      }}>
                        {/* Letter badge */}
                        <span style={{
                          flexShrink: 0, width: 24, height: 24, borderRadius: 6,
                          background: bg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700,
                          color: "#fff",
                        }}>
                          {letter}
                        </span>

                        <input
                          value={answer.text}
                          onChange={(e) => updateAnswer(ai, { text: e.target.value })}
                          placeholder={`Option ${letter}`}
                          style={{
                            flex: 1, background: "transparent", border: "none",
                            color: "#E8E8F0", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none",
                          }}
                        />

                        {/* Correct toggle — pill switch */}
                        <button
                          onClick={() => updateAnswer(ai, { isCorrect: !answer.isCorrect })}
                          style={{
                            flexShrink: 0, display: "flex", alignItems: "center", gap: 7,
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                          }}
                        >
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: answer.isCorrect ? "#43D98F" : "#6E708A",
                            whiteSpace: "nowrap",
                          }}>
                            {answer.isCorrect ? "Correct" : "Mark correct"}
                          </span>
                          {/* pill */}
                          <span style={{
                            position: "relative", display: "inline-block",
                            width: 32, height: 18, borderRadius: 999, flexShrink: 0,
                            background: answer.isCorrect ? "#43D98F" : "#2E2E4A",
                            transition: "background 0.2s",
                          }}>
                            <span style={{
                              position: "absolute", top: 2,
                              left: answer.isCorrect ? 14 : 2,
                              width: 14, height: 14, borderRadius: "50%", background: "#fff",
                              transition: "left 0.2s",
                            }} />
                          </span>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => removeAnswer(ai)}
                          style={{
                            flexShrink: 0, width: 24, height: 24, borderRadius: 5,
                            border: "none", background: "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M1.75 3.50016H12.25M4.66667 3.50016V2.3335H9.33333V3.50016M4.08333 3.50016V11.6668H9.91667V3.50016M5.83333 6.41683V9.91683M8.16667 6.41683V9.91683" stroke="#6E708A" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Right: question settings ── */}
        <aside style={{
          width: 220, flexShrink: 0,
          background: "#0D0C1A", borderLeft: "1px solid #2E2E4A",
          overflowY: "auto", padding: "20px 16px",
          display: selectedQuestion ? "block" : "none",
        }}>
        {selectedQuestion && (<>
          <div style={{ color: "#E8E8F0", fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
            Question settings
          </div>

          {/* Time limit */}
          <QuizSettingSelect
            label="Time limit"
            value={selectedQuestion.timeLimit}
            options={[10, 20, 30, 60, 90, 120]}
            format={(v) => `${v} s`}
            onChange={(v) => updateQuestion({ timeLimit: v })}
          />
          {/* Points */}
          <QuizSettingSelect
            label="Points"
            value={selectedQuestion.points}
            options={[500, 1000, 2000, 5000]}
            format={(v) => v.toLocaleString()}
            onChange={(v) => updateQuestion({ points: v })}
          />

          <div style={{ height: 1, background: "#2E2E4A", margin: "14px 0" }} />

          {/* Difficulty */}
          <div style={{ color: "#A7A9BE", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Difficulty
          </div>
          <DifficultyPicker />

          <div style={{ height: 1, background: "#2E2E4A", margin: "14px 0" }} />

          {/* Tags */}
          <div style={{ color: "#A7A9BE", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Tags
          </div>
          <TagsEditor
            tags={selectedQuestion.tags}
            onChange={(tags) => updateQuestion({ tags })}
          />
        </>)}
        </aside>

      </div>
    </div>
  );
}

function QuizSettingSelect({
  label, value, options, format, onChange,
}: {
  label: string;
  value: number;
  options: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ color: "#A7A9BE", fontSize: 13 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: "#1A1A2E", border: "1px solid #2E2E4A", borderRadius: 6,
          color: "#E8E8F0", fontSize: 12, fontWeight: 600,
          padding: "3px 6px", cursor: "pointer", outline: "none",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{format(o)}</option>
        ))}
      </select>
    </div>
  );
}

function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startAdding() {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    const val = input.trim().toLowerCase().replace(/\s+/g, "-");
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
    setAdding(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setInput(""); setAdding(false); }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {tags.map((tag) => (
        <span key={tag} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 7px 3px 8px", borderRadius: 999,
          background: "rgba(108,99,255,0.12)", border: "1px solid rgba(108,99,255,0.25)",
          color: "#B9B3FF", fontSize: 11,
        }}>
          {tag}
          <button
            onClick={() => removeTag(tag)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#6C63FF", fontSize: 13, lineHeight: 1, padding: 0,
              display: "flex", alignItems: "center",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder="tag name…"
          style={{
            width: 80, padding: "3px 8px", borderRadius: 999,
            background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.4)",
            color: "#E8E8F0", fontSize: 11, fontFamily: "Inter, sans-serif", outline: "none",
          }}
        />
      ) : (
        <button
          onClick={startAdding}
          style={{
            padding: "3px 8px", borderRadius: 999,
            background: "transparent", border: "1px dashed #2E2E4A",
            color: "#6E708A", fontSize: 11, cursor: "pointer",
          }}
        >+ add</button>
      )}
    </div>
  );
}

// Small helper components
function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ color: "#A7A9BE", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#E8E8F0", fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ color: "#A7A9BE", fontSize: 13 }}>{label}</span>
      <button
        onClick={() => setOn(!on)}
        style={{
          width: 32, height: 18, borderRadius: 999, border: "none", cursor: "pointer",
          background: on ? "#6C63FF" : "#2E2E4A", position: "relative", transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: on ? 16 : 2,
          width: 14, height: 14, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}

function DifficultyPicker() {
  const [d, setD] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const opts = [
    { label: "Easy",   color: "#43D98F" },
    { label: "Medium", color: "#FFB547" },
    { label: "Hard",   color: "#FF6584" },
  ] as const;
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {opts.map(({ label, color }) => (
        <button
          key={label}
          onClick={() => setD(label)}
          style={{
            flex: 1, padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
            background: d === label ? `${color}22` : "rgba(46,46,74,0.5)",
            color: d === label ? color : "#6E708A",
            outline: d === label ? `1px solid ${color}55` : "none",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

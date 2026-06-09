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

const ANS_BG = ["#4DC4FF", "#FFA000", "#4BB34B", "#E64646"];

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
    if (saving) return "Сохранение…";
    if (savedSec === null) return "Все изменения сохранены";
    if (savedSec < 5) return "Только что сохранено";
    if (savedSec < 60) return `Автосохранение · ${savedSec} с назад`;
    return `Автосохранение · ${Math.round(savedSec / 60)} мин назад`;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#19191A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#909499", fontFamily: "Inter, sans-serif", fontSize: 15 }}>Загружаем…</span>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div style={{ minHeight: "100vh", background: "#19191A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#E64646", fontFamily: "Inter, sans-serif", fontSize: 15 }}>Квиз не найден.</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", height: "100vh", background: "#19191A", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <header style={{
        flexShrink: 0, height: 56,
        display: "flex", alignItems: "center",
        padding: "0 20px",
        background: "rgba(25,25,26,0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #363738",
        position: "relative",
      }}>
        {/* Left: back button + quiz title */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Link
            href="/dashboard"
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              color: "#909499", fontSize: 13, textDecoration: "none",
              padding: "5px 8px", borderRadius: 7,
              border: "1px solid transparent",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#363738"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M7 2L3.5 5.5 7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Главная
          </Link>
          <span style={{ color: "#363738", fontSize: 16, lineHeight: 1 }}>·</span>
          <input
            value={quiz.title}
            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "#E7E8EA", fontSize: 14, fontWeight: 600,
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
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#76787A", fontSize: 12 }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: saving ? "#FFA000" : (savedSec !== null ? "#4BB34B" : "#76787A"),
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
            border: "1px solid #363738", background: "transparent",
            color: "#909499", fontSize: 13, cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Предпросмотр
          </button>
          <button
            onClick={() => router.push(`/quiz/${quiz.id}/run?reset=1`)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 8, border: "none",
              background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
              color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 4px 12px rgba(0,119,255,0.35)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M3 2l8 4.5L3 11V2z" fill="currentColor" />
            </svg>
            Запустить квиз
          </button>
        </div>
      </header>

      {/* ── Step indicator ── */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "10px 20px",
        borderBottom: "1px solid #363738",
        background: "#19191A",
      }}>
        {/* Step 1 — back to quiz details */}
        <Link
          href={`/quiz/create?id=${quiz.id}`}
          style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "#2C2D2E", border: "1px solid #363738",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#909499",
          }}>1</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#909499" }}>Детали квиза</span>
        </Link>

        <div style={{ width: 56, height: 2, background: "#363738", margin: "0 14px" }} />

        {/* Step 2 — current */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(180deg, #0077FF, #005CC4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff",
          }}>2</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E7E8EA" }}>Вопросы</span>
        </div>

        <div style={{ width: 56, height: 2, background: "#363738", margin: "0 14px" }} />

        {/* Step 3 — review & publish */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "#2C2D2E", border: "1px solid #363738",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#76787A",
          }}>3</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#76787A" }}>Проверка и публикация</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left: question list (260px) ── */}
        <aside style={{
          width: 260, flexShrink: 0,
          background: "#19191A",
          borderRight: "1px solid #363738",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Sidebar header */}
          <div style={{
            padding: "14px 14px 10px",
            borderBottom: "1px solid #363738",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: "#E7E8EA", fontWeight: 600, fontSize: 13 }}>
              Вопросы{" "}
              <span style={{ color: "#76787A", fontWeight: 400 }}>· {quiz.questions.length}</span>
            </span>
            <button
              onClick={addQuestion}
              style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid #363738",
                background: "rgba(0,119,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="#0077FF" strokeWidth="1.8" strokeLinecap="round" />
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
                  background: i === selectedIdx ? "rgba(0,119,255,0.1)" : "transparent",
                  border: `1px solid ${i === selectedIdx ? "rgba(0,119,255,0.4)" : "transparent"}`,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                {/* Drag handle */}
                <svg width="12" height="14" viewBox="0 0 12 14" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
                  <circle cx="3" cy="2.5" r="1.2" fill="#909499" />
                  <circle cx="3" cy="7" r="1.2" fill="#909499" />
                  <circle cx="3" cy="11.5" r="1.2" fill="#909499" />
                  <circle cx="9" cy="2.5" r="1.2" fill="#909499" />
                  <circle cx="9" cy="7" r="1.2" fill="#909499" />
                  <circle cx="9" cy="11.5" r="1.2" fill="#909499" />
                </svg>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: i === selectedIdx ? "#71AAEB" : "#76787A",
                    }}>
                      <span style={{ opacity: 0.6 }}>В</span>{i + 1}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 600, color: "#76787A",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>{q.type === "SINGLE" ? "один" : "несколько"}</span>
                    {q.answers.length === 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: "#FFA000",
                        background: "rgba(255,160,0,0.1)", borderRadius: 3, padding: "1px 4px",
                      }}>● черновик</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 12, color: i === selectedIdx ? "#E7E8EA" : "#909499",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {q.text || <span style={{ color: "#76787A", fontStyle: "italic" }}>Пустой вопрос…</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Add question — bottom */}
          <div style={{ padding: "10px 8px", borderTop: "1px solid #363738" }}>
            <button
              onClick={addQuestion}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px", borderRadius: 8,
                border: "1px dashed rgba(0,119,255,0.35)",
                background: "transparent", color: "#0077FF",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Добавить вопрос
            </button>
          </div>
        </aside>

        {/* ── Center: editor ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "#19191A" }}>
          {!selectedQuestion ? (
            <div style={{ textAlign: "center", color: "#76787A", fontSize: 14, marginTop: 80 }}>
              Выберите или добавьте вопрос для редактирования.
            </div>
          ) : (
            <div style={{ maxWidth: 640 }}>
              {/* Editor header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ color: "#76787A", fontSize: 13 }}>
                    Вопрос {selectedIdx + 1} из {quiz.questions.length}
                  </span>
                  {/* Type toggle */}
                  <div style={{
                    display: "flex", background: "#232324", borderRadius: 7,
                    border: "1px solid #363738", padding: 3,
                  }}>
                    {(["SINGLE", "MULTIPLE"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => updateQuestion({ type: t })}
                        style={{
                          padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer",
                          fontSize: 12, fontWeight: 600,
                          background: selectedQuestion.type === t ? "rgba(0,119,255,0.18)" : "transparent",
                          color: selectedQuestion.type === t ? "#71AAEB" : "#76787A",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {t === "SINGLE" ? "Один ответ" : "Несколько"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={deleteQuestion}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 7,
                    border: "1px solid rgba(230,70,70,0.25)",
                    background: "rgba(230,70,70,0.07)",
                    color: "#E64646", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.75 3.50016H12.25M4.66667 3.50016V2.3335H9.33333V3.50016M4.08333 3.50016V11.6668H9.91667V3.50016M5.83333 6.41683V9.91683M8.16667 6.41683V9.91683" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Удалить
                </button>
              </div>

              {/* Question text */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#909499", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Текст вопроса
                </label>
                <textarea
                  value={selectedQuestion.text}
                  onChange={(e) => updateQuestion({ text: e.target.value })}
                  placeholder="Напишите вопрос здесь…"
                  rows={3}
                  style={{
                    width: "100%", background: "#232324",
                    border: "1px solid #363738", borderRadius: 10,
                    padding: "12px 14px", color: "#E7E8EA",
                    fontSize: 15, fontFamily: "Inter, sans-serif",
                    resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(0,119,255,0.6)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#363738"; }}
                />
              </div>

              {/* Image upload */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", color: "#909499", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Изображение <span style={{ color: "#76787A", fontWeight: 400, textTransform: "none" }}>(необязательно)</span>
                </label>
                <div style={{
                  border: "1.5px dashed #363738", borderRadius: 10,
                  padding: "20px", textAlign: "center",
                  background: "rgba(35,35,36,0.4)", cursor: "pointer",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,119,255,0.5)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#363738"; }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: "block", margin: "0 auto 6px" }}>
                    <rect x="2" y="5" width="20" height="16" rx="2.5" stroke="#76787A" strokeWidth="1.4" />
                    <circle cx="8" cy="10.5" r="1.8" stroke="#76787A" strokeWidth="1.4" />
                    <path d="M2 17l5-4.5 4 3.5 4-3 5 4" stroke="#76787A" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  <span style={{ color: "#76787A", fontSize: 12 }}>
                    Перетащите изображение или{" "}
                    <span style={{ color: "#0077FF", textDecoration: "underline", cursor: "pointer" }}>выберите файл</span>
                  </span>
                </div>
              </div>

              {/* Answer options */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ color: "#909499", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Варианты ответов{" "}
                    <span style={{ color: "#76787A", fontWeight: 400, textTransform: "none" }}>
                      · {selectedQuestion.type === "SINGLE" ? "один правильный" : "несколько правильных"}
                    </span>
                  </span>
                  <button
                    onClick={addAnswer}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "5px 10px", borderRadius: 6,
                      border: "1px solid rgba(0,119,255,0.3)",
                      background: "rgba(0,119,255,0.08)",
                      color: "#0077FF", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    Добавить ответ
                  </button>
                </div>

                {selectedQuestion.answers.length === 0 && (
                  <div style={{ color: "#76787A", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
                    Ответов пока нет — нажмите «Добавить ответ»
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedQuestion.answers.map((answer, ai) => {
                    const letter = String.fromCharCode(65 + ai);
                    const bg = ANS_BG[ai % ANS_BG.length];
                    return (
                      <div key={ai} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: "#232324",
                        border: `1px solid ${answer.isCorrect ? "rgba(75,179,75,0.35)" : "#363738"}`,
                        borderRadius: 10, padding: "9px 10px",
                      }}>
                        {/* Letter badge */}
                        <span style={{
                          flexShrink: 0, width: 24, height: 24, borderRadius: 6,
                          background: bg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#fff",
                        }}>
                          {letter}
                        </span>

                        <input
                          value={answer.text}
                          onChange={(e) => updateAnswer(ai, { text: e.target.value })}
                          placeholder={`Вариант ${letter}`}
                          style={{
                            flex: 1, background: "transparent", border: "none",
                            color: "#E7E8EA", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none",
                          }}
                        />

                        {/* Correct toggle */}
                        <button
                          onClick={() => updateAnswer(ai, { isCorrect: !answer.isCorrect })}
                          style={{
                            flexShrink: 0, display: "flex", alignItems: "center", gap: 7,
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                          }}
                        >
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: answer.isCorrect ? "#4BB34B" : "#76787A",
                            whiteSpace: "nowrap",
                          }}>
                            {answer.isCorrect ? "Правильный" : "Отметить верным"}
                          </span>
                          <span style={{
                            position: "relative", display: "inline-block",
                            width: 32, height: 18, borderRadius: 999, flexShrink: 0,
                            background: answer.isCorrect ? "#4BB34B" : "#363738",
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
                            <path d="M1.75 3.50016H12.25M4.66667 3.50016V2.3335H9.33333V3.50016M4.08333 3.50016V11.6668H9.91667V3.50016M5.83333 6.41683V9.91683M8.16667 6.41683V9.91683" stroke="#76787A" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
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
          background: "#19191A", borderLeft: "1px solid #363738",
          overflowY: "auto", padding: "20px 16px",
          display: selectedQuestion ? "block" : "none",
        }}>
        {selectedQuestion && (<>
          <div style={{ color: "#E7E8EA", fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
            Настройки вопроса
          </div>

          <QuizSettingSelect
            label="Время ответа"
            value={selectedQuestion.timeLimit}
            options={[10, 20, 30, 60, 90, 120]}
            format={(v) => `${v} с`}
            onChange={(v) => updateQuestion({ timeLimit: v })}
          />
          <QuizSettingSelect
            label="Очки"
            value={selectedQuestion.points}
            options={[500, 1000, 2000, 5000]}
            format={(v) => v.toLocaleString()}
            onChange={(v) => updateQuestion({ points: v })}
          />

          <div style={{ height: 1, background: "#363738", margin: "14px 0" }} />

          <div style={{ color: "#909499", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Сложность
          </div>
          <DifficultyPicker />

          <div style={{ height: 1, background: "#363738", margin: "14px 0" }} />

          <div style={{ color: "#909499", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Теги
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
      <span style={{ color: "#909499", fontSize: 13 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: "#232324", border: "1px solid #363738", borderRadius: 6,
          color: "#E7E8EA", fontSize: 12, fontWeight: 600,
          padding: "3px 6px", cursor: "pointer", outline: "none",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {options.map((o) => (
          <option key={o} value={o} style={{ background: "#232324" }}>{format(o)}</option>
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
          background: "rgba(0,119,255,0.1)", border: "1px solid rgba(0,119,255,0.25)",
          color: "#71AAEB", fontSize: 11,
        }}>
          {tag}
          <button
            onClick={() => removeTag(tag)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#0077FF", fontSize: 13, lineHeight: 1, padding: 0,
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
          placeholder="тег…"
          style={{
            width: 80, padding: "3px 8px", borderRadius: 999,
            background: "rgba(0,119,255,0.08)", border: "1px solid rgba(0,119,255,0.4)",
            color: "#E7E8EA", fontSize: 11, fontFamily: "Inter, sans-serif", outline: "none",
          }}
        />
      ) : (
        <button
          onClick={startAdding}
          style={{
            padding: "3px 8px", borderRadius: 999,
            background: "transparent", border: "1px dashed #363738",
            color: "#76787A", fontSize: 11, cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >+ добавить</button>
      )}
    </div>
  );
}

function DifficultyPicker() {
  const [d, setD] = useState<"Лёгко" | "Средне" | "Сложно">("Средне");
  const opts = [
    { label: "Лёгко",  color: "#4BB34B" },
    { label: "Средне", color: "#FFA000" },
    { label: "Сложно", color: "#E64646" },
  ] as const;
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {opts.map(({ label, color }) => (
        <button
          key={label}
          onClick={() => setD(label)}
          style={{
            flex: 1, padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
            background: d === label ? `${color}22` : "rgba(44,45,46,0.5)",
            color: d === label ? color : "#76787A",
            outline: d === label ? `1px solid ${color}55` : "none",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

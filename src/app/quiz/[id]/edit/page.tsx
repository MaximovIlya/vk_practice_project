"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

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
  const { data: session } = useSession();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSec, setSavedSec] = useState<number | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDragOver, setImageDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  async function handleImageUpload(file: File) {
    if (!selectedQuestion) return;
    setImageUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    setImageUploading(false);
    if (data.url) updateQuestion({ imageUrl: data.url });
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

  const userName = session?.user?.name ?? "Вы";
  const initials = userName.trim()
    ? userName.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="edit-root" style={{ minHeight: "100vh", height: "100vh", background: "#19191A", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Nav ── */}
      <nav className="app-navbar" style={{
        flexShrink: 0,
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(25, 25, 26, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #363738",
        height: "65px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "7.84px",
              background: "linear-gradient(180deg, #0077FF, #005CC4)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="16" height="11" viewBox="8 11 20 14" fill="none">
                <path d="M10.5825 18H13.0552L14.7036 13.055L18 22.946L19.649 18H25.418"
                  stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em" }}>Pulse</span>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {([
              { label: "Главная", href: "/dashboard" },
              { label: "Мои квизы", href: "/dashboard/quizzes" },
            ] as const).map(({ label, href }) => (
              <Link key={label} href={href} style={{
                fontSize: "14px", fontWeight: 500, cursor: "pointer",
                color: label === "Мои квизы" ? "#E7E8EA" : "#909499",
                padding: "8px 14px", borderRadius: "6px", textDecoration: "none",
                background: label === "Мои квизы" ? "rgba(255,255,255,0.05)" : "transparent",
              }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="nav-role-badge" style={{
            padding: "4px 10px", borderRadius: "999px",
            background: "rgba(0,119,255,0.12)",
            fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em",
            textTransform: "uppercase", color: "#71AAEB",
          }}>
            ОРГАНИЗАТОР
          </div>
          <div style={{ position: "relative" }}>
            <div onClick={() => setMenuOpen((v) => !v)} className="nav-user-pill" style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "7px 15px 7px 7px", borderRadius: "999px",
              background: "#2C2D2E", border: "1px solid #363738",
              cursor: "pointer", userSelect: "none",
            }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "14px",
                background: "linear-gradient(180deg, #0077FF, #005CC4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>{initials}</div>
              <span className="nav-user-name" style={{ fontSize: "14px", fontWeight: 500 }}>{userName}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 30,
                  minWidth: "160px", background: "#232324",
                  border: "1px solid #363738", borderRadius: "10px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
                }}>
                  <button onClick={() => signOut({ callbackUrl: "/login" })} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    width: "100%", padding: "11px 14px",
                    background: "none", border: "none",
                    color: "#E64646", fontSize: "14px", fontWeight: 500,
                    cursor: "pointer", textAlign: "left",
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Выйти
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Sub-header: breadcrumb + save indicator + continue ── */}
      <div className="subheader-bar details-subheader" style={{
        flexShrink: 0,
        borderBottom: "1px solid #363738",
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "20px 48px 21px",
      }}>
        <div className="subheader-actions" style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
          {/* Save indicator */}
          <span className="edit-save-indicator" style={{ display: "flex", alignItems: "center", gap: 6, color: "#76787A", fontSize: 13, whiteSpace: "nowrap" }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: saving ? "#FFA000" : (savedSec !== null ? "#4BB34B" : "#76787A"),
              display: "inline-block", flexShrink: 0,
            }} />
            {savedLabel()}
          </span>
          {/* Continue (desktop / tablet — on phones this moves to the bottom bar) */}
          <button
            className="subheader-continue"
            onClick={() => router.push(`/quiz/${quiz.id}/review`)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "0 18px", height: "40px", borderRadius: "8px",
              background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
              boxShadow: "0 4px 16px rgba(0,119,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              border: "none",
              color: "#E7E8EA", fontSize: "14px", fontWeight: 600, cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Продолжить
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div className="step-indicator" style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "10px 20px",
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

        <div className="step-connector" style={{ width: 56, height: 2, background: "#363738", margin: "0 14px" }} />

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

        <div className="step-connector" style={{ width: 56, height: 2, background: "#363738", margin: "0 14px" }} />

        {/* Step 3 — review & publish */}
        <Link
          href={`/quiz/${quiz.id}/review`}
          style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "#2C2D2E", border: "1px solid #363738",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#76787A",
          }}>3</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#76787A" }}>Проверка и публикация</span>
        </Link>
      </div>

      {/* ── Body ── */}
      <div className="edit-body" style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left: question list (260px) ── */}
        <aside className="edit-list" style={{
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
        <main className="edit-main" style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "#19191A" }}>
          {!selectedQuestion ? (
            <div style={{ textAlign: "center", color: "#76787A", fontSize: 14, marginTop: 80 }}>
              Выберите или добавьте вопрос для редактирования.
            </div>
          ) : (
            <div style={{ maxWidth: 640 }}>
              {/* Editor header */}
              <div className="editor-meta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
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

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                    e.target.value = "";
                  }}
                />

                {selectedQuestion.imageUrl ? (
                  <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #363738", background: "#1A1A1B" }}>
                    <Image
                      src={selectedQuestion.imageUrl}
                      alt="Изображение вопроса"
                      width={640}
                      height={360}
                      style={{ width: "100%", height: 320, objectFit: "contain", display: "block" }}
                    />
                    <div style={{
                      position: "absolute", top: 8, right: 8, display: "flex", gap: 6,
                    }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 6,
                          background: "rgba(25,25,26,0.85)", border: "1px solid #363738",
                          color: "#E7E8EA", fontSize: 11, fontWeight: 600, cursor: "pointer",
                          fontFamily: "Inter, sans-serif", backdropFilter: "blur(6px)",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1 9.5V11h1.5l4.44-4.44-1.5-1.5L1 9.5zm7.07-4.07a.4.4 0 0 0 0-.57L6.64 3.43a.4.4 0 0 0-.57 0l-.93.93 2.07 2.07.86-.86z" fill="currentColor" />
                        </svg>
                        Заменить
                      </button>
                      <button
                        onClick={() => updateQuestion({ imageUrl: null })}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 6,
                          background: "rgba(230,70,70,0.15)", border: "1px solid rgba(230,70,70,0.3)",
                          color: "#E64646", fontSize: 11, fontWeight: 600, cursor: "pointer",
                          fontFamily: "Inter, sans-serif", backdropFilter: "blur(6px)",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Удалить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !imageUploading && fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
                    onDragLeave={() => setImageDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImageDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleImageUpload(file);
                    }}
                    style={{
                      border: `1.5px dashed ${imageDragOver ? "rgba(0,119,255,0.7)" : "#363738"}`,
                      borderRadius: 10, padding: "28px 20px", textAlign: "center",
                      background: imageDragOver ? "rgba(0,119,255,0.06)" : "rgba(35,35,36,0.4)",
                      cursor: imageUploading ? "default" : "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!imageDragOver) (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,119,255,0.5)"; }}
                    onMouseLeave={(e) => { if (!imageDragOver) (e.currentTarget as HTMLElement).style.borderColor = "#363738"; }}
                  >
                    {imageUploading ? (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: "block", margin: "0 auto 8px", opacity: 0.5 }}>
                          <circle cx="12" cy="12" r="9" stroke="#0077FF" strokeWidth="2" strokeDasharray="40 16" strokeLinecap="round">
                            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                          </circle>
                        </svg>
                        <span style={{ color: "#76787A", fontSize: 12 }}>Загружаем…</span>
                      </>
                    ) : (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: "block", margin: "0 auto 8px" }}>
                          <rect x="2" y="5" width="20" height="16" rx="2.5" stroke="#76787A" strokeWidth="1.4" />
                          <circle cx="8" cy="10.5" r="1.8" stroke="#76787A" strokeWidth="1.4" />
                          <path d="M2 17l5-4.5 4 3.5 4-3 5 4" stroke="#76787A" strokeWidth="1.4" strokeLinejoin="round" />
                        </svg>
                        <span style={{ color: "#76787A", fontSize: 12 }}>
                          Перетащите изображение или{" "}
                          <span style={{ color: "#0077FF", textDecoration: "underline" }}>выберите файл</span>
                        </span>
                        <div style={{ color: "#4A4B4D", fontSize: 11, marginTop: 4 }}>JPG, PNG, GIF, WEBP · до 5 МБ</div>
                      </>
                    )}
                  </div>
                )}
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
                            flex: 1, minWidth: 0, background: "transparent", border: "none",
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
                          <span className="answer-correct-label" style={{
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
        <aside className="edit-settings" style={{
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

        </>)}
        </aside>

      </div>

      {/* Mobile-only: continue button pinned to the bottom of the page */}
      <div className="mobile-continue-bar" style={{ display: "none" }}>
        <button
          onClick={() => router.push(`/quiz/${quiz.id}/review`)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            height: 48, borderRadius: 10, border: "none",
            background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
            boxShadow: "0 4px 16px rgba(0,119,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            color: "#E7E8EA", fontSize: 15, fontWeight: 600, cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Продолжить
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
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


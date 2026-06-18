"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { pluralize } from "@/lib/plural";

type Answer = { id?: string; text: string; isCorrect: boolean };
type Question = {
  id: string;
  text: string;
  type: "SINGLE" | "MULTIPLE";
  imageUrl?: string | null;
  order: number;
  answers: Answer[];
  timeLimit: number;
  points: number;
};
type Quiz = {
  id: string;
  title: string;
  description: string;
  category: string;
  timePerQuestion: number;
  pointsPerQuestion: number;
  scoring: string;
  difficulty: string;
  tags: string[];
  coverImageUrl?: string | null;
  questions: Question[];
};

const CATEGORY_LABELS: Record<string, string> = {
  Engineering: "Технологии",
  Internal: "Корпоративный",
  General: "Общие знания",
  Education: "Образование",
  Entertainment: "Развлечения",
  Science: "Наука",
  History: "История",
  Geography: "География",
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  Engineering:   "linear-gradient(165deg, #E64646 0%, rgba(230,70,70,0.6) 100%)",
  Internal:      "linear-gradient(165deg, #0077FF 0%, rgba(0,119,255,0.6) 100%)",
  General:       "linear-gradient(165deg, #4BB34B 0%, rgba(75,179,75,0.6) 100%)",
  Education:     "linear-gradient(165deg, #FFA000 0%, rgba(255,160,0,0.6) 100%)",
  Entertainment: "linear-gradient(165deg, #4DC4FF 0%, rgba(77,196,255,0.6) 100%)",
  Science:       "linear-gradient(165deg, #06B6D4 0%, rgba(6,182,212,0.6) 100%)",
  History:       "linear-gradient(165deg, #F97316 0%, rgba(249,115,22,0.6) 100%)",
  Geography:     "linear-gradient(165deg, #14B8A6 0%, rgba(20,184,166,0.6) 100%)",
};

const SCORING_LABELS: Record<string, string> = {
  standard: "Стандарт",
  speed:    "Бонус за скорость",
  streak:   "Серия комбо",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  "Легко":  "#4BB34B",
  "Средне": "#FFA000",
  "Сложно": "#E64646",
};

type Issue = { questionIdx: number; message: string };

function validateQuiz(quiz: Quiz): Issue[] {
  const issues: Issue[] = [];
  if (quiz.questions.length === 0) {
    issues.push({ questionIdx: -1, message: "Добавьте хотя бы один вопрос" });
    return issues;
  }
  quiz.questions.forEach((q, i) => {
    if (!q.text.trim()) {
      issues.push({ questionIdx: i, message: "Текст вопроса не заполнен" });
    }
    if (q.answers.length < 2) {
      issues.push({ questionIdx: i, message: "Нужно минимум 2 варианта ответа" });
    } else {
      const hasCorrect = q.answers.some((a) => a.isCorrect);
      const hasEmptyText = q.answers.some((a) => !a.text.trim());
      if (!hasCorrect) issues.push({ questionIdx: i, message: "Не указан правильный ответ" });
      if (hasEmptyText) issues.push({ questionIdx: i, message: "Есть незаполненные варианты ответа" });
    }
  });
  return issues;
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/quiz/${params.id}`)
      .then((r) => r.json())
      .then((data) => { setQuiz(data); setLoading(false); });
  }, [params.id]);

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

  const issues = validateQuiz(quiz);
  const issuesByQuestion: Record<number, string[]> = {};
  issues.forEach(({ questionIdx, message }) => {
    if (!issuesByQuestion[questionIdx]) issuesByQuestion[questionIdx] = [];
    issuesByQuestion[questionIdx].push(message);
  });
  const isReady = issues.length === 0;

  const catGrad = CATEGORY_GRADIENTS[quiz.category] ?? "linear-gradient(165deg, #4DC4FF, #0077FF)";
  const catLabel = CATEGORY_LABELS[quiz.category] ?? quiz.category;

  function timeLabelShort(s: number) {
    return s < 60 ? `${s} с` : `${s / 60} мин`;
  }

  const userName = session?.user?.name ?? "";
  const initials = userName.trim()
    ? userName.trim().split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div style={{ minHeight: "100vh", background: "#19191A", fontFamily: "Inter, sans-serif", color: "#E7E8EA", display: "flex", flexDirection: "column" }}>

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

      {/* ── Sub-header: breadcrumb ── */}
      <div className="subheader-bar" style={{
        flexShrink: 0,
        borderBottom: "1px solid #363738",
        display: "flex", alignItems: "center", justifyContent: "flex-start",
        padding: "20px 48px 21px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <Link href="/dashboard/quizzes" style={{ fontSize: "14px", color: "#909499", textDecoration: "none", flexShrink: 0 }}>
            Мои квизы
          </Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#909499" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#E7E8EA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quiz.title}</span>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div className="step-indicator" style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "10px 20px",
        background: "#19191A",
      }}>
        <Link href={`/quiz/create?id=${quiz.id}`} style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "#2C2D2E", border: "1px solid #363738", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#909499" }}>1</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#909499" }}>Детали квиза</span>
        </Link>
        <div className="step-connector" style={{ width: 56, height: 2, background: "#363738", margin: "0 14px" }} />
        <Link href={`/quiz/${quiz.id}/edit`} style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "#2C2D2E", border: "1px solid #363738", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#909499" }}>2</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#909499" }}>Вопросы</span>
        </Link>
        <div className="step-connector" style={{ width: 56, height: 2, background: "#0077FF", margin: "0 14px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(180deg, #0077FF, #005CC4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>3</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E7E8EA" }}>Проверка и публикация</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="review-layout" style={{ flex: 1, display: "flex", gap: 32, padding: "32px 40px", maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        {/* ── Left: checklist ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Overall status banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "18px 22px", borderRadius: 14,
            background: isReady ? "rgba(75,179,75,0.08)" : "rgba(230,70,70,0.08)",
            border: `1px solid ${isReady ? "rgba(75,179,75,0.25)" : "rgba(230,70,70,0.25)"}`,
          }}>
            {isReady ? (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(75,179,75,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4BB34B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(230,70,70,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E64646" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: isReady ? "#4BB34B" : "#E64646" }}>
                {isReady ? "Квиз готов к запуску" : `Найдено проблем: ${issues.length}`}
              </div>
              <div style={{ fontSize: 13, color: "#76787A", marginTop: 2 }}>
                {isReady
                  ? `${pluralize(quiz.questions.length, ["вопрос", "вопроса", "вопросов"])} · все проверки пройдены`
                  : "Исправьте ошибки перед запуском"}
              </div>
            </div>
          </div>

          {/* Question checklist */}
          <div style={{ background: "#232324", border: "1px solid #363738", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #363738", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#E7E8EA" }}>Вопросы · {quiz.questions.length}</span>
              <Link
                href={`/quiz/${quiz.id}/edit`}
                style={{ fontSize: 12, color: "#0077FF", textDecoration: "none", fontWeight: 600 }}
              >
                Редактировать →
              </Link>
            </div>

            {quiz.questions.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#76787A", fontSize: 13 }}>
                Нет вопросов. <Link href={`/quiz/${quiz.id}/edit`} style={{ color: "#0077FF", textDecoration: "none" }}>Добавить вопросы →</Link>
              </div>
            ) : (
              <div>
                {quiz.questions.map((q, i) => {
                  const qIssues = issuesByQuestion[i] ?? [];
                  const ok = qIssues.length === 0;
                  return (
                    <div
                      key={q.id}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 14,
                        padding: "14px 20px",
                        borderBottom: i < quiz.questions.length - 1 ? "1px solid #2C2D2E" : "none",
                        background: ok ? "transparent" : "rgba(230,70,70,0.04)",
                      }}
                    >
                      {/* Status icon */}
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {ok ? (
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(75,179,75,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4BB34B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : (
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(230,70,70,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E64646" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: qIssues.length ? 6 : 0 }}>
                          <span style={{ fontSize: 12, color: "#76787A", fontWeight: 600 }}>#{i + 1}</span>
                          <span style={{
                            fontSize: 14, fontWeight: 500, color: q.text.trim() ? "#E7E8EA" : "#4A4B4D",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {q.text.trim() || "Без текста"}
                          </span>
                          {q.imageUrl && (
                            <span style={{ fontSize: 11, color: "#76787A", background: "#2C2D2E", padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>
                              с картинкой
                            </span>
                          )}
                        </div>
                        {qIssues.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {qIssues.map((msg, mi) => (
                              <span key={mi} style={{ fontSize: 12, color: "#E64646", display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ flexShrink: 0 }}>·</span> {msg}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Meta */}
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#76787A", background: "#2C2D2E", padding: "2px 8px", borderRadius: 5 }}>
                          {q.type === "SINGLE" ? "Один" : "Несколько"}
                        </span>
                        <span style={{ fontSize: 11, color: "#76787A" }}>{timeLabelShort(q.timeLimit)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Settings summary */}
          <div style={{ background: "#232324", border: "1px solid #363738", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #363738", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#E7E8EA" }}>Настройки квиза</span>
              <Link href={`/quiz/create?id=${quiz.id}`} style={{ fontSize: 12, color: "#0077FF", textDecoration: "none", fontWeight: 600 }}>
                Изменить →
              </Link>
            </div>
            <div style={{ padding: "8px 0" }}>
              {[
                { label: "Категория",    value: catLabel },
                { label: "Сложность",    value: quiz.difficulty },
                { label: "Тип подсчёта", value: SCORING_LABELS[quiz.scoring] ?? quiz.scoring },
                ...(quiz.tags?.length ? [{ label: "Теги", value: quiz.tags.map((t) => `#${t}`).join(" ") }] : []),
              ].map(({ label, value }, i, arr) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: i < arr.length - 1 ? "1px solid #2C2D2E" : "none" }}>
                  <span style={{ fontSize: 13, color: "#909499" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#E7E8EA" }}>{value}</span>
                </div>
              ))}
              {quiz.description && (
                <div style={{ padding: "10px 20px" }}>
                  <span style={{ fontSize: 12, color: "#76787A" }}>{quiz.description}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: preview + CTA ── */}
        <div className="review-side" style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Quiz card preview */}
          <div>
            <div style={{ fontSize: 12, color: "#76787A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Предпросмотр карточки
            </div>
            <div style={{
              background: "#232324", border: "1px solid #363738", borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 1px rgba(255,255,255,0.04)",
              overflow: "hidden",
            }}>
              {/* Cover */}
              <div style={{
                position: "relative",
                margin: "20px 20px 0",
                height: 168, borderRadius: 10, overflow: "hidden",
                background: quiz.coverImageUrl ? "#1A1A1B" : catGrad,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {quiz.coverImageUrl ? (
                  <>
                    {/* Blurred backdrop fills the frame so any aspect ratio looks clean */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={quiz.coverImageUrl} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(24px)", transform: "scale(1.2)" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={quiz.coverImageUrl} alt="Обложка квиза" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  </>
                ) : (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Обложка квиза</span>
                  </>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: "0 20px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 16, marginBottom: 8 }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "4px 10px 3px", borderRadius: 999,
                    background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)",
                    fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
                    textTransform: "uppercase", color: "#fff",
                  }}>
                    {catLabel}
                  </div>
                  {quiz.difficulty && DIFFICULTY_COLORS[quiz.difficulty] && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px 3px", borderRadius: 999,
                      background: `${DIFFICULTY_COLORS[quiz.difficulty]}1A`, border: `1px solid ${DIFFICULTY_COLORS[quiz.difficulty]}55`,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: DIFFICULTY_COLORS[quiz.difficulty] }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: DIFFICULTY_COLORS[quiz.difficulty] }}>{quiz.difficulty}</span>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#E7E8EA", lineHeight: 1.2 }}>
                  {quiz.title || "Без названия"}
                </p>

                {quiz.description && (
                  <p style={{ fontSize: 14, lineHeight: "21px", color: "#909499", margin: "0 0 16px" }}>
                    {quiz.description}
                  </p>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: quiz.description ? 0 : 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round" style={{ display: "block", flexShrink: 0 }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span style={{ fontSize: 13, color: "#76787A", lineHeight: 1 }}>{SCORING_LABELS[quiz.scoring] ?? quiz.scoring}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round" style={{ display: "block", flexShrink: 0 }}>
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                    <span style={{ fontSize: 13, color: "#76787A", lineHeight: 1 }}>{quiz.questions.length} вопр.</span>
                  </div>
                </div>

                {quiz.tags?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                    {quiz.tags.map((tag) => (
                      <span key={tag} style={{
                        padding: "3px 9px", borderRadius: 999,
                        background: "rgba(0,119,255,0.1)", border: "1px solid rgba(0,119,255,0.25)",
                        color: "#71AAEB", fontSize: 12,
                      }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#4A4B4D", marginTop: 8, textAlign: "center" }}>
              Так игроки видят квиз перед входом
            </div>
          </div>

          {/* Launch CTA */}
          <div style={{
            background: "#232324", border: "1px solid #363738", borderRadius: 14,
            padding: "22px",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E7E8EA", marginBottom: 6 }}>Готовы к запуску?</div>
            <div style={{ fontSize: 13, color: "#76787A", marginBottom: 18, lineHeight: 1.5 }}>
              {isReady
                ? "Квиз прошёл все проверки. Нажмите «Запустить» — получите код комнаты и ждите игроков."
                : "Исправьте проблемы слева, чтобы активировать кнопку запуска."}
            </div>
            <button
              disabled={!isReady}
              onClick={() => router.push(`/quiz/${quiz.id}/run?reset=1`)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 20px", borderRadius: 10, border: "none",
                background: isReady
                  ? "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)"
                  : "#2C2D2E",
                color: isReady ? "#fff" : "#4A4B4D",
                fontSize: 14, fontWeight: 700, cursor: isReady ? "pointer" : "not-allowed",
                fontFamily: "Inter, sans-serif",
                boxShadow: isReady ? "0 6px 20px rgba(0,119,255,0.4)" : "none",
                transition: "all 0.15s",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 13 13" fill="none">
                <path d="M3 2l8 4.5L3 11V2z" fill="currentColor" />
              </svg>
              Запустить квиз
            </button>
          </div>

          {/* Author info */}
          {userName && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(180deg, #0077FF, #005CC4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#E7E8EA" }}>{userName}</div>
                <div style={{ fontSize: 11, color: "#76787A" }}>Организатор</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

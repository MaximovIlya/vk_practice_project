"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type LibraryQuiz = {
  id: string;
  title: string;
  category: string;
  questionCount: number;
  totalPlays: number;
  archived: boolean;
  lastRun: string | null;
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  Engineering:    "linear-gradient(165deg, #E64646 0%, rgba(230,70,70,0.6) 100%)",
  Internal:       "linear-gradient(165deg, #0077FF 0%, rgba(0,119,255,0.6) 100%)",
  General:        "linear-gradient(165deg, #4BB34B 0%, rgba(75,179,75,0.6) 100%)",
  Education:      "linear-gradient(165deg, #FFA000 0%, rgba(255,160,0,0.6) 100%)",
  Entertainment:  "linear-gradient(165deg, #4DC4FF 0%, rgba(77,196,255,0.6) 100%)",
  Science:        "linear-gradient(165deg, #06B6D4 0%, rgba(6,182,212,0.6) 100%)",
  History:        "linear-gradient(165deg, #F97316 0%, rgba(249,115,22,0.6) 100%)",
  Geography:      "linear-gradient(165deg, #14B8A6 0%, rgba(20,184,166,0.6) 100%)",
};

const CATEGORY_LABELS: Record<string, string> = {
  Engineering:   "Технологии",
  Internal:      "Корпоративный",
  General:       "Общие знания",
  Education:     "Образование",
  Entertainment: "Развлечения",
  Science:       "Наука",
  History:       "История",
  Geography:     "География",
};

function categoryGradient(cat: string) {
  return CATEGORY_GRADIENTS[cat] ?? "linear-gradient(165deg, #76787A 0%, rgba(118,120,122,0.6) 100%)";
}
function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return "Только что";
  if (h < 24) return `${h}ч назад`;
  if (d === 1) return "Вчера";
  if (d < 7) return `${d} дн. назад`;
  if (d < 14) return "На прошлой неделе";
  return `${Math.floor(d / 7)} нед. назад`;
}

const TABS = ["Все", "Опубликованные", "Черновики", "Архив"] as const;
type Tab = (typeof TABS)[number];

/** A quiz counts as "published" once it has been run at least once. */
function isPublished(q: LibraryQuiz) {
  return q.lastRun !== null;
}

type Props = {
  quizzes: LibraryQuiz[];
  /** Show the search input (used on the dedicated "Мои квизы" page). */
  showSearch?: boolean;
  /** Auto-focus the search input on mount (when arriving via the Поиск button). */
  autoFocusSearch?: boolean;
};

export default function QuizLibrary({ quizzes, showSearch = false, autoFocusSearch = false }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Все");
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Archive lives outside the other tabs: "Все/Опубликованные/Черновики" all
  // exclude archived quizzes; the Archive tab shows only archived ones.
  const byTab = quizzes.filter((q) => {
    if (activeTab === "Архив") return q.archived;
    if (q.archived) return false;
    if (activeTab === "Опубликованные") return isPublished(q);
    if (activeTab === "Черновики") return !isPublished(q);
    return true; // "Все"
  });

  const filtered = query.trim()
    ? byTab.filter((q) => q.title.toLowerCase().includes(query.trim().toLowerCase()))
    : byTab;

  async function handleDelete(id: string) {
    if (!confirm("Удалить этот квиз? Это действие нельзя отменить.")) return;
    setDeletingId(id);
    await fetch(`/api/quiz/${id}`, { method: "DELETE" });
    router.refresh();
    setDeletingId(null);
  }

  async function handleArchive(id: string, archived: boolean) {
    setBusyId(id);
    await fetch(`/api/quiz/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    router.refresh();
    setBusyId(null);
  }

  const emptyText: Record<Tab, string> = {
    "Все": "Квизов пока нет",
    "Опубликованные": "Нет проведённых квизов",
    "Черновики": "Нет черновиков",
    "Архив": "Архив пуст",
  };

  return (
    <div>
      {/* Tabs + optional search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              background: activeTab === tab ? "#2C2D2E" : "transparent",
              boxShadow: activeTab === tab ? "inset 0 0 0 1px #363738" : "none",
              border: "none",
              color: activeTab === tab ? "#E7E8EA" : "#909499",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}>
              {tab}
            </button>
          ))}
        </div>

        {showSearch && (
          <div style={{ position: "relative", width: 300 }}>
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              autoFocus={autoFocusSearch}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию…"
              style={{
                width: "100%", height: 38, padding: "0 14px 0 36px",
                borderRadius: 8, background: "#232324", border: "1px solid #363738",
                color: "#E7E8EA", fontSize: 14, outline: "none", boxSizing: "border-box",
                fontFamily: "Inter, sans-serif",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#0077FF")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#363738")}
            />
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ marginTop: "20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "5rem 2rem", color: "#76787A" }}>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "#909499", margin: "0 0 8px" }}>
              {query.trim() ? "Ничего не найдено" : emptyText[activeTab]}
            </p>
            {!query.trim() && activeTab === "Все" && (
              <p style={{ fontSize: "14px", margin: 0 }}>Создайте свой первый квиз.</p>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px" }}>
            {filtered.map((quiz) => (
              <div key={quiz.id} style={{
                background: "#232324",
                border: "1px solid #363738",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 1px rgba(255,255,255,0.04)",
                opacity: quiz.archived ? 0.7 : 1,
              }}>
                {/* Card image header */}
                <div style={{ height: "120px", background: categoryGradient(quiz.category), position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", width: "140px", height: "140px", borderRadius: "50%", background: "rgba(255,255,255,0.18)", top: "10px", right: "-14px" }} />
                  <div style={{ position: "absolute", top: "16px", left: "16px", padding: "3.5px 10px", borderRadius: "999px", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#fff" }}>
                      {categoryLabel(quiz.category)}
                    </span>
                  </div>
                  {quiz.archived && (
                    <div style={{ position: "absolute", top: "16px", right: "16px", padding: "3.5px 10px", borderRadius: "999px", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#E7E8EA" }}>В архиве</span>
                    </div>
                  )}
                  <div style={{ position: "absolute", bottom: "0", left: "16px", display: "flex", gap: "14px", alignItems: "center", paddingBottom: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{quiz.questionCount} вопросов</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>·</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{quiz.totalPlays.toLocaleString()} игр</span>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "3px" }}>
                  <p style={{ fontSize: "16px", fontWeight: 600, color: "#E7E8EA", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {quiz.title}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span style={{ fontSize: "13px", color: "#76787A" }}>{quiz.lastRun ? timeAgo(quiz.lastRun) : "Черновик"}</span>
                  </div>

                  <div style={{ display: "flex", gap: "6px", paddingTop: "12.7px" }}>
                    {quiz.archived ? (
                      <button
                        onClick={() => handleArchive(quiz.id, false)}
                        disabled={busyId === quiz.id}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                          height: "32px", borderRadius: "8px",
                          background: "#2C2D2E", boxShadow: "inset 0 0 0 1px #363738", border: "none",
                          color: "#E7E8EA", fontSize: "13px", fontWeight: 600,
                          cursor: busyId === quiz.id ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif",
                        }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 14 9 14 9 18" transform="rotate(180 6 16)" /><path d="M21 8v13H3V8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                        </svg>
                        Вернуть из архива
                      </button>
                    ) : (
                      <Link href={`/quiz/${quiz.id}/run?reset=1`} style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        height: "32px", borderRadius: "8px",
                        background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
                        boxShadow: "0 4px 16px rgba(0,119,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                        color: "#E7E8EA", fontSize: "13px", fontWeight: 600, textDecoration: "none",
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        Запустить
                      </Link>
                    )}

                    <Link href={`/quiz/${quiz.id}/edit`} title="Редактировать" style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: "37px", height: "32px", borderRadius: "8px",
                      background: "#2C2D2E", textDecoration: "none", color: "#909499",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </Link>

                    {!quiz.archived && (
                      <button onClick={() => handleArchive(quiz.id, true)} disabled={busyId === quiz.id} title="В архив" style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: "37px", height: "32px", borderRadius: "8px",
                        background: "#2C2D2E", border: "none", color: "#909499",
                        cursor: busyId === quiz.id ? "not-allowed" : "pointer",
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="22" height="5" /><path d="M3 8v13h18V8" /><line x1="10" y1="12" x2="14" y2="12" />
                        </svg>
                      </button>
                    )}

                    <button onClick={() => handleDelete(quiz.id)} disabled={deletingId === quiz.id} title="Удалить" style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: "37px", height: "32px", borderRadius: "8px",
                      background: "transparent", border: "none", color: "#E64646",
                      cursor: deletingId === quiz.id ? "not-allowed" : "pointer",
                      opacity: deletingId === quiz.id ? 0.5 : 1,
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

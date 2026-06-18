"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const CATEGORIES = ["Engineering", "Internal", "General", "Education", "Entertainment", "Science", "History", "Geography"];
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
const SCORING_OPTIONS = [
  { id: "standard",  label: "Стандарт",        desc: "Очки только за правильность" },
  { id: "speed",     label: "Бонус за скорость", desc: "Быстрые ответы дают больше" },
  { id: "streak",    label: "Серия",             desc: "Множитель комбо" },
];

const DIFFICULTY_OPTIONS = [
  { label: "Легко",  color: "#4BB34B" },
  { label: "Средне", color: "#FFA000" },
  { label: "Сложно", color: "#E64646" },
] as const;

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

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
    : parts[0][0].toUpperCase();
}

type DetailsCache = {
  title: string; description: string; category: string;
  scoring: string; difficulty: string; tags: string[]; coverImageUrl: string | null;
};
// Lives at module scope, so it survives client-side navigation. Returning to
// this step (e.g. from the questions step) reads the cached values instantly
// instead of flashing an empty form while the GET request is in flight.
const detailsCache = new Map<string, DetailsCache>();

export default function CreateQuizPage() {
  // useSearchParams() must be inside a Suspense boundary in Next 14, otherwise
  // it breaks the build / Fast Refresh. Wrap the real page in one.
  return (
    <Suspense fallback={<div style={{ background: "#19191A", minHeight: "100vh" }} />}>
      <CreateQuizPageInner />
    </Suspense>
  );
}

function CreateQuizPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // When opened with ?id=<quizId> the page edits an existing quiz's details
  // (step 1) instead of creating a new one — this is how the questions screen
  // lets the organizer step back.
  const editId = searchParams.get("id");
  // Seed initial state from the cache so a return visit renders instantly.
  const cached = editId ? detailsCache.get(editId) : undefined;

  const [title, setTitle] = useState(cached?.title ?? "");
  const [description, setDescription] = useState(cached?.description ?? "");
  const [category, setCategory] = useState(cached?.category ?? "Engineering");
  const [scoring, setScoring] = useState(cached?.scoring ?? "standard");
  const [difficulty, setDifficulty] = useState(cached?.difficulty ?? "Средне");
  const [tags, setTags] = useState<string[]>(cached?.tags ?? []);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(cached?.coverImageUrl ?? null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/quiz/${editId}`)
      .then((r) => r.json())
      .then((q) => {
        if (!q || q.error) return;
        setTitle(q.title ?? "");
        setDescription(q.description ?? "");
        setCategory(q.category ?? "Engineering");
        setScoring(q.scoring ?? "standard");
        setDifficulty(q.difficulty ?? "Средне");
        setTags(Array.isArray(q.tags) ? q.tags : []);
        setCoverImageUrl(q.coverImageUrl ?? null);
        detailsCache.set(editId, {
          title: q.title ?? "", description: q.description ?? "",
          category: q.category ?? "Engineering", scoring: q.scoring ?? "standard",
          difficulty: q.difficulty ?? "Средне",
          tags: Array.isArray(q.tags) ? q.tags : [],
          coverImageUrl: q.coverImageUrl ?? null,
        });
      });
  }, [editId]);

  async function handleCoverUpload(file: File) {
    setCoverUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.url) setCoverImageUrl(data.url);
    } finally {
      setCoverUploading(false);
    }
  }

  const userName = session?.user?.name ?? "Вы";
  const initials = getInitials(userName);

  async function handleSave(andContinue: boolean) {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(editId ? `/api/quiz/${editId}` : "/api/quiz", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, scoring, difficulty, tags, coverImageUrl }),
      });
      if (!res.ok) throw new Error("Failed");
      const quiz = await res.json();
      // Keep the cache in sync with what we just saved, so stepping forward to
      // the questions screen and back shows the saved values without a refetch flash.
      detailsCache.set(quiz.id, { title, description, category, scoring, difficulty, tags, coverImageUrl });
      if (andContinue) router.push(`/quiz/${quiz.id}/edit`);
      else router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="create-root" style={{ background: "#19191A", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", color: "#E7E8EA", fontFamily: "Inter, sans-serif" }}>

      {/* ── Nav ── */}
      <nav className="app-navbar" style={{
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
            {(["Главная", "Мои квизы"] as const).map((label) => (
              <Link key={label} href={label === "Главная" ? "/dashboard" : "#"} style={{
                fontSize: "14px", fontWeight: 500, cursor: "pointer",
                color: "#909499",
                padding: "8px 14px", borderRadius: "6px", textDecoration: "none",
                background: "transparent",
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

      {/* ── Sub-header: action buttons (quiz name intentionally omitted) ── */}
      <div className="subheader-bar details-subheader" style={{
        borderBottom: "1px solid #363738",
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "20px 48px 21px",
      }}>
        <div className="details-actions" style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !title.trim()}
            style={{
              padding: "0 18px", height: "40px", borderRadius: "8px",
              background: "none", border: "none",
              color: "#909499", fontSize: "14px", fontWeight: 600,
              cursor: title.trim() ? "pointer" : "not-allowed",
              opacity: title.trim() ? 1 : 0.5,
            }}
          >
            Сохранить черновик
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !title.trim()}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "0 18px", height: "40px", borderRadius: "8px",
              background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
              boxShadow: "0 4px 16px rgba(0,119,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              border: "none",
              color: "#E7E8EA", fontSize: "14px", fontWeight: 600,
              cursor: title.trim() ? "pointer" : "not-allowed",
              opacity: title.trim() ? 1 : 0.5,
            }}
          >
            Сохранить и продолжить
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
        {/* Step 1 — current */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(180deg, #0077FF, #005CC4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>1</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E7E8EA" }}>Детали квиза</span>
        </div>
        <div className="step-connector" style={{ width: 56, height: 2, background: "#363738", margin: "0 14px" }} />
        {/* Step 2 */}
        {editId ? (
          <Link href={`/quiz/${editId}/edit`} style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "#2C2D2E", border: "1px solid #363738", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#909499" }}>2</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#909499" }}>Вопросы</span>
          </Link>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "#2C2D2E", border: "1px solid #363738", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#909499" }}>2</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#909499" }}>Вопросы</span>
          </div>
        )}
        <div className="step-connector" style={{ width: 56, height: 2, background: "#363738", margin: "0 14px" }} />
        {/* Step 3 */}
        {editId ? (
          <Link href={`/quiz/${editId}/review`} style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "#2C2D2E", border: "1px solid #363738", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#909499" }}>3</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#909499" }}>Проверка и публикация</span>
          </Link>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "#2C2D2E", border: "1px solid #363738", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#909499" }}>3</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#909499" }}>Проверка и публикация</span>
          </div>
        )}
      </div>

      {/* ── Body: left form + right preview ── */}
      <div className="split-layout" style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left column ── */}
        <div className="split-form-col" style={{ flex: "0 0 900px", padding: "32px 64px", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>

          <h1 style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
            Расскажите о квизе
          </h1>
          <p style={{ fontSize: "15px", color: "#909499", margin: "0 0 8px" }}>
            Вы можете изменить это позже. Название и категория помогут игрокам найти квиз.
          </p>

          <div className="form-fields" style={{ display: "flex", flexDirection: "column", gap: "22px", paddingTop: "22px", width: "540px" }}>

            {/* Quiz title */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#909499" }}>Название квиза</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Викторина по фронтенду · Спринт 14"
                style={{
                  width: "100%", padding: "13px 15px", borderRadius: "8px",
                  background: "#232324", border: "1px solid #363738",
                  color: "#E7E8EA", fontSize: "15px", outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#0077FF")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363738")}
              />
            </div>

            {/* Description */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#909499" }}>
                Описание <span style={{ color: "#76787A" }}>(необязательно)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Быстрая разминка для пятничного демо — охватывает React, CSS-хитрости и один проклятый вопрос по JavaScript."
                rows={3}
                style={{
                  width: "100%", padding: "12px 15px", borderRadius: "8px",
                  background: "#232324", border: "1px solid #363738",
                  color: "#E7E8EA", fontSize: "15px", lineHeight: "22.5px",
                  resize: "none", outline: "none", fontFamily: "Inter, sans-serif",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#0077FF")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363738")}
              />
            </div>

            {/* Category + Visibility */}
            <div style={{ display: "flex", gap: "14px" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#909499" }}>Категория</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      width: "100%", padding: "13px 15px", paddingRight: "36px",
                      borderRadius: "8px", background: "#232324", border: "1px solid #363738",
                      color: "#E7E8EA", fontSize: "15px", outline: "none",
                      appearance: "none", cursor: "pointer",
                    }}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                  </select>
                  <svg style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#909499" }}>Видимость</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    style={{
                      width: "100%", padding: "13px 15px", paddingRight: "36px",
                      borderRadius: "8px", background: "#232324", border: "1px solid #363738",
                      color: "#E7E8EA", fontSize: "15px", outline: "none",
                      appearance: "none", cursor: "pointer",
                    }}
                  >
                    {VISIBILITIES.map((v) => <option key={v} value={v}>{VISIBILITY_LABELS[v] ?? v}</option>)}
                  </select>
                  <svg style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div> */}
            </div>

            {/* Scoring */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#909499" }}>Система подсчёта</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {SCORING_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setScoring(opt.id)}
                    style={{
                      flex: 1, padding: "13px 15px", borderRadius: "10px", textAlign: "left",
                      background: scoring === opt.id ? "rgba(0,119,255,0.08)" : "transparent",
                      border: `1px solid ${scoring === opt.id ? "#0077FF" : "#363738"}`,
                      cursor: "pointer",
                      display: "flex", flexDirection: "column", gap: "2px",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#E7E8EA" }}>{opt.label}</span>
                    <span style={{ fontSize: "12px", color: "#76787A", textAlign: "left" }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#909499" }}>Сложность</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {DIFFICULTY_OPTIONS.map(({ label, color }) => (
                  <button
                    key={label}
                    onClick={() => setDifficulty(label)}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: "10px", cursor: "pointer",
                      fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif",
                      background: difficulty === label ? `${color}1A` : "transparent",
                      border: `1px solid ${difficulty === label ? color : "#363738"}`,
                      color: difficulty === label ? color : "#76787A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#909499" }}>
                Теги <span style={{ color: "#76787A" }}></span>
              </label>
              <TagsField tags={tags} onChange={setTags} />
            </div>
          </div>
        </div>

        {/* ── Right column: live preview ── */}
        <div className="split-preview-col" style={{
          flex: 1,
          background: "#19191A",
          borderLeft: "1px solid #363738",
          padding: "48px 40px 48px 41px",
          position: "relative",
          overflow: "hidden",
          overflowY: "auto",
        }}>

          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "15px" }}>
            <span style={{
              fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#76787A",
            }}>
              Предпросмотр
            </span>

            <div className="preview-card" style={{
              width: "460px",
              maxWidth: "100%",
              background: "#232324", border: "1px solid #363738", borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 1px rgba(255,255,255,0.04)",
              overflow: "hidden",
            }}>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverUpload(file);
                  e.target.value = "";
                }}
              />
              {coverImageUrl ? (
                <div style={{ position: "relative", margin: "25px 25px 0", height: "152px", borderRadius: "10px", overflow: "hidden", border: "1px solid #363738", background: "#1A1A1B" }}>
                  {/* Blurred backdrop fills the frame so any aspect ratio looks clean */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImageUrl} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(24px)", transform: "scale(1.2)" }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImageUrl} alt="Обложка квиза" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                    <button
                      onClick={() => coverInputRef.current?.click()}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6,
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
                      onClick={() => setCoverImageUrl(null)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6,
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
                  onClick={() => !coverUploading && coverInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setCoverDragOver(true); }}
                  onDragLeave={() => setCoverDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setCoverDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleCoverUpload(file);
                  }}
                  style={{
                    margin: "25px 25px 0",
                    height: "152px", borderRadius: "10px",
                    background: title ? (CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.Engineering) : "linear-gradient(161deg, #E64646 0%, rgba(230,70,70,0.6) 100%)",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "8px",
                    cursor: coverUploading ? "default" : "pointer",
                    outline: coverDragOver ? "2px dashed rgba(255,255,255,0.8)" : "none", outlineOffset: "-6px",
                  }}
                >
                  {coverUploading ? (
                    <>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeDasharray="40 16" strokeLinecap="round">
                          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                        </circle>
                      </svg>
                      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>Загружаем…</span>
                    </>
                  ) : (
                    <>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>Нажмите для выбора обложки</span>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>JPG, PNG, GIF, WEBP · до 5 МБ</span>
                    </>
                  )}
                </div>
              )}

              <div style={{ padding: "0 25px 25px" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "4px 10px 3px", borderRadius: "999px",
                  background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", marginTop: "16px", marginBottom: "8px",
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#fff" }}>
                    {CATEGORY_LABELS[category] ?? category}
                  </span>
                </div>
                {(() => {
                  const diff = DIFFICULTY_OPTIONS.find((d) => d.label === difficulty);
                  if (!diff) return null;
                  return (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      padding: "4px 10px 3px", borderRadius: "999px", marginLeft: "6px",
                      background: `${diff.color}1A`, border: `1px solid ${diff.color}55`,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: diff.color }} />
                      <span style={{ fontSize: "12px", fontWeight: 600, color: diff.color }}>{diff.label}</span>
                    </div>
                  );
                })()}

                <p style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px", color: "#E7E8EA", minHeight: "28px" }}>
                  {title || <span style={{ color: "#76787A", fontWeight: 400, fontSize: "16px" }}>Здесь появится название квиза</span>}
                </p>

                {description && (
                  <p style={{ fontSize: "14px", lineHeight: "21px", color: "#909499", margin: "0 0 16px" }}>
                    {description}
                  </p>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: description ? "0" : "16px" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span style={{ fontSize: "13px", color: "#76787A" }}>
                    {SCORING_OPTIONS.find((s) => s.id === scoring)?.label}
                  </span>
                </div>

                {tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "14px" }}>
                    {tags.map((tag) => (
                      <span key={tag} style={{
                        padding: "3px 9px", borderRadius: "999px",
                        background: "rgba(0,119,255,0.1)", border: "1px solid rgba(0,119,255,0.25)",
                        color: "#71AAEB", fontSize: "12px",
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "#76787A", textAlign: "center" }}>
              Игроки видят эту карточку перед входом.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile-only: save actions pinned to the bottom of the page */}
      <div className="mobile-continue-bar" style={{ display: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !title.trim()}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              height: 48, borderRadius: 10, border: "none",
              background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
              boxShadow: "0 4px 16px rgba(0,119,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              color: "#E7E8EA", fontSize: 15, fontWeight: 600,
              cursor: title.trim() ? "pointer" : "not-allowed",
              opacity: title.trim() ? 1 : 0.5,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Сохранить и продолжить
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !title.trim()}
            style={{
              width: "100%", height: 44, borderRadius: 10,
              background: "transparent", border: "1px solid #363738",
              color: "#909499", fontSize: 14, fontWeight: 600,
              cursor: title.trim() ? "pointer" : "not-allowed",
              opacity: title.trim() ? 1 : 0.5,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Сохранить черновик
          </button>
        </div>
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 30px; height: 30px;
          border-radius: 50%;
          background: linear-gradient(180deg, #0077FF, #005CC4);
          box-shadow: 0 4px 12px rgba(0,119,255,0.4);
          cursor: pointer;
          margin-top: -12px;
        }
        input[type=range]::-moz-range-thumb {
          width: 30px; height: 30px;
          border-radius: 50%; border: none;
          background: linear-gradient(180deg, #0077FF, #005CC4);
          box-shadow: 0 4px 12px rgba(0,119,255,0.4);
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-runnable-track { height: 6px; }
        input[type=range]::-moz-range-track { height: 6px; background: transparent; }
        select option { background: #232324; color: #E7E8EA; }
      `}</style>
    </div>
  );
}

function TagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startAdding() {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    const val = input.trim().toLowerCase().replace(/\s+/g, "-");
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput("");
    setAdding(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setInput(""); setAdding(false); }
  }

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center",
      padding: "10px 12px", borderRadius: 8,
      background: "#232324", border: "1px solid #363738", minHeight: 44, boxSizing: "border-box",
    }}>
      {tags.map((tag) => (
        <span key={tag} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 8px 4px 10px", borderRadius: 999,
          background: "rgba(0,119,255,0.1)", border: "1px solid rgba(0,119,255,0.25)",
          color: "#71AAEB", fontSize: 13,
        }}>
          {tag}
          <button
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#0077FF", lineHeight: 1, padding: 0, display: "flex", alignItems: "center",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
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
            width: 100, padding: "4px 10px", borderRadius: 999,
            background: "rgba(0,119,255,0.08)", border: "1px solid rgba(0,119,255,0.4)",
            color: "#E7E8EA", fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none",
          }}
        />
      ) : (
        <button
          onClick={startAdding}
          style={{
            padding: "4px 10px", borderRadius: 999,
            background: "transparent", border: "1px dashed #363738",
            color: "#76787A", fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}
        >+ добавить</button>
      )}
    </div>
  );
}

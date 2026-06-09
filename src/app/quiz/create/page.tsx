"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
const VISIBILITIES = ["Public", "Private · invite only"];
const VISIBILITY_LABELS: Record<string, string> = {
  "Public": "Публично",
  "Private · invite only": "Приватно · только по приглашению",
};
const SCORING_OPTIONS = [
  { id: "standard",  label: "Стандарт",        desc: "Очки только за правильность" },
  { id: "speed",     label: "Бонус за скорость", desc: "Быстрые ответы дают больше" },
  { id: "streak",    label: "Серия",             desc: "Множитель комбо" },
];

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

export default function CreateQuizPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Engineering");
  const [visibility, setVisibility] = useState("Private · invite only");
  const [scoring, setScoring] = useState("standard");
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const userName = session?.user?.name ?? "Вы";
  const initials = getInitials(userName);

  async function handleSave(andContinue: boolean) {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, scoring }),
      });
      if (!res.ok) throw new Error("Failed");
      const quiz = await res.json();
      if (andContinue) router.push(`/quiz/${quiz.id}/edit`);
      else router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#19191A", minHeight: "100vh", color: "#E7E8EA", fontFamily: "Inter, sans-serif" }}>

      {/* ── Nav ── */}
      <nav style={{
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
            {(["Главная", "Мои квизы", "Аналитика"] as const).map((label) => (
              <Link key={label} href={label === "Главная" ? "/dashboard" : "#"} style={{
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
          <div style={{
            padding: "4px 10px", borderRadius: "999px",
            background: "rgba(0,119,255,0.12)",
            fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em",
            textTransform: "uppercase", color: "#71AAEB",
          }}>
            ОРГАНИЗАТОР
          </div>
          <div style={{ position: "relative" }}>
            <div onClick={() => setMenuOpen((v) => !v)} style={{
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
              <span style={{ fontSize: "14px", fontWeight: 500 }}>{userName}</span>
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

      {/* ── Sub-header: breadcrumb + buttons ── */}
      <div style={{
        borderBottom: "1px solid #363738",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 48px 21px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link href="/dashboard" style={{ fontSize: "14px", color: "#909499", textDecoration: "none" }}>
            Мои квизы
          </Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#909499" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#E7E8EA" }}>Новый квиз</span>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
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

      {/* ── Body: left form + right preview ── */}
      <div style={{ display: "flex", height: "calc(100vh - 130px)" }}>

        {/* ── Left column ── */}
        <div style={{ flex: "0 0 900px", padding: "48px 64px", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "14px", flexShrink: 0,
                background: "linear-gradient(180deg, #0077FF, #005CC4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 700, color: "#fff",
              }}>1</div>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#E7E8EA" }}>Детали квиза</span>
            </div>
            <div style={{ width: "80px", height: "2px", background: "#363738", margin: "0 16px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "14px", flexShrink: 0,
                background: "#2C2D2E", border: "1px solid #363738",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 700, color: "#76787A",
              }}>2</div>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#76787A" }}>Вопросы</span>
            </div>
            <div style={{ width: "80px", height: "2px", background: "#363738", margin: "0 16px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "14px", flexShrink: 0,
                background: "#2C2D2E", border: "1px solid #363738",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 700, color: "#76787A",
              }}>3</div>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#76787A" }}>Проверка и публикация</span>
            </div>
          </div>

          <h1 style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
            Расскажите о квизе
          </h1>
          <p style={{ fontSize: "15px", color: "#909499", margin: "0 0 8px" }}>
            Вы можете изменить это позже. Название и категория помогут игрокам найти квиз.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "22px", paddingTop: "22px", width: "540px" }}>

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

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
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
              </div>
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
          </div>
        </div>

        {/* ── Right column: live preview ── */}
        <div style={{
          flex: 1,
          background: "#19191A",
          borderLeft: "1px solid #363738",
          padding: "48px 40px 48px 41px",
          position: "relative",
          overflow: "hidden",
          overflowY: "auto",
        }}>
          <div style={{
            position: "absolute",
            width: "400px", height: "400px", borderRadius: "50%",
            background: "radial-gradient(circle at 50% 50%, rgba(0,119,255,1) 0%, rgba(0,119,255,0) 60%)",
            top: "-200px", left: "70px",
            opacity: 0.15, filter: "blur(40px)", pointerEvents: "none",
          }} />

          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "15px" }}>
            <span style={{
              fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#76787A",
            }}>
              Предпросмотр
            </span>

            <div style={{
              width: "460px",
              background: "#232324", border: "1px solid #363738", borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 1px rgba(255,255,255,0.04)",
              overflow: "hidden",
            }}>
              <div style={{
                margin: "25px 25px 0",
                height: "152px", borderRadius: "10px",
                background: title ? (CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.Engineering) : "linear-gradient(161deg, #E64646 0%, rgba(230,70,70,0.6) 100%)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: "8px",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>Нажмите для выбора обложки</span>
              </div>

              <div style={{ padding: "0 25px 25px" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "4px 10px 3px", borderRadius: "999px",
                  background: "rgba(230,70,70,0.12)", marginTop: "16px", marginBottom: "8px",
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#E64646" }}>
                    {CATEGORY_LABELS[category] ?? category}
                  </span>
                </div>

                <p style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px", color: "#E7E8EA", minHeight: "28px" }}>
                  {title || <span style={{ color: "#76787A", fontWeight: 400, fontSize: "16px" }}>Здесь появится название квиза</span>}
                </p>

                {description && (
                  <p style={{ fontSize: "14px", lineHeight: "21px", color: "#909499", margin: "0 0 16px" }}>
                    {description}
                  </p>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: description ? "0" : "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span style={{ fontSize: "13px", color: "#76787A" }}>30 с на вопрос</span>
                  </div>
                  <span style={{ color: "#76787A", fontSize: "13px" }}>·</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span style={{ fontSize: "13px", color: "#76787A" }}>
                      {SCORING_OPTIONS.find((s) => s.id === scoring)?.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "#76787A", textAlign: "center" }}>
              Игроки видят эту карточку перед входом.
            </p>
          </div>
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

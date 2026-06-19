"use client";

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type HistoryEntry = {
  id: string;
  sessionId: string;
  quizTitle: string;
  coverImageUrl: string | null;
  hostName: string;
  date: string;
  score: number;
  rank: number;
  totalPlayers: number;
};

type ActiveSession = {
  roomCode: string;
  quizTitle: string;
  status: string;
};

type Props = {
  user: { name: string; role: string };
  history: HistoryEntry[];
  activeSession?: ActiveSession | null;
};

const TABS = ["Все", "На этой неделе", "Лучшие результаты"] as const;
type Tab = (typeof TABS)[number];

const QUIZ_COLORS = ["#E64646", "#0077FF", "#4DC4FF", "#4BB34B", "#FFA000", "#F97316", "#A78BFA", "#14B8A6"];

const AVATAR_PALETTE = ["#0077FF","#E64646","#4BB34B","#FFA000","#4DC4FF","#F97316","#14B8A6","#A78BFA"];
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function quizColor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return QUIZ_COLORS[Math.abs(hash) % QUIZ_COLORS.length];
}

function formatDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return `Сегодня, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  if (d === 1) return "Вчера";
  return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric" });
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
    : parts[0][0].toUpperCase();
}

export default function ParticipantDashboard({ user, history, activeSession }: Props) {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Все");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // The dashboard is a server component, so the active-session query only runs
  // on a fresh server render. When returning here via the browser Back button,
  // Next.js restores the page from its router cache (rendered before joining the
  // quiz), hiding the "continue quiz" card. Refresh on mount so it shows up
  // without a manual reload.
  useEffect(() => {
    router.refresh();
  }, [router]);

  // While a session is live, poll so the "continue quiz" card disappears on its
  // own once the quiz finishes (status flips to FINISHED) — without a reload.
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [activeSession, router]);

  function handleCodeChange(i: number, val: string) {
    const char = val.replace(/[^a-zA-Z0-9]/g, "").slice(-1).toUpperCase();
    const next = [...code];
    next[i] = char;
    setCode(next);
    if (char && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
    const next = Array(6).fill("");
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setCode(next);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.join("").length < 6) return;
    setJoining(true);
    router.push(`/play/${code.join("")}`);
  }

  const filteredHistory = (() => {
    if (activeTab === "Все") return history;
    if (activeTab === "На этой неделе") {
      const weekAgo = Date.now() - 7 * 86_400_000;
      return history.filter((h) => new Date(h.date).getTime() > weekAgo);
    }
    if (activeTab === "Лучшие результаты") return [...history].sort((a, b) => a.rank - b.rank || b.score - a.score);
    return history;
  })();

  const initials = getInitials(user.name);

  return (
    <div style={{ background: "#19191A", minHeight: "100vh", color: "#E7E8EA", fontFamily: "Inter, sans-serif" }}>

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
            {(["Главная"] as const).map((label) => (
              <span key={label} style={{
                fontSize: "14px", fontWeight: 500, cursor: "pointer",
                color: label === "Главная" ? "#E7E8EA" : "#909499",
                padding: "8px 14px", borderRadius: "6px",
                background: label === "Главная" ? "rgba(255,255,255,0.05)" : "transparent",
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="nav-role-badge" style={{
            padding: "4px 10px", borderRadius: "999px",
            background: "rgba(75,179,75,0.12)",
            fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em",
            textTransform: "uppercase" as const, color: "#4BB34B",
          }}>
            {user.role === "PARTICIPANT" ? "УЧАСТНИК" : user.role}
          </div>

          <div style={{ position: "relative" }}>
            <div
              onClick={() => setMenuOpen((v) => !v)}
              className="nav-user-pill"
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "7px 15px 7px 7px", borderRadius: "999px",
                background: "#2C2D2E", border: "1px solid #363738",
                cursor: "pointer", userSelect: "none" as const,
              }}
            >
              <div style={{
                width: "28px", height: "28px", borderRadius: "14px",
                background: avatarBg(user.name),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {initials}
              </div>
              <span className="nav-user-name" style={{ fontSize: "14px", fontWeight: 500 }}>{user.name}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#76787A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      width: "100%", padding: "11px 14px",
                      background: "none", border: "none",
                      color: "#E64646", fontSize: "14px", fontWeight: 500,
                      cursor: "pointer", textAlign: "left" as const,
                    }}
                  >
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

      {/* ── Main content ── */}
      <div className="dash-main part-main" style={{ padding: "40px 48px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* ── Join card or Active session card ── */}
        {activeSession ? (
          <div className="part-active-card" style={{
            position: "relative",
            borderRadius: "20px",
            background: "linear-gradient(170deg, rgba(75,179,75,0.12) 0%, rgba(75,179,75,0.06) 100%)",
            border: "1px solid rgba(75,179,75,0.3)",
            padding: "45px 49px",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "32px",
          }}>
            <div style={{
              position: "absolute", width: "400px", height: "400px", borderRadius: "50%",
              background: "radial-gradient(circle at 50% 50%, rgba(75,179,75,0.6) 0%, rgba(75,179,75,0) 60%)",
              top: "-78px", left: "-80px", opacity: 0.25, filter: "blur(40px)", pointerEvents: "none",
            }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "4px 12px 3px", borderRadius: "999px",
                background: "rgba(75,179,75,0.14)", alignSelf: "flex-start",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4BB34B", boxShadow: "0 0 6px #4BB34B" }} />
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#4BB34B" }}>
                  {activeSession.status === "WAITING" ? "Ждём начала" : "Квиз идёт"}
                </span>
              </div>
              <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: "1.2", margin: 0, color: "#E7E8EA" }}>
                Вы участвуете в квизе
              </h1>
              <p style={{ fontSize: "20px", fontWeight: 600, color: "#71AAEB", margin: 0 }}>
                {activeSession.quizTitle}
              </p>
              <p style={{ fontSize: "15px", color: "#909499", margin: 0 }}>
                Нажмите, чтобы продолжить с того места, где остановились.
              </p>
            </div>

            <button
              onClick={() => router.push(`/play/${activeSession.roomCode}`)}
              className="part-active-btn"
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: "0 32px", height: "56px", borderRadius: "12px",
                background: "linear-gradient(180deg, #4BB34B 0%, #3a8f3a 100%)",
                border: "none", color: "#fff",
                fontSize: "16px", fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Продолжить квиз
            </button>
          </div>
        ) : (
          <div className="part-join-card" style={{
            position: "relative",
            borderRadius: "20px",
            background: "linear-gradient(170deg, rgba(0,119,255,0.14) 0%, rgba(0,92,196,0.08) 100%)",
            border: "1px solid rgba(0,119,255,0.25)",
            padding: "45px 49px",
            overflow: "hidden",
            display: "flex", gap: "0",
          }}>
            <div style={{
              position: "absolute",
              width: "400px", height: "400px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 50% 50%, rgba(0,119,255,1) 0%, rgba(0,119,255,0) 60%)",
              top: "-78px", right: "942px",
              opacity: 0.3,
              filter: "blur(40px)",
              pointerEvents: "none",
            }} />

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8.8px", justifyContent: "center" }}>
              <div style={{
                display: "inline-flex", alignItems: "center",
                padding: "4px 10px 3px", borderRadius: "999px",
                background: "rgba(0,119,255,0.12)",
                alignSelf: "flex-start",
              }}>
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#71AAEB" }}>
                  Живая комната?
                </span>
              </div>
              <h1 style={{ fontSize: "38px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: "41.8px", margin: 0 }}>
                Заходи. Введи свой код.
              </h1>
              <p style={{ fontSize: "15px", color: "#909499", margin: 0, lineHeight: "1.5" }}>
                Шесть символов от хоста — буквы или цифры,{"\n"}регистр не важен.
              </p>
            </div>

            <form onSubmit={handleJoin} className="part-join-form" style={{ width: "603px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="part-code-inputs" style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                {code.map((ch, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputs.current[i] = el; }}
                    value={ch}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    maxLength={1}
                    className="part-code-input"
                    style={{
                      width: "92px",
                      height: "75px",
                      textAlign: "center",
                      fontSize: "36px",
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      background: "#19191A",
                      border: `2px solid #0077FF`,
                      borderRadius: "12px",
                      color: "#E7E8EA",
                      outline: "none",
                      boxShadow: "0 0 20px rgba(0,119,255,0.3)",
                    }}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={code.join("").length < 6 || joining}
                style={{
                  width: "100%", height: "52px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  borderRadius: "10px",
                  background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
                  boxShadow: "0 4px 16px rgba(0,119,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#E7E8EA",
                  fontSize: "16px", fontWeight: 600,
                  cursor: code.join("").length < 6 ? "not-allowed" : "pointer",
                  opacity: code.join("").length < 6 ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {joining ? "Вход…" : "Войти в комнату"}
                {!joining && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── History section ── */}
        <div>
          <div className="part-history-meta" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 0 0",
          }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>
              Моя история{" "}
              <span style={{ fontWeight: 400, color: "#76787A" }}>· {history.length} сессий</span>
            </h2>

            <div className="part-tabs" style={{ display: "flex", gap: "8px" }}>
              {TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "6px 14px", borderRadius: "6px",
                  fontSize: "13px", fontWeight: 500,
                  background: activeTab === tab ? "#2C2D2E" : "transparent",
                  boxShadow: activeTab === tab ? "inset 0 0 0 1px #363738" : "none",
                  border: "none",
                  color: activeTab === tab ? "#E7E8EA" : "#909499",
                  cursor: "pointer",
                }}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            {filteredHistory.length === 0 ? (
              <div style={{
                background: "#232324", border: "1px solid #363738", borderRadius: "12px",
                textAlign: "center", padding: "4rem 2rem", color: "#76787A",
              }}>
                <p style={{ fontSize: "16px", fontWeight: 600, color: "#909499", margin: "0 0 8px" }}>Сессий пока нет</p>
                <p style={{ fontSize: "14px", margin: 0 }}>Войдите в комнату по коду от хоста.</p>
              </div>
            ) : (
              <div style={{
                background: "#232324", border: "1px solid #363738", borderRadius: "12px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 1px rgba(255,255,255,0.04)",
                overflow: "hidden",
              }}>
                <div className="part-history-header" style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr 0.8fr 0.7fr 0.7fr",
                  padding: "12px 20px 13px",
                  borderBottom: "1px solid #363738",
                }}>
                  {[
                    { label: "Квиз", align: "left", cls: "" },
                    { label: "Хост", align: "left", cls: "part-history-host" },
                    { label: "Дата", align: "left", cls: "part-history-date" },
                    { label: "Счёт", align: "right", cls: "" },
                    { label: "Место", align: "right", cls: "" },
                  ].map(({ label, align, cls }) => (
                    <span key={label} className={cls} style={{
                      fontSize: "12px", fontWeight: 600,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: "#76787A", textAlign: align as "left" | "right",
                    }}>
                      {label}
                    </span>
                  ))}
                </div>

                {filteredHistory.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="part-history-row"
                    onClick={() => router.push(`/results/${entry.sessionId}`)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 1fr 0.8fr 0.7fr 0.7fr",
                      alignItems: "center",
                      padding: "14px 20px 15px",
                      borderBottom: i < filteredHistory.length - 1 ? "1px solid #363738" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "7px",
                        background: quizColor(entry.quizTitle),
                        flexShrink: 0, overflow: "hidden",
                      }}>
                        {entry.coverImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.coverImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#E7E8EA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.quizTitle}
                      </span>
                    </div>

                    <span className="part-history-host" style={{ fontSize: "14px", color: "#909499", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.hostName}</span>
                    <span className="part-history-date" style={{ fontSize: "14px", color: "#909499" }}>{formatDate(entry.date)}</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#E7E8EA", textAlign: "right" }}>
                      {entry.score.toLocaleString()}
                    </span>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      {entry.rank <= 3 ? (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "4.5px 10px", borderRadius: "999px",
                          background: "rgba(255,160,0,0.14)",
                        }}>
                          <span style={{ fontSize: "12px" }}>🏆</span>
                          <span style={{
                            fontSize: "12px", fontWeight: 600,
                            letterSpacing: "0.02em", textTransform: "uppercase",
                            color: "#FFA000",
                          }}>
                            #{entry.rank} / {entry.totalPlayers}
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "3.5px 10px", borderRadius: "999px",
                          background: "rgba(144,148,153,0.1)",
                        }}>
                          <span style={{
                            fontSize: "12px", fontWeight: 600,
                            letterSpacing: "0.02em", textTransform: "uppercase",
                            color: "#909499",
                          }}>
                            #{entry.rank} / {entry.totalPlayers}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

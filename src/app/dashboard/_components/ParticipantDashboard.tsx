"use client";

import { useRef, useState, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type HistoryEntry = {
  id: string;
  quizTitle: string;
  hostName: string;
  date: string;
  score: number;
  rank: number;
  totalPlayers: number;
};

type Props = {
  user: { name: string; role: string };
  history: HistoryEntry[];
};

const TABS = ["All", "This week", "Top finishes"] as const;
type Tab = (typeof TABS)[number];

const QUIZ_COLORS = ["#FF6584", "#6C63FF", "#4DC4FF", "#43D98F", "#FFB547", "#F97316", "#A78BFA", "#14B8A6"];

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
  if (d === 0) return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (d === 1) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
    : parts[0][0].toUpperCase();
}

export default function ParticipantDashboard({ user, history }: Props) {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

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
    if (activeTab === "All") return history;
    if (activeTab === "This week") {
      const weekAgo = Date.now() - 7 * 86_400_000;
      return history.filter((h) => new Date(h.date).getTime() > weekAgo);
    }
    if (activeTab === "Top finishes") return history.filter((h) => h.rank <= 3);
    return history;
  })();

  const initials = getInitials(user.name);

  return (
    <div style={{ background: "#0F0E17", minHeight: "100vh", color: "#FFFFFE", fontFamily: "Inter, sans-serif" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(15, 14, 23, 0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #2E2E4A",
        height: "65px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px",
      }}>
        {/* Left: logo + links */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "7.84px",
              background: "linear-gradient(135deg, #6C63FF, #FF6584)",
              boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
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
            {(["Dashboard", "History"] as const).map((label) => (
              <span key={label} style={{
                fontSize: "14px", fontWeight: 500, cursor: "pointer",
                color: label === "Dashboard" ? "#FFFFFE" : "#A7A9BE",
                padding: "8px 14px", borderRadius: "6px",
                background: label === "Dashboard" ? "rgba(255,255,255,0.05)" : "transparent",
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: role badge + user pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            padding: "4px 10px", borderRadius: "999px",
            background: "rgba(255,101,132,0.12)",
            fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em",
            textTransform: "uppercase" as const, color: "#FF6584",
          }}>
            {user.role}
          </div>

          <div style={{ position: "relative" }}>
            <div
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "7px 15px 7px 7px", borderRadius: "999px",
                background: "#24243E", border: "1px solid #2E2E4A",
                cursor: "pointer", userSelect: "none" as const,
              }}
            >
              <div style={{
                width: "28px", height: "28px", borderRadius: "14px",
                background: "linear-gradient(135deg, #6C63FF, #FF6584)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {initials}
              </div>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>{user.name}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#6E708A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 30,
                  minWidth: "160px", background: "#1A1A2E",
                  border: "1px solid #2E2E4A", borderRadius: "10px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
                }}>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      width: "100%", padding: "11px 14px",
                      background: "none", border: "none",
                      color: "#FF6584", fontSize: "14px", fontWeight: 500,
                      cursor: "pointer", textAlign: "left" as const,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div style={{ padding: "40px 48px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* ── Join card ── */}
        <div style={{
          position: "relative",
          borderRadius: "20px",
          background: "linear-gradient(170deg, rgba(108,99,255,0.18) 0%, rgba(255,101,132,0.12) 100%)",
          border: "1px solid rgba(108,99,255,0.3)",
          padding: "45px 49px",
          overflow: "hidden",
          display: "flex", gap: "0",
        }}>
          {/* Decorative blur blob */}
          <div style={{
            position: "absolute",
            width: "400px", height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 50%, rgba(108,99,255,1) 0%, rgba(108,99,255,0) 60%)",
            top: "-78px", right: "942px",
            opacity: 0.4,
            filter: "blur(40px)",
            pointerEvents: "none",
          }} />

          {/* Left: text */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8.8px", justifyContent: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center",
              padding: "4px 10px 3px", borderRadius: "999px",
              background: "rgba(255,101,132,0.12)",
              alignSelf: "flex-start",
            }}>
              <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#FF6584" }}>
                Live room?
              </span>
            </div>
            <h1 style={{ fontSize: "38px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: "41.8px", margin: 0 }}>
              Drop in. Punch in your code.
            </h1>
            <p style={{ fontSize: "15px", color: "#A7A9BE", margin: 0, lineHeight: "1.5" }}>
              Six characters from your host — letters or numbers,{"\n"}case insensitive.
            </p>
          </div>

          {/* Right: inputs + button */}
          <form onSubmit={handleJoin} style={{ width: "603px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Code inputs */}
            <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
              {code.map((ch, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  value={ch}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  maxLength={1}
                  style={{
                    width: "92px",
                    height: "75px",
                    textAlign: "center",
                    fontSize: "36px",
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    background: "#0F0E17",
                    border: `2px solid #6C63FF`,
                    borderRadius: "12px",
                    color: "#FFFFFE",
                    outline: "none",
                    boxShadow: "0 0 20px rgba(108,99,255,0.3)",
                  }}
                />
              ))}
            </div>

            {/* Join room button */}
            <button
              type="submit"
              disabled={code.join("").length < 6 || joining}
              style={{
                width: "100%", height: "52px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                borderRadius: "10px",
                background: "linear-gradient(180deg, #6C63FF 0%, #4B44CC 100%)",
                boxShadow: "0 4px 16px rgba(108,99,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                border: "none",
                color: "#FFFFFE",
                fontSize: "16px", fontWeight: 600,
                cursor: code.join("").length < 6 ? "not-allowed" : "pointer",
                opacity: code.join("").length < 6 ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {joining ? "Joining…" : "Join room"}
              {!joining && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </form>
        </div>

        {/* ── History section ── */}
        <div>
          {/* Section header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 0 0",
          }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>
              My History{" "}
              <span style={{ fontWeight: 400, color: "#6E708A" }}>· {history.length} sessions</span>
            </h2>

            {/* Filter pills */}
            <div style={{ display: "flex", gap: "8px" }}>
              {TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "6px 14px", borderRadius: "6px",
                  fontSize: "13px", fontWeight: 500,
                  background: activeTab === tab ? "#24243E" : "transparent",
                  boxShadow: activeTab === tab ? "inset 0 0 0 1px #2E2E4A" : "none",
                  border: "none",
                  color: activeTab === tab ? "#FFFFFE" : "#A7A9BE",
                  cursor: "pointer",
                }}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ marginTop: "16px" }}>
            {filteredHistory.length === 0 ? (
              <div style={{
                background: "#1A1A2E", border: "1px solid #2E2E4A", borderRadius: "12px",
                textAlign: "center", padding: "4rem 2rem", color: "#6E708A",
              }}>
                <p style={{ fontSize: "16px", fontWeight: 600, color: "#A7A9BE", margin: "0 0 8px" }}>No sessions yet</p>
                <p style={{ fontSize: "14px", margin: 0 }}>Join a room with a code from your host to get started.</p>
              </div>
            ) : (
              <div style={{
                background: "#1A1A2E", border: "1px solid #2E2E4A", borderRadius: "12px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 1px rgba(255,255,255,0.04)",
                overflow: "hidden",
              }}>
                {/* Header row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr 0.8fr 0.7fr 0.7fr",
                  padding: "12px 20px 13px",
                  borderBottom: "1px solid #2E2E4A",
                }}>
                  {[
                    { label: "Quiz", align: "left" },
                    { label: "Host", align: "left" },
                    { label: "Date", align: "left" },
                    { label: "Score", align: "right" },
                    { label: "Rank", align: "right" },
                  ].map(({ label, align }) => (
                    <span key={label} style={{
                      fontSize: "12px", fontWeight: 600,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: "#6E708A", textAlign: align as "left" | "right",
                    }}>
                      {label}
                    </span>
                  ))}
                </div>

                {/* Data rows */}
                {filteredHistory.map((entry, i) => (
                  <div
                    key={entry.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 1fr 0.8fr 0.7fr 0.7fr",
                      alignItems: "center",
                      padding: "14px 20px 15px",
                      borderBottom: i < filteredHistory.length - 1 ? "1px solid #2E2E4A" : "none",
                    }}
                  >
                    {/* Quiz */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "7px",
                        background: quizColor(entry.quizTitle),
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.quizTitle}
                      </span>
                    </div>

                    {/* Host */}
                    <span style={{ fontSize: "14px", color: "#A7A9BE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.hostName}</span>

                    {/* Date */}
                    <span style={{ fontSize: "14px", color: "#A7A9BE" }}>{formatDate(entry.date)}</span>

                    {/* Score */}
                    <span style={{
                      fontSize: "14px", fontWeight: 600, color: "#FFFFFE",
                      textAlign: "right",
                    }}>
                      {entry.score.toLocaleString()}
                    </span>

                    {/* Rank */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      {entry.rank <= 3 ? (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "4.5px 10px", borderRadius: "999px",
                          background: "rgba(255,181,71,0.14)",
                        }}>
                          <span style={{ fontSize: "12px" }}>🏆</span>
                          <span style={{
                            fontSize: "12px", fontWeight: 600,
                            letterSpacing: "0.02em", textTransform: "uppercase",
                            color: "#FFB547",
                          }}>
                            #{entry.rank} / {entry.totalPlayers}
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: "6px",
                          padding: "3.5px 10px", borderRadius: "999px",
                          background: "rgba(167,169,190,0.1)",
                        }}>
                          <span style={{
                            fontSize: "12px", fontWeight: 600,
                            letterSpacing: "0.02em", textTransform: "uppercase",
                            color: "#A7A9BE",
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

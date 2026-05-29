"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type Quiz = {
  id: string;
  title: string;
  category: string;
  questionCount: number;
  totalPlays: number;
  lastRun: string | null;
};

type Stats = {
  totalQuizzes: number;
  totalPlays: number;
  avgScore: number | null;
  activeRooms: number;
};

type Props = {
  user: { name: string; role: string };
  stats: Stats;
  quizzes: Quiz[];
};

// Category → gradient color (from Figma)
const CATEGORY_GRADIENTS: Record<string, string> = {
  Engineering: "linear-gradient(165deg, #FF6584 0%, rgba(255,101,132,0.6) 100%)",
  Internal:    "linear-gradient(165deg, #6C63FF 0%, rgba(108,99,255,0.6) 100%)",
  General:     "linear-gradient(165deg, #43D98F 0%, rgba(67,217,143,0.6) 100%)",
  Education:   "linear-gradient(165deg, #FFB547 0%, rgba(255,181,71,0.6) 100%)",
  Entertainment:"linear-gradient(165deg, #4DC4FF 0%, rgba(77,196,255,0.6) 100%)",
  Science:     "linear-gradient(165deg, #06B6D4 0%, rgba(6,182,212,0.6) 100%)",
  History:     "linear-gradient(165deg, #F97316 0%, rgba(249,115,22,0.6) 100%)",
  Geography:   "linear-gradient(165deg, #14B8A6 0%, rgba(20,184,166,0.6) 100%)",
};

function categoryGradient(cat: string) {
  return CATEGORY_GRADIENTS[cat] ?? "linear-gradient(165deg, #6E708A 0%, rgba(110,112,138,0.6) 100%)";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 14) return "Last week";
  return `${Math.floor(d / 7)} weeks ago`;
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
    : parts[0][0].toUpperCase();
}

const TABS = ["All", "Published", "Drafts", "Archived"] as const;
type Tab = (typeof TABS)[number];

export default function OrganizerDashboard({ user, stats, quizzes }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = activeTab === "All" ? quizzes : [];

  async function handleDelete(id: string) {
    if (!confirm("Delete this quiz? This action cannot be undone.")) return;
    setDeletingId(id);
    await fetch(`/api/quiz/${id}`, { method: "DELETE" });
    router.refresh();
    setDeletingId(null);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];
  const initials = getInitials(user.name);

  return (
    <div style={{ background: "#0F0E17", minHeight: "100vh", color: "#FFFFFE", fontFamily: "Inter, sans-serif" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(15, 14, 23, 0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #2E2E4A",
        height: "65px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
      }}>
        {/* Left: logo + links */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "28px", height: "28px",
              borderRadius: "7.84px",
              background: "linear-gradient(135deg, #6C63FF, #FF6584)",
              boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="16" height="11" viewBox="8 11 20 14" fill="none">
                <path d="M10.5825 18H13.0552L14.7036 13.055L18 22.946L19.649 18H25.418"
                  stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em" }}>Pulse</span>
          </div>

          {/* Nav links */}
          <div style={{ display: "flex", gap: "4px" }}>
            {(["Dashboard", "My Quizzes", "Analytics"] as const).map((label) => (
              <span key={label} style={{
                fontSize: "14px",
                fontWeight: 500,
                color: label === "Dashboard" ? "#FFFFFE" : "#A7A9BE",
                cursor: "pointer",
                padding: "8px 14px",
                borderRadius: "6px",
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
            padding: "4px 10px",
            borderRadius: "999px",
            background: "rgba(108,99,255,0.15)",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.02em",
            textTransform: "uppercase" as const,
            color: "#B9B3FF",
          }}>
            {user.role}
          </div>

          {/* User pill + dropdown */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "7px 15px 7px 7px",
                borderRadius: "999px",
                background: "#24243E",
                border: "1px solid #2E2E4A",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <div style={{
                width: "28px", height: "28px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #6C63FF, #FF6584)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 700, color: "#fff",
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFE" }}>{user.name}</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#6E708A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Dropdown */}
            {menuOpen && (
              <>
                {/* Click-outside overlay */}
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 20 }}
                />
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 30,
                  minWidth: "160px",
                  background: "#1A1A2E",
                  border: "1px solid #2E2E4A",
                  borderRadius: "10px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  overflow: "hidden",
                }}>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      width: "100%", padding: "11px 14px",
                      background: "none", border: "none",
                      color: "#FF6584", fontSize: "14px", fontWeight: 500,
                      cursor: "pointer", textAlign: "left",
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

        {/* ── Header row ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            {/* "Organizer workspace" badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px 3px",
              borderRadius: "999px",
              background: "rgba(108,99,255,0.15)",
              marginBottom: "8px",
            }}>
              <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#B9B3FF" }}>
                Organizer workspace
              </span>
            </div>
            <h1 style={{ fontSize: "36px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px", lineHeight: 1.1 }}>
              {greeting}, {firstName} 👋
            </h1>
            <p style={{ fontSize: "16px", color: "#A7A9BE", margin: 0 }}>
              {stats.activeRooms > 0
                ? `You have ${stats.activeRooms} active room${stats.activeRooms > 1 ? "s" : ""} right now.`
                : "You have 2 quizzes scheduled this week."}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
            {/* Search button */}
            <button style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "0 18px",
              width: "108px", height: "40px",
              borderRadius: "8px",
              background: "#24243E",
              boxShadow: "inset 0 0 0 1px rgba(61,61,95,1)",
              border: "none",
              color: "#FFFFFE",
              fontSize: "14px", fontWeight: 600,
              cursor: "pointer",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Search
            </button>

            {/* Create Quiz button — purple gradient */}
            <Link href="/quiz/create" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "0 28px",
              height: "52px",
              borderRadius: "10px",
              background: "linear-gradient(180deg, #6C63FF 0%, #4B44CC 100%)",
              boxShadow: "0 4px 16px rgba(108,99,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              color: "#FFFFFE",
              fontSize: "16px", fontWeight: 600,
              textDecoration: "none",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Quiz
            </Link>
          </div>
        </div>

        {/* ── Stats row (4 columns) ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          paddingTop: "16px",
        }}>
          {[
            {
              label: "Total quizzes",
              value: stats.totalQuizzes,
              delta: `+${stats.totalQuizzes} this week`,
              deltaColor: "#6C63FF",
              icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#tq)">
                    <path d="M8.66663 1.3335L2.66663 9.3335H7.33329L6.66663 14.6668L12.6666 6.66683H7.99996L8.66663 1.3335Z" stroke="#6C63FF" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                  <defs><clipPath id="tq"><rect width="16" height="16" fill="white"/></clipPath></defs>
                </svg>
              ),
            },
            {
              label: "Total plays",
              value: stats.totalPlays.toLocaleString(),
              delta: `+${stats.totalPlays} this week`,
              deltaColor: "#43D98F",
              icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#tp)">
                    <path d="M11.3333 14V12.6667C11.3333 11.9594 11.0523 11.2811 10.5522 10.781C10.0521 10.281 9.37387 10 8.66663 10H3.33329C2.62605 10 1.94777 10.281 1.44767 10.781C0.947578 11.2811 0.666626 11.9594 0.666626 12.6667V14M15.3333 14V12.6667C15.3329 12.0758 15.1362 11.5018 14.7742 11.0349C14.4122 10.5679 13.9054 10.2344 13.3333 10.0867M10.6666 2.08667C11.2402 2.23353 11.7487 2.56713 12.1117 3.03487C12.4748 3.50261 12.6719 4.07789 12.6719 4.67C12.6719 5.26211 12.4748 5.83739 12.1117 6.30513C11.7487 6.77287 11.2402 7.10647 10.6666 7.25333M5.99996 7.33333C6.7072 7.33333 7.38548 7.05238 7.88558 6.55229C8.38567 6.05219 8.66663 5.37391 8.66663 4.66667C8.66663 3.95942 8.38567 3.28115 7.88558 2.78105C7.38548 2.28095 6.7072 2 5.99996 2C5.29272 2 4.61444 2.28095 4.11434 2.78105C3.61424 3.28115 3.33329 3.95942 3.33329 4.66667C3.33329 5.37391 3.61424 6.05219 4.11434 6.55229C4.61444 7.05238 5.29272 7.33333 5.99996 7.33333Z" stroke="#43D98F" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                  <defs><clipPath id="tp"><rect width="16" height="16" fill="white"/></clipPath></defs>
                </svg>
              ),
            },
            {
              label: "Avg. score",
              value: stats.avgScore != null ? `${stats.avgScore}%` : "—",
              delta: stats.avgScore != null ? "+4% vs last month" : "No data yet",
              deltaColor: "#FFB547",
              icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#as)">
                    <path d="M8.00004 14.6668C9.76815 14.6668 11.4638 13.9645 12.7141 12.7142C13.9643 11.464 14.6667 9.76827 14.6667 8.00016C14.6667 6.23205 13.9643 4.53636 12.7141 3.28612C11.4638 2.03588 9.76815 1.3335 8.00004 1.3335C6.23193 1.3335 4.53624 2.03588 3.286 3.28612C2.03575 4.53636 1.33337 6.23205 1.33337 8.00016C1.33337 9.76827 2.03575 11.464 3.286 12.7142C4.53624 13.9645 6.23193 14.6668 8.00004 14.6668ZM8.00004 12.0002C9.06091 12.0002 10.0783 11.5787 10.8285 10.8286C11.5786 10.0784 12 9.06103 12 8.00016C12 6.9393 11.5786 5.92188 10.8285 5.17174C10.0783 4.42159 9.06091 4.00016 8.00004 4.00016C6.93917 4.00016 5.92176 4.42159 5.17161 5.17174C4.42147 5.92188 4.00004 6.9393 4.00004 8.00016C4.00004 9.06103 4.42147 10.0784 5.17161 10.8286C5.92176 11.5787 6.93917 12.0002 8.00004 12.0002ZM8.00004 9.3335C8.35366 9.3335 8.6928 9.19302 8.94285 8.94297C9.1929 8.69292 9.33337 8.35378 9.33337 8.00016C9.33337 7.64654 9.1929 7.3074 8.94285 7.05735C8.6928 6.80731 8.35366 6.66683 8.00004 6.66683C7.64642 6.66683 7.30728 6.80731 7.05723 7.05735C6.80718 7.3074 6.66671 7.64654 6.66671 8.00016C6.66671 8.35378 6.80718 8.69292 7.05723 8.94297C7.30728 9.19302 7.64642 9.3335 8.00004 9.3335Z" stroke="#FFB547" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                  <defs><clipPath id="as"><rect width="16" height="16" fill="white"/></clipPath></defs>
                </svg>
              ),
            },
            {
              label: "Active rooms",
              value: stats.activeRooms,
              delta: stats.activeRooms === 0 ? "No live rooms" : "Live now",
              deltaColor: stats.activeRooms > 0 ? "#43D98F" : "#6E708A",
              icon: (
                <svg width="10" height="11" viewBox="0 0 10 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.666687 0.666504L8.66669 5.33317L0.666687 9.99984V0.666504Z" stroke="#6E708A" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
          ].map((card) => (
            <div key={card.label} style={{
              background: "#1A1A2E",
              border: "1px solid #2E2E4A",
              borderRadius: "12px",
              padding: "21px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 1px rgba(255,255,255,0.04)",
              display: "flex", flexDirection: "column", gap: "6px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 400, color: "#A7A9BE" }}>{card.label}</span>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {card.icon}
                </div>
              </div>
              <p style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: "32px", margin: 0 }}>
                {card.value}
              </p>
              <p style={{ fontSize: "12px", fontWeight: 500, color: card.deltaColor, margin: 0 }}>
                {card.delta}
              </p>
            </div>
          ))}
        </div>

        {/* ── Quiz list section ── */}
        <div style={{ paddingTop: "16px" }}>
          {/* Section header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>
              My Quizzes{" "}
              <span style={{ fontWeight: 400, color: "#6E708A" }}>· {stats.totalQuizzes}</span>
            </h2>

            {/* Filter tabs as pills */}
            <div style={{ display: "flex", gap: "8px" }}>
              {TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: activeTab === tab ? "#24243E" : "transparent",
                  boxShadow: activeTab === tab ? "inset 0 0 0 1px rgba(61,61,95,1)" : "inset 0 0 0 1px rgba(0,0,0,0)",
                  border: "none",
                  color: activeTab === tab ? "#FFFFFE" : "#A7A9BE",
                  cursor: "pointer",
                }}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* ── Quiz cards grid ── */}
          <div style={{ marginTop: "20px" }}>
            {filtered.length === 0 && activeTab === "All" ? (
              <div style={{ textAlign: "center", padding: "5rem 2rem", color: "#6E708A" }}>
                <p style={{ fontSize: "16px", fontWeight: 600, color: "#A7A9BE", margin: "0 0 8px" }}>No quizzes yet</p>
                <p style={{ fontSize: "14px", margin: 0 }}>Create your first quiz to get started.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 2rem", color: "#6E708A" }}>
                <p>Coming soon</p>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "15px",
              }}>
                {filtered.map((quiz) => (
                  <div key={quiz.id} style={{
                    background: "#1A1A2E",
                    border: "1px solid #2E2E4A",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 1px rgba(255,255,255,0.04)",
                  }}>
                    {/* Card image header */}
                    <div style={{
                      height: "120px",
                      background: categoryGradient(quiz.category),
                      position: "relative",
                      overflow: "hidden",
                    }}>
                      {/* Decorative white circle */}
                      <div style={{
                        position: "absolute",
                        width: "140px", height: "140px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.18)",
                        top: "10px", right: "-14px",
                      }} />

                      {/* Category badge — blurred dark overlay */}
                      <div style={{
                        position: "absolute",
                        top: "16px", left: "16px",
                        padding: "3.5px 10px",
                        borderRadius: "999px",
                        background: "rgba(0,0,0,0.3)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "#fff" }}>
                          {quiz.category}
                        </span>
                      </div>

                      {/* Questions · Plays */}
                      <div style={{
                        position: "absolute",
                        bottom: "0", left: "16px",
                        display: "flex", gap: "14px", alignItems: "center",
                        paddingBottom: "10px",
                      }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{quiz.questionCount} questions</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>·</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{quiz.totalPlays.toLocaleString()} plays</span>
                      </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      <p style={{ fontSize: "16px", fontWeight: 600, color: "#FFFFFE", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {quiz.title}
                      </p>

                      {/* Last run */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6E708A" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span style={{ fontSize: "13px", color: "#6E708A" }}>{quiz.lastRun ? timeAgo(quiz.lastRun) : "Draft"}</span>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "6px", paddingTop: "12.7px" }}>
                        {/* Run button */}
                        <Link href={`/quiz/${quiz.id}/run`} style={{
                          flex: 1,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                          height: "32px",
                          borderRadius: "8px",
                          background: "linear-gradient(180deg, #6C63FF 0%, #4B44CC 100%)",
                          boxShadow: "0 4px 16px rgba(108,99,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                          color: "#FFFFFE",
                          fontSize: "13px", fontWeight: 600,
                          textDecoration: "none",
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          Run
                        </Link>

                        {/* Edit button */}
                        <Link href={`/quiz/${quiz.id}/edit`} title="Edit" style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: "37px", height: "32px",
                          borderRadius: "8px",
                          background: "#24243E",
                          textDecoration: "none",
                          color: "#A7A9BE",
                        }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </Link>

                        {/* Delete button */}
                        <button onClick={() => handleDelete(quiz.id)} disabled={deletingId === quiz.id} title="Delete" style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: "37px", height: "32px",
                          borderRadius: "8px",
                          background: "transparent",
                          border: "none",
                          color: "#FF6584",
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
      </div>
    </div>
  );
}

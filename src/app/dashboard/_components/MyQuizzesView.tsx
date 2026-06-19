"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import QuizLibrary, { type LibraryQuiz } from "./QuizLibrary";

type Props = {
  user: { name: string; role: string };
  quizzes: LibraryQuiz[];
};

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
    : parts[0][0].toUpperCase();
}

export default function MyQuizzesView(props: Props) {
  return (
    <Suspense fallback={<div style={{ background: "#19191A", minHeight: "100vh" }} />}>
      <MyQuizzesInner {...props} />
    </Suspense>
  );
}

function MyQuizzesInner({ user, quizzes }: Props) {
  const searchParams = useSearchParams();
  const focusSearch = searchParams.get("focus") === "1";
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = getInitials(user.name);

  return (
    <div style={{ background: "#19191A", minHeight: "100vh", color: "#E7E8EA", fontFamily: "Inter, sans-serif" }}>
      {/* ── Nav ── */}
      <nav className="app-navbar" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(25, 25, 26, 0.85)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
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
                fontSize: "14px", fontWeight: 500,
                color: label === "Мои квизы" ? "#E7E8EA" : "#909499",
                cursor: "pointer", padding: "8px 14px", borderRadius: "6px",
                textDecoration: "none",
                background: label === "Мои квизы" ? "rgba(255,255,255,0.05)" : "transparent",
              }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: role badge + user pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="nav-role-badge" style={{
            padding: "4px 10px", borderRadius: "999px",
            background: "rgba(0,119,255,0.15)",
            fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em",
            textTransform: "uppercase", color: "#71AAEB",
          }}>
            ОРГАНИЗАТОР
          </div>

          <div style={{ position: "relative" }}>
            <div
              onClick={() => setMenuOpen((v) => !v)}
              className="nav-user-pill"
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "7px 15px 7px 7px", borderRadius: "999px",
                background: "#2C2D2E", border: "1px solid #363738",
                cursor: "pointer", userSelect: "none",
              }}
            >
              <div style={{
                width: "28px", height: "28px", borderRadius: "14px",
                background: "linear-gradient(180deg, #0077FF, #005CC4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {initials}
              </div>
              <span className="nav-user-name" style={{ fontSize: "14px", fontWeight: 500, color: "#E7E8EA" }}>{user.name}</span>
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
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Выйти
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="page-body" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            Мои квизы
          </h1>
          <Link href="/quiz/create" className="myquizzes-create-btn" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "0 20px", height: "40px", borderRadius: "8px",
            background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
            boxShadow: "0 4px 16px rgba(0,119,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            color: "#E7E8EA", fontSize: "14px", fontWeight: 600, textDecoration: "none",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Создать квиз
          </Link>
        </div>
        <p style={{ fontSize: "15px", color: "#909499", margin: "0 0 28px" }}>
          Все ваши квизы — опубликованные, черновики и архив. Используйте поиск, чтобы найти нужный.
        </p>

        <QuizLibrary quizzes={quizzes} showSearch autoFocusSearch={focusSearch} />
      </div>

      {/* Mobile-only bottom bar */}
      <div className="mobile-continue-bar" style={{ display: "none" }}>
        <Link href="/quiz/create" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          width: "100%", height: "48px", borderRadius: "10px",
          background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
          boxShadow: "0 4px 16px rgba(0,119,255,0.35)",
          color: "#E7E8EA", fontSize: "15px", fontWeight: 600, textDecoration: "none",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Создать квиз
        </Link>
      </div>
    </div>
  );
}

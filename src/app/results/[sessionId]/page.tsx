"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { plural } from "@/lib/plural";

type Player = { rank: number; userId: string; name: string; score: number; correct: number; total: number };
type ResultsData = {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  hostName: string;
  startedAt: string | null;
  playerCount: number;
  leaderboard: Player[];
};

const PODIUM_COLORS = ["#4DC4FF", "#FFA000", "#E64646"];

function initials(name: string) {
  const p = name.trim().split(" ");
  return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase();
}

const AVATAR_PALETTE = ["#0077FF","#E64646","#4BB34B","#FFA000","#4DC4FF","#F97316","#14B8A6","#A78BFA"];
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const { data: auth } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/results/${params.sessionId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Не удалось загрузить результаты"));
  }, [params.sessionId]);

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#19191A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        {error
          ? <p style={{ color: "#E64646", fontSize: 16 }}>{error}</p>
          : <p style={{ color: "#909499" }}>Загружаем результаты…</p>}
      </div>
    );
  }

  const myId = auth?.user?.id;
  const top3 = [
    data.leaderboard.find(p => p.rank === 2),
    data.leaderboard.find(p => p.rank === 1),
    data.leaderboard.find(p => p.rank === 3),
  ].filter(Boolean) as Player[];
  const pillarHeights: Record<number, number> = { 1: 220, 2: 170, 3: 130 };

  return (
    <div style={{ minHeight: "100vh", background: "#19191A", fontFamily: "Inter, sans-serif", color: "#E7E8EA", display: "flex", flexDirection: "column" }}>

      {/* NavBar */}
      <nav style={{ height: 64, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #363738", background: "rgba(25,25,26,0.85)", backdropFilter: "blur(12px)", flexShrink: 0, position: "relative", zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(180deg,#0077FF,#005CC4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="11" viewBox="8 11 20 14" fill="none"><path d="M10.5825 18H13.0552L14.7036 13.055L18 22.946L19.649 18H25.418" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>Pulse</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(auth?.user?.role === "PARTICIPANT"
              ? ["Главная", "История"]
              : ["Главная", "Мои квизы"]
            ).map(label => (
              <a key={label} href="/dashboard" style={{ fontSize: 14, color: "#909499", padding: "8px 14px", borderRadius: 6, fontWeight: 500, textDecoration: "none", cursor: "pointer" }}>{label}</a>
            ))}
          </div>
        </div>
        {auth?.user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(0,119,255,0.12)", fontSize: 12, fontWeight: 600, color: "#71AAEB", letterSpacing: "0.02em" }}>
              {auth.user.role === "PARTICIPANT" ? "УЧАСТНИК" : "ОРГАНИЗАТОР"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 5px", borderRadius: 999, background: "#2C2D2E", border: "1px solid #363738" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg(auth.user.name ?? ""), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                {initials(auth.user.name ?? "?")}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{auth.user.name}</span>
            </div>
          </div>
        )}
      </nav>

      {/* Sub-header */}
      <div style={{ padding: "28px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#76787A", marginBottom: 6 }}>
            <span>{data.quizTitle}</span>
            <span>·</span>
            <span>Проведён {formatDate(data.startedAt)}</span>
            <span>·</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{data.playerCount} {plural(data.playerCount, ["игрок", "игрока", "игроков"])}</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
            Итоговые результаты
            <span style={{ background: "linear-gradient(135deg,#FFA000,#E64646)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>🏆</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px", borderRadius: 8, border: "none", background: "transparent", color: "#909499", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            {/* <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> */}
            {/* Экспорт CSV */}
          </button>
          {auth?.user?.role !== "PARTICIPANT" && data && (
            <button onClick={() => router.push(`/quiz/${data.quizId}/run?reset=1`)} style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px", borderRadius: 8, border: "1px solid #363738", background: "#2C2D2E", color: "#E7E8EA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Запустить снова
            </button>
          )}
          <button onClick={() => { window.location.href = "/dashboard"; }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 40, padding: "0 18px", borderRadius: 8, border: "none", background: "linear-gradient(180deg,#0077FF,#005CC4)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(0,119,255,0.35)" }}>
            На главную
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "0 48px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, overflow: "hidden", position: "relative" }}>
        {/* Glow blobs */}
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,160,0,0.12) 0%,transparent 60%)", top: "calc(40% - 250px)", left: "calc(25% - 250px)", filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,119,255,0.15) 0%,transparent 60%)", top: "calc(60% - 200px)", left: "calc(75% - 200px)", filter: "blur(40px)", pointerEvents: "none" }} />

        {/* ── Podium ── */}
        <div style={{ background: "#232324", border: "1px solid #363738", borderRadius: 20, padding: "28px 28px 0", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#76787A", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Пьедестал</div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFA000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, paddingTop: 20 }}>
            {top3.map((p) => {
              const isFirst = p.rank === 1;
              const color = PODIUM_COLORS[p.rank - 1];
              const height = pillarHeights[p.rank] ?? 130;
              return (
                <div key={p.rank} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ position: "relative", marginBottom: 12 }}>
                    {isFirst && (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFA000" stroke="#FFA000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%) rotate(-8deg)" }}>
                        <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/>
                      </svg>
                    )}
                    <div style={{
                      width: isFirst ? 76 : 60, height: isFirst ? 76 : 60,
                      borderRadius: "50%", background: `linear-gradient(135deg,${color},${color}99)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: isFirst ? 24 : 18, fontWeight: 700, color: "#fff",
                      boxShadow: `0 8px 24px ${color}55`,
                      border: isFirst ? `3px solid #FFA000` : "none",
                    }}>
                      {initials(p.name)}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, textAlign: "center" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#76787A", marginBottom: 10, fontVariantNumeric: "tabular-nums" }}>{p.correct}/{p.total} правильно</div>

                  <div style={{
                    width: "100%", height,
                    background: `linear-gradient(180deg,${color}33 0%,${color}11 100%)`,
                    border: `1px solid ${color}44`, borderBottom: 0,
                    borderRadius: "12px 12px 0 0",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                    paddingTop: 20,
                  }}>
                    <div style={{ fontSize: isFirst ? 60 : 46, fontWeight: 900, lineHeight: 1, color, letterSpacing: "-0.04em", marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
                      {p.rank}
                    </div>
                    <div style={{ fontSize: isFirst ? 22 : 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{p.score.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#76787A", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginTop: 2 }}>очков</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Full leaderboard ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#76787A", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Полная таблица</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#76787A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span style={{ fontSize: 12, color: "#76787A", fontVariantNumeric: "tabular-nums" }}>{data.playerCount} {plural(data.playerCount, ["игрок", "игрока", "игроков"])}</span>
            </div>
          </div>

          <div style={{ flex: 1, background: "#232324", border: "1px solid #363738", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 70px 80px", padding: "10px 18px", fontSize: 11, fontWeight: 600, color: "#76787A", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #363738" }}>
              <div>#</div><div>Игрок</div><div style={{ textAlign: "right" }}>Правильно</div><div style={{ textAlign: "right" }}>Очки</div>
            </div>
            {/* Rows */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {data.leaderboard.map((p, i) => (
                <div key={p.userId} style={{
                  display: "grid", gridTemplateColumns: "44px 1fr 70px 80px",
                  padding: "11px 18px", alignItems: "center",
                  borderBottom: i < data.leaderboard.length - 1 ? "1px solid #363738" : "none",
                  background: p.userId === myId ? "rgba(0,119,255,0.06)" : "transparent",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: p.rank === 1 ? "#FFA000" : p.rank <= 3 ? "#E7E8EA" : "#76787A" }}>
                      {p.rank}
                    </span>
                    {p.rank === 1 && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFA000" stroke="#FFA000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/></svg>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: avatarBg(p.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {initials(p.name)}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    {p.userId === myId && (
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(0,119,255,0.15)", fontSize: 10, fontWeight: 700, color: "#71AAEB", letterSpacing: "0.04em" }}>ВЫ</span>
                    )}
                  </div>
                  <div style={{ textAlign: "right", color: "#909499", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{p.correct}/{p.total}</div>
                  <div style={{ textAlign: "right", fontWeight: 700, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{p.score.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

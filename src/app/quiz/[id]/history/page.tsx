export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/plural";

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
  Engineering: "Технологии", Internal: "Корпоративный", General: "Общие знания",
  Education: "Образование", Entertainment: "Развлечения", Science: "Наука",
  History: "История", Geography: "География",
};

function formatDate(d: Date) {
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const AVATAR_PALETTE = ["#0077FF","#E64646","#4BB34B","#FFA000","#4DC4FF","#F97316","#14B8A6","#A78BFA"];
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(name: string) {
  const p = name.trim().split(" ");
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default async function QuizHistoryPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.needsRoleSelection) redirect("/select-role");
  if (session.user.role !== "ORGANIZER") redirect("/dashboard");

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.id },
    include: {
      sessions: {
        // Only games that actually started count as "проведённые игры".
        where: { startedAt: { not: null } },
        orderBy: { startedAt: "desc" },
        include: {
          players: {
            orderBy: { score: "desc" },
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!quiz || quiz.authorId !== session.user.id) redirect("/dashboard");

  const games = quiz.sessions.map((s) => {
    const winner = s.players[0];
    return {
      id: s.id,
      startedAt: s.startedAt as Date,
      playerCount: s.players.length,
      winnerName: winner?.user.name ?? null,
      winnerScore: winner?.score ?? 0,
    };
  });

  const grad = CATEGORY_GRADIENTS[quiz.category] ?? "linear-gradient(165deg,#0077FF,#005CC4)";
  const catLabel = CATEGORY_LABELS[quiz.category] ?? quiz.category;
  const totalPlayers = games.reduce((sum, g) => sum + g.playerCount, 0);

  return (
    <div style={{ background: "#19191A", minHeight: "100vh", color: "#E7E8EA", fontFamily: "Inter, sans-serif" }}>

      {/* ── Nav ── */}
      <nav className="app-navbar" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(25, 25, 26, 0.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #363738", height: 65,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7.84, background: "linear-gradient(180deg, #0077FF, #005CC4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="11" viewBox="8 11 20 14" fill="none">
                <path d="M10.5825 18H13.0552L14.7036 13.055L18 22.946L19.649 18H25.418" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>Pulse</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {([
              { label: "Главная", href: "/dashboard" },
              { label: "Мои квизы", href: "/dashboard/quizzes" },
            ] as const).map(({ label, href }) => (
              <Link key={label} href={href} style={{
                fontSize: 14, fontWeight: 500, color: "#909499",
                padding: "8px 14px", borderRadius: 6, textDecoration: "none",
              }}>{label}</Link>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="page-body" style={{ maxWidth: 880, margin: "0 auto", padding: "40px 32px" }}>

        {/* Breadcrumb */}
        <Link href="/dashboard/quizzes" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#909499", textDecoration: "none", marginBottom: 20 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Мои квизы
        </Link>

        {/* Quiz header */}
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 32 }}>
          <div style={{ width: 88, height: 88, borderRadius: 14, background: grad, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#76787A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{catLabel}</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{quiz.title}</h1>
            <div style={{ fontSize: 14, color: "#909499" }}>
              {games.length} {plural(games.length, ["игра", "игры", "игр"])} · {totalPlayers} {plural(totalPlayers, ["участник", "участника", "участников"])} всего
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "#76787A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
          История игр
        </div>

        {/* Games list */}
        {games.length === 0 ? (
          <div style={{ textAlign: "center", padding: "5rem 2rem", color: "#76787A", background: "#232324", border: "1px solid #363738", borderRadius: 14 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#909499", margin: "0 0 8px" }}>Этот квиз ещё не проводился</p>
            <p style={{ fontSize: 14, margin: 0 }}>Запустите квиз — и здесь появится история игр.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {games.map((g) => (
              <Link key={g.id} href={`/results/${g.id}`} style={{
                display: "flex", alignItems: "center", gap: 18,
                padding: "16px 20px", borderRadius: 12,
                background: "#232324", border: "1px solid #363738", textDecoration: "none",
              }}>
                {/* Date */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#E7E8EA", marginBottom: 4 }}>
                    {formatDate(g.startedAt)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#76787A" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {g.playerCount} {plural(g.playerCount, ["игрок", "игрока", "игроков"])}
                  </div>
                </div>

                {/* Winner */}
                {g.winnerName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#76787A", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 2 }}>Победитель</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#E7E8EA" }}>{g.winnerName}</div>
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarBg(g.winnerName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {initials(g.winnerName)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#76787A" }}>Без участников</div>
                )}

                {/* Chevron */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

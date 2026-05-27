"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Role = "ORGANIZER" | "PARTICIPANT";

export default function SelectRolePage() {
  const router = useRouter();
  const { update } = useSession();
  const [role, setRole] = useState<Role>("PARTICIPANT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/select-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    await update();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "#07060F" }}>
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center gap-1">
          <svg width="52" height="52" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: "6px" }}>
            <g filter="url(#a_sr)">
              <rect x="20" y="16" width="36" height="36" rx="10.08" fill="url(#b_sr)" shapeRendering="crispEdges" />
              <path d="M30.5825 34.0005H33.0552L34.7036 29.0552L38.0005 38.9458L39.6489 34.0005H45.4184" stroke="white" strokeWidth="2.30767" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <defs>
              <filter id="a_sr" x="0" y="0" width="76" height="76" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                <feOffset dy="4" />
                <feGaussianBlur stdDeviation="10" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.423529 0 0 0 0 0.388235 0 0 0 0 1 0 0 0 0.4 0" />
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
              </filter>
              <linearGradient id="b_sr" x1="20" y1="16" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6C63FF" />
                <stop offset="1" stopColor="#FF6584" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-xl font-extrabold" style={{ color: "#FFFFFE" }}>Pulse</span>
        </div>

        <div>
          <h2 className="text-2xl font-bold" style={{ color: "#FFFFFE" }}>One last step</h2>
          <p className="text-sm mt-1" style={{ color: "#6E708A" }}>
            How are you planning to use Pulse?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["ORGANIZER", "PARTICIPANT"] as Role[]).map((r) => {
              const selected = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className="flex flex-col items-start gap-1 p-4 rounded-[10px] text-left transition-all"
                  style={{
                    background: selected ? "rgba(75,68,204,0.15)" : "#1A1A2E",
                    border: `1px solid ${selected ? "#4B44CC" : "#3D3D5F"}`,
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-semibold" style={{ color: "#FFFFFE" }}>
                      {r === "ORGANIZER" ? "Organizer" : "Participant"}
                    </span>
                    {selected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4B44CC" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: "#6E708A" }}>
                    {r === "ORGANIZER" ? "Host quizzes & rooms" : "Join with a room code"}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-xs" style={{ color: "#FF6584" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-[10px] text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #FFB547 0%, #FFB547 100%)",
              boxShadow: "0px 8px 24px rgba(255,181,71,0.33)",
            }}
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

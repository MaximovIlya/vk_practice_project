"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok) {
      try {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
      } catch {
        setError("Something went wrong");
      }
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "#07060F" }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <Link href="/login" className="flex items-center gap-1">
          <svg width="52" height="52" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: "6px" }}>
            <g filter="url(#a_fp)">
              <rect x="20" y="16" width="36" height="36" rx="10.08" fill="url(#b_fp)" shapeRendering="crispEdges" />
              <path d="M30.5825 34.0005H33.0552L34.7036 29.0552L38.0005 38.9458L39.6489 34.0005H45.4184" stroke="white" strokeWidth="2.30767" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <defs>
              <filter id="a_fp" x="0" y="0" width="76" height="76" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                <feOffset dy="4" />
                <feGaussianBlur stdDeviation="10" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.423529 0 0 0 0 0.388235 0 0 0 0 1 0 0 0 0.4 0" />
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
              </filter>
              <linearGradient id="b_fp" x1="20" y1="16" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6C63FF" />
                <stop offset="1" stopColor="#FF6584" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-xl font-extrabold" style={{ color: "#FFFFFE" }}>Pulse</span>
        </Link>

        {submitted ? (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg text-sm"
              style={{ background: "rgba(75,68,204,0.15)", border: "1px solid #4B44CC", color: "#A7A9BE" }}
            >
              If an account with <strong style={{ color: "#FFFFFE" }}>{email}</strong> exists, a reset link has been sent. Check your inbox (or server console in dev mode).
            </div>
            <Link
              href="/login"
              className="block text-center text-sm font-semibold"
              style={{ color: "#4B44CC" }}
            >
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold" style={{ color: "#FFFFFE" }}>
                Reset your password
              </h2>
              <p className="text-sm mt-1" style={{ color: "#6E708A" }}>
                Enter your email and we&apos;ll send a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "#A7A9BE" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example.com"
                  required
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: "#1A1A2E",
                    border: "1px solid #3D3D5F",
                    color: "#FFFFFE",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#4B44CC")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#3D3D5F")}
                />
              </div>

              {error && (
                <p className="text-xs" style={{ color: "#FF6584" }}>
                  {error}
                </p>
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
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="text-center text-sm" style={{ color: "#6E708A" }}>
              Remember it?{" "}
              <Link href="/login" className="font-semibold" style={{ color: "#4B44CC" }}>
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Недействительная или отсутствующая ссылка.");
      return;
    }
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Что-то пошло не так");
    } else {
      router.push("/login?reset=1");
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "#E64646" }}>
          Недействительная или отсутствующая ссылка. Запросите новую.
        </p>
        <Link href="/forgot-password" className="text-sm font-semibold" style={{ color: "#0077FF" }}>
          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "#E7E8EA" }}>
          Новый пароль
        </h2>
        <p className="text-sm mt-1" style={{ color: "#76787A" }}>
          Придумайте надёжный пароль для вашего аккаунта.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold" style={{ color: "#909499" }}>
            Новый пароль
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="не менее 8 символов"
              required
              minLength={8}
              className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: "#232324",
                border: "1px solid #363738",
                color: "#E7E8EA",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#0077FF")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#363738")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "#76787A" }}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs" style={{ color: "#E64646" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-[10px] text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{
            background: "linear-gradient(180deg, #0077FF 0%, #005CC4 100%)",
            boxShadow: "0px 8px 24px rgba(0,119,255,0.33)",
          }}
        >
          {loading ? "Сохранение…" : "Установить новый пароль"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "#19191A" }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <Link href="/login" className="flex items-center gap-1">
          <svg width="52" height="52" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: "6px" }}>
            <g filter="url(#a_rp)">
              <rect x="20" y="16" width="36" height="36" rx="10.08" fill="url(#b_rp)" shapeRendering="crispEdges" />
              <path d="M30.5825 34.0005H33.0552L34.7036 29.0552L38.0005 38.9458L39.6489 34.0005H45.4184" stroke="white" strokeWidth="2.30767" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <defs>
              <filter id="a_rp" x="0" y="0" width="76" height="76" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                <feOffset dy="4" />
                <feGaussianBlur stdDeviation="10" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0.467 0 0 0 0 1 0 0 0 0.4 0" />
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
              </filter>
              <linearGradient id="b_rp" x1="20" y1="16" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0077FF" />
                <stop offset="1" stopColor="#005CC4" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-xl font-extrabold" style={{ color: "#E7E8EA" }}>Pulse</span>
        </Link>

        <div>
          <div className="inline-flex">
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: "rgba(0,119,255,0.12)", color: "#909499" }}
            >
              Сброс пароля
            </span>
          </div>
        </div>

        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>

        <p className="text-center text-sm" style={{ color: "#76787A" }}>
          Вспомнили пароль?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "#0077FF" }}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

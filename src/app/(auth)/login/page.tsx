"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#07060F" }}>
      {/* Left branding panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "#0F0E17" }}
      >
        {/* Decorative blurs */}
        <div
          className="absolute top-[-120px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]"
          style={{ background: "#4B44CC" }}
        />
        <div
          className="absolute bottom-[-100px] right-[-60px] w-[300px] h-[300px] rounded-full opacity-15 blur-[80px]"
          style={{ background: "#FFB547" }}
        />

        <div className="relative z-10 flex items-center gap-1">
          <svg width="76" height="76" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: '8px' }}>
            <g filter="url(#a_ll)">
              <rect x="20" y="16" width="36" height="36" rx="10.08" fill="url(#b_ll)" shapeRendering="crispEdges"/>
              <path d="M30.5825 34.0005H33.0552L34.7036 29.0552L38.0005 38.9458L39.6489 34.0005H45.4184" stroke="white" strokeWidth="2.30767" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            <defs>
              <filter id="a_ll" x="0" y="0" width="76" height="76" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dy="4"/>
                <feGaussianBlur stdDeviation="10"/>
                <feComposite in2="hardAlpha" operator="out"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0.423529 0 0 0 0 0.388235 0 0 0 0 1 0 0 0 0.4 0"/>
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
                <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
              </filter>
              <linearGradient id="b_ll" x1="20" y1="16" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6C63FF"/>
                <stop offset="1" stopColor="#FF6584"/>
              </linearGradient>
            </defs>
          </svg>
          <span className="text-2xl font-extrabold" style={{ color: "#FFFFFE" }}>
            Pulse
          </span>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold leading-tight" style={{ color: "#FFFFFE" }}>
            Live quizzes,<br />real-time energy.
          </h1>
          <p className="text-base" style={{ color: "#6E708A" }}>
            Build quizzes, host live rooms, and watch the leaderboard shift in milliseconds.
          </p>

          <div className="flex gap-8 pt-4">
            {[
              { value: "12k+", label: "quizzes hosted" },
              { value: "1.4M", label: "answers / day" },
              { value: "34ms", label: "median latency" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-extrabold" style={{ color: "#FFFFFE" }}>
                  {stat.value}
                </div>
                <div className="text-sm" style={{ color: "#6E708A" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm" style={{ color: "#6E708A" }}>
          © 2026 Pulse Labs · Privacy · Terms
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-1 lg:hidden">
            <svg width="68" height="68" viewBox="0 0 76 76" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: '8px' }}>
              <g filter="url(#a_lm)">
                <rect x="20" y="16" width="36" height="36" rx="10.08" fill="url(#b_lm)" shapeRendering="crispEdges"/>
                <path d="M30.5825 34.0005H33.0552L34.7036 29.0552L38.0005 38.9458L39.6489 34.0005H45.4184" stroke="white" strokeWidth="2.30767" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
              <defs>
                <filter id="a_lm" x="0" y="0" width="76" height="76" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                  <feOffset dy="4"/>
                  <feGaussianBlur stdDeviation="10"/>
                  <feComposite in2="hardAlpha" operator="out"/>
                  <feColorMatrix type="matrix" values="0 0 0 0 0.423529 0 0 0 0 0.388235 0 0 0 0 1 0 0 0 0.4 0"/>
                  <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
                </filter>
                <linearGradient id="b_lm" x1="20" y1="16" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6C63FF"/>
                  <stop offset="1" stopColor="#FF6584"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="text-xl font-extrabold" style={{ color: "#FFFFFE" }}>Pulse</span>
          </div>

          {/* Badge */}
          <div className="inline-flex">
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: "#1A1A2E", color: "#A7A9BE" }}
            >
              Welcome back
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-bold" style={{ color: "#FFFFFE" }}>
              Log in to Pulse
            </h2>
            <p className="text-sm mt-1" style={{ color: "#6E708A" }}>
              Pick up where you left off.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
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

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold" style={{ color: "#A7A9BE" }}>
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs"
                  style={{ color: "#4B44CC" }}
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="your password"
                  required
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: "#1A1A2E",
                    border: "1px solid #3D3D5F",
                    color: "#FFFFFE",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#4B44CC")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#3D3D5F")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#6E708A" }}
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
              <p className="text-xs" style={{ color: "#FF6584" }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-[10px] text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #FFB547 0%, #FFB547 100%)",
                boxShadow: "0px 8px 24px rgba(255,181,71,0.33)",
              }}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "#3D3D5F" }} />
            <span className="text-xs" style={{ color: "#6E708A" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "#3D3D5F" }} />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
            style={{
              background: "#1A1A2E",
              border: "1px solid #3D3D5F",
              color: "#FFFFFE",
              boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm" style={{ color: "#6E708A" }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold" style={{ color: "#4B44CC" }}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

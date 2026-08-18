import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Activity, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import ThemeToggle from "../../components/layout/ThemeToggle";

export default function Login() {
  const navigate = useNavigate();
  const { login, loading: authLoading, error: authError } = useAuth();
  const { isDark, tokens: t } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const ok = await login(email.trim(), password);
      if (ok === true) {
        navigate("/dashboard", { replace: true });
      } else {
        // ok is false — the AuthContext.login set its own error state
        // but we also set a local fallback message
        setError("Invalid email or password. Please try again.");
      }
    } catch (err) {
      setError("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 14px 11px 42px",
    borderRadius: 10,
    border: `1.5px solid ${t.border}`,
    background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
    color: t.text,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  };

  const inputFocusHandler = (e) => {
    e.target.style.borderColor = t.primary;
    e.target.style.boxShadow = `0 0 0 3px ${isDark ? "rgba(14,165,233,0.15)" : "rgba(14,165,233,0.1)"}`;
  };

  const inputBlurHandler = (e) => {
    e.target.style.borderColor = t.border;
    e.target.style.boxShadow = "none";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        color: t.text,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        transition: "background 0.25s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Theme toggle – top right corner */}
      <div style={{ position: "absolute", top: 20, right: 24 }}>
        <ThemeToggle />
      </div>

      {/* Subtle radial glow behind the card */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle, rgba(14,165,233,0.06), transparent 70%)"
            : "radial-gradient(circle, rgba(14,165,233,0.04), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Login Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo & Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 3px 12px rgba(14,165,233,0.3)",
              }}
            >
              <Activity size={20} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, color: t.text, letterSpacing: "0.02em" }}>
              Ventrix
            </span>
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 20, marginBottom: 6 }}>
            Sign in to your account
          </h1>
          <p style={{ fontSize: 14, color: t.textMuted }}>
            Access the HVAC intelligence and asset maintenance platform.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            padding: "32px 28px",
            borderRadius: 16,
            background: isDark ? "#111827" : "#FFFFFF",
            border: `1px solid ${t.border}`,
            boxShadow: isDark
              ? "0 16px 48px -12px rgba(0, 0, 0, 0.5)"
              : "0 4px 24px -4px rgba(0, 0, 0, 0.08)",
          }}
        >
          {/* Error message */}
          {(error || authError) && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 10,
                background: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.06)",
                border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.2)"}`,
                marginBottom: 20,
                fontSize: 13,
                color: isDark ? "#FCA5A5" : "#DC2626",
                lineHeight: 1.5,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error || authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.text,
                  marginBottom: 6,
                }}
              >
                Email address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: t.textMuted,
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={inputFocusHandler}
                  onBlur={inputBlurHandler}
                  style={inputStyle}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Password</label>
              </div>
              <div style={{ position: "relative" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: t.textMuted,
                    pointerEvents: "none",
                  }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={inputFocusHandler}
                  onBlur={inputBlurHandler}
                  style={{ ...inputStyle, paddingRight: 42 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: t.textMuted,
                    padding: 2,
                    display: "flex",
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || authLoading}
              style={{
                width: "100%",
                padding: "12px 20px",
                borderRadius: 10,
                border: "none",
                background:
                  loading || authLoading
                    ? isDark
                      ? "rgba(14,165,233,0.3)"
                      : "rgba(14,165,233,0.4)"
                    : "linear-gradient(135deg, #0EA5E9, #0284C7)",
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: loading || authLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow:
                  loading || authLoading
                    ? "none"
                    : "0 3px 12px rgba(14,165,233,0.25)",
                transition: "all 0.2s ease",
              }}
            >
              {loading || authLoading ? (
                <>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "vtx-spin 0.6s linear infinite",
                    }}
                  />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <style>{`
            @keyframes vtx-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>

        {/* Footer hint */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: t.textMuted }}>
          Protected System · Authorized Access Only
        </div>

        {/* Back to home */}
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link
            to="/"
            style={{ fontSize: 12.5, color: t.textMuted, textDecoration: "none" }}
          >
            ← Back to ventrix.app
          </Link>
        </div>
      </div>
    </div>
  );
}
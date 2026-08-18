import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem("ventrix_theme");
      if (stored) return stored;
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  const isDark = theme === "dark";

  useEffect(() => {
    try {
      localStorage.setItem("ventrix_theme", theme);
    } catch {
      // Ignore
    }

    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [theme, isDark]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Structured design tokens for enterprise theme support across components
  const tokens = useMemo(
    () => ({
      isDark,
      bg: isDark ? "#0B0F19" : "#F8FAFC",
      sidebar: isDark ? "#0F172A" : "#FFFFFF",
      card: isDark ? "#131C31" : "#FFFFFF",
      cardInner: isDark ? "#0B1120" : "#F1F5F9",
      border: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
      borderHover: isDark ? "rgba(14, 165, 233, 0.4)" : "#0EA5E9",
      text: isDark ? "#F8FAFC" : "#0F172A",
      textMuted: isDark ? "#94A3B8" : "#64748B",
      primary: isDark ? "#38BDF8" : "#0284C7",
      primaryBg: isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 132, 199, 0.08)",
      success: isDark ? "#34D399" : "#059669",
      successBg: isDark ? "rgba(52, 211, 153, 0.12)" : "rgba(5, 150, 105, 0.08)",
      warning: isDark ? "#FBBF24" : "#D97706",
      warningBg: isDark ? "rgba(251, 191, 36, 0.12)" : "rgba(217, 119, 6, 0.08)",
      danger: isDark ? "#F87171" : "#DC2626",
      dangerBg: isDark ? "rgba(248, 113, 113, 0.12)" : "rgba(220, 38, 38, 0.08)",
      shadow: isDark
        ? "0 4px 20px -2px rgba(0, 0, 0, 0.4)"
        : "0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
      shadowSm: isDark
        ? "0 2px 8px rgba(0, 0, 0, 0.3)"
        : "0 1px 2px rgba(0, 0, 0, 0.05)",
    }),
    [isDark]
  );

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

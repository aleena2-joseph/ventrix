import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle({ size = "md", className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center rounded-lg border transition-all duration-200 cursor-pointer ${
        isSmall ? "w-8 h-8 p-1.5" : "w-9 h-9 p-2"
      } ${
        isDark
          ? "bg-slate-900/90 border-slate-700/80 text-amber-300 hover:text-amber-200 hover:border-slate-600 shadow-sm"
          : "bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 shadow-sm"
      } ${className}`}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle theme mode"
    >
      {isDark ? (
        <Sun className={`${isSmall ? "w-4 h-4" : "w-4 h-4"} text-amber-400 transition-transform duration-200 hover:rotate-45`} />
      ) : (
        <Moon className={`${isSmall ? "w-4 h-4" : "w-4 h-4"} text-slate-700 transition-transform duration-200 hover:-rotate-12`} />
      )}
    </button>
  );
}

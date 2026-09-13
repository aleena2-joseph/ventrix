import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  icon: Icon,
  style = {},
  ...props
}) {
  const { isDark } = useTheme();

  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer";
  
  const variants = {
    primary: "bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-md shadow-sky-500/25 hover:shadow-sky-500/40 hover:from-sky-400 hover:to-blue-500 border border-sky-400/30",
    secondary: isDark
      ? "bg-slate-900/80 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/60 shadow-md"
      : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-sm",
    outline: isDark
      ? "bg-slate-900/40 text-slate-200 border border-slate-700/80 hover:border-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
      : "bg-white text-slate-700 border border-slate-300 hover:border-sky-500 hover:text-sky-600 hover:bg-sky-50/70 shadow-sm",
    glow: "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_18px_rgba(56,189,248,0.45)] hover:shadow-[0_0_26px_rgba(56,189,248,0.7)] border border-cyan-300/40"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs font-medium gap-1.5",
    md: "px-4 py-2 text-sm font-semibold gap-2",
    lg: "px-6 py-3 text-base font-bold gap-2.5"
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {Icon && <Icon className={`${size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}`} />}
      {children}
    </button>
  );
}

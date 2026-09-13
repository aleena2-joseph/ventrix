import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function Card({
  children,
  className = '',
  hoverEffect = false,
  glow = false,
  accentColor,
  style = {},
  ...props
}) {
  const { isDark, tokens } = useTheme();

  return (
    <div
      className={`rounded-2xl transition-all duration-200 relative overflow-hidden ${
        hoverEffect
          ? isDark
            ? 'hover:border-sky-500/40 hover:shadow-xl hover:-translate-y-0.5'
            : 'hover:border-sky-400/80 hover:shadow-lg hover:-translate-y-0.5'
          : ''
      } ${className}`}
      style={{
        background: tokens.card,
        border: `1px solid ${tokens.border}`,
        boxShadow: tokens.shadow,
        padding: 22,
        ...style,
      }}
      {...props}
    >
      {accentColor && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: accentColor,
          }}
        />
      )}
      {children}
    </div>
  );
}
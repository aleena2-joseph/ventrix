import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function Card({
  children,
  className = '',
  hoverEffect = false,
  glow = false,
  style = {},
  ...props
}) {
  const { isDark, tokens } = useTheme();

  return (
    <div
      className={`rounded-xl transition-all duration-200 ${
        hoverEffect
          ? isDark
            ? 'hover:border-slate-600 hover:shadow-lg'
            : 'hover:border-slate-300 hover:shadow-md'
          : ''
      } ${className}`}
      style={{
        background: tokens.card,
        border: `1px solid ${tokens.border}`,
        boxShadow: tokens.shadow,
        padding: 20,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
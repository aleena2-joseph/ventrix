import React from 'react';
export default function Loader({ size = 'md', label = 'Loading...' }) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };
  return (
    <div className="flex flex-col items-center justify-center p-6 gap-3">
      <div
        className={`${sizeClasses[size]} rounded-full border-cyan-500/20 border-t-cyan-400 border-r-blue-500 animate-spin filter drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]`}
      />
      {label && <span className="text-xs tracking-widest uppercase text-cyan-400/80 font-medium animate-pulse">{label}</span>}
    </div>
  );
}
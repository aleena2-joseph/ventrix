import React from 'react';
export default function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  icon: Icon,
  endIcon,
  onEndIconClick,
  className = '',
  required = false,
  name,
  ...props
}) {
  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label} {required && <span className="text-cyan-400">*</span>}
        </label>
      )}
      <div className="relative flex items-center group">
        {Icon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none transition-colors group-focus-within:text-cyan-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full bg-slate-900/60 text-slate-100 placeholder-slate-500 text-sm rounded-xl py-3 ${
            Icon ? 'pl-10' : 'pl-4'
          } ${endIcon ? 'pr-10' : 'pr-4'} border ${
            error
              ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/30'
              : 'border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20'
          } outline-none transition-all duration-200 shadow-inner backdrop-blur-md`}
          {...props}
        />
        {endIcon && (
          <button
            type="button"
            onClick={onEndIconClick}
            className="absolute right-3.5 text-slate-400 hover:text-cyan-300 transition-colors focus:outline-none"
          >
            {endIcon}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-400 font-medium pl-1">{error}</span>}
    </div>
  );
}
import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/logo.svg';
export default function Footer() {
  return (
    <footer className="w-full bg-[#03060d] border-t border-cyan-500/20 py-12 px-4 sm:px-6 lg:px-8 text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Ventrix Logo" className="w-7 h-7 filter drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]" />
          <div>
            <span className="font-bold text-white tracking-[0.2em] font-['Outfit'] text-base">VENTRIX</span>
            <p className="text-xs text-slate-500">AI-Powered Railway HVAC Predictive Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs tracking-wider uppercase">
          <Link to="/" className="hover:text-cyan-400 transition-colors">Privacy Policy</Link>
          <Link to="/" className="hover:text-cyan-400 transition-colors">Terms of Service</Link>
        </div>
        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()} VENTRIX Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
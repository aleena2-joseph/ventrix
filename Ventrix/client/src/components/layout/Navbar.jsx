import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import Button from '../common/Button';
import { Menu, X, Cpu, Activity, LogIn, LayoutDashboard } from 'lucide-react';
import logo from '../../assets/logo.svg';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isDashboard = location.pathname.startsWith('/dashboard');

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/' && location.pathname !== '/landing') {
      navigate('/#' + id);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#040914]/90 dark:bg-[#040914]/90 border-b border-cyan-500/20 shadow-lg shadow-cyan-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-cyan-400/30 rounded-full blur-md group-hover:bg-cyan-400/60 transition-all duration-300"></div>
            <img src={logo} alt="VENTRIX Logo" className="w-9 h-9 relative z-10 filter drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
          </div>
          <span className="font-extrabold text-xl tracking-[0.25em] text-white font-['Outfit'] group-hover:text-cyan-300 transition-colors">
            VENTRIX
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection('overview')}
            className="text-xs uppercase tracking-widest font-semibold text-slate-300 hover:text-cyan-400 transition-colors relative py-1 cursor-pointer after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-cyan-400 hover:after:w-full after:transition-all"
          >
            Overview
          </button>
          <button
            onClick={() => scrollToSection('architecture')}
            className="text-xs uppercase tracking-widest font-semibold text-slate-300 hover:text-cyan-400 transition-colors relative py-1 cursor-pointer after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-cyan-400 hover:after:w-full after:transition-all"
          >
            Architecture
          </button>
          <button
            onClick={() => scrollToSection('features')}
            className="text-xs uppercase tracking-widest font-semibold text-slate-300 hover:text-cyan-400 transition-colors relative py-1 cursor-pointer after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-cyan-400 hover:after:w-full after:transition-all"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('access')}
            className="text-xs uppercase tracking-widest font-semibold text-slate-300 hover:text-cyan-400 transition-colors relative py-1 cursor-pointer after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-cyan-400 hover:after:w-full after:transition-all"
          >
            Role Access
          </button>
          <Link
            to="/dashboard"
            className="text-xs uppercase tracking-widest font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-500/30"
          >
            <Cpu className="w-3.5 h-3.5 animate-pulse" />
            Live Console
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="hidden md:flex items-center gap-4">
          <ThemeToggle />
          {isDashboard ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              Exit Dashboard
            </Button>
          ) : user ? (
            <Button
              variant="glow"
              size="sm"
              onClick={() => navigate('/dashboard')}
              icon={LayoutDashboard}
            >
              Console
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/login')}
                icon={LogIn}
              >
                Sign In
              </Button>
              <Button
                variant="glow"
                size="sm"
                onClick={() => scrollToSection('access')}
              >
                Quick Demo
              </Button>
            </div>
          )}
        </div>

        <div className="flex md:hidden items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-cyan-400 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#070e20] border-b border-cyan-500/20 px-4 pt-3 pb-6 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-200">
          <button
            onClick={() => scrollToSection('overview')}
            className="text-sm uppercase tracking-wider text-slate-200 py-2 border-b border-slate-800 text-left"
          >
            Overview
          </button>
          <button
            onClick={() => scrollToSection('architecture')}
            className="text-sm uppercase tracking-wider text-slate-200 py-2 border-b border-slate-800 text-left"
          >
            Architecture
          </button>
          <button
            onClick={() => scrollToSection('features')}
            className="text-sm uppercase tracking-wider text-slate-200 py-2 border-b border-slate-800 text-left"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('access')}
            className="text-sm uppercase tracking-wider text-slate-200 py-2 border-b border-slate-800 text-left"
          >
            Role Access
          </button>
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm uppercase tracking-wider text-cyan-400 font-semibold py-2 border-b border-slate-800 flex items-center gap-2"
          >
            <Cpu className="w-4 h-4 animate-pulse" />
            Live Telemetry Console
          </Link>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="glow"
              fullWidth
              onClick={() => scrollToSection('access')}
            >
              Quick Demo Access
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login');
              }}
            >
              Sign In
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
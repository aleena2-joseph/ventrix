import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Shield,
  Wrench,
  Package,
  Layers,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Server,
  Database,
  Users,
  Play,
  RotateCcw,
  Check,
  Flame,
  Thermometer,
  Gauge,
  FileText,
  Boxes,
  Bell,
  Cpu,
  Lock,
  ChevronDown,
  Sparkles,
  LayoutGrid,
  Radio,
  Sliders,
  Send,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/layout/ThemeToggle';

export default function Landing() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { isDark } = useTheme();

  // Navigation & Interactive state
  const [activeTab, setActiveTab] = useState('overview');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [isPlayingWorkflow, setIsPlayingWorkflow] = useState(true);
  const [activeRoleView, setActiveRoleView] = useState('admin');
  const [quickLoginLoading, setQuickLoginLoading] = useState(null);

  // Live telemetry ticker
  const [telemetryTick, setTelemetryTick] = useState({
    temp: 18.4,
    pressure: 7.9,
    filterDp: 141,
    current: 18.8,
    health: 94,
    power: 10.8,
    vibration: 0.14,
    status: 'OPERATIONAL',
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetryTick((prev) => {
        const time = Date.now() / 3000;
        return {
          temp: +(18.2 + Math.sin(time) * 0.4).toFixed(1),
          pressure: +(7.8 + Math.cos(time * 0.8) * 0.2).toFixed(1),
          filterDp: Math.round(140 + Math.sin(time * 1.2) * 5),
          current: +(18.5 + Math.sin(time * 0.5) * 0.6).toFixed(1),
          health: prev.health,
          power: +(10.6 + Math.cos(time * 0.6) * 0.4).toFixed(1),
          vibration: +(0.13 + Math.sin(time * 2) * 0.03).toFixed(2),
          status: 'OPERATIONAL',
        };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Automated workflow step animation
  useEffect(() => {
    if (!isPlayingWorkflow) return;
    const interval = setInterval(() => {
      setActiveWorkflowStep((prev) => (prev + 1) % 6);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlayingWorkflow]);

  const handleQuickLogin = async (email, roleKey) => {
    setQuickLoginLoading(roleKey);
    try {
      const ok = await login(email, 'Ventrix@123');
      if (ok) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login');
      }
    } catch {
      navigate('/login');
    } finally {
      setQuickLoginLoading(null);
    }
  };

  // Color tokens tailored for both dark and light modes
  const themeStyles = {
    pageBg: isDark ? '#0B0F19' : '#F8FAFC',
    textColor: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#94A3B8' : '#64748B',
    navBg: isDark ? 'rgba(11, 15, 25, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    navBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    cardBg: isDark ? '#0F172A' : '#FFFFFF',
    cardInnerBg: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F1F5F9',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)',
    cardShadow: isDark
      ? '0 20px 48px -12px rgba(0, 0, 0, 0.6)'
      : '0 12px 36px -8px rgba(0, 0, 0, 0.07)',
    previewTopBar: isDark ? 'rgba(30, 41, 59, 0.7)' : '#E2E8F0',
    primary: isDark ? '#38BDF8' : '#0284C7',
    primaryGrad: isDark
      ? 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)'
      : 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
    footerBg: isDark ? '#070A12' : '#FFFFFF',
    footerBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    codeColor: isDark ? '#38BDF8' : '#0284C7',
  };

  // Workflow steps
  const WORKFLOW_STEPS = [
    {
      id: 0,
      badge: '01 · INGEST',
      title: 'Live Telemetry & Signals',
      desc: 'High-frequency telemetry stream (temperature, compressor current, refrigerant pressure, vibration) flows into the ingest pipeline.',
      metricLabel: 'Compressor Current',
      metricVal: `${telemetryTick.current} A`,
      status: 'Continuous Stream',
      statusColor: '#06B6D4',
      icon: Activity,
    },
    {
      id: 1,
      badge: '02 · DIAGNOSE',
      title: 'Asset Condition & Health Index',
      desc: 'Real-time diagnostic algorithms evaluate equipment degradation, filter resistance, and cooling efficiency to compute the live health index.',
      metricLabel: 'Calculated Health Score',
      metricVal: '88% (Degrading)',
      status: 'Warning Threshold',
      statusColor: '#F59E0B',
      icon: Gauge,
    },
    {
      id: 2,
      badge: '03 · DETECT',
      title: 'Event & Anomaly Generation',
      desc: 'Differential pressure spike and thermal rise automatically trigger actionable anomaly records with severity tagging.',
      metricLabel: 'Triggered Anomaly',
      metricVal: 'Filter Clogging Warning',
      status: 'Requires Review',
      statusColor: '#F59E0B',
      icon: AlertTriangle,
    },
    {
      id: 3,
      badge: '04 · DISPATCH',
      title: 'Work Order Creation & Assign',
      desc: 'Operations converts the diagnostic event into a structured work order, assigning technician tech@ventrix.com with due dates.',
      metricLabel: 'Assigned Work Order',
      metricVal: 'WO-1024 (Filter Service)',
      status: 'ASSIGNED',
      statusColor: '#3B82F6',
      icon: Wrench,
    },
    {
      id: 4,
      badge: '05 · CONSUME',
      title: 'Part Consumption & Inventory',
      desc: 'Technician executes maintenance and records part usage (e.g. 2× Return Air Filters), instantly deducting depot stock.',
      metricLabel: 'Deducted Spares',
      metricVal: '2× VX-FILTER-03',
      status: 'Stock Updated',
      statusColor: '#10B981',
      icon: Package,
    },
    {
      id: 5,
      badge: '06 · CLOSE',
      title: 'Operational History Recorded',
      desc: 'Work order is verified and closed. Asset health restores to nominal and complete lifecycle history is archived.',
      metricLabel: 'Post-Service Health',
      metricVal: '98% (Healthy)',
      status: 'CLOSED · COMPLETED',
      statusColor: '#10B981',
      icon: CheckCircle2,
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: themeStyles.pageBg,
        color: themeStyles.textColor,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflowX: 'hidden',
        transition: 'background-color 0.25s ease, color 0.25s ease',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&family=Outfit:wght@500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'}; border-radius: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────
          1. TOP NAVBAR
          ───────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: themeStyles.navBg,
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${themeStyles.navBorder}`,
          padding: '0 28px',
          height: 68,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background 0.25s, border 0.25s',
        }}
      >
        {/* Brand */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(6, 182, 212, 0.4)',
            }}
          >
            <Activity size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: '0.04em',
                color: themeStyles.textColor,
              }}
            >
              VENTRIX
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: isDark ? '#06B6D4' : '#0284C7',
                background: isDark ? 'rgba(6, 182, 212, 0.12)' : 'rgba(2, 132, 199, 0.09)',
                border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`,
                padding: '2px 7px',
                borderRadius: 20,
                letterSpacing: '0.05em',
              }}
            >
              OPERATIONS v2.4
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            fontSize: 14,
            fontWeight: 500,
            color: themeStyles.textMuted,
          }}
        >
          <a
            href="#overview"
            style={{ color: isDark ? '#E2E8F0' : '#1E293B', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#06B6D4')}
            onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#E2E8F0' : '#1E293B')}
          >
            Platform
          </a>
          <a
            href="#capabilities"
            style={{ color: themeStyles.textMuted, textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#06B6D4')}
            onMouseLeave={(e) => (e.currentTarget.style.color = themeStyles.textMuted)}
          >
            Capabilities
          </a>
          <a
            href="#workflow"
            style={{ color: themeStyles.textMuted, textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#06B6D4')}
            onMouseLeave={(e) => (e.currentTarget.style.color = themeStyles.textMuted)}
          >
            Workflow
          </a>
          <a
            href="#roles"
            style={{ color: themeStyles.textMuted, textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#06B6D4')}
            onMouseLeave={(e) => (e.currentTarget.style.color = themeStyles.textMuted)}
          >
            Role Access
          </a>
        </nav>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle />

          <Link
            to="/login"
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: '#FFFFFF',
              textDecoration: 'none',
              padding: '8px 18px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
              boxShadow: '0 2px 12px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            Sign in to Platform <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION — PRODUCT PROOF
          ───────────────────────────────────────────────────────────── */}
      <section
        id="overview"
        style={{
          position: 'relative',
          padding: '72px 24px 84px',
          maxWidth: 1240,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Ambient Radial Glow */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 720,
            height: 480,
            background: isDark
              ? 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(2, 132, 199, 0.05) 50%, transparent 80%)'
              : 'radial-gradient(circle, rgba(2, 132, 199, 0.1) 0%, rgba(6, 182, 212, 0.04) 50%, transparent 80%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Eyebrow Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 14px',
            borderRadius: 30,
            background: isDark ? 'rgba(6, 182, 212, 0.08)' : 'rgba(2, 132, 199, 0.08)',
            border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.25)' : 'rgba(2, 132, 199, 0.25)'}`,
            fontSize: 12.5,
            fontWeight: 600,
            color: isDark ? '#38BDF8' : '#0284C7',
            marginBottom: 24,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
          <span>HVAC OPERATIONS PLATFORM · REAL-TIME FLEET TELEMETRY</span>
        </div>

        {/* Main Headline */}
        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(38px, 5.5vw, 64px)',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            maxWidth: 960,
            margin: '0 0 20px',
            position: 'relative',
            zIndex: 1,
            color: themeStyles.textColor,
          }}
        >
          HVAC operations, <span style={{ background: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 50%, #10B981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>unified.</span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(16px, 2vw, 20px)',
            fontWeight: 400,
            lineHeight: 1.55,
            color: themeStyles.textMuted,
            maxWidth: 780,
            margin: '0 0 34px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Manage every HVAC asset. Monitor every sensor signal in real time. Coordinate work orders and spare parts across your entire depot fleet.
        </p>

        {/* CTAs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            flexWrap: 'wrap',
            marginBottom: 48,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '13px 26px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            Launch Operations Console <ArrowRight size={16} />
          </Link>

          <a
            href="#capabilities"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '13px 24px',
              borderRadius: 10,
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)'}`,
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
              color: themeStyles.textColor,
              fontWeight: 600,
              fontSize: 15,
              textDecoration: 'none',
              boxShadow: isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.09)' : '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF')}
          >
            Explore Live Modules
          </a>
        </div>

        {/* ── REAL-TIME EMBEDDED DASHBOARD PREVIEW ── */}
        <div
          id="overview-preview"
          style={{
            width: '100%',
            maxWidth: 1120,
            borderRadius: 16,
            background: themeStyles.cardBg,
            border: `1px solid ${themeStyles.cardBorder}`,
            boxShadow: themeStyles.cardShadow,
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
            textAlign: 'left',
          }}
        >
          {/* Window Top Chrome */}
          <div
            style={{
              padding: '12px 18px',
              background: themeStyles.previewTopBar,
              borderBottom: `1px solid ${themeStyles.cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ fontSize: 12, color: themeStyles.textMuted, fontFamily: "'JetBrains Mono', monospace", marginLeft: 8 }}>
                app.ventrix.com / operations-dashboard
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#10B981', fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
              LIVE TELEMETRY STREAM
            </div>
          </div>

          {/* Embedded Operations Preview Content */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Top 4 KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div style={{ padding: '14px 16px', borderRadius: 10, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: themeStyles.textMuted }}>
                  <span>Total HVAC Assets</span>
                  <Boxes size={16} color={isDark ? '#06B6D4' : '#0284C7'} />
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginTop: 4, color: themeStyles.textColor }}>
                  24
                </div>
                <div style={{ fontSize: 11.5, color: '#10B981', marginTop: 2 }}>
                  19 Nominal · 3 Warning · 2 Critical
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 10, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: themeStyles.textMuted }}>
                  <span>Fleet Average Health</span>
                  <Gauge size={16} color="#10B981" />
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginTop: 4, color: '#10B981' }}>
                  87%
                </div>
                <div style={{ fontSize: 11.5, color: themeStyles.textMuted, marginTop: 2 }}>
                  Optimal operating parameters
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 10, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: themeStyles.textMuted }}>
                  <span>Active Anomaly Alerts</span>
                  <Bell size={16} color="#F59E0B" />
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginTop: 4, color: '#F59E0B' }}>
                  3
                </div>
                <div style={{ fontSize: 11.5, color: '#F59E0B', marginTop: 2 }}>
                  1 High Priority Overcurrent
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 10, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: themeStyles.textMuted }}>
                  <span>Open Work Orders</span>
                  <Wrench size={16} color="#3B82F6" />
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginTop: 4, color: '#3B82F6' }}>
                  7
                </div>
                <div style={{ fontSize: 11.5, color: themeStyles.textMuted, marginTop: 2 }}>
                  4 Assigned · 2 In Progress · 1 Due
                </div>
              </div>
            </div>

            {/* Live Sensor Feed Row for HVAC-001 */}
            <div style={{ padding: 18, borderRadius: 12, background: isDark ? 'rgba(6, 182, 212, 0.04)' : 'rgba(2, 132, 199, 0.04)', border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.25)' : 'rgba(2, 132, 199, 0.2)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: '4px 8px', borderRadius: 6, background: '#0284C7', color: '#FFFFFF', fontWeight: 800, fontSize: 11 }}>
                    LIVE ASSET: HVAC-001
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: themeStyles.textColor }}>
                    Coach 01 Roof-Mounted Unit · Rake 104
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: themeStyles.textMuted }}>
                  <span>State: <strong style={{ color: '#10B981' }}>OPERATIONAL</strong></span>
                  <span>Health: <strong style={{ color: '#10B981' }}>{telemetryTick.health}%</strong></span>
                </div>
              </div>

              {/* 6 Real-time Sensor Tickers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF', border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted }}>Supply Air Temp</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, marginTop: 3, color: themeStyles.textColor }}>
                    {telemetryTick.temp} °C
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF', border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted }}>Refrigerant Press</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, marginTop: 3, color: themeStyles.textColor }}>
                    {telemetryTick.pressure} bar
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF', border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted }}>Compressor Current</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, marginTop: 3, color: themeStyles.codeColor }}>
                    {telemetryTick.current} A
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF', border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted }}>Filter Resistance (DP)</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, marginTop: 3, color: telemetryTick.filterDp > 160 ? '#F59E0B' : themeStyles.textColor }}>
                    {telemetryTick.filterDp} Pa
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF', border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted }}>Total Power</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, marginTop: 3, color: themeStyles.textColor }}>
                    {telemetryTick.power} kW
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF', border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted }}>Vibration (RMS)</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, marginTop: 3, color: themeStyles.textColor }}>
                    {telemetryTick.vibration} mm/s
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. PRODUCT PREVIEW TABS
          ───────────────────────────────────────────────────────────── */}
      <section
        id="capabilities"
        style={{
          padding: '80px 24px',
          maxWidth: 1240,
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: themeStyles.primary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Core Platform Architecture
          </div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, margin: '0 0 14px', color: themeStyles.textColor }}>
            One platform for the entire HVAC lifecycle.
          </h2>
          <p style={{ color: themeStyles.textMuted, fontSize: 16, maxWidth: 640, margin: '0 auto' }}>
            Explore real software views backing the Ventrix operations layer.
          </p>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 28,
          }}
        >
          {[
            { key: 'overview', label: 'Operations Overview', icon: LayoutGrid },
            { key: 'assets', label: 'HVAC Assets', icon: Boxes },
            { key: 'telemetry', label: 'Live Telemetry', icon: Activity },
            { key: 'workorders', label: 'Work Orders', icon: Wrench },
            { key: 'inventory', label: 'Depot Inventory', icon: Package },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 10,
                  border: isSel
                    ? `1px solid ${themeStyles.primary}`
                    : `1px solid ${themeStyles.cardBorder}`,
                  background: isSel
                    ? isDark
                      ? 'rgba(6, 182, 212, 0.15)'
                      : 'rgba(2, 132, 199, 0.1)'
                    : themeStyles.cardBg,
                  color: isSel ? themeStyles.primary : themeStyles.textMuted,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab View Container */}
        <div
          style={{
            borderRadius: 16,
            background: themeStyles.cardBg,
            border: `1px solid ${themeStyles.cardBorder}`,
            boxShadow: themeStyles.cardShadow,
            padding: 24,
            minHeight: 380,
            overflowX: 'auto',
          }}
        >
          {/* TAB 1: ASSETS */}
          {activeTab === 'assets' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: themeStyles.textColor }}>HVAC Fleet Registry</h3>
                  <div style={{ fontSize: 12, color: themeStyles.textMuted, marginTop: 2 }}>Authoritative equipment records across train cars & depots</div>
                </div>
                <div style={{ fontSize: 12, color: themeStyles.primary, fontWeight: 600 }}>Showing 4 of 24 Units</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: themeStyles.textMuted, borderBottom: `1px solid ${themeStyles.cardBorder}`, paddingBottom: 8 }}>
                    <th style={{ padding: '10px 8px' }}>Asset Code</th>
                    <th style={{ padding: '10px 8px' }}>Model & Specifications</th>
                    <th style={{ padding: '10px 8px' }}>Location</th>
                    <th style={{ padding: '10px 8px' }}>Operating Hours</th>
                    <th style={{ padding: '10px 8px' }}>Health Score</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { code: 'HVAC-001', model: 'Roof-Mounted Rake Unit 500', loc: 'Coach 01 (Train 104)', hours: '5,240 h', health: 94, status: 'OPERATIONAL', col: '#10B981' },
                    { code: 'HVAC-002', model: 'Split Condenser Unit 350', loc: 'Coach 02 (Train 104)', hours: '8,110 h', health: 71, status: 'WARNING', col: '#F59E0B' },
                    { code: 'HVAC-003', model: 'High-Capacity Chiller Unit', loc: 'Coach 03 (Train 104)', hours: '12,490 h', health: 38, status: 'CRITICAL', col: '#EF4444' },
                    { code: 'HVAC-005', model: 'Ventrix Modular Unit 400', loc: 'Depot Bay 4', hours: '6,800 h', health: 54, status: 'MAINTENANCE', col: '#F59E0B' },
                  ].map((row) => (
                    <tr key={row.code} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                      <td style={{ padding: '12px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: themeStyles.codeColor }}>{row.code}</td>
                      <td style={{ padding: '12px 8px', color: themeStyles.textColor }}>{row.model}</td>
                      <td style={{ padding: '12px 8px', color: themeStyles.textMuted }}>{row.loc}</td>
                      <td style={{ padding: '12px 8px', fontFamily: "'JetBrains Mono', monospace", color: themeStyles.textColor }}>{row.hours}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, maxWidth: 60, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', overflow: 'hidden' }}>
                            <div style={{ width: `${row.health}%`, height: '100%', background: row.col }} />
                          </div>
                          <span style={{ fontWeight: 700, color: row.col }}>{row.health}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${row.col}1A`, color: row.col, border: `1px solid ${row.col}40` }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: TELEMETRY */}
          {activeTab === 'telemetry' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: themeStyles.textColor }}>High-Frequency Sensor Channels</h3>
                  <div style={{ fontSize: 12, color: themeStyles.textMuted, marginTop: 2 }}>Sub-second sampling across electrical, thermal, and mechanical channels</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10B981', fontWeight: 600 }}>
                  <Activity size={14} className="animate-pulse" /> Live Telemetry Pipeline
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div style={{ padding: 16, borderRadius: 10, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 12, color: themeStyles.textMuted }}>Compressor Current</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, marginTop: 4, color: themeStyles.codeColor }}>
                    {telemetryTick.current} A
                  </div>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted, marginTop: 4 }}>Nominal range: 16.0 - 21.0 A</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 12, color: themeStyles.textMuted }}>Supply Air Temperature</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, marginTop: 4, color: themeStyles.textColor }}>
                    {telemetryTick.temp} °C
                  </div>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted, marginTop: 4 }}>Target setpoint: 18.0 °C</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 12, color: themeStyles.textMuted }}>Refrigerant Pressure</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, marginTop: 4, color: themeStyles.textColor }}>
                    {telemetryTick.pressure} bar
                  </div>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted, marginTop: 4 }}>Discharge line nominal: 7.5 - 8.5 bar</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                  <div style={{ fontSize: 12, color: themeStyles.textMuted }}>Filter Resistance (DP)</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, marginTop: 4, color: telemetryTick.filterDp > 160 ? '#F59E0B' : themeStyles.textColor }}>
                    {telemetryTick.filterDp} Pa
                  </div>
                  <div style={{ fontSize: 11, color: themeStyles.textMuted, marginTop: 4 }}>Clog warning threshold: 250 Pa</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WORK ORDERS */}
          {activeTab === 'workorders' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: themeStyles.textColor }}>Work Order Management</h3>
                  <div style={{ fontSize: 12, color: themeStyles.textMuted, marginTop: 2 }}>Closed-loop technician dispatch, diagnostics, and resolution tracking</div>
                </div>
                <div style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>Active Dispatch Queue</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: themeStyles.textMuted, borderBottom: `1px solid ${themeStyles.cardBorder}` }}>
                    <th style={{ padding: '10px 8px' }}>WO #</th>
                    <th style={{ padding: '10px 8px' }}>Asset</th>
                    <th style={{ padding: '10px 8px' }}>Title & Scope</th>
                    <th style={{ padding: '10px 8px' }}>Assigned Tech</th>
                    <th style={{ padding: '10px 8px' }}>Priority</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'WO-1024', asset: 'HVAC-005', title: 'Fan motor inspection & vibration dampening', tech: 'tech@ventrix.com', priority: 'HIGH', pCol: '#EF4444', status: 'ASSIGNED', sCol: '#3B82F6' },
                    { id: 'WO-1023', asset: 'HVAC-003', title: 'Compressor contactor relay replacement', tech: 'tech@ventrix.com', priority: 'CRITICAL', pCol: '#EF4444', status: 'IN_PROGRESS', sCol: '#F59E0B' },
                    { id: 'WO-1022', asset: 'HVAC-002', title: 'Bi-monthly return filter replacement', tech: 'tech@ventrix.com', priority: 'MEDIUM', pCol: '#F59E0B', status: 'COMPLETED', sCol: '#10B981' },
                  ].map((row) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                      <td style={{ padding: '12px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: themeStyles.codeColor }}>{row.id}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 600, color: themeStyles.textColor }}>{row.asset}</td>
                      <td style={{ padding: '12px 8px', color: themeStyles.textColor }}>{row.title}</td>
                      <td style={{ padding: '12px 8px', color: themeStyles.textMuted }}>{row.tech}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: row.pCol, background: `${row.pCol}15` }}>{row.priority}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: row.sCol, background: `${row.sCol}1A`, border: `1px solid ${row.sCol}40` }}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: INVENTORY */}
          {activeTab === 'inventory' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: themeStyles.textColor }}>Depot Spare Parts & Inventory</h3>
                  <div style={{ fontSize: 12, color: themeStyles.textMuted, marginTop: 2 }}>Stock tracking and automated consumption upon work order completion</div>
                </div>
                <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>1 Low Stock Alert</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: themeStyles.textMuted, borderBottom: `1px solid ${themeStyles.cardBorder}` }}>
                    <th style={{ padding: '10px 8px' }}>Part Code</th>
                    <th style={{ padding: '10px 8px' }}>Part Name</th>
                    <th style={{ padding: '10px 8px' }}>Category</th>
                    <th style={{ padding: '10px 8px' }}>Current Quantity</th>
                    <th style={{ padding: '10px 8px' }}>Min Threshold</th>
                    <th style={{ padding: '10px 8px' }}>Stock Health</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { code: 'VX-COMP-01', name: 'Scroll Compressor Assembly', cat: 'Compressors', qty: 3, min: 5, alert: true },
                    { code: 'VX-FAN-MOTOR-02', name: 'Condenser Fan Motor', cat: 'Motors', qty: 12, min: 10, alert: false },
                    { code: 'VX-FILTER-03', name: 'Return Air Filter (Standard)', cat: 'Filters', qty: 28, min: 15, alert: false },
                    { code: 'VX-RELAY-05', name: 'Compressor Contactor Relay', cat: 'Electrical', qty: 18, min: 10, alert: false },
                  ].map((row) => (
                    <tr key={row.code} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                      <td style={{ padding: '12px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: themeStyles.codeColor }}>{row.code}</td>
                      <td style={{ padding: '12px 8px', color: themeStyles.textColor }}>{row.name}</td>
                      <td style={{ padding: '12px 8px', color: themeStyles.textMuted }}>{row.cat}</td>
                      <td style={{ padding: '12px 8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: row.alert ? '#F59E0B' : themeStyles.textColor }}>
                        {row.qty} pcs
                      </td>
                      <td style={{ padding: '12px 8px', color: themeStyles.textMuted }}>{row.min} pcs</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: row.alert ? '#F59E0B' : '#10B981', background: row.alert ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', border: `1px solid ${row.alert ? '#F59E0B40' : '#10B98140'}` }}>
                          {row.alert ? 'LOW STOCK (REORDER)' : 'HEALTHY STOCK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ padding: 18, borderRadius: 12, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: themeStyles.textColor }}>Fleet Operational Health</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, fontFamily: "'JetBrains Mono', monospace", color: themeStyles.textColor }}>
                    87%
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: themeStyles.textColor }}>24 Total Fleet Units</div>
                    <div style={{ fontSize: 11.5, color: themeStyles.textMuted }}>Continuous predictive health index</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: themeStyles.textMuted, lineHeight: 1.5 }}>
                  Sub-second diagnostic model continuously evaluates thermal coefficients and compressor load profiles.
                </div>
              </div>

              <div style={{ padding: 18, borderRadius: 12, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: themeStyles.textColor }}>Active Maintenance Queue</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: 12 }}>
                    <strong style={{ color: '#EF4444' }}>WO-1023 (Critical):</strong> Compressor contactor replacement
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: 12 }}>
                    <strong style={{ color: '#F59E0B' }}>WO-1024 (Warning):</strong> Fan motor inspection & dampening
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. CORE CAPABILITIES BENTO
          ───────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '80px 24px',
          maxWidth: 1240,
          margin: '0 auto',
          borderTop: `1px solid ${themeStyles.cardBorder}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: themeStyles.primary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Complete Operational Matrix
          </div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, margin: '0 0 14px', color: themeStyles.textColor }}>
            Everything your HVAC operation needs.
          </h2>
          <p style={{ color: themeStyles.textMuted, fontSize: 16, maxWidth: 680, margin: '0 auto' }}>
            One system for equipment, live condition, maintenance work orders, and the people keeping trains running.
          </p>
        </div>

        {/* Bento Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {/* Card 1: Asset Registry */}
          <div style={{ padding: 28, borderRadius: 16, background: themeStyles.cardBg, border: `1px solid ${themeStyles.cardBorder}`, boxShadow: themeStyles.cardShadow }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: isDark ? 'rgba(6, 182, 212, 0.12)' : 'rgba(2, 132, 199, 0.1)', border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeStyles.primary, marginBottom: 18 }}>
              <Boxes size={22} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: themeStyles.textColor }}>Asset Management</h3>
            <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.6, margin: 0 }}>
              Know every HVAC unit across coaches and depot bays. Track serial numbers, installation dates, operating hours, and full maintenance history.
            </p>
          </div>

          {/* Card 2: Live Telemetry */}
          <div style={{ padding: 28, borderRadius: 16, background: themeStyles.cardBg, border: `1px solid ${themeStyles.cardBorder}`, boxShadow: themeStyles.cardShadow }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.1)', border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7', marginBottom: 18 }}>
              <Activity size={22} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: themeStyles.textColor }}>Live Telemetry Streaming</h3>
            <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.6, margin: 0 }}>
              See what your equipment is doing right now. Real-time metrics for supply temperature, pressure, compressor current, filter DP, and electrical power.
            </p>
          </div>

          {/* Card 3: Work Orders */}
          <div style={{ padding: 28, borderRadius: 16, background: themeStyles.cardBg, border: `1px solid ${themeStyles.cardBorder}`, boxShadow: themeStyles.cardShadow }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B', marginBottom: 18 }}>
              <Wrench size={22} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: themeStyles.textColor }}>Maintenance Work Orders</h3>
            <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.6, margin: 0 }}>
              Assign work orders to certified technicians with clear due dates, priority tiers, step-by-step diagnostic checklists, and sign-offs.
            </p>
          </div>

          {/* Card 4: Inventory & Spares */}
          <div style={{ padding: 28, borderRadius: 16, background: themeStyles.cardBg, border: `1px solid ${themeStyles.cardBorder}`, boxShadow: themeStyles.cardShadow }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', marginBottom: 18 }}>
              <Package size={22} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: themeStyles.textColor }}>Spares & Depot Inventory</h3>
            <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.6, margin: 0 }}>
              Maintain accurate spare parts stock. Automatic stock reduction when work orders are executed and low-stock alerts before stockouts happen.
            </p>
          </div>

          {/* Card 5: Anomaly Alerts */}
          <div style={{ padding: 28, borderRadius: 16, background: themeStyles.cardBg, border: `1px solid ${themeStyles.cardBorder}`, boxShadow: themeStyles.cardShadow }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', marginBottom: 18 }}>
              <Bell size={22} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: themeStyles.textColor }}>Diagnostic Events & Alerts</h3>
            <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.6, margin: 0 }}>
              Turn telemetry anomalies into operational actions. Threshold violations instantly generate triage alerts with one-click conversion to work orders.
            </p>
          </div>

          {/* Card 6: Role Security */}
          <div style={{ padding: 28, borderRadius: 16, background: themeStyles.cardBg, border: `1px solid ${themeStyles.cardBorder}`, boxShadow: themeStyles.cardShadow }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6', marginBottom: 18 }}>
              <Shield size={22} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: themeStyles.textColor }}>Role-Based Access Control</h3>
            <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.6, margin: 0 }}>
              Dedicated, streamlined interfaces tailored for Admin, Engineer, and Technician with database-backed permission validation.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. "FROM SIGNAL TO SERVICE" OPERATIONAL WORKFLOW
          ───────────────────────────────────────────────────────────── */}
      <section
        id="workflow"
        style={{
          padding: '80px 24px',
          maxWidth: 1240,
          margin: '0 auto',
          borderTop: `1px solid ${themeStyles.cardBorder}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: themeStyles.primary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            End-to-End Operational Pipeline
          </div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, margin: '0 0 14px', color: themeStyles.textColor }}>
            From equipment signal to completed service.
          </h2>
          <p style={{ color: themeStyles.textMuted, fontSize: 16, maxWidth: 680, margin: '0 auto' }}>
            Ventrix connects what your HVAC units are reporting directly with the maintenance tasks your technicians perform.
          </p>
        </div>

        {/* Interactive Step Navigator */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 28 }}>
          {WORKFLOW_STEPS.map((step) => {
            const isSel = activeWorkflowStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => {
                  setActiveWorkflowStep(step.id);
                  setIsPlayingWorkflow(false);
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: isSel
                    ? `1px solid ${themeStyles.primary}`
                    : `1px solid ${themeStyles.cardBorder}`,
                  background: isSel
                    ? isDark
                      ? 'rgba(6, 182, 212, 0.15)'
                      : 'rgba(2, 132, 199, 0.1)'
                    : themeStyles.cardBg,
                  color: isSel ? themeStyles.textColor : themeStyles.textMuted,
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 700, color: isSel ? themeStyles.primary : themeStyles.textMuted, marginBottom: 4 }}>
                  {step.badge}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isSel ? themeStyles.textColor : themeStyles.textMuted }}>
                  {step.title.split('&')[0]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Step Detail Display */}
        {(() => {
          const s = WORKFLOW_STEPS[activeWorkflowStep];
          return (
            <div
              style={{
                borderRadius: 16,
                background: themeStyles.cardBg,
                border: `1px solid ${themeStyles.cardBorder}`,
                boxShadow: themeStyles.cardShadow,
                padding: '32px 28px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 28,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 20, background: isDark ? 'rgba(6,182,212,0.15)' : 'rgba(2,132,199,0.1)', color: themeStyles.primary, fontSize: 11.5, fontWeight: 700, marginBottom: 12 }}>
                  {s.badge}
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', color: themeStyles.textColor }}>{s.title}</h3>
                <p style={{ color: themeStyles.textMuted, fontSize: 14.5, lineHeight: 1.6, margin: '0 0 20px' }}>{s.desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setActiveWorkflowStep((prev) => (prev - 1 + 6) % 6)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${themeStyles.cardBorder}`, background: 'transparent', color: themeStyles.textMuted, cursor: 'pointer', fontSize: 12 }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setActiveWorkflowStep((prev) => (prev + 1) % 6)}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: themeStyles.primary, color: isDark ? '#000' : '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                  >
                    Next Stage →
                  </button>
                </div>
              </div>

              <div style={{ padding: 22, borderRadius: 12, background: themeStyles.cardInnerBg, border: `1px solid ${themeStyles.cardBorder}` }}>
                <div style={{ fontSize: 11.5, color: themeStyles.textMuted, marginBottom: 6 }}>{s.metricLabel}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: themeStyles.codeColor, marginBottom: 14 }}>
                  {s.metricVal}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.statusColor, boxShadow: `0 0 8px ${s.statusColor}` }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: s.statusColor }}>{s.status}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. ROLE SECTION — THE 3 USERS
          ───────────────────────────────────────────────────────────── */}
      <section
        id="roles"
        style={{
          padding: '80px 24px',
          maxWidth: 1240,
          margin: '0 auto',
          borderTop: `1px solid ${themeStyles.cardBorder}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: themeStyles.primary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Tailored Access Control
          </div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, margin: '0 0 14px', color: themeStyles.textColor }}>
            Built for everyone running your depot.
          </h2>
          <p style={{ color: themeStyles.textMuted, fontSize: 16, maxWidth: 640, margin: '0 auto' }}>
            One platform that provides tailored workflows for administrators, engineers, and field technicians.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Admin Role */}
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: themeStyles.cardBg,
              border: activeRoleView === 'admin' ? `1.5px solid ${themeStyles.primary}` : `1px solid ${themeStyles.cardBorder}`,
              boxShadow: themeStyles.cardShadow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ padding: '3px 9px', borderRadius: 4, background: isDark ? 'rgba(6,182,212,0.15)' : 'rgba(2,132,199,0.1)', color: themeStyles.primary, fontSize: 11, fontWeight: 800 }}>
                  ROLE: ADMIN
                </span>
                <span style={{ fontSize: 12, color: themeStyles.textMuted }}>admin@ventrix.com</span>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 10px', color: themeStyles.textColor }}>Ventrix Administrator</h3>
              <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.5, margin: '0 0 16px' }}>
                Full system control: User management, asset approvals, role permissions, work order closure, and global telemetry oversight.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', fontSize: 12.5, color: themeStyles.textColor, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#06B6D4" /> User Management & RBAC</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#06B6D4" /> Work Order Sign-off</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#06B6D4" /> Fleet-wide Asset Registry</li>
              </ul>
            </div>
            <button
              onClick={() => handleQuickLogin('admin@ventrix.com', 'admin')}
              disabled={quickLoginLoading === 'admin'}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {quickLoginLoading === 'admin' ? 'Launching...' : 'Demo Login as Admin →'}
            </button>
          </div>

          {/* Engineer Role */}
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: themeStyles.cardBg,
              border: activeRoleView === 'engineer' ? '1.5px solid #3B82F6' : `1px solid ${themeStyles.cardBorder}`,
              boxShadow: themeStyles.cardShadow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ padding: '3px 9px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 11, fontWeight: 800 }}>
                  ROLE: ENGINEER
                </span>
                <span style={{ fontSize: 12, color: themeStyles.textMuted }}>engineer@ventrix.com</span>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 10px', color: themeStyles.textColor }}>Diagnostic Engineer</h3>
              <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.5, margin: '0 0 16px' }}>
                Operational & technical control: Live telemetry analysis, degradation diagnostics, maintenance planning, and spare parts catalog.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', fontSize: 12.5, color: themeStyles.textColor, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#3B82F6" /> Sensor Telemetry History</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#3B82F6" /> Maintenance Planning</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#3B82F6" /> Inventory & Part Catalog</li>
              </ul>
            </div>
            <button
              onClick={() => handleQuickLogin('engineer@ventrix.com', 'engineer')}
              disabled={quickLoginLoading === 'engineer'}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#3B82F6',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {quickLoginLoading === 'engineer' ? 'Launching...' : 'Demo Login as Engineer →'}
            </button>
          </div>

          {/* Technician Role */}
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: themeStyles.cardBg,
              border: activeRoleView === 'technician' ? '1.5px solid #10B981' : `1px solid ${themeStyles.cardBorder}`,
              boxShadow: themeStyles.cardShadow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ padding: '3px 9px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: 11, fontWeight: 800 }}>
                  ROLE: TECHNICIAN
                </span>
                <span style={{ fontSize: 12, color: themeStyles.textMuted }}>tech@ventrix.com</span>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 10px', color: themeStyles.textColor }}>Field Technician</h3>
              <p style={{ fontSize: 13.5, color: themeStyles.textMuted, lineHeight: 1.5, margin: '0 0 16px' }}>
                Field execution: Accepting assigned work orders, logging maintenance progress, recording parts consumed, and service tickets.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', fontSize: 12.5, color: themeStyles.textColor, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#10B981" /> Assigned Work Orders</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#10B981" /> Log Maintenance & Parts</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#10B981" /> Create Service Tickets</li>
              </ul>
            </div>
            <button
              onClick={() => handleQuickLogin('tech@ventrix.com', 'tech')}
              disabled={quickLoginLoading === 'tech'}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#10B981',
                color: '#000',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {quickLoginLoading === 'tech' ? 'Launching...' : 'Demo Login as Technician →'}
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. FINAL CTA BANNER
          ───────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '88px 24px',
          maxWidth: 1240,
          margin: '0 auto',
          textAlign: 'center',
          borderTop: `1px solid ${themeStyles.cardBorder}`,
        }}
      >
        <div
          style={{
            padding: '48px 32px',
            borderRadius: 20,
            background: isDark
              ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
              : 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, #FFFFFF 100%)',
            border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(2, 132, 199, 0.2)'}`,
            boxShadow: themeStyles.cardShadow,
          }}
        >
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, margin: '0 0 14px', color: themeStyles.textColor }}>
            Run your HVAC operation from one place.
          </h2>
          <p style={{ color: themeStyles.textMuted, fontSize: 16, maxWidth: 640, margin: '0 auto 28px' }}>
            Ventrix brings assets, live telemetry, maintenance work orders, and inventory together into a unified operational console.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link
              to="/login"
              style={{
                padding: '12px 28px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Sign In to Platform <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. FOOTER
          ───────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${themeStyles.footerBorder}`,
          background: themeStyles.footerBg,
          padding: '48px 28px 32px',
          color: themeStyles.textMuted,
          fontSize: 13,
          transition: 'background 0.25s',
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={14} color="#FFFFFF" />
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: themeStyles.textColor, fontSize: 16 }}>VENTRIX</span>
            <span style={{ color: themeStyles.textMuted }}>· HVAC Operations, Unified</span>
          </div>

          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#overview" style={{ color: themeStyles.textMuted, textDecoration: 'none' }}>Platform</a>
            <a href="#capabilities" style={{ color: themeStyles.textMuted, textDecoration: 'none' }}>Capabilities</a>
            <a href="#workflow" style={{ color: themeStyles.textMuted, textDecoration: 'none' }}>Workflow</a>
            <Link to="/login" style={{ color: themeStyles.primary, textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
          </div>
        </div>

        <div
          style={{
            maxWidth: 1240,
            margin: '24px auto 0',
            paddingTop: 20,
            borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.04)' : '#E2E8F0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
          }}
        >
          <span>© 2026 Ventrix Operations Platform. All rights reserved.</span>
          <span style={{ color: '#10B981' }}>● All System Nodes Nominal</span>
        </div>
      </footer>
    </div>
  );
}

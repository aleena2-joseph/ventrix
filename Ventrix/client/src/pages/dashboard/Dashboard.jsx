import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getLatestTelemetry } from "../../services/telemetryService";
import { getAssets as getAssetRegistry } from "../../services/assetService";
import { alertService } from "../../services/alertService";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import ThemeToggle from "../../components/layout/ThemeToggle";
import Card from "../../components/common/Card";

// Subpage modules
import OverviewPage from "./components/OverviewPage";
import AssetManagement from "./components/AssetManagement";
import TelemetryPage from "./components/TelemetryPage";
import PredictionsPage from "./components/PredictionsPage";
import AlertsPage from "./components/AlertsPage";
import MaintenancePage from "./components/MaintenancePage";
import ServiceRequestsPage from "./components/ServiceRequestsPage";
import InventoryPage from "./components/InventoryPage";
import UsersPage from "./components/UsersPage";
import RolePermissionsPage from "./components/RolePermissionsPage";

import {
  LayoutGrid,
  Boxes,
  Activity,
  TrendingUp,
  Bell,
  Users as UsersIcon,
  LogOut,
  Wrench,
  Shield,
  Layers,
  Menu,
} from "lucide-react";

// Navigation definition with RBAC permission keys
const NAV_GROUPS = [
  {
    title: "Monitoring & Operations",
    items: [
      { key: "dashboard", label: "Overview Dashboard", icon: LayoutGrid, permission: "dashboard.view" },
      { key: "telemetry", label: "Live Telemetry", icon: Activity, permission: "telemetry.view" },
      // AI & RUL predictions commented out for now:
      // { key: "predictions", label: "AI & RUL Predictions", icon: TrendingUp, permission: "predictions.view" },
      { key: "alerts", label: "Alerts & Anomalies", icon: Bell, permission: "alerts.view" },
    ],
  },
  {
    title: "Asset Management",
    items: [
      { key: "assets", label: "HVAC Asset Registry", icon: Boxes, permission: "assets.view" },
    ],
  },
  {
    title: "Depot Operations",
    items: [
      { key: "service-requests", label: "Service Requests", icon: Bell, permission: "service_requests.view" },
      { key: "maintenance", label: "Maintenance & Work Orders", icon: Wrench, permission: "maintenance.view" },
      { key: "inventory", label: "Spare Parts & Stock", icon: Layers, permission: "inventory.manage" },
    ],
  },
  {
    title: "Administration",
    items: [
      { key: "users", label: "Users & Access", icon: UsersIcon, permission: "users.manage" },
      { key: "settings", label: "Roles & Permissions", icon: Shield, permission: "settings.manage" },
    ],
  },
];

function mapRowToAsset(row) {
  const health = row.raw_payload?.health || {};
  return {
    id: row.asset_code,
    name: row.asset_name,
    health:
      row.predicted_health_score != null
        ? Number(row.predicted_health_score)
        : typeof health.healthScore === "number"
        ? health.healthScore
        : null,
    temperature: row.temperature != null ? Number(row.temperature) : null,
    pressure: row.pressure != null ? Number(row.pressure) : null,
    status: row.asset_state || "Unknown",
    rul: row.predicted_rul_hours != null ? Number(row.predicted_rul_hours) : null,
    riskLevel: row.risk_level || "Unknown",
  };
}

function mapRowToAlert(row) {
  const ts = row.created_at ? new Date(row.created_at) : null;
  return {
    id: row.id,
    level: row.level || "info",
    title: row.title,
    message: row.message,
    asset: row.asset_code || "Unknown",
    asset_code: row.asset_code,
    source: row.source,
    is_resolved: row.is_resolved,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    time: ts && !isNaN(ts) ? ts.toLocaleString() : "Just now",
  };
}

function mapRowToTelemetry(row) {
  if (!row) return { temperature: null, pressure: null, current: null, voltage: null, humidity: null, power: null, operatingHours: null, vibration: null };
  return {
    temperature: row.temperature != null ? Number(row.temperature) : null,
    pressure: row.pressure != null ? Number(row.pressure) : null,
    current: row.current != null ? Number(row.current) : null,
    voltage: row.voltage != null ? Number(row.voltage) : null,
    humidity: row.humidity != null ? Number(row.humidity) : null,
    power: row.power != null ? Number(row.power) : null,
    operatingHours: row.operating_hours != null ? Number(row.operating_hours) : null,
    vibration: row.vibration != null ? Number(row.vibration) : null,
  };
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// NAV ITEM BUTTON
function NavItem({ item, isActive, onClick, t }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 12px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        background: isActive ? (t.isDark ? "rgba(56,189,248,0.12)" : "rgba(2,132,199,0.09)") : "transparent",
        color: isActive ? t.primary : t.textMuted,
        fontWeight: isActive ? 600 : 500,
        fontSize: 13.5,
        textAlign: "left",
        transition: "all 0.15s ease",
        borderLeft: isActive ? `2px solid ${t.primary}` : "2px solid transparent",
        marginLeft: -1,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = t.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
          e.currentTarget.style.color = t.text;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = t.textMuted;
        }
      }}
    >
      <Icon size={15} />
      <span style={{ flex: 1 }}>{item.label}</span>
    </button>
  );
}

export default function VentrixDashboard() {
  const navigate = useNavigate();
  const { user, role, can, logout } = useAuth();
  const { isDark, toggleTheme, tokens: t } = useTheme();
  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [assets, setAssets] = useState([]);
  const [registryCount, setRegistryCount] = useState(null);
  const [telemetry, setTelemetry] = useState(mapRowToTelemetry(null));
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = useLiveClock();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const allNavItems = useMemo(() => NAV_GROUPS.flatMap((g) => g.items), []);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(item.permission)),
    })).filter((group) => group.items.length > 0);
  }, [can]);

  // Reset to first visible if current page is hidden
  useEffect(() => {
    const flat = visibleGroups.flatMap((g) => g.items);
    if (flat.length > 0 && !flat.some((i) => i.key === active)) {
      setActive(flat[0].key);
    }
  }, [visibleGroups, active]);

  // Poll telemetry every 3s
  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const [telRes, alertRes] = await Promise.all([
          getLatestTelemetry(),
          alertService.list(false),
        ]);
        if (cancelled) return;
        if (telRes.success) {
          const rows = telRes.data || [];
          setAssets(rows.map(mapRowToAsset));
          setTelemetry(mapRowToTelemetry(rows[0]));
        }
        if (alertRes.success) setAlerts((alertRes.data || []).map(mapRowToAlert));
      } catch {
        // Silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    const t = setInterval(fetchAll, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    getAssetRegistry()
      .then((res) => { if (res.success) setRegistryCount(res.data.length); })
      .catch(() => {});
  }, [active]);

  const activeCount = assets.filter((a) => a.status !== "ALARM").length;
  const avgHealth = assets.length > 0 ? Math.round(assets.reduce((s, a) => s + (a.health || 0), 0) / assets.length) : 100;
  const predicted = assets.filter((a) => Number.isFinite(a.rul));
  const avgRUL = predicted.length > 0 ? Math.round(predicted.reduce((s, a) => s + a.rul, 0) / predicted.length) : "—";
  const criticalAlerts = alerts.filter((a) => (a.level === "critical" || a.level === "warning") && !a.is_resolved).length;

  const pageTitle = allNavItems.find((n) => n.key === active)?.label || "Dashboard";

  const COLORS_LEGACY = { bg: t.bg, sidebar: t.sidebar, card: t.card, border: t.border, primary: t.primary, success: t.success, warning: t.warning, danger: t.danger, muted: t.textMuted, white: t.text };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)"}; border-radius: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        button { font-family: inherit; }
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: sidebarOpen ? 240 : 0,
        background: t.sidebar,
        borderRight: `1px solid ${t.border}`,
        display: "flex", flexDirection: "column",
        zIndex: 40, overflow: "hidden",
        transition: "width 0.2s ease",
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 18px 14px 18px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(56,189,248,0.35)",
              flexShrink: 0,
            }}>
              <Activity size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3, color: t.text, lineHeight: 1 }}>Ventrix</div>
              <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 1 }}>HVAC · RUL Platform</div>
            </div>
          </div>
        </div>

        {/* Nav Groups */}
        <nav style={{ flex: 1, padding: "12px 12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: t.textMuted,
                textTransform: "uppercase", letterSpacing: 0.8,
                padding: "0 4px", marginBottom: 4,
              }}>
                {group.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {group.items.map((item) => (
                  <NavItem
                    key={item.key}
                    item={item}
                    isActive={active === item.key}
                    onClick={() => setActive(item.key)}
                    t={{ ...t, isDark }}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: "12px 12px 16px", borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 8,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            marginBottom: 4,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: isDark ? "rgba(56,189,248,0.15)" : "rgba(2,132,199,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: t.primary, fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || "V"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name || "User"}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.role_name || role || "Admin"}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "7px 10px", borderRadius: 7,
              border: "none", cursor: "pointer", background: "transparent",
              color: isDark ? "#F87171" : "#DC2626",
              fontSize: 13, fontWeight: 500, textAlign: "left",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(248,113,113,0.08)" : "rgba(220,38,38,0.06)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, marginLeft: sidebarOpen ? 240 : 0, minWidth: 0, display: "flex", flexDirection: "column", transition: "margin-left 0.2s ease" }}>

        {/* ── TOP HEADER BAR ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 30,
          height: 60,
          background: t.sidebar,
          borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center",
          padding: "0 24px",
          gap: 16,
        }}>
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 7, border: `1px solid ${t.border}`,
              background: "transparent", cursor: "pointer", color: t.textMuted,
              transition: "all 0.15s ease", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = t.text; e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.background = "transparent"; }}
          >
            <Menu size={15} />
          </button>

          {/* Page title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>{pageTitle}</div>
            <div style={{ fontSize: 11.5, color: t.textMuted }}>
              {user?.organization_name || "Ventrix"} · {now.toLocaleDateString()} {now.toLocaleTimeString()}
            </div>
          </div>

          {/* Right controls — Theme Toggle prominently in top-right */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {criticalAlerts > 0 && (
              <button
                onClick={() => setActive("alerts")}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 7,
                  border: `1px solid ${isDark ? "rgba(248,113,113,0.3)" : "rgba(220,38,38,0.25)"}`,
                  background: isDark ? "rgba(248,113,113,0.1)" : "rgba(220,38,38,0.06)",
                  color: isDark ? "#F87171" : "#DC2626",
                  fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                }}
              >
                <Bell size={13} />
                {criticalAlerts} Alert{criticalAlerts !== 1 ? "s" : ""}
              </button>
            )}

            {/* ── THEME TOGGLE BUTTON (prominent, always visible) ── */}
            <ThemeToggle />

            {/* User avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: isDark ? "rgba(56,189,248,0.15)" : "rgba(2,132,199,0.12)",
              border: `1px solid ${isDark ? "rgba(56,189,248,0.25)" : "rgba(2,132,199,0.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: t.primary, fontWeight: 700, fontSize: 13, cursor: "default",
            }} title={user?.email || ""}>
              {user?.name?.charAt(0)?.toUpperCase() || "V"}
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main style={{ flex: 1, padding: "24px 28px", overflow: "auto" }}>
          {active === "dashboard" && (
            <OverviewPage
              activeCount={activeCount}
              totalAssets={registryCount ?? assets.length}
              avgHealth={avgHealth}
              avgRUL={avgRUL}
              criticalAlerts={criticalAlerts}
              telemetry={telemetry}
              assets={assets}
              alerts={alerts}
              onNavigate={setActive}
            />
          )}
          {active === "assets"          && <AssetManagement COLORS={COLORS_LEGACY} Card={Card} />}
          {active === "telemetry"       && <TelemetryPage telemetry={telemetry} />}
          {/* {active === "predictions"  && <PredictionsPage assets={assets} onNavigate={setActive} />} */}
          {active === "alerts"          && <AlertsPage onNavigate={setActive} />}
          {active === "service-requests"&& <ServiceRequestsPage COLORS={COLORS_LEGACY} Card={Card} />}
          {active === "maintenance"     && <MaintenancePage COLORS={COLORS_LEGACY} Card={Card} role={role} />}
          {active === "inventory"       && <InventoryPage COLORS={COLORS_LEGACY} Card={Card} />}
          {active === "users"           && <UsersPage />}
          {active === "settings"        && <RolePermissionsPage />}
        </main>
      </div>
    </div>
  );
}

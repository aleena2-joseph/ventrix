import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  Activity,
  Bell,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
  Users,
  ShieldCheck,
  Plus,
  Layers,
  Sparkles,
  Gauge,
  Thermometer,
  Zap,
  ChevronRight,
  Radio,
} from "lucide-react";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";
import { maintenanceService } from "../../../services/maintenanceService";
import { inventoryService } from "../../../services/inventoryService";
import { userService } from "../../../services/userService";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";

export default function AdminOverview({
  activeCount = 0,
  totalAssets = 0,
  avgHealth = 100,
  avgRUL = "—",
  criticalAlerts = 0,
  assets = [],
  alerts = [],
  onNavigate,
}) {
  const { user } = useAuth();
  const { isDark, tokens: t } = useTheme();

  const [workOrders, setWorkOrders] = useState([]);
  const [lowStockParts, setLowStockParts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());

  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true);
      try {
        const [woRes, invRes, usersRes] = await Promise.all([
          maintenanceService.listWorkOrders().catch(() => ({ success: false })),
          inventoryService.listParts().catch(() => ({ success: false })),
          userService.list().catch(() => ({ success: false })),
        ]);

        if (woRes?.success && Array.isArray(woRes.data)) {
          setWorkOrders(woRes.data);
        }
        if (invRes?.success && Array.isArray(invRes.data)) {
          const low = invRes.data.filter(
            (p) => Number(p.total_quantity || p.quantity || 0) <= Number(p.minimum_stock || p.min_stock || 5)
          );
          setLowStockParts(low);
        }
        if (usersRes?.success && Array.isArray(usersRes.data)) {
          const techs = usersRes.data.filter((u) => u.role_name === "TECHNICIAN");
          setTechnicians(techs);
        }
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  // Asset breakdown
  const healthyAssets = safeAssets.filter((a) => (a.health || 0) >= 80).length;
  const warningAssets = safeAssets.filter((a) => (a.health || 0) >= 50 && (a.health || 0) < 80).length;
  const criticalAssets = safeAssets.filter((a) => (a.health || 0) > 0 && (a.health || 0) < 50).length;

  // Work Orders breakdown
  const openWOs = workOrders.filter((w) => w.status === "OPEN").length;
  const assignedWOs = workOrders.filter((w) => w.status === "ASSIGNED").length;
  const inProgressWOs = workOrders.filter((w) => w.status === "IN_PROGRESS").length;
  const completedWOs = workOrders.filter((w) => w.status === "COMPLETED" || w.status === "CLOSED").length;
  const totalWOs = workOrders.length;

  // Calculate technician workload
  const techWorkload = useMemo(() => {
    return technicians.map((tech) => {
      const assigned = workOrders.filter((w) => w.assigned_to === tech.id);
      const active = assigned.filter((w) => w.status !== "COMPLETED" && w.status !== "CLOSED").length;
      const completed = assigned.filter((w) => w.status === "COMPLETED" || w.status === "CLOSED").length;
      return {
        ...tech,
        activeCount: active,
        completedCount: completed,
      };
    });
  }, [technicians, workOrders]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── 1. EXECUTIVE HEADER BANNER ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          {/* Breadcrumb & Live Radar Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                background: isDark ? "rgba(14, 165, 233, 0.15)" : "rgba(2, 132, 199, 0.1)",
                color: isDark ? "#38BDF8" : "#0284C7",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                border: `1px solid ${isDark ? "rgba(56, 189, 248, 0.25)" : "rgba(2, 132, 199, 0.2)"}`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: criticalAlerts > 0 ? "#EF4444" : "#10B981",
                  boxShadow: `0 0 8px ${criticalAlerts > 0 ? "#EF4444" : "#10B981"}`,
                }}
              />
              {criticalAlerts > 0 ? "ACTION REQUIRED" : "ALL SYSTEMS OPERATIONAL"}
            </span>

            <span style={{ fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={12} />
              {clock.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {clock.toLocaleTimeString()}
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: t.textHeading,
              margin: 0,
            }}
          >
            Executive Platform Overview
          </h1>
          <p style={{ color: t.textMuted, fontSize: 13.5, margin: "6px 0 0 0" }}>
            Central intelligence dashboard monitoring rolling stock HVAC health, maintenance lifecycle, and depot logistics.
          </p>
        </div>

        {/* Quick Executive Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate && onNavigate("users")}
          >
            <Users size={14} style={{ marginRight: 6 }} />
            User Access
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate && onNavigate("inventory")}
          >
            <Package size={14} style={{ marginRight: 6 }} />
            Spare Parts
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate && onNavigate("maintenance")}
          >
            <Wrench size={14} style={{ marginRight: 6 }} />
            Dispatch Work Order
          </Button>
        </div>
      </div>

      {/* ── 2. ATTENTION NOTIFICATION STRIP (Conditional Alert or Status) ── */}
      {lowStockParts.length > 0 && (
        <div
          style={{
            padding: "14px 20px",
            borderRadius: 14,
            background: isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.08)",
            border: `1px solid ${isDark ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.4)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            boxShadow: t.shadowSm,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: isDark ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#FBBF24" : "#D97706",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: isDark ? "#FBBF24" : "#B45309" }}>
                Depot Inventory Low-Stock Alert
              </div>
              <div style={{ fontSize: 12.5, color: t.text, opacity: 0.85, marginTop: 2 }}>
                {lowStockParts.length} critical spare parts item{lowStockParts.length > 1 ? "s are" : " is"} currently at or below minimum threshold:{" "}
                <strong>{lowStockParts.slice(0, 3).map((p) => p.name || p.part_name).join(", ")}</strong>
                {lowStockParts.length > 3 ? ` and ${lowStockParts.length - 3} more` : ""}.
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate && onNavigate("inventory")}
            style={{
              color: isDark ? "#FBBF24" : "#B45309",
              borderColor: isDark ? "rgba(245, 158, 11, 0.4)" : "rgba(245, 158, 11, 0.5)",
            }}
          >
            Review Stock & Reorder →
          </Button>
        </div>
      )}

      {/* ── 3. FIVE CORE KPI METRIC CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
        {/* Card 1: Total Assets */}
        <Card
          hoverEffect={true}
          accentColor="#0284C7"
          onClick={() => onNavigate && onNavigate("assets")}
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: t.textMuted, fontWeight: 700, letterSpacing: "0.05em" }}>
              TOTAL HVAC FLEET
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isDark ? "rgba(2, 132, 199, 0.2)" : "rgba(2, 132, 199, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#38BDF8" : "#0284C7",
              }}
            >
              <Boxes size={16} />
            </div>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 30,
              fontWeight: 800,
              color: t.textHeading,
              lineHeight: 1.1,
            }}
          >
            {totalAssets || safeAssets.length || 0}
          </div>
          <div style={{ display: "flex", gap: 6, fontSize: 11.5, marginTop: 10, fontWeight: 600, flexWrap: "wrap" }}>
            <span style={{ color: "#10B981" }}>{healthyAssets || safeAssets.length} Nominal</span>
            <span style={{ color: t.textMuted }}>·</span>
            <span style={{ color: "#F59E0B" }}>{warningAssets} Warning</span>
            <span style={{ color: t.textMuted }}>·</span>
            <span style={{ color: "#EF4444" }}>{criticalAssets} Fault</span>
          </div>
        </Card>

        {/* Card 2: Fleet Health Index */}
        <Card
          hoverEffect={true}
          accentColor={avgHealth < 75 ? "#F59E0B" : "#10B981"}
          onClick={() => onNavigate && onNavigate("telemetry")}
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: t.textMuted, fontWeight: 700, letterSpacing: "0.05em" }}>
              FLEET HEALTH INDEX
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: avgHealth < 75 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: avgHealth < 75 ? "#F59E0B" : "#10B981",
              }}
            >
              <Activity size={16} />
            </div>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 30,
              fontWeight: 800,
              color: avgHealth < 75 ? "#F59E0B" : "#10B981",
              lineHeight: 1.1,
            }}
          >
            {typeof avgHealth === "number" && !isNaN(avgHealth) ? `${Math.round(avgHealth)}%` : "—"}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span>Status:</span>
            <strong style={{ color: avgHealth < 75 ? "#F59E0B" : "#10B981" }}>
              {typeof avgHealth !== "number" || isNaN(avgHealth) ? "Awaiting Readings" : avgHealth >= 80 ? "Optimal Performance" : "Degradation Monitored"}
            </strong>
          </div>
        </Card>

        {/* Card 3: Active Alerts */}
        <Card
          hoverEffect={true}
          accentColor={criticalAlerts > 0 ? "#EF4444" : "#10B981"}
          onClick={() => onNavigate && onNavigate("alerts")}
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: t.textMuted, fontWeight: 700, letterSpacing: "0.05em" }}>
              ACTIVE FAULT ALERTS
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: criticalAlerts > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: criticalAlerts > 0 ? "#EF4444" : "#10B981",
              }}
            >
              <Bell size={16} />
            </div>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 30,
              fontWeight: 800,
              color: criticalAlerts > 0 ? "#EF4444" : t.textHeading,
              lineHeight: 1.1,
            }}
          >
            {criticalAlerts}
          </div>
          <div style={{ fontSize: 12, color: criticalAlerts > 0 ? "#EF4444" : "#10B981", marginTop: 10, fontWeight: 600 }}>
            {criticalAlerts > 0 ? "Requires technician triage" : "Zero active fault alerts"}
          </div>
        </Card>

        {/* Card 4: Work Orders */}
        <Card
          hoverEffect={true}
          accentColor="#3B82F6"
          onClick={() => onNavigate && onNavigate("maintenance")}
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: t.textMuted, fontWeight: 700, letterSpacing: "0.05em" }}>
              ACTIVE WORK ORDERS
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#3B82F6",
              }}
            >
              <Wrench size={16} />
            </div>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 30,
              fontWeight: 800,
              color: "#3B82F6",
              lineHeight: 1.1,
            }}
          >
            {openWOs + inProgressWOs + assignedWOs}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 10 }}>
            {completedWOs} closed · {inProgressWOs} in progress
          </div>
        </Card>

        {/* Card 5: Inventory Stock */}
        <Card
          hoverEffect={true}
          accentColor={lowStockParts.length > 0 ? "#F59E0B" : "#10B981"}
          onClick={() => onNavigate && onNavigate("inventory")}
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: t.textMuted, fontWeight: 700, letterSpacing: "0.05em" }}>
              LOW-STOCK PARTS
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: lowStockParts.length > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: lowStockParts.length > 0 ? "#F59E0B" : "#10B981",
              }}
            >
              <Package size={16} />
            </div>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 30,
              fontWeight: 800,
              color: lowStockParts.length > 0 ? "#F59E0B" : "#10B981",
              lineHeight: 1.1,
            }}
          >
            {lowStockParts.length}
          </div>
          <div style={{ fontSize: 12, color: lowStockParts.length > 0 ? "#F59E0B" : "#10B981", marginTop: 10, fontWeight: 600 }}>
            {lowStockParts.length > 0 ? "Threshold breached" : "Inventory healthy"}
          </div>
        </Card>
      </div>

      {/* ── 4. OPERATIONS PIPELINE & TECHNICIAN ALLOCATION ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        {/* Left Column: Work Order Operations Pipeline */}
        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3B82F6",
                }}
              >
                <Wrench size={18} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: t.textHeading }}>
                  Work Order Operations Pipeline
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  Total active & queued maintenance tickets across depots
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate && onNavigate("maintenance")}
              style={{
                background: "transparent",
                border: "none",
                color: t.primary,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View Kanban Board <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Open / Unassigned */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                <span style={{ color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94A3B8" }} />
                  Open / Unassigned
                </span>
                <strong style={{ color: t.textHeading }}>{openWOs}</strong>
              </div>
              <div style={{ width: "100%", height: 8, background: t.cardInner, borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${totalWOs ? (openWOs / totalWOs) * 100 : 0}%`,
                    height: "100%",
                    background: "#94A3B8",
                    borderRadius: 999,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            {/* Assigned to Technician */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                <span style={{ color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} />
                  Assigned to Field Technicians
                </span>
                <strong style={{ color: "#3B82F6" }}>{assignedWOs}</strong>
              </div>
              <div style={{ width: "100%", height: 8, background: t.cardInner, borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${totalWOs ? (assignedWOs / totalWOs) * 100 : 0}%`,
                    height: "100%",
                    background: "#3B82F6",
                    borderRadius: 999,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            {/* In Progress */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                <span style={{ color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#06B6D4" }} />
                  In Progress (Active Maintenance)
                </span>
                <strong style={{ color: "#06B6D4" }}>{inProgressWOs}</strong>
              </div>
              <div style={{ width: "100%", height: 8, background: t.cardInner, borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${totalWOs ? (inProgressWOs / totalWOs) * 100 : 0}%`,
                    height: "100%",
                    background: "#06B6D4",
                    borderRadius: 999,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            {/* Completed */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                <span style={{ color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
                  Completed & Closed
                </span>
                <strong style={{ color: "#10B981" }}>{completedWOs}</strong>
              </div>
              <div style={{ width: "100%", height: 8, background: t.cardInner, borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${totalWOs ? (completedWOs / totalWOs) * 100 : 0}%`,
                    height: "100%",
                    background: "#10B981",
                    borderRadius: 999,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Technician Workforce & Workload */}
        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10B981",
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: t.textHeading }}>
                  Field Technician Workload
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  Technician dispatch status and work order capacity
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate && onNavigate("users")}
              style={{
                background: "transparent",
                border: "none",
                color: t.primary,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              All Staff <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {techWorkload.length === 0 ? (
              <div
                style={{
                  color: t.textMuted,
                  fontSize: 13,
                  textAlign: "center",
                  padding: "30px 0",
                  background: t.cardInner,
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                }}
              >
                No field technicians registered in this depot.
              </div>
            ) : (
              techWorkload.map((tech) => (
                <div
                  key={tech.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: t.cardInner,
                    border: `1px solid ${t.border}`,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.12)",
                        color: "#10B981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 13,
                        border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.25)"}`,
                      }}
                    >
                      {tech.name?.charAt(0) || "T"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: t.textHeading }}>
                        {tech.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: t.textMuted }}>
                        {tech.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: tech.activeCount > 0 ? (isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)") : (isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)"),
                        color: tech.activeCount > 0 ? "#F59E0B" : "#10B981",
                      }}
                    >
                      <strong>{tech.activeCount}</strong> Active
                    </span>

                    <span style={{ fontSize: 12, color: t.textMuted }}>
                      {tech.completedCount} closed
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ── 5. LIVE HVAC FLEET DIGITAL TWIN RADAR (Telemetry Preview) ── */}
      <Card hoverEffect={false}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: isDark ? "rgba(6, 182, 212, 0.2)" : "rgba(6, 182, 212, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#06B6D4",
              }}
            >
              <Radio size={18} />
            </div>
            <div>
              <div style={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: t.textHeading }}>
                Live Digital Twin Fleet Radar
              </div>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                Active sensor telemetry stream from train HVAC onboard units (3s poll interval)
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate("telemetry")}
            style={{
              background: "transparent",
              border: "none",
              color: t.primary,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Live Waveforms & History <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {safeAssets.slice(0, 5).map((asset) => {
            const isAlarm = asset.status === "ALARM" || asset.status === "CRITICAL" || (asset.health || 0) < 50;
            const isWarning = asset.status === "WARNING" || ((asset.health || 0) >= 50 && (asset.health || 0) < 80);

            const stateColor = isAlarm ? "#EF4444" : isWarning ? "#F59E0B" : "#10B981";

            return (
              <div
                key={asset.id}
                onClick={() => onNavigate && onNavigate("telemetry")}
                style={{
                  padding: "14px",
                  borderRadius: 12,
                  background: t.cardInner,
                  border: `1px solid ${t.border}`,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = t.borderHover;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = t.border;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: t.textHeading }}>
                    {asset.id}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: `${stateColor}22`,
                      color: stateColor,
                    }}
                  >
                    {asset.status || "—"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: t.textMuted }}>Health Score</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 800, color: stateColor }}>
                    {asset.health != null ? `${Math.round(asset.health)}%` : "—"}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, color: t.textMuted }}>
                  <div>
                    Temp: <strong style={{ color: t.text }}>{asset.temperature != null ? `${asset.temperature}°C` : "—"}</strong>
                  </div>
                  <div>
                    Press: <strong style={{ color: t.text }}>{asset.pressure != null ? `${asset.pressure} bar` : "—"}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── 6. EXECUTIVE ADMINISTRATIVE SHORTCUTS ── */}
      <Card hoverEffect={false}>
        <div style={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: t.textHeading, marginBottom: 14 }}>
          Administrative Quick Command Center
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Action 1 */}
          <button
            onClick={() => onNavigate && onNavigate("assets")}
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: t.cardInner,
              border: `1px solid ${t.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#06B6D4";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(6, 182, 212, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#06B6D4",
                }}
              >
                <Boxes size={18} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.textHeading }}>HVAC Asset Registry</div>
                <div style={{ fontSize: 11.5, color: t.textMuted }}>Manage units & specs</div>
              </div>
            </div>
            <ArrowRight size={15} color={t.textMuted} />
          </button>

          {/* Action 2 */}
          <button
            onClick={() => onNavigate && onNavigate("inventory")}
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: t.cardInner,
              border: `1px solid ${t.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#F59E0B";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(245, 158, 11, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#F59E0B",
                }}
              >
                <Layers size={18} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.textHeading }}>Spare Parts & Stock</div>
                <div style={{ fontSize: 11.5, color: t.textMuted }}>Stock alerts & reorders</div>
              </div>
            </div>
            <ArrowRight size={15} color={t.textMuted} />
          </button>

          {/* Action 3 */}
          <button
            onClick={() => onNavigate && onNavigate("users")}
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: t.cardInner,
              border: `1px solid ${t.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3B82F6";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(59, 130, 246, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3B82F6",
                }}
              >
                <Users size={18} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.textHeading }}>User Access & Teams</div>
                <div style={{ fontSize: 11.5, color: t.textMuted }}>Provision platform staff</div>
              </div>
            </div>
            <ArrowRight size={15} color={t.textMuted} />
          </button>

          {/* Action 4 */}
          <button
            onClick={() => onNavigate && onNavigate("settings")}
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: t.cardInner,
              border: `1px solid ${t.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#EC4899";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(236, 72, 153, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#EC4899",
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.textHeading }}>Role Permissions Matrix</div>
                <div style={{ fontSize: 11.5, color: t.textMuted }}>Granular RBAC access</div>
              </div>
            </div>
            <ArrowRight size={15} color={t.textMuted} />
          </button>
        </div>
      </Card>
    </div>
  );
}

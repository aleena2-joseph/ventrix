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
} from "lucide-react";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";
import { maintenanceService } from "../../../services/maintenanceService";
import { inventoryService } from "../../../services/inventoryService";
import { serviceRequestService } from "../../../services/serviceRequestService";
import { userService } from "../../../services/userService";
import { useAuth } from "../../../context/AuthContext";

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
  const [workOrders, setWorkOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [lowStockParts, setLowStockParts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true);
      try {
        const [woRes, srRes, invRes, usersRes] = await Promise.all([
          maintenanceService.listWorkOrders().catch(() => ({ success: false })),
          serviceRequestService.list().catch(() => ({ success: false })),
          inventoryService.listParts().catch(() => ({ success: false })),
          userService.list().catch(() => ({ success: false })),
        ]);

        if (woRes?.success && Array.isArray(woRes.data)) {
          setWorkOrders(woRes.data);
        }
        if (srRes?.success && Array.isArray(srRes.data)) {
          setServiceRequests(srRes.data);
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
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(6,182,212,0.15)", color: "#06B6D4", fontSize: 11, fontWeight: 800 }}>
              ADMINISTRATION & OPERATIONS
            </span>
            <span style={{ fontSize: 12, color: "#64748B" }}>Fleet-wide Intelligence Hub</span>
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>
            Executive Platform Overview
          </h1>
          <p style={{ color: "#94A3B8", fontSize: 13.5, margin: "4px 0 0 0" }}>
            Real-time status of HVAC units, operational work orders, depot inventory, and workforce allocation.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="outline" size="sm" onClick={() => onNavigate && onNavigate("users")}>
            <Users size={14} style={{ marginRight: 6 }} />
            Manage Users
          </Button>
          <Button variant="glow" size="sm" onClick={() => onNavigate && onNavigate("maintenance")}>
            <Wrench size={14} style={{ marginRight: 6 }} />
            Dispatch Work Order
          </Button>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockParts.length > 0 && (
        <div
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(245, 158, 11, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B" }}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#F59E0B" }}>
                Depot Inventory Low-Stock Alert
              </div>
              <div style={{ fontSize: 12.5, color: "#CBD5E1" }}>
                {lowStockParts.length} critical spare part catalogue item{lowStockParts.length > 1 ? "s are" : " is"} currently at or below minimum reorder threshold.
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate && onNavigate("inventory")} style={{ color: "#F59E0B", borderColor: "rgba(245,158,11,0.4)" }}>
            Review Stock & Reorder →
          </Button>
        </div>
      )}

      {/* 5 Core Top-Level KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {/* 1. Total Fleet Assets */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("assets")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>TOTAL HVAC UNITS</span>
            <Boxes size={18} color="#06B6D4" />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: "#fff" }}>
            {totalAssets || safeAssets.length || 0}
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 11.5, marginTop: 6, fontWeight: 600 }}>
            <span style={{ color: "#10B981" }}>{healthyAssets || safeAssets.length} Healthy</span>
            <span style={{ color: "#F59E0B" }}>· {warningAssets} Warning</span>
            <span style={{ color: "#EF4444" }}>· {criticalAssets} Critical</span>
          </div>
        </Card>

        {/* 2. Fleet Health Index */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("telemetry")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>FLEET HEALTH INDEX</span>
            <Activity size={18} color={avgHealth < 75 ? "#F59E0B" : "#10B981"} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: avgHealth < 75 ? "#F59E0B" : "#10B981" }}>
            {typeof avgHealth === "number" ? `${Math.round(avgHealth)}%` : "100%"}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>
            Overall Status: <strong style={{ color: "#10B981" }}>Operational</strong>
          </div>
        </Card>

        {/* 3. Active Anomaly Alerts */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("alerts")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>ACTIVE ALERTS</span>
            <Bell size={18} color={criticalAlerts > 0 ? "#EF4444" : "#10B981"} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: criticalAlerts > 0 ? "#EF4444" : "#F8FAFC" }}>
            {criticalAlerts}
          </div>
          <div style={{ fontSize: 12, color: criticalAlerts > 0 ? "#EF4444" : "#10B981", marginTop: 6, fontWeight: 500 }}>
            {criticalAlerts > 0 ? "Requires technician review" : "All signals nominal"}
          </div>
        </Card>

        {/* 4. Open Work Orders */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("maintenance")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>ACTIVE WORK ORDERS</span>
            <Wrench size={18} color="#3B82F6" />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: "#3B82F6" }}>
            {openWOs + inProgressWOs + assignedWOs}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>
            {completedWOs} completed · {inProgressWOs} in progress
          </div>
        </Card>

        {/* 5. Inventory Low Stock */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("inventory")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>LOW STOCK PARTS</span>
            <Package size={18} color={lowStockParts.length > 0 ? "#F59E0B" : "#10B981"} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: lowStockParts.length > 0 ? "#F59E0B" : "#10B981" }}>
            {lowStockParts.length}
          </div>
          <div style={{ fontSize: 12, color: lowStockParts.length > 0 ? "#F59E0B" : "#10B981", marginTop: 6 }}>
            {lowStockParts.length > 0 ? "Items need replenishment" : "Inventory optimal"}
          </div>
        </Card>
      </div>

      {/* Main Operations Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        {/* Left Column: Work Order Pipeline & Status Breakdown */}
        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B82F6" }}>
                <Wrench size={16} />
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                Work Order Operations Pipeline
              </div>
            </div>
            <button
              onClick={() => onNavigate && onNavigate("maintenance")}
              style={{ background: "transparent", border: "none", color: "#06B6D4", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              View Kanban →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Status Bars */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: "#94A3B8" }}>Open / Unassigned</span>
                <strong style={{ color: "#E2E8F0" }}>{openWOs}</strong>
              </div>
              <div style={{ width: "100%", height: 8, background: "#1E293B", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${totalWOs ? (openWOs / totalWOs) * 100 : 0}%`, height: "100%", background: "#94A3B8", borderRadius: 4 }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: "#94A3B8" }}>Assigned to Technician</span>
                <strong style={{ color: "#3B82F6" }}>{assignedWOs}</strong>
              </div>
              <div style={{ width: "100%", height: 8, background: "#1E293B", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${totalWOs ? (assignedWOs / totalWOs) * 100 : 0}%`, height: "100%", background: "#3B82F6", borderRadius: 4 }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: "#94A3B8" }}>In Progress (Under Maintenance)</span>
                <strong style={{ color: "#06B6D4" }}>{inProgressWOs}</strong>
              </div>
              <div style={{ width: "100%", height: 8, background: "#1E293B", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${totalWOs ? (inProgressWOs / totalWOs) * 100 : 0}%`, height: "100%", background: "#06B6D4", borderRadius: 4 }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: "#94A3B8" }}>Completed & Closed</span>
                <strong style={{ color: "#10B981" }}>{completedWOs}</strong>
              </div>
              <div style={{ width: "100%", height: 8, background: "#1E293B", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${totalWOs ? (completedWOs / totalWOs) * 100 : 0}%`, height: "100%", background: "#10B981", borderRadius: 4 }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Technician Workforce & Workload */}
        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981" }}>
                <Users size={16} />
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                Field Workforce Workload
              </div>
            </div>
            <button
              onClick={() => onNavigate && onNavigate("users")}
              style={{ background: "transparent", border: "none", color: "#06B6D4", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              All Staff →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {techWorkload.length === 0 && (
              <div style={{ color: "#64748B", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                No field technicians registered yet.
              </div>
            )}

            {techWorkload.map((tech) => (
              <div
                key={tech.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#060A14",
                  border: "1px solid #1E293B",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "rgba(16,185,129,0.15)",
                      color: "#10B981",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {tech.name?.charAt(0) || "T"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#F8FAFC" }}>{tech.name}</div>
                    <div style={{ fontSize: 11.5, color: "#64748B" }}>{tech.email}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: tech.activeCount > 0 ? "#F59E0B" : "#10B981" }}>
                    <strong>{tech.activeCount}</strong> Active
                  </span>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    <strong>{tech.completedCount}</strong> Closed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Administrative Shortcuts */}
      <Card hoverEffect={false}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 14 }}>
          Administrative Quick Actions
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <button
            onClick={() => onNavigate && onNavigate("assets")}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "#060A14",
              border: "1px solid #1E293B",
              color: "#E2E8F0",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Boxes size={16} color="#06B6D4" />
            <span>Register Asset</span>
          </button>

          <button
            onClick={() => onNavigate && onNavigate("inventory")}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "#060A14",
              border: "1px solid #1E293B",
              color: "#E2E8F0",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Layers size={16} color="#F59E0B" />
            <span>Manage Stock</span>
          </button>

          <button
            onClick={() => onNavigate && onNavigate("users")}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "#060A14",
              border: "1px solid #1E293B",
              color: "#E2E8F0",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Users size={16} color="#3B82F6" />
            <span>Provision User</span>
          </button>

          <button
            onClick={() => onNavigate && onNavigate("settings")}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "#060A14",
              border: "1px solid #1E293B",
              color: "#E2E8F0",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <ShieldCheck size={16} color="#EC4899" />
            <span>RBAC Matrix</span>
          </button>
        </div>
      </Card>
    </div>
  );
}

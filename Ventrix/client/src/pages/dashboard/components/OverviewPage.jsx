import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import Card from "../../../components/common/Card";
import { maintenanceService } from "../../../services/maintenanceService";
import { inventoryService } from "../../../services/inventoryService";
import { serviceRequestService } from "../../../services/serviceRequestService";
import { useAuth } from "../../../context/AuthContext";

export default function OverviewPage({
  activeCount = 0,
  totalAssets = 0,
  avgHealth = 100,
  avgRUL = "—",
  criticalAlerts = 0,
  telemetry = {},
  assets = [],
  alerts = [],
  onNavigate,
}) {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [lowStockParts, setLowStockParts] = useState([]);

  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  useEffect(() => {
    maintenanceService
      .listWorkOrders()
      .then((res) => {
        if (res?.success) setWorkOrders(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {});

    serviceRequestService
      .list()
      .then((res) => {
        if (res?.success) setServiceRequests(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {});

    const fetchInventory = inventoryService?.listParts || inventoryService?.list;
    if (typeof fetchInventory === "function") {
      fetchInventory()
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            const low = res.data.filter((i) => Number(i.quantity) <= Number(i.min_stock || 5));
            setLowStockParts(low);
          }
        })
        .catch(() => {});
    }
  }, []);

  const safeWorkOrders = Array.isArray(workOrders) ? workOrders : [];
  const safeServiceRequests = Array.isArray(serviceRequests) ? serviceRequests : [];

  const openWorkOrders = safeWorkOrders.filter((w) => w.status !== "COMPLETED" && w.status !== "CLOSED").length;
  const openServiceRequests = safeServiceRequests.filter((s) => s.status === "OPEN" || s.status === "IN_PROGRESS").length;
  const operationalUnits = safeAssets.filter((a) => a.status === "OPERATIONAL" || a.status === "Nominal").length;
  const maintenanceUnits = safeAssets.filter((a) => a.status === "MAINTENANCE" || a.status === "WARNING").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Low Stock Warning Banner (if any) */}
      {lowStockParts.length > 0 && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} color="#F59E0B" />
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              <strong>{lowStockParts.length} Spare Part{lowStockParts.length > 1 ? "s" : ""}</strong> are below minimum threshold in depot inventory.
            </span>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("inventory")}
              style={{
                background: "#F59E0B",
                border: "none",
                borderRadius: 6,
                padding: "5px 12px",
                color: "#000",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Manage Inventory →
            </button>
          )}
        </div>
      )}

      {/* 4 Core Operational KPI Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {/* Total HVAC Fleet */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("assets")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Total HVAC Units</span>
            <Boxes size={18} color="#06B6D4" />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700 }}>
            {totalAssets || safeAssets.length}
          </div>
          <div style={{ fontSize: 12, color: "#10B981", marginTop: 4 }}>
            {operationalUnits || activeCount} Operational · {maintenanceUnits} Service
          </div>
        </Card>

        {/* Active Fleet Alerts */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("alerts")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Active Anomaly Alerts</span>
            <Bell size={18} color={criticalAlerts > 0 ? "#EF4444" : "#10B981"} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: criticalAlerts > 0 ? "#EF4444" : "#F8FAFC" }}>
            {criticalAlerts}
          </div>
          <div style={{ fontSize: 12, color: criticalAlerts > 0 ? "#EF4444" : "#94A3B8", marginTop: 4 }}>
            {criticalAlerts > 0 ? "Requires technician review" : "All assets nominal"}
          </div>
        </Card>

        {/* Open Work Orders */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("maintenance")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Open Work Orders</span>
            <Wrench size={18} color="#F59E0B" />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: openWorkOrders > 0 ? "#F59E0B" : "#F8FAFC" }}>
            {openWorkOrders}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
            {safeWorkOrders.length} Total maintenance jobs logged
          </div>
        </Card>

        {/* Open Customer Service Requests */}
        <Card hoverEffect={true} onClick={() => onNavigate && onNavigate("service-requests")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Service Requests</span>
            <Package size={18} color="#3B82F6" />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: openServiceRequests > 0 ? "#3B82F6" : "#F8FAFC" }}>
            {openServiceRequests}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
            Customer tickets in queue
          </div>
        </Card>
      </div>

      {/* Real-time Telemetry Status & Live Feed */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* Live Operating Sensor Strip */}
        <Card hoverEffect={false} style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Real-Time Sensor Feed</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#10B981", fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} /> Live Ingestion
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Supply Temperature</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, marginTop: 3 }}>
                {telemetry?.temperature != null ? `${telemetry.temperature}°C` : "—"}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Refrigerant Pressure</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, marginTop: 3 }}>
                {telemetry?.pressure != null ? `${telemetry.pressure} bar` : "—"}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Compressor Current</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, marginTop: 3 }}>
                {telemetry?.current != null ? `${telemetry.current} A` : "—"}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Power Consumption</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, marginTop: 3 }}>
                {telemetry?.power != null ? `${telemetry.power} kW` : "—"}
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Operations Actions */}
        <Card hoverEffect={false} style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Core Fleet Workflows</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => onNavigate && onNavigate("assets")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Boxes size={16} color="#06B6D4" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>HVAC Asset Registry</div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Inspect assets, operating hours, and health status</div>
                </div>
              </div>
              <ArrowRight size={14} color="#94A3B8" />
            </button>

            <button
              onClick={() => onNavigate && onNavigate("maintenance")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Wrench size={16} color="#F59E0B" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Maintenance & Work Orders</div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Assign technicians and track part usage</div>
                </div>
              </div>
              <ArrowRight size={14} color="#94A3B8" />
            </button>

            <button
              onClick={() => onNavigate && onNavigate("inventory")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Package size={16} color="#10B981" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Depot Spare Parts & Stock</div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Inventory replenishment and PO receipts</div>
                </div>
              </div>
              <ArrowRight size={14} color="#94A3B8" />
            </button>
          </div>
        </Card>
      </div>

      {/* Fleet Asset Status Table */}
      <Card hoverEffect={false}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>HVAC Fleet Inventory Status</div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("assets")}
              style={{ background: "transparent", border: "none", color: "#06B6D4", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              View Full Registry →
            </button>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94A3B8", fontSize: 11.5, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={{ padding: "8px 6px" }}>Asset Code</th>
                <th style={{ padding: "8px 6px" }}>Model</th>
                <th style={{ padding: "8px 6px" }}>Train / Coach</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {safeAssets.slice(0, 6).map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "10px 6px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                    {a.id}
                  </td>
                  <td style={{ padding: "10px 6px", color: "#CBD5E1" }}>
                    {a.name || "HVAC Unit"}
                  </td>
                  <td style={{ padding: "10px 6px", color: "#94A3B8" }}>
                    {a.train_number ? `Train ${a.train_number}` : "Main Fleet"}
                  </td>
                  <td style={{ padding: "10px 6px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        color: a.status === "OPERATIONAL" || a.status === "Nominal" ? "#10B981" : a.status === "MAINTENANCE" ? "#F59E0B" : "#EF4444",
                        background: a.status === "OPERATIONAL" || a.status === "Nominal" ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                      }}
                    >
                      {a.status || "OPERATIONAL"}
                    </span>
                  </td>
                </tr>
              ))}
              {safeAssets.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "32px 0", textAlign: "center", color: "#94A3B8" }}>
                    No HVAC units registered yet. Add assets in the Assets module.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

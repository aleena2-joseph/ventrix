import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Search,
  Check,
  RotateCw,
  Wrench,
  X,
  Plus,
} from "lucide-react";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";
import { alertService } from "../../../services/alertService";
import { maintenanceService } from "../../../services/maintenanceService";
import { getAssets } from "../../../services/assetService";
import { useAuth } from "../../../context/AuthContext";

const ALERT_META = {
  critical: { icon: AlertCircle, color: "#EF4444", bg: "rgba(239, 68, 68, 0.12)", label: "Critical" },
  warning: { icon: AlertTriangle, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", label: "Warning" },
  info: { icon: Info, color: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)", label: "Info" },
};

export default function AlertsPage({ onNavigate }) {
  const { can, isVentrixRole } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [tab, setTab] = useState("active");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [resolvingId, setResolvingId] = useState(null);

  // Work order escalation modal
  const [escalatingAlert, setEscalatingAlert] = useState(null);
  const [woForm, setWoForm] = useState({ title: "", description: "", priority: "HIGH", asset_id: "" });
  const [creatingWO, setCreatingWO] = useState(false);

  const canManageAlerts = can("alerts.manage");
  const canManageMaintenance = can("maintenance.manage");

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      const resolvedParam = tab === "active" ? false : tab === "resolved" ? true : undefined;
      const [res, assetsRes] = await Promise.all([alertService.list(resolvedParam), getAssets()]);
      if (res.success) setAlerts(res.data || []);
      if (assetsRes.success) setAssets(assetsRes.data || []);
    } catch {
      setError("Could not reach backend services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [tab]);

  const handleResolve = async (alertId) => {
    setResolvingId(alertId);
    try {
      const res = await alertService.resolve(alertId);
      if (res.success) {
        notify("success", "Alert marked as resolved.");
        loadAlerts();
      } else {
        notify("error", res.message || "Failed to resolve alert.");
      }
    } catch {
      notify("error", "Error resolving alert.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleOpenEscalate = (alert) => {
    const matchedAsset = assets.find((a) => a.asset_code === alert.asset_code || a.id === alert.asset_id);
    setEscalatingAlert(alert);
    setWoForm({
      asset_id: matchedAsset?.id || alert.asset_id || "",
      title: `[Alert #${alert.id}] ${alert.title}`,
      description: `Auto-escalated from anomaly alert: ${alert.message || alert.title}. Logged on asset ${alert.asset_code}.`,
      priority: alert.level === "critical" ? "HIGH" : "MEDIUM",
    });
  };

  const handleCreateWorkOrderSubmit = async (e) => {
    e.preventDefault();
    if (!woForm.asset_id || !woForm.title) {
      notify("error", "Asset and Title are required");
      return;
    }
    setCreatingWO(true);
    try {
      const res = await maintenanceService.createWorkOrder({
        asset_id: Number(woForm.asset_id),
        title: woForm.title,
        description: woForm.description,
        priority: woForm.priority,
        alert_id: escalatingAlert?.id,
        status: "OPEN",
      });
      if (res.success) {
        notify("success", `Work Order #${res.data.id} created from alert.`);
        setEscalatingAlert(null);
        loadAlerts();
      } else {
        notify("error", res.message || "Failed to create work order.");
      }
    } catch {
      notify("error", "Failed to create work order.");
    } finally {
      setCreatingWO(false);
    }
  };

  const filtered = alerts.filter((a) => {
    if (levelFilter !== "ALL" && a.level !== levelFilter.toLowerCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = (a.title || "").toLowerCase().includes(q);
      const matchAsset = (a.asset_code || "").toLowerCase().includes(q);
      const matchMsg = (a.message || "").toLowerCase().includes(q);
      if (!matchTitle && !matchAsset && !matchMsg) return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            padding: "12px 20px",
            borderRadius: 10,
            background: toast.type === "success" ? "#064E3B" : "#7F1D1D",
            border: `1px solid ${toast.type === "success" ? "#10B981" : "#EF4444"}`,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            fontSize: 13.5,
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} color="#34D399" /> : <AlertCircle size={18} color="#F87171" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Fleet Anomaly & Alert Center
          </h2>
          <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>
            Active threshold triggers, sensor faults, and maintenance escalations
          </div>
        </div>

        <Button variant="outline" size="sm" icon={RotateCw} onClick={loadAlerts} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#EF4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filter Tabs Strip */}
      <Card hoverEffect={false} style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
          {/* Status Tabs */}
          <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.25)", padding: 3, borderRadius: 8 }}>
            {[
              { id: "active", label: "Active Anomalies" },
              { id: "resolved", label: "Resolved History" },
              { id: "all", label: "All Alerts" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: tab === t.id ? "rgba(255,255,255,0.12)" : "transparent",
                  color: tab === t.id ? "#06B6D4" : "#94A3B8",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "6px 12px",
                width: 220,
              }}
            >
              <Search size={14} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", color: "inherit", fontSize: 12.5, width: "100%" }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.2)",
                color: "inherit",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12.5,
                outline: "none",
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Alerts List */}
      <Card hoverEffect={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((a) => {
            const meta = ALERT_META[a.level] || ALERT_META.info;
            const Icon = meta.icon;
            const isResolved = a.is_resolved;

            return (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: isResolved ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.25)",
                  border: `1px solid ${isResolved ? "rgba(255,255,255,0.04)" : meta.bg ? `${meta.color}33` : "rgba(255,255,255,0.08)"}`,
                  opacity: isResolved ? 0.75 : 1,
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 260 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: meta.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: meta.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{a.title}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: meta.bg,
                          color: meta.color,
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 3 }}>
                      {a.message || "Anomalous reading registered by real-time physics rules."}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "#94A3B8", marginTop: 4 }}>
                      <span>Asset: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.asset_code || "Unit"}</strong></span>
                      <span>·</span>
                      <span>Source: <strong>{a.source || "telemetry"}</strong></span>
                      <span>·</span>
                      <span>Logged: {new Date(a.created_at).toLocaleString()}</span>
                      {isResolved && (
                        <>
                          <span>·</span>
                          <span style={{ color: "#10B981" }}>Resolved</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!isResolved && canManageMaintenance && (
                    <button
                      onClick={() => handleOpenEscalate(a)}
                      style={{
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: 6,
                        padding: "6px 11px",
                        color: "#F59E0B",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Wrench size={13} /> Create Work Order
                    </button>
                  )}

                  {!isResolved && canManageAlerts && (
                    <button
                      onClick={() => handleResolve(a.id)}
                      disabled={resolvingId === a.id}
                      style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: 6,
                        padding: "6px 11px",
                        color: "#10B981",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Check size={14} /> {resolvingId === a.id ? "..." : "Resolve"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
              <CheckCircle2 size={32} color="#10B981" style={{ margin: "0 auto 10px auto", opacity: 0.8 }} />
              <div>No alerts matching the selected filter criteria.</div>
            </div>
          )}
        </div>
      </Card>

      {/* 1-Click Escalate to Work Order Modal */}
      {escalatingAlert && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: "#131C31",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Wrench size={18} color="#F59E0B" /> Escalate Alert to Work Order
              </div>
              <button
                onClick={() => setEscalatingAlert(null)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkOrderSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 5 }}>Target Asset</label>
                <select
                  value={woForm.asset_id}
                  onChange={(e) => setWoForm({ ...woForm, asset_id: e.target.value })}
                  style={{
                    width: "100%",
                    background: "#0B1120",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    color: "inherit",
                    fontSize: 13,
                  }}
                  required
                >
                  <option value="">Select Asset</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_code} — {a.name || "HVAC Unit"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 5 }}>Work Order Title</label>
                <input
                  type="text"
                  value={woForm.title}
                  onChange={(e) => setWoForm({ ...woForm, title: e.target.value })}
                  style={{
                    width: "100%",
                    background: "#0B1120",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    color: "inherit",
                    fontSize: 13,
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 5 }}>Priority</label>
                <select
                  value={woForm.priority}
                  onChange={(e) => setWoForm({ ...woForm, priority: e.target.value })}
                  style={{
                    width: "100%",
                    background: "#0B1120",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    color: "inherit",
                    fontSize: 13,
                  }}
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 5 }}>Description / Troubleshooting Notes</label>
                <textarea
                  rows={3}
                  value={woForm.description}
                  onChange={(e) => setWoForm({ ...woForm, description: e.target.value })}
                  style={{
                    width: "100%",
                    background: "#0B1120",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    color: "inherit",
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEscalatingAlert(null)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "7px 14px",
                    color: "#94A3B8",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWO}
                  style={{
                    background: "#F59E0B",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 16px",
                    color: "#000",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {creatingWO ? "Creating..." : "Create Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

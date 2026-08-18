import React, { useState, useEffect, useMemo } from "react";
import {
  Wrench,
  Boxes,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Users,
  Package,
  Layers,
  ArrowRight,
  UserCheck,
  RotateCw,
  X,
} from "lucide-react";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";
import { maintenanceService } from "../../../services/maintenanceService";
import { alertService } from "../../../services/alertService";
import { userService } from "../../../services/userService";
import { inventoryService } from "../../../services/inventoryService";

export default function EngineerOverview({
  activeCount = 0,
  totalAssets = 0,
  avgHealth = 100,
  criticalAlerts = 0,
  assets = [],
  alerts = [],
  onNavigate,
}) {
  const [workOrders, setWorkOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [inventoryParts, setInventoryParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Quick Assign / Create Work Order Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    asset_id: "",
    title: "",
    description: "",
    priority: "MEDIUM",
    assigned_to: "",
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function loadSupervisorData() {
    setLoading(true);
    try {
      const [woRes, uRes, invRes] = await Promise.all([
        maintenanceService.listWorkOrders().catch(() => ({ success: false })),
        userService.getTechnicians().catch(() => ({ success: false })),
        inventoryService.listParts().catch(() => ({ success: false })),
      ]);

      if (woRes?.success && Array.isArray(woRes.data)) {
        setWorkOrders(woRes.data);
      }
      if (uRes?.success && Array.isArray(uRes.data)) {
        setTechnicians(uRes.data);
      }
      if (invRes?.success && Array.isArray(invRes.data)) {
        setInventoryParts(invRes.data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSupervisorData();
  }, []);

  // Work order status counts
  const pendingJobs = workOrders.filter((w) => w.status === "OPEN" || w.status === "ASSIGNED");
  const inProgressJobs = workOrders.filter((w) => w.status === "IN_PROGRESS");
  const completedJobs = workOrders.filter((w) => w.status === "COMPLETED" || w.status === "CLOSED");

  // Assets needing attention
  const attentionUnits = safeAssets.filter(
    (a) => (a.health != null && a.health < 75) || a.status === "WARNING" || a.status === "ALARM"
  );

  // Handle creating & assigning work order
  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    if (!createForm.asset_id || !createForm.title) {
      setFormError("Please select an HVAC unit and enter a task title.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const res = await maintenanceService.createWorkOrder({
        asset_id: Number(createForm.asset_id),
        title: createForm.title.trim(),
        description: createForm.description?.trim(),
        priority: createForm.priority,
        assigned_to: createForm.assigned_to ? Number(createForm.assigned_to) : undefined,
      });

      if (!res.success) {
        setFormError(res.message || "Failed to assign work order.");
        return;
      }

      notify("success", "Work order created and assigned to technician successfully.");
      setShowCreateModal(false);
      setCreateForm({ asset_id: "", title: "", description: "", priority: "MEDIUM", assigned_to: "" });
      loadSupervisorData();
    } catch {
      setFormError("Error creating work order.");
    } finally {
      setSaving(false);
    }
  };

  // Quick dispatch from alert
  const openDispatchForAlert = (alert) => {
    const asset = safeAssets.find((a) => a.id === alert.asset_code || a.name === alert.asset);
    setCreateForm({
      asset_id: asset?.id ? String(asset.id) : (safeAssets[0]?.id ? String(safeAssets[0].id) : "1"),
      title: `Fix Issue: ${alert.title || "HVAC Fault"}`,
      description: alert.message || `Sensor alert reported on ${alert.asset || "HVAC unit"}`,
      priority: alert.level === "critical" ? "CRITICAL" : "HIGH",
      assigned_to: technicians[0]?.id ? String(technicians[0].id) : "",
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 110,
            background: toast.type === "success" ? "#064E3B" : "#7F1D1D",
            border: `1px solid ${toast.type === "success" ? "#10B981" : "#EF4444"}`,
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(59,130,246,0.15)", color: "#3B82F6", fontSize: 11, fontWeight: 800 }}>
              MAINTENANCE SUPERVISOR
            </span>
            <span style={{ fontSize: 12, color: "#64748B" }}>Work Assignment & Progress Hub</span>
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>
            Engineer Control & Dispatch
          </h1>
          <p style={{ color: "#94A3B8", fontSize: 13.5, margin: "4px 0 0 0" }}>
            Assign maintenance jobs to technicians, track work progress in real time, and allocate spare parts.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="outline" size="sm" onClick={loadSupervisorData} disabled={loading}>
            <RotateCw size={14} className={loading ? "spin" : ""} style={{ marginRight: 6 }} />
            Refresh
          </Button>
          <Button
            variant="glow"
            size="sm"
            onClick={() => {
              setFormError(null);
              setCreateForm({
                asset_id: safeAssets[0]?.id ? String(safeAssets[0].id) : "1",
                title: "",
                description: "",
                priority: "MEDIUM",
                assigned_to: technicians[0]?.id ? String(technicians[0].id) : "",
              });
              setShowCreateModal(true);
            }}
          >
            <Plus size={15} style={{ marginRight: 6 }} />
            Assign New Work Order
          </Button>
        </div>
      </div>

      {/* 4 Clear Operational KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>
            Pending Assignment
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: "#F59E0B", marginTop: 4 }}>
            {pendingJobs.length}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Tasks ready to be worked on</div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>
            Work In Progress
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: "#06B6D4", marginTop: 4 }}>
            {inProgressJobs.length}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Technicians currently in bay</div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>
            Completed Jobs
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: "#10B981", marginTop: 4 }}>
            {completedJobs.length}
          </div>
          <div style={{ fontSize: 12, color: "#10B981", marginTop: 4 }}>Successfully repaired & verified</div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>
            Units Needing Attention
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: attentionUnits.length > 0 ? "#EF4444" : "#10B981", marginTop: 4 }}>
            {attentionUnits.length}
          </div>
          <div style={{ fontSize: 12, color: attentionUnits.length > 0 ? "#EF4444" : "#10B981", marginTop: 4 }}>
            {attentionUnits.length > 0 ? "Issues detected" : "All units healthy"}
          </div>
        </Card>
      </div>

      {/* Main Supervisor Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        {/* Left: Active Work Orders Progress Tracker */}
        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B82F6" }}>
                <Wrench size={16} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                  Technician Work Progress
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>Live maintenance task tracking</div>
              </div>
            </div>

            <button
              onClick={() => onNavigate && onNavigate("maintenance")}
              style={{ background: "transparent", border: "none", color: "#06B6D4", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              Manage Work Orders →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workOrders.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 12px", color: "#64748B", fontSize: 13 }}>
                No active work orders. Click "+ Assign New Work Order" to create one.
              </div>
            )}

            {workOrders.slice(0, 6).map((wo) => {
              const assignedTech = technicians.find((t) => t.id === wo.assigned_to);
              const isDone = wo.status === "COMPLETED" || wo.status === "CLOSED";

              return (
                <div
                  key={wo.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "#060A14",
                    border: "1px solid #1E293B",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: "#F8FAFC" }}>
                        #{wo.id} — {wo.title}
                      </span>
                      <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "rgba(6,182,212,0.1)", color: "#06B6D4", fontFamily: "'JetBrains Mono', monospace" }}>
                        {wo.asset_code || `Asset #${wo.asset_id || 1}`}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                      <UserCheck size={13} color="#3B82F6" />
                      <span>Assigned to: <strong style={{ color: "#E2E8F0" }}>{assignedTech?.name || "Unassigned"}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: wo.status === "IN_PROGRESS" ? "#06B6D4" : isDone ? "#10B981" : "#F59E0B",
                        background: wo.status === "IN_PROGRESS" ? "rgba(6,182,212,0.15)" : isDone ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      }}
                    >
                      {wo.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: Active Faults Needing Assignment & Spare Parts Available */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Active Faults Ready to Assign */}
          <Card hoverEffect={false}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444" }}>
                  <Bell size={16} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                    Active Faults & Alerts
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>Incoming issues requiring work orders</div>
                </div>
              </div>

              <button
                onClick={() => onNavigate && onNavigate("alerts")}
                style={{ background: "transparent", border: "none", color: "#06B6D4", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                All Alerts →
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {safeAlerts.filter((a) => !a.is_resolved).length === 0 && (
                <div style={{ color: "#64748B", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                  <CheckCircle2 size={24} color="#10B981" style={{ margin: "0 auto 6px" }} />
                  <div>No open faults detected. All systems nominal.</div>
                </div>
              )}

              {safeAlerts.filter((a) => !a.is_resolved).slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#060A14",
                    border: "1px solid #1E293B",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: alert.level === "critical" ? "#EF4444" : "#F59E0B" }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>
                      Unit: {alert.asset || alert.asset_code || "HVAC Unit"}
                    </div>
                  </div>

                  <button
                    onClick={() => openDispatchForAlert(alert)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: "#3B82F6",
                      color: "#fff",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Wrench size={12} />
                    Assign
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Spare Parts Stock Overview */}
          <Card hoverEffect={false}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B" }}>
                  <Package size={16} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                    Available Spare Parts in Depot
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>Parts ready for job allocation</div>
                </div>
              </div>

              <button
                onClick={() => onNavigate && onNavigate("inventory")}
                style={{ background: "transparent", border: "none", color: "#06B6D4", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                View Stock →
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
              {inventoryParts.slice(0, 4).map((p) => {
                const onHand = p.total_quantity || 0;
                const isLow = onHand <= (p.minimum_stock || 5);

                return (
                  <div
                    key={p.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "#060A14",
                      border: "1px solid #1E293B",
                    }}
                  >
                    <div style={{ fontSize: 11.5, color: "#CBD5E1", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isLow ? "#EF4444" : "#10B981", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                      {onHand} {p.unit || "pcs"}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* ================= MODAL: CREATE & ASSIGN WORK ORDER ================= */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3,7,18,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1px solid #1E293B",
              borderRadius: 16,
              padding: 24,
              width: 480,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>
                Create & Assign Work Order
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#EF444419", border: "1px solid #EF444455", color: "#EF4444", fontSize: 12.5, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateWorkOrder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Target HVAC Unit *
                <select
                  required
                  value={createForm.asset_id}
                  onChange={(e) => setCreateForm((p) => ({ ...p, asset_id: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                >
                  <option value="">Select Unit...</option>
                  {safeAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.id} (Code: {a.id})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Task Title *
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect compressor & replace air filters"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                  Priority
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm((p) => ({ ...p, priority: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                  >
                    <option value="CRITICAL">Critical (Immediate)</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low / Routine</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                  Assign to Technician
                  <select
                    value={createForm.assigned_to}
                    onChange={(e) => setCreateForm((p) => ({ ...p, assigned_to: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                  >
                    <option value="">Unassigned (Queue)</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Technician)
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Maintenance Instructions & Details
                <textarea
                  rows={3}
                  placeholder="Provide instructions for the technician (e.g. check refrigerant pressure, clean condenser coil, record parts used)..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button type="submit" variant="glow" size="sm" disabled={saving}>
                  {saving ? "Assigning..." : "Assign Work Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

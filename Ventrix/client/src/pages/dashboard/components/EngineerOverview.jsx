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
  FileCheck,
  ShieldCheck,
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
  const [pendingPartRequests, setPendingPartRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [approvingReqId, setApprovingReqId] = useState(null);

  // Verification modal / state
  const [verifyingOrder, setVerifyingOrder] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Quick Assign / Create Work Order Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    asset_id: "",
    title: "",
    description: "",
    priority: "MEDIUM",
    maintenance_type: "CORRECTIVE",
    estimated_duration: "2",
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
      const [woRes, uRes, invRes, reqRes] = await Promise.all([
        maintenanceService.listWorkOrders().catch(() => ({ success: false })),
        userService.getTechnicians().catch(() => ({ success: false })),
        inventoryService.listParts().catch(() => ({ success: false })),
        inventoryService.listRequests({ status: "PENDING" }).catch(() => ({ success: false })),
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
      if (reqRes?.success && Array.isArray(reqRes.data)) {
        setPendingPartRequests(reqRes.data);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleQuickApproveRequest = async (req) => {
    setApprovingReqId(req.id);
    try {
      const res = await inventoryService.approveRequest(req.id);
      if (res?.success) {
        notify("success", `Approved technical requisition for ${req.quantity}x ${req.part_name}. Ready for warehouse issuance.`);
        loadSupervisorData();
      } else {
        notify("error", res?.message || "Failed to approve request.");
      }
    } catch (err) {
      notify("error", err?.response?.data?.message || "Error approving request.");
    } finally {
      setApprovingReqId(null);
    }
  };

  useEffect(() => {
    loadSupervisorData();
  }, []);

  // Work order status counts
  const pendingJobs = workOrders.filter((w) => w.status === "OPEN" || w.status === "ASSIGNED" || w.status === "ACCEPTED");
  const inProgressJobs = workOrders.filter((w) => w.status === "IN_PROGRESS" || w.status === "WAITING_FOR_PARTS" || w.status === "PARTS_ISSUED");
  const verificationQueue = workOrders.filter(
    (w) => w.status === "UNDER_VERIFICATION" || (w.status === "COMPLETED" && !w.verified_by)
  );
  const closedJobs = workOrders.filter((w) => w.status === "CLOSED");

  // Assets needing attention
  const attentionUnits = safeAssets.filter(
    (a) => (a.health != null && a.health < 75) || a.status === "WARNING" || a.status === "ALARM"
  );

  // Technician active workload map
  const techActiveCount = useMemo(() => {
    const map = {};
    workOrders.forEach((wo) => {
      if (wo.assigned_to && !["CLOSED", "COMPLETED"].includes(wo.status)) {
        map[wo.assigned_to] = (map[wo.assigned_to] || 0) + 1;
      }
    });
    return map;
  }, [workOrders]);

  // Handle engineer verification and closure
  const handleVerifyAndClose = async (woId) => {
    setVerifying(true);
    try {
      const res = await maintenanceService.verifyAndCloseWorkOrder(woId, {
        notes: verificationNotes || "Verified compliant with railway HVAC maintenance safety standards.",
      });
      if (res?.success) {
        notify("success", `Work order #${woId} verified & closed successfully.`);
        setVerifyingOrder(null);
        setVerificationNotes("");
        loadSupervisorData();
      } else {
        notify("error", res?.message || "Failed to verify work order.");
      }
    } catch (err) {
      notify("error", err?.response?.data?.message || "Verification error.");
    } finally {
      setVerifying(false);
    }
  };

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
        maintenance_type: createForm.maintenance_type || "CORRECTIVE",
        estimated_duration: createForm.estimated_duration ? Number(createForm.estimated_duration) : undefined,
        assigned_to: createForm.assigned_to ? Number(createForm.assigned_to) : undefined,
      });

      if (!res.success) {
        setFormError(res.message || "Failed to assign work order.");
        return;
      }

      notify("success", "Work order created and assigned to technician successfully.");
      setShowCreateModal(false);
      setCreateForm({
        asset_id: "",
        title: "",
        description: "",
        priority: "MEDIUM",
        maintenance_type: "CORRECTIVE",
        estimated_duration: "2",
        assigned_to: "",
      });
      loadSupervisorData();
    } catch {
      setFormError("Error creating work order.");
    } finally {
      setSaving(false);
    }
  };

  // Quick dispatch from alert
  const openDispatchForAlert = (alert) => {
    const asset = safeAssets.find((a) => a.id === alert.asset_code || a.name === alert.asset || a.asset_code === alert.asset_code);
    setCreateForm({
      asset_id: asset?.id ? String(asset.id) : (safeAssets[0]?.id ? String(safeAssets[0].id) : "1"),
      title: `Fix Fault: ${alert.title || "HVAC Issue"}`,
      description: alert.message || `Sensor alert reported on ${alert.asset_code || "HVAC unit"}`,
      priority: alert.level === "critical" ? "CRITICAL" : "HIGH",
      maintenance_type: alert.level === "critical" ? "EMERGENCY" : "CORRECTIVE",
      estimated_duration: "2",
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
            Pending Acceptance
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: "#F59E0B", marginTop: 4 }}>
            {pendingJobs.length}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Dispatched or awaiting tech acceptance</div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>
            Work In Progress
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: "#06B6D4", marginTop: 4 }}>
            {inProgressJobs.length}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Active in bay / parts issued</div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>
            Awaiting Sign-Off
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: verificationQueue.length > 0 ? "#A855F7" : "#10B981", marginTop: 4 }}>
            {verificationQueue.length}
          </div>
          <div style={{ fontSize: 12, color: verificationQueue.length > 0 ? "#A855F7" : "#64748B", marginTop: 4 }}>
            {verificationQueue.length > 0 ? "Completed jobs requiring review" : "All completed jobs verified"}
          </div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>
            Units Needing Attention
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: attentionUnits.length > 0 ? "#EF4444" : "#10B981", marginTop: 4 }}>
            {attentionUnits.length}
          </div>
          <div style={{ fontSize: 12, color: attentionUnits.length > 0 ? "#EF4444" : "#10B981", marginTop: 4 }}>
            {attentionUnits.length > 0 ? "Faults or alarms detected" : "All units healthy"}
          </div>
        </Card>
      </div>

      {/* ── ENGINEERING VERIFICATION & SIGN-OFF QUEUE ── */}
      {verificationQueue.length > 0 && (
        <div
          style={{
            padding: "18px 20px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%)",
            border: "1.5px solid rgba(168, 85, 247, 0.4)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(168, 85, 247, 0.2)", color: "#C084FC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#F8FAFC" }}>
                  {verificationQueue.length} Completed Job{verificationQueue.length > 1 ? "s" : ""} Awaiting Engineering Sign-Off
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>
                  Technicians have submitted physical completion reports. Review findings and measurements to officially verify and close tickets.
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate && onNavigate("maintenance")}
              style={{
                background: "transparent",
                border: "none",
                color: "#C084FC",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Full Maintenance Board →
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {verificationQueue.map((wo) => {
              const assignedTech = technicians.find((t) => t.id === wo.assigned_to);
              return (
                <div
                  key={wo.id}
                  style={{
                    background: "#080E1E",
                    border: "1px solid rgba(168, 85, 247, 0.25)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>
                        #{wo.id} — {wo.title}
                      </div>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(168,85,247,0.2)", color: "#C084FC", fontFamily: "'JetBrains Mono', monospace" }}>
                        {wo.asset_code || `Asset #${wo.asset_id}`}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                      Executed by: <strong style={{ color: "#E2E8F0" }}>{assignedTech?.name || "Technician"}</strong>
                    </div>

                    {wo.completion_report && (
                      <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#CBD5E1" }}>
                        <span style={{ color: "#94A3B8", fontSize: 11, display: "block", marginBottom: 2 }}>Completion Report:</span>
                        {(() => {
                          const repText = typeof wo.completion_report === "string"
                            ? wo.completion_report
                            : (wo.completion_report.summary || wo.completion_report.action_taken || wo.completion_report.technician_notes || "Completion report submitted");
                          return repText.length > 100 ? `${repText.slice(0, 100)}...` : repText;
                        })()}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => {
                        setVerifyingOrder(wo);
                        setVerificationNotes("");
                      }}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "#8B5CF6",
                        color: "#fff",
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <FileCheck size={14} />
                      Inspect & Sign Off
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PENDING SPARE PART REQUISITION SPOTLIGHT */}
      {pendingPartRequests.length > 0 && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)",
            border: "1.5px solid rgba(245, 158, 11, 0.35)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(245,158,11,0.2)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC" }}>
                  {pendingPartRequests.length} Spare Part Requisition{pendingPartRequests.length > 1 ? "s" : ""} Awaiting Your Approval
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>
                  Technicians have requested components from depot warehouse. Stock is deducted only upon approval.
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate && onNavigate("inventory")}
              style={{
                background: "transparent",
                border: "none",
                color: "#F59E0B",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Open Requisitions Queue →
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
            {pendingPartRequests.slice(0, 3).map((req) => (
              <div
                key={req.id}
                style={{
                  background: "#080E1E",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>
                    {req.quantity}x {req.part_name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>
                    Requested by <strong>{req.requester_name || "Technician"}</strong> {req.work_order_id ? `for Job #${req.work_order_id}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "#06B6D4", marginTop: 2 }}>
                    Depot Stock: <strong>{req.available_stock || 0} {req.unit_of_measure || "pcs"}</strong>
                  </div>
                </div>

                <button
                  disabled={approvingReqId === req.id}
                  onClick={() => handleQuickApproveRequest(req)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#10B981",
                    color: "#000",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {approvingReqId === req.id ? "Deducting..." : "Approve & Issue"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  Maintenance Type *
                  <select
                    value={createForm.maintenance_type}
                    onChange={(e) => setCreateForm((p) => ({ ...p, maintenance_type: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                  >
                    <option value="CORRECTIVE">Corrective (Repair Fault)</option>
                    <option value="PREVENTIVE">Preventive (Routine Scheduled)</option>
                    <option value="EMERGENCY">Emergency (Line Disruption)</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                  Estimated Duration (Hours)
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={createForm.estimated_duration}
                    onChange={(e) => setCreateForm((p) => ({ ...p, estimated_duration: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                  />
                </label>
              </div>

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
                    {technicians.map((t) => {
                      const activeJobs = techActiveCount[t.id] || 0;
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} ({activeJobs === 0 ? "Available" : `${activeJobs} active job${activeJobs > 1 ? "s" : ""}`})
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              {createForm.assigned_to && (techActiveCount[createForm.assigned_to] || 0) >= 2 && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#F59E0B", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={15} />
                  <span>Workload warning: This technician already has {techActiveCount[createForm.assigned_to]} ongoing jobs.</span>
                </div>
              )}

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

      {/* ================= MODAL: VERIFY & CLOSE WORK ORDER ================= */}
      {verifyingOrder && (
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
          onClick={() => setVerifyingOrder(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1.5px solid rgba(168, 85, 247, 0.4)",
              borderRadius: 16,
              padding: 24,
              width: 520,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(168, 85, 247, 0.2)", color: "#C084FC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 17, color: "#fff" }}>
                    Engineering Verification & Sign-Off
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    Work Order #{verifyingOrder.id} — {verifyingOrder.asset_code || `Asset #${verifyingOrder.asset_id}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setVerifyingOrder(null)}
                style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: 12, borderRadius: 10, background: "#060A14", border: "1px solid #1E293B" }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "#fff" }}>
                  {verifyingOrder.title}
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                  Assigned Tech: <strong>{technicians.find((t) => t.id === verifyingOrder.assigned_to)?.name || "Field Technician"}</strong>
                </div>
              </div>

              {verifyingOrder.completion_report ? (
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#10B981", textTransform: "uppercase", marginBottom: 4 }}>
                    Technician Physical Completion Report
                  </div>
                  <div style={{ fontSize: 13, color: "#E2E8F0", whiteSpace: "pre-wrap" }}>
                    {typeof verifyingOrder.completion_report === "string"
                      ? verifyingOrder.completion_report
                      : (verifyingOrder.completion_report?.summary || verifyingOrder.completion_report?.action_taken || verifyingOrder.completion_report?.technician_notes || "Work completed and verified by technician.")}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 10, borderRadius: 8, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: 12, color: "#F59E0B" }}>
                  Technician marked task completed without an extended written report.
                </div>
              )}

              {(() => {
                const fList = Array.isArray(verifyingOrder.findings) && verifyingOrder.findings.length > 0
                  ? verifyingOrder.findings
                  : (Array.isArray(verifyingOrder.completion_report?.findings) ? verifyingOrder.completion_report.findings : []);
                if (fList.length === 0) return null;
                return (
                  <div style={{ padding: 10, borderRadius: 8, background: "#060A14", border: "1px solid #1E293B" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#06B6D4", textTransform: "uppercase", marginBottom: 6 }}>
                      Recorded Sensor Readings & Field Findings
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {fList.map((f, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#CBD5E1" }}>
                          • {typeof f === "string" ? f : `${f.parameter || f.metric || "Item"}: ${f.value || f.finding || ""}`}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Supervisory Verification Notes & Quality Sign-Off *
                <textarea
                  rows={3}
                  placeholder="Confirm HVAC post-repair test run results, vibration readings, and quality compliance..."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setVerifyingOrder(null)}>Cancel</Button>
                <button
                  onClick={() => handleVerifyAndClose(verifyingOrder.id)}
                  disabled={verifying}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#8B5CF6",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ShieldCheck size={16} />
                  {verifying ? "Signing off..." : "Verify & Officially Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

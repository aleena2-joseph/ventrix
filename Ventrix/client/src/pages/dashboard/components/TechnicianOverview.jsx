import React, { useState, useEffect, useMemo } from "react";
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  Check,
  Plus,
  Package,
  X,
  AlertCircle,
  FileText,
  RotateCw,
  Layers,
  CheckSquare,
} from "lucide-react";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";
import { maintenanceService } from "../../../services/maintenanceService";
import { inventoryService } from "../../../services/inventoryService";
import { getAssets } from "../../../services/assetService";
import { useAuth } from "../../../context/AuthContext";

export default function TechnicianOverview({ onNavigate }) {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [parts, setParts] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [woPartsMap, setWoPartsMap] = useState({});
  const [availableAssets, setAvailableAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modals state
  const [selectedWOForPart, setSelectedWOForPart] = useState(null);
  const [partRequestForm, setPartRequestForm] = useState({
    part_id: "",
    quantity: 1,
    urgency: "MEDIUM",
    reason: "",
  });
  const [showReportFaultModal, setShowReportFaultModal] = useState(false);
  const [faultForm, setFaultForm] = useState({ asset_id: "", title: "", description: "", priority: "HIGH" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function loadTechData() {
    setLoading(true);
    try {
      const [woRes, pRes, reqRes, aRes] = await Promise.all([
        maintenanceService.listWorkOrders().catch(() => ({ success: false })),
        inventoryService.listParts().catch(() => ({ success: false })),
        inventoryService.listRequests({ my_requests: true }).catch(() => ({ success: false })),
        getAssets().catch(() => ({ success: false })),
      ]);

      if (aRes?.success && Array.isArray(aRes.data)) {
        setAvailableAssets(aRes.data);
      }

      if (woRes?.success && Array.isArray(woRes.data)) {
        setWorkOrders(woRes.data);
        // Load parts used for these work orders
        const partsPromises = woRes.data.map((w) =>
          maintenanceService
            .getWorkOrderParts(w.id)
            .then((r) => ({ id: w.id, parts: r.success ? r.data : [] }))
            .catch(() => ({ id: w.id, parts: [] }))
        );
        const resolved = await Promise.all(partsPromises);
        const map = {};
        resolved.forEach((item) => {
          map[item.id] = item.parts;
        });
        setWoPartsMap(map);
      }
      if (pRes?.success && Array.isArray(pRes.data)) {
        setParts(pRes.data);
      }
      if (reqRes?.success && Array.isArray(reqRes.data)) {
        setPartRequests(reqRes.data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTechData();
  }, []);

  // Filter jobs for the current logged-in technician
  const myWorkOrders = useMemo(() => {
    if (!user?.id) return workOrders;
    return workOrders.filter((w) => w.assigned_to === user.id || !w.assigned_to);
  }, [workOrders, user]);

  // Metrics
  const assignedCount = myWorkOrders.length;
  const pendingCount = myWorkOrders.filter((w) => w.status === "OPEN" || w.status === "ASSIGNED").length;
  const inProgressCount = myWorkOrders.filter((w) => w.status === "IN_PROGRESS").length;
  const completedCount = myWorkOrders.filter((w) => w.status === "COMPLETED" || w.status === "CLOSED").length;

  // Urgent Job Spotlight (Highest priority active job)
  const urgentJob = useMemo(() => {
    const active = myWorkOrders.filter((w) => w.status !== "COMPLETED" && w.status !== "CLOSED");
    const critical = active.find((w) => w.priority === "CRITICAL");
    if (critical) return critical;
    const high = active.find((w) => w.priority === "HIGH");
    if (high) return high;
    return active[0] || null;
  }, [myWorkOrders]);

  // Status Change Handler
  const handleStatusChange = async (woId, nextStatus) => {
    if (nextStatus === "COMPLETED") {
      // Check if there are pending part requests for this work order
      const pendingReqs = partRequests.filter(
        (r) => r.work_order_id === woId && r.status === "PENDING"
      );
      if (pendingReqs.length > 0) {
        notify(
          "error",
          `Cannot complete job: ${pendingReqs.length} spare part request(s) are awaiting Admin/Engineer approval.`
        );
        return;
      }
    }

    try {
      const res = await maintenanceService.updateWorkOrderStatus(woId, nextStatus);
      if (res?.success) {
        notify("success", `Work order status updated to ${nextStatus}.`);
        loadTechData();
      } else {
        notify("error", res?.message || "Failed to update status.");
      }
    } catch {
      notify("error", "Error updating work order status.");
    }
  };

  // Submit Spare Part Requisition (Awaiting Admin/Engineer Approval)
  const handleCreatePartRequest = async (e) => {
    e.preventDefault();
    if (!partRequestForm.part_id || !partRequestForm.quantity) {
      setFormError("Please select a spare part and specify a quantity.");
      return;
    }

    const selectedPart = parts.find((p) => String(p.id) === String(partRequestForm.part_id));
    const requestedQty = Number(partRequestForm.quantity);

    if (requestedQty <= 0) {
      setFormError("Quantity must be at least 1.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const res = await inventoryService.createRequest({
        part_id: Number(partRequestForm.part_id),
        quantity: requestedQty,
        work_order_id: selectedWOForPart ? selectedWOForPart.id : null,
        urgency: partRequestForm.urgency || "MEDIUM",
        reason: partRequestForm.reason || "Field replacement requirement",
      });

      if (res?.success) {
        notify(
          "success",
          `Spare part request for ${requestedQty}x ${selectedPart?.name || "item"} submitted for Admin/Engineer approval. Stock will be issued once approved.`
        );
        setSelectedWOForPart(null);
        setPartRequestForm({ part_id: "", quantity: 1, urgency: "MEDIUM", reason: "" });
        await loadTechData();
      } else {
        setFormError(res?.message || "Failed to submit spare part request.");
      }
    } catch {
      setFormError("Error connecting to server to submit request.");
    } finally {
      setSaving(false);
    }
  };

  // Submit Emergency Work Order from Bay
  const handleReportFault = async (e) => {
    e.preventDefault();
    if (!faultForm.asset_id) {
      setFormError("Please select a target HVAC unit.");
      return;
    }
    if (!faultForm.title.trim()) {
      setFormError("Fault title is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await maintenanceService.createWorkOrder({
        asset_id: Number(faultForm.asset_id),
        title: faultForm.title.trim(),
        description: faultForm.description ? faultForm.description.trim() : "",
        priority: faultForm.priority,
        assigned_to: user?.id,
      });
      if (res?.success) {
        notify("success", "Emergency work order created and added to your job queue.");
        setShowReportFaultModal(false);
        setFaultForm({ asset_id: "", title: "", description: "", priority: "HIGH" });
        loadTechData();
      } else {
        setFormError(res?.message || "Failed to create work order.");
      }
    } catch {
      setFormError("Error creating work order.");
    } finally {
      setSaving(false);
    }
  };

  const selectedPartObject = parts.find((p) => String(p.id) === String(partRequestForm.part_id));

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
            padding: "12px 20px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            maxWidth: 450,
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {/* Greeting Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(16,185,129,0.15)", color: "#10B981", fontSize: 11, fontWeight: 800 }}>
              FIELD TECHNICIAN WORKSPACE
            </span>
            <span style={{ fontSize: 12, color: "#64748B" }}>Depot Bay Maintenance</span>
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>
            Hello, {user?.name || "Technician"} 🛠️
          </h1>
          <p style={{ color: "#94A3B8", fontSize: 13.5, margin: "4px 0 0 0" }}>
            Execute assigned maintenance tasks, log consumed spare parts (automatically deducted from inventory), and report issues.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="outline" size="sm" onClick={loadTechData} disabled={loading}>
            <RotateCw size={14} className={loading ? "spin" : ""} style={{ marginRight: 6 }} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFormError(null);
              setSelectedWOForPart({ id: null, title: "General Depot Maintenance" });
              setPartRequestForm({ part_id: parts[0]?.id ? String(parts[0].id) : "", quantity: 1, urgency: "MEDIUM", reason: "" });
            }}
          >
            <Package size={14} style={{ marginRight: 6 }} />
            Request Spare Part
          </Button>
          <Button
            variant="glow"
            size="sm"
            onClick={() => {
              setFormError(null);
              setShowReportFaultModal(true);
            }}
          >
            <Plus size={14} style={{ marginRight: 6 }} />
            Report Fault in Field
          </Button>
        </div>
      </div>

      {/* 4 Prominent "MY WORK" Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>
            Total Assigned Jobs
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 800, color: "#fff", marginTop: 4 }}>
            {assignedCount}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>On active duty schedule</div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 700, textTransform: "uppercase" }}>
            Pending Action
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 800, color: "#F59E0B", marginTop: 4 }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Awaiting start or parts</div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#06B6D4", fontWeight: 700, textTransform: "uppercase" }}>
            Work In Progress
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 800, color: "#06B6D4", marginTop: 4 }}>
            {inProgressCount}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Currently being executed</div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ fontSize: 12, color: "#10B981", fontWeight: 700, textTransform: "uppercase" }}>
            Completed Today
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 800, color: "#10B981", marginTop: 4 }}>
            {completedCount}
          </div>
          <div style={{ fontSize: 12, color: "#10B981", marginTop: 4 }}>Signed off & tested</div>
        </Card>
      </div>

      {/* URGENT / CRITICAL JOB SPOTLIGHT CALLOUT */}
      {urgentJob && (
        <div
          style={{
            padding: "20px 24px",
            borderRadius: 14,
            background: urgentJob.priority === "CRITICAL"
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)"
              : "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)",
            border: `1.5px solid ${urgentJob.priority === "CRITICAL" ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.35)"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: urgentJob.priority === "CRITICAL" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                color: urgentJob.priority === "CRITICAL" ? "#EF4444" : "#F59E0B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 800,
                    color: urgentJob.priority === "CRITICAL" ? "#EF4444" : "#F59E0B",
                    background: urgentJob.priority === "CRITICAL" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                  }}
                >
                  URGENT JOB · {urgentJob.priority}
                </span>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>Target Unit: <strong>{urgentJob.asset_code || `Asset #${urgentJob.asset_id || 1}`}</strong></span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: "#F8FAFC" }}>
                {urgentJob.title}
              </h3>
              <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
                {urgentJob.description || "Perform maintenance and replace any worn spare parts."}
              </p>

              {/* Display Used Parts for Urgent Job if any */}
              {woPartsMap[urgentJob.id]?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, color: "#CBD5E1", fontWeight: 600 }}>Parts Used:</span>
                  {woPartsMap[urgentJob.id].map((p, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "rgba(245,158,11,0.15)",
                        color: "#F59E0B",
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      {p.quantity}x {p.part_name || p.part_code || "Part"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {urgentJob.status !== "IN_PROGRESS" ? (
              <button
                onClick={() => handleStatusChange(urgentJob.id, "IN_PROGRESS")}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#06B6D4",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Play size={14} fill="#000" />
                Start Work
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange(urgentJob.id, "COMPLETED")}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#10B981",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Check size={14} />
                Complete Job
              </button>
            )}

            <button
              onClick={() => {
                setFormError(null);
                setSelectedWOForPart(urgentJob);
                setPartUsageForm({ part_id: parts[0]?.id ? String(parts[0].id) : "", quantity: 1, notes: "" });
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #1E293B",
                background: "#0B1220",
                color: "#F59E0B",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Package size={15} color="#F59E0B" />
              + Use Spare Part
            </button>
          </div>
        </div>
      )}

      {/* TODAY'S ASSIGNED JOBS LIST */}
      <Card hoverEffect={false}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(6, 182, 212, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#06B6D4" }}>
              <Wrench size={16} />
            </div>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                My Assigned Work Orders
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>Actionable task queue for this shift</div>
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate("maintenance")}
            style={{ background: "transparent", border: "none", color: "#06B6D4", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            All Work Orders →
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myWorkOrders.length === 0 && (
            <div style={{ textAlign: "center", padding: "36px 12px", color: "#64748B" }}>
              <CheckCircle2 size={32} color="#10B981" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#F8FAFC" }}>All caught up!</div>
              <div style={{ fontSize: 12.5, marginTop: 2 }}>No pending work orders assigned to you right now.</div>
            </div>
          )}

          {myWorkOrders.map((wo) => {
            const isCritical = wo.priority === "CRITICAL";
            const isHigh = wo.priority === "HIGH";
            const isDone = wo.status === "COMPLETED" || wo.status === "CLOSED";
            const usedParts = woPartsMap[wo.id] || [];

            return (
              <div
                key={wo.id}
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: isDone ? "#040812" : "#080E1C",
                  border: `1px solid ${isDone ? "#1E293B44" : "#1E293B"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 14,
                  opacity: isDone ? 0.75 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: "1 1 300px" }}>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      color: isCritical ? "#EF4444" : isHigh ? "#F59E0B" : "#10B981",
                      background: isCritical ? "rgba(239,68,68,0.15)" : isHigh ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                      marginTop: 2,
                    }}
                  >
                    {wo.priority || "NORMAL"}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#F8FAFC" }}>
                        #{wo.id} — {wo.title}
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontFamily: "'JetBrains Mono', monospace",
                          color: "#06B6D4",
                          background: "rgba(6,182,212,0.1)",
                        }}
                      >
                        {wo.asset_code || `Asset #${wo.asset_id || 1}`}
                      </span>
                    </div>

                    {wo.description && (
                      <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>
                        {wo.description}
                      </div>
                    )}

                    {/* Spare Parts / Requisitions Status Badge List */}
                    {(() => {
                      const woReqs = partRequests.filter((r) => r.work_order_id === wo.id);
                      if (usedParts.length === 0 && woReqs.length === 0) return null;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>Spare Parts & Requisitions:</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {woReqs.filter((r) => r.status === "PENDING").map((r) => (
                              <span
                                key={`req-p-${r.id}`}
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "rgba(245, 158, 11, 0.15)",
                                  border: "1px solid rgba(245, 158, 11, 0.35)",
                                  color: "#F59E0B",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                🟡 {r.quantity}x {r.part_name} · <em>Awaiting Admin Approval</em>
                              </span>
                            ))}
                            {woReqs.filter((r) => r.status === "APPROVED").map((r) => (
                              <span
                                key={`req-a-${r.id}`}
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "rgba(16, 185, 129, 0.15)",
                                  border: "1px solid rgba(16, 185, 129, 0.35)",
                                  color: "#10B981",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                🟢 {r.quantity}x {r.part_name} · <strong>Approved & Issued</strong>
                              </span>
                            ))}
                            {woReqs.filter((r) => r.status === "REJECTED").map((r) => (
                              <span
                                key={`req-r-${r.id}`}
                                title={`Reason: ${r.rejection_reason || "Rejected by supervisor"}`}
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "rgba(239, 68, 68, 0.15)",
                                  border: "1px solid rgba(239, 68, 68, 0.35)",
                                  color: "#EF4444",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                🔴 {r.quantity}x {r.part_name} · <em>Rejected</em>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {/* Status indicator */}
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: wo.status === "IN_PROGRESS" ? "#06B6D4" : isDone ? "#10B981" : "#F59E0B",
                      background: wo.status === "IN_PROGRESS" ? "rgba(6,182,212,0.15)" : isDone ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                    }}
                  >
                    {wo.status}
                  </span>

                  {!isDone && (
                    <>
                      {wo.status !== "IN_PROGRESS" ? (
                        <button
                          onClick={() => handleStatusChange(wo.id, "IN_PROGRESS")}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: "#06B6D4",
                            color: "#000",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Start Work
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(wo.id, "COMPLETED")}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: "#10B981",
                            color: "#000",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Mark Done
                        </button>
                      )}

                      <button
                        title="Submit spare part requisition for supervisor approval"
                        onClick={() => {
                          setFormError(null);
                          setSelectedWOForPart(wo);
                          setPartRequestForm({
                            part_id: parts[0]?.id ? String(parts[0].id) : "",
                            quantity: 1,
                            urgency: wo.priority === "CRITICAL" ? "CRITICAL" : "MEDIUM",
                            reason: `Required for Work Order #${wo.id} - ${wo.title}`,
                          });
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid #1E293B",
                          background: "#0B1220",
                          color: "#F59E0B",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Package size={14} />
                        + Request Part
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ================= SECTION: MY SPARE PART REQUISITIONS ================= */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(245,158,11,0.15)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, margin: 0, color: "#fff" }}>
                My Spare Part Requisitions
              </h2>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>
                Requisitions awaiting or approved by Admin/Engineer
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFormError(null);
              setSelectedWOForPart({ id: null, title: "General Depot Maintenance" });
              setPartRequestForm({ part_id: parts[0]?.id ? String(parts[0].id) : "", quantity: 1, urgency: "MEDIUM", reason: "" });
            }}
          >
            <Plus size={14} style={{ marginRight: 6 }} />
            New Requisition
          </Button>
        </div>

        {partRequests.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#64748B", fontSize: 13 }}>
            No spare part requisitions submitted yet. Click "+ Request Spare Part" to request components.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94A3B8", borderBottom: "1px solid #1E293B", fontSize: 12 }}>
                  <th style={{ padding: "10px 8px" }}>Part Name</th>
                  <th style={{ padding: "10px 8px" }}>Quantity</th>
                  <th style={{ padding: "10px 8px" }}>Work Order</th>
                  <th style={{ padding: "10px 8px" }}>Urgency</th>
                  <th style={{ padding: "10px 8px" }}>Status</th>
                  <th style={{ padding: "10px 8px" }}>Reviewer Notes</th>
                </tr>
              </thead>
              <tbody>
                {partRequests.map((req) => (
                  <tr key={req.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ fontWeight: 600, color: "#fff" }}>{req.part_name}</div>
                      <div style={{ fontSize: 11, color: "#06B6D4", fontFamily: "'JetBrains Mono', monospace" }}>{req.part_code}</div>
                    </td>
                    <td style={{ padding: "12px 8px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                      {req.quantity} {req.unit_of_measure || "pcs"}
                    </td>
                    <td style={{ padding: "12px 8px", color: "#94A3B8" }}>
                      {req.work_order_id ? `#${req.work_order_id} - ${req.work_order_title || "Job"}` : "General Depot"}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          color: req.urgency === "CRITICAL" ? "#EF4444" : req.urgency === "HIGH" ? "#F59E0B" : "#10B981",
                          background: req.urgency === "CRITICAL" ? "rgba(239,68,68,0.15)" : req.urgency === "HIGH" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                        }}
                      >
                        {req.urgency}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: req.status === "APPROVED" ? "#10B981" : req.status === "REJECTED" ? "#EF4444" : "#F59E0B",
                          background: req.status === "APPROVED" ? "rgba(16,185,129,0.15)" : req.status === "REJECTED" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                        }}
                      >
                        {req.status === "APPROVED" ? "🟢 Approved & Issued" : req.status === "REJECTED" ? "🔴 Rejected" : "🟡 Pending Approval"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", fontSize: 12, color: "#94A3B8" }}>
                      {req.rejection_reason || (req.status === "APPROVED" ? `Approved by ${req.reviewer_name || "Admin"}` : "Under review")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ================= MODAL: REQUEST SPARE PART (AWAITING APPROVAL) ================= */}
      {selectedWOForPart && (
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
          onClick={() => setSelectedWOForPart(null)}
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
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>
                  Request Spare Part Requisition
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                  {selectedWOForPart.id ? `For Work Order #${selectedWOForPart.id} — ${selectedWOForPart.title}` : "General Depot Maintenance Requisition"}
                </div>
              </div>
              <button
                onClick={() => setSelectedWOForPart(null)}
                style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.25)", color: "#06B6D4", fontSize: 12, marginBottom: 14 }}>
              ℹ️ Requisitions are sent directly to the Admin/Engineer queue. Stock will be automatically deducted and issued to your job once approved.
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#EF444419", border: "1px solid #EF444455", color: "#EF4444", fontSize: 12.5, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePartRequest} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Select Spare Part from Catalog *
                <select
                  required
                  value={partRequestForm.part_id}
                  onChange={(e) => setPartRequestForm((p) => ({ ...p, part_id: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                >
                  <option value="">Select a spare part...</option>
                  {parts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name} ({part.part_code || "SKU"}) — Current Warehouse Stock: {part.total_quantity || 0} {part.unit || "pcs"}
                    </option>
                  ))}
                </select>
              </label>

              {/* Selected Part Stock Callout */}
              {selectedPartObject && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#040914",
                    border: "1px solid #1E293B",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>{selectedPartObject.name}</div>
                    <div style={{ fontSize: 11.5, color: "#06B6D4", fontFamily: "'JetBrains Mono', monospace" }}>{selectedPartObject.part_code}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Available Stock</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: (selectedPartObject.total_quantity || 0) > 0 ? "#10B981" : "#EF4444", fontFamily: "'JetBrains Mono', monospace" }}>
                      {selectedPartObject.total_quantity || 0} {selectedPartObject.unit || "pcs"}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                  Quantity Needed *
                  <input
                    type="number"
                    min="1"
                    required
                    value={partRequestForm.quantity}
                    onChange={(e) => setPartRequestForm((p) => ({ ...p, quantity: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                  Urgency / Priority *
                  <select
                    value={partRequestForm.urgency}
                    onChange={(e) => setPartRequestForm((p) => ({ ...p, urgency: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                  >
                    <option value="LOW">Low (Routine Replenishment)</option>
                    <option value="MEDIUM">Medium (Planned Maintenance)</option>
                    <option value="HIGH">High (Active Fault in Bay)</option>
                    <option value="CRITICAL">Critical (Train Departure Blocker)</option>
                  </select>
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Reason & Justification *
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Compressor winding failure detected on HVAC-005. Requires replacement before coach testing."
                  value={partRequestForm.reason}
                  onChange={(e) => setPartRequestForm((p) => ({ ...p, reason: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedWOForPart(null)}>Cancel</Button>
                <Button type="submit" variant="glow" size="sm" disabled={saving}>
                  {saving ? "Submitting Requisition..." : "Submit Requisition"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REPORT FAULT ================= */}
      {showReportFaultModal && (
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
          onClick={() => setShowReportFaultModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1px solid #1E293B",
              borderRadius: 16,
              padding: 24,
              width: 460,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>
                Log Emergency Work Order from Bay
              </div>
              <button
                onClick={() => setShowReportFaultModal(false)}
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

            <form onSubmit={handleReportFault} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Target HVAC Unit *
                <select
                  required
                  value={faultForm.asset_id}
                  onChange={(e) => setFaultForm((p) => ({ ...p, asset_id: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                >
                  <option value="">Select target HVAC unit...</option>
                  {availableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_code} — {a.name || "HVAC Unit"}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Work Order / Fault Title *
                <input
                  type="text"
                  required
                  placeholder="e.g. Compressor noise / dirty filters in Coach B"
                  value={faultForm.title}
                  onChange={(e) => setFaultForm((p) => ({ ...p, title: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Priority Level
                <select
                  value={faultForm.priority}
                  onChange={(e) => setFaultForm((p) => ({ ...p, priority: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                >
                  <option value="CRITICAL">Critical (Immediate Repair)</option>
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium / Normal</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Description & Observations
                <textarea
                  rows={3}
                  placeholder="Describe sensor behavior, visible leaks, or strange vibrations..."
                  value={faultForm.description}
                  onChange={(e) => setFaultForm((p) => ({ ...p, description: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowReportFaultModal(false)}>Cancel</Button>
                <Button type="submit" variant="glow" size="sm" disabled={saving}>
                  {saving ? "Creating Work Order..." : "Create Work Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

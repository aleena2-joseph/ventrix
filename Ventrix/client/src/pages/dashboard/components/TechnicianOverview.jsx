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
  
  // Completion Report Modal state
  const [selectedWOForCompletion, setSelectedWOForCompletion] = useState(null);
  const [completionForm, setCompletionForm] = useState({
    report: "",
    tempDrop: "",
    vibration: "",
    pressure: "",
    generalFinding: "",
  });
  const [submittingReport, setSubmittingReport] = useState(false);

  // Field Finding Modal state
  const [selectedWOForFinding, setSelectedWOForFinding] = useState(null);
  const [findingForm, setFindingForm] = useState({ parameter: "Temperature", value: "", finding: "" });
  const [submittingFinding, setSubmittingFinding] = useState(false);

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
  const pendingCount = myWorkOrders.filter((w) => w.status === "OPEN" || w.status === "ASSIGNED" || w.status === "ACCEPTED").length;
  const inProgressCount = myWorkOrders.filter((w) => w.status === "IN_PROGRESS" || w.status === "WAITING_FOR_PARTS" || w.status === "PARTS_ISSUED").length;
  const underVerificationCount = myWorkOrders.filter((w) => w.status === "UNDER_VERIFICATION" || (w.status === "COMPLETED" && !w.verified_by)).length;
  const completedCount = myWorkOrders.filter((w) => w.status === "CLOSED").length;

  // Urgent Job Spotlight (Highest priority active job)
  const urgentJob = useMemo(() => {
    const active = myWorkOrders.filter((w) => w.status !== "CLOSED");
    const critical = active.find((w) => w.priority === "CRITICAL" && w.status !== "UNDER_VERIFICATION");
    if (critical) return critical;
    const high = active.find((w) => w.priority === "HIGH" && w.status !== "UNDER_VERIFICATION");
    if (high) return high;
    return active[0] || null;
  }, [myWorkOrders]);

  // Accept assigned job
  const handleAcceptJob = async (woId) => {
    try {
      const res = await maintenanceService.acceptWorkOrder(woId);
      if (res?.success) {
        notify("success", `Job #${woId} accepted. You can now start physical work.`);
        loadTechData();
      } else {
        notify("error", res?.message || "Failed to accept job.");
      }
    } catch {
      notify("error", "Error accepting job.");
    }
  };

  // Start physical work
  const handleStartWork = async (woId) => {
    try {
      const res = await maintenanceService.updateWorkOrderStatus(woId, "IN_PROGRESS");
      if (res?.success) {
        notify("success", `Work started on job #${woId}. Track actions and record readings.`);
        loadTechData();
      } else {
        notify("error", res?.message || "Failed to start work.");
      }
    } catch {
      notify("error", "Error starting work.");
    }
  };

  // Submit physical completion report
  const handleSubmitCompletionReport = async (e) => {
    e.preventDefault();
    if (!completionForm.report.trim()) {
      setFormError("Please enter a summary of physical work performed.");
      return;
    }

    setSubmittingReport(true);
    setFormError(null);
    try {
      const findings = [];
      if (completionForm.tempDrop) findings.push({ parameter: "Delta Temperature", value: `${completionForm.tempDrop} °C`, finding: "Temperature drop post-service" });
      if (completionForm.vibration) findings.push({ parameter: "Vibration Amplitude", value: `${completionForm.vibration} mm/s`, finding: "Post-maintenance vibration check" });
      if (completionForm.pressure) findings.push({ parameter: "Refrigerant Pressure", value: `${completionForm.pressure} PSI`, finding: "Operational head pressure" });
      if (completionForm.generalFinding) findings.push({ parameter: "Field Note", value: completionForm.generalFinding, finding: "Technician remark" });

      const res = await maintenanceService.submitCompletionReport(selectedWOForCompletion.id, {
        completion_report: completionForm.report.trim(),
        findings,
      });

      if (res?.success) {
        notify("success", `Completion report submitted for Job #${selectedWOForCompletion.id}. Handed off to Engineer for verification.`);
        setSelectedWOForCompletion(null);
        setCompletionForm({ report: "", tempDrop: "", vibration: "", pressure: "", generalFinding: "" });
        loadTechData();
      } else {
        setFormError(res?.message || "Failed to submit completion report.");
      }
    } catch {
      setFormError("Error submitting completion report.");
    } finally {
      setSubmittingReport(false);
    }
  };

  // Submit sensor finding
  const handleSubmitFinding = async (e) => {
    e.preventDefault();
    if (!findingForm.value.trim() && !findingForm.finding.trim()) {
      setFormError("Please enter a measured value or note.");
      return;
    }

    setSubmittingFinding(true);
    setFormError(null);
    try {
      const res = await maintenanceService.addFindingToWorkOrder(selectedWOForFinding.id, findingForm);
      if (res?.success) {
        notify("success", `Finding recorded for Job #${selectedWOForFinding.id}.`);
        setSelectedWOForFinding(null);
        setFindingForm({ parameter: "Temperature", value: "", finding: "" });
        loadTechData();
      } else {
        setFormError(res?.message || "Failed to record finding.");
      }
    } catch {
      setFormError("Error recording finding.");
    } finally {
      setSubmittingFinding(false);
    }
  };

  // Status Change Handler (fallback)
  const handleStatusChange = async (woId, nextStatus) => {
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

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {(urgentJob.status === "OPEN" || urgentJob.status === "ASSIGNED") && (
              <button
                onClick={() => handleAcceptJob(urgentJob.id)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#F59E0B",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle2 size={15} />
                Accept Job
              </button>
            )}

            {urgentJob.status === "ACCEPTED" && (
              <button
                onClick={() => handleStartWork(urgentJob.id)}
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
            )}

            {(urgentJob.status === "IN_PROGRESS" || urgentJob.status === "PARTS_ISSUED") && (
              <>
                <button
                  onClick={() => {
                    setSelectedWOForCompletion(urgentJob);
                    setFormError(null);
                  }}
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
                  <FileText size={15} />
                  Submit Completion Report
                </button>

                <button
                  onClick={() => {
                    setSelectedWOForFinding(urgentJob);
                    setFormError(null);
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #1E293B",
                    background: "#0B1220",
                    color: "#06B6D4",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={14} />
                  Record Reading
                </button>
              </>
            )}

            {urgentJob.status === "WAITING_FOR_PARTS" && (
              <span style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(245,158,11,0.15)", color: "#F59E0B", fontSize: 12.5, fontWeight: 700 }}>
                Waiting for Depot Parts
              </span>
            )}

            {urgentJob.status === "UNDER_VERIFICATION" && (
              <span style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(168,85,247,0.15)", color: "#C084FC", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={14} />
                Awaiting Engineer Sign-Off
              </span>
            )}

            <button
              onClick={() => {
                setFormError(null);
                setSelectedWOForPart(urgentJob);
                setPartRequestForm({
                  part_id: parts[0]?.id ? String(parts[0].id) : "",
                  quantity: 1,
                  urgency: urgentJob.priority === "CRITICAL" ? "CRITICAL" : "MEDIUM",
                  reason: `Required for Work Order #${urgentJob.id} - ${urgentJob.title}`,
                });
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
              Request Spare Part
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

                  {wo.status !== "CLOSED" && (
                    <>
                      {(wo.status === "OPEN" || wo.status === "ASSIGNED") && (
                        <button
                          onClick={() => handleAcceptJob(wo.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: "#F59E0B",
                            color: "#000",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Accept
                        </button>
                      )}

                      {wo.status === "ACCEPTED" && (
                        <button
                          onClick={() => handleStartWork(wo.id)}
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
                      )}

                      {(wo.status === "IN_PROGRESS" || wo.status === "PARTS_ISSUED") && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedWOForCompletion(wo);
                              setFormError(null);
                            }}
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
                            Submit Report
                          </button>
                          <button
                            onClick={() => {
                              setSelectedWOForFinding(wo);
                              setFormError(null);
                            }}
                            title="Record sensor reading or diagnostic measurement"
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #1E293B",
                              background: "#060A14",
                              color: "#06B6D4",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            + Reading
                          </button>
                        </>
                      )}

                      {wo.status === "UNDER_VERIFICATION" && (
                        <span style={{ fontSize: 11.5, color: "#C084FC", fontWeight: 600 }}>
                          Under Verification
                        </span>
                      )}

                      {wo.status !== "UNDER_VERIFICATION" && (
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
                      )}
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

      {/* ================= MODAL: SUBMIT COMPLETION REPORT ================= */}
      {selectedWOForCompletion && (
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
          onClick={() => setSelectedWOForCompletion(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1.5px solid rgba(16, 185, 129, 0.4)",
              borderRadius: 16,
              padding: 24,
              width: 520,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(16, 185, 129, 0.2)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FileText size={18} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 17, color: "#fff" }}>
                    Submit Completion Report & Handoff
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    Job #{selectedWOForCompletion.id} — {selectedWOForCompletion.asset_code || `Asset #${selectedWOForCompletion.asset_id}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedWOForCompletion(null)}
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

            <form onSubmit={handleSubmitCompletionReport} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Physical Work Summary & Actions Taken *
                <textarea
                  rows={3}
                  required
                  placeholder="Detail actions taken (e.g., Cleaned condenser coils, replaced compressor motor contactor, inspected fan belt, executed 20-min test cycle)..."
                  value={completionForm.report}
                  onChange={(e) => setCompletionForm((p) => ({ ...p, report: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}
                />
              </label>

              <div style={{ fontSize: 12, fontWeight: 700, color: "#06B6D4", marginTop: 4 }}>
                Post-Service Sensor Measurements & Verification Checks:
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, color: "#94A3B8" }}>
                  Delta Temp (°C)
                  <input
                    type="text"
                    placeholder="e.g. 7.5"
                    value={completionForm.tempDrop}
                    onChange={(e) => setCompletionForm((p) => ({ ...p, tempDrop: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, color: "#94A3B8" }}>
                  Vibration (mm/s)
                  <input
                    type="text"
                    placeholder="e.g. 1.8"
                    value={completionForm.vibration}
                    onChange={(e) => setCompletionForm((p) => ({ ...p, vibration: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, color: "#94A3B8" }}>
                  Pressure (PSI)
                  <input
                    type="text"
                    placeholder="e.g. 65"
                    value={completionForm.pressure}
                    onChange={(e) => setCompletionForm((p) => ({ ...p, pressure: e.target.value }))}
                    style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                  />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Additional Notes for Maintenance Engineer
                <input
                  type="text"
                  placeholder="e.g. Unit running smoothly, recommend checking filter in 14 days"
                  value={completionForm.generalFinding}
                  onChange={(e) => setCompletionForm((p) => ({ ...p, generalFinding: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedWOForCompletion(null)}>Cancel</Button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  style={{
                    padding: "8px 18px",
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
                  <CheckSquare size={16} />
                  {submittingReport ? "Submitting..." : "Submit to Engineer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECORD FIELD FINDING ================= */}
      {selectedWOForFinding && (
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
          onClick={() => setSelectedWOForFinding(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1.5px solid #06B6D455",
              borderRadius: 16,
              padding: 24,
              width: 440,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(6, 182, 212, 0.2)", color: "#06B6D4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={18} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 17, color: "#fff" }}>
                    Record Sensor Reading / Finding
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    Job #{selectedWOForFinding.id} — {selectedWOForFinding.title}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedWOForFinding(null)}
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

            <form onSubmit={handleSubmitFinding} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Diagnostic Parameter
                <select
                  value={findingForm.parameter}
                  onChange={(e) => setFindingForm((p) => ({ ...p, parameter: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                >
                  <option value="Temperature">Temperature / Differential</option>
                  <option value="Vibration">Vibration Amplitude</option>
                  <option value="Current Draw">Motor Current / Electrical Draw</option>
                  <option value="Refrigerant Pressure">Refrigerant Pressure</option>
                  <option value="Air Flow">Air Flow / Duct Velocity</option>
                  <option value="Physical Inspection">Physical Inspection Finding</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Measured Value
                <input
                  type="text"
                  required
                  placeholder="e.g. 19.5 °C or 2.1 mm/s or 14.2 A"
                  value={findingForm.value}
                  onChange={(e) => setFindingForm((p) => ({ ...p, value: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Field Observation Notes
                <textarea
                  rows={2}
                  placeholder="e.g. Reading stabilized after 10 min runtime..."
                  value={findingForm.finding}
                  onChange={(e) => setFindingForm((p) => ({ ...p, finding: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedWOForFinding(null)}>Cancel</Button>
                <Button type="submit" variant="glow" size="sm" disabled={submittingFinding}>
                  {submittingFinding ? "Saving..." : "Save Finding"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

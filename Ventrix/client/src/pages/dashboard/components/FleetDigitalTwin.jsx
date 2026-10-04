import React, { useState, useEffect, useMemo } from "react";
import {
  Train,
  Boxes,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Sparkles,
  RefreshCw,
  Gauge,
  Thermometer,
  Zap,
  Wind,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sliders,
  ChevronRight,
  Radio,
  CheckSquare,
  Square,
  Package,
  FileText,
  AlertCircle,
} from "lucide-react";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";
import { fleetService } from "../../../services/fleetService";
import { maintenanceService } from "../../../services/maintenanceService";
import { inventoryService } from "../../../services/inventoryService";
import { useTheme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";

export default function FleetDigitalTwin({ onNavigate }) {
  const { isDark, tokens: t } = useTheme();
  const { user, role } = useAuth();
  const currentRole = (role || user?.role_name || user?.role || "ADMIN").toUpperCase();

  const [trains, setTrains] = useState([]);
  const [selectedTrainId, setSelectedTrainId] = useState(null);
  const [selectedCoachId, setSelectedCoachId] = useState(null);
  const [coachTwin, setCoachTwin] = useState(null);
  const [selectedUnitCode, setSelectedUnitCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Engineer: Schedule Maintenance Modal with Parts Checklist
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    maintenance_type: "INSPECTION",
    priority: "HIGH",
    scheduled_date: new Date().toISOString().split("T")[0],
    preferred_technician: "Ventrix Technician",
    duration_hours: "2",
    required_parts: ["Return Air Filter"],
    notes: "",
  });

  // Technician: Active Job, Checklist, Part Request, Completion State
  const [techWorkOrders, setTechWorkOrders] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [checklist, setChecklist] = useState([
    { id: 1, label: "Check return air filter condition & differential pressure (filterDP)", checked: false },
    { id: 2, label: "Check cabin airflow circulation & supply duct velocity", checked: false },
    { id: 3, label: "Inspect scroll compressor mounting dampers & vibration levels", checked: false },
    { id: 4, label: "Check refrigerant pressure & subcooling line (bar)", checked: false },
    { id: 5, label: "Verify electrical contactor relay & motor current draw (A)", checked: false },
    { id: 6, label: "Clean intake condenser mesh & wipe filter casing", checked: false },
  ]);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [partForm, setPartForm] = useState({ part_name: "Return Air Filter (VX-FILTER-03)", quantity: 2, urgency: "HIGH", reason: "Filter heavily clogged" });
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeNotes, setCompleteNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showToast = (type, message) => {
    setFeedbackToast({ type, message });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // 1. Fetch Fleet Hierarchy
  const loadHierarchy = async () => {
    setLoading(true);
    try {
      const res = await fleetService.getHierarchy();
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setTrains(res.data);
        if (!selectedTrainId) {
          const firstTrain = res.data[0];
          setSelectedTrainId(firstTrain.id);
          if (firstTrain.coaches && firstTrain.coaches.length > 0) {
            setSelectedCoachId(firstTrain.coaches[0].id);
          }
        }
      }

      // Also load work orders for technician view
      if (currentRole === "TECHNICIAN") {
        const woRes = await maintenanceService.listWorkOrders();
        if (woRes?.success && Array.isArray(woRes.data)) {
          setTechWorkOrders(woRes.data);
          const active = woRes.data.find((w) => w.status === "IN_PROGRESS") || woRes.data.find((w) => w.status === "ASSIGNED") || woRes.data[0];
          setActiveJob(active || null);
        }
      }
    } catch {
      // Ignore background errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, [currentRole]);

  const activeTrain = useMemo(() => {
    return trains.find((t) => t.id === selectedTrainId) || trains[0] || null;
  }, [trains, selectedTrainId]);

  // When train changes, pick first coach
  useEffect(() => {
    if (activeTrain && activeTrain.coaches?.length > 0) {
      const exists = activeTrain.coaches.some((c) => c.id === selectedCoachId);
      if (!exists) {
        setSelectedCoachId(activeTrain.coaches[0].id);
      }
    }
  }, [activeTrain]);

  // 2. Fetch Coach Digital Twin data
  useEffect(() => {
    if (!selectedCoachId) return;
    fleetService
      .getCoachTwin(selectedCoachId)
      .then((res) => {
        if (res?.success && res.data) {
          setCoachTwin(res.data);
          const units = res.data.units || [];
          if (units.length > 0) {
            const hasCurr = units.some((u) => u.asset_code === selectedUnitCode);
            if (!hasCurr) {
              const warn = units.find((u) => u.status === "WARNING" || u.status === "CRITICAL");
              setSelectedUnitCode(warn ? warn.asset_code : units[0].asset_code);
            }
          }
        }
      })
      .catch(() => {});
  }, [selectedCoachId]);

  const activeCoach = useMemo(() => {
    return activeTrain?.coaches?.find((c) => c.id === selectedCoachId) || null;
  }, [activeTrain, selectedCoachId]);

  // Currently inspected HVAC unit
  const inspectedUnit = useMemo(() => {
    if (!coachTwin?.units) return null;
    return coachTwin.units.find((u) => u.asset_code === selectedUnitCode) || coachTwin.units[0] || null;
  }, [coachTwin, selectedUnitCode]);

  // Status color helper
  const getStatusColor = (st, health) => {
    const s = String(st || "").toUpperCase();
    if (s === "CRITICAL" || s === "ALARM" || s === "OFFLINE" || (health != null && health < 50)) {
      return { border: "#EF4444", bg: "rgba(239, 68, 68, 0.15)", text: "#EF4444", label: "Critical" };
    }
    if (s === "WARNING" || (health != null && health < 75)) {
      return { border: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", text: "#F59E0B", label: "Warning" };
    }
    if (s === "MAINTENANCE") {
      return { border: "#3B82F6", bg: "rgba(59, 130, 246, 0.15)", text: "#3B82F6", label: "Maintenance" };
    }
    return { border: "#10B981", bg: "rgba(16, 185, 129, 0.15)", text: "#10B981", label: "Nominal" };
  };

  // -------------------------------------------------------------------------
  // ROLE 3: TECHNICIAN FIELD EXECUTION DIGITAL TWIN VIEW
  // -------------------------------------------------------------------------
  if (currentRole === "TECHNICIAN") {
    const jobUnitCode = activeJob?.asset_code || "HVAC-005";
    const jobCoachNumber = activeJob?.coach_number || "Coach A4";
    const jobTrainNumber = activeJob?.train_number || "Train 12951";
    const isHigh = activeJob?.priority === "HIGH" || activeJob?.priority === "CRITICAL";

    const allChecked = checklist.every((c) => c.checked);
    const checkedCount = checklist.filter((c) => c.checked).length;

    const toggleCheck = (id) => {
      setChecklist((prev) =>
        prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
      );
    };

    const handleStartJob = async () => {
      if (!activeJob) return;
      try {
        await maintenanceService.updateWorkOrderStatus(activeJob.id, "IN_PROGRESS");
        showToast("success", `Work Order #${activeJob.id} is now IN PROGRESS.`);
        setActiveJob({ ...activeJob, status: "IN_PROGRESS" });
      } catch {
        showToast("error", "Failed to update job status.");
      }
    };

    const handleCompleteJob = async () => {
      if (!activeJob) return;
      setSubmitting(true);
      try {
        await maintenanceService.updateWorkOrderStatus(activeJob.id, "COMPLETED");
        showToast("success", `Work Order #${activeJob.id} for ${jobUnitCode} marked COMPLETED.`);
        setCompleteModalOpen(false);
        loadHierarchy();
      } catch {
        showToast("error", "Failed to complete work order.");
      } finally {
        setSubmitting(false);
      }
    };

    const handleRequestPartSubmit = async (e) => {
      e.preventDefault();
      try {
        showToast("success", `Part request for ${partForm.part_name} submitted for Supervisor approval.`);
        setPartModalOpen(false);
      } catch {
        showToast("error", "Error submitting part request.");
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {feedbackToast && (
          <div
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 9999,
              padding: "12px 18px",
              borderRadius: 10,
              background: feedbackToast.type === "success" ? "#065F46" : "#991B1B",
              color: "#fff",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              fontWeight: 600,
              fontSize: 13.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {feedbackToast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {feedbackToast.message}
          </div>
        )}

        {/* Technician Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(16, 185, 129, 0.15)", color: "#10B981", fontSize: 11, fontWeight: 800 }}>
                FIELD TECHNICIAN
              </span>
              <span style={{ fontSize: 12, color: t.textMuted }}>Direct Unit Telemetry & Inspection Routine</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: t.text }}>
              Assigned HVAC Unit Digital Twin & Inspection Checklist
            </h2>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {activeJob && activeJob.status !== "IN_PROGRESS" && (
              <Button variant="primary" size="sm" onClick={handleStartJob}>
                <Clock size={14} style={{ marginRight: 5 }} /> Start Work Order #{activeJob.id}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setPartModalOpen(true)}>
              <Package size={14} style={{ marginRight: 5 }} /> Request Spare Part
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCompleteModalOpen(true)}>
              <CheckCircle2 size={14} style={{ marginRight: 5 }} /> Complete Job
            </Button>
          </div>
        </div>

        {/* ── Focused Assigned HVAC Unit Card ── */}
        <Card hoverEffect={false} style={{ borderLeft: `6px solid ${isHigh ? "#EF4444" : "#0284C7"}`, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: t.textMuted }}>Active Work Order: <strong>#{activeJob?.id || "WO-1025"}</strong></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: t.text }}>
                  {jobUnitCode}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: isHigh ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                    color: isHigh ? "#EF4444" : "#F59E0B",
                  }}
                >
                  {isHigh ? "CRITICAL / HIGH PRIORITY" : "INSPECTION ACTIVE"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
                {jobTrainNumber} · {jobCoachNumber} · Rooftop End B
              </div>
            </div>

            {/* Quick telemetry readings */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)", border: `1px solid ${t.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: t.textMuted }}>Supply Temp</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: t.text }}>
                  25.8°C
                </div>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)", border: `1px solid ${t.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: t.textMuted }}>Filter DP</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#EF4444" }}>
                  285 Pa
                </div>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)", border: `1px solid ${t.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: t.textMuted }}>Current</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#F59E0B" }}>
                  17.2 A
                </div>
              </div>
            </div>
          </div>

          {/* Diagnosis & Prescriptive Action */}
          <div
            style={{
              marginTop: 18,
              padding: "12px 16px",
              borderRadius: 10,
              background: isDark ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.05)",
              border: `1px solid rgba(239, 68, 68, 0.25)`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#EF4444", fontWeight: 700, fontSize: 13 }}>
              <AlertCircle size={15} /> Identified Problem: Elevated Filter DP & Reduced Evaporator Airflow
            </div>
            <div style={{ fontSize: 12.5, color: t.text, lineHeight: 1.5 }}>
              Recommended Action: Inspect return air filter and replace if clogged; verify coil cleanliness and measure compressor current upon restart.
            </div>
          </div>
        </Card>

        {/* ── Interactive Digital Inspection Checklist ── */}
        <Card hoverEffect={false} style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckSquare size={17} color="#0284C7" /> Digital Inspection Checklist
              </h3>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                Tick off each technical milestone during physical field inspection on {jobUnitCode}
              </div>
            </div>

            <span style={{ fontSize: 12, fontWeight: 700, color: allChecked ? "#10B981" : t.textMuted }}>
              {checkedCount} / {checklist.length} Completed
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: item.checked
                    ? `1px solid rgba(16, 185, 129, 0.4)`
                    : `1px solid ${t.border}`,
                  background: item.checked
                    ? isDark
                      ? "rgba(16, 185, 129, 0.08)"
                      : "rgba(16, 185, 129, 0.06)"
                    : isDark
                    ? "rgba(255,255,255,0.02)"
                    : "#fff",
                  transition: "all 0.15s ease",
                }}
              >
                {item.checked ? (
                  <CheckCircle2 size={18} color="#10B981" />
                ) : (
                  <Square size={18} color={t.textMuted} />
                )}
                <span
                  style={{
                    fontSize: 13,
                    color: item.checked ? t.text : t.textMuted,
                    textDecoration: item.checked ? "line-through" : "none",
                    fontWeight: item.checked ? 600 : 500,
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Modal: Request Spare Part */}
        {partModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 20,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 460,
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              }}
            >
              <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: t.text }}>
                Submit Spare Part Requisition
              </h3>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
                Work Order: <strong>#{activeJob?.id || "WO-1025"}</strong> · Asset: <strong>{jobUnitCode}</strong>
              </div>

              <form onSubmit={handleRequestPartSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    Required Part *
                  </label>
                  <select
                    value={partForm.part_name}
                    onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                      color: t.text,
                      outline: "none",
                    }}
                  >
                    <option value="Return Air Filter (VX-FILTER-03)">Return Air Filter (VX-FILTER-03)</option>
                    <option value="Scroll Compressor (VX-COMP-01)">Scroll Compressor (VX-COMP-01)</option>
                    <option value="Condenser Fan Motor (VX-FAN-MOTOR-02)">Condenser Fan Motor (VX-FAN-MOTOR-02)</option>
                    <option value="Pressure Sensor (VX-SENSOR-04)">Pressure Sensor (VX-SENSOR-04)</option>
                    <option value="Compressor Relay (VX-RELAY-05)">Compressor Relay (VX-RELAY-05)</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={partForm.quantity}
                      onChange={(e) => setPartForm({ ...partForm, quantity: Number(e.target.value) })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                        color: t.text,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                      Urgency
                    </label>
                    <select
                      value={partForm.urgency}
                      onChange={(e) => setPartForm({ ...partForm, urgency: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                        color: t.text,
                        outline: "none",
                      }}
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    Reason for Requisition
                  </label>
                  <textarea
                    rows={2}
                    value={partForm.reason}
                    onChange={(e) => setPartForm({ ...partForm, reason: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                      color: t.text,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <Button variant="secondary" type="button" onClick={() => setPartModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Submit Request
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Complete Work Order */}
        {completeModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 20,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 480,
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              }}
            >
              <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: t.text }}>
                Work Order Completion & Sign-off
              </h3>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
                Work Order #{activeJob?.id || "WO-1025"} · {jobUnitCode}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5 }}>
                <div>
                  <strong>Inspection Findings:</strong> Filter heavily clogged, restricted airflow.
                </div>
                <div>
                  <strong>Action Taken:</strong> Replaced return air filter; clean casing.
                </div>
                <div>
                  <strong>Parts Used:</strong> 2 × Return Air Filter (VX-FILTER-03).
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    Technician Notes / Post-Service Observations
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Unit restarted and run for 15 minutes. Supply temperature dropped to 21.2°C. No abnormal vibration..."
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                      color: t.text,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <Button variant="secondary" type="button" onClick={() => setCompleteModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="button" onClick={handleCompleteJob} disabled={submitting}>
                    {submitting ? "Submitting..." : "Sign-off & Complete"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // ROLE 1: ADMIN HIGH-LEVEL MACRO FLEET VIEW
  // -------------------------------------------------------------------------
  if (currentRole === "ADMIN") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(2, 132, 199, 0.15)", color: "#0284C7", fontSize: 11, fontWeight: 800 }}>
                EXECUTIVE FLEET MANAGEMENT
              </span>
              <span style={{ fontSize: 12, color: t.textMuted }}>Macro Health & Operating Condition</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: t.text }}>
              Ventrix Railway Fleet Overview
            </h2>
          </div>
          <Button variant="secondary" size="sm" onClick={loadHierarchy}>
            <RefreshCw size={13} style={{ marginRight: 5 }} /> Refresh Fleet Status
          </Button>
        </div>

        {/* Train Fleet Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {trains.map((train) => {
            const isSelected = train.id === selectedTrainId;
            const crit = train.stats?.criticalCoaches || 0;
            const warn = train.stats?.warningCoaches || 0;
            const statusBadge = crit > 0 ? "🔴 CRITICAL" : warn > 0 ? "🟡 WARNING" : "🟢 OPERATIONAL";

            return (
              <Card
                key={train.id}
                hoverEffect={false}
                style={{
                  border: isSelected ? `2px solid #0284C7` : `1px solid ${t.border}`,
                  padding: 20,
                  cursor: "pointer",
                }}
                onClick={() => setSelectedTrainId(train.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 17, color: t.text }}>
                    Train {train.train_number}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{statusBadge}</span>
                </div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>{train.train_name}</div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.textMuted, borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
                  <span>Coaches: <strong>{train.coaches?.length || 0}</strong></span>
                  <span>HVAC Units: <strong>{train.stats?.totalHvacUnits || 0}</strong></span>
                  <span>Fleet Health: <strong style={{ color: crit > 0 ? "#EF4444" : "#10B981" }}>{train.stats?.overallHealth || 92}%</strong></span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Selected Train Coaches Drilldown */}
        {activeTrain && (
          <Card hoverEffect={false} style={{ padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 14 }}>
              Train {activeTrain.train_number} ({activeTrain.train_name}) — Coach Roster
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {(activeTrain.coaches || []).map((coach) => {
                const isCrit = coach.health?.status === "CRITICAL";
                const isWarn = coach.health?.status === "WARNING";
                const badgeColor = isCrit ? "#EF4444" : isWarn ? "#F59E0B" : "#10B981";

                return (
                  <div
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id)}
                    style={{
                      cursor: "pointer",
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: selectedCoachId === coach.id ? `2px solid ${badgeColor}` : `1px solid ${t.border}`,
                      background: selectedCoachId === coach.id ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)") : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: t.text, fontSize: 15 }}>Coach {coach.coach_number}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: badgeColor }}>
                        {isCrit ? "🔴 Critical" : isWarn ? "🟡 Warning" : "🟢 Healthy"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 4 }}>
                      {coach.coach_type} · {coach.hvac_units?.length || 0} HVAC Units
                    </div>

                    {/* Installed HVAC units summary */}
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      {(coach.hvac_units || []).map((unit) => (
                        <span
                          key={unit.id}
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.06)",
                            color: unit.status === "WARNING" ? "#F59E0B" : t.text,
                          }}
                        >
                          {unit.asset_code}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // ROLE 2: ENGINEER DEEP HVAC COMMAND CENTER DIGITAL TWIN VIEW
  // -------------------------------------------------------------------------
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!inspectedUnit) return;
    try {
      await maintenanceService.createSchedule({
        asset_id: inspectedUnit.id,
        maintenance_type: scheduleForm.maintenance_type,
        priority: scheduleForm.priority,
        scheduled_date: scheduleForm.scheduled_date,
        notes: `Required Parts: ${scheduleForm.required_parts.join(", ")}. ${scheduleForm.notes}`,
      });
      showToast("success", `Maintenance scheduled for ${inspectedUnit.asset_code}. Work order dispatched.`);
      setScheduleModalOpen(false);
      loadHierarchy();
    } catch {
      showToast("error", "Error creating schedule.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedbackToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 18px",
            borderRadius: 10,
            background: feedbackToast.type === "success" ? "#065F46" : "#991B1B",
            color: "#fff",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            fontWeight: 600,
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {feedbackToast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {feedbackToast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(2, 132, 199, 0.15)", color: "#0284C7", fontSize: 11, fontWeight: 800 }}>
              ENGINEER COMMAND CENTER
            </span>
            <span style={{ fontSize: 12, color: t.textMuted }}>Multi-layer Component Condition & Spatial Layout</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: t.text }}>
            Coach HVAC Digital Twin & Engineering Diagnostics
          </h2>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="sm" onClick={loadHierarchy}>
            <RefreshCw size={13} style={{ marginRight: 5 }} /> Refresh
          </Button>
        </div>
      </div>

      {/* Train & Coach Selector Bar */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {(activeTrain?.coaches || []).map((coach) => {
          const isSelected = coach.id === selectedCoachId;
          const healthColor = getStatusColor(coach.health?.status, coach.health?.healthScore);

          return (
            <div
              key={coach.id}
              onClick={() => setSelectedCoachId(coach.id)}
              style={{
                cursor: "pointer",
                padding: "10px 16px",
                borderRadius: 10,
                border: isSelected ? `2px solid ${healthColor.border}` : `1px solid ${t.border}`,
                background: isSelected ? healthColor.bg : isDark ? "rgba(255,255,255,0.02)" : "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 110,
                transition: "all 0.15s ease",
              }}
            >
              <strong style={{ fontSize: 14, color: t.text }}>Coach {coach.coach_number}</strong>
              <span style={{ fontSize: 11, color: healthColor.text, fontWeight: 700, marginTop: 2 }}>
                {coach.health?.healthScore}% HP
              </span>
            </div>
          );
        })}
      </div>

      {/* 2D Layout & Deep Inspector Columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {/* Left: 2D Blueprint */}
        <Card hoverEffect={false} style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <strong style={{ fontSize: 16, color: t.text }}>Coach {activeCoach?.coach_number} — RMPU Placements</strong>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Click Rooftop Unit to inspect component degradation</div>
            </div>
            <span style={{ fontSize: 11, color: "#0284C7", fontWeight: 700 }}>End A ➔ End B</span>
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              background: isDark ? "#0A101D" : "#F1F5F9",
              border: `2px solid ${isDark ? "#1E293B" : "#CBD5E1"}`,
              borderRadius: 16,
              padding: "24px 16px",
            }}
          >
            {/* Units Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: 12, alignItems: "center" }}>
              {/* Unit 1 */}
              {(() => {
                const uA = coachTwin?.endAUnit || coachTwin?.units?.[0];
                const isSel = inspectedUnit?.asset_code === uA?.asset_code;
                const col = getStatusColor(uA?.status, uA?.health_score);

                return (
                  <div
                    onClick={() => uA && setSelectedUnitCode(uA.asset_code)}
                    style={{
                      cursor: "pointer",
                      padding: "14px 10px",
                      borderRadius: 12,
                      border: `2px solid ${isSel ? "#0284C7" : col.border}`,
                      background: isSel ? "rgba(2, 132, 199, 0.18)" : col.bg,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 14, color: t.text }}>
                      {uA?.asset_code || "RMPU-1"}
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: col.text, marginTop: 2 }}>
                      {col.label.toUpperCase()} · {uA?.health_score != null ? `${Math.round(uA.health_score)}%` : "96%"}
                    </div>
                    <div style={{ fontSize: 9.5, color: t.textMuted, marginTop: 4 }}>End A Rooftop</div>
                  </div>
                );
              })()}

              {/* Cabin & Ducts */}
              <div
                style={{
                  border: `1px dashed ${isDark ? "rgba(56, 189, 248, 0.4)" : "rgba(2, 132, 199, 0.4)"}`,
                  borderRadius: 10,
                  padding: "12px 8px",
                  textAlign: "center",
                  fontSize: 11,
                }}
              >
                <div style={{ color: "#0284C7", fontWeight: 700, marginBottom: 4 }}>PASSENGER CABIN</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>Supply Ducts ⇄ Return Grilles</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: t.text, marginTop: 4 }}>
                  Avg: {coachTwin?.thermalAnalysis?.avgCabinTemp || 22.2}°C
                </div>
              </div>

              {/* Unit 2 */}
              {(() => {
                const uB = coachTwin?.endBUnit || coachTwin?.units?.[1];
                const isSel = inspectedUnit?.asset_code === uB?.asset_code;
                const col = getStatusColor(uB?.status, uB?.health_score);

                return (
                  <div
                    onClick={() => uB && setSelectedUnitCode(uB.asset_code)}
                    style={{
                      cursor: "pointer",
                      padding: "14px 10px",
                      borderRadius: 12,
                      border: `2px solid ${isSel ? "#0284C7" : col.border}`,
                      background: isSel ? "rgba(2, 132, 199, 0.18)" : col.bg,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 14, color: t.text }}>
                      {uB?.asset_code || "RMPU-2"}
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: col.text, marginTop: 2 }}>
                      {col.label.toUpperCase()} · {uB?.health_score != null ? `${Math.round(uB.health_score)}%` : "64%"}
                    </div>
                    <div style={{ fontSize: 9.5, color: t.textMuted, marginTop: 4 }}>End B Rooftop</div>
                  </div>
                );
              })()}
            </div>
          </div>
        </Card>

        {/* Right: Deep Subsystem Component Breakdown */}
        {inspectedUnit && (
          <Card hoverEffect={false} style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: t.text }}>
                    {inspectedUnit.asset_code}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: "rgba(245, 158, 11, 0.2)", color: "#F59E0B" }}>
                    {inspectedUnit.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  Health Score: <strong>{inspectedUnit.health_score != null ? `${Math.round(inspectedUnit.health_score)}%` : "64%"}</strong>
                </div>
              </div>

              <Button variant="primary" size="sm" onClick={() => setScheduleModalOpen(true)}>
                <Clock size={13} style={{ marginRight: 4 }} /> Schedule Maintenance
              </Button>
            </div>

            {/* Subsystem Condition Checklist */}
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 8, textTransform: "uppercase" }}>
              Subsystem Component Condition
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              <div style={{ padding: "8px 10px", borderRadius: 8, background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)", border: `1px solid ${t.border}`, fontSize: 12 }}>
                <span style={{ color: t.textMuted }}>Compressor:</span>
                <strong style={{ color: inspectedUnit.status === "WARNING" ? "#F59E0B" : "#10B981", marginLeft: 6 }}>
                  {inspectedUnit.status === "WARNING" ? "🟡 Degrading" : "🟢 Nominal"}
                </strong>
              </div>
              <div style={{ padding: "8px 10px", borderRadius: 8, background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)", border: `1px solid ${t.border}`, fontSize: 12 }}>
                <span style={{ color: t.textMuted }}>Motor:</span>
                <strong style={{ color: inspectedUnit.status === "WARNING" ? "#F59E0B" : "#10B981", marginLeft: 6 }}>
                  {inspectedUnit.status === "WARNING" ? "🟡 Degrading" : "🟢 Nominal"}
                </strong>
              </div>
              <div style={{ padding: "8px 10px", borderRadius: 8, background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)", border: `1px solid ${t.border}`, fontSize: 12 }}>
                <span style={{ color: t.textMuted }}>Filter:</span>
                <strong style={{ color: inspectedUnit.status === "WARNING" ? "#EF4444" : "#10B981", marginLeft: 6 }}>
                  {inspectedUnit.status === "WARNING" ? "🔴 Restricted" : "🟢 Clean"}
                </strong>
              </div>
              <div style={{ padding: "8px 10px", borderRadius: 8, background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)", border: `1px solid ${t.border}`, fontSize: 12 }}>
                <span style={{ color: t.textMuted }}>Cooling:</span>
                <strong style={{ color: inspectedUnit.status === "WARNING" ? "#F59E0B" : "#10B981", marginLeft: 6 }}>
                  {inspectedUnit.status === "WARNING" ? "🟡 Reduced" : "🟢 Optimal"}
                </strong>
              </div>
            </div>

            {/* Live Sensor Metrics */}
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 8, textTransform: "uppercase" }}>
              Live Telemetry Readings
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              <div style={{ padding: "6px 8px", borderRadius: 6, background: isDark ? "rgba(0,0,0,0.25)" : "#f8fafc", border: `1px solid ${t.border}` }}>
                Temp: <strong>{inspectedUnit.temperature || 25.8}°C</strong>
              </div>
              <div style={{ padding: "6px 8px", borderRadius: 6, background: isDark ? "rgba(0,0,0,0.25)" : "#f8fafc", border: `1px solid ${t.border}` }}>
                Press: <strong>{inspectedUnit.pressure || 3.9} bar</strong>
              </div>
              <div style={{ padding: "6px 8px", borderRadius: 6, background: isDark ? "rgba(0,0,0,0.25)" : "#f8fafc", border: `1px solid ${t.border}` }}>
                Current: <strong>{inspectedUnit.current || 17.2} A</strong>
              </div>
              <div style={{ padding: "6px 8px", borderRadius: 6, background: isDark ? "rgba(0,0,0,0.25)" : "#f8fafc", border: `1px solid ${t.border}` }}>
                Filter DP: <strong>{inspectedUnit.status === "WARNING" ? "285 Pa" : "165 Pa"}</strong>
              </div>
              <div style={{ padding: "6px 8px", borderRadius: 6, background: isDark ? "rgba(0,0,0,0.25)" : "#f8fafc", border: `1px solid ${t.border}` }}>
                Power: <strong>{inspectedUnit.power || 8.4} kW</strong>
              </div>
              <div style={{ padding: "6px 8px", borderRadius: 6, background: isDark ? "rgba(0,0,0,0.25)" : "#f8fafc", border: `1px solid ${t.border}` }}>
                Vibration: <strong>{inspectedUnit.vibration || 3.8} mm/s</strong>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Engineer Schedule Maintenance Modal with Required Parts Checklist */}
      {scheduleModalOpen && inspectedUnit && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: t.text }}>
              Schedule Maintenance for {inspectedUnit.asset_code}
            </h3>

            <form onSubmit={handleScheduleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    Maintenance Type
                  </label>
                  <select
                    value={scheduleForm.maintenance_type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, maintenance_type: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                      color: t.text,
                      outline: "none",
                    }}
                  >
                    <option value="INSPECTION">Inspection</option>
                    <option value="FILTER_REPLACEMENT">Filter Replacement</option>
                    <option value="OVERHAUL">Full Depot Overhaul</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    Priority
                  </label>
                  <select
                    value={scheduleForm.priority}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                      color: t.text,
                      outline: "none",
                    }}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.scheduled_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                      color: t.text,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    Preferred Technician
                  </label>
                  <select
                    value={scheduleForm.preferred_technician}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, preferred_technician: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                      color: t.text,
                      outline: "none",
                    }}
                  >
                    <option value="Ventrix Technician">Ventrix Technician</option>
                    <option value="Ramesh Nair">Ramesh Nair</option>
                    <option value="Anjali Menon">Anjali Menon</option>
                  </select>
                </div>
              </div>

              {/* Required Parts Checklist */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 6 }}>
                  Required Parts Allocation
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                  {["Return Air Filter", "Scroll Compressor", "Fan Motor", "Pressure Sensor"].map((part) => (
                    <label key={part} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={scheduleForm.required_parts.includes(part)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setScheduleForm({ ...scheduleForm, required_parts: [...scheduleForm.required_parts, part] });
                          } else {
                            setScheduleForm({ ...scheduleForm, required_parts: scheduleForm.required_parts.filter((p) => p !== part) });
                          }
                        }}
                      />
                      {part}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  Diagnostic Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Focus on TXV subcooling and check filter DP before and after replacement..."
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: isDark ? "rgba(0,0,0,0.3)" : "#fff",
                    color: t.text,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button variant="secondary" type="button" onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Schedule & Dispatch Work Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

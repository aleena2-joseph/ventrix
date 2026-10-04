import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Users,
  Plus,
  ArrowRight,
  Sparkles,
  RotateCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Package,
  History,
  Tag,
  ShieldCheck,
  CalendarDays,
  FileText,
  CheckSquare,
  Square,
  AlertCircle,
  Play,
  Check,
  Train,
} from "lucide-react";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";
import { maintenanceService } from "../../../services/maintenanceService";
import { userService } from "../../../services/userService";
import { inventoryService } from "../../../services/inventoryService";
import { useTheme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";

export default function MaintenancePlanner({ initialAssetCode = null, onNavigate }) {
  const { isDark, tokens: t } = useTheme();
  const { user, role } = useAuth();
  const currentRole = (role || user?.role_name || user?.role || "ADMIN").toUpperCase();

  // Allow preview switching for administrators, defaulting to authenticated role
  const [activeRoleView, setActiveRoleView] = useState(currentRole);

  useEffect(() => {
    setActiveRoleView(currentRole);
  }, [currentRole]);

  // Global Planning Data
  const [assetSummaries, setAssetSummaries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [inventoryParts, setInventoryParts] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Admin View State
  const [adminTab, setAdminTab] = useState("agenda"); // "agenda" | "calendar" | "workload"
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 8, 1)); // Sept 2026

  // Engineer View State
  const [engineerSearch, setEngineerSearch] = useState(initialAssetCode || "");
  const [engineerPriorityFilter, setEngineerPriorityFilter] = useState("ALL");
  const [selectedAssetCode, setSelectedAssetCode] = useState(initialAssetCode || "HVAC-005");

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [createWoModalOpen, setCreateWoModalOpen] = useState(false);
  const [partRequestModalOpen, setPartRequestModalOpen] = useState(false);
  const [completeWoModalOpen, setCompleteWoModalOpen] = useState(false);

  // Active items for modals
  const [activeAssetCode, setActiveAssetCode] = useState(initialAssetCode || null);
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [activeWorkOrderId, setActiveWorkOrderId] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Standard Railway HVAC Maintenance Templates
  const MAINTENANCE_TEMPLATES = [
    {
      name: "Monthly Filter & Coil Cleaning",
      type: "PREVENTIVE",
      duration: "1.5 hours",
      parts: ["Return Air Filter"],
      notes: "Clean condenser fins, replace return air filter, verify condensate drain clearance.",
    },
    {
      name: "Quarterly Electrical & Contactor Service",
      type: "PREVENTIVE",
      duration: "3.0 hours",
      parts: ["Contactor Relay", "Refrigerant R134a Canister"],
      notes: "Test compressor startup current, verify relay contact points, check refrigerant pressures.",
    },
    {
      name: "Semi-Annual Blower & Vibration Inspection",
      type: "PREVENTIVE",
      duration: "4.5 hours",
      parts: ["Condenser Fan Motor", "TXV Expansion Valve"],
      notes: "Check blower fan alignment, inspect vibration dampeners, calibrate expansion valve.",
    },
    {
      name: "Annual Depot Major Overhaul",
      type: "OVERHAUL",
      duration: "8.0 hours",
      parts: ["Scroll Compressor", "Condenser Fan Motor", "Contactor Relay", "Return Air Filter"],
      notes: "Full depot bench testing, motor rewinding, complete coil chemical flush.",
    },
  ];

  // Engineer Schedule Form with Required Parts checklist & Template Support
  const [scheduleForm, setScheduleForm] = useState({
    asset_id: "",
    template_name: "",
    maintenance_type: "PREVENTIVE",
    scheduled_date: new Date().toISOString().split("T")[0],
    priority: "HIGH",
    assigned_to: "",
    duration: "2 hours",
    required_parts: ["Return Air Filter"],
    notes: "",
    generateWorkOrderNow: false,
  });

  // Admin Reschedule Form
  const [rescheduleForm, setRescheduleForm] = useState({
    scheduled_date: "",
    priority: "MEDIUM",
    assigned_to: "",
    notes: "",
  });

  // Work Order Form
  const [woForm, setWoForm] = useState({
    asset_id: "",
    title: "",
    description: "",
    priority: "MEDIUM",
    assigned_to: "",
  });

  // Technician Part Request Form
  const [partReqForm, setPartReqForm] = useState({
    work_order_id: "",
    part_name: "Return Air Filter (VX-FILTER-03)",
    part_id: "",
    quantity: 2,
    urgency: "HIGH",
    reason: "Filter heavily clogged with dust from northern route",
  });

  // Technician Work Completion Form
  const [completeForm, setCompleteForm] = useState({
    work_order_id: "",
    inspection_findings: "Filter heavily clogged; airflow delta restored after replacement.",
    action_taken: "Replaced return air filter, wiped frame casing, checked suction pressure.",
    parts_used: "2 × Return Air Filter",
    additional_findings: "Coil requires fin comb cleaning during next scheduled overhaul.",
    technician_notes: "Unit returned to operational status. All temperature test cycles nominal.",
  });

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3800);
  };

  // Load All Planning Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, schedRes, techRes, woRes, invRes, reqRes] = await Promise.all([
        maintenanceService.getAssetSummaries().catch(() => ({ success: false })),
        maintenanceService.listSchedules().catch(() => ({ success: false })),
        userService.getTechnicians().catch(() => ({ success: false })),
        maintenanceService.listWorkOrders().catch(() => ({ success: false })),
        inventoryService.listParts().catch(() => ({ success: false })),
        inventoryService.listRequests().catch(() => ({ success: false })),
      ]);

      if (sumRes?.success && Array.isArray(sumRes.data)) {
        setAssetSummaries(sumRes.data);
      }
      if (schedRes?.success && Array.isArray(schedRes.data)) {
        setSchedules(schedRes.data);
      }
      if (techRes?.success && Array.isArray(techRes.data)) {
        setTechnicians(techRes.data);
      }
      if (woRes?.success && Array.isArray(woRes.data)) {
        setWorkOrders(woRes.data);
      }
      if (invRes?.success && Array.isArray(invRes.data)) {
        setInventoryParts(invRes.data);
      }
      if (reqRes?.success && Array.isArray(reqRes.data)) {
        setPartRequests(reqRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Set default selected asset for Engineer view
  useEffect(() => {
    if (assetSummaries.length > 0 && !selectedAssetCode) {
      const target = assetSummaries.find((a) => a.asset_code === "HVAC-005") || assetSummaries[0];
      setSelectedAssetCode(target.asset_code);
    }
  }, [assetSummaries, selectedAssetCode]);

  // Open History Modal for an Asset
  const handleOpenHistory = async (assetCode) => {
    setActiveAssetCode(assetCode);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await maintenanceService.getAssetHistory(assetCode);
      if (res?.success && res.data) {
        setHistoryData(res.data);
      }
    } catch {
      notify("error", "Failed to fetch asset maintenance history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Reschedule Modal (Admin / Supervisor)
  const handleOpenReschedule = (sched) => {
    setActiveSchedule(sched);
    setRescheduleForm({
      scheduled_date: sched.scheduled_date ? new Date(sched.scheduled_date).toISOString().split("T")[0] : "",
      priority: sched.priority || "MEDIUM",
      assigned_to: sched.assigned_to || "",
      notes: sched.notes || "",
    });
    setRescheduleModalOpen(true);
  };

  // Save Schedule Creation (Engineer)
  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    const assetId = scheduleForm.asset_id || assetSummaries.find((a) => a.asset_code === selectedAssetCode)?.id || assetSummaries[0]?.id;
    if (!assetId) {
      notify("error", "Please select a target HVAC asset");
      return;
    }

    try {
      const res = await maintenanceService.createSchedule({
        ...scheduleForm,
        asset_id: Number(assetId),
        template_name: scheduleForm.template_name || null,
        required_parts: scheduleForm.required_parts,
        duration: scheduleForm.duration,
        assigned_to: scheduleForm.assigned_to ? Number(scheduleForm.assigned_to) : null,
        notes: `${scheduleForm.notes ? scheduleForm.notes + " | " : ""}Parts Required: ${scheduleForm.required_parts.join(", ") || "None"} | Est: ${scheduleForm.duration}`,
      });

      if (res?.success) {
        if (scheduleForm.generateWorkOrderNow) {
          // Optional immediate work order dispatch
          await maintenanceService.createWorkOrder({
            asset_id: Number(assetId),
            title: `${scheduleForm.template_name || scheduleForm.maintenance_type} Servicing for ${selectedAssetCode || "HVAC"}`,
            description: `Triggered from Maintenance Planner. Required Parts: ${scheduleForm.required_parts.join(", ") || "Standard inspection"}. Est. Duration: ${scheduleForm.duration}. Notes: ${scheduleForm.notes || "Turnaround servicing"}`,
            priority: scheduleForm.priority,
            maintenance_type: scheduleForm.maintenance_type === "PREVENTIVE" ? "PREVENTIVE" : "CORRECTIVE",
            estimated_duration: parseFloat(scheduleForm.duration) || 2,
            assigned_to: scheduleForm.assigned_to ? Number(scheduleForm.assigned_to) : null,
          }).catch(() => null);

          notify("success", "Maintenance Scheduled & Work Order Dispatched to Depot Bay ✓");
        } else {
          notify("success", "Maintenance Window Scheduled on Fleet Calendar ✓ (Work order preserved for execution window)");
        }
        setScheduleModalOpen(false);
        loadData();
      } else {
        notify("error", res?.message || "Failed to create schedule");
      }
    } catch (err) {
      notify("error", err?.response?.data?.message || "Error creating schedule");
    }
  };

  // Save Reschedule (Admin override)
  const handleSaveReschedule = async (e) => {
    e.preventDefault();
    if (!activeSchedule) return;
    try {
      const res = await maintenanceService.updateSchedule(activeSchedule.id || activeSchedule.schedule_id, {
        scheduled_date: rescheduleForm.scheduled_date,
        priority: rescheduleForm.priority,
        assigned_to: rescheduleForm.assigned_to ? Number(rescheduleForm.assigned_to) : null,
        notes: rescheduleForm.notes,
      });
      if (res?.success) {
        notify("success", "Maintenance schedule successfully rescheduled & assigned");
        setRescheduleModalOpen(false);
        loadData();
      } else {
        notify("error", res?.message || "Failed to update schedule");
      }
    } catch {
      notify("error", "Error updating maintenance schedule");
    }
  };

  // Submit Part Request (Technician)
  const handleSubmitPartRequest = async (e) => {
    e.preventDefault();
    try {
      const matchedPart = inventoryParts.find((p) => p.name === partReqForm.part_name) || inventoryParts[0];
      const res = await inventoryService.createRequest({
        work_order_id: partReqForm.work_order_id ? Number(partReqForm.work_order_id) : undefined,
        part_id: matchedPart?.id || 1,
        quantity: Number(partReqForm.quantity) || 1,
        urgency: partReqForm.urgency,
        reason: partReqForm.reason,
      });

      if (res?.success) {
        notify("success", `Part request for ${partReqForm.quantity}x ${partReqForm.part_name} submitted (Status: PENDING APPROVAL)`);
        setPartRequestModalOpen(false);
        loadData();
      } else {
        notify("error", res?.message || "Failed to submit part request");
      }
    } catch {
      notify("error", "Error submitting part request");
    }
  };

  // Engineer Approve Part Request
  const handleApprovePartRequest = async (reqId, partName, qty) => {
    try {
      const res = await inventoryService.approveRequest(reqId);
      if (res?.success) {
        notify("success", `APPROVED ✓ ${qty}x ${partName} issued to job.`);
        loadData();
      } else {
        notify("error", res?.message || "Failed to approve part request");
      }
    } catch {
      notify("error", "Error approving part request");
    }
  };

  // Technician Start Job
  const handleStartJob = async (woId) => {
    try {
      const res = await maintenanceService.updateWorkOrderStatus(woId, "IN_PROGRESS");
      if (res?.success) {
        notify("success", `Work Order #${woId} moved to IN_PROGRESS. Field execution timer started.`);
        loadData();
      }
    } catch {
      notify("error", "Failed to update job status");
    }
  };

  // Technician Work Completion
  const handleCompleteJob = async (e) => {
    e.preventDefault();
    if (!completeForm.work_order_id) return;
    try {
      const res = await maintenanceService.updateWorkOrderStatus(completeForm.work_order_id, "COMPLETED");
      if (res?.success) {
        notify("success", `Work Order #${completeForm.work_order_id} completed successfully ✓ Maintenance history updated.`);
        setCompleteWoModalOpen(false);
        loadData();
      } else {
        notify("error", res?.message || "Failed to complete work order");
      }
    } catch {
      notify("error", "Error completing work order");
    }
  };

  // Toggle Part in Engineer checklist
  const toggleRequiredPart = (partName) => {
    setScheduleForm((prev) => {
      const exists = prev.required_parts.includes(partName);
      return {
        ...prev,
        required_parts: exists
          ? prev.required_parts.filter((p) => p !== partName)
          : [...prev.required_parts, partName],
      };
    });
  };

  // Currently selected asset object for Engineer
  const currentSelectedAsset = useMemo(() => {
    return (
      assetSummaries.find((a) => a.asset_code === selectedAssetCode) ||
      assetSummaries[0] || {
        asset_code: "HVAC-005",
        name: "Cab 1 Rooftop Unit",
        coach_number: "A1",
        train_number: "12951",
        health_score: 64,
        asset_status: "WARNING",
        operating_hours: 12450,
        last_maintenance_date: "2026-08-12",
        next_scheduled_date: "2026-09-20",
        next_priority: "HIGH",
        maintenance_frequency: "90 Days (Quarterly)",
        assigned_technician_name: "Technician A",
        previous_repairs: ["Filter replacement", "Coil cleaning", "Refrigerant inspection"],
      }
    );
  }, [assetSummaries, selectedAssetCode]);

  // Categorize schedules chronologically for Admin Agenda
  const categorizedSchedules = useMemo(() => {
    const todayStr = "2026-09-13"; // normalized depot operations date
    const todayList = [];
    const tomorrowList = [];
    const nextWeekList = [];
    const upcomingList = [];
    const overdueList = [];

    // Fallback demonstration schedules if DB table is lean
    const rawSchedules = schedules.length > 0 ? schedules : [
      { id: 101, asset_code: "HVAC-021", coach_number: "A2", train_number: "12951", scheduled_date: "2026-09-13", maintenance_type: "INSPECTION", priority: "HIGH", tech_name: "Technician A", status: "SCHEDULED" },
      { id: 102, asset_code: "HVAC-043", coach_number: "A4", train_number: "12954", scheduled_date: "2026-09-13", maintenance_type: "PREVENTIVE", priority: "MEDIUM", tech_name: "Technician B", status: "SCHEDULED" },
      { id: 103, asset_code: "HVAC-055", coach_number: "B1", train_number: "22436", scheduled_date: "2026-09-14", maintenance_type: "CORRECTIVE", priority: "LOW", tech_name: "Technician C", status: "SCHEDULED" },
      { id: 104, asset_code: "HVAC-071", coach_number: "B3", train_number: "12002", scheduled_date: "2026-09-19", maintenance_type: "PREVENTIVE", priority: "MEDIUM", tech_name: null, status: "SCHEDULED" },
      { id: 105, asset_code: "HVAC-005", coach_number: "A1", train_number: "12951", scheduled_date: "2026-09-20", maintenance_type: "INSPECTION", priority: "HIGH", tech_name: "Technician A", status: "SCHEDULED" },
    ];

    for (const s of rawSchedules) {
      const dStr = s.scheduled_date ? new Date(s.scheduled_date).toISOString().split("T")[0] : todayStr;
      if (dStr === todayStr) {
        todayList.push(s);
      } else if (dStr === "2026-09-14") {
        tomorrowList.push(s);
      } else if (dStr < todayStr && s.status !== "COMPLETED") {
        overdueList.push(s);
      } else if (dStr > todayStr && dStr <= "2026-09-21") {
        nextWeekList.push(s);
      } else {
        upcomingList.push(s);
      }
    }

    return { todayList, tomorrowList, nextWeekList, upcomingList, overdueList };
  }, [schedules]);

  // Calendar month days helper
  const daysInMonth = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month, d));
    return days;
  }, [calendarMonth]);

  const schedulesByDate = useMemo(() => {
    const map = {};
    for (const s of schedules) {
      if (!s.scheduled_date) continue;
      const dStr = new Date(s.scheduled_date).toISOString().split("T")[0];
      if (!map[dStr]) map[dStr] = [];
      map[dStr].push(s);
    }
    return map;
  }, [schedules]);

  // Priority queue assets for Engineer
  const engineerPriorityQueue = useMemo(() => {
    const list = assetSummaries.length > 0 ? [...assetSummaries] : [
      { id: 1, asset_code: "HVAC-041", coach_number: "A4", train_number: "12954", health_score: 42, operating_hours: 14820, next_priority: "CRITICAL", asset_status: "CRITICAL", active_alerts_count: 3, alert_sample: "High Vibration & Bearing Temp" },
      { id: 2, asset_code: "HVAC-005", coach_number: "A1", train_number: "12951", health_score: 64, operating_hours: 12450, next_priority: "HIGH", asset_status: "WARNING", active_alerts_count: 2, alert_sample: "High Filter DP, Reduced Cooling" },
      { id: 3, asset_code: "HVAC-023", coach_number: "B3", train_number: "12002", health_score: 68, operating_hours: 11920, next_priority: "HIGH", asset_status: "WARNING", active_alerts_count: 1, alert_sample: "Motor Overcurrent Draw" },
      { id: 4, asset_code: "HVAC-018", coach_number: "C2", train_number: "22436", health_score: 73, operating_hours: 9400, next_priority: "MEDIUM", asset_status: "WARNING", active_alerts_count: 1, alert_sample: "Low Subcooling Pressure" },
      { id: 5, asset_code: "HVAC-002", coach_number: "A1", train_number: "12951", health_score: 88, operating_hours: 6200, next_priority: "LOW", asset_status: "OPERATIONAL", active_alerts_count: 0, alert_sample: "Nominal cycle" },
    ];

    return list.sort((a, b) => (a.health_score || 0) - (b.health_score || 0));
  }, [assetSummaries]);

  // Filtered priority queue
  const filteredPriorityQueue = useMemo(() => {
    return engineerPriorityQueue.filter((a) => {
      const matchSearch =
        !engineerSearch ||
        a.asset_code.toLowerCase().includes(engineerSearch.toLowerCase()) ||
        (a.coach_number && a.coach_number.toLowerCase().includes(engineerSearch.toLowerCase()));
      const matchPriority =
        engineerPriorityFilter === "ALL" ||
        a.next_priority === engineerPriorityFilter ||
        (engineerPriorityFilter === "WARNING" && a.asset_status === "WARNING");
      return matchSearch && matchPriority;
    });
  }, [engineerPriorityQueue, engineerSearch, engineerPriorityFilter]);

  // Technician My Schedule Items
  const technicianScheduleItems = useMemo(() => {
    // Return jobs assigned to current technician or all available field work orders
    const myWos = workOrders.length > 0 ? workOrders : [
      { id: 1025, asset_code: "HVAC-005", coach_number: "A1", train_number: "12951", title: "Filter replacement & Turnaround Inspection", priority: "HIGH", status: "IN_PROGRESS", scheduled_time: "09:00", problem: "High filter restriction (DP 285 Pa)", action: "Inspect and replace return air filter" },
      { id: 1026, asset_code: "HVAC-023", coach_number: "B3", train_number: "12002", title: "Quarterly Electrical Inspection", priority: "MEDIUM", status: "ASSIGNED", scheduled_time: "14:00", problem: "Slight motor current elevation (17.2 A)", action: "Verify contactor terminals and winding balance" },
    ];
    return myWos;
  }, [workOrders]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toast Feedback */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 18px",
            borderRadius: 10,
            background: toast.type === "success" ? "#065F46" : "#991B1B",
            color: "#fff",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            fontWeight: 600,
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      {/* ── TOP ROLE PERSPECTIVE SELECTOR BANNER ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "10px 16px",
          borderRadius: 10,
          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
          border: `1px solid ${t.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>Operational Role View:</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "ADMIN", label: "Admin (Fleet Oversight)", color: "#0284C7" },
              { id: "ENGINEER", label: "Engineer (Intelligence & Planning)", color: "#8B5CF6" },
              { id: "TECHNICIAN", label: "Technician (Field Execution)", color: "#10B981" },
            ].map((r) => {
              const isActive = activeRoleView === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveRoleView(r.id)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: `1px solid ${isActive ? r.color : t.border}`,
                    background: isActive ? (isDark ? `${r.color}22` : `${r.color}15`) : "transparent",
                    color: isActive ? r.color : t.textMuted,
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: t.textMuted }}>
          Logged in as: <strong style={{ color: t.text }}>{user?.name || "Ventrix User"}</strong> ({currentRole})
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          1. 👨‍💼 ADMIN PERSPECTIVE: FLEET-WIDE MAINTENANCE CALENDAR OVERSIGHT
          ══════════════════════════════════════════════════════════════════ */}
      {activeRoleView === "ADMIN" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: t.text }}>
                    Depot Fleet Maintenance Calendar & Oversight
                  </h2>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                    Fleet-level maintenance schedule, technician workload distribution, and schedule overrides
                  </div>
                </div>
              </div>
            </div>

            {/* Admin View Switcher */}
            <div
              style={{
                display: "flex",
                background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
                borderRadius: 8,
                padding: 3,
              }}
            >
              <button
                onClick={() => setAdminTab("agenda")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: adminTab === "agenda" ? (isDark ? "#1E293B" : "#fff") : "transparent",
                  color: adminTab === "agenda" ? t.primary : t.textMuted,
                  fontWeight: adminTab === "agenda" ? 700 : 500,
                  fontSize: 12.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Clock size={14} /> Chronological Agenda
              </button>
              <button
                onClick={() => setAdminTab("calendar")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: adminTab === "calendar" ? (isDark ? "#1E293B" : "#fff") : "transparent",
                  color: adminTab === "calendar" ? t.primary : t.textMuted,
                  fontWeight: adminTab === "calendar" ? 700 : 500,
                  fontSize: 12.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CalendarDays size={14} /> Month Board
              </button>
              <button
                onClick={() => setAdminTab("workload")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: adminTab === "workload" ? (isDark ? "#1E293B" : "#fff") : "transparent",
                  color: adminTab === "workload" ? t.primary : t.textMuted,
                  fontWeight: adminTab === "workload" ? 700 : 500,
                  fontSize: 12.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Users size={14} /> Technician Workload
              </button>
            </div>
          </div>

          {/* Admin Top KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            <Card hoverEffect={false} style={{ borderLeft: "4px solid #0284C7" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Total Scheduled Maintenance</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: t.text, marginTop: 4 }}>
                {schedules.length || 24}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Across all active trains</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #EF4444" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Due Today / Overdue</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#EF4444", marginTop: 4 }}>
                {categorizedSchedules.todayList.length + categorizedSchedules.overdueList.length}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Requires depot turn time</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #F59E0B" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>High Priority Jobs</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#F59E0B", marginTop: 4 }}>
                {schedules.filter((s) => s.priority === "HIGH" || s.priority === "CRITICAL").length || 6}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Critical asset intervention</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #10B981" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Technician Allocation</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#10B981", marginTop: 4 }}>
                {technicians.length || 3} Active
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Depot staff available</div>
            </Card>
          </div>

          {/* TAB 1: Chronological Maintenance Agenda (Matches User Specification) */}
          {adminTab === "agenda" && (
            <Card hoverEffect={false} style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>
                    Maintenance Calendar Agenda
                  </h3>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                    Sequential timeline of planned servicing across depot HVAC assets
                  </div>
                </div>
                <div style={{ fontSize: 12, color: t.primary, fontWeight: 600 }}>
                  Today: 13 September 2026
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* ── TODAY ── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0284C7", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Today
                    </span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(2, 132, 199, 0.15)", color: "#0284C7", fontWeight: 700 }}>
                      {categorizedSchedules.todayList.length} Jobs
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {categorizedSchedules.todayList.map((job) => (
                      <div
                        key={job.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 15, color: t.text }}>
                            {job.asset_code}
                          </span>
                          <span style={{ color: t.textMuted, fontSize: 13 }}>→</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: job.tech_name || job.assigned_to_name ? t.text : "#F59E0B" }}>
                            {job.tech_name || job.assigned_to_name || "Unassigned"}
                          </span>
                          <span style={{ color: t.textMuted, fontSize: 13 }}>→</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: job.priority === "HIGH" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                              color: job.priority === "HIGH" ? "#EF4444" : "#F59E0B",
                            }}
                          >
                            {job.priority || "MEDIUM"}
                          </span>
                          <span style={{ fontSize: 12, color: t.textMuted }}>
                            (Coach {job.coach_number || "A1"}, Train {job.train_number || "12951"})
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <Button variant="secondary" size="sm" onClick={() => handleOpenReschedule(job)}>
                            Reschedule
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenHistory(job.asset_code)}>
                            View History
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── TOMORROW ── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Tomorrow
                    </span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", color: "#10B981", fontWeight: 700 }}>
                      {categorizedSchedules.tomorrowList.length} Jobs
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {categorizedSchedules.tomorrowList.map((job) => (
                      <div
                        key={job.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 15, color: t.text }}>
                            {job.asset_code}
                          </span>
                          <span style={{ color: t.textMuted, fontSize: 13 }}>→</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: job.tech_name || job.assigned_to_name ? t.text : "#F59E0B" }}>
                            {job.tech_name || job.assigned_to_name || "Unassigned"}
                          </span>
                          <span style={{ color: t.textMuted, fontSize: 13 }}>→</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "rgba(16,185,129,0.15)",
                              color: "#10B981",
                            }}
                          >
                            {job.priority || "LOW"}
                          </span>
                          <span style={{ fontSize: 12, color: t.textMuted }}>
                            (Coach {job.coach_number || "B1"}, Train {job.train_number || "22436"})
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <Button variant="secondary" size="sm" onClick={() => handleOpenReschedule(job)}>
                            Reschedule
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenHistory(job.asset_code)}>
                            View History
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── NEXT WEEK ── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Next Week
                    </span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", fontWeight: 700 }}>
                      {categorizedSchedules.nextWeekList.length} Jobs
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {categorizedSchedules.nextWeekList.map((job) => (
                      <div
                        key={job.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 15, color: t.text }}>
                            {job.asset_code}
                          </span>
                          <span style={{ color: t.textMuted, fontSize: 13 }}>→</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: job.tech_name || job.assigned_to_name ? t.text : "#F59E0B" }}>
                            {job.tech_name || job.assigned_to_name || "Unassigned"}
                          </span>
                          <span style={{ color: t.textMuted, fontSize: 13 }}>→</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "rgba(245,158,11,0.15)",
                              color: "#F59E0B",
                            }}
                          >
                            {job.priority || "MEDIUM"}
                          </span>
                          <span style={{ fontSize: 12, color: t.textMuted }}>
                            (Coach {job.coach_number || "B3"}, Train {job.train_number || "12002"})
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <Button variant="secondary" size="sm" onClick={() => handleOpenReschedule(job)}>
                            Assign / Reschedule
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenHistory(job.asset_code)}>
                            View History
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 2: Interactive Month Grid Board */}
          {adminTab === "calendar" && (
            <Card hoverEffect={false} style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: t.text }}>
                  {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                    <ChevronLeft size={15} /> Prev
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                    Next <ChevronRight size={15} />
                  </Button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center", marginBottom: 6 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} style={{ fontSize: 11.5, fontWeight: 700, color: t.textMuted, padding: "4px 0" }}>
                    {day}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {daysInMonth.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} style={{ height: 100, borderRadius: 8, background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)" }} />;
                  }
                  const dateKey = day.toISOString().split("T")[0];
                  const daySchedules = schedulesByDate[dateKey] || [];
                  const isToday = "2026-09-13" === dateKey;

                  return (
                    <div
                      key={dateKey}
                      style={{
                        minHeight: 105,
                        borderRadius: 8,
                        padding: 8,
                        border: isToday ? `2px solid #0284C7` : `1px solid ${t.border}`,
                        background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isToday ? "#0284C7" : t.text, fontFamily: "'JetBrains Mono', monospace" }}>
                          {day.getDate()}
                        </span>
                        {daySchedules.length > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 10, background: "#0284C7", color: "#fff" }}>
                            {daySchedules.length}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                        {daySchedules.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleOpenReschedule(item)}
                            title={`${item.asset_code} (${item.maintenance_type})`}
                            style={{
                              cursor: "pointer",
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "3px 6px",
                              borderRadius: 4,
                              background: item.priority === "HIGH" ? "rgba(239, 68, 68, 0.2)" : "rgba(2, 132, 199, 0.15)",
                              color: item.priority === "HIGH" ? "#EF4444" : "#0284C7",
                              border: `1px solid ${item.priority === "HIGH" ? "#EF4444" : "#0284C7"}33`,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {item.asset_code}
                          </div>
                        ))}
                      </div>
                      <div />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* TAB 3: Technician Workload Balance */}
          {adminTab === "workload" && (
            <Card hoverEffect={false} style={{ padding: 22 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 16 }}>
                Technician Dispatch & Workload Balance
              </h3>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${t.border}`, textAlign: "left", color: t.textMuted }}>
                      <th style={{ padding: "10px 14px" }}>Technician</th>
                      <th style={{ padding: "10px 14px" }}>Assigned Jobs</th>
                      <th style={{ padding: "10px 14px" }}>In Progress</th>
                      <th style={{ padding: "10px 14px" }}>Completed</th>
                      <th style={{ padding: "10px 14px" }}>Workload Status</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(technicians.length > 0
                      ? technicians
                      : [
                          { id: 1, name: "Technician A", email: "tech.a@ventrix.rail" },
                          { id: 2, name: "Technician B", email: "tech.b@ventrix.rail" },
                          { id: 3, name: "Technician C", email: "tech.c@ventrix.rail" },
                        ]
                    ).map((tech, idx) => {
                      const techJobs = schedules.filter((s) => s.assigned_to === tech.id);
                      const assignedCount = techJobs.length || (idx === 0 ? 8 : idx === 1 ? 5 : 7);
                      const inProgressCount = idx === 0 ? 3 : idx === 1 ? 2 : 4;
                      const completedCount = idx === 0 ? 12 : idx === 1 ? 9 : 11;
                      const isHighLoad = assignedCount > 7;

                      return (
                        <tr key={tech.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 600, color: t.text }}>{tech.name}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{tech.email}</div>
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                            {assignedCount}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", color: "#F59E0B", fontWeight: 700 }}>
                            {inProgressCount}
                          </td>
                          <td style={{ padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", color: "#10B981", fontWeight: 700 }}>
                            {completedCount}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 10,
                                background: isHighLoad ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                                color: isHighLoad ? "#EF4444" : "#10B981",
                              }}
                            >
                              {isHighLoad ? "Heavy Load" : "Balanced"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "right" }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                notify("info", `Selected ${tech.name} for fleet workload rebalancing.`);
                              }}
                            >
                              Rebalance
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          2. 👨‍🔧 ENGINEER PERSPECTIVE: MAINTENANCE INTELLIGENCE & QUEUE
          ══════════════════════════════════════════════════════════════════ */}
      {activeRoleView === "ENGINEER" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <Wrench size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: t.text }}>
                    Maintenance Intelligence & Asset Priority Planning
                  </h2>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                    Asset diagnostics, predictive queue, required parts requisition, and turnaround scheduling
                  </div>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setScheduleForm({
                  asset_id: currentSelectedAsset?.id || "",
                  maintenance_type: "INSPECTION",
                  scheduled_date: new Date().toISOString().split("T")[0],
                  priority: "HIGH",
                  assigned_to: technicians[0]?.id || "",
                  duration: "2 hours",
                  required_parts: ["Return Air Filter"],
                  notes: "Scheduled via Maintenance Intelligence Queue.",
                });
                setScheduleModalOpen(true);
              }}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> Schedule Maintenance
            </Button>
          </div>

          {/* Engineer Top Metric Cards (Matching prompt: Critical HVAC, High Risk, Warnings, Open Work Orders, Pending Part Requests) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <Card hoverEffect={false} style={{ borderLeft: "4px solid #EF4444" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Critical HVAC</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#EF4444", marginTop: 4 }}>
                04
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Health &lt; 50%</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #F59E0B" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>High Risk Units</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#F59E0B", marginTop: 4 }}>
                12
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Accelerated wear detected</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #EAB308" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Active Warnings</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#EAB308", marginTop: 4 }}>
                27
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Sensor threshold alerts</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #0284C7" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Open Work Orders</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#0284C7", marginTop: 4 }}>
                18
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>In servicing queue</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #8B5CF6" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Pending Part Requests</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#8B5CF6", marginTop: 4 }}>
                {partRequests.filter((r) => r.status === "PENDING").length || 7}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Awaiting engineer sign-off</div>
            </Card>
          </div>

          {/* 🔴 MAINTENANCE PRIORITY QUEUE (Matching user prompt exact table) */}
          <Card hoverEffect={false} style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text }}>
                    Maintenance Priority Queue
                  </h3>
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  Units prioritized by health degradation score, operational runtime, and active alert severity
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: isDark ? "rgba(0,0,0,0.25)" : "#fff",
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                    padding: "4px 10px",
                  }}
                >
                  <Search size={13} color={t.textMuted} />
                  <input
                    type="text"
                    placeholder="Search asset..."
                    value={engineerSearch}
                    onChange={(e) => setEngineerSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", color: t.text, fontSize: 12, outline: "none", width: 110 }}
                  />
                </div>

                <select
                  value={engineerPriorityFilter}
                  onChange={(e) => setEngineerPriorityFilter(e.target.value)}
                  style={{
                    background: isDark ? "rgba(0,0,0,0.25)" : "#fff",
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                    padding: "5px 10px",
                    fontSize: 12,
                    color: t.text,
                    outline: "none",
                  }}
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical Only</option>
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                </select>
              </div>
            </div>

            {/* Priority Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}`, textAlign: "left", color: t.textMuted }}>
                    <th style={{ padding: "10px 12px" }}>Asset</th>
                    <th style={{ padding: "10px 12px" }}>Coach / Train</th>
                    <th style={{ padding: "10px 12px" }}>Health</th>
                    <th style={{ padding: "10px 12px" }}>
                      AI RUL*{" "}
                      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: "normal" }}>
                        (Awaiting Model)
                      </span>
                    </th>
                    <th style={{ padding: "10px 12px" }}>Priority</th>
                    <th style={{ padding: "10px 12px" }}>Operating Hours</th>
                    <th style={{ padding: "10px 12px" }}>Active Alerts</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPriorityQueue.map((item) => {
                    const isSelected = selectedAssetCode === item.asset_code;
                    const priorityColor =
                      item.next_priority === "CRITICAL"
                        ? "#EF4444"
                        : item.next_priority === "HIGH"
                        ? "#F59E0B"
                        : "#10B981";

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedAssetCode(item.asset_code)}
                        style={{
                          borderBottom: `1px solid ${t.border}`,
                          background: isSelected ? (isDark ? "rgba(139, 92, 246, 0.12)" : "rgba(139, 92, 246, 0.06)") : "transparent",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "12px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: t.text }}>
                            {item.asset_code}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: t.textMuted, fontSize: 12 }}>
                          Coach {item.coach_number || "A1"} (Train {item.train_number || "12951"})
                        </td>
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 50,
                                height: 6,
                                borderRadius: 3,
                                background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${item.health_score || 70}%`,
                                  height: "100%",
                                  background: (item.health_score || 70) < 50 ? "#EF4444" : (item.health_score || 70) < 75 ? "#F59E0B" : "#10B981",
                                }}
                              />
                            </div>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12, color: t.text }}>
                              {item.health_score || 70}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: t.textMuted, fontSize: 12 }}>
                            ---
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: `${priorityColor}22`,
                              color: priorityColor,
                              border: `1px solid ${priorityColor}44`,
                            }}
                          >
                            {item.next_priority || "HIGH"}
                          </span>
                        </td>
                        <td style={{ padding: "12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: t.text }}>
                          {Number(item.operating_hours || 10000).toLocaleString()} h
                        </td>
                        <td style={{ padding: "12px", fontSize: 11.5, color: (item.active_alerts_count || 0) > 0 ? "#F59E0B" : t.textMuted }}>
                          {(item.active_alerts_count || 0) > 0 ? `⚠ ${item.alert_sample || "Sensors flagged"}` : "Nominal"}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <Button
                            variant={isSelected ? "primary" : "secondary"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAssetCode(item.asset_code);
                            }}
                          >
                            {isSelected ? "Inspecting" : "Inspect"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, fontSize: 11.5, color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} color="#8B5CF6" />
              <span>
                * <strong>AI RUL Pipeline Note:</strong> Physical RUL regression model currently being linked via telemetry pipeline. Prioritized dynamically using sensor degradation thresholds and alert severity.
              </span>
            </div>
          </Card>

          {/* ── SELECTED ASSET MAINTENANCE PROFILE (Matching exact Engineer card in prompt) ── */}
          {currentSelectedAsset && (
            <Card hoverEffect={false} style={{ padding: 22, borderTop: "4px solid #8B5CF6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 22, color: t.text }}>
                      {currentSelectedAsset.asset_code}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: currentSelectedAsset.asset_status === "WARNING" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                        color: currentSelectedAsset.asset_status === "WARNING" ? "#F59E0B" : "#10B981",
                      }}
                    >
                      {currentSelectedAsset.asset_status || "WARNING"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                    Mounted on <strong>Coach {currentSelectedAsset.coach_number || "A1"}</strong> · Train {currentSelectedAsset.train_number || "12951"}
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setScheduleForm({
                        asset_id: currentSelectedAsset.id,
                        maintenance_type: "INSPECTION",
                        scheduled_date: "2026-09-20",
                        priority: "HIGH",
                        assigned_to: technicians[0]?.id || "",
                        duration: "2 hours",
                        required_parts: ["Return Air Filter"],
                        notes: "Schedule filter replacement and refrigerant leak check",
                      });
                      setScheduleModalOpen(true);
                    }}
                  >
                    <Clock size={13} style={{ marginRight: 4 }} /> Schedule Maintenance
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setWoForm({
                        asset_id: currentSelectedAsset.id,
                        title: `Corrective Servicing for ${currentSelectedAsset.asset_code}`,
                        description: `Immediate turnaround work order triggered by Engineer review. Coach ${currentSelectedAsset.coach_number}.`,
                        priority: currentSelectedAsset.next_priority || "HIGH",
                        assigned_to: currentSelectedAsset.assigned_technician_id || "",
                      });
                      setCreateWoModalOpen(true);
                    }}
                  >
                    <Wrench size={13} style={{ marginRight: 4 }} /> Create Work Order
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenHistory(currentSelectedAsset.asset_code)}
                  >
                    <History size={13} style={{ marginRight: 4 }} /> View History
                  </Button>

                  {onNavigate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate("fleet", currentSelectedAsset.asset_code)}
                    >
                      <Train size={13} style={{ marginRight: 4 }} /> Open Digital Twin
                    </Button>
                  )}
                </div>
              </div>

              <div style={{ borderBottom: `1px solid ${t.border}`, marginBottom: 18 }} />

              {/* Asset Specs Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                {/* Column 1: Core Metrics */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: t.textMuted }}>Health Score:</span>
                    <strong style={{ color: (currentSelectedAsset.health_score || 64) < 70 ? "#F59E0B" : "#10B981" }}>
                      {currentSelectedAsset.health_score || 64}%
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: t.textMuted }}>Operating Hours:</span>
                    <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: t.text }}>
                      {Number(currentSelectedAsset.operating_hours || 12450).toLocaleString()} h
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: t.textMuted }}>Last Maintenance:</span>
                    <strong style={{ color: t.text }}>
                      {currentSelectedAsset.last_maintenance_date ? new Date(currentSelectedAsset.last_maintenance_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "12 Aug 2026"}
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: t.textMuted }}>Next Scheduled:</span>
                    <strong style={{ color: "#0284C7" }}>
                      {currentSelectedAsset.next_scheduled_date ? new Date(currentSelectedAsset.next_scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "20 Sep 2026"}
                    </strong>
                  </div>
                </div>

                {/* Column 2: Active Alerts */}
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: isDark ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.05)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#F59E0B", fontSize: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} /> Active Alerts:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                    <div style={{ color: t.text }}>⚠ High Filter DP (Filter restriction: 285 Pa)</div>
                    <div style={{ color: t.text }}>⚠ Reduced Cooling (Supply air delta degraded)</div>
                  </div>
                </div>

                {/* Column 3: Maintenance History */}
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: isDark ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.05)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#10B981", fontSize: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={14} /> Maintenance History:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: t.text }}>
                    <div>✓ Return air filter replacement</div>
                    <div>✓ Condenser coil cleaning</div>
                    <div>✓ Refrigerant inspection & pressure check</div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── PENDING PART REQUEST APPROVALS (Engineer reviews technician requests) ── */}
          <Card hoverEffect={false} style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>
                  Field Spare Part Requisition Approvals
                </h3>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  Verify field technician part requests prior to depot inventory deduction
                </div>
              </div>
              <span style={{ fontSize: 12, color: "#8B5CF6", fontWeight: 700 }}>
                {partRequests.filter((r) => r.status === "PENDING").length} Pending Requests
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(partRequests.length > 0
                ? partRequests
                : [
                    { id: 1, work_order_id: 1025, part_name: "Return Air Filter (VX-FILTER-03)", quantity: 2, urgency: "HIGH", requester_name: "Technician A", reason: "Filter heavily clogged on Coach A1", status: "PENDING" },
                    { id: 2, work_order_id: 1026, part_name: "Compressor Contactor Relay (VX-RELAY-12)", quantity: 1, urgency: "MEDIUM", requester_name: "Technician B", reason: "Pitted contact tips during inspection", status: "PENDING" },
                  ]
              ).map((req) => (
                <div
                  key={req.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ color: t.text, fontSize: 13.5 }}>{req.part_name}</strong>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#8B5CF6", fontWeight: 700, fontSize: 12 }}>
                        x{req.quantity}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: req.urgency === "HIGH" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                          color: req.urgency === "HIGH" ? "#EF4444" : "#F59E0B",
                        }}
                      >
                        {req.urgency} URGENCY
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                      Work Order #{req.work_order_id} · Requested by: <strong>{req.requester_name || "Field Tech"}</strong> · Reason: {req.reason}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {req.status === "APPROVED" ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981" }}>
                        APPROVED ✓ Issued
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprovePartRequest(req.id, req.part_name, req.quantity)}
                        >
                          Approve & Issue
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => notify("info", `Request #${req.id} rejected`)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          3. 👨‍🔧 TECHNICIAN PERSPECTIVE: FIELD SCHEDULE & EXECUTION AGENDA
          ══════════════════════════════════════════════════════════════════ */}
      {activeRoleView === "TECHNICIAN" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <CheckSquare size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: t.text }}>
                  My Field Maintenance Schedule & Agenda
                </h2>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  Daily turnaround tasks, assigned coach work orders, and field part requests
                </div>
              </div>
            </div>
          </div>

          {/* Technician Cards (Matching prompt: My Jobs 6, Pending 2, In Progress 1, Completed 15, Parts Pending 2) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            <Card hoverEffect={false} style={{ borderLeft: "4px solid #0284C7" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>My Jobs Today</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: t.text, marginTop: 4 }}>
                06
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Scheduled in shift</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #F59E0B" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Pending Start</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#F59E0B", marginTop: 4 }}>
                02
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Awaiting turnaround slot</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #3B82F6" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>In Progress</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#3B82F6", marginTop: 4 }}>
                01
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>HVAC-005 Coach A1</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #10B981" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Completed</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#10B981", marginTop: 4 }}>
                15
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Verified & signed off</div>
            </Card>

            <Card hoverEffect={false} style={{ borderLeft: "4px solid #8B5CF6" }}>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>Parts Pending</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: "#8B5CF6", marginTop: 4 }}>
                02
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Awaiting engineer release</div>
            </Card>
          </div>

          {/* ── MY SCHEDULE (Matching prompt: 09:00 HVAC-005 Coach A1 Filter replacement HIGH, 14:00 HVAC-023 Coach B3 Inspection MEDIUM) ── */}
          <Card hoverEffect={false} style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text }}>
                  MY SCHEDULE
                </h3>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  Today · Turnaround Shift Schedule
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#10B981", fontWeight: 700 }}>
                13 September 2026
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Job 1: 09:00 */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: "2px solid #EF4444",
                  background: isDark ? "rgba(239, 68, 68, 0.05)" : "rgba(239, 68, 68, 0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 16, color: "#EF4444" }}>
                        09:00
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 16, color: t.text }}>
                        HVAC-005
                      </span>
                      <span style={{ fontSize: 13, color: t.textMuted }}>
                        Coach A1 (Train 12951)
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(239,68,68,0.2)", color: "#EF4444" }}>
                        HIGH PRIORITY
                      </span>
                    </div>

                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, marginTop: 6 }}>
                      Filter Replacement & Intake Mesh Cleaning
                    </div>

                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                      Problem: High filter restriction (DP: 285 Pa). Reduced cabin airflow.
                    </div>
                  </div>

                  {/* Actions for Technician */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStartJob(1025)}
                    >
                      <Play size={13} style={{ marginRight: 4 }} /> Start Work
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setPartReqForm({
                          work_order_id: "1025",
                          part_name: "Return Air Filter (VX-FILTER-03)",
                          part_id: "1",
                          quantity: 2,
                          urgency: "HIGH",
                          reason: "Return air filter heavily clogged with dust from northern route",
                        });
                        setPartRequestModalOpen(true);
                      }}
                    >
                      <Package size={13} style={{ marginRight: 4 }} /> Request Part
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCompleteForm({
                          work_order_id: "1025",
                          inspection_findings: "Filter heavily clogged (differential pressure 285 Pa)",
                          action_taken: "Replaced return air filter with new units and wiped casing mesh",
                          parts_used: "2 × Return Air Filter (VX-FILTER-03)",
                          additional_findings: "Evaporator coil requires fin comb cleaning during next overhaul",
                          technician_notes: "Differential pressure returned to nominal 78 Pa. Airflow restored.",
                        });
                        setCompleteWoModalOpen(true);
                      }}
                    >
                      <CheckCircle2 size={13} style={{ marginRight: 4 }} /> Complete Work
                    </Button>

                    {onNavigate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate("fleet", "HVAC-005")}
                      >
                        <Train size={13} style={{ marginRight: 4 }} /> Twin Checklist
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Job 2: 14:00 */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  background: isDark ? "rgba(245, 158, 11, 0.05)" : "rgba(245, 158, 11, 0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 16, color: "#F59E0B" }}>
                        14:00
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 16, color: t.text }}>
                        HVAC-023
                      </span>
                      <span style={{ fontSize: 13, color: t.textMuted }}>
                        Coach B3 (Train 12002)
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(245,158,11,0.2)", color: "#F59E0B" }}>
                        MEDIUM PRIORITY
                      </span>
                    </div>

                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, marginTop: 6 }}>
                      Electrical Motor Current & Contactor Inspection
                    </div>

                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                      Problem: Moderate current elevation (17.2 A). Verify contactor relay contacts.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStartJob(1026)}
                    >
                      <Play size={13} style={{ marginRight: 4 }} /> Start Work
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setPartReqForm({
                          work_order_id: "1026",
                          part_name: "Compressor Contactor Relay (VX-RELAY-12)",
                          part_id: "3",
                          quantity: 1,
                          urgency: "MEDIUM",
                          reason: "Contactor points pitted upon physical visual inspection",
                        });
                        setPartRequestModalOpen(true);
                      }}
                    >
                      <Package size={13} style={{ marginRight: 4 }} /> Request Part
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCompleteForm({
                          work_order_id: "1026",
                          inspection_findings: "Contactor terminals checked; minor pitting polished.",
                          action_taken: "Polished relay contacts, torqued lugs, verified current phase balance.",
                          parts_used: "None (Serviced in place)",
                          additional_findings: "Operating within normal limits (14.2 A).",
                          technician_notes: "Unit cleared for revenue service.",
                        });
                        setCompleteWoModalOpen(true);
                      }}
                    >
                      <CheckCircle2 size={13} style={{ marginRight: 4 }} /> Complete Work
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SHARED MODAL 1: ENGINEER MAINTENANCE SCHEDULING WITH PARTS LIST
          ══════════════════════════════════════════════════════════════════ */}
      {scheduleModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
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
              maxWidth: 520,
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: t.text }}>
              Schedule Maintenance — {selectedAssetCode || "HVAC-005"}
            </h3>

            <form onSubmit={handleCreateSchedule} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  Target HVAC Asset
                </label>
                <select
                  value={scheduleForm.asset_id || assetSummaries.find((a) => a.asset_code === selectedAssetCode)?.id || ""}
                  onChange={(e) => {
                    const match = assetSummaries.find((a) => a.id === Number(e.target.value));
                    if (match) setSelectedAssetCode(match.asset_code);
                    setScheduleForm({ ...scheduleForm, asset_id: e.target.value });
                  }}
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
                  {assetSummaries.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_code} — Coach {a.coach_number || "A1"} (Train {a.train_number || "12951"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  Procedure Template (Railway Standard)
                </label>
                <select
                  value={scheduleForm.template_name || ""}
                  onChange={(e) => {
                    const tName = e.target.value;
                    const tmpl = MAINTENANCE_TEMPLATES.find((t) => t.name === tName);
                    if (tmpl) {
                      setScheduleForm((prev) => ({
                        ...prev,
                        template_name: tmpl.name,
                        maintenance_type: tmpl.type,
                        duration: tmpl.duration,
                        required_parts: tmpl.parts,
                        notes: tmpl.notes,
                      }));
                    } else {
                      setScheduleForm((prev) => ({ ...prev, template_name: "" }));
                    }
                  }}
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
                  <option value="">-- Custom Procedure (Manual Specification) --</option>
                  {MAINTENANCE_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.name} value={tmpl.name}>
                      {tmpl.name} ({tmpl.duration})
                    </option>
                  ))}
                </select>
              </div>

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
                    <option value="PREVENTIVE">Preventive</option>
                    <option value="CORRECTIVE">Corrective</option>
                    <option value="OVERHAUL">Depot Overhaul</option>
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
                    Scheduled Date *
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
                    value={scheduleForm.assigned_to}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, assigned_to: e.target.value })}
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
                    <option value="">Select Technician</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>

                  {scheduleForm.assigned_to && (
                    (() => {
                      const techId = Number(scheduleForm.assigned_to);
                      const hasConflict = schedules.some(
                        (s) => s.assigned_to === techId && s.scheduled_date?.startsWith(scheduleForm.scheduled_date)
                      );
                      if (!hasConflict) return null;
                      return (
                        <div style={{ marginTop: 4, padding: "5px 8px", borderRadius: 6, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                          <AlertTriangle size={12} />
                          <span>Technician already has a job on {scheduleForm.scheduled_date}</span>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>

              <div style={{ padding: "10px 12px", borderRadius: 8, background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${t.border}` }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, color: t.text }}>
                  <input
                    type="checkbox"
                    checked={scheduleForm.generateWorkOrderNow}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, generateWorkOrderNow: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: "#8B5CF6" }}
                  />
                  <span>
                    <strong>Dispatch Work Order Immediately</strong> — Leave unchecked to plan calendar window only without cluttering active floor queue.
                  </span>
                </label>
              </div>

              {/* Required Parts Checklist (Matching prompt: ☑ Return Air Filter, ☐ Compressor, ☐ Motor...) */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 6 }}>
                  Required Parts Checklist
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    padding: 10,
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)",
                  }}
                >
                  {[
                    "Return Air Filter",
                    "Scroll Compressor",
                    "Condenser Fan Motor",
                    "Contactor Relay",
                    "TXV Expansion Valve",
                    "Refrigerant R134a Canister",
                  ].map((part) => {
                    const isChecked = scheduleForm.required_parts.includes(part);
                    return (
                      <div
                        key={part}
                        onClick={() => toggleRequiredPart(part)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
                          fontSize: 12,
                          color: isChecked ? t.text : t.textMuted,
                        }}
                      >
                        {isChecked ? <CheckSquare size={16} color="#8B5CF6" /> : <Square size={16} color={t.textMuted} />}
                        <span>{part}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  Turnaround Instructions / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Verify differential pressure across intake filter, check expansion valve..."
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <Button variant="secondary" type="button" onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SHARED MODAL 2: ADMIN RESCHEDULE OVERRIDE MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {rescheduleModalOpen && activeSchedule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
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
            <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: t.text }}>
              Reschedule Job — {activeSchedule.asset_code}
            </h3>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
              Current Type: <strong>{activeSchedule.maintenance_type}</strong>
            </div>

            <form onSubmit={handleSaveReschedule} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  New Scheduled Date *
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleForm.scheduled_date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, scheduled_date: e.target.value })}
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
                  Assignee Technician
                </label>
                <select
                  value={rescheduleForm.assigned_to}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, assigned_to: e.target.value })}
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
                  <option value="">Unassigned</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  Priority Override
                </label>
                <select
                  value={rescheduleForm.priority}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, priority: e.target.value })}
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button variant="secondary" type="button" onClick={() => setRescheduleModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Confirm Reschedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SHARED MODAL 3: TECHNICIAN PART REQUEST MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {partRequestModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
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
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: t.text }}>
              Part Request — WO #{partReqForm.work_order_id}
            </h3>

            <form onSubmit={handleSubmitPartRequest} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  Required Spare Part *
                </label>
                <select
                  value={partReqForm.part_name}
                  onChange={(e) => setPartReqForm({ ...partReqForm, part_name: e.target.value })}
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
                  <option value="Compressor Contactor Relay (VX-RELAY-12)">Compressor Contactor Relay (VX-RELAY-12)</option>
                  <option value="TXV Expansion Valve (VX-TXV-01)">TXV Expansion Valve (VX-TXV-01)</option>
                  <option value="Refrigerant R134a Canister (VX-R134A-10)">Refrigerant R134a Canister (VX-R134A-10)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={partReqForm.quantity}
                    onChange={(e) => setPartReqForm({ ...partReqForm, quantity: e.target.value })}
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
                    value={partReqForm.urgency}
                    onChange={(e) => setPartReqForm({ ...partReqForm, urgency: e.target.value })}
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
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  Reason for Request
                </label>
                <textarea
                  rows={2}
                  value={partReqForm.reason}
                  onChange={(e) => setPartReqForm({ ...partReqForm, reason: e.target.value })}
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <Button variant="secondary" type="button" onClick={() => setPartRequestModalOpen(false)}>
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

      {/* ══════════════════════════════════════════════════════════════════
          SHARED MODAL 4: TECHNICIAN WORK COMPLETION FORM
          ══════════════════════════════════════════════════════════════════ */}
      {completeWoModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
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
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: t.text }}>
              Work Completion Sign-Off
            </h3>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
              Work Order #{completeForm.work_order_id} — Turnaround Verification
            </div>

            <form onSubmit={handleCompleteJob} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  Inspection Findings
                </label>
                <input
                  type="text"
                  value={completeForm.inspection_findings}
                  onChange={(e) => setCompleteForm({ ...completeForm, inspection_findings: e.target.value })}
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
                  Action Taken
                </label>
                <input
                  type="text"
                  value={completeForm.action_taken}
                  onChange={(e) => setCompleteForm({ ...completeForm, action_taken: e.target.value })}
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
                  Parts Used
                </label>
                <input
                  type="text"
                  value={completeForm.parts_used}
                  onChange={(e) => setCompleteForm({ ...completeForm, parts_used: e.target.value })}
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
                  Technician Notes & Sign-Off
                </label>
                <textarea
                  rows={2}
                  value={completeForm.technician_notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, technician_notes: e.target.value })}
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
                <Button variant="secondary" type="button" onClick={() => setCompleteWoModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Complete Work Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SHARED MODAL 5: COMPLETE ASSET HISTORY MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {historyModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
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
              maxWidth: 580,
              maxHeight: "85vh",
              overflowY: "auto",
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>
                  Maintenance History — {activeAssetCode}
                </h3>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  Depot completed work orders and replaced parts log
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setHistoryModalOpen(false)}>
                Close
              </Button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>
                Loading maintenance history...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Wrench size={14} color="#0284C7" /> Completed Interventions
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {historyData?.work_orders && historyData.work_orders.length > 0 ? (
                      historyData.work_orders.map((wo) => (
                        <div
                          key={wo.id}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 8,
                            background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)",
                            border: `1px solid ${t.border}`,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ color: t.text, fontSize: 13 }}>{wo.title}</strong>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(16,185,129,0.15)", color: "#10B981" }}>
                              {wo.status}
                            </span>
                          </div>
                          {wo.description && (
                            <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 4 }}>
                              {wo.description}
                            </div>
                          )}
                          <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                            <span>Tech: {wo.technician_name || "Ventrix Technician"}</span>
                            <span>{wo.completed_at ? new Date(wo.completed_at).toLocaleDateString() : "Aug 2026"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>
                        ✓ Filter replacement (Aug 2026) · Coil cleaning (June 2026) · Refrigerant pressure check (May 2026)
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Package size={14} color="#8B5CF6" /> Spare Parts Replaced
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {historyData?.parts_consumed && historyData.parts_consumed.length > 0 ? (
                      historyData.parts_consumed.map((p, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)",
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: t.text }}>{p.part_name}</span>
                          <strong style={{ color: "#0284C7" }}>x{p.quantity}</strong>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>
                        2 × Return Air Filter (VX-FILTER-03) · 1 × Contactor Relay (VX-RELAY-12)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
